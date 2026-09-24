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
    const velocities = sim.velocities(), drift = 200 * strength / 100, thermal = 180 * sim.model().random;
    let meanX = 0, meanY = 0;
    for (let i = 0; i < velocities.length; i++) {
      const velocity = velocities[i];
      close(randomSpeed(velocity, strength), thermal);
      // Each random direction stays the same; only its size changes.
      close((velocity.vx - drift) / thermal, baseline[i].vx / 180);
      close(velocity.vy / thermal, baseline[i].vy / 180);
      meanX += velocity.vx; meanY += velocity.vy;
    }
    close(meanX / velocities.length, drift);
    close(meanY / velocities.length, 0);
    assert.ok(thermal < previous);
    previous = thermal;
  }
  close(sim.model(0).random, 1);
  assert.ok(sim.model(100).random > 0.45 && sim.model(100).random < 0.55);
});

test('zero gauge pressure is not zero random molecular motion', () => {
  const sim = simulation();
  // Extend the same equation to its zero-gauge point for this conceptual boundary check.
  // The displayed slider still has its original 0..100 range and 12 m/s maximum.
  const strength = Math.sqrt(2 * 100 / 1.2) / 12 * 100;
  sim.setStrength(strength);
  close(sim.model().P, 0);
  const thermal = 180 * sim.model().random;
  assert.ok(thermal > 0.3 * 180, 'random motion stays clearly visible at atmospheric pressure');
  for (const velocity of sim.velocities()) close(randomSpeed(velocity, strength), thermal);
});

test('faster flow gives fewer and weaker wall impacts', () => {
  const slow = run(simulation(0), 4), fast = run(simulation(100), 4);
  assert.ok(slow.collisionCount > 100, 'random motion keeps hitting the walls');
  assert.ok(fast.collisionCount > 0, 'fast flow still hits the walls');
  const ratio = fast.collisionCount / slow.collisionCount;
  assert.ok(ratio > 0.4 && ratio < 0.6, 'hits fall with the random speed: ' + ratio);
  const meanStrength = snapshot => snapshot.flashes.reduce((sum, f) => sum + f.strength, 0) / snapshot.flashes.length;
  assert.ok(meanStrength(fast) < meanStrength(slow));
  assert.ok(fast.points.some((p, i) => p.x !== slow.points[i].x), 'the added drift remains visible');
});

test('the hit counter reports recent wall impacts per second', () => {
  const sim = simulation(0);
  assert.equal(sim.hitRate(), null);
  const rest = run(sim, 4), restRate = sim.hitRate();
  assert.ok(restRate > 40 && restRate < 80, 'about sixty hits per second at rest: ' + restRate);
  close(restRate, rest.hits.length / 3);
  sim.setStrength(100);
  run(sim, 4);
  assert.ok(sim.hitRate() < restRate * 0.6);
});

test('dashed flow markers move with the drift shared by every molecule', () => {
  const rest = simulation(0);
  run(rest, 1);
  close(rest.snapshot().flow, 0);
  const sim = simulation(100), dt = 1 / 120;
  sim.step(dt);
  // The default 600 px canvas leaves 580 px of pipe between the side margins.
  close(sim.snapshot().flow, 200 * dt / 580);
});
