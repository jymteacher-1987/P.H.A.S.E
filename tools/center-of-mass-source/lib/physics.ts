export type Point = { x: number; y: number };
export type Shape = { id: string; name: string; tag: string; points: Point[]; color: string; fact: string };
const points = (values: number[][]): Point[] => values.map(([x,y]) => ({x,y}));
export function centroid(p: Point[]): Point {
  let a = 0, x = 0, y = 0;
  p.forEach((v,i) => {const w=p[(i+1)%p.length]; const c=v.x*w.y-w.x*v.y; a+=c;x+=(v.x+w.x)*c;y+=(v.y+w.y)*c;});
  if (Math.abs(a)<1e-10) throw new Error('Area must be non-zero');
  return {x:x/(3*a),y:y/(3*a)};
}
export function bounds(p: Point[]) { const xs=p.map(v=>v.x),ys=p.map(v=>v.y);const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);return {left,right,top,bottom,width:right-left,height:bottom-top,diagonal:Math.hypot(right-left,bottom-top)}; }
export function inside(p: Point, vs: Point[]) {let hit=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++){const a=vs[i],b=vs[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))hit=!hit;}return hit;}
export function rotate(p: Point, angle: number): Point {return {x:p.x*Math.cos(angle)-p.y*Math.sin(angle),y:p.x*Math.sin(angle)+p.y*Math.cos(angle)};}
// Intersect a vertical ray from above with the rotated plate. The selected
// attachment lies on real material at its upper boundary, never in a cutout.
export function topAttachment(polygon:Point[],angle:number,screenX:number):Point {
 const vertices=polygon.map(p=>rotate(p,angle)),b=bounds(vertices);
 const x=Math.max(b.left+1e-5,Math.min(b.right-1e-5,screenX));
 let y=Infinity;
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],v=vertices[(i+1)%vertices.length];
  if(Math.abs(v.x-a.x)<1e-10)continue;
  const t=(x-a.x)/(v.x-a.x);
  if(t>=-1e-9&&t<=1+1e-9)y=Math.min(y,a.y+t*(v.y-a.y));
 }
 if(!Number.isFinite(y))throw new Error('No attachment on this plate');
 return rotate({x,y},-angle);
}
export function initialOrientation(shape:Shape) {
 const c=centroid(shape.points);
 const supported=(a:number)=>{const rc=rotate(c,a),p=rotate(topAttachment(shape.points,a,rc.x),a);return rc.y-p.y>10;};
 return [0,Math.PI/2,Math.PI,Math.PI*1.5].find(a=>supported(a)&&supported(a+Math.PI/2))??0;
}
// Choose a quarter-turn that leaves material ABOVE the center for the
// second, stable no-rotation search, even for U and crescent-shaped plates.
export function secondOrientation(shape:Shape,firstAngle:number){
 const angle=firstAngle+Math.PI/2,c=rotate(centroid(shape.points),angle);
 const p=rotate(topAttachment(shape.points,angle,c.x),angle);
 return p.y<c.y-1?Math.PI/2:-Math.PI/2;
}
export function plumbLineDirection(recordedAngle:number){return rotate({x:0,y:1},-recordedAngle);}
// Zero torque alone also occurs with the center above the pin (an unstable
// inverted equilibrium). This distinction is feedback, not a line-recording restriction.
export function isCenterBelowPin(center:Point,pin:Point,angle:number){return rotate({x:center.x-pin.x,y:center.y-pin.y},angle).y>1e-6;}
// Both searches observe rotation from the release pose, not eventual rest.
export function canRecordPlumbLine(seconds:number,maxDegrees:number){return seconds>=1.5&&maxDegrees<=2;}
// Polar second moment of area divided by area, shifted to the centroid.
// Uniform density/thickness cancel. Coordinates use millimetres in the swing model.
export function polarMomentPerMass(p: Point[]) {let crossSum=0,moment=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],k=a.x*b.y-b.x*a.y;crossSum+=k;moment+=k*(a.x*a.x+a.x*b.x+b.x*b.x+a.y*a.y+a.y*b.y+b.y*b.y);}const c=centroid(p);return moment/(6*crossSum)-c.x*c.x-c.y*c.y;}
export function angularAcceleration(dx:number,dy:number,inertia:number,angle:number,omega:number){return 9810*(dx*Math.cos(angle)-dy*Math.sin(angle))/inertia-1.8*omega;}
export function swingStep(angle:number,omega:number,dt:number,dx:number,dy:number,inertia:number){
 const a=(t:number,w:number)=>angularAcceleration(dx,dy,inertia,t,w);
 const k1t=omega,k1w=a(angle,omega),k2t=omega+dt*k1w/2,k2w=a(angle+dt*k1t/2,omega+dt*k1w/2),k3t=omega+dt*k2w/2,k3w=a(angle+dt*k2t/2,omega+dt*k2w/2),k4t=omega+dt*k3w,k4w=a(angle+dt*k3t,omega+dt*k3w);
 return {angle:angle+dt*(k1t+2*k2t+2*k3t+k4t)/6,omega:omega+dt*(k1w+2*k2w+2*k3w+k4w)/6};
}
export function suspensionAngle(center: Point,pin: Point) {return Math.PI/2-Math.atan2(center.y-pin.y,center.x-pin.x);}
export function suspensionPins(shape: Shape): Point[] {
  const c=centroid(shape.points);
  const candidates=shape.points.map((v,i)=>{const before=shape.points[(i+shape.points.length-1)%shape.points.length],after=shape.points[(i+1)%shape.points.length];return {x:v.x*.84+(before.x+after.x)*.08,y:v.y*.84+(before.y+after.y)*.08};}).filter(v=>inside(v,shape.points)&&Math.hypot(v.x-c.x,v.y-c.y)>25);
  const a=candidates.reduce((a,b)=>b.y<a.y?b:a);
  const quality=(p: Point)=>Math.abs((a.x-c.x)*(p.y-c.y)-(a.y-c.y)*(p.x-c.x))/(Math.hypot(a.x-c.x,a.y-c.y)*Math.hypot(p.x-c.x,p.y-c.y));
  const b=candidates.reduce((a,b)=>quality(b)>quality(a)?b:a);
  return [a,b];
}
export function scoreGuess(shape: Shape,p: Point) {
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return 0;
  const c=centroid(shape.points),d=Math.hypot(c.x-p.x,c.y-p.y);
  if(d<1e-9)return 100;
  const score=Math.max(0,100*(1-d/(bounds(shape.points).diagonal*.25)));
  return Math.round(score);
}
export function scoreTotal(scores: number[]) {return scores.reduce((a,b)=>a+b,0);}
export function lineThrough(pin: Point,c: Point,length=1000) {const d=Math.hypot(c.x-pin.x,c.y-pin.y),dx=(c.x-pin.x)/d,dy=(c.y-pin.y)/d;return {x1:pin.x-dx*length,y1:pin.y-dy*length,x2:pin.x+dx*length,y2:pin.y+dy*length};}
const star=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2?58:132;return {x:Math.cos(a)*r,y:Math.sin(a)*r};});
const crescent:Point[]=[];
const R=120,r=110,d=45,ix=(R*R-r*r+d*d)/(2*d),iy=Math.sqrt(R*R-ix*ix);
const outer=Math.atan2(iy,ix),inner=Math.atan2(iy,ix-d);
for(let i=0;i<=72;i++){const a=-outer+(-2*Math.PI+2*outer)*i/72;crescent.push({x:R*Math.cos(a)+32,y:R*Math.sin(a)});}
for(let i=1;i<72;i++){const a=inner+(2*Math.PI-2*inner)*i/72;crescent.push({x:d+r*Math.cos(a)+32,y:r*Math.sin(a)});}
export const SHAPES: Shape[] = [
 {id:'triangle',name:'비뚤 삼각형',tag:'첫 번째 발견',color:'#f6bd60',points:points([[-105,105],[-70,-120],[125,85]]),fact:'같은 재질의 삼각형 판은 세 중선이 만나는 곳에 무게중심이 있어요.'},
 {id:'trapezoid',name:'사다리꼴',tag:'넓은 쪽을 관찰해요',color:'#7bc7bb',points:points([[-65,-100],[40,-100],[135,100],[-135,100]]),fact:'두께와 재질이 같다면, 더 넓은 부분에는 더 많은 질량이 있어요.'},
 {id:'kite',name:'비대칭 연',tag:'눈대중은 잠깐',color:'#b9a3e3',points:points([[0,-130],[112,18],[0,105],[-65,18]]),fact:'가장 긴 부분이나 화면의 한가운데가 항상 무게중심인 것은 아니에요.'},
 {id:'arrow',name:'앞으로 화살표',tag:'두 단서를 연결해요',color:'#f2a28e',points:points([[-130,-43],[20,-43],[20,-105],[135,0],[20,105],[20,43],[-130,43]]),fact:'매다는 곳을 바꿔도, 물체에 표시한 무게중심의 위치는 그대로예요.'},
 {id:'l',name:'기역자 블록',tag:'움푹한 곳의 비밀',color:'#89afd8',points:points([[-110,-120],[-42,-120],[-42,48],[120,48],[120,115],[-110,115]]),fact:'오목한 모양에서는 물체가 없는 빈 공간에 무게중심이 놓일 수도 있어요.'},
 {id:'star',name:'다섯 갈래 별',tag:'대칭을 발견해요',color:'#e8bf63',points:star,fact:'같은 두께와 재질로 만든 이 별의 무게중심은 회전 대칭의 중심과 같아요.'},
 {id:'hammer',name:'꼬마 망치',tag:'질량이 모인 쪽',color:'#c3abd1',points:points([[-125,-115],[125,-115],[125,-40],[28,-40],[28,130],[-28,130],[-28,-40],[-125,-40]]),fact:'이 판은 모두 같은 재질이에요. 넓은 망치 머리 부분이 무게중심의 위치에 영향을 줘요.'},
 {id:'u',name:'말굽 블록',tag:'빈 공간도 찍어 봐요',color:'#85b5bc',points:points([[-120,-115],[-60,-115],[-60,55],[60,55],[60,-115],[120,-115],[120,115],[-120,115]]),fact:'찾았나요? 무게중심은 판이 없는 두 팔 사이의 빈 공간에 있어요.'},
 {id:'moon',name:'초승달 조각',tag:'달의 숨은 중심',color:'#efae86',points:crescent,fact:'무게중심은 질량 분포로 정해지는 점이에요. 꼭 재료가 있는 곳일 필요는 없어요.'},
 {id:'island',name:'이상한 섬',tag:'마지막 탐험',color:'#a4bc8c',points:points([[-115,-55],[-80,-110],[-25,-72],[20,-120],[75,-80],[65,-20],[130,25],[85,70],[10,60],[-40,120],[-90,85],[-75,20],[-130,5]]),fact:'모양이 복잡해도 원리는 같아요. 서로 다른 두 점에서 얻은 수직선의 교점을 찾으면 돼요.'},
];
