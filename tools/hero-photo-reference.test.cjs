const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const html = fs.readFileSync(path.join(__dirname, '../plays/hero-maker.html'), 'utf8');

for (const engine of [chromium, webkit]) {
  test(`hero photo references require verified crops (${engine.name()})`, {timeout:60000}, async t => {
    const browser = await engine.launch({headless:true});
    t.after(() => browser.close());
    const page = await browser.newPage(), errors = [], remotePosts = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (route.request().method() === 'POST') remotePosts.push(route.request().url());
      return route.request().resourceType() === 'document'
        ? route.fulfill({contentType:'text/html; charset=utf-8', body:html}) : route.abort();
    });
    await page.goto('https://phase-photo-reference.test/');

    await t.test('without detection, both central and off-centre subjects retain the original alone', async () => {
      const results = await page.evaluate(async () => {
        const detector = window.FaceDetector;
        const output = [];
        try {
          window.FaceDetector = undefined;
          for (const x of [40, 520]) {
            const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 800;
            const g = canvas.getContext('2d');
            g.fillStyle = '#abcdef'; g.fillRect(0, 0, 1200, 800);
            g.fillStyle = '#f00000'; g.fillRect(x, 100, 140, 200);
            const original = canvas.toDataURL();
            installPhoto(original);
            state.photoFace = await faceRef(state.photo);
            output.push({crop:state.photoFace, unchanged:state.photo === original,
              refs:photoReferenceParts().map(p => p.image_url.url === original ? 'original' : 'other')});
          }
        } finally {window.FaceDetector = detector;}
        return output;
      });
      for (const result of results) assert.deepEqual(result, {crop:'', unchanged:true, refs:['original']});
    });

    await t.test('single valid detected faces stay inside an undistorted crop, including off-centre positions', async () => {
      const results = await page.evaluate(async () => {
        const detector = window.FaceDetector;
        const originalDraw = CanvasRenderingContext2D.prototype.drawImage;
        const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 800;
        canvas.getContext('2d').fillRect(0, 0, 1200, 800);
        const original = canvas.toDataURL(), output = [];
        try {
          for (const bb of [{x:500,y:230,width:140,height:180}, {x:70,y:190,width:140,height:180},
            {x:960,y:300,width:140,height:180}]) {
            window.FaceDetector = class {async detect() {return [{boundingBox:bb}];}};
            let draw;
            CanvasRenderingContext2D.prototype.drawImage = function(...args) {
              draw = args.slice(1); return originalDraw.apply(this, args);
            };
            const crop = await faceRef(original), image = await loadImageElement(crop);
            installPhoto(original); state.photoFace = crop;
            output.push({bb, draw, dimensions:[image.naturalWidth, image.naturalHeight],
              png:crop.startsWith('data:image/png;'),
              refs:photoReferenceParts().map(p => p.image_url.url === crop ? 'crop' : p.image_url.url === original ? 'original' : 'other')});
          }
        } finally {window.FaceDetector = detector; CanvasRenderingContext2D.prototype.drawImage = originalDraw;}
        return output;
      });
      for (const result of results) {
        const [x, y, width, height, dx, dy, dw, dh] = result.draw, bb = result.bb;
        assert.ok(result.png);
        assert.ok(x <= bb.x && y <= bb.y && x + width >= bb.x + bb.width && y + height >= bb.y + bb.height,
          'the detected subject must remain completely inside the crop');
        assert.ok(x >= 0 && y >= 0 && x + width <= 1200 && y + height <= 800);
        assert.deepEqual([dx, dy], [0, 0]);
        assert.deepEqual([dw, dh], result.dimensions);
        assert.ok(Math.abs(dw / dh - width / height) < .002, 'rounding may not stretch the subject');
        assert.deepEqual(result.refs, ['crop', 'original']);
      }
    });

    await t.test('missing, failed, invalid or ambiguous detection never invents an identity crop', async () => {
      const results = await page.evaluate(async () => {
        const detector = window.FaceDetector;
        const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 800;
        const original = canvas.toDataURL(), bb = {x:200,y:180,width:120,height:160};
        const cases = [null, [], [{boundingBox:bb}, {boundingBox:{...bb, x:800}}], [{}],
          [{boundingBox:{...bb, width:0}}], [{boundingBox:{...bb, height:-1}}],
          [{boundingBox:{...bb, x:NaN}}], [{boundingBox:{...bb, y:Infinity}}],
          [{boundingBox:{...bb, x:-10}}], [{boundingBox:{...bb, x:1150}}],
          [{boundingBox:{...bb, y:750}}], [{boundingBox:{x:0,y:0,width:1200,height:800}}], 'throw'];
        const results = [];
        try {
          for (const faces of cases) {
            window.FaceDetector = class {async detect() {if(faces === 'throw') throw Error('Unavailable'); return faces;}};
            results.push(await faceRef(original));
          }
        } finally {window.FaceDetector = detector;}
        return results;
      });
      assert.equal(results.length, 13);
      assert.ok(results.every(result => result === ''), 'use the original photo when detection cannot support a verified crop');
    });

    await t.test('chat and image-API retries keep every reference and the selected model', async () => {
      const results = await page.evaluate(async () => {
        const savedFetch = orFetch, results = [];
        const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 20;
        const original = canvas.toDataURL();
        canvas.getContext('2d').fillRect(0, 0, 16, 20);
        const crop = canvas.toDataURL();
        try {
          for (const hasCrop of [false, true]) {
            installPhoto(original); state.photoFace = hasCrop ? crop : '';
            state.imageModel = 'google/gemini-3.1-flash-image';
            const calls = [];
            orFetch = async (payload, timeout, url) => {
              const refs = payload.input_references || payload.messages[0].content.filter(p => p.type === 'image_url');
              calls.push({path:url || OR_URL, model:payload.model,
                refs:refs.map(p => p.image_url.url === original ? 'original' : p.image_url.url === crop ? 'crop' : 'other')});
              if (calls.length < 5) {const error = Error('Mock unsupported parameters'); error.status = 400; throw error;}
              return {data:[{b64_json:'LOCAL_TEST_ONLY'}]};
            };
            const image = await askImage('Synthetic reference test; no external requests.');
            results.push({hasCrop, calls, image});
          }
        } finally {orFetch = savedFetch;}
        return results;
      });
      for (const result of results) {
        assert.equal(result.calls.length, 5);
        assert.ok(result.calls[0].path.endsWith('/chat/completions'));
        assert.ok(result.calls.slice(1).every(call => call.path.endsWith('/images')));
        for (const call of result.calls) {
          assert.deepEqual(call.refs, result.hasCrop ? ['crop', 'original'] : ['original']);
          assert.equal(call.model, 'google/gemini-3.1-flash-image');
        }
        assert.equal(result.image, 'data:image/png;base64,LOCAL_TEST_ONLY');
      }
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(remotePosts, [], 'no real image generation request may leave these tests');
  });
}
