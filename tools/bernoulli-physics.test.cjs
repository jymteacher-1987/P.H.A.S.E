const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../experiments/bernoulli-principle.html'), 'utf8');
const between = (first, last) => source.slice(source.indexOf(first), source.indexOf(last));
const modelCode = between('  const RHO=', '  function update(){');
const strengthCode = between('  function setStrength(value){', '  function step(dt){');
const stepCode = between('  function step(dt){', '  function render(){');
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

// Exercise the published model and animation functions, without rebuilding their physics.
function simulation(strength = 0) {
  const sim = new Function('reduced', modelCode + strengthCode + stepCode + `
    function update() {}
    function render() {}
    return {model, step, seed, hitRate, setStrength,
      setBoundaryStrength: value => {state.strength = value;},
      velocities: () => state.points.map(particleVelocity),
      snapshot: () => structuredClone(state)};
  `)(false);
  sim.seed();
  sim.setStrength(strength);
  return sim;
}
// Both pixel-speed components share the requested 1.6x drawing scale; v and P do not change.
const DRAWN_DRIFT = 200 * 1.6;
const randomSpeed = (velocity, strength) => Math.hypot(velocity.vx - DRAWN_DRIFT * strength / 100, velocity.vy);
function run(sim, seconds) {
  for (let frame = 0; frame < seconds * 120; frame++) sim.step(1 / 120);
  return sim.snapshot();
}

function observeImpacts(sim, seconds) {
  let count = sim.snapshot().collisionCount;
  const impacts = [];
  for (let frame = 0; frame < seconds * 120; frame++) {
    sim.step(1 / 120);
    const state = sim.snapshot(), added = state.collisionCount - count;
    if (added) impacts.push(...state.flashes.slice(-added));
    count = state.collisionCount;
  }
  return {state: sim.snapshot(), impacts};
}

test('Bernoulli speed and pressure retain the existing numerical relationship', () => {
  const sim = simulation();
  const expected = [
    {strength: 0, v: 0, P: 100, q: 0},
    {strength: 40, v: 4.8, P: 86.176, q: 13.824},
    {strength: 100, v: 12, P: 13.6, q: 86.4}
  ];
  for (const row of expected) {
    const actual = sim.model(row.strength);
    for (const key of ['v', 'P', 'q']) close(actual[key], row[key]);
  }
  let previous = Infinity;
  for (let strength = 0; strength <= 100; strength++) {
    const {v, P, q, total} = sim.model(strength);
    close(q, 0.5 * 1.2 * v * v);
    close(P + q, 100);
    close(total, 100);
    assert.ok(P < previous);
    previous = P;
  }
});

test('every molecule shares the same drift, and only the random part weakens as the flow speeds up', () => {
  const sim = simulation();
  const baseline = sim.velocities();
  assert.equal(baseline.length, 96);
  for (const velocity of baseline) close(randomSpeed(velocity, 0), 45 * 1.6);
  let previous = Infinity;
  for (const strength of [0, 10, 40, 70, 100]) {
    sim.setStrength(strength);
    const velocities = sim.velocities(), drift = DRAWN_DRIFT * strength / 100;
    const thermal = randomSpeed(velocities[0], strength);
    assert.ok(thermal > 0, 'drawing exaggeration must not stop random motion');
    let meanX = 0, meanY = 0;
    for (let i = 0; i < velocities.length; i++) {
      const velocity = velocities[i];
      close(randomSpeed(velocity, strength), thermal);
      // Each random direction stays the same; only its size changes.
      close((velocity.vx - drift) / thermal, baseline[i].vx / 72);
      close(velocity.vy / thermal, baseline[i].vy / 72);
      meanX += velocity.vx; meanY += velocity.vy;
    }
    close(meanX / velocities.length, drift);
    close(meanY / velocities.length, 0);
    assert.ok(thermal < previous);
    previous = thermal;
  }
  close(sim.model(0).random, 1);
  assert.ok(sim.model(100).random > 0.35 && sim.model(100).random < 0.45);
});

test('zero gauge pressure is not zero random molecular motion', () => {
  const sim = simulation();
  // Extend the same equation to its zero-gauge point for this conceptual boundary check.
  // The displayed slider still has its original 0..100 range and 12 m/s maximum.
  const strength = Math.sqrt(2 * 100 / 1.2) / 12 * 100;
  // The actual UI setter clamps at 100%; bypass only for this boundary case.
  sim.setBoundaryStrength(strength);
  close(sim.model().P, 0);
  const thermal = randomSpeed(sim.velocities()[0], strength);
  assert.ok(thermal > 0, 'random motion never stops at atmospheric pressure');
  for (const velocity of sim.velocities()) close(randomSpeed(velocity, strength), thermal);
});

test('medium and fast flow have visibly fewer and weaker actual wall impacts', () => {
  // Compare complete observation windows, not whichever flash survives at the end.
  const still = observeImpacts(simulation(0), 36);
  const medium = observeImpacts(simulation(40), 36);
  const fast = observeImpacts(simulation(100), 36);
  assert.ok(still.impacts.length > 100, 'observe enough impacts to compare the modes');
  const ratio = medium.impacts.length / still.impacts.length;
  assert.ok(ratio > 0.4 && ratio < 0.7, 'medium flow should show about half as many impacts: ' + ratio);
  assert.ok(fast.impacts.length > 0, 'fast flow still hits the walls');
  assert.ok(fast.impacts.length < medium.impacts.length * 0.6);
  const meanStrength = result => result.impacts.reduce((sum, f) => sum + f.strength, 0) / result.impacts.length;
  assert.ok(meanStrength(medium) < meanStrength(still) * 0.7);
  assert.ok(meanStrength(fast) < meanStrength(medium) * 0.6);
  assert.ok(fast.state.points.some((p, i) => p.x !== still.state.points[i].x), 'the added drift remains visible');
});

test('each counted yellow flash comes from a molecule crossing a wall', () => {
  for (const strength of [0, 40, 100]) {
    const sim = simulation(strength), dt = 1 / 120, drawingHeight = 270 - 89;
    let verified = 0;
    for (let frame = 0; frame < 12 * 120; frame++) {
      const before = sim.snapshot(), velocities = sim.velocities();
      const crossings = [];
      before.points.forEach((point, i) => {
        const dy = velocities[i].vy * dt / drawingHeight;
        if (point.y + dy < 0 || point.y + dy > 1) {
          crossings.push({wall: point.y + dy < 0 ? 0 : 1});
        }
      });
      sim.step(dt);
      const after = sim.snapshot();
      assert.equal(after.collisionCount - before.collisionCount, crossings.length);
      const added = after.flashes.filter(flash => flash.time >= before.time);
      assert.equal(added.length, crossings.length, 'no timed or decorative wall flashes');
      added.forEach((flash, i) => {
        assert.equal(flash.wall, crossings[i].wall);
        assert.ok(flash.time <= after.time);
        assert.ok(flash.x >= 0 && flash.x <= 1);
        assert.ok(after.hits.includes(flash.time), 'the counter uses the same actual crossing');
      });
      verified += added.length;
    }
    assert.ok(verified > 0, `no actual wall impacts verified at strength ${strength}`);
  }
});

test('the hit counter reports recent wall impacts per second', () => {
  const sim = simulation(0);
  assert.equal(sim.hitRate(), null);
  const rest = run(sim, 4), restRate = sim.hitRate();
  assert.ok(restRate > 8 && restRate < 25, 'slower random motion still produces visible wall impacts: ' + restRate);
  close(restRate, rest.hits.length / 3);
  sim.setStrength(100);
  run(sim, 4);
  assert.ok(sim.hitRate() < restRate * 0.6);
});

test('a mode change clears old impacts and waits half a second for a fresh sample', () => {
  const sim = simulation();
  const before = run(sim, 4);
  assert.ok(before.hits.length > 0);
  sim.setStrength(40);
  const changed = sim.snapshot();
  assert.equal(changed.time, before.time);
  assert.deepEqual(changed.points, before.points, 'changing modes does not reseed molecules');
  assert.deepEqual(changed.hits, []);
  assert.deepEqual(changed.flashes, []);
  assert.equal(sim.hitRate(), null);
  for (let frame = 0; frame < 49; frame++) sim.step(0.01);
  assert.equal(sim.hitRate(), null, 'do not report a rate from less than half a second');
  sim.step(0.02);
  const sample = sim.snapshot();
  assert.ok(Number.isFinite(sim.hitRate()));
  assert.ok(sample.hits.every(time => time >= before.time));
  close(sim.hitRate(), sample.hits.length / 0.51);
  const steady = run(sim, 4);
  close(sim.hitRate(), steady.hits.length / 3);
  sim.setStrength(0);
  assert.equal(sim.hitRate(), null, 'returning to still air also starts a new sample');
  sim.seed();
  assert.equal(sim.snapshot().time, 0);
  assert.deepEqual(sim.snapshot().hits, []);
  assert.equal(sim.hitRate(), null);
});

test('at the medium setting molecules collide and every one of them is carried to the right', () => {
  const sim = simulation(40), dt = 1 / 120, drift = DRAWN_DRIFT * 40 / 100;
  const start = sim.snapshot().points, sumUx = points => points.reduce((sum, p) => sum + p.ux, 0);
  const sumAbsUy = points => points.reduce((sum, p) => sum + Math.abs(p.uy), 0);
  const moved = new Array(start.length).fill(0);
  let windows = 0, backward = 0, last = moved.slice();
  for (let frame = 1; frame <= 12 * 120; frame++) {
    sim.velocities().forEach((velocity, i) => {
      assert.ok(velocity.vx > 0, `medium flow reverses molecule ${i} at frame ${frame}`);
      moved[i] += velocity.vx * dt;
    });
    sim.step(dt);
    if (frame % 240 === 0) {
      moved.forEach((x, i) => { windows++; if (x - last[i] <= 0) backward++; });
      last = moved.slice();
    }
  }
  const end = sim.snapshot().points;
  assert.ok(end.some((p, i) => p.ux !== start[i].ux), 'molecules change direction by colliding');
  close(sumUx(end), sumUx(start), 1e-9);
  close(sumAbsUy(end), sumAbsUy(start), 1e-9);
  assert.ok(moved.every(x => x > 0), 'no molecule keeps moving against the flow');
  close(moved.reduce((sum, x) => sum + x, 0) / moved.length, drift * 12, 1e-6);
  assert.ok(backward / windows < 0.02, 'over two seconds almost every molecule moves right: ' + backward / windows);
});

test('molecules travel briefly before another random turn instead of immediately reversing again', () => {
  const sim = simulation(40), dt = 1 / 120;
  let previous = sim.snapshot().points, turns = 0;
  const lastTurn = previous.map(() => null);
  for (let frame = 1; frame <= 4 * 120; frame++) {
    sim.step(dt);
    const current = sim.snapshot().points;
    current.forEach((point, i) => {
      // Wall reflections change uy, so compare ux to observe molecule-to-molecule turns.
      if (point.ux === previous[i].ux) return;
      const time = frame * dt;
      if (lastTurn[i] !== null) {
        assert.ok(time - lastTurn[i] >= 0.08 - 1e-9, `molecule ${i} turned again too soon`);
      }
      lastTurn[i] = time;
      turns++;
    });
    previous = current;
  }
  assert.ok(turns > previous.length, 'random directions must still change over time');
});

test('weak flow is visibly rightward over half-second to two-second observation windows', () => {
  // Short backward steps remain possible at 10%; test the observable accumulated
  // displacement without mistaking a right-edge wrap for movement to the left.
  for (const {seconds, minimum} of [
    {seconds: 0.5, minimum: 0.8},
    {seconds: 1, minimum: 0.9},
    {seconds: 2, minimum: 0.95}
  ]) {
    const sim = simulation(10), dt = 1 / 120;
    const moved = new Array(sim.snapshot().points.length).fill(0);
    const framesPerWindow = Math.round(seconds / dt);
    for (let frame = 1; frame <= 12 * 120; frame++) {
      sim.velocities().forEach((velocity, i) => { moved[i] += velocity.vx * dt; });
      sim.step(dt);
      if (frame % framesPerWindow === 0) {
        const rightward = moved.filter(distance => distance > 0).length / moved.length;
        assert.ok(rightward >= minimum,
          `${seconds}s window ending at frame ${frame}: only ${rightward * 100}% moved right`);
        close(moved.reduce((sum, distance) => sum + distance, 0) / moved.length,
          DRAWN_DRIFT * 0.1 * seconds, 1e-6);
        moved.fill(0);
      }
    }
  }
});
