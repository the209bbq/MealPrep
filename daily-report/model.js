(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DailyReportModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function uid(prefix) {
    const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return prefix ? `${prefix}-${rand}` : rand;
  }

  function todayIso(date) {
    const d = date ? new Date(date) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function nowTime(date) {
    const d = date ? new Date(date) : new Date();
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function emptyLine(kind) {
    if (kind === 'crew') return { id: uid('crew'), name: '', role: '', hours: '' };
    if (kind === 'materials') return { id: uid('mat'), name: '', qty: '', unit: '', notes: '' };
    if (kind === 'equipment') return { id: uid('eq'), name: '', hours: '', notes: '' };
    return { id: uid('row') };
  }

  function emptyReport(userId) {
    const now = new Date();
    return {
      id: uid('rpt'),
      userId: userId || '',
      status: 'draft',
      weather: '',
      weatherNotes: '',
      locationText: '',
      lat: null,
      lng: null,
      locationAccuracy: null,
      reportDate: todayIso(now),
      reportTime: nowTime(now),
      jobName: '',
      jobNumber: '',
      crew: [emptyLine('crew')],
      hoursStart: '',
      hoursEnd: '',
      hoursTotal: '',
      hoursOvertime: '',
      materials: [emptyLine('materials')],
      equipment: [emptyLine('equipment')],
      delays: '',
      safetyNotes: '',
      photos: [],
      supervisor: '',
      signatureName: '',
      signedAt: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      syncedAt: null
    };
  }

  function normalizeLineItems(list, kind) {
    const items = Array.isArray(list) ? list : [];
    const cleaned = items
      .map((row) => {
        if (kind === 'crew') {
          return {
            id: row.id || uid('crew'),
            name: String(row.name || '').trim(),
            role: String(row.role || '').trim(),
            hours: String(row.hours ?? '').trim()
          };
        }
        if (kind === 'materials') {
          return {
            id: row.id || uid('mat'),
            name: String(row.name || '').trim(),
            qty: String(row.qty ?? '').trim(),
            unit: String(row.unit || '').trim(),
            notes: String(row.notes || '').trim()
          };
        }
        return {
          id: row.id || uid('eq'),
          name: String(row.name || '').trim(),
          hours: String(row.hours ?? '').trim(),
          notes: String(row.notes || '').trim()
        };
      })
      .filter((row) => Object.keys(row).some((key) => key !== 'id' && String(row[key] || '').trim()));
    return cleaned.length ? cleaned : [emptyLine(kind)];
  }

  function normalizeReport(input, userId) {
    const base = emptyReport(userId);
    const src = input && typeof input === 'object' ? input : {};
    return {
      ...base,
      ...src,
      id: src.id || base.id,
      userId: src.userId || userId || base.userId,
      status: src.status === 'complete' ? 'complete' : 'draft',
      crew: normalizeLineItems(src.crew, 'crew'),
      materials: normalizeLineItems(src.materials, 'materials'),
      equipment: normalizeLineItems(src.equipment, 'equipment'),
      photos: Array.isArray(src.photos) ? src.photos : [],
      lat: src.lat === '' || src.lat == null ? null : Number(src.lat),
      lng: src.lng === '' || src.lng == null ? null : Number(src.lng),
      locationAccuracy: src.locationAccuracy == null || src.locationAccuracy === ''
        ? null
        : Number(src.locationAccuracy)
    };
  }

  function reportTitle(report) {
    const job = report.jobName || 'Untitled job';
    const num = report.jobNumber ? ` #${report.jobNumber}` : '';
    return `${job}${num}`;
  }

  function reportToSummaryRow(report) {
    return {
      id: report.id,
      userId: report.userId || '',
      status: report.status || 'draft',
      reportDate: report.reportDate || '',
      reportTime: report.reportTime || '',
      jobName: report.jobName || '',
      jobNumber: report.jobNumber || '',
      weather: report.weather || '',
      weatherNotes: report.weatherNotes || '',
      locationText: report.locationText || '',
      lat: report.lat == null ? '' : report.lat,
      lng: report.lng == null ? '' : report.lng,
      hoursStart: report.hoursStart || '',
      hoursEnd: report.hoursEnd || '',
      hoursTotal: report.hoursTotal || '',
      hoursOvertime: report.hoursOvertime || '',
      delays: report.delays || '',
      safetyNotes: report.safetyNotes || '',
      supervisor: report.supervisor || '',
      signatureName: report.signatureName || '',
      signedAt: report.signedAt || '',
      updatedAt: report.updatedAt || ''
    };
  }

  function crewRows(report) {
    return (report.crew || []).map((row) => ({
      reportId: report.id,
      jobNumber: report.jobNumber || '',
      name: row.name || '',
      role: row.role || '',
      hours: row.hours || ''
    }));
  }

  function materialRows(report) {
    return (report.materials || []).map((row) => ({
      reportId: report.id,
      jobNumber: report.jobNumber || '',
      name: row.name || '',
      qty: row.qty || '',
      unit: row.unit || '',
      notes: row.notes || ''
    }));
  }

  function equipmentRows(report) {
    return (report.equipment || []).map((row) => ({
      reportId: report.id,
      jobNumber: report.jobNumber || '',
      name: row.name || '',
      hours: row.hours || '',
      notes: row.notes || ''
    }));
  }

  function sumHours(rows) {
    return (rows || []).reduce((total, row) => total + (Number(row.hours) || 0), 0);
  }

  function billingRow(report) {
    const materials = (report.materials || []).filter((row) => row.name);
    return {
      reportId: report.id,
      userId: report.userId || '',
      jobNumber: report.jobNumber || '',
      jobName: report.jobName || '',
      reportDate: report.reportDate || '',
      status: report.status || 'draft',
      hoursTotal: report.hoursTotal || '',
      hoursOvertime: report.hoursOvertime || '',
      crewHours: sumHours(report.crew),
      equipmentHours: sumHours(report.equipment),
      materialLines: materials.length,
      materialSummary: materials.map((row) => `${row.qty || ''} ${row.unit || ''} ${row.name}`.trim()).join('; '),
      supervisor: report.supervisor || '',
      signatureName: report.signatureName || '',
      updatedAt: report.updatedAt || ''
    };
  }

  function billingRows(reports) {
    return (reports || []).map(billingRow);
  }

  function emptyBid(userId) {
    return {
      id: uid('bid'),
      userId: userId || '',
      jobName: '',
      jobNumber: '',
      customer: '',
      amount: '',
      status: 'draft',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeBid(input, userId) {
    const src = input && typeof input === 'object' ? input : {};
    const status = ['draft', 'submitted', 'won', 'lost'].includes(src.status) ? src.status : 'draft';
    return {
      id: src.id || uid('bid'),
      userId: src.userId || userId || '',
      jobName: String(src.jobName || src.job || '').trim(),
      jobNumber: String(src.jobNumber || src.number || '').trim(),
      customer: String(src.customer || '').trim(),
      amount: String(src.amount ?? '').trim(),
      status,
      notes: String(src.notes || '').trim(),
      createdAt: src.createdAt || new Date().toISOString(),
      updatedAt: src.updatedAt || new Date().toISOString()
    };
  }

  function bidsFromSheetRows(rows, userId) {
    return (rows || []).map((row) => normalizeBid(row, row.userId || userId));
  }

  function bidToSheetRow(bid) {
    return {
      id: bid.id,
      userId: bid.userId || '',
      jobName: bid.jobName || '',
      jobNumber: bid.jobNumber || '',
      customer: bid.customer || '',
      amount: bid.amount || '',
      status: bid.status || 'draft',
      notes: bid.notes || '',
      updatedAt: bid.updatedAt || ''
    };
  }

  function describeRemote(cfg) {
    const config = cfg && typeof cfg === 'object' ? cfg : {};
    const clientId = String(config.googleClientId || '').trim();
    const apiKey = String(config.googleApiKey || '').trim();
    const folderId = String(config.googleDriveFolderId || '').trim();
    const spreadsheetId = String(config.googleSheetsSpreadsheetId || '').trim();
    const hasAuth = Boolean(clientId || apiKey);
    if (spreadsheetId && hasAuth) {
      return {
        transport: 'sheets-placeholder',
        ready: false,
        reason: 'Spreadsheet id is set; Sheets upload waits on OAuth token (not wired).'
      };
    }
    if (folderId && hasAuth) {
      return {
        transport: 'drive-placeholder',
        ready: false,
        reason: 'Drive folder id is set; Drive upload waits on OAuth token (not wired).'
      };
    }
    return {
      transport: 'stub',
      ready: true,
      reason: 'No Google keys; outbox flushes to the local IndexedDB mirror.'
    };
  }

  function reportsFromSheetRows(rows) {
    return (rows || []).map((row) => normalizeReport({
      id: row.id || uid('rpt'),
      userId: row.userId || '',
      status: row.status,
      reportDate: row.reportDate || row.date || '',
      reportTime: row.reportTime || row.time || '',
      jobName: row.jobName || row.job || '',
      jobNumber: row.jobNumber || row.number || '',
      weather: row.weather || '',
      weatherNotes: row.weatherNotes || '',
      locationText: row.locationText || row.location || '',
      lat: row.lat,
      lng: row.lng,
      hoursStart: row.hoursStart || '',
      hoursEnd: row.hoursEnd || '',
      hoursTotal: row.hoursTotal || '',
      hoursOvertime: row.hoursOvertime || '',
      delays: row.delays || '',
      safetyNotes: row.safetyNotes || '',
      supervisor: row.supervisor || '',
      signatureName: row.signatureName || '',
      signedAt: row.signedAt || ''
    }));
  }

  function attachChildRows(reports, crew, materials, equipment) {
    const byId = new Map(reports.map((report) => [report.id, report]));
    (crew || []).forEach((row) => {
      const report = byId.get(row.reportId);
      if (!report) return;
      if (report.crew.length === 1 && !report.crew[0].name) report.crew = [];
      report.crew.push({
        id: uid('crew'),
        name: row.name || '',
        role: row.role || '',
        hours: row.hours || ''
      });
    });
    (materials || []).forEach((row) => {
      const report = byId.get(row.reportId);
      if (!report) return;
      if (report.materials.length === 1 && !report.materials[0].name) report.materials = [];
      report.materials.push({
        id: uid('mat'),
        name: row.name || '',
        qty: row.qty || '',
        unit: row.unit || '',
        notes: row.notes || ''
      });
    });
    (equipment || []).forEach((row) => {
      const report = byId.get(row.reportId);
      if (!report) return;
      if (report.equipment.length === 1 && !report.equipment[0].name) report.equipment = [];
      report.equipment.push({
        id: uid('eq'),
        name: row.name || '',
        hours: row.hours || '',
        notes: row.notes || ''
      });
    });
    return reports.map((report) => normalizeReport(report, report.userId));
  }

  return {
    uid,
    todayIso,
    nowTime,
    emptyLine,
    emptyReport,
    normalizeReport,
    reportTitle,
    reportToSummaryRow,
    crewRows,
    materialRows,
    equipmentRows,
    billingRow,
    billingRows,
    emptyBid,
    normalizeBid,
    bidsFromSheetRows,
    bidToSheetRow,
    describeRemote,
    reportsFromSheetRows,
    attachChildRows
  };
});
