const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/data.js'), 'utf8');
const copy = (value) => JSON.parse(JSON.stringify(value));
const base = {
  categories: [{ id: 'mechanics', name: '역학과 에너지' }],
  experiments: [{ id: 'pendulum', title: '진자', description: '원래 설명', category: 'mechanics', path: 'experiments/pendulum.html?v=123', tags: ['운동'], preview: 'pendulum.webp',
    lessonNote: { question: '어떤 움직임일까요?', focus: '주기를 살펴보세요.' } }],
  plays: [{ id: 'orbit-game', title: '궤도 놀이', description: '', path: 'plays/orbit.html', tags: [] }],
};
const metadata = (patch = {}) => ({ title: '새 제목', description: '새 설명', tags: ['물리'], listed: true, updatedAt: { seconds: 100 }, ...patch });
const note = (patch = {}) => ({ question: '어떻게 달라질까요?', focus: '변화를 비교해 보세요.', visible: true, updatedAt: { seconds: 100 }, ...patch });
const snapshot = (entries) => ({ docs: Object.entries(entries).map(([id, data]) => ({ id, data: () => data })) });
function harness({ experiments = {}, overrides = {}, notes = {}, reads, configured = true, timers } = {}) {
  const requests = [];
  const db = { collection(name) {
    const query = {
      orderBy() { return query; },
      get(options) {
        requests.push({ name, options });
        return reads ? reads(name) : Promise.resolve(snapshot(name === 'experiments' ? experiments : name === 'lessonNotes' ? notes : overrides));
      },
    };
    return query;
  } };
  const firebase = { apps: [], initializeApp(config, name) {
    const app = { name, firestore: () => db };
    firebase.apps.push(app);
    return app;
  } };
  const original = copy(base);
  const context = vm.createContext({
    window: { EXPERIMENTS_DATA: original, FIREBASE_CONFIG: configured ? { apiKey: 'configured' } : {} },
    firebase, console, setTimeout: timers?.setTimeout || setTimeout, clearTimeout: timers?.clearTimeout || clearTimeout,
  });
  const site = vm.runInContext(source + '\nSITE;', context);
  return { site, requests, original };
}

test('metadata changes experiments and plays while preserving paths, categories, source, and static defaults', async () => {
  const { site, original } = harness({
    experiments: { uploaded: { title: '업로드', category: 'thermal', fileUrl: 'https://example.com/exp.html', tags: [] } },
    overrides: { pendulum: metadata(), 'orbit-game': metadata({ title: '새 놀이' }), uploaded: metadata({ title: '수정 업로드' }), unknown: metadata() },
  });
  const data = await site.getAllData();
  assert.equal(data.experiments.length, 2);
  const exp = data.experiments.find((item) => item.id === 'pendulum');
  assert.equal(exp.title, '새 제목');
  assert.equal(exp.path, base.experiments[0].path);
  assert.equal(exp.category, 'mechanics');
  assert.equal(exp.preview, 'pendulum.webp');
  assert.equal(exp.source, 'static');
  assert.equal(exp.lessonNote.question, '어떤 움직임일까요?');
  assert.equal(data.experiments[0].source, 'firebase');
  assert.equal(data.experiments[0].path, 'https://example.com/exp.html');
  assert.equal(data.plays[0].title, '새 놀이');
  assert.equal(data.plays[0].section, 'play');
  assert.deepEqual(original, base);
  assert.deepEqual(copy(data.categories), base.categories);
});

test('unlisted records are hidden from catalog and retained for explicit direct-link/admin reads', async () => {
  const { site } = harness({ overrides: { pendulum: metadata({ listed: false }), 'orbit-game': metadata({ listed: false }) } });
  const publicData = await site.getAllData();
  assert.equal(publicData.experiments.length, 0);
  assert.equal(publicData.plays.length, 0);
  const direct = await site.getAllData({ includeUnlisted: true });
  assert.equal(direct.experiments[0].listed, false);
  assert.equal(direct.plays[0].path, 'plays/orbit.html');
  const editor = await site.getCatalogEditorData();
  assert.equal(editor.experiments[0].title, '진자');
  assert.equal(editor.overrides.pendulum.title, '새 제목');
});

test('malformed and route-changing overrides are rejected as whole records', async () => {
  const invalid = [
    metadata({ title: '' }), metadata({ title: ' '.repeat(2) }), metadata({ title: 1 }),
    metadata({ title: 'x'.repeat(101) }), metadata({ description: null }), metadata({ description: 'x'.repeat(601) }),
    metadata({ tags: '태그' }), metadata({ tags: [1] }), metadata({ tags: [''] }),
    metadata({ tags: ['x'.repeat(25)] }), metadata({ tags: Array(9).fill('a') }),
    metadata({ listed: 'false' }), metadata({ path: 'javascript:alert(1)' }),
    metadata({ source: 'changed' }), metadata({ category: 'changed' }),
  ];
  for (const value of invalid) {
    const { site } = harness({ overrides: { pendulum: value } });
    const data = await site.getAllData();
    assert.equal(data.experiments[0].title, '진자');
    assert.equal(data.experiments[0].path, base.experiments[0].path);
    assert.equal((await site.getCatalogEditorData()).invalidOverrideCount, 1);
  }
});

test('validation accepts documented limits and normalizes whitespace and duplicate tags', () => {
  const { site } = harness();
  const valid = site.validateCatalogMetadata(metadata({ title: '  제목  ', description: ' 설명 ', tags: [' 물리 ', '물리'] }));
  assert.deepEqual(copy(valid.value), { title: '제목', description: '설명', tags: ['물리'], listed: true });
  assert.ok(site.validateCatalogMetadata(metadata({ title: '가'.repeat(100), description: '가'.repeat(600), tags: Array(8).fill('가'.repeat(24)) })).value);
});

test('missing Firebase configuration preserves a complete static catalog without requests', async () => {
  const { site, requests } = harness({ configured: false });
  const data = await site.getAllData();
  assert.equal(data.experiments[0].title, '진자');
  assert.equal(data.plays.length, 1);
  assert.equal(data.catalogStatus.overrides, 'unconfigured');
  assert.equal(requests.length, 0);
});

test('permission denial falls back safely, while independent successful override reads still apply', async () => {
  const { site, requests } = harness({ reads: (name) => name === 'experiments'
    ? Promise.reject(Object.assign(new Error('denied'), { code: 'permission-denied' }))
    : Promise.resolve(snapshot(name === 'catalogOverrides' ? { pendulum: metadata() } : {})) });
  const data = await site.getAllData();
  assert.equal(data.experiments[0].title, '새 제목');
  assert.equal(data.catalogStatus.experiments, 'unavailable');
  assert.equal(data.catalogStatus.overrides, 'ready');
  assert.deepEqual(copy(requests.map((request) => request.options)), [{ source: 'server' }, { source: 'server' }, { source: 'server' }]);
  const denied = harness({ reads: () => Promise.reject(new Error('denied')) });
  assert.equal((await denied.site.getAllData()).experiments[0].title, '진자');
});

test('offline reads are bounded at 2000ms and late failures cannot change the resolved static result', async () => {
  const timers = new Map();
  let nextId = 0;
  const rejections = [];
  const { site } = harness({
    reads: () => new Promise((resolve, reject) => rejections.push(reject)),
    timers: {
      setTimeout(callback, delay) { assert.equal(delay, 2000); const id = ++nextId; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
  });
  const pending = site.getAllData();
  await Promise.resolve();
  assert.equal(rejections.length, 3, 'all reads start without waiting for each other');
  for (const callback of [...timers.values()]) callback();
  const result = await pending;
  assert.equal(result.experiments[0].title, '진자');
  assert.equal(result.catalogStatus.experiments, 'timeout');
  assert.equal(result.catalogStatus.overrides, 'timeout');
  assert.equal(result.catalogStatus.lessonNotes, 'timeout');
  assert.equal(timers.size, 0);
  for (const reject of rejections) reject(new Error('late network failure'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(result.experiments[0].title, '진자');
});

test('subsequent reads observe restoration and do not retain stale hidden metadata', async () => {
  let remote = { pendulum: metadata({ listed: false }) };
  const { site } = harness({ reads: (name) => Promise.resolve(snapshot(name === 'catalogOverrides' ? remote : {})) });
  assert.equal((await site.getAllData()).experiments.length, 0);
  remote = {};
  const restored = await site.getAllData();
  assert.equal(restored.experiments[0].title, '진자');
  assert.equal(restored.experiments[0].listed, true);
});

test('curated guidance survives offline reads, while valid Firebase text can replace or hide it', async () => {
  const { site } = harness({ notes: { pendulum: note() } });
  const replaced = await site.getAllData();
  assert.deepEqual(copy(replaced.experiments[0].lessonNote), {
    question: '어떻게 달라질까요?', focus: '변화를 비교해 보세요.',
  });
  const hidden = harness({ notes: { pendulum: note({ question: '', focus: '', visible: false }) } });
  assert.equal((await hidden.site.getAllData()).experiments[0].lessonNote, null);
  const offline = harness({ reads: () => Promise.reject(new Error('offline')) });
  assert.equal((await offline.site.getAllData()).experiments[0].lessonNote.question, '어떤 움직임일까요?');
});

test('invalid guidance is rejected without replacing the curated text', async () => {
  for (const value of [
    note({ question: '' }), note({ focus: 'x'.repeat(181) }),
    note({ visible: 'true' }), note({ path: 'changed' }),
  ]) {
    const { site } = harness({ notes: { pendulum: value } });
    const data = await site.getAllData();
    assert.equal(data.experiments[0].lessonNote.question, '어떤 움직임일까요?');
    assert.equal((await site.getCatalogEditorData()).invalidLessonNoteCount, 1);
  }
});

test('admin metadata editor initializes without the optional Storage SDK', () => {
  const nodes = new Map();
  const document = { getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { style: {}, listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; } });
    return nodes.get(id);
  } };
  let authListener;
  const app = { name: '[DEFAULT]', firestore: () => ({}), auth: () => ({ onAuthStateChanged(listener) { authListener = listener; } }) };
  const context = vm.createContext({
    window: { ADMIN_EMAIL: 'phase@phase.com', addEventListener() {} }, document,
    SITE: { isFirebaseConfigured: () => true }, firebase: { apps: [app] },
  });
  const admin = fs.readFileSync(path.join(__dirname, '../assets/js/admin.js'), 'utf8');
  assert.doesNotThrow(() => vm.runInContext(admin, context));
  assert.equal(typeof authListener, 'function');
  assert.equal(typeof nodes.get('catalogForm').listeners.submit, 'function');
});
