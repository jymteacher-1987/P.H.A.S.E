const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../experiments/bernoulli-principle.html'), 'utf8');
const between = (first, last) => source.slice(source.indexOf(first), source.indexOf(last));
const modelCode = between('  const AREA_RATIO=', '  function label(');
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

// Exercise the published model and animation functions (no canvas), without rebuilding their physics.
function simulation() {
  const sim = new Function('reduced', modelCode + `
    return {state, seed, step, hitShares, hRel, pressureShare, geom,
      AREA_RATIO, U_WIDE, C_WIDE, K2, WIDE_END, NARROW_START, GATE_WIDE, GATE_NARROW};
  `)(false);
  sim.seed();
  return sim;
}
function run(sim, seconds, dt = 1 / 60) {
  for (let frame = 0; frame < Math.round(seconds / dt); frame++) sim.step(dt);
}
const sectionArea = sim => ({
  wide: sim.WIDE_END,
  taper: (sim.NARROW_START - sim.WIDE_END) * (1 + 1 / sim.AREA_RATIO) / 2,
  narrow: (1 - sim.NARROW_START) / sim.AREA_RATIO
});

test('continuity and Bernoulli: the narrow flow is three times faster and P + q stays fixed', () => {
  const sim = simulation();
  assert.equal(sim.AREA_RATIO, 3);
  close(sim.hRel(0), 1);
  close(sim.hRel(1), 1 / 3);
  // Drift u = U_WIDE / hRel, so u x area is the same everywhere.
  for (const x of [0, .2, sim.WIDE_END, .49, sim.NARROW_START, .8, 1]) {
    close((sim.U_WIDE / sim.hRel(x)) * sim.hRel(x), sim.U_WIDE);
  }
  // The pressure share and the dynamic share of the same constant always add up to one.
  let previous = Infinity;
  for (let x = 0; x <= 1.0001; x += .01) {
    const hr = sim.hRel(Math.min(1, x)), u = sim.U_WIDE / hr;
    close(sim.pressureShare(hr) + u * u / sim.K2, 1);
    assert.ok(sim.pressureShare(hr) <= previous + 1e-12, 'pressure never rises along the converging pipe');
    previous = sim.pressureShare(hr);
  }
  close(sim.pressureShare(1), .9);
  close(sim.pressureShare(1 / 3), .1);
  const narrowRandom = Math.sqrt(sim.K2 - (sim.U_WIDE * 3) ** 2);
  assert.ok(narrowRandom > 0, 'random motion never stops in the fast part');
  close(narrowRandom / sim.C_WIDE, 1 / 3);
});

test('molecules are equally dense in the wide, tapered and narrow parts', () => {
  const sim = simulation(), area = sectionArea(sim);
  run(sim, 20);
  const totals = {wide: 0, taper: 0, narrow: 0};
  let samples = 0;
  for (let i = 0; i < 600; i++) {
    run(sim, 1 / 6);
    for (const p of sim.state.points) {
      const x = p.xc + p.ox;
      if (x < sim.WIDE_END) totals.wide++;
      else if (x > sim.NARROW_START) totals.narrow++;
      else totals.taper++;
    }
    samples++;
  }
  const density = key => totals[key] / samples / area[key];
  for (const key of ['taper', 'narrow']) {
    const ratio = density(key) / density('wide');
    assert.ok(ratio > .93 && ratio < 1.07, `${key} density ratio ${ratio}`);
  }
});

test('the same number of molecules pass both check lines at every moment', () => {
  const sim = simulation();
  let largestGap = 0;
  for (let i = 0; i < 60 * 60; i++) {
    sim.step(1 / 60);
    largestGap = Math.max(largestGap, Math.abs(sim.state.passWide - sim.state.passNarrow));
  }
  assert.ok(sim.state.passWide > 600, 'enough molecules cross to compare: ' + sim.state.passWide);
  assert.ok(largestGap <= 2, 'the two counts stay together even early on: largest gap ' + largestGap);
});

test('the narrow walls receive fewer and weaker hits per unit wall length', () => {
  const sim = simulation();
  run(sim, 10);
  let wide = {count: 0, strength: 0}, narrow = {count: 0, strength: 0}, seen = 0;
  for (let i = 0; i < 120 * 60; i++) {
    sim.step(1 / 60);
    const added = sim.state.hits.slice(seen);
    for (const h of added) {
      const side = h.wide ? wide : narrow;
      side.count++; side.strength += h.strength;
    }
    sim.state.hits = sim.state.hits.filter(h => sim.state.time - h.time < 5);
    seen = sim.state.hits.length;
  }
  const perLength = (side, length) => side.count / length;
  const countRatio = perLength(narrow, 1 - sim.NARROW_START) / perLength(wide, sim.WIDE_END);
  assert.ok(countRatio > .25 && countRatio < .45, 'narrow hit count ratio ' + countRatio);
  const strengthRatio = (narrow.strength / narrow.count) / (wide.strength / wide.count);
  assert.ok(strengthRatio > .25 && strengthRatio < .45, 'narrow hit strength ratio ' + strengthRatio);
  assert.ok(narrow.count > 0, 'the fast part still hits its walls');
});

test('the collision bars show a clear gap after the first moments', () => {
  const sim = simulation();
  assert.equal(sim.hitShares(), null);
  run(sim, 1);
  assert.equal(sim.hitShares(), null, 'no bar before 1.5 seconds');
  run(sim, .6);
  for (let i = 0; i < 40; i++) {
    run(sim, .5);
    const share = sim.hitShares();
    assert.ok(share, 'bars appear after 1.5 seconds');
    close(share.wide, 1);
    assert.ok(share.narrow < .35, 'narrow bar stays well below the wide bar: ' + share.narrow);
  }
});

test('each yellow flash comes from a molecule actually crossing a wall', () => {
  const sim = simulation(), dt = 1 / 60;
  let verified = 0;
  for (let frame = 0; frame < 20 * 60; frame++) {
    const g = sim.geom(), k = g.k;
    const expected = sim.state.points.filter(p => {
      const x = Math.min(1, Math.max(0, p.xc + p.ox)), hr = sim.hRel(x), half = g.hW * hr / 2;
      const u = sim.U_WIDE * k / hr, c = Math.sqrt(Math.max(0, sim.K2 * k * k - u * u));
      return Math.abs(p.s + c * p.uy * dt / half) > 1;
    }).length;
    const time = sim.state.time;
    sim.step(dt);
    const added = sim.state.flashes.filter(f => f.time > time).length;
    assert.equal(added, expected, 'no timed or decorative flashes');
    verified += added;
  }
  assert.ok(verified > 100, 'checked enough wall hits: ' + verified);
});

test('molecules collide with each other but keep their set of random directions', () => {
  const sim = simulation();
  const sumUx = () => sim.state.points.reduce((sum, p) => sum + p.ux, 0);
  const sumAbsUy = () => sim.state.points.reduce((sum, p) => sum + Math.abs(p.uy), 0);
  const ux0 = sumUx(), uy0 = sumAbsUy(), start = sim.state.points.map(p => p.ux);
  run(sim, 12);
  close(sumUx(), ux0, 1e-9);
  close(sumAbsUy(), uy0, 1e-9);
  assert.ok(sim.state.points.some((p, i) => p.ux !== start[i]), 'directions change by colliding');
});

test('slow view slows the clock by ten times without changing the physics', () => {
  assert.match(source, /<button id="slow"[^>]*>느리게 보기 \(1\/10배\)<\/button>/);
  assert.match(modelCode, /const SLOW_FACTOR=\.1;/);
  assert.match(source, /step\(dt\*\(state\.slow\?SLOW_FACTOR:1\)\)/, 'the frame loop scales the simulation time step');
  // Ten slow steps cover the same simulated time as one normal step.
  const normal = simulation(), slow = simulation();
  run(normal, 2, 1 / 60);
  run(slow, 2, 1 / 600);
  close(normal.state.time, slow.state.time, 1e-9);
  const passRatio = slow.state.passWide / Math.max(1, normal.state.passWide);
  assert.ok(passRatio > .8 && passRatio < 1.25, 'same flow in simulated time: ' + passRatio);
});

test('the flow carries every molecule to the right and recycles it at the inlet', () => {
  const sim = simulation();
  const before = sim.state.points.map(p => p.xc);
  sim.step(1 / 60);
  sim.state.points.forEach((p, i) => {
    assert.ok(p.xc > before[i] || p.xc < .05, 'a carrier moves right or re-enters at the inlet');
    assert.ok(Math.abs(p.ox) < .1, 'random travel along the pipe stays near its carrier');
  });
});
