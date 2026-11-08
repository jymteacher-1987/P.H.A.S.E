import test from 'node:test';
import assert from 'node:assert/strict';
import {centroid,SHAPES,suspensionPins,suspensionAngle,rotate,scoreGuess,inside,bounds,polarMomentPerMass,angularAcceleration,swingStep,topAttachment,initialOrientation,secondOrientation,plumbLineDirection,isCenterBelowPin,canRecordPlumbLine} from '../lib/physics.ts';
test('polygon centroid agrees with independently known rectangle and triangle centers',()=>{
 assert.deepEqual(centroid([{x:0,y:0},{x:12,y:0},{x:12,y:6},{x:0,y:6}]),{x:6,y:3});
 assert.deepEqual(centroid([{x:0,y:0},{x:12,y:0},{x:0,y:6}]),{x:4,y:2});
});
test('all 10 laminae have valid pins and stable suspension puts the center BELOW each pin',()=>{
 assert.equal(SHAPES.length,10);
 for(const s of SHAPES){const c=centroid(s.points),pins=suspensionPins(s);for(const p of pins){assert(inside(p,s.points),s.id);const v=rotate({x:c.x-p.x,y:c.y-p.y},suspensionAngle(c,p));assert(Math.abs(v.x)<1e-8,s.id);assert(v.y>0,s.id);}
 const u={x:pins[0].x-c.x,y:pins[0].y-c.y},v={x:pins[1].x-c.x,y:pins[1].y-c.y};assert(Math.abs(u.x*v.y-u.y*v.x)/Math.hypot(u.x,u.y)/Math.hypot(v.x,v.y)>.75,s.id);
 }
});
test('U and L centers can lie outside material and remain valid answers',()=>{for(const id of ['u','l','moon']){const s=SHAPES.find(s=>s.id===id)!;assert(!inside(centroid(s.points),s.points),id);assert.equal(scoreGuess(s,centroid(s.points)),100);}});
test('score is monotonic, normalized for size, bounded, and stored as integer points',()=>{
 for(const s of SHAPES){const c=centroid(s.points),d=bounds(s.points).diagonal;assert.equal(scoreGuess(s,c),100);assert.equal(scoreGuess(s,{x:c.x+.0001,y:c.y}),100);assert(Number.isInteger(scoreGuess(s,{x:c.x+7.123,y:c.y}))); assert.equal(scoreGuess(s,{x:c.x+d*.125,y:c.y}),50);assert.equal(scoreGuess(s,{x:c.x+d,y:c.y}),0);assert.equal(scoreGuess(s,{x:NaN,y:0}),0);}
});

test('swing uses correct planar inertia and zero torque at the actual center in every orientation',()=>{const rect=[{x:0,y:0},{x:12,y:0},{x:12,y:6},{x:0,y:6}];assert.equal(polarMomentPerMass(rect),15);for(const t of [0,.5,1.57,Math.PI])assert(Math.abs(angularAcceleration(0,0,15,t,0))<1e-12);});
test('a wrong pivot can be stationary vertically but rotates when released from ninety degrees',()=>{assert.equal(angularAcceleration(0,50,10000,0,0),0);assert(angularAcceleration(0,50,10000,Math.PI/2,0)<0);let s={angle:Math.PI/2,omega:0};for(let i=0;i<1200;i++)s=swingStep(s.angle,s.omega,1/120,0,50,10000);assert(Math.abs(s.angle)<.01);});

test('left-to-right attachment always touches the upper material edge, including concave shapes',()=>{
 for(const shape of SHAPES){const a=initialOrientation(shape);for(const angle of [a,a+Math.PI/2]){
  const rotated=shape.points.map(p=>rotate(p,angle)),b=bounds(rotated),c=rotate(centroid(shape.points),angle);
  const support=rotate(topAttachment(shape.points,angle,c.x),angle);
  assert(support.y<c.y-10,shape.id+' has stable support in both search directions');
  for(let i=1;i<100;i++){
   const x=b.left+b.width*i/100,p=topAttachment(shape.points,angle,x),q=rotate(p,angle);
   assert(Math.abs(q.x-x)<1e-8);
   assert(inside(rotate({x:q.x,y:q.y+.00001},-angle),shape.points),shape.id+' just below the edge is material');
   assert(!inside(rotate({x:q.x,y:q.y-.00001},-angle),shape.points),shape.id+' just above the edge is empty');
  }
 }}
});
test('recorded line is the actual vertical string extension and rotates with the plate',()=>{
 for(const angle of [0,.37,Math.PI/2,2.9]){
  const d=plumbLineDirection(angle),vertical=rotate(d,angle),turned=rotate(d,angle+Math.PI/2);
  assert(Math.abs(vertical.x)<1e-10);assert(Math.abs(vertical.y-1)<1e-10);
  assert(Math.abs(turned.x+1)<1e-10);assert(Math.abs(turned.y)<1e-10);
 }
});

test('first attachments along every upper edge permit a stable quarter-turn search on all ten plates',()=>{
 for(const shape of SHAPES){const c=centroid(shape.points),edge=bounds(shape.points);for(let i=1;i<100;i++){
  const pin=topAttachment(shape.points,0,edge.left+edge.width*i/100);
  const first=suspensionAngle(c,pin),second=first+secondOrientation(shape,first),rc=rotate(c,second);
  const p=rotate(topAttachment(shape.points,second,rc.x),second);
  assert(p.y<rc.y,shape.id);
  const a=plumbLineDirection(first),b=plumbLineDirection(second);
  assert(Math.abs(a.x*b.y-a.y*b.x)>.999,shape.id+' lines are independent');
 }}
});


test('zero rotation with the center above the pin is not a stable hanging equilibrium',()=>{
 assert.equal(angularAcceleration(0,-50,10000,0,0),0);
 assert.equal(isCenterBelowPin({x:0,y:0},{x:0,y:50},0),false);
 assert.equal(isCenterBelowPin({x:0,y:0},{x:0,y:50},Math.PI),true);
 for(const id of ['u','l']){
  const shape=SHAPES.find(s=>s.id===id)!,c=centroid(shape.points),pin=topAttachment(shape.points,0,c.x);
  assert.equal(isCenterBelowPin(c,pin,0),false,id+' inner upper edge is below the center');
  assert.equal(isCenterBelowPin(c,pin,suspensionAngle(c,pin)),true,id+' after settling the center is below the pin');
 }
});


test('gravity torque agrees with an independent potential-energy derivative in rotated poses',()=>{
 const eps=1e-5,g=9810;
 for(const shape of SHAPES){const c=centroid(shape.points),edge=bounds(shape.points);
  const pin=topAttachment(shape.points,0,edge.left+edge.width*.23),dx=c.x-pin.x,dy=c.y-pin.y;
  const inertia=polarMomentPerMass(shape.points)+dx*dx+dy*dy;
  for(const angle of [-2.4,-.6,0,.7,2.8]){
   const potential=a=>-g*rotate({x:dx,y:dy},a).y;
   const torque=-(potential(angle+eps)-potential(angle-eps))/(2*eps);
   assert(Math.abs(angularAcceleration(dx,dy,inertia,angle,0)*inertia-torque)<.001,shape.id);
  }
 }
});


test('both initial-pose searches find independent lines through the center of every shape',()=>{
 for(const shape of SHAPES){
  const c=centroid(shape.points),turn=secondOrientation(shape,0),directions=[];
  for(const angle of [0,turn]){
   const rc=rotate(c,angle),pin=topAttachment(shape.points,angle,rc.x),dx=c.x-pin.x,dy=c.y-pin.y;
   const inertia=polarMomentPerMass(shape.points)+dx*dx+dy*dy;
   let state={angle,omega:0},maximum=0;
   for(let i=0;i<240;i++){state=swingStep(state.angle,state.omega,1/120,dx,dy,inertia);maximum=Math.max(maximum,Math.abs((state.angle-angle)*180/Math.PI));}
   assert(canRecordPlumbLine(2,maximum),shape.id+' no rotation from release');
   const d=plumbLineDirection(state.angle);directions.push(d);
   assert(Math.abs(dx*d.y-dy*d.x)<1e-7,shape.id+' recorded line contains center');
  }
  assert(Math.abs(directions[0].x*directions[1].y-directions[0].y*directions[1].x)>.999999,shape.id);
 }
});

test('a rotated plate cannot qualify merely by settling later in a different pose',()=>{
 const shape=SHAPES[0],c=centroid(shape.points),b=bounds(shape.points);
 const pin=topAttachment(shape.points,0,b.left+b.width*.12),dx=c.x-pin.x,dy=c.y-pin.y;
 const inertia=polarMomentPerMass(shape.points)+dx*dx+dy*dy;
 let state={angle:0,omega:0},maximum=0;
 for(let i=0;i<2400;i++){state=swingStep(state.angle,state.omega,1/120,dx,dy,inertia);maximum=Math.max(maximum,Math.abs(state.angle*180/Math.PI));}
 assert(Math.abs(state.omega)<.001,'eventually settles');
 assert(maximum>2,'rotated away from release');
 assert.equal(canRecordPlumbLine(20,maximum),false,'eventual rest does not qualify');
 assert.equal(canRecordPlumbLine(0,0),false,'new trial must be observed');
 assert.equal(canRecordPlumbLine(1.49,0),false);
 assert.equal(canRecordPlumbLine(1.5,2),true);
 assert.equal(canRecordPlumbLine(1.5,2.01),false);
});

test('the horseshoe inner pin gives a valid vertical line but a perturbation grows',()=>{
 const shape=SHAPES.find(s=>s.id==='u')!,c=centroid(shape.points),pin=topAttachment(shape.points,0,c.x);
 const dx=c.x-pin.x,dy=c.y-pin.y,inertia=polarMomentPerMass(shape.points)+dx*dx+dy*dy;
 assert.equal(isCenterBelowPin(c,pin,0),false);
 assert.equal(angularAcceleration(dx,dy,inertia,0,0),0);
 const d=plumbLineDirection(0);assert(Math.abs(dx*d.y-dy*d.x)<1e-10);
 let s={angle:.001,omega:0};for(let i=0;i<120;i++)s=swingStep(s.angle,s.omega,1/120,dx,dy,inertia);
 assert(s.angle>.001,'a small tilt increases in unstable equilibrium');
});


test('the fine slider resolves even the unstable inner-edge equilibrium of the L plate',()=>{
 const shape=SHAPES.find(s=>s.id==='l')!,c=centroid(shape.points),b=bounds(shape.points),step=.001,min=b.left+.001;
 const x=min+Math.round((c.x-min)/step)*step,pin=topAttachment(shape.points,0,x),dx=c.x-pin.x,dy=c.y-pin.y;
 const inertia=polarMomentPerMass(shape.points)+dx*dx+dy*dy;
 let s={angle:0,omega:0},maximum=0;
 for(let i=0;i<190;i++){s=swingStep(s.angle,s.omega,1/120,dx,dy,inertia);maximum=Math.max(maximum,Math.abs(s.angle)*180/Math.PI);}
 assert(canRecordPlumbLine(190/120,maximum));
});
