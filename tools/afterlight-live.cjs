// Read-only public deployment check in a fresh, anonymous browser. No visit/score writes.
const {chromium,devices}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.preview-tmp/afterlight');
const base='https://jymteacher-1987.github.io/P.H.A.S.E';
const expected=JSON.parse(fs.readFileSync(path.join(root,'data/experiments.json'),'utf8')).plays.at(-1);
async function main(){
  const browser=await chromium.launch({headless:true,...(process.env.PREVIEW_BROWSER_CHANNEL?{channel:process.env.PREVIEW_BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
  const findings=[];
  try{for(const [name,options] of [['desktop',{viewport:{width:1366,height:900}}],['phone',{...devices['iPhone SE'],viewport:{width:375,height:640},deviceScaleFactor:1}]]){
    const context=await browser.newContext({...options,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await context.route('**/*',route=>{
      const req=route.request(),u=new URL(req.url());
      if(u.pathname.endsWith('/firebase-config.js'))return route.fulfill({contentType:'text/javascript',body:'window.FIREBASE_CONFIG = {};'});
      if(req.method()!=='GET'||(!['jymteacher-1987.github.io','www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)))return route.abort();
      return route.continue();
    });
    await context.addInitScript(()=>sessionStorage.setItem('visit_counted','1'));
    const stamp=Date.now();
    await page.goto(base+'/lab.html?play=all&verify='+stamp,{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelectorAll('.exp-card').length===8);
    const names=await page.locator('.exp-card h3').allTextContents();
    assert.match(names.at(-2),/밤티 방탈출/);assert.match(names.at(-1),/잔광/);
    const card=page.locator('.exp-card').last();await card.scrollIntoViewIfNeeded();const photo=card.locator('img');await photo.evaluate(img=>img.decode());
    assert.match(await photo.getAttribute('src'),/afterlight-[a-f0-9]+\.webp/);
    await page.screenshot({path:path.join(out,'live-'+name+'-catalog.png'),fullPage:true});
    await page.goto(base+'/view.html?id=afterlight&src=play&verify='+stamp,{waitUntil:'load'});
    await page.waitForFunction(()=>document.querySelector('#expFrame')?.src.includes('afterlight.html'));
    assert.ok((await page.locator('#expFrame').getAttribute('src')).endsWith(expected.path), 'Viewer must use current game version');
    const game=page.frames().find(f=>f.url().includes('/plays/afterlight.html'));
    await game.locator('#startBtn').waitFor({state:'visible'});await game.locator('.keyart').first().evaluate(im=>im.decode());
    await page.screenshot({path:path.join(out,'live-'+name+'-title.png')});
    await game.locator('#startBtn').click();await game.locator('[data-action=rotate]').first().click();assert.ok(await game.locator('#sendBtn').isEnabled());await game.locator('#sendBtn').click();await game.locator('[data-action=next]').click();assert.equal(await game.locator('#levelTitle').innerText(),'옥상 사이의 길');
    assert.deepEqual(errors,[]);findings.push({device:name,order:names.slice(-2),previewLoaded:true,gameVersion:expected.path,firstTransmission:true,errors});await context.close();
  }}finally{await browser.close();}
  fs.writeFileSync(path.join(out,'live-verification.json'),JSON.stringify(findings,null,2)+'\n');console.log(JSON.stringify(findings,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
