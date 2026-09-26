const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the production integrator, emission, completion and retention logic.
// Only Canvas drawing and the animation clock are replaced in the long runs.
function simulation(viewIndex = 1) {
  const html = fs.readFileSync(path.join(__dirname, '../experiments/rutherford-scattering.html'), 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(source => source.includes('function retainRecentTrails()'));
  assert.ok(script, 'Rutherford simulation script must be present');
  let now = 0, seed = 17;
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  class RecordedPath {
    constructor() { this.commands = []; }
    moveTo(x, y) { this.commands.push(['moveTo', x, y]); }
    lineTo(x, y) { this.commands.push(['lineTo', x, y]); }
  }
  const drawing = { lineTo: 0, paths: [] };
  const context = new Proxy({}, {
    get(object, key) {
      if (key in object) return object[key];
      if (key === 'lineTo') return () => drawing.lineTo++;
      if (key === 'stroke') return shape => { if (shape) drawing.paths.push(shape); };
      return () => {};
    }
  });
  const sandbox = {
    Math: math, Path2D: RecordedPath, performance: { now: () => now },
    window: {}, document: {}, requestAnimationFrame() {}, testContext: context
  };
  vm.runInNewContext(script.replace(/\binit\(\);\s*$/, '') + `
    ctx = testContext;
    LAY = {w:800,h:324,stacked:false,panels:[
      {ox:0,oy:0,pw:400,ph:324},{ox:400,oy:0,pw:400,ph:324}]};
    const realDrawPanel = drawPanel;
    drawPanel = () => {};
    updateHover = () => {};
    seg = () => {};
    viewIdx = ${viewIndex};
    globalThis.api = {
      fire, step, activeCount, retainRecentTrails,
      particles: () => particles, stats: () => stats,
      auto(value) { autoFire = value; },
      trails(value) { showTrail = value; },
      render(withParticles = true) {
        const saved = particles;
        if (!withParticles) particles = [];
        realDrawPanel(LAY.panels[0], 'thomson', '', '');
        realDrawPanel(LAY.panels[1], 'rutherford', '', '');
        particles = saved;
      }
    };`, sandbox);
  return {
    api: sandbox.api, drawing,
    tick(milliseconds) { now += milliseconds; sandbox.api.step(); },
    snapshot() { return JSON.parse(JSON.stringify(sandbox.api.stats())); }
  };
}

test('a full active population rejects a shot without changing launch statistics or deleting flights', () => {
  const sim = simulation();
  for (let n = 0; n < 32; n++) assert.equal(sim.api.fire(0), true);
  const flights = [...sim.api.particles()], stats = sim.snapshot();
  assert.equal(sim.api.fire(0), false);
  assert.deepEqual(sim.snapshot(), stats);
  assert.equal(sim.api.activeCount(), 64);
  sim.api.retainRecentTrails();
  assert.deepEqual([...sim.api.particles()], flights, 'history cleanup must preserve every unfinished flight');
  sim.api.trails(false);
  sim.api.retainRecentTrails();
  assert.deepEqual([...sim.api.particles()], flights, 'hiding trails must not discard an unfinished flight');
});

test('an odd active population reserves two free slots before admitting a paired shot', () => {
  for (const [pairs, automatic] of [[32, false], [24, true]]) {
    const sim = simulation();
    for (let n = 0; n < pairs - 1; n++) assert.equal(sim.api.fire(0), true);
    // This off-axis Thomson flight completes before the head-on flights.
    // Produce an odd population through the actual integrator, not a fake done flag.
    assert.equal(sim.api.fire(5 * 4.55e-4), true);
    let frame = 0;
    while (sim.api.activeCount() === pairs * 2 && frame++ < 500) sim.tick(1000 / 60);
    assert.equal(sim.api.activeCount(), pairs * 2 - 1);
    const stats = sim.snapshot();
    if (automatic) {
      sim.api.auto(true);
      sim.tick(1000 / 60);
    } else {
      assert.equal(sim.api.fire(0), false);
    }
    assert.deepEqual(sim.snapshot(), stats, 'a pair must wait until both population slots are free');
  }
});

for (const fps of [60, 30, 15]) {
  test(`continuous firing at ${fps} fps keeps bounded history and eventually counts every emitted particle`, () => {
    for (const viewIndex of [0, 1]) {
      const sim = simulation(viewIndex), completed = new Set();
      const observed = { thomson: { n: 0, pass: 0, big: 0 }, rutherford: { n: 0, pass: 0, big: 0 } };
      const tick = () => {
        const before = [...sim.api.particles()];
        sim.tick(1000 / fps);
        const after = [...sim.api.particles()];
        for (const particle of before) {
          assert.ok(particle.done || after.includes(particle), 'unfinished flight was removed before its result');
        }
        for (const particle of new Set([...before, ...after])) {
          if (!particle.done || completed.has(particle)) continue;
          completed.add(particle);
          const result = observed[particle.model];
          result.n++;
          if (particle.theta < 1) result.pass++;
          if (particle.theta > 90) result.big++;
        }
        for (const model of ['thomson', 'rutherford']) {
          assert.ok(after.filter(particle => particle.model === model && particle.done).length <= 24,
            'completed history must stay bounded independently for each model');
        }
        assert.ok(sim.api.activeCount() <= 64, 'active population must remain within its budget');
      };
      sim.api.auto(true);
      for (let frame = 0; frame < fps * 60; frame++) tick();
      sim.api.auto(false);
      let remaining = 0;
      while (sim.api.activeCount() && remaining++ < 1300) tick();
      assert.equal(sim.api.activeCount(), 0, 'every admitted flight must finish after auto fire stops');
      const stats = sim.snapshot();
      for (const model of ['thomson', 'rutherford']) {
        assert.ok(stats[model].n > 24, 'run must exercise completed-history eviction');
        assert.equal(observed[model].n, stats[model].n, 'all emitted particles must complete exactly once');
        assert.equal(observed[model].pass, stats[model].pass, 'pass count must include evicted finished trails');
        assert.equal(observed[model].big, stats[model].big, 'backscatter count must include evicted finished trails');
      }
      assert.ok(observed.rutherford.big > 0 || viewIndex === 0, 'near-core run must retain completed backscatter results');
    }
  });
}

test('cached paths preserve all sampled coordinates and completed rendering never rebuilds their segments', () => {
  const sim = simulation();
  for (const ratio of [0, 0.5, 1]) assert.equal(sim.api.fire(ratio * 4.55e-4), true);
  for (let frame = 0; frame < 1300 && sim.api.activeCount(); frame++) sim.tick(1000 / 60);
  assert.equal(sim.api.activeCount(), 0);
  const particles = [...sim.api.particles()];
  for (const particle of particles) {
    const expected = Array.from(particle.trail, (point, index) => [index ? 'lineTo' : 'moveTo', ...point]);
    assert.deepEqual(particle.path.commands, expected, 'cache must contain every sampled model-space point in order');
  }
  const commandsBefore = particles.map(particle => JSON.stringify(particle.path.commands));
  sim.api.render(false);
  const backgroundSegments = sim.drawing.lineTo;
  sim.drawing.lineTo = 0;
  for (let frame = 0; frame < 10; frame++) sim.api.render();
  assert.equal(sim.drawing.lineTo, backgroundSegments * 10, 'completed trails must not replay lineTo on the drawing context');
  assert.equal(sim.drawing.paths.length, particles.length * 10, 'every completed trail must still be drawn');
  const cached = new Set(particles.map(particle => particle.path));
  assert.ok(sim.drawing.paths.every(shape => cached.has(shape)), 'rendering must reuse the stored paths');
  assert.deepEqual(particles.map(particle => JSON.stringify(particle.path.commands)), commandsBefore);
  sim.api.trails(false);
  sim.api.retainRecentTrails();
  assert.equal(sim.api.particles().length, 0, 'turning trails off releases finished history');
});
