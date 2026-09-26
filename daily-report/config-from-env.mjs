export function dailyReportConfigFromEnv(env = process.env) {
  return {
    googleClientId: String(env.GOOGLE_CLIENT_ID || '').trim(),
    googleApiKey: String(env.GOOGLE_API_KEY || '').trim(),
    googleDriveFolderId: String(env.GOOGLE_DRIVE_FOLDER_ID || '').trim(),
    googleSheetsSpreadsheetId: String(env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim()
  };
}

export function dailyReportConfigHasEnv(cfg) {
  return Object.values(cfg).some(Boolean);
}

export function dailyReportConfigScript(cfg) {
  return `window.DAILY_REPORT_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`;
}
