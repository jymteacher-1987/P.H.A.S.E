const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(path.join(__dirname, '../experiments/bernoulli-principle.html'), 'utf8');
const between = (first, last) => source.slice(source.indexOf(first), source.indexOf(last));
const modelCode = between('  const RHO=', '  function update(){');
const stepCode = between('  function step(dt){', '  function render(){');
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);

// Exercise the published model and animation functions, without rebuilding their physics.
function simulation(strength = 0) {
  const sim = new Function('reduced', modelCode + stepCode + `
    return {model, step, seed, hitRate,
      setStrength: value => {state.strength = value;},
      velocities: () => state.points.map(particleVelocity),
      snapshot: () => structuredClone(state)};
  `)(false);
  sim.seed();
  sim.setStrength(strength);
  return sim;
}
const randomSpeed = (velocity, strength) => Math.hypot(velocity.vx - 200 * strength / 100, velocity.vy);
function run(sim, seconds) {
  for (let frame = 0; frame < seconds * 120; frame++) sim.step(1 / 120);
  return sim.snapshot();
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
  let previous = Infinity;
  for (const strength of [0, 40, 100]) {
    sim.setStrength(strength);
    const velocities = sim.velocities(), drift = 200 * strength / 100, thermal = 45 * sim.model().random;
    let meanX = 0, meanY = 0;
    for (let i = 0; i < velocities.length; i++) {
      const velocity = velocities[i];
      close(randomSpeed(velocity, strength), thermal);
      // Each random direction stays the same; only its size changes.
      close((velocity.vx - drift) / thermal, baseline[i].vx / 45);
      close(velocity.vy / thermal, baseline[i].vy / 45);
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
  sim.setStrength(strength);
  close(sim.model().P, 0);
  const thermal = 45 * sim.model().random;
  assert.ok(thermal > 0.15 * 45, 'random motion never stops at atmospheric pressure');
  for (const velocity of sim.velocities()) close(randomSpeed(velocity, strength), thermal);
});

test('faster flow gives fewer and weaker wall impacts', () => {
  // Slower animation needs a longer observation window for enough wall impacts.
  const slow = run(simulation(0), 12), fast = run(simulation(100), 12);
  assert.ok(slow.collisionCount > 100, 'random motion keeps hitting the walls');
  assert.ok(fast.collisionCount > 0, 'fast flow still hits the walls');
  const ratio = fast.collisionCount / slow.collisionCount;
  assert.ok(ratio > 0.3 && ratio < 0.5, 'hits fall with the random speed: ' + ratio);
  const meanStrength = snapshot => snapshot.flashes.reduce((sum, f) => sum + f.strength, 0) / snapshot.flashes.length;
  assert.ok(meanStrength(fast) < meanStrength(slow));
  assert.ok(fast.points.some((p, i) => p.x !== slow.points[i].x), 'the added drift remains visible');
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

test('at the medium setting molecules collide and every one of them is carried to the right', () => {
  const sim = simulation(40), dt = 1 / 120, drift = 200 * 40 / 100;
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
          20 * seconds, 1e-6);
        moved.fill(0);
      }
    }
  }
});
