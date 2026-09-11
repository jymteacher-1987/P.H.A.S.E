const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, devices } = require('playwright');
const root = path.resolve(__dirname, '..');

test('Static catalog images, device-specific launch, direct entry and browser Back', { timeout: 120000 }, async () => {
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '');
    const file = path.resolve(root, relative || 'index.html');
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.webp': 'image/webp' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PREVIEW_BROWSER_CHANNEL ? { channel: process.env.PREVIEW_BROWSER_CHANNEL } : {}) });
    for (const [name, options, immersive] of [
      ['narrow desktop', { viewport: { width: 320, height: 460 } }, false],
      ['touch laptop', { viewport: { width: 640, height: 480 }, hasTouch: true }, false],
      ['iPhone SE', { ...devices['iPhone SE'], viewport: { width: 320, height: 460 } }, true],
      ['iPad landscape', { ...devices['iPad Pro 11 landscape'] }, true]
    ]) {
      const context = await browser.newContext(options);
      try {
        // Tests neither need nor update visitor counters or external services.
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (url.pathname.endsWith('/firebase-config.js')) return route.fulfill({ contentType: 'text/javascript', body: 'window.FIREBASE_CONFIG = {};' });
          if (url.origin !== origin) return route.abort();
          return route.continue();
        });
        await context.addInitScript(() => {
          window.fullscreenCalls = 0;
          Element.prototype.requestFullscreen = function () {
            window.fullscreenCalls++;
            Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => document.documentElement });
            return Promise.resolve();
          };
          document.exitFullscreen = () => { Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => null }); return Promise.resolve(); };
        });
        const page = await context.newPage();
        const requests = [], errors = [];
        page.on('request', request => requests.push(request.url()));
        page.on('pageerror', error => errors.push(error.message));
        for (const [query, count] of [['', 20], ['?play=all', 6]]) {
          requests.length = 0;
          await page.goto(origin + '/lab.html' + query);
          await page.waitForFunction(count => document.querySelectorAll('.exp-preview img').length === count, count);
          const images = page.locator('.exp-preview img');
          for (let i = 0; i < count; i++) {
            await images.nth(i).scrollIntoViewIfNeeded();
            await images.nth(i).evaluate(image => image.decode());
          }
          assert.equal(await page.locator('iframe').count(), 0, name + ' has no live preview documents');
          assert.equal(requests.some(url => /\/(experiments|plays)\/.+\.html/.test(url)), false, 'Catalog must not request activity HTML');
          assert.equal(await page.locator('.preview-unavailable').count(), 0);
        }
        await page.locator('.exp-card').filter({ has: page.locator('h3', { hasText: '한붓' }) }).click();
        await page.waitForURL('**/view.html?id=hanbut&src=play');
        if (immersive) {
          assert.equal(await page.locator('.mobile-activity-layer').count(), 1, name);
          assert.equal(await page.evaluate(() => window.fullscreenCalls), 1, name + ' requests fullscreen on card tap');
          await page.goBack();
          assert.equal(await page.locator('.mobile-activity-layer').count(), 0, name + ' exits on browser Back');
          assert.equal(await page.locator('.exp-preview img').count(), 6);
        } else {
          assert.equal(await page.locator('.mobile-activity-layer').count(), 0, name);
          assert.equal(await page.evaluate(() => window.fullscreenCalls), 0, name + ' remains windowed');
        }
        // A direct shared link must apply the same hardware rule.
        await page.goto(origin + '/view.html?id=hanbut&src=play');
        await page.waitForFunction(() => document.querySelector('#expFrame').contentDocument?.querySelector('#undo-line'));
        const navVisible = await page.locator('.site-nav').isVisible();
        assert.equal(navVisible, !immersive, name + ' viewer navigation');
        await page.frameLocator('#expFrame').locator('h1').click();
        assert.equal(await page.evaluate(() => window.fullscreenCalls), immersive ? 1 : 0, name + ' direct-entry first tap');
        assert.deepEqual(errors, [], name + ' page errors');
      } finally { await context.close(); }
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
