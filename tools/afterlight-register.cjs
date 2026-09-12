// Register the game in the existing catalogs without changing existing entries or their order.
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const hash=s=>crypto.createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
let html=read('plays/afterlight.html');
for(const name of ['game.js','physics.js','levels.js','music.js','style.css']){
  const url='../assets/afterlight/'+name;
  html=html.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\?v=[^"\\s]+)?','g'),url+'?v='+hash(read('assets/afterlight/'+name)));
}
write('plays/afterlight.html',html);
const version=hash(['plays/afterlight.html','assets/afterlight/game.js','assets/afterlight/physics.js','assets/afterlight/levels.js','assets/afterlight/music.js','assets/afterlight/style.css'].map(read).join('\n'));
const data=JSON.parse(read('data/experiments.json'));
const entry={id:'afterlight',title:'잔광: 마지막 신호',icon:'🌌',description:'빛이 끊긴 도시의 마지막 신호를 복구하세요. 거울·편광판·간섭계를 직접 조작하는 4막 16개 구역의 SF 퍼즐 어드벤처. 자동 저장, 단계별 힌트, 별 기록과 오늘의 회선 도전을 지원합니다.',path:'plays/afterlight.html?v='+version,date:'2026-09-12',tags:['빛','반사','편광','간섭','퍼즐','스토리','과학 놀이']};
data.plays=data.plays.filter(p=>p.id!=='afterlight');
const before=data.plays.findIndex(p=>p.id==='hanbut');
if(before<0)throw new Error('The requested activity hanbut was not found. Review ordering before publication.');
data.plays.splice(before,0,entry);
const json=JSON.stringify(data,null,2)+'\n';write('data/experiments.json',json);const js='window.EXPERIMENTS_DATA = '+json.trimEnd()+';\n';write('assets/js/experiments-data.js',js);
for(const file of ['index.html','lab.html','view.html','admin-k7f3x9q2.html'])write(file,read(file).replace(/assets\/js\/experiments-data\.js(?:\?v=[^"\s]+)?/g,'assets/js/experiments-data.js?v='+hash(js)));
const scenes=JSON.parse(read('tools/preview-scenes.json'));scenes.afterlight={steps:[]};write('tools/preview-scenes.json',JSON.stringify(scenes,null,2)+'\n');
console.log('Registered afterlight immediately before hanbut; '+data.plays.length+' activities. Version '+version);
