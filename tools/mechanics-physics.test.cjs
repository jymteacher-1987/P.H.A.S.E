const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'experiments', name + '.html'), 'utf8');
const motion = read('motion-analysis');
const between = (text, first, last) => text.slice(text.indexOf(first), text.indexOf(last));
const modelCode = between(motion, 'const MODELS={', 'let mode=');
const models = new Function('G', 'HOLD_TIME', modelCode + ';return MODELS;')(9.8, 0.5);
const derivativeCode = between(motion, 'function sampleDerivative(', '/* ── 추세선');
const derive = points => new Function('sortedTracked', derivativeCode + ';return computeKinematicsFull();')(() => points);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const samples = (times, position) => times.map((t, frame) => ({frame, t, ...position(t)}));

test('skipping a recorded frame keeps the actual 1.76 m/s motion speed', () => {
  const points = [10, 12].map(frame => ({frame, t: frame / 10, ...models.constant.truePos(frame / 10)}));
  for (const row of derive(points)) {
    close(row.vx, 1.76);
    close(row.vy, 0);
    assert.equal(row.ax, null);
  }
});

test('uneven sample intervals recover uniformly accelerated motion in both components', () => {
  const rows = derive(samples([0, 0.1, 0.4, 0.9, 1.2], t => ({x: 1 + 2*t + 3*t*t, y: 4 - t - 2*t*t})));
  for (const row of rows) {
    close(row.vx, 2 + 6*row.t);
    close(row.ax, 6);
    close(row.vy, -1 - 4*row.t);
    close(row.ay, -4);
  }
});

test('four-point endpoint acceleration preserves the derivative of cubic motion', () => {
  const rows = derive(samples([0, 0.1, 0.4, 0.9], t => ({x: t*t*t, y: 0})));
  close(rows[0].ax, 0);
  close(rows.at(-1).ax, 6*0.9);
});

test('free-fall values remain correct with missing frames before first contact', () => {
  for (const row of derive(samples([0.6, 0.7, 0.9, 1.2, 1.4], t => models.freefall.truePos(t)))) {
    close(row.vy, 9.8 * (row.t - 0.5));
    close(row.ay, 9.8);
  }
});

// Preserve the author's deliberate alignment of impacts with the 0.1 s frames.
// It keeps samples immediately before/after contact within one ballistic arc.
test('free-fall contacts stay aligned with the intended recorded frames', () => {
  const model = models.freefall;
  const dt = Number(motion.match(/const DT=([\d.]+)/)[1]);
  const arcs = model._build();
  assert.equal(dt, 0.1);
  assert.equal(model.H0, 4.9);
  assert.equal(model.e, 0.5);
  assert.equal(model.holdTime, 0.5);
  assert.deepEqual(arcs.map(arc => arc.t1), [1.5, 2.5, 3]);
  for (const arc of arcs) {
    close(arc.t0 / dt, Math.round(arc.t0 / dt));
    close(arc.t1 / dt, Math.round(arc.t1 / dt));
    close(model.truePos(arc.t1).y, model.H0);
  }
});

test('continuous tracking preserves g just before and after each bounce', () => {
  const model = models.freefall;
  const rows = derive(samples(Array.from({length: 31}, (_, frame) => frame / 10), t => model.truePos(t)));
  for (const frame of [14, 16, 24, 26, 29, 30]) {
    close(rows[frame].ay, 9.8);
    close(rows[frame].vy, model.trueVel(rows[frame].t).y);
    close(rows[frame].ax, 0);
  }
  // Contact-spanning differences include the velocity jump; do not replace them with g.
  close(rows[15].ay, 9.8 - (1 + model.e) * 9.8 / 0.1);
  close(rows[25].ay, 9.8 - (1 + model.e) * 4.9 / 0.1);
});

test('missing frames within either rebound still reproduce its theoretical acceleration', () => {
  const model = models.freefall;
  for (const times of [[1.6, 1.8, 2.1, 2.4], [2.6, 2.8, 2.9, 3]]) {
    for (const row of derive(samples(times, t => model.truePos(t)))) {
      close(row.vy, model.trueVel(row.t).y);
      close(row.ay, 9.8);
    }
  }
});

test('one position sample cannot supply a speed or acceleration', () => {
  const [row] = derive([{frame: 5, t: 0.5, x: 1, y: 2}]);
  for (const key of ['vx', 'vy', 'ax', 'ay']) assert.equal(row[key], null);
});

test('average values mean displacement/time and velocity change/time', () => {
  const rows = derive(samples([0, 0.1, 0.4, 0.9], t => ({x: t*t, y: 0})));
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {classList: {toggle() {}}});
    return elements.get(id);
  };
  const code = between(motion, 'function updateAnalysis(rows)', 'function updateHud()');
  new Function('$', 'mode', 'G', 'rows', code + ';updateAnalysis(rows);')($, 'constant', 9.8, rows);
  assert.match($('an-v').innerHTML, /0\.90/);
  assert.match($('an-a').innerHTML, /2\.00/);
});

test('local chart distribution is the pinned version and includes its license', () => {
  const Chart = require('../assets/vendor/chartjs-4.4.1/chart.umd.min.js');
  assert.equal(Chart.version, '4.4.1');
  assert.match(fs.readFileSync(path.join(root, 'assets/vendor/chartjs-4.4.1/LICENSE.md'), 'utf8'), /MIT License/);
});

test('edited experiment scripts remain syntactically valid', () => {
  for (const name of ['motion-analysis', 'newton-laws', 'bernoulli-principle', 'rocket-motion', 'si-prefixes']) {
    for (const match of read(name).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc=/.test(match[1])) new vm.Script(match[2], {filename: name + '.html'});
    }
  }
});
