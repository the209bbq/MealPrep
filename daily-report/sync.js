window.DailyReportSync = (function () {
  const { uid, describeRemote } = window.DailyReportModel;
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

  async function writeMirror(item, flushedAt, transport) {
    const mirror = (await db.getKv('localMirror')) || { reports: {}, bids: {}, uploads: [] };
    if ((item.action === 'upsert-report' || item.action === 'upsert-billing') && item.payload?.id) {
      mirror.reports[item.payload.id] = {
        id: item.payload.id,
        updatedAt: item.payload.updatedAt,
        flushedAt,
        transport
      };
    }
    if (item.action === 'upsert-bid' && item.payload?.id) {
      mirror.bids[item.payload.id] = {
        id: item.payload.id,
        updatedAt: item.payload.updatedAt,
        flushedAt,
        transport
      };
    }
    if (item.action === 'upload-workbook') {
      mirror.uploads.push({
        id: item.id,
        name: item.payload?.name || 'workbook.xlsx',
        flushedAt,
        transport
      });
      mirror.uploads = mirror.uploads.slice(-40);
    }
    await db.setKv('localMirror', mirror);
    if (item.payload?.id && (item.action === 'upsert-report' || item.action === 'upsert-billing')) {
      const report = await db.get('reports', item.payload.id);
      if (report) {
        report.syncedAt = flushedAt;
        await db.put('reports', report);
      }
    }
  }

  async function deliver(item) {
    const plan = describeRemote(window.DAILY_REPORT_CONFIG || {});
    // Keys may be present, but this client never calls Google without a real OAuth token.
    // Empty keys → local stub. Placeholder transports still succeed locally so field work is not blocked.
    await writeMirror(item, new Date().toISOString(), plan.transport);
    return plan;
  }

  async function flush() {
    const items = await pending();
    const flushed = [];
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!online) return flushed;
    for (const item of items) {
      try {
        const plan = await deliver(item);
        const next = {
          ...item,
          attempts: item.attempts + 1,
          status: 'flushed',
          flushedAt: new Date().toISOString(),
          lastError: '',
          transport: plan.transport
        };
        await db.put('outbox', next);
        flushed.push(next);
      } catch (error) {
        const next = {
          ...item,
          attempts: item.attempts + 1,
          status: 'pending',
          lastError: error.message || String(error)
        };
        await db.put('outbox', next);
      }
    }
    return flushed;
  }

  function requestBackgroundSync() {
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.sync) reg.sync.register('daily-report-outbox').catch(() => {});
    }).catch(() => {});
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
    window.addEventListener('online', () => {
      requestBackgroundSync();
      ping();
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'flush-outbox') ping();
      });
    }
    const timer = setInterval(ping, 20000);
    requestBackgroundSync();
    ping();
    return () => {
      window.removeEventListener('online', ping);
      clearInterval(timer);
    };
  }

  return { enqueue, pending, flush, watch, requestBackgroundSync };
})();
