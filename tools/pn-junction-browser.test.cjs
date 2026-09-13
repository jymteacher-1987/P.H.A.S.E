const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium, webkit } = require('playwright');
const root = path.resolve(__dirname, '..');

for (const engine of [chromium, webkit]) test(`PN classroom controls, polarity and equilibrium (${engine.name()})`, { timeout: 120000 }, async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await engine.launch(engine === chromium ? { channel: 'msedge' } : {});
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin + '/experiments/pn-junction.html');
    await page.waitForFunction(() => window.__PHYS__?.getPH());
    const voltage = async value => page.locator('#slider-voltage').evaluate((el, v) => {
      el.value = v; el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    const text = id => page.locator('#' + id).textContent();
    assert.equal(await page.locator('#measurement-details').getAttribute('open'), null);
    assert.doesNotMatch(await text('voltage-positive'), /순방향/);
    assert.match(await text('direction-electron'), /왼쪽 ← 오른쪽/);
    await voltage(-.5);
    assert.match(await text('direction-electron'), /왼쪽 → 오른쪽/);
    await page.locator('#btn-n-type').click();
    assert.doesNotMatch(await text('voltage-negative'), /역방향/);
    assert.equal(await page.locator('#region-p').isVisible(), false);
    await page.locator('#show-directions').uncheck();
    await page.locator('#measurement-details summary').click();
    await page.locator('#btn-pn-junction').click();
    assert.equal(await page.locator('#direction-strip').isVisible(), false);
    assert.notEqual(await page.locator('#measurement-details').getAttribute('open'), null);
    await page.locator('#btn-join-action').click();
    await page.waitForFunction(() => depletionProgress === 1);
    await page.waitForFunction(() => Math.abs(RX.barrier - PH.barrier) < 1e-6);
    const eq = await page.evaluate(() => ({
      I: PH.I, width: PH.Wcm, p: textbookJunctionPotentialAt(0), n: textbookJunctionPotentialAt(1),
      efP: -textbookJunctionPotentialAt(0) - PH.Eg / 2 + PH.dEfP,
      efN: -textbookJunctionPotentialAt(1) + PH.Eg / 2 - PH.dEfN
    }));
    assert.equal(eq.I, 0); assert.ok(eq.n > eq.p);
    assert.ok(Math.abs(eq.efP - eq.efN) < 1e-6, 'equilibrium Fermi energy is flat');
    assert.match(await text('direction-current'), /순전류 0/);
    await page.locator('#show-directions').check();

    // Verify the actual painted battery: long + plate, short − plate and connected leads.
    for (const value of [.8, -1]) {
      await voltage(value);
      const drawing = await page.evaluate(() => {
        const lines = [], labels = [], ctx = ctxLattice, saved = {}, segments = [];
        for (const name of ['moveTo', 'lineTo', 'fillText']) saved[name] = ctx[name];
        let previous;
        ctx.moveTo = (x,y) => { previous = [x,y]; };
        ctx.lineTo = (x,y) => { if (previous) segments.push([...previous,x,y]); previous = [x,y]; };
        ctx.fillText = (s,x,y) => labels.push([s,x,y]);
        try { drawWire(ctx); } finally { Object.assign(ctx, saved); }
        return { segments, labels, I: PH.I, width: PH.Wcm };
      });
      const plusX = value > 0 ? 538 : 562, minusX = value > 0 ? 562 : 538;
      assert.ok(drawing.segments.some(([x,y,x2,y2]) => x === plusX && x2 === plusX && y2-y === 44));
      assert.ok(drawing.segments.some(([x,y,x2,y2]) => x === minusX && x2 === minusX && y2-y === 16));
      assert.ok(drawing.segments.some(([x,y,x2,y2]) => x2 === 538 && y2 === 28 && y === 28));
      assert.ok(drawing.segments.some(([x,y,x2,y2]) => x === 562 && y === 28 && y2 === 28));
      assert.ok(value > 0 ? drawing.width < eq.width && drawing.I > 0 : drawing.width > eq.width && drawing.I < 0);
      assert.match(await text('direction-electron'), value > 0 ? /P형 ← N형/ : /P형 → N형/);
      assert.match(await text('connection-summary'), value > 0 ? /P형에 \+극/ : /P형에 −극/);
    }
    await page.locator('#canvas-tab-energy').click();
    assert.equal(await page.locator('#show-band-details').isChecked(), false);
    await page.locator('#show-band-details').check();
    await voltage(0);
    assert.equal(await page.evaluate(() => showBandDetails), true);
    await page.locator('#measurement-details summary').click();
    for (const [width, height] of [[1366,900], [390,844], [320,568]]) {
      await page.setViewportSize({width,height});
      for (const tab of ['lattice','energy','potential']) {
        await page.locator('#canvas-tab-' + tab).click();
        await page.waitForTimeout(150);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
        const box = await page.locator('#' + tab + '-canvas').boundingBox();
        assert.ok(box.width > 100 && box.height > 50, 'visible diagram');
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
