const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,webkit,devices}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const L=require('../assets/afterlight/levels.js');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.preview-tmp/afterlight');
const chromiumOptions=()=>({headless:true,...(process.env.PREVIEW_BROWSER_CHANNEL?{channel:process.env.PREVIEW_BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
fs.mkdirSync(out,{recursive:true});
async function startServer(){const s=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),p=path.resolve(root,rel||'index.html');if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.json':'application/json'})[path.extname(p)]||'application/octet-stream');fs.createReadStream(p).pipe(res);});await new Promise(r=>s.listen(0,'127.0.0.1',r));return s;}
async function reachable(locator){await locator.scrollIntoViewIfNeeded();const hit=await locator.evaluate(el=>{const r=el.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&(el===top||el.contains(top));});assert.ok(hit,'Control must fit viewport and receive input: '+await locator.getAttribute('aria-label'));}
async function solve(page,l){
  if(l.type==='route'){for(const [part,value]of Object.entries(l.solution)){const b=page.locator('[data-action=rotate][data-part="'+part+'"]');if(Number(await b.getAttribute('data-value'))!==value){await reachable(b);await b.click();}}}
  else if(l.type==='polar'){for(let i=0;i<l.filters.length;i++){if(l.filters[i].locked)continue;let value=parseInt(await page.locator('#angle'+i).innerText());while(value!==l.solution[i]){await page.locator('[data-action=polar][data-part="'+i+'"][data-delta="15"]').click();value=(value+15)%180;}}}
  else {for(let i=0;i<2;i++){const b=page.locator('#gate'+i),open=(await b.getAttribute('aria-pressed'))==='false';if(open!==l.solution.gates[i])await b.click();}await page.locator('#phaseSlider').fill(String(l.solution.phase));}
  assert.ok(await page.locator('#sendBtn').isEnabled(),'Solved state must enable send');
}

test('Afterlight: full campaign, real UI solutions, final sequence, records and daily on Chromium and WebKit', {timeout:240000},async t=>{
  const server=await startServer(),origin='http://127.0.0.1:'+server.address().port;
  try{for(const name of (process.env.AFTERLIGHT_BROWSER?[process.env.AFTERLIGHT_BROWSER]:['chromium','webkit']))await t.test(name,{timeout:115000},async()=>{
    const engine=name==='webkit'?webkit:chromium,browser=await engine.launch(name==='chromium'?chromiumOptions():{headless:true});
    const context=await browser.newContext(name==='webkit'?{...devices['iPhone SE'],viewport:{width:375,height:640},deviceScaleFactor:1}:{viewport:{width:1366,height:900},deviceScaleFactor:1});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    try{
      await page.goto(origin+'/plays/afterlight.html');await page.locator('.keyart').first().evaluate(im=>im.decode());await reachable(page.locator('#startBtn'));await page.screenshot({path:path.join(out,name+'-title.png')});await page.locator('#startBtn').click();
      for(let i=0;i<16;i++){
        await page.locator('#levelTitle').filter({hasText:L[i].title}).waitFor();assert.ok(await page.locator('#sendBtn').isDisabled(),'Each campaign begins unsolved '+i);
        if(i===4){await page.locator('#analysisBtn').click();assert.match(await page.locator('#measurements').innerText(),/최종 투과광 없음/);await page.locator('#board').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,name+'-polar-blocked.png'),fullPage:true});}
        await solve(page,L[i]);
        if(i===5){await page.locator('#analysisBtn').click();const measured=await page.locator('#measurements').innerText();assert.match(measured,/편광판 1 \(θ = 45°\): 100% → 50%/);assert.match(measured,/편광판 2 \(θ = 45°\): 50% → 25%/);assert.match(measured,/최종 투과광: 90° 선편광/);}
        if(i===8){await page.locator('#analysisBtn').click();await page.locator('.power-reference [data-action=archive]').click();assert.match(await page.locator('.archive-content').innerText(),/1 W = 1 J\/s/);await page.screenshot({path:path.join(out,name+'-glossary.png'),animations:'disabled'});for(const tab of [0,1,2,3,4]){await page.locator('[data-action=archive-tab][data-index="'+tab+'"]').click();assert.ok(await page.locator('.modal-card').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Archive text must fit its dialog');}await page.locator('#modalClose').click();}
        if([0,5,8,12,15].includes(i)){await page.locator('#board').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,name+'-stage-'+(i+1)+'.png'),fullPage:true});}
        if(i===0){await page.locator('#undoBtn').click();assert.ok(await page.locator('#sendBtn').isDisabled(),'Undo changes optical result');await solve(page,L[i]);await page.reload();await page.locator('#continueBtn').click();assert.equal(await page.locator('#levelTitle').innerText(),L[i].title);assert.ok(await page.locator('#sendBtn').isEnabled(),'Restore exact solved arrangement');}
        if(i===15){await page.locator('#sendBtn').click();assert.match(await page.locator('#taskText').innerText(),/2 \/ 3/);assert.ok(await page.locator('#sendBtn').isDisabled());await page.locator('[data-action=phase-set][data-value="180"]').click();await page.locator('#sendBtn').click();assert.match(await page.locator('#taskText').innerText(),/3 \/ 3/);await page.locator('[data-action=phase-set][data-value="90"]').click();}
        await reachable(page.locator('#sendBtn'));await page.locator('#sendBtn').click();await page.locator('#modal').waitFor({state:'visible'});await page.locator('[data-action=next]').click();
      }
      await page.locator('#endingScreen').waitFor({state:'visible'});assert.match(await page.locator('#endingStats').innerText(),/16 \/ 16/);await page.screenshot({path:path.join(out,name+'-ending.png'),fullPage:true});
      await page.locator('#endingScreen [data-action=daily]').click();assert.equal(await page.locator('#levelTitle').innerText(),'오늘의 회선');assert.ok(await page.locator('[data-action=rotate]').count()>1);await page.locator('[data-action=rotate]').first().click();
      await page.locator('[data-action=pause]').click();await page.locator('#modal [data-action=map]').click();assert.equal(await page.locator('.map-node:disabled').count(),0);await page.locator('[data-action=level][data-index="0"]').click();
      await page.locator('[data-action=hint]').click();assert.ok(await page.locator('#hintBox').isVisible());await solve(page,L[0]);await page.locator('#sendBtn').click();assert.match(await page.locator('.success-detail').innerText(),/힌트 사용/);await page.locator('#modalClose').click();await page.locator('#sendBtn').click();assert.equal(await page.locator('#levelTitle').innerText(),L[1].title);
      assert.deepEqual(errors,[],'No game JavaScript errors');
      console.log(name+': 16 levels + 3 final transmissions + save/undo/hint/ending/daily passed');
    }finally{await browser.close();}
  });}finally{await new Promise(r=>server.close(r));}
});

test('Afterlight: smallest phone starts, landscape, root font preference, keyboard and unavailable storage',{timeout:120000},async()=>{
  const server=await startServer(),origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(chromiumOptions());
  try{
    const context=await browser.newContext({viewport:{width:320,height:460},hasTouch:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});delete CanvasRenderingContext2D.prototype.roundRect;});
    await page.goto(origin+'/plays/afterlight.html');
    for(const viewport of [{width:320,height:460},{width:568,height:210},{width:667,height:310},{width:768,height:1024}]){await page.setViewportSize(viewport);const start=page.locator('#startBtn');await reachable(start);await page.screenshot({path:path.join(out,'start-'+viewport.width+'x'+viewport.height+'.png')});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal scrolling');}
    await page.setViewportSize({width:320,height:460});await page.locator('#startBtn').click();assert.match(await page.locator('#saveStatus').innerText(),/이번 실행/);const mirror=page.locator('[data-action=rotate]').first();await mirror.focus();await page.keyboard.press('Enter');assert.ok(await page.locator('#sendBtn').isEnabled());await page.keyboard.press('z');assert.ok(await page.locator('#sendBtn').isDisabled());await page.keyboard.press('h');assert.ok(await page.locator('#hintBox').isVisible());await page.keyboard.press('Escape');assert.ok(await page.locator('#modal').isVisible());await page.keyboard.press('Escape');assert.ok(await page.locator('#modal').isHidden());
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');await reachable(page.locator('#sendBtn'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Custom root font preference has no overflow; this does not emulate browser zoom');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
