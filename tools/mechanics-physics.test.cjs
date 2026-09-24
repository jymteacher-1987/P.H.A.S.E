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
  for (const name of ['motion-analysis', 'newton-laws', 'momentum-conservation', 'bernoulli-principle', 'rocket-motion', 'si-prefixes']) {
    for (const match of read(name).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc=/.test(match[1])) new vm.Script(match[2], {filename: name + '.html'});
    }
  }
});

function newtonSecondLaw(force, mass) {
  const source = read('newton-laws');
  const start = source.indexOf('  const Law2 = (function(){');
  const end = source.indexOf('  })();', start) + '  })();'.length;
  const code = source.slice(start, end).replace(
    'return {resize,reset,update,draw,bind};',
    'return {resize,reset,update,draw,bind,snapshot:()=>structuredClone(s)};');
  const elements = new Map();
  const document = {getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      style: {}, listeners: {},
      addEventListener(type, handler) { this.listeners[type] = handler; }
    });
    return elements.get(id);
  }};
  const law = new Function('document', code + ';return Law2;')(document);
  law.bind();
  for (const [id, value] of [['l2-F', force], ['l2-m', mass]]) {
    const input = document.getElementById(id);
    input.value = String(value); input.listeners.input();
  }
  document.getElementById('l2-go').listeners.click();
  return {law, document};
}

for (const {name, force, mass, frames, time} of [
  {name: 'speed boundary between frames', force: 7, mass: 1, frames: [1/60], time: 20/7},
  {name: 'time boundary between frames', force: 6, mass: 5, frames: [.017], time: 12},
  {name: 'irregular frames', force: 11, mass: 2, frames: [.013, .041, .009, .023], time: 40/11}
]) {
  test(`second-law ${name} ends on the same constant-acceleration trajectory`, () => {
    const {law, document} = newtonSecondLaw(force, mass);
    let updates = 0;
    while (law.snapshot().running && updates < 2000) law.update(frames[updates++ % frames.length]);
    const final = law.snapshot(), acceleration = force/mass;
    assert.equal(final.running, false);
    close(final.t, time);
    close(final.v, acceleration*time);
    close(final.dist, 0.5*acceleration*time*time);
    const points = final.runs[0].pts;
    for (const point of points) {
      close(point.v, acceleration*point.t);
      assert.ok(point.t <= 12 && point.v <= 20 + 1e-10);
    }
    const [before, last] = points.slice(-2);
    close((last.v-before.v)/(last.t-before.t), acceleration);
    assert.equal(document.getElementById('l2-F').disabled, false);
    assert.equal(document.getElementById('l2-m').disabled, false);
    law.update(.1);
    assert.deepEqual(law.snapshot(), final, 'a finished observation must remain unchanged');
  });
}

test('second-law distance and velocity use the same elapsed interval before the endpoint', () => {
  const {law} = newtonSecondLaw(7, 1);
  law.update(.4);
  close(law.snapshot().v, 2.8);
  close(law.snapshot().dist, .56);
  law.update(.1);
  close(law.snapshot().v, 3.5);
  close(law.snapshot().dist, .875);
});

function newtonThirdLaw() {
  const source = read('newton-laws');
  const start = source.indexOf('  const Law3 = (function(){');
  const end = source.indexOf('  })();', start) + '  })();'.length;
  const code = source.slice(start, end).replace(
    'return {resize,reset,update,draw,bind};',
    'return {resize,reset,update,draw,bind,snapshot:()=>({...s})};');
  const elements = new Map();
  const document = {getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      value: id === 'l3-mA' ? '2' : id === 'l3-mB' ? '6' : '',
      _w: 1280, _h: 340,
      listeners: {}, classes: new Set(),
      addEventListener(type, handler) { this.listeners[type] = handler; },
      get classList() { return {add: key => this.classes.add(key), remove: key => this.classes.delete(key)}; }
    });
    return elements.get(id);
  }};
  const bindHold = (button, on, off) => { button.hold = on; button.release = off; };
  const law = new Function('document', 'bindHold', code + ';return Law3;')(document, bindHold);
  law.bind();
  const button = document.getElementById('l3-push');
  return {law, document, button, setMass(id, value) {
    const input = document.getElementById(id);
    input.value = String(value);
    input.listeners.input();
  }};
}

for (const phase of ['push', 'glide', 'paused glide']) {
  test(`changing a third-law mass during ${phase} starts a fresh experiment`, () => {
    const {law, document, button, setMass} = newtonThirdLaw();
    button.hold();
    law.update(0.4);
    if (phase !== 'push') button.release();
    if (phase === 'paused glide') document.getElementById('l3-pause').listeners.click();
    assert.notEqual(law.snapshot().vA, 0);
    setMass('l3-mA', 4);
    const reset = law.snapshot();
    assert.equal(reset.mA, 4);
    assert.equal(reset.mB, 6);
    assert.equal(reset.phase, 'idle', 'force arrows and old momentum result must disappear');
    assert.equal(reset.paused, false);
    for (const key of ['vA', 'vB', 'gA', 'gB', 'time']) close(reset[key], 0);
    assert.equal(button.classes.has('active'), false);
    button.release(); // A late release after changing the mass must not relaunch old motion.
    assert.equal(law.snapshot().phase, 'idle');
    setMass('l3-mB', 8);
    button.hold();
    law.update(0.4);
    button.release();
    const next = law.snapshot();
    assert.equal(next.mA, 4);
    assert.equal(next.mB, 8);
    assert.equal(next.phase, 'glide');
    close(next.mA * next.vA + next.mB * next.vB, 0);
    assert.ok(next.vA < 0 && next.vB > 0);
  });
}

test('third-law forces move both bodies while they are pushing', () => {
  for (let mA = 1; mA <= 8; mA++) for (let mB = 1; mB <= 8; mB++) {
    const {law, button, setMass} = newtonThirdLaw();
    setMass('l3-mA', mA); setMass('l3-mB', mB);
    button.hold(); law.update(0.4);
    const s = law.snapshot(), time = 0.4 * 0.16;
    assert.equal(s.phase, 'push');
    close(s.time, time);
    close(s.vA, -24 / mA * time); close(s.vB, 24 / mB * time);
    close(s.gA, -.5 * 24 / mA * time * time);
    close(s.gB, .5 * 24 / mB * time * time);
    close(mA * s.vA + mB * s.vB, 0);
    close(mA * s.gA + mB * s.gB, 0);
  }
});

test('releasing the third-law push keeps exact velocities and continues at constant speed', () => {
  const {law, button, setMass} = newtonThirdLaw();
  setMass('l3-mA', 3); setMass('l3-mB', 7);
  button.hold(); law.update(0.37);
  const before = law.snapshot();
  button.release();
  const released = law.snapshot();
  close(released.vA, before.vA); close(released.vB, before.vB);
  close(released.gA, before.gA); close(released.gB, before.gB);
  law.update(0.63);
  const next = law.snapshot();
  close(next.vA, before.vA); close(next.vB, before.vB);
  close(next.gA, before.gA + before.vA * 0.63 * 0.16);
  close(next.gB, before.gB + before.vB * 0.63 * 0.16);
  close(next.time, 0.16);
});

test('holding past hand separation ends both forces without capping velocity', () => {
  const {law, button, setMass} = newtonThirdLaw();
  setMass('l3-mA', 1); setMass('l3-mB', 8);
  button.hold(); law.update(5);
  const s = law.snapshot();
  const contactTime = Math.sqrt(2 * 0.36 / (24 / 1 + 24 / 8));
  assert.equal(s.phase, 'glide');
  assert.equal(button.classes.has('active'), false);
  close(s.vA, -24 * contactTime); close(s.vB, 3 * contactTime);
  assert.ok(Math.abs(s.vA) > 3, 'old arbitrary speed cap must not survive');
  close(s.gA, -.5 * 24 * contactTime ** 2 + s.vA * (0.8 - contactTime));
  close(s.gB, .5 * 3 * contactTime ** 2 + s.vB * (0.8 - contactTime));
  const wholeStep = law.snapshot();
  law.reset(); button.hold();
  for (let i = 0; i < 100; i++) law.update(0.05);
  const manySteps = law.snapshot();
  for (const key of ['vA', 'vB', 'gA', 'gB', 'time']) close(manySteps[key], wholeStep[key]);
});

test('viewport boundary ends both observations together without a fictitious collision', () => {
  const {law, document, button} = newtonThirdLaw();
  const canvas = document.getElementById('cv3'); canvas._w = 390;
  button.hold(); law.update(2); button.release();
  const before = law.snapshot();
  assert.equal(before.phase, 'glide');
  law.update(100);
  const ended = law.snapshot();
  assert.equal(ended.phase, 'complete');
  close(ended.vA, before.vA); close(ended.vB, before.vB);
  close(ended.mA * ended.vA + ended.mB * ended.vB, 0);
  close(ended.mA * ended.gA + ended.mB * ended.gB, 0);
  const box = Math.max(46, Math.min(74, canvas._h * .19));
  const limit = (canvas._w / 2 - box * .34 - (box * .34 + 72)) / 46;
  close(ended.gA, -limit);
  assert.ok(ended.gB < limit);
  law.update(100); button.hold();
  assert.deepEqual(law.snapshot(), ended, 'observation must stay finished until reset');
  assert.equal(button.classes.has('active'), false);
});

function momentumRecording(random = Math.random) {
  const source = read('momentum-conservation');
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, {querySelectorAll: () => []});
    return elements.get(id);
  };
  const code = between(source, 'const RAIL_L', 'const $  =') +
    between(source, 'const r3 =', 'function toast(') +
    between(source, 'function collide(', 'function makeSparks(') +
    between(source, "$('bumper').onclick=", 'function paintMode(') +
    between(source, 'function analyze(', 'function renderReadout(') +
    between(source, 'function writeConcl()', 'function drawChart()') +
    between(source, "$('btnRec').onclick=", "$('btnClear').onclick=");
  return new Function('$', 'Math', `
    function makeSparks() {} function renderReadout() {} function renderTable() {}
    function toast() {} function resetRun() {} function openModal() {}
    ${code}
    return {state:S, stepPhysics, sensor, collide, record:()=>$('btnRec').onclick(),
      conclusion:()=>{writeConcl();return $('conclText').innerHTML;},
      selectBumper: bumper => $('bumper').onclick({target:{closest:()=>({dataset:{b:bumper}})}}),
      approach:()=>{S.c1.x=.6;S.c2.x=.6+2*HW+.0001;S.c1.v=.4;S.c2.v=-.2;}};
  `)($, Object.assign(Object.create(Math), {random}));
}

test('real-mode sensor adds bounded noise and rounds rather than truncating velocity', () => {
  for (const [random, positive, negative] of [[0, .232, -.238], [.5, .235, -.235], [1, .238, -.232]]) {
    const sim = momentumRecording(() => random);
    sim.state.mode = 'real';
    close(sim.sensor(.2348), positive);
    close(sim.sensor(-.2348), negative);
    sim.state.mode = 'ideal';
    close(sim.sensor(.2348), .235);
    close(sim.sensor(-.2348), -.235);
  }
});

test('sensor noise affects measured momentum without changing the collision solution', () => {
  const sims = [[0, 0, .999, .999], [.999, .999, 0, 0]].map(values => {
    let i = 0;
    return momentumRecording(() => values[i++ % values.length]);
  });
  for (const sim of sims) {
    sim.state.mode = 'real';
    sim.selectBumper('velcro'); // Fixed restitution isolates sensor noise from spring variability.
    sim.state.m1 = .5; sim.state.m2 = .9;
    sim.approach(); sim.stepPhysics(.01);
    const {raw} = sim.state.reading;
    close(.5*raw.v1 + .9*raw.v2, .5*raw.v1p + .9*raw.v2p);
    sim.record();
    assert.ok(sim.state.rows[0].diff > 0);
    const explanation = sim.conclusion();
    assert.match(explanation, /측정 잡음/);
    assert.match(explanation, /소수 셋째 자리까지 반올림/);
    assert.doesNotMatch(explanation, /넷째 자리부터 버리|현실의 측정에서는 원래 이 정도/);
  }
  assert.deepEqual(sims[0].state.reading.raw, sims[1].state.reading.raw);
  assert.notEqual(sims[0].state.reading.v1, sims[1].state.reading.v1);
});

for (const [atCollision, afterCollision] of [['spring', 'velcro'], ['velcro', 'spring']]) {
  test(`recording a ${atCollision} collision retains its type after selecting ${afterCollision}`, () => {
    const sim = momentumRecording();
    sim.selectBumper(atCollision);
    sim.approach(); sim.stepPhysics(.01);
    assert.equal(sim.state.collided, true);
    const measured = structuredClone(sim.state.reading);
    if (atCollision === 'velcro') close(measured.raw.v1p, measured.raw.v2p);
    else assert.notEqual(measured.raw.v1p, measured.raw.v2p);
    sim.selectBumper(afterCollision);
    assert.equal(sim.state.bumper, afterCollision, 'the next selected condition may change');
    sim.record();
    const [row] = sim.state.rows;
    assert.equal(row.bumper, atCollision, 'the saved type must describe the measured collision');
    for (const key of ['v1', 'v2', 'v1p', 'v2p']) close(row[key], measured[key]);
    close(row.pre, row.post);
  });
}

function projectileInputs() {
  const source = read('free-fall-projectile');
  const elements = new Map();
  const document = {getElementById(id) {
    if (!elements.has(id)) elements.set(id, {value: id === 'v0' ? '6' : '.2'});
    return elements.get(id);
  }};
  const code = between(source, 'function ballData(', 'function drawBall(') +
    between(source, 'function loop(ts){', 'function setPlayBtn(') +
    between(source, 'function bind(id,key,fmt){', 'function hoverMove(e){');
  const sim = new Function('document', `
    const state={mode:'real',v0:6,h:40,g:9.8,dt:.2,t:1,playing:true,
      finished:false,lastFrame:1000,hoverT:.8};
    const fallT=()=>Math.sqrt(2*state.h/state.g);
    const posA=y=>[0,y],posB=(x,y)=>[x,y];
    const queued=[];let playButton=null;
    function render() {} function setPlayBtn(value){playButton=value;}
    function requestAnimationFrame(callback){queued.push(callback);}
    ${code}
    return {state,loop,ballData,button:()=>playButton};
  `)(document);
  return {...sim, input(id, value) {
    const element = document.getElementById(id);
    element.value = String(value); element.oninput();
  }};
}

test('changing initial horizontal speed stops the current fall and starts a fresh trajectory', () => {
  const sim = projectileInputs();
  close(sim.ballData(sim.state.t).xB, 6);
  sim.input('v0', 14);
  assert.equal(sim.state.v0, 14);
  assert.equal(sim.state.playing, false);
  assert.equal(sim.state.finished, false);
  assert.equal(sim.state.lastFrame, null);
  assert.equal(sim.state.hoverT, null);
  assert.equal(sim.button(), false);
  close(sim.state.t, 0); close(sim.ballData(sim.state.t).xB, 0);
  sim.loop(1050); // A callback queued before the input must not resume the old fall.
  close(sim.state.t, 0);
  sim.state.playing = true;
  sim.loop(2000); sim.loop(2500);
  close(sim.state.t, .5); close(sim.ballData(sim.state.t).xB, 7);
  close(sim.ballData(sim.state.t).y, 1.225);
});

test('changing the strobe observation interval keeps a running trajectory continuous', () => {
  const sim = projectileInputs();
  const before = sim.ballData(sim.state.t);
  sim.input('dt', .4);
  assert.equal(sim.state.dt, .4);
  assert.equal(sim.state.playing, true);
  close(sim.state.t, 1);
  assert.deepEqual(sim.ballData(sim.state.t), before);
});
