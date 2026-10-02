/**
 * Lightweight checks for welcome → tutorial routing (no router runtime).
 */
import assert from 'node:assert/strict';
import { AUTH_EMAIL_REDIRECT_PATH, APP_ROUTES } from '../config/appRoutes.ts';
import { TABS } from '../config/appConfig.ts';

assert.equal(APP_ROUTES.home, '/');
assert.equal(APP_ROUTES.profile, '/profile');
assert.equal(APP_ROUTES.admin, '/admin');
assert.equal(AUTH_EMAIL_REDIRECT_PATH, APP_ROUTES.home);

const profileTab = TABS.find((t) => t.name === 'profile');
assert.equal(profileTab, undefined);

const adminTab = TABS.find((t) => t.name === 'admin');
assert.ok(adminTab);
assert.equal(adminTab?.title, 'Admin');
assert.equal(adminTab?.adminOnly, true);

console.log('onboarding-routing-check: ok');
