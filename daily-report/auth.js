window.DailyReportAuth = (function () {
  const { uid } = window.DailyReportModel;
  const db = window.DailyReportDB;

  function config() {
    return window.DAILY_REPORT_CONFIG || {};
  }

  function googleClientId() {
    return String(config().googleClientId || '').trim();
  }

  async function listUsers() {
    const users = await db.getAll('users');
    return users.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  async function getSession() {
    const session = await db.getKv('session');
    if (!session || !session.userId) return null;
    const user = await db.get('users', session.userId);
    return user ? { ...session, user } : null;
  }

  async function setSession(user, extras) {
    const session = {
      userId: user.id,
      provider: user.provider,
      startedAt: new Date().toISOString(),
      ...(extras || {})
    };
    await db.setKv('session', session);
    return { ...session, user };
  }

  async function clearSession() {
    await db.setKv('session', null);
  }

  async function upsertUser(fields) {
    const existing = fields.id ? await db.get('users', fields.id) : null;
    const user = {
      id: fields.id || uid('user'),
      name: fields.name || 'Unnamed',
      email: fields.email || '',
      provider: fields.provider || 'local',
      picture: fields.picture || '',
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    };
    await db.put('users', user);
    return user;
  }

  async function createLocalUser(name, email) {
    return upsertUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      provider: 'local'
    });
  }

  async function switchTo(userId) {
    const user = await db.get('users', userId);
    if (!user) throw new Error('Account not found');
    user.lastSeenAt = new Date().toISOString();
    await db.put('users', user);
    return setSession(user);
  }

  async function removeUser(userId) {
    const session = await getSession();
    await db.del('users', userId);
    if (session?.userId === userId) await clearSession();
  }

  function decodeJwtPayload(credential) {
    const parts = String(credential || '').split('.');
    if (parts.length < 2) return null;
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  async function signInWithGoogleCredential(credential) {
    const payload = decodeJwtPayload(credential);
    if (!payload || !payload.sub) throw new Error('Google sign-in did not return a user');
    const user = await upsertUser({
      id: `google-${payload.sub}`,
      name: payload.name || payload.email || 'Google user',
      email: payload.email || '',
      picture: payload.picture || '',
      provider: 'google'
    });
    return setSession(user, { googleSub: payload.sub });
  }

  async function signInWithGoogleMock() {
    const user = await upsertUser({
      id: 'google-local-demo',
      name: 'Google demo user',
      email: 'demo.local@accounts.google',
      provider: 'google-mock'
    });
    return setSession(user, { mock: true });
  }

  function loadGis(callback) {
    const clientId = googleClientId();
    if (!clientId) return Promise.resolve(false);
    return new Promise((resolve) => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({ client_id: clientId, callback });
        resolve(true);
        return;
      }
      const existing = document.querySelector('script[data-gis="1"]');
      if (existing) {
        existing.addEventListener('load', () => {
          window.google.accounts.id.initialize({ client_id: clientId, callback });
          resolve(true);
        });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.dataset.gis = '1';
      script.onload = () => {
        window.google.accounts.id.initialize({ client_id: clientId, callback });
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  return {
    config,
    googleClientId,
    listUsers,
    getSession,
    setSession,
    clearSession,
    upsertUser,
    createLocalUser,
    switchTo,
    removeUser,
    signInWithGoogleCredential,
    signInWithGoogleMock,
    loadGis
  };
})();
