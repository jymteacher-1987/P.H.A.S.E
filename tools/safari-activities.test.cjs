/* WebKit + small iPhone viewports. This is not a physical iPhone/Safari test. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { webkit, devices } = require('playwright');
const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/experiments.json'), 'utf8'));
const resultsDir = path.join(root, '.preview-tmp/safari');

async function reachable(locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  const hit = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return !element.disabled && rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.right <= innerWidth + 1
      && rect.top >= -1 && rect.bottom <= innerHeight + 1 && (target === element || element.contains(target));
  });
  assert.ok(hit, label + ': button is clipped, covered or disabled');
}

test('WebKit: all activities on small iPhone screens, older APIs, game start and rotation', { timeout: 600000 }, async t => {
  const server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' };
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  fs.mkdirSync(resultsDir, { recursive: true });
  let browser;
  try {
    browser = await webkit.launch({ headless: true });
    for (const entry of [...catalog.plays, ...catalog.experiments]) {
      if (process.env.SAFARI_ONLY && !process.env.SAFARI_ONLY.split(',').includes(entry.id)) continue;
      await t.test(entry.id, { timeout: 60000 }, async () => {
        const context = await browser.newContext({ ...devices['iPhone SE'], viewport: { width: 320, height: 460 }, deviceScaleFactor: 1, locale: 'ko-KR', colorScheme: 'light', serviceWorkers: 'block' });
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await context.route('**/*', route => {
            const req = route.request(), url = new URL(req.url());
            if (url.pathname.endsWith('/firebase-config.js')) return route.fulfill({ contentType: 'text/javascript', body: 'window.FIREBASE_CONFIG = {};' });
            if (req.method() === 'GET' && (url.origin === origin || ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'].includes(url.hostname))) return route.continue();
            return route.abort();
          });
          await context.addInitScript(id => {
            // Exercise fallbacks for APIs absent from older iOS releases.
            delete CanvasRenderingContext2D.prototype.roundRect;
            if (window.Path2D) delete Path2D.prototype.roundRect;
            window.OffscreenCanvas = undefined;
            window.DecompressionStream = undefined;
            window.createImageBitmap = () => Promise.reject(new Error('Test: image bitmap unavailable'));
            sessionStorage.setItem('visit_counted', '1');
            if (id === 'giants-shoulders') {
              Element.prototype.requestFullscreen = undefined;
              Element.prototype.webkitRequestFullscreen = undefined;
            }
          }, entry.id);
          await page.goto(origin + '/view.html?id=' + encodeURIComponent(entry.id), { waitUntil: 'load', timeout: 40000 });
          await page.waitForFunction(id => {
            const frame = document.querySelector('#expFrame');
            return frame?.contentDocument?.body?.textContent.trim().length > 20 && frame.src.includes(id);
          }, entry.id);
          const frame = page.frames().find(frame => /\/(plays|experiments)\/.+\.html/.test(frame.url()));
          assert.ok(frame, 'Activity document was not loaded');
          await frame.evaluate(() => Promise.race([
            Promise.all([document.fonts.ready, ...Array.from(document.images, image => image.decode().catch(() => {}))]),
            new Promise(resolve => setTimeout(resolve, 8000))
          ]));
          await page.waitForTimeout(900);
          const rotationNotice = frame.locator('#rotate, #rotateOverlay');
          const needsLandscape = await rotationNotice.count() > 0 && await rotationNotice.first().isVisible();
          if (needsLandscape) {
            assert.match(await rotationNotice.first().innerText(), /가로|돌려/, 'Portrait must explain how to enter the landscape activity');
            await page.setViewportSize({ width: 568, height: 260 });
            await page.waitForTimeout(250);
            assert.equal(await rotationNotice.first().isVisible(), false, 'Rotation notice must clear when the phone is turned');
          }
          if (entry.id === 'giants-shoulders') {
            assert.ok(await frame.locator('#app').evaluate(app => app.classList.contains('expanded-screen')), 'Phone must expand without the Fullscreen API');
            await frame.locator('.giants-screen-restore').tap();
            assert.equal(await frame.locator('#app').evaluate(app => app.classList.contains('expanded-screen')), false);
            await frame.locator('#fullscreenButton').tap();
            assert.ok(await frame.locator('#app').evaluate(app => app.classList.contains('expanded-screen')), '크게 보기 must work even when native fullscreen is unavailable');
          }
          if (entry.id === 'newton-rush' || entry.id === 'physics-fighter' || entry.id === 'giants-shoulders') {
            const selector = { 'newton-rush': '#start', 'physics-fighter': '#startBtn', 'giants-shoulders': '[data-do=new]' }[entry.id];
            const start = frame.locator(selector);
            // Loading must finish without requiring a first keyboard/mouse action.
            await frame.waitForFunction(selector => !document.querySelector(selector)?.disabled, selector);
            for (const [width, height] of [[320, 460], [568, 260], [568, 210], [375, 550], [667, 310], [320, 460]]) {
              if (height === 210 && entry.id !== 'giants-shoulders') continue;
              if (needsLandscape && height > width) continue;
              await page.setViewportSize({ width, height });
              await page.waitForTimeout(150);
              const bounds = await page.locator('#expFrame').boundingBox();
              assert.ok(Math.abs(bounds.width - width) <= 1 && Math.abs(bounds.height - height) <= 1, 'Viewer must fill the visible screen');
              await reachable(start, entry.id + ' ' + width + '×' + height);
              if (entry.id === 'giants-shoulders' && height === 210 && process.env.SAFARI_SCREENSHOTS === '1') {
                await page.screenshot({ path: path.join(resultsDir, 'giants-se-address-bar-start.png') });
              }
            }
            await start.tap();
            await page.waitForTimeout(500);
            if (entry.id === 'newton-rush') {
              assert.equal(await frame.locator('body').getAttribute('data-mode'), 'running');
              await reachable(frame.locator('#jump'), 'Jump control');
              await frame.locator('#jump').tap();
            }
            if (entry.id === 'physics-fighter') assert.equal(await frame.locator('#fightScreen').isVisible(), true);
            if (entry.id === 'giants-shoulders') assert.equal(await frame.locator('[data-do=new]').count(), 0);
          }
          if (entry.id === 'hero-maker') {
            const normalized = await frame.evaluate(async () => {
              const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30;
              canvas.getContext('2d').fillRect(0, 0, 40, 30);
              const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
              return normalizePhotoFile(new File([blob], 'test.png', { type: 'image/png' }));
            });
            assert.ok(normalized.startsWith('data:image/jpeg;base64,'), 'Photo fallback failed');
          }
          if (entry.id === 'newton-laws') {
            for (const [tab, button] of [['law1', '#l1-push'], ['law2', '#l2-go'], ['law3', '#l3-push']]) {
              await frame.locator('[data-tab=' + tab + ']').tap();
              for (const [width, height] of [[320, 460], [568, 260]]) {
                await page.setViewportSize({ width, height });
                await page.waitForTimeout(180);
                const bounds = await frame.locator('#' + tab + ' canvas').boundingBox();
                assert.ok(bounds.height >= 140, tab + ': drawing space must not collapse');
                await frame.locator(button).tap();
              }
            }
          }
          if (entry.path.startsWith('experiments/')) {
            // Exercise a visible start/play button and one setting, when present.
            const controls = frame.locator('button');
            for (let i = 0; i < await controls.count(); i++) {
              const button = controls.nth(i);
              if (/시작|재생|▶/.test(await button.innerText()) && await button.isVisible() && await button.isEnabled()) {
                await button.tap(); break;
              }
            }
            const range = frame.locator('input[type=range]').first();
            if (await range.count()) await range.evaluate(input => { input.value = String((Number(input.min) + Number(input.max)) / 2); input.dispatchEvent(new Event('input', { bubbles: true })); });
          }
          for (const [width, height] of [[320, 460], [568, 260]]) {
            await page.setViewportSize({ width, height });
            await page.waitForTimeout(350);
            if (needsLandscape && height > width) { assert.equal(await rotationNotice.first().isVisible(), true); continue; }
            const drawing = await frame.evaluate(() => {
              const canvases = Array.from(document.querySelectorAll('canvas')).filter(c => c.getBoundingClientRect().width > 0);
              return !canvases.length || canvases.some(c => c.width > 0 && c.height > 0 && c.getBoundingClientRect().height > 16);
            });
            assert.ok(drawing, 'Activity canvas collapsed after rotation');
          }
          assert.deepEqual(errors, [], 'JavaScript errors');
          if (process.env.SAFARI_SCREENSHOTS === '1') await page.screenshot({ path: path.join(resultsDir, entry.id + '-passed.png') });
        } catch (error) {
          await page.screenshot({ path: path.join(resultsDir, entry.id + '.png') }).catch(() => {});
          fs.writeFileSync(path.join(resultsDir, entry.id + '.txt'), String(error.stack || error) + '\n' + errors.join('\n'));
          throw error;
        } finally { await context.close(); }
      });
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
