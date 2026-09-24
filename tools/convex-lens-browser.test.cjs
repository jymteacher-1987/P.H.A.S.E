const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const html = fs.readFileSync(path.join(__dirname, '../experiments/convex-lens-focus.html'), 'utf8');
const close = (actual, expected, label) => assert.ok(Math.abs(actual-expected)<1e-8,
  `${label}: ${actual} != ${expected}`);

for (const engine of [chromium, webkit]) {
  test(`convex lens image direction and focal boundary (${engine.name()})`, {timeout:60000}, async t => {
    const browser = await engine.launch({headless:true});
    t.after(() => browser.close());
    const page = await browser.newPage({viewport:{width:1280,height:900}});
    const errors=[];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().resourceType()==='document'
      ? route.fulfill({contentType:'text/html; charset=utf-8',body:html}) : route.abort());
    await page.goto('https://phase-lens.test/');
    await page.locator('[data-mode=measure]').click();

    await t.test('the painted real image points down at its calculated image height', async () => {
      for (const width of [390,1280]) {
        await page.setViewportSize({width,height:900});
        for (const lens of [0,1]) for (const multiple of [1.5,2,3]) {
          await page.locator(`#lensSeg button[data-lens="${lens}"]`).click();
          const result = await page.evaluate(multiple => {
            const f=LENSES[curLens].f;
            state.do=f*multiple; state.ds=imageDistance(state.do,f);
            const triangles=[], saved={}; let points=[];
            for (const method of ['beginPath','moveTo','lineTo','fill']) {
              saved[method]=sctx[method];
              sctx[method]=function(...args){
                if(method==='beginPath') points=[];
                if(method==='moveTo'||method==='lineTo') points.push(args);
                if(method==='fill'&&points.length===3) triangles.push(points.slice());
                return saved[method].apply(this,args);
              };
            }
            try {draw();} finally {Object.assign(sctx,saved);}
            return {f,objectDistance:state.do,screenDistance:state.ds,scale:SCALE,axisY:wy(0),
              screenX:wx(state.ds),triangle:triangles.at(-1),
              readout:document.getElementById('rdImg').textContent,
              recordDisabled:document.getElementById('btnMeasure').disabled};
          }, multiple);
          const expectedDistance=result.f*result.objectDistance/(result.objectDistance-result.f);
          const expectedHeight=-3.2*expectedDistance/result.objectDistance;
          close(result.screenDistance,expectedDistance,'thin-lens image position');
          const [tip,left,right]=result.triangle;
          close(tip[0],result.screenX,'arrow tip is on the screen');
          close(tip[1],result.axisY-expectedHeight*result.scale,'inverted image height');
          assert.ok(tip[1]>result.axisY,'the real image is below the optical axis');
          assert.ok(left[1]<tip[1]&&right[1]<tip[1],
            `the arrowhead base must be above its downward-pointing tip: ${JSON.stringify(result.triangle)}`);
          assert.match(result.readout,/실상·도립/);
          assert.ok(result.readout.includes((expectedDistance/result.objectDistance).toFixed(2)+'배'));
          assert.equal(result.recordDisabled,false,'an in-focus real image can be recorded');
        }
      }
    });

    await t.test('dragging the object onto either focus describes the equality case', async () => {
      await page.setViewportSize({width:1280,height:900});
      for (const lens of [0,1]) {
        await page.locator(`#lensSeg button[data-lens="${lens}"]`).click();
        for (const factor of [1,0.5]) {
          const point=await page.evaluate(factor => {
            const rect=stage.getBoundingClientRect();
            return {from:rect.left+wx(-state.do),to:rect.left+wx(-LENSES[curLens].f*factor),
              y:rect.top+AXIS_Y};
          },factor);
          await page.mouse.move(point.from,point.y);await page.mouse.down();
          // Keep the exact focal boundary: WebKit rounds native mouse coordinates
          // to whole pixels, which can skip a 0.1 cm value on the scaled drawing.
          await page.locator('#stage').dispatchEvent('pointermove',
            {clientX:point.to,clientY:point.y,pointerId:1,buttons:1});
          await page.mouse.up();
          const result=await page.evaluate(() => ({object:state.do,f:LENSES[curLens].f,
            di:imageDistance(state.do,LENSES[curLens].f),hint:document.getElementById('measureHint').textContent,
            disabled:document.getElementById('btnMeasure').disabled}));
          close(result.object,result.f*factor,'dragged object distance');
          assert.equal(result.disabled,true,'a virtual image or parallel outgoing rays cannot be recorded on the screen');
          if(factor===1){
            assert.equal(result.di,Infinity);
            assert.match(result.hint,/초점에\s*있/,'the explanation must include an object exactly at the focus');
          }else assert.ok(result.di<0,'an object inside the focus forms a virtual image');
        }
      }
    });
    assert.deepEqual(errors,[]);
  });
}
