const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
test('Photoelectric: catalog launch, retarding voltage, energy, controls and responsive layout', {timeout:120000},async()=>{
 const server=http.createServer((req,res)=>{
  const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return}
  res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const output=path.join(root,'.preview-tmp/photoelectric');fs.mkdirSync(output,{recursive:true});
 try{
  for(const engine of [chromium,webkit]){
   const browser=await engine.launch({headless:true,...(engine===chromium&&process.env.PREVIEW_BROWSER_CHANNEL?{channel:process.env.PREVIEW_BROWSER_CHANNEL}:{})});
   try{
    const context=await browser.newContext({viewport:{width:1365,height:900},locale:'ko-KR'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*',route=>{
     const url=new URL(route.request().url());
     if(url.pathname.endsWith('/firebase-config.js'))return route.fulfill({contentType:'text/javascript',body:'window.FIREBASE_CONFIG = {};'});
     return url.origin===origin?route.continue():route.abort();
    });
    await page.goto(origin+'/lab.html?cat=modern-physics');
    const card=page.locator('.exp-card').filter({has:page.locator('h3',{hasText:'광전효과 원리 이해하기'})});
    await card.locator('img').evaluate(im=>im.decode());await card.click();
    await page.waitForURL('**/view.html?id=photoelectric-effect*');
    await page.waitForFunction(()=>document.querySelector('#expFrame')?.contentWindow?.PHASE_TEST);
    const frame=page.frames().find(f=>f.url().includes('/experiments/photoelectric-effect.html'));
    assert.ok(frame);
    assert.equal(await frame.locator('#lambdaMark').getAttribute('data-label'),'f₀');
    assert.match(await frame.locator('#fluxValue').innerText(),/개\/s/);
    // Real controls: lower the collecting potential beyond the Na/400nm stopping voltage.
    await frame.locator('#voltage').fill('-1');await frame.locator('#voltage').press('Enter');
    assert.equal(await frame.locator('#current').innerText(),'0.0');
    const stopped=await frame.evaluate(()=>{
     PHASE_TEST.configure({metal:'Na',lambda:400,power:60,U:-1});PHASE_TEST.advance(30);return PHASE_TEST.snapshot();
    });
    assert.equal(stopped.counters.collected,0);assert.ok(stopped.counters.returned>0);
    assert.ok(stopped.particles.every(e=>Math.abs(e.v*e.v/1.21-(e.E0-e.x))<1e-10));
    await frame.locator('#metal').selectOption('Al');
    await frame.locator('#lambda').evaluate(input=>{input.value='300';input.dispatchEvent(new Event('input',{bubbles:true}))});
    await frame.locator('#voltage').fill('-0.05');await frame.locator('#voltage').press('Enter');
    assert.match(await frame.locator('#stopBracket').innerText(),/−0\.06 ↔ −0\.05/);
    assert.ok(Number(await frame.locator('#current').innerText())>0);
    await frame.locator('#minusBtn').click();assert.equal(await frame.locator('#current').innerText(),'0.0');
    await frame.locator('#voltage').fill('bad');await frame.locator('#voltage').press('Enter');
    assert.equal(await frame.locator('#voltage').getAttribute('aria-invalid'),'true');
    await frame.locator('#zeroBtn').click();assert.equal(await frame.locator('#voltage').getAttribute('aria-invalid'),null);
    for(const [width,height] of [[1365,900],[390,844],[320,460],[568,260]]){
     await page.setViewportSize({width,height});
     await frame.waitForFunction(()=>document.querySelector('#lab').width>0&&document.querySelector('#lab').height>0);
     assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow '+width);
     await frame.locator('#voltage').scrollIntoViewIfNeeded();
     await frame.locator('#voltage').fill('-0.06');await frame.locator('#voltage').press('Enter');
     await frame.locator('#helpBtn').click();
     assert.equal(await frame.locator('#help').isVisible(),true);
     assert.ok(await frame.locator('.help-card').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'help overflow');
     await frame.locator('#closeHelp').click();assert.equal(await frame.locator('#help').isVisible(),false);
     await frame.locator('#restartBtn').click();
     const readings=await frame.evaluate(()=>{
      const g=document.querySelector('#lab').getContext('2d');
      const original={fillText:g.fillText,moveTo:g.moveTo,lineTo:g.lineTo};
      let labels=[],segments=[],pen=null;
      g.fillText=function(value,x,y,...rest){labels.push({value:String(value),x,y});return original.fillText.call(this,value,x,y,...rest)};
      g.moveTo=function(x,y){pen={x,y};return original.moveTo.call(this,x,y)};
      g.lineTo=function(x,y){if(pen)segments.push({from:pen,to:{x,y}});pen={x,y};return original.lineTo.call(this,x,y)};
      try{
       return [[0,0],[30,0],[60,0],[100,0],[60,-1]].map(([power,U])=>{
        labels=[];segments=[];PHASE_TEST.configure({metal:'Na',lambda:400,power,U});
        const meter=labels.find(item=>item.value==='A');
        const needle=meter&&segments.find(item=>Math.abs(item.from.x-meter.x)<.01&&item.from.y<meter.y&&item.from.y>meter.y-16
         &&Math.hypot(item.to.x-item.from.x,item.to.y-item.from.y)>4&&item.to.y<item.from.y);
        const numbers=meter&&labels.filter(item=>Math.abs(item.x-meter.x)<18&&Math.abs(item.y-meter.y)<25&&/^\d/.test(item.value));
        return {deflection:needle?needle.to.x-needle.from.x:null,numbers:numbers?.length,readout:document.querySelector('#current').textContent,
         roles:labels.some(item=>item.value==='빛을 받는 판')&&labels.some(item=>item.value==='전자를 받는 판')};
       });
      }finally{g.fillText=original.fillText;g.moveTo=original.moveTo;g.lineTo=original.lineTo}
     });
     assert.ok(readings.every(item=>Number.isFinite(item.deflection)&&item.numbers===0&&item.roles),'unnumbered ammeter and plate roles');
     assert.deepEqual(readings.map(item=>item.readout),['0.0','30.0','60.0','100.0','0.0']);
     assert.ok(readings[0].deflection<readings[1].deflection&&readings[1].deflection<readings[2].deflection&&readings[2].deflection<readings[3].deflection,
      'ammeter needle must deflect further as current increases at '+width+'x'+height);
     assert.equal(readings[4].deflection,readings[0].deflection,'retarding voltage returns needle to its zero position');
     await frame.evaluate(()=>{
      PHASE_TEST.configure({metal:'Na',lambda:400,power:60,U:0});
      PHASE_TEST.advance(1.55);
     });
     await page.screenshot({path:path.join(output,engine.name()+'-'+width+'x'+height+'.png')});
    }
    assert.deepEqual(errors,[]);await context.close();
   }finally{await browser.close()}
  }
 }finally{await new Promise(resolve=>server.close(resolve))}
});
