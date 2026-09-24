const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright');

const source = fs.readFileSync(path.join(__dirname, '../experiments/electromagnetic-induction.html'), 'utf8');
// Expose the actual model only in the browser response. No physics is reimplemented
// here, and no diagnostic API is added to the published experiment.
const html = source.replace(/\}\)\(\);\r?\n<\/script>/, `
window.__inductionTest = {
  snapshot: () => ({W, xM:state.xM, xC:state.xC, I:state.I,
    paused:state.paused, kind:state.autoRef && state.autoRef.kind}),
  place: (xM,xC) => {state.xM=xM; state.xC=xC; clampPositions(); startAuto(); setPaused(true);},
  placeManual: (xM,xC) => {
    stopAuto(); setPaused(true);
    state.xM=xM; state.xC=xC; clampPositions();
    state.prevXM=state.xM; state.prevXC=state.xC; state.vM=0; state.vC=0;
    skipEmf=false;
  },
  manualStep: (magnetDelta,coilDelta) => {
    state.xM+=magnetDelta; state.xC+=coilDelta; update(1/120);
    return {xM:state.xM,xC:state.xC,I:state.I,emf:state.emfS,lambda:state.lambda};
  },
  readLabels: () => {
    const labels=[], original=ctx.fillText;
    ctx.fillText=function(value,...args){labels.push(String(value)); return original.call(this,value,...args);};
    try {render();} finally {ctx.fillText=original;}
    return labels;
  },
  advance: seconds => {
    setPaused(true);
    const rows=[];
    for(let i=0;i<seconds*120;i++) {update(1/120); rows.push({xM:state.xM,xC:state.xC,I:state.I});}
    const labels=[], original=ctx.fillText;
    ctx.fillText=function(value,...args){labels.push(String(value)); return original.call(this,value,...args);};
    try {render();} finally {ctx.fillText=original;}
    return {rows,labels};
  }
};
})();
</script>`);
assert.notEqual(html, source, 'test probe must attach to the experiment closure');
const close = (a,b,message) => assert.ok(Math.abs(a-b)<1e-9, `${message}: ${a} != ${b}`);

for (const engine of [chromium,webkit]) {
  test(`induction preserves relative motion and responds to mode controls (${engine.name()})`,
    {timeout:120000}, async t => {
      const browser = await engine.launch({headless:true,
        ...(engine===chromium && process.env.PREVIEW_BROWSER_CHANNEL ? {channel:process.env.PREVIEW_BROWSER_CHANNEL} : {})});
      t.after(() => browser.close());
      for (const width of [390,1440]) {
        const page = await browser.newPage({viewport:{width,height:844}});
        const errors=[];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => route.request().resourceType()==='document'
          ? route.fulfill({contentType:'text/html; charset=utf-8',body:html}) : route.abort());
        await page.goto('https://phase-induction.test/');
        await page.locator('input[name=mode][value=both]').check();
        await page.locator('#autoBtn').click();
        await page.locator('#pauseBtn').click();

        await t.test(`same-direction motion remains current-free at boundaries (${width}px)`, async () => {
          const W = (await page.evaluate(() => __inductionTest.snapshot())).W;
          for (const speed of ['slow','mid','fast']) {
            await page.locator(`input[name=spd][value=${speed}]`).check();
            for (const [xM,xC] of [[W*.2,W*.62],[40,70],[W-40,W-70],[40,W-70],[W-40,70]]) {
              await page.evaluate(([m,c]) => __inductionTest.place(m,c),[xM,xC]);
              const {rows,labels} = await page.evaluate(() => __inductionTest.advance(8));
              for (const row of rows) {
                close(row.xC-row.xM,xC-xM,'constant magnet–coil separation');
                close(row.I,0,'no induced current for rigid translation');
                assert.ok(row.xM>=40 && row.xM<=W-40 && row.xC>=70 && row.xC<=W-70);
              }
              assert.ok(labels.includes('유도 전류 없음'), 'painted current indicator must agree with the model');
            }
          }
        });

        await t.test(`current labels distinguish weak induction from zero (${width}px)`, async () => {
          const W = (await page.evaluate(() => __inductionTest.snapshot())).W;
          await page.locator('input[name=dev][value=bulb]').check();
          await page.locator('#nRange').fill('10');
          await page.locator('#nRange').dispatchEvent('input');
          for (const delta of [-0.02,0.02]) {
            await page.evaluate(W => __inductionTest.placeManual(W*.2,W*.75),W);
            const weak = await page.evaluate(delta => {
              const model=__inductionTest.manualStep(delta,0);
              return {model,labels:__inductionTest.readLabels()};
            },delta);
            assert.ok(Math.abs(weak.model.I)>0 && Math.abs(weak.model.emf)<1,
              'slow relative motion must produce a nonzero current below the direction-display threshold');
            assert.ok(weak.labels.includes('유도 전류가 매우 작음'));
            assert.ok(!weak.labels.includes('유도 전류 없음'));
            const stopped = await page.evaluate(() => ({
              model:__inductionTest.manualStep(0,0),labels:__inductionTest.readLabels()
            }));
            assert.ok(stopped.model.I===0,'stopped relative motion gives exact zero current');
            assert.ok(stopped.labels.includes('유도 전류 없음'));
          }
          await page.locator('#nRange').fill('200');
          await page.locator('#nRange').dispatchEvent('input');
          await page.evaluate(W => __inductionTest.placeManual(W*.45,W*.55),W);
          const visible = await page.evaluate(() => ({
            model:__inductionTest.manualStep(4,0),labels:__inductionTest.readLabels()
          }));
          assert.ok(Math.abs(visible.model.emf)>=1);
          assert.ok(visible.labels.includes('유도 전류: − (시계 방향)'));
          await page.locator('input[name=dev][value=led]').check();
          await page.evaluate(W => __inductionTest.placeManual(W*.45,W*.55),W);
          const blocked = await page.evaluate(() => ({
            model:__inductionTest.manualStep(4,0),labels:__inductionTest.readLabels()
          }));
          assert.equal(blocked.model.I,0);
          assert.ok(blocked.model.emf < -5);
          assert.ok(blocked.labels.includes('LED 역방향 → 전류 차단 (I = 0)'));
          await page.locator('input[name=dev][value=bulb]').check();
          await page.locator('#nRange').fill('60');
          await page.locator('#nRange').dispatchEvent('input');
        });

        await t.test(`active mode changes and resize use the new motion reference (${width}px)`, async () => {
          await page.evaluate(() => {const {W}=__inductionTest.snapshot(); __inductionTest.place(W*.2,W*.62);});
          await page.locator('input[name=mode][value=opposite]').check();
          let before = await page.evaluate(() => __inductionTest.snapshot());
          assert.equal(before.kind,'o');
          assert.equal(before.paused,true,'changing modes must preserve pause');
          let {rows} = await page.evaluate(() => __inductionTest.advance(8));
          for (const row of rows) close(row.xM+row.xC,before.xM+before.xC,'equal opposite displacements');
          assert.ok(rows.some(row => Math.abs(row.I)>0.01), 'relative motion must induce a visible current');
          for (const [mode,kind] of [['magnet','m'],['coil','c'],['both','b']]) {
            const prior = await page.evaluate(() => __inductionTest.snapshot());
            await page.locator(`input[name=mode][value=${mode}]`).check();
            before = await page.evaluate(() => __inductionTest.snapshot());
            assert.equal(before.kind,kind);
            assert.equal(before.paused,true);
            close(before.xM,prior.xM,'switch must not move magnet');
            close(before.xC,prior.xC,'switch must not move coil');
            await page.evaluate(() => __inductionTest.advance(.1));
          }
          const oldW = before.W;
          await page.setViewportSize({width:width===390?844:390,height:width===390?390:844});
          await page.waitForFunction(old => __inductionTest.snapshot().W!==old,oldW);
          before = await page.evaluate(() => __inductionTest.snapshot());
          ({rows} = await page.evaluate(() => __inductionTest.advance(8)));
          for (const row of rows) {
            close(row.xC-row.xM,before.xC-before.xM,'resize must rebuild shared motion reference');
            close(row.I,0,'resize must not leave spurious relative velocity');
          }
        });
        await t.test(`stationary flux gives zero emf immediately after either object stops (${width}px)`, async () => {
          const W = (await page.evaluate(() => __inductionTest.snapshot())).W;
          for (const [magnetDelta,coilDelta] of [[0.5,0],[0,0.5]]) {
            await page.evaluate(W => __inductionTest.placeManual(W*.3,W*.62),W);
            const {moving,stopped,later} = await page.evaluate(([dm,dc]) => {
              let moving;
              for(let i=0;i<20;i++) moving=__inductionTest.manualStep(dm,dc);
              const stopped=__inductionTest.manualStep(0,0);
              const later=__inductionTest.manualStep(0,0);
              return {moving,stopped,later};
            },[magnetDelta,coilDelta]);
            assert.ok(Math.abs(moving.I)>1e-6, 'relative motion must first induce current');
            for (const row of [stopped,later]) {
              close(row.xM,moving.xM,'stationary magnet position');
              close(row.xC,moving.xC,'stationary coil position');
              close(row.lambda,moving.lambda,'stationary flux linkage');
              close(row.emf,0,'stationary flux must immediately give zero emf');
              close(row.I,0,'resistive circuit must immediately give zero current');
            }
          }
        });
        assert.deepEqual(errors,[]);
        await page.close();
      }
    });
}
