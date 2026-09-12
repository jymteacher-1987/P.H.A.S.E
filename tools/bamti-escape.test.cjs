const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const walkthrough=require('./bamti-flow.cjs');
const root=path.resolve(__dirname,'..');
test('Bamti: six complete puzzle chains, both manor endings and retry paths',{timeout:300000},async t=>{
  const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');fs.createReadStream(file).pipe(res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  const origin='http://127.0.0.1:'+server.address().port;
  const results=path.join(root,'.preview-tmp/bamti');fs.mkdirSync(results,{recursive:true});
  try{
    browser=await chromium.launch({headless:true,...(process.env.PREVIEW_BROWSER_CHANNEL?{channel:process.env.PREVIEW_BROWSER_CHANNEL}:{})});
    for(const [id,takeHeart] of [['school',false],['wave',false],['prom',false],['temple',false],['apes',false],['manor',false],['manor',true]]){
      if(process.env.BAMTI_ONLY&&!process.env.BAMTI_ONLY.split(',').includes(id))continue;
      await t.test(id+(id==='manor'?(takeHeart?' collector':' detective'):''),{timeout:90000},async()=>{
        const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();const errors=[];
        page.on('pageerror',e=>errors.push(e.message));
        await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
        try{
          await page.goto(origin+'/plays/bamti-escape.html');
          await page.locator('[data-id='+id+']').click();
          const game=await (await page.locator('#frame').elementHandle()).contentFrame();
          await game.locator(id==='prom'?'#btnStart':'#startBtn').click();
          await page.waitForTimeout(id==='manor'?1600:100);
          const result=await game.evaluate(walkthrough,{id,takeHeart});
          assert.equal(result.stages.length,5,'all five rooms completed');assert.ok(result.ending.trim().length>30,'ending displayed');assert.deepEqual(errors,[]);
          await page.screenshot({path:path.join(results,id+(takeHeart?'-collector':'')+'-ending.png')});
          fs.writeFileSync(path.join(results,id+(takeHeart?'-collector':'')+'.json'),JSON.stringify(result,null,2));
          await page.locator('#backBtn').click();await page.locator('#cancelBtn').click();assert.equal(await page.locator('#stage').isVisible(),true);
          await page.locator('#backBtn').click();await page.locator('#okBtn').click();assert.equal(await page.locator('#menu').isVisible(),true);
        }catch(e){await page.screenshot({path:path.join(results,id+'-failure.png')});const f=page.frames().find(f=>f.url()==='about:srcdoc');fs.writeFileSync(path.join(results,id+'-failure.txt'),String(e.stack)+'\n'+errors.join('\n')+'\n'+(f?await f.locator('body').innerText():''));throw e;}
        finally{await context.close();}
      });
    }
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
});
