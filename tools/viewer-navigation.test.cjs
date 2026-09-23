const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '../assets/js/view.js'), 'utf8');

async function openViewer({ search = '', nested = false, data, failure } = {}) {
  const node = () => ({
    hidden: false, textContent: '', dataset: {}, handlers: {},
    addEventListener(type, handler) { this.handlers[type] = handler; },
    focus() { this.focused = true; }
  });
  const ids = Object.fromEntries(['expFrame', 'expCat', 'viewerFeedback', 'viewerFeedbackTitle', 'viewerFeedbackText'].map(id => [id, node()]));
  ids.viewerFeedback.hidden = true;
  const links = [node(), node(), node()];
  const messages = [];
  let dataOptions;
  const document = {
    documentElement: { classList: { toggle() {} }, style: { setProperty() {} } },
    getElementById(id) { return ids[id]; },
    querySelectorAll() { return links; }
  };
  const window = { navigator: {}, matchMedia: () => ({ matches: false }), innerHeight: 700, addEventListener() {} };
  const parent = nested ? { postMessage(message, origin) { messages.push({ message, origin }); } } : window;
  const location = { search, origin: 'https://jymteacher-1987.github.io' };
  await vm.runInNewContext(script, {
    URLSearchParams, document, window, parent, location,
    SITE: { async getAllData(options) {
      dataOptions = options;
      if (failure) throw new Error('unavailable');
      return data || { categories: [], experiments: [], plays: [] };
    } }
  });
  return { ids, links, messages, document, dataOptions };
}

test('return links preserve only supported catalog filters and encode their values', async () => {
  const filters = new URLSearchParams({ q: '빛 & 색', cat: 'waves-optics', play: 'all', scope: 'all', next: 'https://example.com' });
  const viewer = await openViewer({ search: '?' + new URLSearchParams({ id: 'missing', from: filters.toString() }) });
  for (const link of viewer.links) {
    const url = new URL(link.href, 'https://jymteacher-1987.github.io/P.H.A.S.E/');
    assert.equal(url.pathname, '/P.H.A.S.E/lab.html');
    assert.equal(url.searchParams.get('q'), '빛 & 색');
    assert.equal(url.searchParams.get('cat'), 'waves-optics');
    assert.equal(url.searchParams.get('play'), 'all');
    assert.equal(url.searchParams.get('scope'), 'all');
    assert.equal(url.searchParams.has('next'), false);
  }
});

test('an external URL in from cannot redirect the return links', async () => {
  const viewer = await openViewer({ search: '?' + new URLSearchParams({ from: 'https://example.com/?next=elsewhere' }) });
  assert.ok(viewer.links.every(link => link.href === 'lab.html'));
});

test('missing and unknown IDs show a focused explanation instead of a blank frame', async () => {
  for (const search of ['', '?id=unknown']) {
    const { ids } = await openViewer({ search });
    assert.equal(ids.expFrame.hidden, true);
    assert.equal(ids.viewerFeedback.hidden, false);
    assert.equal(ids.viewerFeedbackTitle.textContent, '실험을 찾을 수 없어요');
    assert.equal(ids.viewerFeedbackTitle.focused, true);
    assert.ok(ids.viewerFeedbackText.textContent.includes('실험실'));
  }
});

test('every embedded return control closes the parent activity instead of nesting the catalog', async () => {
  const { links, messages } = await openViewer({ search: '?id=unknown', nested: true });
  for (const link of links) {
    let prevented = false;
    link.handlers.click({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
  }
  assert.equal(messages.length, 3);
  assert.ok(messages.every(({ message, origin }) => message.type === 'phase-exit-activity' && origin === 'https://jymteacher-1987.github.io'));
});

test('registered activities load normally and name their iframe', async () => {
  const { ids, document, dataOptions } = await openViewer({
    search: '?id=lens',
    data: { categories: [{ id: 'optics', icon: '🌈', name: '광학' }], experiments: [{ id: 'lens', title: '볼록 렌즈', category: 'optics', path: 'experiments/lens.html' }], plays: [] }
  });
  assert.equal(ids.expFrame.src, 'experiments/lens.html');
  assert.equal(dataOptions.includeUnlisted, true);
  assert.equal(ids.expFrame.title, '볼록 렌즈');
  assert.equal(ids.expFrame.hidden, false);
  assert.equal(ids.viewerFeedback.hidden, true);
  assert.equal(ids.expCat.textContent, '🌈 광학');
  assert.ok(document.title.includes('볼록 렌즈'));
});

test('catalog loading failure offers the same recovery path', async () => {
  const { ids, links } = await openViewer({ failure: true });
  assert.equal(ids.viewerFeedback.hidden, false);
  assert.equal(ids.expFrame.hidden, true);
  assert.equal(ids.viewerFeedbackTitle.textContent, '실험 목록을 불러오지 못했어요');
  assert.ok(links.every(link => link.href === 'lab.html'));
});
