const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../assets/js/device.js'), 'utf8');
for (const [name, navigator, expected] of [
  ['iPhone SE', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5 }, true],
  ['iPad desktop browsing mode', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }, true],
  ['Android tablet without Mobile UA token', { userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-X800)', platform: 'Linux armv8l', maxTouchPoints: 5 }, true],
  ['Android phone client hints', { userAgent: '', userAgentData: { mobile: true } }, true],
  ['Windows touch laptop', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 10 }, false],
  ['Mac desktop', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 0 }, false],
  ['Linux desktop', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64' }, false]
]) test(name + ' fullscreen classification', () => {
  let applied;
  const window = {};
  vm.runInNewContext(script, { navigator, window, document: { documentElement: { classList: { toggle: (name, on) => { applied = [name, on]; } } } } });
  assert.equal(window.PHASE_DEVICE.isPhoneOrTablet, expected);
  assert.deepEqual(applied, ['phone-tablet', expected]);
});
