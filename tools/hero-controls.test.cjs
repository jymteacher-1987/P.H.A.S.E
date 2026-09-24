const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const root = path.resolve(__dirname, '..');
const ids = ['oobleck', 'gas', 'balloon', 'fruitcell'];
const close = (actual, expected, tolerance, label) => assert.ok(
  Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);

async function serve() {
  const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
    '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp'};
  const server = http.createServer((req, res) => {
    try {
      const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
      if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
      res.writeHead(200, {'content-type':types[path.extname(file)] || 'application/octet-stream'})
        .end(fs.readFileSync(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {server, origin:`http://127.0.0.1:${server.address().port}`};
}

// Advance the actual simulation drawing/physics, without waiting for wall time.
// Only the visible controls set experiment values and start/reset experiments.
async function advance(page, id, frames = 1000) {
  return page.evaluate(({id, frames}) => {
    const simulation = SIMS[id], canvas = document.getElementById('simCv');
    const g = canvas.getContext('2d');
    for (let frame = 0; frame < frames; frame++) {
      g.clearRect(0, 0, canvas.width, canvas.height);
      simulation.draw(g, canvas.width, canvas.height, simVals, simSt, frame / 60);
    }
    return {state:{...simSt}, values:{...simVals}, read:simulation.read(simVals, simSt)};
  }, {id, frames});
}

for (const engine of [chromium, webkit]) {
  test(`hero controls preserve trial state and readings (${engine.name()})`, {timeout:120000}, async t => {
    const {server, origin} = await serve();
    t.after(() => new Promise(resolve => server.close(resolve)));
    const browser = await engine.launch({headless:true});
    t.after(() => browser.close());

    for (const width of [390, 1280]) {
      const context = await browser.newContext({viewport:{width, height:900}});
      await context.route('**/*', route => route.request().method() === 'GET' &&
        route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/plays/hero-maker.html');
      const inventory = await page.evaluate(ids => Object.entries(LABS).flatMap(([level, stations]) =>
        stations.flatMap((station, index) => station.experiments.filter(e => ids.includes(e.id))
          .map(e => ({level, station:index, id:e.id})))), ids);
      assert.deepEqual([...new Set(inventory.map(item => item.id))].sort(), [...ids].sort());

      for (const item of inventory) {
        await t.test(`${item.id}, ${item.level}, ${width}px`, async () => {
          // Choose an existing lab, then use its real experiment tile and controls.
          await page.evaluate(({level, station}) => {
            state.level = level; state.station = station; state.picked = null;
            resetQuiz(); go('lab');
          }, item);
          await page.locator(`[data-exp="${item.id}"]`).click();
          await page.evaluate(() => stopSim());

          if (item.id === 'oobleck') {
            await page.locator('#c_speed').fill('2');
            await page.locator('#c_press').click();
            const slow = await advance(page, item.id);
            assert.equal(slow.state.ph, 'sunk');
            assert.ok(slow.state.depth > 0, 'a slow completed press must penetrate');

            await page.locator('#c_speed').fill('10');
            const reset = await advance(page, item.id, 0);
            assert.equal(reset.values.speed, 10);
            assert.equal(reset.state.ph, 'idle', 'changing speed must prepare a new trial');
            for (const key of ['y', 'depth', 'imp', 'bounce', 'peak']) assert.equal(reset.state[key], 0, key);
            await page.locator('#c_press').click();
            const fast = await advance(page, item.id);
            assert.equal(fast.state.ph, 'hard', 'the next press must use the new speed');
            assert.equal(fast.state.depth, 0, 'a fast press must not retain the old penetration');
            assert.ok(fast.state.peak > 0, 'the fast trial must actually produce a rebound');

            await page.locator('#c_speed').fill('1');
            await page.locator('#c_press').click();
            await advance(page, item.id, 5);
            await page.locator('#c_speed').fill('5');
            assert.equal((await advance(page, item.id, 0)).state.ph, 'idle',
              'changing speed during motion must also prepare a new trial');
          } else if (item.id === 'gas') {
            await page.locator('#c_amt').fill('1');
            await page.locator('#c_go').click();
            const small = await advance(page, item.id);
            assert.ok(small.state.peak > 0, 'the first launch must have a measurable height');
            await page.locator('#c_amt').fill('10');
            const reset = await advance(page, item.id, 0);
            assert.equal(reset.values.amt, 10);
            for (const key of ['run', 'fired', 'p', 'y', 'vy', 'cap', 'capV', 'peak']) {
              assert.equal(reset.state[key], 0, `changing amount must reset ${key}`);
            }
            await page.locator('#c_go').click();
            const large = await advance(page, item.id);
            assert.ok(large.state.peak > small.state.peak, 'the next launch must use the new amount');
            // The model launches at 1.1 + 0.55*amount m/s, with g=9.8 m/s².
            close(small.state.peak / 118, 1.65 ** 2 / (2 * 9.8), .001, 'first launch height (m)');
            close(large.state.peak / 118, 6.6 ** 2 / (2 * 9.8), .001, 'new launch height (m)');
            await page.locator('#c_amt').fill('1');
            await page.locator('#c_go').click();
            await advance(page, item.id, 5);
            await page.locator('#c_amt').fill('5');
            const interrupted = await advance(page, item.id, 0);
            assert.equal(interrupted.state.run, 0, 'a changed amount must stop the old trial');
            assert.equal(interrupted.state.peak, 0);
          } else if (item.id === 'balloon') {
            await page.locator('#c_go').click();
            const stages = await page.evaluate(() => {
              const simulation = SIMS.balloon, canvas = document.getElementById('simCv');
              const g = canvas.getContext('2d'), saved = g.fillText, labels = [];
              let frame = 0;
              const draw = () => {
                g.clearRect(0, 0, canvas.width, canvas.height);
                simulation.draw(g, canvas.width, canvas.height, simVals, simSt, frame++ / 60);
              };
              g.fillText = function(text, ...args) { labels.push(String(text)); return saved.call(this, text, ...args); };
              try {
                while (simSt.air > 0 && frame < 1000) draw();
                labels.length = 0;
                let x = simSt.x; draw();
                const moving = {state:{...simSt}, dx:simSt.x-x, labels:[...labels]};
                while (simSt.v > 0 && frame < 3000) draw();
                labels.length = 0;
                x = simSt.x; draw();
                return {moving, stopped:{state:{...simSt}, dx:simSt.x-x, labels:[...labels]}};
              } finally { g.fillText = saved; }
            });
            assert.equal(stages.moving.state.air, 0);
            assert.ok(stages.moving.state.v > 0 && stages.moving.dx > 0,
              'the balloon must still physically move after its air is exhausted');
            assert.ok(stages.moving.labels.some(label => /이동 중|감속 중/.test(label)));
            assert.ok(!stages.moving.labels.some(label => label.includes('멈춤')),
              'the painted status must not call a moving balloon stopped');
            assert.equal(stages.stopped.state.v, 0);
            assert.equal(stages.stopped.dx, 0);
            assert.ok(stages.stopped.labels.some(label => label.includes('멈춤')));
          } else {
            await page.locator('#c_b').selectOption('cu');
            await page.locator('#c_e').selectOption('lemon');
            for (const [metal, expected] of Object.entries({zn:[.935, 1.87, 2.805, 3.74],
              al:[.629, 1.258, 1.887, 2.516]})) {
              await page.locator('#c_a').selectOption(metal);
              for (let n = 1; n <= 4; n++) {
                await page.locator('#c_n').fill(String(n));
                const result = await page.evaluate(() => {
                  const simulation = SIMS.fruitcell, canvas = document.getElementById('simCv');
                  const g = canvas.getContext('2d'), saved = g.fillText, labels = [];
                  g.fillText = function(text, ...args) { labels.push(String(text)); return saved.call(this, text, ...args); };
                  try {
                    g.clearRect(0, 0, canvas.width, canvas.height);
                    simulation.draw(g, canvas.width, canvas.height, simVals, simSt, 2);
                    return {n:simVals.n, volts:simulation.volts(simVals), terminal:simulation.terminalVolts(simVals), current:simulation.current(simVals), read:simulation.read(simVals), labels};
                  } finally { g.fillText = saved; }
                });
                assert.equal(result.n, n, 'the actual range input must change the cell count');
                close(result.volts, expected[n-1], 1e-12, `${metal}/Cu, ${n} cells (V)`);
                const displayed = expected[n-1].toFixed(2) + ' V';
                assert.ok(result.read.startsWith('연결 전 '+displayed), 'the open-circuit readout must retain the series voltage');
                const terminal = expected[n-1] - result.current * 900 * n;
                close(result.terminal, terminal, 1e-12, 'loaded terminal voltage must satisfy Kirchhoff');
                assert.ok(result.labels.includes(terminal.toFixed(2)+' V'), 'the voltmeter across the LED must show its loaded voltage');
                assert.ok(result.labels.includes('LED 양단 전압'), 'the circuit meter must identify what it measures');
              }
            }
          }
          assert.deepEqual(errors, [], 'no browser runtime errors');
        });
      }
      await context.close();
    }
  });
}
