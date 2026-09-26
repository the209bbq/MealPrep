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

  function workbookFromReports(reports) {
    const XLSX = xlsx();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet(reports.map(model.reportToSummaryRow)), 'Reports');
    XLSX.utils.book_append_sheet(wb, sheet(reports.flatMap(model.crewRows)), 'Crew');
    XLSX.utils.book_append_sheet(wb, sheet(reports.flatMap(model.materialRows)), 'Materials');
    XLSX.utils.book_append_sheet(wb, sheet(reports.flatMap(model.equipmentRows)), 'Equipment');
    return wb;
  }

  function downloadWorkbook(wb, filename) {
    xlsx().writeFile(wb, filename);
  }

  async function exportReports(reports, filename) {
    const wb = workbookFromReports(reports);
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

  function importWorkbook(wb) {
    const reports = model.reportsFromSheetRows(sheetRows(wb, 'Reports'));
    return model.attachChildRows(
      reports,
      sheetRows(wb, 'Crew'),
      sheetRows(wb, 'Materials'),
      sheetRows(wb, 'Equipment')
    );
  }

  async function saveLinkedMeta(meta) {
    await db.setKv('linkedWorkbook', meta);
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

  async function writeToHandle(handle, wb, filename) {
    const XLSX = xlsx();
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return filename;
  }

  function driveConfig() {
    const cfg = window.DAILY_REPORT_CONFIG || {};
    return {
      apiKey: String(cfg.googleApiKey || '').trim(),
      folderId: String(cfg.googleDriveFolderId || '').trim(),
      spreadsheetId: String(cfg.googleSheetsSpreadsheetId || '').trim()
    };
  }

  return {
    workbookFromReports,
    downloadWorkbook,
    exportReports,
    readWorkbook,
    importWorkbook,
    saveLinkedMeta,
    linkedMeta,
    saveFolderHandle,
    folderHandle,
    writeToHandle,
    driveConfig
  };
})();
