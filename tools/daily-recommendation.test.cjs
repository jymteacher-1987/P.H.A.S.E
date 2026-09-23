const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../assets/js/data.js'), 'utf8');
const site = vm.runInNewContext(source + '\nSITE;', {
  window: {}, console, setTimeout, clearTimeout,
});
const items = ['one', 'two', 'three'].map((id) => ({ id, path: `experiments/${id}.html`, listed: true }));

test('daily recommendation is stable until midnight in Korea and changes the next day', () => {
  const before = site.getDailyRecommendation(items, new Date('2026-09-23T14:59:59Z'));
  const stillToday = site.getDailyRecommendation([...items].reverse(), new Date('2026-09-23T14:30:00Z'));
  const tomorrow = site.getDailyRecommendation(items, new Date('2026-09-23T15:00:00Z'));
  assert.equal(before.dateLabel, '2026.09.23');
  assert.equal(tomorrow.dateLabel, '2026.09.24');
  assert.equal(before.item.id, stillToday.item.id);
  assert.notEqual(before.item.id, tomorrow.item.id);
});

test('recommendation uses only visible, playable experiments and includes new entries automatically', () => {
  const pool = [...items, { id: 'new', path: 'experiments/new.html', listed: true },
    { id: 'hidden', path: 'experiments/hidden.html', listed: false }, { id: 'missing-path' }];
  const picked = new Set();
  for (let day = 0; day < 4; day++) {
    picked.add(site.getDailyRecommendation(pool, new Date(Date.UTC(2026, 8, 23 + day))).item.id);
  }
  assert.deepEqual([...picked].sort(), ['new', 'one', 'three', 'two']);
  assert.equal(site.getDailyRecommendation([]), null);
});
