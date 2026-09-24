const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const html = fs.readFileSync(path.join(__dirname, '../plays/hero-maker.html'), 'utf8');

for (const engine of [chromium, webkit]) {
  for (const width of [375, 1280]) {
    test(`hero face-treatment choices (${engine.name()}, ${width}px)`, {timeout:60000}, async t => {
      const browser = await engine.launch({headless:true});
      t.after(() => browser.close());
      const page = await browser.newPage({viewport:{width, height:900}}), errors = [], posts = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => {
        if (route.request().method() === 'POST') posts.push(route.request().url());
        return route.request().resourceType() === 'document'
          ? route.fulfill({contentType:'text/html; charset=utf-8', body:html}) : route.abort();
      });
      await page.goto('https://phase-face-treatment.test/');
      // Camera access is unnecessary: uploads and a synthetic video frame exercise both paths.
      await page.evaluate(() => {liveCamBlocked = () => true;});
      const original = page.getByRole('radio', {name:'얼굴 그대로', exact:true});
      const retouch = page.getByRole('radio', {name:'뽀샵화', exact:true});
      const upload = async color => {
        const base64 = await page.evaluate(color => {
          const c = document.createElement('canvas'); c.width = 600; c.height = 750;
          const g = c.getContext('2d'); g.fillStyle = '#eaded2'; g.fillRect(0, 0, 600, 750);
          g.fillStyle = color; g.fillRect(100, 140, 400, 360);
          g.fillStyle = '#382b23'; g.font = '26px sans-serif'; g.textAlign = 'center';
          g.fillText('SYNTHETIC TEST IMAGE', 300, 620);
          return c.toDataURL('image/png').split(',')[1];
        }, color);
        const epoch = await page.evaluate(() => state.photoEpoch);
        await page.locator('#photoPick').setInputFiles({name:'synthetic.png', mimeType:'image/png', buffer:Buffer.from(base64, 'base64')});
        await page.waitForFunction(epoch => state.photoEpoch > epoch + 1 && !!state.photo, epoch);
        await original.waitFor({state:'visible'});
      };
      const noOverflow = async () => {
        const result = await page.evaluate(() => ({
          viewport:innerWidth, document:document.documentElement.scrollWidth,
          controls:[...document.querySelectorAll('.face-treatment-option')].map(el => {
            const r = el.getBoundingClientRect();
            return {left:r.left, right:r.right, width:el.clientWidth, content:el.scrollWidth};
          })
        }));
        assert.ok(result.document <= result.viewport + 1, 'the page must fit the viewport');
        for (const box of result.controls) {
          assert.ok(box.left >= 0 && box.right <= result.viewport + 1);
          assert.ok(box.content <= box.width + 1, 'choice text may wrap without clipping or horizontal scrolling');
        }
      };

      await t.test('initial default, API requirement and photo-free flow stay intact', async () => {
        assert.equal(await page.evaluate(() => state.faceTreatment), 'original');
        await page.locator('#begin').click();
        assert.equal(await page.evaluate(() => state.page), 'intro');
        assert.match(await page.locator('#introStatus').textContent(), /API 키/);
        await page.locator('#key').fill('test-only-no-real-api-key');
        await page.locator('#begin').click();
        assert.equal(await page.evaluate(() => sessionStorage.getItem('or_key')), 'test-only-no-real-api-key');
        assert.equal(await original.count(), 0);
        await page.locator('#noPhoto').click();
        assert.equal(await page.evaluate(() => state.page), 'identity');
        assert.equal(await original.count(), 0);
        await page.locator('#back').click();
      });

      await t.test('upload reveals two accessible, mutually exclusive choices with keyboard support', async () => {
        await upload('#ae8065');
        assert.equal(await original.isChecked(), true);
        assert.equal(await retouch.isChecked(), false);
        assert.equal(await page.getByRole('group', {name:'얼굴 표현', exact:true}).count(), 1);
        assert.equal(await original.getAttribute('aria-describedby'), 'faceOriginalDesc');
        assert.equal(await retouch.getAttribute('aria-describedby'), 'faceRetouchDesc');
        assert.equal(await page.locator('#faceOriginalDesc').textContent(), '얼굴·안경·헤어스타일 모두 원본 유지');
        assert.equal(await page.locator('#faceRetouchDesc').textContent(), '얼굴은 유지하고 안경·헤어스타일만 변형');
        assert.match(await page.locator('#faceTreatmentNote').textContent(), /AI 생성 과정에서 원본과 차이/);
        await original.focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(await retouch.isChecked(), true);
        assert.equal(await original.isChecked(), false);
        assert.equal(await page.evaluate(() => state.faceTreatment), 'retouch');
        await noOverflow();
        const screenshotDir = process.env.HERO_FACE_TREATMENT_SCREENSHOT_DIR;
        if (screenshotDir && engine === chromium) {
          fs.mkdirSync(screenshotDir, {recursive:true});
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({path:path.join(screenshotDir, `hero-face-choice-${width === 375 ? 'mobile' : 'desktop'}.png`), fullPage:true});
        }
      });

      await t.test('identity screen, rerender, replacement and retry preserve the selected treatment', async () => {
        await page.locator('#useShot').click();
        assert.equal(await page.evaluate(() => state.page), 'identity');
        assert.equal(await retouch.isChecked(), true);
        await noOverflow();
        await page.evaluate(() => render());
        assert.equal(await retouch.isChecked(), true);
        await original.check();
        assert.equal(await page.evaluate(() => state.faceTreatment), 'original');
        await page.locator('#back').click();
        assert.equal(await original.isChecked(), true);
        await retouch.check();
        await upload('#6d8b8d');
        assert.equal(await retouch.isChecked(), true);
        await page.locator('#capture').click(); // On a saved photo this means "take again".
        assert.equal(await original.count(), 0);
        assert.equal(await page.evaluate(() => state.photo), '');
        assert.equal(await page.evaluate(() => state.faceTreatment), 'retouch');
        await upload('#816b96');
        assert.equal(await retouch.isChecked(), true);
        await page.locator('#noPhoto').click();
        assert.equal(await original.count(), 0);
        assert.equal(await page.evaluate(() => state.faceTreatment), 'retouch');
      });

      await t.test('a completed live-camera capture also reveals the retained choice', async () => {
        await page.locator('#back').click();
        assert.equal(await original.count(), 0);
        await page.evaluate(async () => {
          const draw = CanvasRenderingContext2D.prototype.drawImage;
          CanvasRenderingContext2D.prototype.drawImage = function(source, ...args) {
            if (source instanceof HTMLVideoElement) {
              this.fillStyle = '#ad8d6c'; this.fillRect(0, 0, this.canvas.width, this.canvas.height);
              return;
            }
            return draw.call(this, source, ...args);
          };
          try {stream = {}; await capture();}
          finally {stream = null; CanvasRenderingContext2D.prototype.drawImage = draw;}
        });
        assert.equal(await retouch.isChecked(), true);
        assert.equal(await page.evaluate(() => !!state.photo), true);
        await noOverflow();
      });
      assert.deepEqual(posts, [], 'no personal photos or paid requests may leave this test');
      assert.deepEqual(errors, []);
    });
  }
}
