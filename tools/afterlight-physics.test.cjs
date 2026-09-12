const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../assets/afterlight/physics.js');
const L=require('../assets/afterlight/levels.js');
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-10,`${message}: ${actual} ≠ ${expected}`);

test('Reflection follows the vector law for both mirror normals',()=>{
  for(const slash of [0,1])for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
    const n=slash===0?[Math.SQRT1_2,Math.SQRT1_2]:[Math.SQRT1_2,-Math.SQRT1_2];
    const dot=dx*n[0]+dy*n[1],out=P.reflect(dx,dy,slash);
    near(out[0],dx-2*dot*n[0],'reflected x');near(out[1],dy-2*dot*n[1],'reflected y');
    near(Math.abs(out[0]*n[0]+out[1]*n[1]),Math.abs(dot),'equal normal angles');
  }
});
test('Polarizers: independent analytic benchmark values and conservation',()=>{
  for(let a=0;a<180;a+=15)near(P.polarize(1,null,[a]).power,.5,'unpolarized first filter');
  for(const [axis,filters,expected] of [[0,[0],1],[0,[90],0],[0,[45,90],.25],[0,[30,60,90],27/64],[null,[45,45],.5]]){
    const r=P.polarize(1,axis,filters);near(r.power,expected,'polarization benchmark');near(r.power+r.absorbed,1,'power accounting');
  }
  for(let a=0;a<180;a+=15)for(let b=0;b<180;b+=15)for(let c=0;c<180;c+=15){const r=P.polarize(1,0,[a,b,c]);near(r.power+r.absorbed,1,'three-filter accounting');assert.ok(r.stages.every(x=>x.after<=x.before+1e-12));}
});

test('Polarizer chains agree with Cartesian field projections, including an unpolarized ensemble',()=>{
  // Project x/y electric-field components with a 2x2 Jones matrix, not cos(angle difference).
  // Unpolarized input is the incoherent equal mixture of orthogonal input states.
  const project=(field,degrees)=>{const x=Math.cos(degrees*Math.PI/180),y=Math.sin(degrees*Math.PI/180);return [x*x*field[0]+x*y*field[1],x*y*field[0]+y*y*field[1]];};
  const norm=v=>v[0]*v[0]+v[1]*v[1];
  let checked=0;
  for(let a=0;a<180;a+=15)for(let b=0;b<180;b+=15)for(let c=0;c<180;c+=15)for(let d=0;d<180;d+=15){
    const filters=[a,b,c,d],fields=[[1,0],[0,1]],power=[1,1];
    const linear=P.polarize(1,0,filters),unpolarized=P.polarize(1,null,filters);
    filters.forEach((angle,i)=>{
      const before=(power[0]+power[1])/2;
      for(let k=0;k<2;k++){fields[k]=project(fields[k],angle);power[k]=norm(fields[k]);}
      near(linear.stages[i].after,power[0],'linear Cartesian projection');
      near(unpolarized.stages[i].after,(power[0]+power[1])/2,'unpolarized mixture');
      near(unpolarized.stages[i].absorbed,before-(power[0]+power[1])/2,'each plate absorption');
    });
    checked++;
  }
  assert.equal(checked,20736);
  near(P.polarize(1,null,[0,30,60,90]).power,27/128,'final authentication 21.09375%');
  near(P.polarize(1,0,[90,45,0]).power,0,'later plates cannot recover already absorbed light');
  for(const input of [.01,.25,2,7.3])near(P.polarize(input,0,[45,90]).power,input/4,'power units scale linearly');
});
test('Interferometer agrees with independent complex field propagation at every phase and shutter combination',()=>{
  const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]],add=(a,b)=>[a[0]+b[0],a[1]+b[1]],power=a=>a[0]**2+a[1]**2;
  const t=[Math.SQRT1_2,0],r=[0,Math.SQRT1_2];
  for(let phase=0;phase<360;phase++)for(const u of [0,.25,1])for(const l of [0,.6,1]){
    const up=mul(r,[Math.sqrt(u)*Math.cos(phase*Math.PI/180),Math.sqrt(u)*Math.sin(phase*Math.PI/180)]),lo=mul(t,[Math.sqrt(l),0]);
    const upPort=add(mul(up,r),mul(lo,t)),rightPort=add(mul(up,t),mul(lo,r)),model=P.interferometer(phase,u,l);
    near(model.a,power(upPort),'upper A');near(model.b,power(rightPort),'right B');near(model.a+model.b+model.absorbed,1,'conservation');
  }
  for(let phase=0;phase<360;phase+=15){const one=P.interferometer(phase,0,1);near(one.a,.25,'single arm A');near(one.b,.25,'single arm B');near(one.absorbed,.5,'shutter loss');}
});
test('Every campaign has a valid solution and final transmission has three reachable states',()=>{
  assert.equal(L.length,16);
  for(const [i,l] of L.entries()){
    if(l.type==='route'){
      const keys=l.parts.map(p=>`${p.x},${p.y}`);assert.equal(new Set(keys).size,keys.length,'no collocated parts');
      const s=l.parts.map((p,j)=>l.solution[j]??p.value??0),r=P.trace(l,s);
      for(const p of l.parts.filter(p=>p.type==='target'))assert.ok(P.satisfied(r.targets[p.id]||0,p.goal),'level '+(i+1)+' target '+p.id);
      near(r.absorbed+r.escaped+r.unresolved+Object.values(r.targets).reduce((a,b)=>a+b,0),1,'routing conservation');
    }else if(l.type==='polar')assert.ok(P.satisfied(P.polarize(1,l.axis,l.solution).power,l.goal),'level '+(i+1));
    else{const r=P.interferometer(l.solution.phase,...l.solution.gates.map(Number));assert.ok(P.satisfied(r.a,l.goals[0])&&P.satisfied(r.b,l.goals[1]),'level '+(i+1));}
  }
  [0,180,90].forEach((phase,i)=>{const r=P.interferometer(phase);assert.ok(P.satisfied(r.a,L[15].sequence[i][0])&&P.satisfied(r.b,L[15].sequence[i][1]));});
});
test('All route configurations conserve power and avoid unsupported coherent recombination',()=>{
  for(const l of L.filter(l=>l.type==='route')){
    const movable=l.parts.map((p,i)=>['mirror','split'].includes(p.type)?i:-1).filter(i=>i>=0);
    for(let mask=0;mask<2**movable.length;mask++){
      const values=l.parts.map(p=>p.value||0);movable.forEach((n,i)=>values[n]=(mask>>i)&1);
      const r=P.trace(l,values);near(r.absorbed+r.escaped+r.unresolved+Object.values(r.targets).reduce((a,b)=>a+b,0),1,'configuration accounting');
      assert.equal(r.unresolved,0,'campaign must not create loops');
      const segmentModes=r.segments.map(s=>[s.x1,s.y1,s.x2,s.y2].join(','));assert.equal(new Set(segmentModes).size,segmentModes.length,'no same-direction overlapping beams');
    }
  }
});
