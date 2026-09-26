window.DailyReportDB = (function () {
  const DB_NAME = 'daily-report';
  const DB_VERSION = 1;
  let opened;

  function openDb() {
    if (opened) return opened;
    opened = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('reports')) {
          const store = db.createObjectStore('reports', { keyPath: 'id' });
          store.createIndex('byUser', 'userId');
          store.createIndex('byDate', 'reportDate');
        }
        if (!db.objectStoreNames.contains('attachments')) db.createObjectStore('attachments', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return opened;
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('aborted'));
    });
  }

  async function withStore(storeName, mode, fn) {
    const db = await openDb();
    const tx = db.transaction(storeName, mode);
    const result = fn(tx.objectStore(storeName));
    await txDone(tx);
    return result;
  }

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function get(store, key) {
    return withStore(store, 'readonly', (s) => request(s.get(key)));
  }

  async function getAll(store) {
    return withStore(store, 'readonly', (s) => request(s.getAll()));
  }

  async function put(store, value) {
    return withStore(store, 'readwrite', (s) => request(s.put(value)));
  }

  async function del(store, key) {
    return withStore(store, 'readwrite', (s) => request(s.delete(key)));
  }

  async function getKv(key) {
    const row = await get('kv', key);
    return row ? row.value : undefined;
  }

  async function setKv(key, value) {
    return put('kv', { key, value });
  }

  async function reportsForUser(userId) {
    const db = await openDb();
    const tx = db.transaction('reports', 'readonly');
    const index = tx.objectStore('reports').index('byUser');
    const rows = await request(index.getAll(userId));
    await txDone(tx);
    return rows.sort((a, b) => String(b.reportDate).localeCompare(String(a.reportDate))
      || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  return { openDb, get, getAll, put, del, getKv, setKv, reportsForUser };
})();
