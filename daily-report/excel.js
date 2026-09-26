window.DailyReportExcel = (function () {
  const model = window.DailyReportModel;
  const db = window.DailyReportDB;

  function xlsx() {
    if (!window.XLSX) throw new Error('SheetJS is not loaded');
    return window.XLSX;
  }

  function sheet(rows) {
    return xlsx().utils.json_to_sheet(rows);
  }

  function workbookFromSystem(reports, bids) {
    const XLSX = xlsx();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(model.billingRows(reports)), 'Billing');
    XLSX.utils.book_append_sheet(wb, sheet((bids || []).map(model.bidToSheetRow)), 'Bids');
    XLSX.utils.book_append_sheet(wb, sheet(reports.map(model.reportToSummaryRow)), 'Reports');
    XLSX.utils.book_append_sheet(wb, sheet(reports.flatMap(model.crewRows)), 'Crew');
    XLSX.utils.book_append_sheet(wb, sheet(reports.flatMap(model.materialRows)), 'Materials');
    XLSX.utils.book_append_sheet(wb, sheet(reports.flatMap(model.equipmentRows)), 'Equipment');
    return wb;
  }

  function workbookFromReports(reports, bids) {
    return workbookFromSystem(reports, bids);
  }

  function downloadWorkbook(wb, filename) {
    xlsx().writeFile(wb, filename);
  }

  async function exportReports(reports, filename, bids) {
    const wb = workbookFromSystem(reports, bids || []);
    downloadWorkbook(wb, filename || `daily-reports-${model.todayIso()}.xlsx`);
    return wb;
  }

  function readWorkbook(file) {
    return file.arrayBuffer().then((buf) => xlsx().read(buf, { type: 'array' }));
  }

  function sheetRows(wb, name) {
    const XLSX = xlsx();
    const sheetRef = wb.Sheets[name];
    if (!sheetRef) return [];
    return XLSX.utils.sheet_to_json(sheetRef, { defval: '' });
  }

  function importWorkbook(wb, userId) {
    const reports = model.reportsFromSheetRows(sheetRows(wb, 'Reports'));
    const withKids = model.attachChildRows(
      reports,
      sheetRows(wb, 'Crew'),
      sheetRows(wb, 'Materials'),
      sheetRows(wb, 'Equipment')
    );
    const bids = model.bidsFromSheetRows(sheetRows(wb, 'Bids'), userId);
    return { reports: withKids, bids };
  }

  async function saveLinkedMeta(meta) {
    const stored = { ...meta };
    await db.setKv('linkedWorkbook', stored);
  }

  async function linkedMeta() {
    return (await db.getKv('linkedWorkbook')) || null;
  }

  async function saveFolderHandle(handle) {
    await db.setKv('folderHandle', handle);
    if (handle) await db.setKv('folderName', handle.name || 'Selected folder');
  }

  async function folderHandle() {
    return (await db.getKv('folderHandle')) || null;
  }

  async function ensurePermission(handle, mode) {
    if (!handle || typeof handle.queryPermission !== 'function') return true;
    const opts = { mode: mode || 'readwrite' };
    const current = await handle.queryPermission(opts);
    if (current === 'granted') return true;
    if (typeof handle.requestPermission !== 'function') return false;
    return (await handle.requestPermission(opts)) === 'granted';
  }

  function workbookBytes(wb) {
    return xlsx().write(wb, { bookType: 'xlsx', type: 'array' });
  }

  async function writeToHandle(handle, wb, filename) {
    const data = workbookBytes(wb);
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return filename;
  }

  async function writeToFolder(dirHandle, wb, filename) {
    const ok = await ensurePermission(dirHandle, 'readwrite');
    if (!ok) throw new Error('Folder permission was not granted');
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    await writeToHandle(fileHandle, wb, filename);
    return filename;
  }

  async function listXlsx(dirHandle) {
    const ok = await ensurePermission(dirHandle, 'read');
    if (!ok) throw new Error('Folder permission was not granted');
    const names = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.xlsx')) names.push(entry.name);
    }
    return names.sort((a, b) => a.localeCompare(b));
  }

  const pickerTypes = [{
    description: 'Excel workbook',
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
  }];

  async function pickExistingWorkbook() {
    if (!window.showOpenFilePicker) return null;
    const [handle] = await window.showOpenFilePicker({ types: pickerTypes, multiple: false });
    return handle;
  }

  async function pickNewWorkbook(suggestedName) {
    if (!window.showSaveFilePicker) return null;
    return window.showSaveFilePicker({
      suggestedName: suggestedName || `daily-reports-${model.todayIso()}.xlsx`,
      types: pickerTypes
    });
  }

  async function pickFolder() {
    if (!window.showDirectoryPicker) return null;
    return window.showDirectoryPicker({ mode: 'readwrite' });
  }

  function supportsFolderAccess() {
    return Boolean(window.showDirectoryPicker);
  }

  function supportsFileAccess() {
    return Boolean(window.showOpenFilePicker);
  }

  function driveConfig() {
    const cfg = window.DAILY_REPORT_CONFIG || {};
    return {
      googleClientId: String(cfg.googleClientId || '').trim(),
      apiKey: String(cfg.googleApiKey || '').trim(),
      folderId: String(cfg.googleDriveFolderId || '').trim(),
      spreadsheetId: String(cfg.googleSheetsSpreadsheetId || '').trim()
    };
  }

  function remotePlan() {
    const cfg = window.DAILY_REPORT_CONFIG || {};
    return model.describeRemote(cfg);
  }

  return {
    workbookFromReports,
    workbookFromSystem,
    downloadWorkbook,
    exportReports,
    readWorkbook,
    importWorkbook,
    saveLinkedMeta,
    linkedMeta,
    saveFolderHandle,
    folderHandle,
    writeToHandle,
    writeToFolder,
    listXlsx,
    ensurePermission,
    pickExistingWorkbook,
    pickNewWorkbook,
    pickFolder,
    supportsFolderAccess,
    supportsFileAccess,
    driveConfig,
    remotePlan
  };
})();
