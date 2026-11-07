// Register the static game and preserve every existing activity and its order.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const fromArg=process.argv.indexOf('--from');
const source=fromArg<0?path.join(__dirname,'center-of-mass-source/dist'):path.resolve(process.argv[fromArg+1]);
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const write=(file,text)=>fs.writeFileSync(path.join(root,file),text);
const hash=text=>crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex').slice(0,10);
let html=fs.readFileSync(path.join(source,'index.html'),'utf8').replaceAll('./assets/','../assets/center-of-mass/').replace('<head>','<head>\n<script src="../assets/js/browser-compat.js"></script>');
const assets=path.join(root,'assets/center-of-mass');fs.mkdirSync(assets,{recursive:true});
for(const file of fs.readdirSync(path.join(source,'assets')))fs.copyFileSync(path.join(source,'assets',file),path.join(assets,file));
write('plays/center-of-mass.html',html);
const data=JSON.parse(read('data/experiments.json'));
const entry={id:'center-of-mass',title:'질량중심 탐험',icon:'📍',description:'균일한 판을 직접 매달고, 90° 돌려 두 연장선의 교점으로 질량중심을 찾아보세요. 10가지 모양과 빈 공간의 중심, 정수 점수·온라인 랭킹을 만나는 물리 실험 게임입니다.',path:'plays/center-of-mass.html?v='+hash(html),date:'2026-11-07',tags:['질량중심','무게중심','균형','회전','과학 놀이','랭킹']};
const index=data.plays.findIndex(p=>p.id===entry.id);if(index<0)data.plays.push(entry);else data.plays[index]=entry;
const json=JSON.stringify(data,null,2)+'\n',js='window.EXPERIMENTS_DATA = '+json.trimEnd()+';\n';
write('data/experiments.json',json);write('assets/js/experiments-data.js',js);
for(const file of ['index.html','lab.html','view.html','admin-k7f3x9q2.html'])write(file,read(file).replace(/assets\/js\/experiments-data\.js(?:\?v=[^"\s]+)?/g,'assets/js/experiments-data.js?v='+hash(js)));
console.log('Registered center-of-mass; existing activities preserved.');
