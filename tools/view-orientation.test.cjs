const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium, webkit, devices } = require('playwright');
const root = path.resolve(__dirname, '..');

async function serverForTest() {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
    res.setHeader('Content-Type', ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp' })[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, base:'http://127.0.0.1:' + server.address().port };
}
async function isolate(context, base, native = false, realFullscreen = false) {
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/firebase-config.js')) return route.fulfill({ contentType:'text/javascript', body:'window.FIREBASE_CONFIG={};' });
    return url.origin === base && route.request().method() === 'GET' ? route.continue() : route.abort();
  });
  await context.addInitScript(({ native, realFullscreen }) => {
    sessionStorage.setItem('visit_counted', '1');
    window.orientationRequests = []; window.orientationUnlocks = 0; window.fullscreenRequests = 0;
    const orientation = screen.orientation || {};
    if (!screen.orientation) Object.defineProperty(screen, 'orientation', { configurable:true, value:orientation });
    Object.defineProperty(orientation, 'lock', { configurable:true, value:target => {
      window.orientationRequests.push(target);
      return native ? Promise.resolve() : Promise.reject(new DOMException('Test: unavailable', 'NotSupportedError'));
    }});
    Object.defineProperty(orientation, 'unlock', { configurable:true, value:() => { window.orientationUnlocks++; }});
    if (realFullscreen) return;
    Element.prototype.requestFullscreen = function () {
      window.fullscreenRequests++;
      if (!native) return Promise.reject(new DOMException('Test: denied', 'NotAllowedError'));
      Object.defineProperty(document, 'fullscreenElement', { configurable:true, get:() => document.documentElement });
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    };
    document.exitFullscreen = () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable:true, get:() => null });
      document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve();
    };
  }, { native, realFullscreen });
}
async function activity(viewer) {
  await viewer.waitForFunction(() => document.getElementById('expFrame')?.contentDocument?.getElementById('l3-push'));
  return (await viewer.locator('#expFrame').elementHandle()).contentFrame();
}
async function assertLayout(viewer, landscape) {
  await viewer.waitForFunction(landscape => {
    const frame = document.getElementById('expFrame');
    const r=frame.getBoundingClientRect();
    return (frame.clientWidth > frame.clientHeight) === landscape && r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;
  }, landscape);
  const m = await viewer.evaluate(() => {
    const frame = document.getElementById('expFrame').getBoundingClientRect();
    const tools = document.querySelector('.viewer-tools').getBoundingClientRect();
    const button = document.getElementById('viewerOrientationToggle'), r = button.getBoundingClientRect();
    const within = b => b.left >= -1 && b.top >= -1 && b.right <= innerWidth+1 && b.bottom <= innerHeight+1;
    return { inside:within(frame)&&within(r), separate:Math.min(frame.right,tools.right)-Math.max(frame.left,tools.left)<=1 || Math.min(frame.bottom,tools.bottom)-Math.max(frame.top,tools.top)<=1, label:button.textContent.trim() };
  });
  assert.equal(m.inside, true); assert.equal(m.separate, true);
  assert.equal(m.label, landscape ? '세로 보기' : '가로 보기');
}

test('Phone rotation fallback keeps inputs, guide and portrait return usable without native permissions', { timeout:120000 }, async () => {
  const { server, base } = await serverForTest();
  try {
    for (const engine of [chromium, webkit]) {
      const browser = await engine.launch({ headless:true, ...(engine === chromium && process.env.PREVIEW_BROWSER_CHANNEL ? { channel:process.env.PREVIEW_BROWSER_CHANNEL } : {}) });
      try {
        const context = await browser.newContext({ ...devices['iPhone SE'], viewport:{ width:360, height:740 } });
        await isolate(context, base); const page = await context.newPage();
        await page.goto(base + '/view.html?id=newton-laws'); const frame = await activity(page);
        await assertLayout(page, false);
        await page.locator('#viewerOrientationToggle').tap(); await assertLayout(page, true);
        assert.equal(await page.locator('body').evaluate(el => el.classList.contains('viewer-rotated')), true);
        await frame.locator('[data-tab=law3]').tap();
        const slider = frame.locator('#l3-mA'); await slider.scrollIntoViewIfNeeded();
        const sliderBox = await slider.boundingBox();
        // The physical long axis is vertical after a 90-degree iframe rotation.
        await page.touchscreen.tap(sliderBox.x+sliderBox.width/2,sliderBox.y+sliderBox.height-3);
        assert.equal(await slider.inputValue(), '8'); assert.equal(await frame.locator('#l3-mAval').textContent(), '8');
        await frame.locator('#l3-push').scrollIntoViewIfNeeded(); await frame.locator('#l3-push').dispatchEvent('mousedown');
        await page.waitForTimeout(100); assert.equal(await frame.locator('#l3-push').evaluate(el=>el.classList.contains('active')), true);
        await frame.locator('#l3-push').dispatchEvent('mouseup');
        await page.locator('#viewerNoteToggle').tap();
        const bounds = await page.locator('#viewerNotePanel').evaluate(el => { const r=el.getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1; });
        assert.equal(bounds, true); await page.locator('#viewerNoteClose').tap();
        await page.setViewportSize({ width:740, height:360 }); await assertLayout(page, true);
        assert.equal(await page.locator('body').evaluate(el => el.classList.contains('viewer-rotated')), false);
        await page.locator('#viewerOrientationToggle').tap(); await assertLayout(page, false);
        assert.equal(await page.locator('body').evaluate(el => el.classList.contains('viewer-rotated')), true);
        await page.setViewportSize({ width:360, height:740 }); await assertLayout(page, false);
        assert.equal(await page.locator('body').evaluate(el => el.classList.contains('viewer-rotated')), false);
        for (const size of [{width:320,height:460},{width:412,height:915}]) {
          await page.setViewportSize(size); await page.locator('#viewerOrientationToggle').tap(); await assertLayout(page, true);
          await page.locator('#viewerOrientationToggle').tap(); await assertLayout(page, false);
        }
        await context.close();
      } finally { await browser.close(); }
    }
  } finally { await new Promise(r=>server.close(r)); }
});

test('Nested viewer locks the fullscreen owner, releases on Back, and remains absent on desktop', { timeout:120000 }, async () => {
  const { server, base } = await serverForTest();
  const browser = await chromium.launch({ headless:true, ...(process.env.PREVIEW_BROWSER_CHANNEL ? { channel:process.env.PREVIEW_BROWSER_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ ...devices['iPhone SE'], viewport:{width:360,height:740} });
    await isolate(context, base, true); const page = await context.newPage();
    await page.goto(base+'/lab.html'); const link=page.locator('a[href*="id=newton-laws"]').first(); await link.tap();
    const viewer=await(await page.locator('.mobile-activity-frame').elementHandle()).contentFrame(); await activity(viewer);
    await viewer.locator('#viewerOrientationToggle').tap(); await assertLayout(viewer,true);
    await page.waitForFunction(()=>orientationRequests.includes('landscape'));
    assert.equal(await page.evaluate(()=>fullscreenRequests),1);
    assert.equal(await viewer.evaluate(()=>fullscreenRequests),0);
    await page.setViewportSize({width:740,height:360}); await assertLayout(viewer,true);
    assert.equal(await viewer.locator('body').evaluate(el=>el.classList.contains('viewer-rotated')),false);
    await viewer.locator('#viewerOrientationToggle').tap(); await page.waitForFunction(()=>orientationRequests.includes('portrait'));
    await page.setViewportSize({width:360,height:740}); await assertLayout(viewer,false);
    await page.goBack(); assert.equal(await page.locator('.mobile-activity-frame').count(),0);
    assert.ok(await page.evaluate(()=>orientationUnlocks>0));
    await context.close();
    const desktop=await browser.newContext({viewport:{width:360,height:740},hasTouch:true});await isolate(desktop,base);
    const desktopPage=await desktop.newPage();await desktopPage.goto(base+'/view.html?id=newton-laws');await activity(desktopPage);
    assert.equal(await desktopPage.locator('#viewerOrientationToggle').isVisible(),false);await desktop.close();
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
});

test('Both direction toggles retain real fullscreen, including an activity fullscreen button', { timeout:90000 }, async () => {
  const { server, base } = await serverForTest();
  const browser = await chromium.launch({ headless:true, ...(process.env.PREVIEW_BROWSER_CHANNEL ? { channel:process.env.PREVIEW_BROWSER_CHANNEL } : {}) });
  try {
    for (const id of ['newton-laws','ideal-gas-law']) {
      const context = await browser.newContext({ ...devices['Pixel 7'], viewport:{width:360,height:740} });
      await isolate(context,base,false,true);const page=await context.newPage();
      await page.goto(base+'/view.html?id='+id);
      await page.waitForFunction(()=>document.getElementById('expFrame')?.contentDocument?.readyState==='complete');
      await page.locator('#viewerOrientationToggle').tap();
      await page.waitForFunction(()=>document.fullscreenElement===document.documentElement);await assertLayout(page,true);
      if(id==='ideal-gas-law'){
        const frame=await(await page.locator('#expFrame').elementHandle()).contentFrame();
        await frame.locator('#bFs').tap();
        await page.waitForFunction(()=>document.fullscreenElement===document.documentElement && !document.getElementById('expFrame').contentDocument.fullscreenElement);
        await assertLayout(page,true);
      }
      await page.locator('#viewerOrientationToggle').tap();await assertLayout(page,false);
      assert.equal(await page.evaluate(()=>document.fullscreenElement===document.documentElement),true);
      if(id==='ideal-gas-law'){
        const frame=await(await page.locator('#expFrame').elementHandle()).contentFrame();await frame.locator('#bFs').tap();
        await page.waitForFunction(()=>document.fullscreenElement===document.documentElement && !document.getElementById('expFrame').contentDocument.fullscreenElement);
        await assertLayout(page,false);
      }
      await page.locator('#viewerOrientationToggle').tap();await assertLayout(page,true);
      assert.equal(await page.evaluate(()=>document.fullscreenElement===document.documentElement),true);
      await page.evaluate(()=>document.exitFullscreen());await assertLayout(page,false);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(r=>server.close(r)); }
});
