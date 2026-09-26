const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const source=id=>fs.readFileSync(path.join(__dirname,'../experiments',id+'.html'),'utf8');
const near=(actual,expected,tolerance,label)=>assert.ok(Math.abs(actual-expected)<=tolerance,
  `${label}: ${actual} != ${expected} (tolerance ${tolerance})`);

async function open(browser,id,width=1280){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>route.request().resourceType()==='document'
    ? route.fulfill({contentType:'text/html; charset=utf-8',body:source(id)}) : route.abort());
  return {page,errors};
}

for(const engine of [chromium,webkit]){
  test(`Rutherford view magnification preserves one physical beam (${engine.name()})`,{timeout:90000},async t=>{
    const browser=await engine.launch({headless:true});t.after(()=>browser.close());
    const {page,errors}=await open(browser,'rutherford-scattering');
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;Math.random=()=>9/11;});
    await page.goto('https://phase-rutherford.test/');
    const rows=[];
    for(const mode of [0,1]){
      await page.locator(`button[data-v="${mode}"]`).click();
      await page.evaluate(()=>fire(D/2));
      rows.push(await page.evaluate(()=>{
        const p=particles.at(-1);
        const initial={energy:.5*(p.vx*p.vx+p.vy*p.vy)+K/Math.hypot(p.x,p.y),
          angular:p.x*p.vy-p.y*p.vx,start:p.start};
        let min=Infinity,n=0;
        while(n++<1800){
          advance(p,Math.max(view().viewR/55,Math.hypot(p.x,p.y)/40)/V0);
          min=Math.min(min,Math.hypot(p.x,p.y));
          if(Math.hypot(p.x,p.y)>p.start)break;
        }
        return {initial,theta:Math.abs(deg(Math.atan2(p.vy,p.vx))),n,min,D,V0};
      }));
    }
    for(const row of rows){
      near(row.initial.energy,.5*row.V0**2,2e-5,'same asymptotic incident energy');
      near(row.initial.angular,-row.D*row.V0/2,1e-10,'same incident angular momentum');
      near(row.theta,90,.03,'b=D/2 gives a 90-degree Coulomb scattering angle');
      assert.ok(row.n<1800,'the outgoing particle must reach the observation boundary');
    }
    near(rows[0].theta,rows[1].theta,.03,'magnification cannot change the scattering angle');
    near(rows[0].initial.start,rows[1].initial.start,1e-12,'same far-field completion radius');
    const beam=await page.evaluate(()=>{
      const out=[];
      for(const b of [-1.2,-.8,-2*D,-.5*D,0,.5*D,2*D,.8,1.2]){
        const p=incomingState(b),r=Math.hypot(p.x,p.y);
        out.push({b,energy:.5*(p.vx*p.vx+p.vy*p.vy)+K/r,
          angular:p.x*p.vy-p.y*p.vx,incoming:p.x*p.vx+p.y*p.vy<0,
          outsideAtom:r>R_ATOM});
      }
      return out;
    });
    for(const row of beam){
      near(row.energy,.5,1e-12,'far-field launch energy at all impact parameters');
      near(row.angular,-row.b,1e-12,'far-field launch angular momentum at all impact parameters');
      assert.ok(row.incoming&&row.outsideAtom,'both models must share an incoming state outside the atom');
    }
    const limits=await page.evaluate(()=>{
      const out=[];
      for(const ratio of [0,.05,.5,1,2])for(const sign of [-1,1]){
        fire(sign*ratio*D);
        const p=particles.at(-1);let min=Infinity,n=0;
        while(n++<20000){
          advance(p,1e-6);min=Math.min(min,Math.hypot(p.x,p.y));
          if(p.x*p.vx+p.y*p.vy>0&&Math.hypot(p.x,p.y)>1.1*min)break;
        }
        out.push({ratio,sign,minOverD:min/D,expected:(1+Math.sqrt(1+4*ratio*ratio))/2,n});
      }
      return out;
    });
    for(const row of limits){
      assert.ok(row.n<20000,'particle must turn around');
      near(row.minOverD,row.expected,2e-4,'closest approach must agree with conserved energy and angular momentum');
      assert.ok(row.minOverD>=1-2e-4,'particle cannot cross the head-on approach limit');
    }
    assert.deepEqual(errors,[]);
  });

  test(`Rutherford aimed shot and off-axis scattering agree with the controls (${engine.name()})`,{timeout:90000},async t=>{
    const browser=await engine.launch({headless:true});t.after(()=>browser.close());
    const {page,errors}=await open(browser,'rutherford-scattering');
    await page.addInitScript(()=>{window.requestAnimationFrame=()=>1;});
    await page.goto('https://phase-rutherford.test/');
    const finishShot=()=>page.evaluate(()=>{
      let frames=0;
      while(particles.some(p=>!p.done)&&frames++<1300)step();
      return {frames,particles:particles.map(p=>({model:p.model,done:p.done,theta:p.theta})),stats};
    });

    // The actual button must keep aiming at the centre in either view,
    // independently of the random values used by continuous firing.
    for(const mode of [0,1])for(const random of [0,.5,.999999]){
      await page.locator(`button[data-v="${mode}"]`).click();
      await page.locator('#bReset').click();
      await page.evaluate(value=>{Math.random=()=>value;},random);
      await page.locator('#bHead').click();
      const result=await finishShot();
      assert.equal(result.particles.length,2,'one aimed shot launches the same pair of particles');
      assert.ok(result.frames<1300&&result.particles.every(p=>p.done),'both particles finish naturally');
      for(const p of result.particles){
        near(p.theta,p.model==='rutherford'?180:0,.03,'a centre-directed alpha returns only in the concentrated-charge model');
      }
      assert.deepEqual(result.stats.rutherford,{n:1,pass:0,big:1,max:180},'head-on scattering is counted once');
      assert.deepEqual(result.stats.thomson,{n:1,pass:1,big:0,max:0},'the Thomson particle passes without backscattering');
    }

    // Rutherford (1911), p.673: cot(theta/2)=2b/D. Off-axis shots must
    // remain different from head-on shots, including angles below 90 degrees.
    await page.locator('button[data-v="1"]').click();
    for(const ratio of [0,-.25,.25,-.6,.6]){
      await page.locator('#bReset').click();
      await page.evaluate(value=>{
        const pn=LAY.panels[1],pl=plotOf(pn);
        shootAt(pn.ox+pn.pw/2,pl.cy+value*D*pl.S);
      },ratio);
      const result=await finishShot(),p=result.particles.find(p=>p.model==='rutherford');
      const expected=ratio===0?180:2*Math.atan(1/(2*Math.abs(ratio)))*180/Math.PI;
      assert.ok(result.frames<1300&&result.particles.every(p=>p.done),'off-axis shots finish naturally');
      near(p.theta,expected,.03,'the selected impact parameter determines the scattering angle');
      assert.equal(result.stats.rutherford.n,1);
      assert.equal(result.stats.rutherford.big,Math.abs(ratio)<.5?1:0,'off-axis forward scattering must not be counted as backscattering');
      assert.equal(result.stats.thomson.big,0);
    }
    assert.deepEqual(errors,[]);
  });

}
