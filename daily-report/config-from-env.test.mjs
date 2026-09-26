import assert from 'node:assert';
import { dailyReportConfigFromEnv, dailyReportConfigHasEnv, dailyReportConfigScript } from './config-from-env.mjs';

const empty = dailyReportConfigFromEnv({});
assert.strictEqual(empty.googleClientId, '');
assert.strictEqual(dailyReportConfigHasEnv(empty), false);

const fromEnv = dailyReportConfigFromEnv({
  GOOGLE_CLIENT_ID: ' client.apps.googleusercontent.com ',
  GOOGLE_API_KEY: '',
  GOOGLE_DRIVE_FOLDER_ID: 'folder-1'
});
assert.strictEqual(fromEnv.googleClientId, 'client.apps.googleusercontent.com');
assert.strictEqual(fromEnv.googleDriveFolderId, 'folder-1');
assert.strictEqual(dailyReportConfigHasEnv(fromEnv), true);

const script = dailyReportConfigScript(fromEnv);
assert.ok(script.includes('window.DAILY_REPORT_CONFIG'));
assert.ok(script.includes('client.apps.googleusercontent.com'));
assert.ok(!script.includes('sk_live'));

console.log('daily-report config-from-env tests ok');
