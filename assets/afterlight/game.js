(function () {
  'use strict';
  const P = window.AfterlightPhysics, LEVELS = window.AfterlightLevels;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct = p => (p * 100).toFixed(1).replace(/\.0$/, '') + '%';
  const ACTS = ['01 / 꺼진 도시', '02 / 보이지 않는 문', '03 / 어둠의 정체', '04 / 우리가 연결한 새벽'];
  const KEY = 'phase-afterlight-v1';
  const clone = value => JSON.parse(JSON.stringify(value));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let store = { version:1, completed:{}, checkpoint:null, sound:false, daily:null }, storageOK = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.version === 1) {
      if (raw.completed && typeof raw.completed === 'object') for (let i=0;i<16;i++) {
        const v=raw.completed[i];
        if (v && Number.isFinite(v.stars) && v.stars>=1 && v.stars<=3 && Number.isFinite(v.moves) && v.moves>=0 && Number.isFinite(v.elapsed) && v.elapsed>=0) store.completed[i]={stars:Math.round(v.stars),moves:v.moves,elapsed:v.elapsed};
      }
      if (raw.checkpoint && Number.isInteger(raw.checkpoint.index) && raw.checkpoint.index>=0 && raw.checkpoint.index<16) store.checkpoint=raw.checkpoint;
      store.sound=raw.sound===true;
      if (raw.daily && /^\d{4}-\d{2}-\d{2}$/.test(raw.daily.date) && Number.isFinite(raw.daily.moves)) store.daily={date:raw.daily.date,moves:raw.daily.moves};
    }
  } catch (_) { /* A malformed or blocked save never prevents playing. */ }
  let state=null, level=null, result=null, undo=[], selected=-1, scene='title', ready=false, overlay=false, lastFocus=null;
  let analysis=false, completion=false, toastTimer=0, lastTime=performance.now(), renderTime=0, daily=false, dailyDate='';
  let ctx=$('board').getContext('2d'), audio=null, master=null, musicClock=0, musicStep=0;
  const palette={cyan:'#64f3de',amber:'#ffd38c',violet:'#b8a3ff',blue:'#6b9fff',white:'#e8f2ff',muted:'#8ca4be'};
  function writeStore() { try { localStorage.setItem(KEY,JSON.stringify(store)); storageOK=true; } catch (_) {storageOK=false;} $('saveStatus').textContent=storageOK?'이 기기에 자동 저장':'저장 공간을 사용할 수 없어 이번 실행에서만 기록됩니다'; }
  function checkpoint() { if (state && !daily) store.checkpoint=clone(state); writeStore(); }
  function initAudio() {
    if (!store.sound) return;
    try {
      if (!audio) {const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio=new AC();master=audio.createGain();master.gain.value=.16;master.connect(audio.destination);}
      if (audio.state==='suspended') audio.resume().catch(()=>{});
    }catch(_){}
  }
  function tone(freq=440,duration=.1,type='sine',volume=.3,delay=0) {
    if (!store.sound||!audio||audio.state!=='running'||document.hidden) return;
    try{const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+delay;osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(gain);gain.connect(master);osc.start(at);osc.stop(at+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};}catch(_){}
  }
  function chime() { [261.63,329.63,392,523.25].forEach((n,i)=>tone(n,.6,'sine',.32,i*.1)); }
  function syncSound() { document.querySelectorAll('[data-action=sound]').forEach(b=>{b.textContent=b.closest('#titleScreen')?'소리 '+(store.sound?'ON':'OFF'):(store.sound?'♫':'♪');b.setAttribute('aria-label',store.sound?'소리 끄기':'소리 켜기');b.setAttribute('aria-pressed',String(store.sound));});if(master&&audio)master.gain.setTargetAtTime(store.sound?.16:0,audio.currentTime,.05); }
  function toast(message) {$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3000);}
  function switchScene(next) {scene=next;['title','play','ending'].forEach(s=>$(s==='title'?'titleScreen':s==='play'?'playScreen':'endingScreen').hidden=s!==next);document.body.dataset.mode=next;window.scrollTo(0,0);lastTime=performance.now();}
  function refreshTitle() { $('continueBtn').hidden=!store.checkpoint&&!Object.keys(store.completed).length; $('startBtn').innerHTML=Object.keys(store.completed).length?'첫 구역 다시 탐험 <span>↗</span>':'첫 신호 보내기 <span>↗</span>'; $('dailyBtn').hidden=!store.completed[15]; }
  function baseState(index) {const l=LEVELS[index];return {index,values:l.type==='route'?l.parts.map(p=>p.value??0):l.type==='polar'?l.filters.map(p=>p.angle):[],phase:l.phase||0,gates:l.gates?l.gates.slice():[],moves:0,hints:0,sequenceStep:0,elapsed:0};}
  function validatedCheckpoint(cp,index) {
    const s=baseState(index), l=LEVELS[index];
    if(!cp||cp.index!==index)return s;
    if(Array.isArray(cp.values)&&cp.values.length===s.values.length) s.values=s.values.map((v,i)=>{const n=cp.values[i];if(!Number.isFinite(n))return v;if(l.type==='route')return l.parts[i].locked?v:([0,1].includes(n)?n:v);return l.filters[i].locked?v:((n>=0&&n<180&&n%15===0)?n:v);});
    if(Number.isFinite(cp.phase)&&cp.phase>=0&&cp.phase<360&&cp.phase%15===0)s.phase=cp.phase;
    if(Array.isArray(cp.gates))s.gates=s.gates.map((g,i)=>l.locks[i]?g:typeof cp.gates[i]==='boolean'?cp.gates[i]:g);
    for(const key of ['moves','hints','elapsed'])if(Number.isFinite(cp[key])&&cp[key]>=0&&cp[key]<1e8)s[key]=cp[key];
    if(l.sequence&&Number.isInteger(cp.sequenceStep)&&cp.sequenceStep>=0&&cp.sequenceStep<l.sequence.length)s.sequenceStep=cp.sequenceStep;
    return s;
  }
  function enter(index,restore=false) {
    closeModal(); daily=false;level=LEVELS[index];state=restore?validatedCheckpoint(store.checkpoint,index):baseState(index);undo=[];selected=-1;completion=false;analysis=false;$('analysisBtn').setAttribute('aria-pressed','false');
    switchScene('play');build();checkpoint();initAudio();
  }
  function resume() {
    if(store.checkpoint){const i=store.checkpoint.index;if(store.completed[i]){if(i===15){ending();return;}enter(i+1);}else enter(i,true);}
    else {let i=0;while(i<16&&store.completed[i])i++;i===16?ending():enter(i);}
  }
  function dailyLevel() {
    closeModal();daily=true;dailyDate=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
    let seed=Number(dailyDate.replace(/-/g,''));const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    const candidates=[LEVELS[2],LEVELS[3],LEVELS[12]];level=clone(candidates[Math.floor(rnd()*candidates.length)]);
    if(rnd()>.5){level.source.y=level.rows-1-level.source.y;level.parts.forEach((p,i)=>{p.y=level.rows-1-p.y;if(p.type==='mirror'||p.type==='split'){p.value=1-p.value;if(level.solution[i]!==undefined)level.solution[i]=1-level.solution[i];}});}
    level.title='오늘의 회선';level.place=dailyDate+' · 같은 날, 같은 회선';level.task='모든 수신기를 연결하자. 가장 적은 조작에 도전해 봐.';level.intro=['노아','도시는 다시 깨어났어. 오늘도 회선을 점검할 시간이야. 힌트 없이, 어제보다 적은 조작으로 연결할 수 있을까?'];level.hint=['입력부터 끊긴 빛길을 차근차근 따라가 봐.','분할기는 파워를 절반으로 나눠. 목표값이 큰 수신기를 먼저 연결해 봐.'];level.after='오늘의 광회선 점검 완료. 다음 신호는 내일 다시 도착한다.';
    state={index:0,values:level.parts.map(p=>(p.type==='mirror'||p.type==='split')?Math.floor(rnd()*2):(p.value||0)),phase:0,gates:[],moves:0,hints:0,sequenceStep:0,elapsed:0};
    const r=P.trace(level,state.values);if(level.parts.filter(p=>p.type==='target').every(p=>P.satisfied(r.targets[p.id]||0,p.goal))){const i=level.parts.findIndex(p=>p.type==='split'||p.type==='mirror');state.values[i]=1-state.values[i];}
    level.initialValues=state.values.slice();level.par=Object.entries(level.solution).filter(([i,v])=>state.values[i]!==v).length;undo=[];selected=-1;completion=false;switchScene('play');build();initAudio();
  }
  function goals() {return level.sequence?level.sequence[state.sequenceStep]:level.goals;}
  function evaluate() {
    if(level.type==='route'){result=P.trace(level,state.values);ready=level.parts.filter(p=>p.type==='target').every(p=>P.satisfied(result.targets[p.id]||0,p.goal));}
    else if(level.type==='polar'){result=P.polarize(1,level.axis,state.values);ready=P.satisfied(result.power,level.goal);}
    else{result=P.interferometer(state.phase,+state.gates[0],+state.gates[1]);ready=P.satisfied(result.a,goals()[0])&&P.satisfied(result.b,goals()[1]);}
  }
  function build() {
    $('actLabel').textContent=daily?'DAILY LINK':ACTS[level.act];$('stageLabel').textContent=daily?dailyDate:String(state.index+1).padStart(2,'0')+' / 16';
    $('progressRail').innerHTML=LEVELS.map((l,i)=>'<i class="'+(store.completed[i]?'done ':'')+(!daily&&i===state.index?'current':'')+'"></i>').join('');
    $('placeLabel').textContent=level.place;$('levelTitle').textContent=level.title;$('parLabel').textContent='★★★ 기준 '+level.par+'회';$('speakerName').textContent=level.intro[0];$('speakerAvatar').textContent=level.intro[0]==='노아'?'N':'M';$('speakerAvatar').classList.toggle('mira',level.intro[0]==='미라');$('dialogueText').textContent=level.intro[1];$('taskText').textContent=level.task;$('conceptText').textContent=level.note;
    $('hintBox').hidden=state.hints===0;if(state.hints)$('hintBox').textContent=level.hint[Math.min(state.hints-1,1)];
    $('boardLegend').textContent=level.type==='route'?'청록 거울 / 보라 분할기 · 눌러 회전':level.type==='polar'?'각도는 빛을 정면으로 본 투과축 방향':'같은 광원 · 같은 편광 · 결맞는 두 빛길';
    $('boardWrap').dataset.type=level.type;
    buildControls();update();
  }
  function routeGeometry(){const cell=Math.min(720/level.cols,490/level.rows);return{cell,ox:(840-(level.cols-1)*cell)/2,oy:65+(490-(level.rows-1)*cell)/2};}
  function buildControls() {
    $('boardControls').innerHTML='';$('opticalControls').innerHTML='';
    if(level.type==='route'){
      const {cell,ox,oy}=routeGeometry();
      $('boardControls').innerHTML=level.parts.map((p,i)=>['mirror','split'].includes(p.type)&&!p.locked?'<button class="node-btn" data-action="rotate" data-part="'+i+'" style="left:'+((ox+p.x*cell)/840*100)+'%;top:'+((oy+p.y*cell)/600*100)+'%" aria-label="'+(p.type==='split'?'분할기':'거울')+' '+(i+1)+' 회전"><span class="sr-only">회전</span></button>':'').join('');
    }else if(level.type==='polar'){
      $('opticalControls').innerHTML=level.filters.map((f,i)=>'<div class="dial-control '+(f.locked?'locked':'')+'">'+(!f.locked?'<button data-action="polar" data-part="'+i+'" data-delta="-15" aria-label="편광판 '+(i+1)+' 15도 줄이기">−</button>':'')+'<div><span>편광판 '+(i+1)+(f.locked?' · 고정':'')+'</span><strong id="angle'+i+'"></strong></div>'+(!f.locked?'<button data-action="polar" data-part="'+i+'" data-delta="15" aria-label="편광판 '+(i+1)+' 15도 늘리기">+</button>':'')+'</div>').join('');
    }else{
      $('opticalControls').innerHTML='<div class="dial-control phase-control"><button data-action="phase" data-delta="-15" aria-label="위상차 15도 줄이기">−</button><div><span>두 팔의 위상차 Δφ</span><strong id="phaseValue"></strong></div><button data-action="phase" data-delta="15" aria-label="위상차 15도 늘리기">+</button></div>'+state.gates.map((g,i)=>'<button id="gate'+i+'" class="shutter" data-action="gate" data-part="'+i+'" '+(level.locks[i]?'disabled':'')+'><span>'+(i===0?'위쪽 팔':'아래쪽 팔')+(level.locks[i]?' · 고정':'')+'</span><b></b></button>').join('')+'<div class="phase-tools"><label class="sr-only" for="phaseSlider">위상차 조절</label><input id="phaseSlider" class="phase-slider" type="range" min="0" max="345" step="15" value="'+state.phase+'" aria-label="위상차 조절"><button data-action="phase-set" data-value="0">0°</button><button data-action="phase-set" data-value="90">90°</button><button data-action="phase-set" data-value="180">180°</button></div>';
      let dragging=false,dragRecorded=false;
      $('phaseSlider').addEventListener('pointerdown',()=>{dragging=true;dragRecorded=false;});
      $('phaseSlider').addEventListener('input',e=>{if(overlay||completion)return;const v=Number(e.target.value);if(v===state.phase)return;if(!dragging||!dragRecorded){undo.push(clone(state));state.moves++;dragRecorded=true;}state.phase=v;update();checkpoint();});
      for(const event of ['pointerup','pointercancel','blur'])$('phaseSlider').addEventListener(event,()=>{dragging=false;dragRecorded=false;});
    }
  }
  function receiver(id,name,value,goal){const pass=P.satisfied(value,goal),target=goal[0]>.95?'99% 이상':goal[1]<.02?'1% 이하':pct((goal[0]+goal[1])/2)+' 근처';return '<div class="receiver '+(pass?'pass':'')+'" data-receiver="'+id+'" data-value="'+value+'"><div class="receiver-head"><b>'+name+(pass?' ✓':'')+'</b><strong>'+pct(value)+'</strong></div><div class="power-bar"><i style="width:'+Math.min(100,value*100)+'%"></i></div><small>목표 '+target+'</small></div>';}
  function update() {
    const prev=ready;evaluate();if(!prev&&ready)tone(784,.3,'sine',.15);
    $('moveCount').textContent=String(state.moves).padStart(2,'0');$('undoBtn').disabled=undo.length===0||completion;
    $('sendBtn').disabled=!ready&&!completion;$('sendBtn').textContent=completion?(daily?'지도 보기':state.index===15?'새벽 보기 ↗':'다음 구역으로 ↗'):ready?(level.sequence?'신호 '+(state.sequenceStep+1)+' / 3 전송 ↗':'복구 신호 전송 ↗'):'수신량을 목표에 맞춰 주세요';$('readyBadge').hidden=!ready;
    if(level.type==='route'){
      $('receiverList').innerHTML=level.parts.filter(p=>p.type==='target').map(p=>receiver(p.id,'수신기 '+p.id,result.targets[p.id]||0,p.goal)).join('');
      document.querySelectorAll('.node-btn').forEach(b=>{const i=Number(b.dataset.part);b.classList.toggle('selected',i===selected);b.setAttribute('aria-label',(level.parts[i].type==='split'?'분할기':'거울')+' '+(i+1)+' '+(state.values[i]===0?'/':'＼')+' 방향. 눌러 회전');b.dataset.value=state.values[i];});
      $('measurements').innerHTML='<strong>입력 100%</strong><br>수신기 합계 '+pct(Object.values(result.targets).reduce((a,b)=>a+b,0))+' · 벽/흡수체 '+pct(result.absorbed)+'<br>화면 밖 '+pct(result.escaped)+(result.unresolved>0?'<br>닫힌 경로: '+pct(result.unresolved)+' (정상상태 계산 제외)':'')+'<br>반사각 = 입사각 = 45° (법선 기준)';
    }else if(level.type==='polar'){
      state.values.forEach((v,i)=>$('angle'+i).textContent=v+'°');$('receiverList').innerHTML=receiver('A','최종 수신기',result.power,level.goal);
      $('measurements').innerHTML='<strong>입력 100% · '+(level.axis===null?'비편광':level.axis+'° 선편광')+'</strong><br>'+result.stages.map((s,i)=>'편광판 '+(i+1)+': '+pct(s.before)+' → '+pct(s.after)).join('<br>')+'<br>총 흡수 '+pct(result.absorbed)+' · 주파수는 그대로';
    }else{
      $('phaseValue').textContent=state.phase+'°';$('phaseSlider').value=state.phase;
      state.gates.forEach((g,i)=>{$('gate'+i).classList.toggle('closed',!g);$('gate'+i).querySelector('b').textContent=g?'셔터 열림':'셔터 닫힘';$('gate'+i).setAttribute('aria-pressed',String(!g));$('gate'+i).setAttribute('aria-label',(i===0?'위쪽':'아래쪽')+' 셔터 '+(g?'닫기':'열기'));});
      $('receiverList').innerHTML=receiver('A','출구 A',result.a,goals()[0])+receiver('B','출구 B',result.b,goals()[1]);
      if(level.sequence)$('taskText').textContent='마지막 신호 '+(state.sequenceStep+1)+' / 3 · '+['B에 전부 보내기','A에 전부 보내기','두 곳에 절반씩 보내기'][state.sequenceStep];
      $('measurements').innerHTML='<strong>입력 100% · Δφ = '+state.phase+'°</strong><br>A '+pct(result.a)+' + B '+pct(result.b)+' + 흡수 '+pct(result.absorbed)+' = 100%<br>'+(state.gates.every(Boolean)?'A = sin²(Δφ/2), B = cos²(Δφ/2)':'한 팔만 열리면 위상차와 무관하게 A = B = 25%. 두 팔 모두 닫으면 0%.')+'<br>두 팔의 편광·주파수는 같음';
    }
    $('measurements').hidden=!analysis;
    draw(performance.now()/1000);
  }
  function mutate(fn,kind='turn') {
    if(scene!=='play'||overlay||completion)return;
    undo.push(clone(state));if(undo.length>200)undo.shift();fn();state.moves++;tone(kind==='gate'?180:420+((state.moves%4)*80),.1,'sine',.2);update();checkpoint();
  }
  function hint() {if(!state||completion)return;state.hints=Math.min(state.hints+1,2);$('hintBox').hidden=false;$('hintBox').textContent=level.hint[state.hints-1];checkpoint();tone(330,.12);}
  function send() {
    if(overlay)return;
    if(completion){if(daily)map();else if(state.index===15)ending();else enter(state.index+1);return;}
    if(!ready)return;
    chime();
    if(level.sequence&&state.sequenceStep<level.sequence.length-1){state.sequenceStep++;undo=[];update();checkpoint();toast('신호 '+state.sequenceStep+' 수신 완료. 다음 목표를 확인하세요.');return;}
    completion=true;
    const stars=state.hints>0?1:state.moves<=level.par?3:2;
    if(daily){if(!store.daily||store.daily.date!==dailyDate||state.moves<store.daily.moves)store.daily={date:dailyDate,moves:state.moves};writeStore();}
    else{const old=store.completed[state.index];if(!old||stars>old.stars||(stars===old.stars&&state.moves<old.moves))store.completed[state.index]={stars,moves:state.moves,elapsed:state.elapsed};checkpoint();}
    update();refreshTitle();
    modal(daily?'회선 점검 완료':state.index===15?'도시의 응답이 도착했습니다':'신호 수신 완료','<div class="success-mark">'+(daily?'DAILY LINK RESTORED':'SECTOR '+String(state.index+1).padStart(2,'0')+' RESTORED')+'</div><div class="success-rating" aria-label="별 '+stars+'개">'+'★'.repeat(stars)+'<span style="opacity:.2">'+'★'.repeat(3-stars)+'</span></div><div class="success-detail">'+state.moves+'회 조작 · '+formatTime(state.elapsed)+' · '+(state.hints?'힌트 사용':'힌트 없이 복구')+'</div><p>'+esc(level.after)+'</p><div class="success-concept">'+esc(level.note)+'</div><div class="modal-buttons"><button class="primary" data-action="next">'+(daily?'지도 보기':state.index===15?'새벽 보기 ↗':'다음 구역으로 ↗')+'</button><button class="secondary" data-action="replay">다시 도전</button></div>');
  }
  function formatTime(ms){const sec=Math.floor(ms/1000);return Math.floor(sec/60)+'분 '+String(sec%60).padStart(2,'0')+'초';}
  function modal(title,body) {
    if(!overlay)lastFocus=document.activeElement;overlay=true;$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('modal').hidden=false;$('app').setAttribute('aria-hidden','true');if('inert' in $('app'))$('app').inert=true;
    requestAnimationFrame(()=>{const first=$('modalBody').querySelector('button:not(:disabled),a[href]');(first||$('modalClose')).focus({preventScroll:true});});
  }
  function closeModal() {if(!overlay)return;overlay=false;$('modal').hidden=true;$('app').removeAttribute('aria-hidden');if('inert' in $('app'))$('app').inert=false;if(lastFocus&&lastFocus.isConnected)lastFocus.focus({preventScroll:true});lastTime=performance.now();}
  function map() {
    let body='<p>수신 완료한 구역은 언제든 다시 탐험할 수 있어요.<br>★ 복구 완료 · ★★ 힌트 없이 · ★★★ 기준 조작 수 이내</p>';
    for(let a=0;a<4;a++){body+='<div class="map-act"><span>'+ACTS[a]+'</span><span>'+LEVELS.filter((l,i)=>l.act===a&&store.completed[i]).length+' / 4 연결</span></div><div class="map-grid">';for(let n=0;n<4;n++){const i=a*4+n,record=store.completed[i],unlocked=i===0||store.completed[i-1]||record;body+='<button class="map-node" data-action="level" data-index="'+i+'" '+(unlocked?'':'disabled')+'><span>'+String(i+1).padStart(2,'0')+(unlocked?'':' · 잠김')+'</span><strong>'+esc(LEVELS[i].title)+'</strong><small>'+(record?'★'.repeat(record.stars)+' · '+record.moves+'회':'미연결')+'</small></button>';}body+='</div>';}
    if(store.completed[15])body+='<div class="modal-buttons"><button class="primary" data-action="daily">오늘의 회선</button><button class="secondary" data-action="ending">엔딩 다시 보기</button></div>';
    modal('도시의 신호 지도',body);
  }
  function pause() {checkpoint();modal('잠시, 숨 고르기','<p>회선은 그대로 기다립니다. 시간 기록도 잠시 멈췄어요.</p><div class="pause-grid"><button class="primary" data-action="close">계속하기</button><button class="secondary" data-action="map">구역 지도</button><button class="secondary" data-action="archive">광학 기록</button><button class="secondary" data-action="home">시작 화면으로</button></div><p style="font-size:12px">터치 또는 클릭으로 조절 · Tab으로 장치 선택 · Enter/Space로 조작 · Z 되돌리기 · H 힌트 · Esc 일시 정지</p>');}
  function ending() {closeModal();const records=Object.values(store.completed);$('endingStats').innerHTML='<div><strong>'+records.length+' / 16</strong><span>연결된 구역</span></div><div><strong>'+records.reduce((n,r)=>n+r.stars,0)+' / 48</strong><span>신호 별</span></div><div><strong>'+formatTime(records.reduce((n,r)=>n+r.elapsed,0))+'</strong><span>저장된 구역 기록 합계</span></div>';switchScene('ending');chime();}
  const ARCHIVE=[
    {name:'반사 · 분할',body:'<h3>방향을 바꿔도, 빛을 복제하지 않는다</h3><p>반사각과 입사각은 모두 거울 표면에 수직인 선, 즉 <strong>법선</strong>에서 잽니다. 게임의 대각선 거울에 수평·수직 광선이 들어오면 두 각은 모두 45°입니다.</p><div class="formula">θ입사 = θ반사</div><p>50:50 분할기는 들어온 광학 파워를 직진과 반사 경로로 절반씩 보냅니다. 하나의 광자를 반으로 잘라 그리는 모형이 아닙니다.</p><div class="formula">P직진 + P반사 = P입력</div><p>경로 퍼즐은 간섭하지 않는 서로 다른 수신 경로를 연결하는 광선 모형입니다. 빛길은 벽·수신기에 닿으면 흡수되고, 장치 없는 교차점에서는 서로 영향을 주지 않습니다. 여러 결맞는 빔의 재결합은 뒤의 전용 간섭계에서 계산합니다.</p><p><a href="https://openstax.org/books/college-physics-2e/pages/25-2-the-law-of-reflection" target="_blank" rel="noopener noreferrer">OpenStax · 반사 법칙 ↗</a></p>'},
    {name:'편광',body:'<h3>빛의 진행 방향과 진동 방향은 다르다</h3><p>편광은 전기장의 진동 방향과 관련됩니다. 전기장은 빛이 진행하는 방향에 수직입니다. 게임의 원형 그림은 <strong>빛을 정면에서 본 투과축</strong>이며, 광선의 진행 경로를 나타내는 각도가 아닙니다. 판 사이에서 편광 방향이 저절로 조금씩 바뀌는 것도 아닙니다.</p><div class="formula">P출력 = P입력 cos²θ</div><p>이 식은 입사광이 선편광일 때 적용합니다. θ는 입사 편광과 편광판 투과축 사이의 각도입니다. 통과 후의 빛은 투과축 방향으로 선편광됩니다. 비편광 입력은 첫 이상적 선형 편광판에서 평균 파워의 절반이 통과합니다.</p><table class="archive-table"><tr><th>선편광 0°의 진행 순서</th><th>최종 파워</th></tr><tr><td>90° 판</td><td>0%</td></tr><tr><td>45° → 90° 판</td><td>25%</td></tr><tr><td>30° → 60° → 90° 판</td><td>42.1875%</td></tr></table><p>이 게임은 이상적인 흡수형 편광판을 사용합니다. 줄어든 광학 파워는 흡수되며, 투과된 빛의 주파수가 낮아져서 어두워지는 것이 아닙니다.</p><p><a href="https://openstax.org/books/university-physics-volume-3/pages/1-7-polarization" target="_blank" rel="noopener noreferrer">OpenStax · 편광과 말뤼스 법칙 ↗</a></p>'},
    {name:'간섭',body:'<h3>어두운 출구는 에너지의 소멸이 아니다</h3><p>마흐–젠더 간섭계는 같은 광원에서 나눈 결맞는 두 빛을 다시 합칩니다. 여기서는 같은 주파수·편광, 이상적 50:50 분할기 두 개와 거울을 가정합니다. 두 출구 A·B를 항상 함께 표시합니다.</p><div class="formula">PA = P입 sin²(Δφ/2)<br>PB = P입 cos²(Δφ/2)</div><p>이 식은 두 팔이 모두 열려 있을 때의 <strong>이 장치의 위상 기준</strong>입니다. Δφ=0°에서 B가 밝도록 정했습니다. 출구 표기와 고정 반사 위상의 기준에 따라 A·B 식을 바꿔 쓰기도 합니다. 분할기의 반사·투과 위상을 포함해 계산했습니다.</p><p>한 팔을 닫으면 입력 파워의 50%는 그 셔터에 흡수됩니다. 남은 50%는 마지막 분할기에서 갈라져 A와 B에 25%씩 도착하고, 위상차를 바꿔도 출력은 변하지 않습니다.</p><div class="formula">PA + PB + P흡수 = P입력</div><p>실제 장치의 대비는 결맞음, 정렬, 편광, 손실 등에 제한됩니다. 게임은 고전적인 파동 모형이며 양자 측정이나 광자 검출 확률 실험을 재현하지 않습니다.</p><p><a href="https://link.springer.com/article/10.1007/s00340-021-07680-z" target="_blank" rel="noopener noreferrer">Applied Physics B · 광학 분할기와 마흐–젠더 간섭계 ↗</a></p>'},
    {name:'모형 · 조작',body:'<h3>이 게임이 보여주는 것</h3><p>게임 속 빛은 <strong>통신 신호</strong>입니다. 도시의 전력은 비상 전력망에서 공급합니다. 레이저 파워의 배분과 데이터 전송량을 동일한 물리량으로 취급하지 않습니다.</p><ul><li>모든 백분율은 광원의 입력 광학 파워를 100%로 한 값입니다. 빔 단면적을 일정하게 가정할 때 세기의 비율과 같습니다.</li><li>움직이는 짧은 빛무늬는 경로를 읽기 위한 연출입니다. 실제 빛의 속도, 개별 광자, 전기장의 진동 속도를 표현하지 않습니다.</li><li>청록·보라·황금색은 장치와 출구를 구분하는 표시색입니다. 색 변화로 파장이나 주파수를 바꾸는 게임이 아닙니다.</li><li>장치 사이 거리는 실제 축척이 아닙니다. 간섭계의 위상 조절은 광학적 경로차 등을 바꾸는 장치의 제어값을 나타냅니다. 진공 파장 λ에 대해 Δφ=2πΔ(광학적 경로길이)/λ입니다.</li><li>회절, 거울의 실제 반사 손실, 편광판의 불완전성은 생략했습니다. 이상적인 모형과 실제 장치의 차이를 구분해 주세요.</li><li>수신기 목표 범위와 세 번의 최종 전송은 게임 규칙입니다. 광학 계산 결과 자체는 같은 물리 식으로 판정합니다.</li></ul><h3>조작과 저장</h3><p>거울·분할기는 누르면 회전합니다. 편광판은 ±로 15°씩 돌립니다. 간섭계는 ±·슬라이더·각도 버튼으로 위상차를 조절하고 셔터를 여닫습니다. 목표를 맞춘 뒤 <strong>복구 신호 전송</strong>을 눌러 확정합니다.</p><p>Tab으로 장치나 버튼을 선택한 뒤 Enter/Space로 조작할 수 있습니다. Z: 되돌리기, H: 힌트, Esc: 일시 정지. 힌트는 별 기록에만 영향을 주며, 다음 구역이나 엔딩을 막지 않습니다. 저장은 이 브라우저의 이 기기에 남습니다. 사이트 데이터 삭제·비공개 모드에서는 기록이 유지되지 않을 수 있습니다.</p><p>원화: 내장 이미지 생성 도구로 제작한 오리지널 배경. 게임 음악과 효과음: 이 게임에서 합성한 음원.</p>'}
  ];
  function archive(tab=0) {modal('광학 기록','<nav class="archive-nav" aria-label="광학 기록 주제">'+ARCHIVE.map((a,i)=>'<button data-action="archive-tab" data-index="'+i+'" class="'+(i===tab?'active':'')+'">'+a.name+'</button>').join('')+'</nav><div class="archive-content">'+ARCHIVE[tab].body+'</div>');}
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;
    if(overlay&&!b.closest('#modal'))return;
    if(action==='sound'){store.sound=!store.sound;initAudio();syncSound();writeStore();return;}
    if(action==='start'){enter(0);return;}if(action==='continue'){resume();return;}if(action==='daily'){dailyLevel();return;}
    if(action==='home'){checkpoint();closeModal();switchScene('title');refreshTitle();return;}
    if(action==='map'){map();return;}if(action==='archive'){archive(level?({route:0,polar:1,interference:2}[level.type]):0);return;}if(action==='archive-tab'){archive(Number(b.dataset.index));return;}
    if(action==='close'){closeModal();return;}if(action==='pause'){pause();return;}if(action==='ending'){ending();return;}
    if(action==='level'){enter(Number(b.dataset.index));return;}if(action==='next'){if(daily){map();return;}state.index===15?ending():enter(state.index+1);return;}
    if(action==='replay'){daily?dailyLevel():enter(state.index);return;}
    if(!state)return;
    if(action==='rotate'){const i=Number(b.dataset.part);selected=i;mutate(()=>state.values[i]=1-state.values[i]);}
    if(action==='polar'){const i=Number(b.dataset.part),d=Number(b.dataset.delta);mutate(()=>state.values[i]=(state.values[i]+d+180)%180);}
    if(action==='phase')mutate(()=>state.phase=(state.phase+Number(b.dataset.delta)+360)%360);
    if(action==='phase-set'){const v=Number(b.dataset.value);if(state.phase!==v)mutate(()=>state.phase=v);}
    if(action==='gate'){const i=Number(b.dataset.part);mutate(()=>state.gates[i]=!state.gates[i],'gate');}
    if(action==='send')send();
    if(action==='undo'&&undo.length&&!completion){const hintsUsed=state.hints,time=state.elapsed;state=undo.pop();state.hints=Math.max(hintsUsed,state.hints);state.elapsed=time;update();checkpoint();tone(300,.12);}
    if(action==='hint')hint();
    if(action==='analysis'){analysis=!analysis;b.setAttribute('aria-pressed',String(analysis));update();}
    if(action==='reset'){modal('이 회선을 처음부터 맞출까요?','<p>이 구역의 배치와 조작 횟수만 초기화합니다. 이미 복구한 구역과 별 기록은 남습니다.</p><div class="modal-buttons"><button class="primary" data-action="replay">이 구역 다시 시작</button><button class="secondary" data-action="close">계속 풀기</button></div>');}
  });
  document.addEventListener('keydown',e=>{
    if(overlay){if(e.key==='Escape'){e.preventDefault();closeModal();return;}if(e.key==='Tab'){const list=Array.from($('modal').querySelectorAll('button:not(:disabled),a[href],input')).filter(el=>el.offsetParent!==null),first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
    if(scene!=='play'||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='Escape'){e.preventDefault();pause();return;}
    if(e.target.tagName==='INPUT')return;
    if(e.key.toLowerCase()==='h'){e.preventDefault();hint();}
    if(e.key.toLowerCase()==='z'){e.preventDefault();$('undoBtn').click();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){checkpoint();if(audio)audio.suspend().catch(()=>{});}else{lastTime=performance.now();if(store.sound&&audio)audio.resume().catch(()=>{});}});
  window.addEventListener('pagehide',checkpoint);
  // Canvas renderer: the paths and components are functional diagrams, not to-scale apparatus.
  function line(points,color,width=3,alpha=1,glow=0){ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=color;ctx.shadowBlur=glow;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();}
  function rect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
  function circle(x,y,r,fill,stroke,width=1){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function label(text,x,y,size=14,color=palette.muted,align='center',weight=500){ctx.font=weight+' '+size+'px Inter,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,x,y);}
  function beam(points,power,time,colour=palette.cyan){
    line(points,'#244256',2,.6);
    if(power<1e-8)return;
    const alpha=.2+.8*Math.sqrt(power),width=1.5+3*Math.sqrt(power);
    line(points,colour,width+6,alpha*.13,16);line(points,colour,width,alpha,10);line(points,'#dcfff9',Math.max(1,width*.27),alpha*.85);
    if(!reduced){let total=0;const lens=[];for(let i=1;i<points.length;i++){const d=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);lens.push(d);total+=d;}if(total>0){const dist=(time*70)%total;let d=dist;for(let i=0;i<lens.length;i++){if(d<=lens[i]){const r=d/lens[i],x=points[i][0]+(points[i+1][0]-points[i][0])*r,y=points[i][1]+(points[i+1][1]-points[i][1])*r;circle(x,y,2+power, '#e7fffc');break;}d-=lens[i];}}}
  }
  function target(x,y,id,power,goal){const pass=P.satisfied(power,goal);circle(x,y,27,'#122634',pass?palette.cyan:'#57708a',2);circle(x,y,20,pass?'#17504b':'#192f42');if(power>0){ctx.save();ctx.globalAlpha=.3+power*.4;ctx.shadowColor=palette.cyan;ctx.shadowBlur=20;circle(x,y,18,null,palette.cyan,2);ctx.restore();}label(id,x,y,20,pass?'#baffee':'#a4bbd4','center',700);label(pct(power),x,y+41,13,pass?palette.cyan:palette.muted);}
  function mirror(x,y,slash,split=false,index=-1){
    const color=split?palette.violet:palette.cyan;
    rect(x-23,y-23,46,46,8,split?'#282342':'#18313d',split?'#625483':'#3c6872');
    const y1=slash===0?15:-15,y2=-y1;line([[x-15,y+y1],[x+15,y+y2]],'#071522',8);line([[x-15,y+y1],[x+15,y+y2]],color,split?3:5,1,8);
    if(split){line([[x-15,y+y1-4],[x+15,y+y2-4]],'#ebdfff',1,.45);label('½',x+26,y-24,13,color);}
    circle(x,y,3,'#f5ffff');
    if(analysis&&index>=0){label(String(index+1),x-25,y+26,11,palette.amber);const normal=slash===0?[[x-23,y-23],[x+23,y+23]]:[[x-23,y+23],[x+23,y-23]];ctx.save();ctx.setLineDash([3,4]);line(normal,palette.amber,1,.8);ctx.restore();}
  }
  function source(x,y,vertical=false){rect(x-29,y-24,58,48,9,'#213948','#528494');rect(x+24,y-11,10,22,3,'#609eac');circle(x-3,y,10,'#285767',palette.cyan);line([[x-7,y],[x+6,y]],palette.cyan,2);label('광원',x,y-40,14,palette.white);label('100%',x,y+41,13,palette.cyan);}
  function gridBackground(){
    ctx.fillStyle='#0c1726';ctx.fillRect(0,0,840,600);
    const grad=ctx.createRadialGradient(420,260,0,420,260,550);grad.addColorStop(0,'#19374c66');grad.addColorStop(1,'#07101e00');ctx.fillStyle=grad;ctx.fillRect(0,0,840,600);
    ctx.fillStyle='#294255';for(let x=30;x<840;x+=30)for(let y=30;y<600;y+=30)ctx.fillRect(x,y,1.2,1.2);
    const marks=[[[14,36],[14,14],[36,14]],[[804,14],[826,14],[826,36]],[[14,564],[14,586],[36,586]],[[804,586],[826,586],[826,564]]];marks.forEach(p=>line(p,'#406077',1,.7));
  }
  function drawRoute(time){
    const {cell,ox,oy}=routeGeometry(),xy=(x,y)=>[ox+x*cell,oy+y*cell];
    for(let x=0;x<level.cols;x++)for(let y=0;y<level.rows;y++){const [px,py]=xy(x,y);rect(px-cell*.42,py-cell*.42,cell*.84,cell*.84,6,'#15253833','#233b4b66');}
    ctx.save();ctx.beginPath();ctx.rect(20,45,800,510);ctx.clip();
    result.segments.forEach(s=>beam([xy(s.x1,s.y1),xy(s.x2,s.y2)],s.power,time));ctx.restore();
    level.parts.forEach((p,i)=>{const [x,y]=xy(p.x,p.y);if(p.type==='mirror'||p.type==='split')mirror(x,y,state.values[i],p.type==='split',i);else if(p.type==='target')target(x,y,p.id,result.targets[p.id]||0,p.goal);else{rect(x-cell*.4,y-cell*.4,cell*.8,cell*.8,5,'#233243','#3b4e61');ctx.save();ctx.beginPath();ctx.rect(x-cell*.4,y-cell*.4,cell*.8,cell*.8);ctx.clip();for(let n=-40;n<80;n+=13)line([[x-40+n,y-40],[x+40+n,y+40]],'#354659',3);ctx.restore();}});
    source(...xy(level.source.x,level.source.y));
    label('입력 광학 파워 기준',420,563,12,'#6c8ba3');
  }
  function axisDisc(x,y,angle,power,r=40){
    circle(x,y,r,'#112837','#4c7185',1.5);ctx.save();ctx.beginPath();ctx.arc(x,y,r-3,0,Math.PI*2);ctx.clip();ctx.translate(x,y);ctx.rotate(-angle*Math.PI/180);for(let n=-r;n<=r;n+=10)line([[-r,n],[r,n]],'#3a7285',2,.5);line([[-r+6,0],[r-6,0]],palette.cyan,4,.5+.5*power,7);ctx.restore();circle(x,y,r+6,null,'#294556',1);
  }
  function drawPolar(time){
    const n=state.values.length,xs=state.values.map((_,i)=>220+i*(400/Math.max(n-1,1))),sourceX=85,targetX=752;
    if(n===1)xs[0]=420;
    label('광학 장치를 위에서 펼친 배치도',420,60,14,palette.muted);
    const by=252;let last=sourceX,power=1;
    state.values.forEach((angle,i)=>{beam([[last,by],[xs[i],by]],power,time);last=xs[i];power=result.stages[i].after;});beam([[last,by],[targetX,by]],power,time);
    source(sourceX,by);label(level.axis===null?'비편광':level.axis+'° 선편광',sourceX,by+70,14,palette.white);
    state.values.forEach((angle,i)=>{rect(xs[i]-13,by-63,26,126,6,'#203d50','#6c9caf');line([[xs[i],by-52],[xs[i],by+52]],palette.cyan,2,.8);rect(xs[i]-27,by+62,54,10,2,'#345064');label('편광판 '+(i+1),xs[i],by-90,16,palette.white);label(pct(result.stages[i].after),xs[i],by+101,16,palette.cyan);});
    target(targetX,by,'A',result.power,level.goal);
    label('아래 원은 빛을 정면으로 본 모습 · 투과축의 방향',420,408,14,palette.muted);
    state.values.forEach((angle,i)=>{axisDisc(xs[i],489,angle,result.stages[i].after,35);label(angle+'°'+(level.filters[i].locked?' 고정':''),xs[i],550,16,level.filters[i].locked?palette.muted:palette.cyan);});
    if(level.axis===null){circle(sourceX,489,29,'#112837','#4c7185');for(let k=0;k<6;k++){const a=k*Math.PI/6;line([[sourceX-22*Math.cos(a),489-22*Math.sin(a)],[sourceX+22*Math.cos(a),489+22*Math.sin(a)]],palette.amber,1.2,.65);}label('여러 편광 방향',sourceX,550,12,palette.muted);}else{axisDisc(sourceX,489,level.axis,1,28);label('입사 '+level.axis+'°',sourceX,550,13,palette.muted);}
  }
  function drawInterference(time){
    const sx=78, left=237,right=596,upper=160,lower=420;
    beam([[sx,lower],[left,lower]],1,time);
    beam([[left,lower],[left,upper],[374,upper]],.5,time);
    beam([[left,lower],[374,lower]],.5,time);
    beam([[374,upper],[right,upper]],result.upper,time);
    beam([[374,lower],[right,lower],[right,upper]],result.lower,time);
    beam([[right,upper],[752,upper]],result.b,time,palette.amber);
    beam([[right,upper],[right,63]],result.a,time,palette.cyan);
    mirror(left,lower,0,true);mirror(left,upper,0);mirror(right,lower,0);mirror(right,upper,0,true);
    source(sx,lower);target(752,upper,'B',result.b,goals()[1]);target(right,63,'A',result.a,goals()[0]);
    label('분할',left,lower+49,14,palette.violet);label('재결합',right+1,upper+52,14,palette.violet);
    [upper,lower].forEach((y,i)=>{const open=state.gates[i];rect(357,y-24,34,48,5,open?'#143d3d':'#552b3c',open?'#4a9387':'#cf8191');if(!open)line([[363,y-16],[385,y+16]],'#ffa9ba',4);else line([[374,y-14],[374,y+14]],'#6bfdde',2,.6);label(open?'열림':'흡수',374,y+43,13,open?palette.cyan:'#ffb9bf');});
    rect(423,upper-32,91,64,9,'#252847','#8c82b9');label('위상 조절',468,upper-9,13,palette.violet);label(state.phase+'°',468,upper+13,20,'#e6dfff');
    label('위쪽 팔',280,106,13,palette.muted);label('아래쪽 팔',453,lower-52,13,palette.muted);
    const centreY=297;rect(295,centreY-31,225,64,8,'#0c1c2c','#31485e');label('A + B + 흡수 = 100%',408,centreY-8,15,palette.white);label('셔터 흡수 '+pct(result.absorbed),408,centreY+16,13,result.absorbed>0?'#ffb9bf':palette.cyan);
    label('두 출구의 파워를 함께 관찰하세요.',420,544,15,palette.muted);
    if(analysis){label('각 팔로 50%',109,510,13,palette.violet);label('고정 반사 위상을 포함한 위상 기준',420,572,12,palette.muted);}
  }
  function draw(time){if(!state||!level||!result)return;ctx.clearRect(0,0,840,600);gridBackground();if(level.type==='route')drawRoute(time);else if(level.type==='polar')drawPolar(time);else drawInterference(time);}
  function frame(now){
    const dt=Math.min(100,now-lastTime);lastTime=now;
    if(scene==='play'&&!overlay&&!completion&&!document.hidden){state.elapsed+=dt;if(now-renderTime>(reduced?500:33)){renderTime=now;draw(now/1000);}if(now-musicClock>950){musicClock=now;const notes=[130.81,196,261.63,196,164.81,220,293.66,220];tone(notes[musicStep++%8],1.6,'sine',.055);}}
    requestAnimationFrame(frame);
  }
  syncSound();refreshTitle();requestAnimationFrame(frame);
})();
