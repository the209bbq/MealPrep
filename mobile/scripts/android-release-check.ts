import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANDROID_APPLICATION_ID, ANDROID_VERSION_CODE } from '../config/androidRelease.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');

assert.equal(ANDROID_APPLICATION_ID, 'com.mealplanatic.app');
assert.equal(ANDROID_VERSION_CODE, 1);

const easPath = path.join(mobileRoot, 'eas.json');
assert.ok(fs.existsSync(easPath), 'missing eas.json');
const eas = JSON.parse(fs.readFileSync(easPath, 'utf8')) as {
  build?: { preview?: { android?: { buildType?: string } }; production?: { android?: { buildType?: string } } };
};
assert.equal(eas.build?.preview?.android?.buildType, 'apk');
assert.equal(eas.build?.production?.android?.buildType, 'app-bundle');

const appConfig = fs.readFileSync(path.join(mobileRoot, 'app.config.ts'), 'utf8');
assert.ok(appConfig.includes(ANDROID_APPLICATION_ID), 'app.config should set android package');

console.log('android-release-check: ok');
