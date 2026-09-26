window.DailyReportApp = (function () {
  const model = window.DailyReportModel;
  const db = window.DailyReportDB;
  const auth = window.DailyReportAuth;
  const sync = window.DailyReportSync;
  const excel = window.DailyReportExcel;

  const appEl = () => document.getElementById('app');
  let state = {
    session: null,
    users: [],
    reports: [],
    report: null,
    outbox: [],
    toast: '',
    view: 'list',
    linked: null,
    folderName: '',
    drive: excel.driveConfig()
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function toast(message) {
    state.toast = message;
    const el = $('.toast');
    if (el) {
      el.textContent = message;
      el.hidden = !message;
    } else {
      render();
    }
    if (message) setTimeout(() => {
      if (state.toast === message) {
        state.toast = '';
        const t = $('.toast');
        if (t) t.hidden = true;
      }
    }, 2800);
  }

  function route() {
    const hash = location.hash.replace(/^#/, '') || '/';
    const parts = hash.split('/').filter(Boolean);
    if (!state.session) return { name: 'auth' };
    if (parts[0] === 'settings') return { name: 'settings' };
    if (parts[0] === 'accounts') return { name: 'accounts' };
    if (parts[0] === 'report' && parts[1] === 'new') return { name: 'edit', id: 'new' };
    if (parts[0] === 'report' && parts[1]) return { name: 'edit', id: parts[1] };
    return { name: 'list' };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function header(title, extra) {
    const user = state.session?.user;
    return `
      <header class="topbar">
        <div>
          <p class="eyebrow">Daily report</p>
          <h1>${escapeHtml(title)}</h1>
        </div>
        <div class="topbar-actions">
          <label class="user-switch">
            <span>Account</span>
            <select id="user-switcher" ${state.users.length ? '' : 'disabled'}>
              ${state.users.map((u) => `
                <option value="${escapeHtml(u.id)}" ${u.id === user?.id ? 'selected' : ''}>
                  ${escapeHtml(u.name)} (${escapeHtml(u.provider)})
                </option>`).join('')}
            </select>
          </label>
          <a class="btn ghost" href="#/settings">Excel &amp; folders</a>
          <button type="button" class="btn ghost" id="sign-out">Sign out</button>
        </div>
      </header>
      <p class="status-line">
        ${navigator.onLine ? 'Online' : 'Offline'} · ${state.outbox.length} waiting to sync
        ${extra ? ` · ${extra}` : ''}
      </p>
      <div class="toast" ${state.toast ? '' : 'hidden'}>${escapeHtml(state.toast)}</div>
    `;
  }

  function authView() {
    const hasGoogle = Boolean(auth.googleClientId());
    return `
      <main class="auth-shell">
        <section class="card auth-card">
          <p class="eyebrow">Field reports</p>
          <h1>Sign in to the daily report book</h1>
          <p class="lede">Accounts stay on this device. Google sign-in is ready when a client ID is set; otherwise use a local or demo Google session.</p>
          <div id="google-btn-slot" class="google-slot" ${hasGoogle ? '' : 'hidden'}></div>
          ${hasGoogle ? '' : `
            <button type="button" class="btn primary wide" id="google-mock">Continue with Google (local demo)</button>
            <p class="hint">No <code>googleClientId</code> in <code>config.js</code>. This mock session does not call Google.</p>
          `}
          <form id="local-account" class="stack">
            <h2>Local account</h2>
            <label>Name <input name="name" required autocomplete="name"></label>
            <label>Email <input name="email" type="email" autocomplete="email"></label>
            <button type="submit" class="btn primary">Save account &amp; enter</button>
          </form>
          ${state.users.length ? `
            <div class="stack">
              <h2>On this device</h2>
              <ul class="account-list">
                ${state.users.map((u) => `
                  <li>
                    <button type="button" class="btn wide" data-switch="${escapeHtml(u.id)}">
                      ${escapeHtml(u.name)} <span>${escapeHtml(u.email || u.provider)}</span>
                    </button>
                  </li>`).join('')}
              </ul>
            </div>` : ''}
        </section>
      </main>
    `;
  }

  function listView() {
    const rows = state.reports.map((report) => `
      <a class="report-row" href="#/report/${escapeHtml(report.id)}">
        <div>
          <strong>${escapeHtml(model.reportTitle(report))}</strong>
          <p>${escapeHtml(report.reportDate || 'No date')} · ${escapeHtml(report.locationText || 'No location')} · ${escapeHtml(report.weather || 'Weather not set')}</p>
        </div>
        <span class="pill ${report.status}">${escapeHtml(report.status)}</span>
      </a>
    `).join('');
    return `
      ${header('Reports')}
      <main class="page">
        <div class="toolbar">
          <a class="btn primary" href="#/report/new">New daily report</a>
          <button type="button" class="btn" id="export-all">Export all .xlsx</button>
        </div>
        <section class="card list-card">
          ${rows || '<p class="empty">No reports yet. Start one even if you are offline — it saves here first.</p>'}
        </section>
      </main>
    `;
  }

  function lineEditor(kind, rows) {
    const labels = {
      crew: ['Name', 'Role', 'Hours'],
      materials: ['Material', 'Qty', 'Unit', 'Notes'],
      equipment: ['Equipment', 'Hours', 'Notes']
    };
    const fields = {
      crew: ['name', 'role', 'hours'],
      materials: ['name', 'qty', 'unit', 'notes'],
      equipment: ['name', 'hours', 'notes']
    };
    const keys = fields[kind];
    return `
      <div class="lines" data-kind="${kind}">
        ${rows.map((row, index) => `
          <div class="line" data-id="${escapeHtml(row.id)}">
            ${keys.map((key, i) => `
              <label>${labels[kind][i]}
                <input data-field="${key}" value="${escapeHtml(row[key] || '')}" ${key === 'hours' || key === 'qty' ? 'inputmode="decimal"' : ''}>
              </label>`).join('')}
            <button type="button" class="btn ghost danger" data-remove="${index}" aria-label="Remove row">×</button>
          </div>`).join('')}
        <button type="button" class="btn" data-add="${kind}">Add ${kind === 'crew' ? 'crew member' : kind === 'materials' ? 'material' : 'equipment'}</button>
      </div>
    `;
  }

  function editView() {
    const r = state.report;
    if (!r) return `${header('Report')}<main class="page"><p>Loading…</p></main>`;
    const photos = (r.photos || []).map((photo) => `
      <figure class="photo" data-photo="${escapeHtml(photo.id)}">
        <img alt="${escapeHtml(photo.name)}" data-src-id="${escapeHtml(photo.id)}">
        <figcaption>${escapeHtml(photo.name)}
          <button type="button" class="btn ghost" data-del-photo="${escapeHtml(photo.id)}">Remove</button>
        </figcaption>
      </figure>
    `).join('');
    return `
      ${header(r.jobName || 'New report')}
      <main class="page">
        <form id="report-form" class="report-form">
          <section class="card">
            <h2>Job</h2>
            <div class="grid">
              <label>Job name <input name="jobName" required value="${escapeHtml(r.jobName)}"></label>
              <label>Job number <input name="jobNumber" value="${escapeHtml(r.jobNumber)}"></label>
              <label>Date <input name="reportDate" type="date" value="${escapeHtml(r.reportDate)}"></label>
              <label>Time <input name="reportTime" type="time" value="${escapeHtml(r.reportTime)}"></label>
            </div>
          </section>
          <section class="card">
            <h2>Weather &amp; location</h2>
            <div class="grid">
              <label>Weather
                <select name="weather">
                  ${['', 'Sunny', 'Cloudy', 'Rain', 'Wind', 'Snow', 'Hot', 'Cold', 'Other'].map((opt) => `
                    <option value="${opt}" ${r.weather === opt ? 'selected' : ''}>${opt || 'Select'}</option>`).join('')}
                </select>
              </label>
              <label>Weather notes <input name="weatherNotes" value="${escapeHtml(r.weatherNotes)}"></label>
              <label class="wide">Location
                <input name="locationText" value="${escapeHtml(r.locationText)}" placeholder="Jobsite / address">
              </label>
            </div>
            <div class="toolbar">
              <button type="button" class="btn" id="use-location">Use device location</button>
              <p class="hint" id="geo-status">
                ${r.lat != null ? `Pinned ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)} (±${Math.round(r.locationAccuracy || 0)}m)` : 'Location optional. Reverse geocode can use a Maps key later.'}
              </p>
            </div>
          </section>
          <section class="card">
            <h2>Hours</h2>
            <div class="grid">
              <label>Start <input name="hoursStart" type="time" value="${escapeHtml(r.hoursStart)}"></label>
              <label>End <input name="hoursEnd" type="time" value="${escapeHtml(r.hoursEnd)}"></label>
              <label>Total hours <input name="hoursTotal" inputmode="decimal" value="${escapeHtml(r.hoursTotal)}"></label>
              <label>Overtime <input name="hoursOvertime" inputmode="decimal" value="${escapeHtml(r.hoursOvertime)}"></label>
            </div>
          </section>
          <section class="card">
            <h2>Crew</h2>
            ${lineEditor('crew', r.crew)}
          </section>
          <section class="card">
            <h2>Materials</h2>
            ${lineEditor('materials', r.materials)}
          </section>
          <section class="card">
            <h2>Equipment</h2>
            ${lineEditor('equipment', r.equipment)}
          </section>
          <section class="card">
            <h2>Delays &amp; safety</h2>
            <label>Delays <textarea name="delays" rows="3">${escapeHtml(r.delays)}</textarea></label>
            <label>Safety notes <textarea name="safetyNotes" rows="3">${escapeHtml(r.safetyNotes)}</textarea></label>
          </section>
          <section class="card">
            <h2>Photos &amp; attachments</h2>
            <input id="photo-input" type="file" accept="image/*,.pdf,.heic" multiple>
            <div class="photos">${photos || '<p class="hint">Photos stay in IndexedDB on this device until Excel/Drive sync is wired.</p>'}</div>
          </section>
          <section class="card">
            <h2>Supervisor &amp; signature</h2>
            <div class="grid">
              <label>Supervisor <input name="supervisor" value="${escapeHtml(r.supervisor)}"></label>
              <label>Printed name / signature <input name="signatureName" value="${escapeHtml(r.signatureName)}"></label>
            </div>
            <p class="hint">Sign with your finger, then save. Name above is the billing signature line.</p>
            <canvas id="sign-pad" width="640" height="180" aria-label="Signature pad"></canvas>
            <div class="toolbar">
              <button type="button" class="btn ghost" id="clear-sign">Clear mark</button>
            </div>
            <label class="check">
              <input type="checkbox" name="complete" ${r.status === 'complete' ? 'checked' : ''}>
              Mark complete
            </label>
          </section>
          <div class="sticky-actions">
            <button type="submit" class="btn primary">Save on this device</button>
            <button type="button" class="btn" id="export-one">Export this report .xlsx</button>
            <a class="btn ghost" href="#/">Back to list</a>
          </div>
        </form>
      </main>
    `;
  }

  function settingsView() {
    const drive = state.drive;
    const linked = state.linked;
    return `
      ${header('Excel &amp; folders')}
      <main class="page">
        <section class="card">
          <h2>Workbook (system of record)</h2>
          <p>Billing, bids, and reports live in Excel. This screen links a workbook on the device and can export/import <code>.xlsx</code> via SheetJS. Google Drive upload is a placeholder until API keys exist.</p>
          <p class="hint">Linked: ${linked ? escapeHtml(linked.name) : 'none yet'}</p>
          <div class="toolbar wrap">
            <button type="button" class="btn" id="pick-workbook">Pick / link workbook</button>
            <button type="button" class="btn" id="import-xlsx">Import .xlsx</button>
            <button type="button" class="btn" id="export-all">Export all reports</button>
            <button type="button" class="btn" id="save-linked" ${linked?.handle ? '' : 'disabled'}>Write to linked file</button>
          </div>
          <input id="xlsx-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
        </section>
        <section class="card">
          <h2>Local folder</h2>
          <p>File System Access API (Chromium) can keep a job folder. Other browsers use file pickers.</p>
          <p class="hint">Folder: ${escapeHtml(state.folderName || 'not granted')}</p>
          <div class="toolbar wrap">
            <button type="button" class="btn" id="pick-folder">Grant folder access</button>
            <button type="button" class="btn" id="list-folder">List .xlsx in folder</button>
          </div>
          <ul id="folder-list" class="account-list"></ul>
        </section>
        <section class="card">
          <h2>Google Drive / Sheets (stub)</h2>
          <p>Later: OAuth client + Drive/Sheets APIs. No secrets are stored in the repo.</p>
          <dl class="kv">
            <dt>GOOGLE_CLIENT_ID</dt><dd>${escapeHtml(auth.googleClientId() || '(empty — mock sign-in)')}</dd>
            <dt>GOOGLE_API_KEY</dt><dd>${drive.apiKey ? '(set in config)' : '(empty)'}</dd>
            <dt>GOOGLE_DRIVE_FOLDER_ID</dt><dd>${escapeHtml(drive.folderId || '(empty)')}</dd>
            <dt>GOOGLE_SHEETS_SPREADSHEET_ID</dt><dd>${escapeHtml(drive.spreadsheetId || '(empty)')}</dd>
          </dl>
          <button type="button" class="btn" id="drive-placeholder" disabled>Connect Drive (not wired)</button>
        </section>
        <section class="card">
          <h2>Sync outbox</h2>
          <p>Saves queue here and flush when online. Flush currently writes a local mirror (no network Excel/Drive yet).</p>
          <p>${state.outbox.length} pending</p>
          <button type="button" class="btn" id="flush-outbox">Flush outbox now</button>
        </section>
        <p><a class="btn ghost" href="#/">Back to reports</a></p>
      </main>
    `;
  }

  function bindAuth() {
    $('#local-account')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      const user = await auth.createLocalUser(String(data.get('name') || ''), String(data.get('email') || ''));
      state.session = await auth.setSession(user);
      location.hash = '/';
      await boot();
    });
    $('#google-mock')?.addEventListener('click', async () => {
      state.session = await auth.signInWithGoogleMock();
      location.hash = '/';
      await boot();
    });
    document.querySelectorAll('[data-switch]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        state.session = await auth.switchTo(btn.dataset.switch);
        location.hash = '/';
        await boot();
      });
    });
    const slot = $('#google-btn-slot');
    if (slot && auth.googleClientId()) {
      auth.loadGis(async (response) => {
        state.session = await auth.signInWithGoogleCredential(response.credential);
        location.hash = '/';
        await boot();
      }).then((ok) => {
        if (ok && window.google?.accounts?.id) {
          window.google.accounts.id.renderButton(slot, { theme: 'filled_black', size: 'large', width: 320 });
        }
      });
    }
  }

  function bindChrome() {
    $('#user-switcher')?.addEventListener('change', async (event) => {
      state.session = await auth.switchTo(event.target.value);
      toast('Switched account');
      await loadReports();
      const r = route();
      if (r.name === 'edit' && r.id !== 'new') location.hash = '/';
      else await render();
    });
    $('#sign-out')?.addEventListener('click', async () => {
      await auth.clearSession();
      state.session = null;
      location.hash = '/';
      await render();
    });
    $('#export-all')?.addEventListener('click', async () => {
      await excel.exportReports(state.reports);
      toast('Workbook downloaded');
    });
  }

  function readLines(kind) {
    return [...document.querySelectorAll(`.lines[data-kind="${kind}"] .line`)].map((el) => {
      const row = { id: el.dataset.id };
      el.querySelectorAll('[data-field]').forEach((input) => {
        row[input.dataset.field] = input.value;
      });
      return row;
    });
  }

  function formToReport() {
    const form = $('#report-form');
    const data = new FormData(form);
    const next = model.normalizeReport({
      ...state.report,
      jobName: data.get('jobName'),
      jobNumber: data.get('jobNumber'),
      reportDate: data.get('reportDate'),
      reportTime: data.get('reportTime'),
      weather: data.get('weather'),
      weatherNotes: data.get('weatherNotes'),
      locationText: data.get('locationText'),
      hoursStart: data.get('hoursStart'),
      hoursEnd: data.get('hoursEnd'),
      hoursTotal: data.get('hoursTotal'),
      hoursOvertime: data.get('hoursOvertime'),
      delays: data.get('delays'),
      safetyNotes: data.get('safetyNotes'),
      supervisor: data.get('supervisor'),
      signatureName: data.get('signatureName'),
      status: data.get('complete') ? 'complete' : 'draft',
      crew: readLines('crew'),
      materials: readLines('materials'),
      equipment: readLines('equipment'),
      updatedAt: new Date().toISOString()
    }, state.session.user.id);
    next.userId = state.session.user.id;
    if (next.signatureName && !next.signedAt) next.signedAt = new Date().toISOString();
    return next;
  }

  async function persistReport(report) {
    await db.put('reports', report);
    await sync.enqueue('upsert-report', model.reportToSummaryRow(report));
    state.report = report;
    toast(navigator.onLine ? 'Saved · queued for sync' : 'Saved offline');
  }

  function setupSignature() {
    const canvas = $('#sign-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#f4f1ea';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    let drawing = false;
    const pos = (event) => {
      const rect = canvas.getBoundingClientRect();
      const src = event.touches ? event.touches[0] : event;
      return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) };
    };
    const start = (event) => { drawing = true; const p = pos(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); event.preventDefault(); };
    const move = (event) => { if (!drawing) return; const p = pos(event); ctx.lineTo(p.x, p.y); ctx.stroke(); event.preventDefault(); };
    const end = () => { drawing = false; };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    $('#clear-sign')?.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
  }

  async function loadPhotoThumbs() {
    for (const img of document.querySelectorAll('img[data-src-id]')) {
      const row = await db.get('attachments', img.dataset.srcId);
      if (row?.blob) img.src = URL.createObjectURL(row.blob);
    }
  }

  function bindEdit() {
    bindChrome();
    setupSignature();
    loadPhotoThumbs();
    $('#report-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const report = formToReport();
      const canvas = $('#sign-pad');
      if (canvas) {
        const empty = !canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((ch) => ch !== 0);
        if (!empty) {
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
          const id = model.uid('sign');
          await db.put('attachments', { id, reportId: report.id, blob, name: 'signature.png', mime: 'image/png' });
          if (!report.photos.some((p) => p.name === 'signature.png')) {
            report.photos.push({ id, name: 'signature.png', mime: 'image/png', size: blob.size });
          }
        }
      }
      await persistReport(report);
      location.hash = `#/report/${report.id}`;
      await loadReports();
    });
    $('#use-location')?.addEventListener('click', () => {
      const status = $('#geo-status');
      if (!navigator.geolocation) {
        status.textContent = 'Geolocation is not available in this browser.';
        return;
      }
      status.textContent = 'Getting location…';
      navigator.geolocation.getCurrentPosition((pos) => {
        state.report.lat = pos.coords.latitude;
        state.report.lng = pos.coords.longitude;
        state.report.locationAccuracy = pos.coords.accuracy;
        if (!state.report.locationText) {
          state.report.locationText = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          const input = document.querySelector('[name="locationText"]');
          if (input) input.value = state.report.locationText;
        }
        status.textContent = `Pinned ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${Math.round(pos.coords.accuracy)}m)`;
      }, (err) => {
        status.textContent = err.message || 'Location permission denied';
      }, { enableHighAccuracy: true, timeout: 12000 });
    });
    document.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.add;
        const current = formToReport();
        current[kind] = readLines(kind).concat(model.emptyLine(kind));
        current._fresh = state.report._fresh;
        state.report = current;
        render();
      });
    });
    document.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.lines');
        const kind = wrap.dataset.kind;
        const current = formToReport();
        const rows = readLines(kind);
        rows.splice(Number(btn.dataset.remove), 1);
        current[kind] = rows.length ? rows : [model.emptyLine(kind)];
        current._fresh = state.report._fresh;
        state.report = current;
        render();
      });
    });
    $('#photo-input')?.addEventListener('change', async (event) => {
      const files = [...event.target.files];
      for (const file of files) {
        const id = model.uid('att');
        await db.put('attachments', { id, reportId: state.report.id, blob: file, name: file.name, mime: file.type });
        state.report.photos.push({ id, name: file.name, mime: file.type, size: file.size });
      }
      await persistReport(state.report);
      await render();
    });
    document.querySelectorAll('[data-del-photo]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delPhoto;
        await db.del('attachments', id);
        state.report.photos = state.report.photos.filter((p) => p.id !== id);
        await persistReport(state.report);
        await render();
      });
    });
    $('#export-one')?.addEventListener('click', async () => {
      const report = formToReport();
      await excel.exportReports([report], `${report.jobNumber || 'report'}-${report.reportDate || 'day'}.xlsx`);
      toast('Report workbook downloaded');
    });
  }

  async function importFromFile(file) {
    const wb = await excel.readWorkbook(file);
    const incoming = excel.importWorkbook(wb);
    for (const report of incoming) {
      report.userId = report.userId || state.session.user.id;
      await db.put('reports', model.normalizeReport(report, report.userId));
      await sync.enqueue('upsert-report', model.reportToSummaryRow(report));
    }
    await excel.saveLinkedMeta({ name: file.name, importedAt: new Date().toISOString() });
    toast(`Imported ${incoming.length} report(s)`);
    await loadReports();
    await render();
  }

  function bindSettings() {
    bindChrome();
    $('#xlsx-file')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (file) await importFromFile(file);
    });
    $('#import-xlsx')?.addEventListener('click', () => $('#xlsx-file').click());
    $('#pick-workbook')?.addEventListener('click', async () => {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
        });
        await excel.saveLinkedMeta({ name: handle.name, handle, linkedAt: new Date().toISOString() });
        state.linked = await excel.linkedMeta();
        toast(`Linked ${handle.name}`);
        await render();
        return;
      }
      $('#xlsx-file').click();
    });
    $('#save-linked')?.addEventListener('click', async () => {
      const linked = await excel.linkedMeta();
      if (!linked?.handle) return;
      const wb = excel.workbookFromReports(state.reports);
      await excel.writeToHandle(linked.handle, wb, linked.name);
      toast('Wrote reports into linked workbook');
    });
    $('#pick-folder')?.addEventListener('click', async () => {
      if (!window.showDirectoryPicker) {
        toast('Folder access needs a Chromium browser');
        return;
      }
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await excel.saveFolderHandle(handle);
      state.folderName = handle.name;
      toast(`Folder granted: ${handle.name}`);
      await render();
    });
    $('#list-folder')?.addEventListener('click', async () => {
      const handle = await excel.folderHandle();
      const list = $('#folder-list');
      if (!handle || !list) {
        toast('No folder granted yet');
        return;
      }
      const names = [];
      for await (const entry of handle.values()) {
        if (entry.name.toLowerCase().endsWith('.xlsx')) names.push(entry.name);
      }
      list.innerHTML = names.length
        ? names.map((name) => `<li><button type="button" class="btn wide" data-open-xlsx="${escapeHtml(name)}">${escapeHtml(name)}</button></li>`).join('')
        : '<li class="hint">No .xlsx files in this folder</li>';
      list.querySelectorAll('[data-open-xlsx]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const fileHandle = await handle.getFileHandle(btn.dataset.openXlsx);
          await importFromFile(await fileHandle.getFile());
        });
      });
    });
    $('#flush-outbox')?.addEventListener('click', async () => {
      await sync.flush();
      state.outbox = await sync.pending();
      toast('Outbox flushed to local mirror');
      await render();
    });
  }

  async function loadReports() {
    if (!state.session) {
      state.reports = [];
      return;
    }
    state.reports = await db.reportsForUser(state.session.user.id);
    state.linked = await excel.linkedMeta();
    state.folderName = (await db.getKv('folderName')) || state.linked?.name || '';
    state.outbox = await sync.pending();
  }

  async function render() {
    const root = appEl();
    const r = route();
    state.users = await auth.listUsers();
    if (r.name === 'auth') {
      root.innerHTML = authView();
      bindAuth();
      return;
    }
    if (r.name === 'list') {
      await loadReports();
      root.innerHTML = listView();
      bindChrome();
      return;
    }
    if (r.name === 'settings') {
      await loadReports();
      root.innerHTML = settingsView();
      bindSettings();
      return;
    }
    if (r.name === 'edit') {
      if (r.id === 'new') {
        if (!state.report || state.report._fresh !== true) {
          state.report = model.emptyReport(state.session.user.id);
          state.report._fresh = true;
        }
      } else if (!state.report || state.report.id !== r.id) {
        state.report = await db.get('reports', r.id);
        if (!state.report) {
          location.hash = '/';
          return render();
        }
      }
      root.innerHTML = editView();
      bindEdit();
    }
  }

  async function boot() {
    await db.openDb();
    state.session = await auth.getSession();
    state.users = await auth.listUsers();
    state.drive = excel.driveConfig();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW skip', err));
    }
    sync.watch(async (pending) => {
      state.outbox = pending;
      const line = document.querySelector('.status-line');
      if (line) {
        line.innerHTML = `${navigator.onLine ? 'Online' : 'Offline'} · ${pending.length} waiting to sync`;
      }
    });
    window.addEventListener('hashchange', () => {
      if (route().name !== 'edit') state.report = null;
      render();
    });
    await render();
  }

  return { boot };
})();

window.addEventListener('DOMContentLoaded', () => window.DailyReportApp.boot());
