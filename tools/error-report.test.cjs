const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const RECIPIENT = 'jymteacher@naver.com';

// Run the Apps Script web app with stand-ins for the Google services it uses.
function appsScript() {
  const sent = [], cache = new Map();
  const context = {
    MailApp: { sendEmail: (to, subject, body, options) => sent.push({ to, subject, body, options }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key) ?? null, put: (key, value) => cache.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: (date, zone, pattern) => pattern.replace('yyyy', '2026').replace('MM', '09').replace('dd', '24').replace('HH', '10').replace('mm', '00').replace('ss', '00') },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    Date, JSON, String, Number, Math
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'error-report/Code.gs'), 'utf8'), context);
  const post = data => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(data) } }).text);
  return { post, sent };
}

test('every report goes only to the fixed teacher address', () => {
  const { post, sent } = appsScript();
  const reply = post({ message: '광원을 옮기면 상이 사라져요', activityTitle: '볼록 렌즈', to: 'someone@example.com',
    recipient: 'x@example.com', contact: 'student@example.com' });
  assert.deepEqual(reply, { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, RECIPIENT);
  assert.equal(sent[0].options.replyTo, 'student@example.com');
  assert.match(sent[0].subject, /^\[P\.H\.A\.S\.E 오류 신고\] 볼록 렌즈$/);
  assert.match(sent[0].body, /광원을 옮기면 상이 사라져요/);
});

test('subject lines and reply addresses cannot carry extra mail headers', () => {
  const { post, sent } = appsScript();
  post({ message: '줄바꿈 시험입니다', activityTitle: '제목\r\nBcc: a@example.com', contact: 'a@example.com\nBcc: b@example.com' });
  assert.equal(sent.length, 1);
  assert.ok(!/[\r\n]/.test(sent[0].subject));
  assert.equal(sent[0].options.replyTo, undefined);
});

test('empty, automated and oversized reports send no mail', () => {
  const { post, sent } = appsScript();
  assert.deepEqual(post({ message: '짧음' }), { ok: false, error: 'EMPTY' });
  assert.deepEqual(post({ message: '로봇이 채운 신고입니다', website: 'http://spam.example' }), { ok: true });
  assert.deepEqual(post({ message: 'x'.repeat(30000) }), { ok: false, error: 'TOO_LARGE' });
  assert.equal(sent.length, 0);
});

test('an hourly limit stops a flood of reports', () => {
  const { post, sent } = appsScript();
  for (let i = 0; i < 20; i++) assert.deepEqual(post({ message: '반복 신고 ' + i }), { ok: true });
  assert.deepEqual(post({ message: '스물한 번째 신고' }), { ok: false, error: 'LIMIT' });
  assert.equal(sent.length, 20);
});

test('the page never sends a recipient and offers only the direct send', () => {
  const window = { EXPERIMENTS_DATA: { experiments: [{ id: 'convex-lens-focus', title: '볼록 렌즈 초점 거리 찾기' }], plays: [] } };
  const context = {
    window, navigator: { userAgent: 'Test' }, location: { href: 'https://example.test/view.html?id=convex-lens-focus', search: '' },
    screen: { width: 1, height: 1 }, innerWidth: 1, innerHeight: 1,
    document: { readyState: 'complete', querySelector: () => null, getElementById: () => null },
    URLSearchParams, encodeURIComponent, setTimeout, clearTimeout, Date
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/report.js'), 'utf8'), context);
  const report = window.PhaseReport;
  const field = value => ({ value });
  const payload = report.buildPayload({ activity: field('convex-lens-focus'), message: field('  상이 사라져요  '), contact: field(''), website: field('') });
  assert.equal(payload.activityTitle, '볼록 렌즈 초점 거리 찾기');
  assert.equal(payload.message, '상이 사라져요');
  for (const key of ['to', 'recipient', 'email']) assert.ok(!(key in payload), 'no recipient field: ' + key);
  assert.equal(report.RECIPIENT, RECIPIENT);
  assert.ok(!('mailtoHref' in report), 'no mail-app fallback');
  assert.ok(!/mailto:|report-mail/.test(fs.readFileSync(path.join(__dirname, '../assets/js/report.js'), 'utf8')));
});
