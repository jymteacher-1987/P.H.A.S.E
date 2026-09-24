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
  await page.route('**/*',route=>route.request().url().startsWith('blob:')
    ? route.continue() : route.request().resourceType()==='document'
      ? route.fulfill({contentType:'text/html; charset=utf-8',body:source(id)}) : route.abort());
  return {page,errors};
}

for(const engine of [chromium,webkit]){
  test(`CMY painted pixels, tooltip and swatch share the residual pigment model (${engine.name()})`,{timeout:90000},async t=>{
    const browser=await engine.launch({headless:true});t.after(()=>browser.close());
    for(const width of [390,1280]){
      const {page,errors}=await open(browser,'rgb-cmy-light',width);
      await page.goto('https://phase-colour.test/');
      const stage=page.locator('.mix-stage').nth(1);
      await stage.waitFor();
      await page.waitForFunction(()=>{
        const residual=document.querySelector('.paint-residual');
        return residual && getComputedStyle(residual).backgroundColor==='rgb(34, 31, 31)';
      },null,{timeout:15000});
      for(const values of [[255,255,255],[255,255,0],[90,150,210],[0,0,0]]){
        for(let i=0;i<3;i++){
          await page.locator('input[type=range]').nth(i+3).fill(String(values[i]));
          await page.locator('input[type=range]').nth(i+3).dispatchEvent('input');
        }
        await page.mouse.move(0,0);
        const dimensions=await stage.evaluate(el=>{
          const r=el.getBoundingClientRect();
          const circles=[...el.querySelectorAll('.mix-circle')].map(e=>{const b=e.getBoundingClientRect();return{x:b.x-r.x+b.width/2,y:b.y-r.y+b.height/2};});
          return {circles,swatch:getComputedStyle(el.querySelector('.mix-readout>div')).backgroundColor};
        });
        const [c,m,y]=dimensions.circles,cx=(c.x+m.x)/2;
        const regions=[{mask:[1,0,0],x:c.x-60,y:c.y-5},{mask:[0,1,0],x:m.x+60,y:m.y-5},
          {mask:[0,0,1],x:y.x,y:y.y+26},{mask:[1,1,0],x:cx,y:c.y-40},
          {mask:[1,0,1],x:c.x,y:c.y+65},{mask:[0,1,1],x:m.x,y:m.y+65},
          {mask:[1,1,1],x:cx,y:c.y+30}];
        const pixels=await page.evaluate(async({data,regions})=>{
          const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
          const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
          const ctx=cv.getContext('2d');ctx.drawImage(img,0,0);
          return regions.map(p=>[...ctx.getImageData(Math.round(p.x),Math.round(p.y),1,1).data].slice(0,3));
        },{data:(await stage.screenshot()).toString('base64'),regions});
        const box=await stage.boundingBox();
        for(let i=0;i<regions.length;i++){
          const region=regions[i];
          // Independent expected paint reflectance; RESIDUAL is intentionally retained.
          const pigments=[[0,130,170],[180,0,100],[230,190,0]],residual=[34,31,31];
          const cols=pigments.map((pig,j)=>pig.map(v=>Math.round(255-Math.pow((region.mask[j]?values[j]:0)/255,.3)*(255-v))));
          const expected=residual.map((v,k)=>Math.round(v+cols[0][k]*cols[1][k]*cols[2][k]/65025*(255-v)/255));
          pixels[i].forEach((v,k)=>near(v,expected[k],2,`painted region ${region.mask}, ${width}px`));
          await page.mouse.move(box.x+region.x,box.y+region.y);
          await page.waitForFunction(rgb=>{
            const tip=document.querySelector('.paint-stage div[style*="z-index"] span');
            return tip && getComputedStyle(tip).backgroundColor===rgb;
          },`rgb(${expected.join(', ')})`,{timeout:3000});
          const tooltip=await stage.locator('div[style*="z-index: 5"],div[style*="z-index:5"]').first().locator('span').first().evaluate(el=>getComputedStyle(el).backgroundColor);
          assert.equal(tooltip,`rgb(${expected.join(', ')})`,'tooltip must report the same pigment mixture');
          if(i===6)assert.equal(dimensions.swatch,tooltip,'triple overlap and the result swatch must agree');
        }
      }
      assert.deepEqual(errors,[]);
      await page.close();
    }
  });
}
