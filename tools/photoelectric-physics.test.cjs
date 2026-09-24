const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const filename=path.resolve(__dirname,'../experiments/photoelectric-effect.html');
const html=fs.readFileSync(filename,'utf8'),code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(code,{filename});
const noop=()=>{},gradient={addColorStop:noop};
const ctx=new Proxy({}, {get:(o,k)=>o[k]||(k.startsWith('create')?()=>gradient:noop),set:(o,k,v)=>(o[k]=v,true)});
const elements=new Map();
function el(id){
 if(elements.has(id))return elements.get(id);
 const attrs=new Map(),handlers=new Map();
 const item={id,handlers,textContent:'',innerHTML:'',hidden:id==='help',style:{},tagName:'DIV',
  value:({metal:'Na',lambda:'400',power:'60',bias:'0',voltage:'0.00',step:'0.01'})[id]||'',
  classList:{toggle:noop},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),hasAttribute:k=>attrs.has(k),
  addEventListener:(k,f)=>handlers.set(k,f),appendChild:noop,focus:noop,blur:noop,getContext:()=>ctx,
  getBoundingClientRect:()=>({left:0,top:0,width:1000,height:600})};elements.set(id,item);return item;
}
const document={getElementById:el,createElement:()=>el('created-'+elements.size),addEventListener:noop,hidden:false};
const window={devicePixelRatio:1,addEventListener:noop};
vm.runInNewContext(code,{document,window,requestAnimationFrame:noop,console});
const api=window.PHASE_TEST,results=[],E=1.602176634e-19,H=6.62607015e-34,C=299792458;
let checks=0;
function ok(v,msg){checks++;assert.ok(v,msg)}
function close(a,b,tol=1e-10){checks++;assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`)}
function change(id,value,event='input'){const item=el(id);item.value=String(value);item.handlers.get(event)({target:item,preventDefault:noop})}
function run(name,f){const data=f();results.push({name,status:'passed',data})}
run('Core equations, emission thresholds, current, units',()=>{
 for(const metal of Object.keys(api.metals)) for(let lambda=200;lambda<=700;lambda++) for(const power of [0,30,100]){
  const K=Math.max(0,H*C/(lambda*1e-9)/E-api.metals[metal].phi);
  for(const U of [-4,-.25,0,2]){
   const m=api.calc({metal,lambda,power,U});close(m.K,K);close(m.nu,C/(lambda*1e-9)/1e14);
   close(m.current,K>1e-12?power*Math.max(0,Math.min(1,1+U/K)):0);
  }
 }
 ok(!/nA|나노암페어|SURFACE_SHARE|FMIN|FMAX|PLACEHOLDER/.test(html),'Obsolete units/model code left');
 ok(html.includes('정지 전압의 크기'));ok(html.includes('들어오는 광자 수'));
 ok(html.includes('id="lambdaMark" data-label="f₀"'));ok(!html.includes('모형초'));ok(html.includes('개/s'));
 return {conditions:4*501*3*4};
});
run('Photon energy preserved when wavelength changes in either direction',()=>{
 api.configure({metal:'Na',lambda:600,power:100,U:0});change('lambda',400);api.advance(.28);
 let s=api.snapshot();ok(s.counters.emitted===0);ok(s.counters.absorbedNoEmission===1);
 api.configure({metal:'Na',lambda:400,power:100,U:0});change('lambda',600);api.advance(.28);
 s=api.snapshot();ok(s.counters.emitted===1);ok(s.counters.references===1);
 const reference=s.particles.find(p=>p.kind==='reference');close(reference.E0,H*C/(400e-9)/E-2.46);
 return {belowThresholdPhotonEmits:false,aboveThresholdPhotonEmits:true,referenceEnergy:reference.E0};
});
run('Metal at impact determines work function',()=>{
 api.configure({metal:'Na',lambda:400,power:100,U:0});change('metal','Al','change');api.advance(.28);ok(api.snapshot().counters.emitted===0);
 api.configure({metal:'Al',lambda:400,power:100,U:0});change('metal','Na','change');api.advance(.28);ok(api.snapshot().counters.emitted===1);
});
run('Energy conservation and exact flight times',()=>{
 for(const U of [-1,0,1]){
  api.configure({metal:'Na',lambda:400,power:0,U});const id=api.inject(.64);api.advance(.2);const p=api.snapshot().particles.find(p=>p.id===id);
  close(p.v*p.v/api.constants.SPEED**2,.64+U*p.x);
 }
 api.configure({metal:'Na',lambda:400,power:100,U:0});api.advance(.28);
 const r=api.snapshot().particles.find(p=>p.kind==='reference');close(r.x,1.1*Math.sqrt(r.E0)*.005);
});
run('Directions after reversal and zero voltage',()=>{
 api.configure({metal:'Na',lambda:400,power:60,U:-1});api.advance(2);api.setU(1);
 let s=api.snapshot(),p=s.particles.find(p=>p.id===s.selectedId);ok(p.v<0);ok(s.caption.includes('이동 ← · 전기력 → · 속력 감소'));
 api.setU(0);s=api.snapshot();ok(s.caption.includes('이동 ← · 전기력 0 · 등속 운동'));
 return {positiveFieldAfterReturn:true,zeroFieldAfterReturn:true};
});
run('Current is explicitly a steady-condition relative prediction; residual particles retained',()=>{
 api.configure({metal:'Na',lambda:400,power:60,U:0});api.advance(5);change('power',0);const off=api.snapshot();
 ok(off.readouts.I==='0.0');ok(off.particles.length>0);api.advance(10);const end=api.snapshot();
 ok(end.counters.collected>off.counters.collected);ok(html.includes('현재 조건을 충분히 오래 유지했을 때의 예상값'));
 return {arrivalsAfterLightOff:end.counters.collected-off.counters.collected};
});
run('Al 300 nm stop value and controllable interval',()=>{
 api.configure({metal:'Al',lambda:300,power:60,U:-.05});const s=api.snapshot();
 ok(el('stopValue').textContent==='≈ 0.052807 V');ok(el('stopBracket').textContent.includes('−0.06 ↔ −0.05 V'));
 ok(s.model.current>0);api.setU(-.06);ok(api.snapshot().model.current===0);
 return {magnitude:el('stopValue').textContent,bracket:el('stopBracket').textContent};
});
run('Continuous current goes to zero; reference trajectories have zero statistical weight',()=>{
 close(api.collectedFraction(-.999999,1),.000001);close(api.collectedFraction(-1,1),0);
 api.configure({metal:'Na',lambda:400,power:0,U:-.32});
 for(let i=0;i<1000;i++)api.inject(.64*(i+.5)/1000);
 for(let i=0;i<40;i++)api.inject(.64,'reference');
 api.advance(12);const s=api.snapshot();ok(s.counters.emitted===1000);ok(s.counters.collected===500);ok(s.counters.returned===500);
 return {emitted:s.counters.emitted,collected:s.counters.collected,returned:s.counters.returned,references:s.counters.references};
});
run('Drawing limit never suppresses threshold-near emission or collection',()=>{
 api.configure({metal:'Na',lambda:504,power:100,U:0});api.advance(120);const s=api.snapshot();
 ok(s.counters.emitted===s.counters.photons-s.photons.length);ok(s.counters.emitted>190);ok(api.visible().length<=190);
 ok(s.readouts.Kmax!=='0.00');
 const count=s.counters.emitted;change('power',0);api.setU(2);api.advance(10);const after=api.snapshot();
 ok(after.particles.length===0);ok(after.counters.collected===after.counters.emitted);
 return {before:count,displayed:Math.min(190,s.particles.length),energy:s.readouts.Kmax,afterAccelerationCollected:after.counters.collected};
});
run('Plate crossing followed by reversal within a single step is still collected',()=>{
 api.configure({metal:'Na',lambda:400,power:0,U:-1});const id=api.inject(1.00000001);
 api.advance(2);const s=api.snapshot();ok(!s.particles.some(p=>p.id===id));ok(s.counters.collected===1);
 api.configure({metal:'Na',lambda:400,power:0,U:-1});api.inject(1,'reference');api.advance(4);const b=api.snapshot();
 ok(b.counters.collected===0);ok(b.counters.returned===0);ok(b.particles.length===0);
});
run('Tiny current is not displayed as zero',()=>{
 api.configure({metal:'Al',lambda:300,power:1,U:-.05});ok(api.snapshot().readouts.I==='< 0.1');
});
run('Conservation over repeated changes of light, metal, voltage and power',()=>{
 api.configure({metal:'Na',lambda:400,power:100,U:0});
 for(let i=0;i<100;i++){
  if(i%3===0)change('lambda',200+(i*47)%501);
  if(i%5===0)change('metal',['Na','Al','Zn','Cu'][i%4],'change');
  if(i%7===0)change('power',i%2?100:0);
  api.setU(-4+(i*13%601)/100);api.advance(.17);
  const s=api.snapshot(),regular=s.particles.filter(p=>p.kind!=='reference');
  ok(s.counters.emitted===regular.length+s.counters.collected+s.counters.returned);
  ok(s.counters.photons===s.photons.length+s.counters.absorbedNoEmission+s.counters.emitted);
  ok(s.particles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.v)&&p.x>=0&&p.x<=1));
 }
});
const summary={file:filename,checks,results};
const output=path.resolve(__dirname,'../.preview-tmp/photoelectric');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'physics-verification.json'),JSON.stringify(summary,null,2));
console.log('Photoelectric: '+checks+' assertions passed across '+results.length+' physics and behavior checks');
