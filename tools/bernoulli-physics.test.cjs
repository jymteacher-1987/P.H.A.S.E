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
    return {model, step, seed,
      setStrength: value => {state.strength = value;},
      velocities: () => state.points.map(particleVelocity),
      snapshot: () => structuredClone(state)};
  `)(false);
  sim.seed();
  sim.setStrength(strength);
  return sim;
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

test('changing the mean flow leaves the random component of every molecule unchanged', () => {
  const sim = simulation();
  const baseline = sim.velocities();
  for (const strength of [0, 40, 100]) {
    sim.setStrength(strength);
    const velocities = sim.velocities();
    const drift = 200 * strength / 100;
    let meanX = 0, meanY = 0;
    for (let i = 0; i < velocities.length; i++) {
      const velocity = velocities[i];
      close(velocity.vx - drift, baseline[i].vx);
      close(velocity.vy, baseline[i].vy);
      close(Math.hypot(velocity.vx - drift, velocity.vy), 180);
      meanX += velocity.vx; meanY += velocity.vy;
    }
    close(meanX / velocities.length, drift);
    close(meanY / velocities.length, 0);
  }
});

test('zero gauge pressure is not zero random molecular motion', () => {
  const sim = simulation();
  // Extend the same equation to its zero-gauge point for this conceptual boundary check.
  // The displayed slider still has its original 0..100 range and 12 m/s maximum.
  const strength = Math.sqrt(2 * 100 / 1.2) / 12 * 100;
  sim.setStrength(strength);
  close(sim.model().P, 0);
  for (const {vx, vy} of sim.velocities()) {
    close(Math.hypot(vx - 200 * strength / 100, vy), 180);
  }
});

test('wall collision frequency and impact intensity do not masquerade as gauge pressure', () => {
  const slow = simulation(0), fast = simulation(100);
  assert.notEqual(slow.model().P, fast.model().P);
  for (let frame = 0; frame < 360; frame++) {
    slow.step(1 / 120); fast.step(1 / 120);
    const a = slow.snapshot(), b = fast.snapshot();
    assert.equal(a.collisionCount, b.collisionCount);
    assert.deepEqual(a.points.map(p => [p.y, p.uy]), b.points.map(p => [p.y, p.uy]));
    assert.deepEqual(a.flashes.map(f => [f.wall, f.time, f.strength]),
      b.flashes.map(f => [f.wall, f.time, f.strength]));
  }
  assert.ok(slow.snapshot().collisionCount > 0, 'random motion still causes wall impacts');
  assert.ok(slow.snapshot().points.some((p, i) => p.x !== fast.snapshot().points[i].x),
    'the added drift must remain visible as different horizontal motion');
});
