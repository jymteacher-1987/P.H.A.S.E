const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/experiments.json'), 'utf8'));

test('Desktop category and game choosers collapse after selection; mobile keeps horizontal menus', { timeout: 60000 }, async () => {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html');
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/firebase-config.js')) return route.fulfill({ contentType: 'text/javascript', body: 'window.FIREBASE_CONFIG = {};' });
      return url.origin === origin ? route.continue() : route.abort();
    });
    await page.goto(origin + '/lab.html');
    const toggle = page.locator('[data-menu="play"] .side-menu-toggle'), row = page.locator('#playMenuRows'),
      labToggle = page.locator('[data-menu="lab"] .side-menu-toggle'), labRow = page.locator('#labMenuRows');
    await toggle.waitFor();
    assert.equal(await row.isVisible(), false);
    assert.equal(await labRow.isVisible(), false);
    assert.equal(await page.locator('.exp-card').count(), catalog.experiments.length, 'Physics defaults to all experiments');
    assert.equal(await page.locator('[data-menu="lab"] .side-menu-current').textContent(), '전체');
    assert.equal(await page.locator('[data-section="lab"]').count(), catalog.categories.length + 1);
    await labToggle.click();
    assert.equal(await labRow.isVisible(), true);
    await page.locator('[data-section="lab"][data-cat="electromagnetism"]').click();
    assert.equal(await labRow.isVisible(), false);
    assert.equal(await page.locator('[data-menu="lab"] .side-menu-current').textContent(), '전자기학');
    assert.equal(await page.locator('.exp-card').count(), catalog.experiments.filter(e => e.category === 'electromagnetism').length);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => scrollY > 100);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    const metrics = await row.evaluate(el => ({ client: el.clientHeight, scroll: el.scrollHeight, bottom: el.getBoundingClientRect().bottom, viewport: innerHeight }));
    assert.ok(metrics.scroll > metrics.client, 'Desktop list scrolls within its own box');
    assert.ok(metrics.bottom <= metrics.viewport, 'The expanded list fits below the collapsed physics chooser');
    await row.evaluate(el => el.scrollTop = el.scrollHeight);
    const last = catalog.plays.at(-1), lastButton = page.locator('[data-section="play"][data-cat="' + last.id + '"]');
    await lastButton.click();
    await page.waitForFunction(() => document.querySelectorAll('.exp-card').length === 1);
    await page.waitForFunction(() => {
      const preview = document.querySelector('.exp-preview').getBoundingClientRect();
      return preview.top >= Math.max(0, document.querySelector('.site-nav').getBoundingClientRect().bottom) && preview.bottom < innerHeight;
    });
    assert.equal(await page.locator('.exp-card h3').textContent(), last.title);
    assert.equal(await page.locator('[data-menu="play"] .side-menu-current').textContent(), last.title);
    assert.equal(await row.isVisible(), false, 'A selected game closes the desktop list');
    assert.equal(await lastButton.getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('.site-nav').evaluate(el => Math.abs(el.getBoundingClientRect().top) < 1), 'Desktop header stays visible while choosing a game');
    const out = path.join(root, '.preview-tmp', 'sidebar');
    fs.mkdirSync(out, { recursive: true });
    await page.locator('.exp-preview img').evaluate(img => img.decode());
    await page.screenshot({ path: path.join(out, 'desktop-last-game.png'), animations: 'disabled' });
    await toggle.click();
    await row.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.screenshot({ path: path.join(out, 'desktop-expanded.png'), animations: 'disabled' });

    // A shorter window still exposes the last entry and returns to the preview.
    await page.setViewportSize({ width: 1024, height: 600 });
    await row.evaluate(el => el.scrollTop = 0);
    await page.locator('[data-section="play"][data-cat="all"]').click();
    await page.waitForFunction(count => document.querySelectorAll('.exp-card').length === count, catalog.plays.length);
    await toggle.click();
    await row.evaluate(el => el.scrollTop = el.scrollHeight);
    await lastButton.click();
    await page.waitForFunction(() => document.querySelector('.exp-preview').getBoundingClientRect().top >= Math.max(0, document.querySelector('.site-nav').getBoundingClientRect().bottom));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + '/lab.html');
    await row.waitFor();
    assert.equal(await toggle.isVisible(), false);
    assert.equal(await labToggle.isVisible(), false);
    assert.equal(await labRow.isVisible(), true);
    const mobile = await row.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, height: el.clientHeight }));
    assert.ok(mobile.scroll > mobile.width && mobile.height < 90, 'Phone remains a single horizontal strip');
    await row.scrollIntoViewIfNeeded();
    await row.evaluate(el => { window.originalPlayRow = el; el.scrollLeft = el.scrollWidth; });
    await lastButton.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => ({ y: scrollY, x: originalPlayRow.scrollLeft }));
    await lastButton.click();
    await page.waitForFunction(() => document.querySelectorAll('.exp-card').length === 1);
    const after = await page.evaluate(() => ({ y: scrollY, x: originalPlayRow.scrollLeft, same: originalPlayRow === document.querySelector('#playMenuRows') }));
    assert.equal(after.same, true, 'Filtering preserves the scroll container');
    assert.ok(Math.abs(after.x - before.x) < 2, 'Phone horizontal selection stays in view');
    assert.ok(Math.abs(after.y - before.y) < 2, 'Phone selection does not move the page');
    await page.locator('.exp-preview img').evaluate(img => img.decode());
    await page.screenshot({ path: path.join(out, 'mobile-last-game.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction(() => document.querySelector('#playMenuRows').hidden);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !document.querySelector('#playMenuRows').hidden);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
