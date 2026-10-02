/**
 * Auth UI config: magic-link sign-in is gated off by default.
 */
import assert from 'node:assert/strict';
import {
  AUTH_CONFIG,
  AUTH_MAGIC_LINK_COPY,
  getAuthCardBlurb,
  isMagicLinkSignInEnabled,
} from '../config/authConfig.ts';

assert.equal(AUTH_CONFIG.magicLinkEnabled, false);
assert.equal(isMagicLinkSignInEnabled(), false);
assert.ok(!getAuthCardBlurb().toLowerCase().includes('magic'));
assert.ok(!getAuthCardBlurb().toLowerCase().includes('one-tap'));
assert.equal(AUTH_MAGIC_LINK_COPY.buttonLabel, 'Email magic link');

console.log('auth-config-check: ok');
