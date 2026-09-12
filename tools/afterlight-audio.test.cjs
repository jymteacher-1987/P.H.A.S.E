const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const options=()=>({headless:true,...(process.env.PREVIEW_BROWSER_CHANNEL?{channel:process.env.PREVIEW_BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
async function server(){const s=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/,''),file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});await new Promise(r=>s.listen(0,'127.0.0.1',r));return s;}
test('Afterlight audio: playback, pause, preferences and fallback when Web Audio is unavailable',{timeout:90000},async()=>{
 const s=await server(),url='http://127.0.0.1:'+s.address().port+'/plays/afterlight.html';
 try{for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await engine.launch(name==='chromium'?options():{headless:true});
  try{
   const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(()=>{const AC=window.AudioContext||window.webkitAudioContext;window.__audioStarts=0;if(!AC)return;window.AudioContext=new Proxy(AC,{construct(target,args){const ctx=new target(...args);window.__audioContext=ctx;const oscillator=ctx.createOscillator.bind(ctx);ctx.createOscillator=()=>{const o=oscillator(),start=o.start.bind(o);o.start=(...a)=>{window.__audioStarts++;return start(...a);};return o;};return ctx;}});});
   await page.goto(url);assert.match(await page.locator('#titleScreen [data-action=sound]').innerText(),/ON/);
   const hasAudio=await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext));await page.locator('#startBtn').click();if(hasAudio)await page.waitForFunction(()=>window.__audioContext?.state==='running'&&window.__audioStarts>6);
   await page.locator('[data-action=pause]').click();await page.waitForTimeout(250);const paused=await page.evaluate(()=>window.__audioStarts);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.__audioStarts),paused,'paused music must stop scheduling');
   await page.locator('#modalClose').click();if(hasAudio)await page.waitForFunction(n=>window.__audioStarts>n,paused);
   await page.locator('#playScreen [data-action=sound]').click();assert.equal(await page.locator('#playScreen [data-action=sound]').getAttribute('aria-pressed'),'false');
   await page.reload();assert.match(await page.locator('#titleScreen [data-action=sound]').innerText(),/OFF/);await page.locator('#continueBtn').click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.__audioStarts),0,'explicit mute survives reloading');
   await page.locator('#playScreen [data-action=sound]').click();if(hasAudio)await page.waitForFunction(()=>window.__audioContext?.state==='running'&&window.__audioStarts>0);
   // The old release saved sound:false as its default. Migrate it once without losing progress.
   await page.addInitScript(()=>localStorage.setItem('phase-afterlight-v1',JSON.stringify({version:1,sound:false,completed:{0:{stars:2,moves:2,elapsed:1000}}})));await page.reload();assert.match(await page.locator('#titleScreen [data-action=sound]').innerText(),/ON/);await page.locator('#continueBtn').click();assert.match(await page.locator('#stageLabel').innerText(),/02 \/ 16/);
   assert.deepEqual(errors,[]);console.log(name+': '+(hasAudio?'real audio playback and pause/resume':'Web Audio is absent in this engine; graceful fallback')+', default-on controls, mute persistence and migration passed');
  }finally{await browser.close();}
 }}finally{await new Promise(r=>s.close(r));}
});
test('Afterlight score: every act renders a complete, finite, unclipped 32-bar waveform',{timeout:150000},async()=>{
 const browser=await chromium.launch(options());
 try{
  const page=await browser.newPage();await page.addScriptTag({path:path.join(root,'assets/afterlight/music.js')});
  const results=await page.evaluate(async()=>{const reports=[];for(let act=0;act<4;act++){
   const seconds=32*4*60/AfterlightMusic.tempo(act),rate=22050,ctx=new OfflineAudioContext(2,Math.ceil(seconds*rate),rate),master=ctx.createGain();master.gain.value=.16;master.connect(ctx.destination);AfterlightMusic.create(ctx,master).render(seconds,act);
   const buffer=await ctx.startRendering(),left=buffer.getChannelData(0),right=buffer.getChannelData(1);let peak=0,sum=0,difference=0,finite=true,minBarRms=Infinity;
   const barLength=Math.floor(rate*4*60/AfterlightMusic.tempo(act));
   for(const samples of [left,right])for(let offset=0;offset+barLength<=samples.length;offset+=barLength){let energy=0;for(let j=offset;j<offset+barLength;j++){const v=samples[j];if(!Number.isFinite(v))finite=false;peak=Math.max(peak,Math.abs(v));energy+=v*v;sum+=v*v;}minBarRms=Math.min(minBarRms,Math.sqrt(energy/barLength));}
   for(let j=0;j<left.length;j++)difference+=(left[j]-right[j])**2;
   reports.push({act,seconds,finite,peak,rms:Math.sqrt(sum/(left.length*2)),minBarRms,stereoDifference:Math.sqrt(difference/left.length)});
  }return reports;});
  for(const result of results){assert.ok(result.finite,'finite waveform');assert.ok(result.peak<.95,'no digital clipping');assert.ok(result.rms>.002,'audible signal level');assert.ok(result.minBarRms>.001,'every bar contains a signal');assert.ok(result.stereoDifference>.0005,'stereo parts reach both channels');}
  console.log(JSON.stringify(results));
 }finally{await browser.close();}
});
