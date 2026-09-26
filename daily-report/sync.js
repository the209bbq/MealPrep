window.DailyReportSync = (function () {
  const { uid } = window.DailyReportModel;
  const db = window.DailyReportDB;

  async function enqueue(action, payload) {
    const item = {
      id: uid('out'),
      action,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      lastError: ''
    };
    await db.put('outbox', item);
    return item;
  }

  async function pending() {
    const rows = await db.getAll('outbox');
    return rows.filter((row) => row.status !== 'flushed').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function flush() {
    const items = await pending();
    const flushed = [];
    for (const item of items) {
      const next = {
        ...item,
        attempts: item.attempts + 1,
        status: 'flushed',
        flushedAt: new Date().toISOString(),
        lastError: ''
      };
      await db.put('outbox', next);
      const mirror = (await db.getKv('localMirror')) || { reports: {} };
      if (item.action === 'upsert-report' && item.payload?.id) {
        mirror.reports[item.payload.id] = {
          id: item.payload.id,
          updatedAt: item.payload.updatedAt,
          flushedAt: next.flushedAt
        };
        await db.setKv('localMirror', mirror);
      }
      if (item.payload?.id) {
        const report = await db.get('reports', item.payload.id);
        if (report) {
          report.syncedAt = next.flushedAt;
          await db.put('reports', report);
        }
      }
      flushed.push(next);
    }
    return flushed;
  }

  function watch(onChange) {
    const ping = async () => {
      if (navigator.onLine) {
        try {
          await flush();
        } catch (error) {
          console.warn('Outbox flush failed', error);
        }
      }
      if (onChange) onChange(await pending());
    };
    window.addEventListener('online', ping);
    const timer = setInterval(ping, 20000);
    ping();
    return () => {
      window.removeEventListener('online', ping);
      clearInterval(timer);
    };
  }

  return { enqueue, pending, flush, watch };
})();
