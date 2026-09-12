// Exercise the same registered scene interactions and DOM puzzle controls as play.
// No inventory, solved flag or ending function is set directly by this walkthrough.
module.exports = async function walkthrough({id,takeHeart=false}) {
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const check=(value,msg)=>{if(!value)throw Error(id+': '+msg);};
  const click=(q,n=0)=>{const e=document.querySelectorAll(q)[n];check(e,'Missing control '+q+' #'+n);if(e.click)e.click();else e.dispatchEvent(new MouseEvent('click',{bubbles:true}));};
  const many=(q,n,index=0)=>{for(let i=0;i<n;i++)click(q,index);};
  const close=()=>{if(id==='manor'){document.querySelectorAll('.overlay.show button').forEach(b=>{if(/물러나|닫기/.test(b.textContent))b.click();});}else if(id==='prom')closeModal();else closeModal();};
  const act=(q,index=0)=>{
    close();
    if(id==='manor'){currentRoom.interact(q);return;}
    const all=interactables.map(o=>o.userData.ix||o.userData.inter).filter(Boolean);
    const matches=all.filter(o=>String(typeof o.label==='function'?o.label():o.label).includes(q));
    check(matches[index],'Missing scene object '+q+'; available: '+all.map(o=>typeof o.label==='function'?o.label():o.label).join(' / '));
    matches[index].fn();
  };
  const dial=(vals,row='#dRow',submit='#dGo')=>{vals.forEach((v,i)=>many(row+' [data-i="'+i+'"][data-d="1"]',v));click(submit);};
  const keypad=code=>{for(const c of code){const b=[...document.querySelectorAll('#kpGrid button')].find(b=>b.textContent===c);check(b,'key '+c);b.click();} [...document.querySelectorAll('#kpGrid button')].find(b=>b.textContent==='⏎').click();};
  const symbols=values=>{values.forEach((v,i)=>{let steps=0;while(document.getElementById('dialSym'+i).textContent!==v){click('.dialWheel button',i*2);check(++steps<16,'symbol '+v);}});click('#dialCheck');};
  const stages=[];
  if(id==='school'){
    for(const q of ['교탁','사물함','화분 뒤'])act(q);
    act('배전반');await wait(1900);check(G.lightsOn,'school power');
    act('게시판');act('낡은 팻말');act('다음 교실로 이어지는 문 —');click('#dGo');check(!S.solved[0],'wrong school code must fail');dial([3,3,1,5]);check(S.solved[0],'classroom unlocked');stages.push('classroom');
    for(const q of ['선반 위의 종잇조각','의자 밑의 종잇조각','악기함 틈의 종잇조각'])act(q);
    act('피아노 —');click('.pkey',0);for(const n of [4,4,5,5,4,4,2])click('.pkey',n);await wait(800);check(S.solved[1],'piano');stages.push('music');
    act('표본장');act('형광 글씨');act('시약장');for(const n of [0,1,2])click('.vial',n);await wait(600);check(!S.solved[2],'wrong mixture');for(const n of [0,2,1])click('.vial',n);await wait(600);check(S.solved[2],'science');stages.push('science');
    act('900 역사');close();act('900 역사');check(document.body.innerText.includes('윤세아'),'album reread');
    for(const q of ['400 자연과학','600 예술','800 문학'])act(q);
    act('400 자연과학');check(G.cards===3,'no duplicate cards');act('사서 데스크 밑 금고');dial([7,2,9]);check(S.solved[3],'library');stages.push('library');
    act('달력');act('낡은 액자');act('책상 서랍');dial([0,2,1,2]);act('단상 —');click('#nameBtns button',0);click('#dipGo');check(!S.ended,'wrong graduate');click('#nameBtns button',1);many('#mUp',1);many('#dUp',11);click('#dipGo');await wait(8100);check(S.ended&&document.getElementById('ending').style.display==='flex','school ending');stages.push('graduation');
  } else if(id==='wave'){
    act('낡은 현판');act('북쪽 등불');check(G.lanternSeq===0,'wrong lantern');for(const d of ['서','북','동','남'])act(d+'쪽 등불');act('선실 문 —');dial([4,3,7]);check(S.solved[0],'cabin');stages.push('cabin');
    for(const q of ['상자 뒤에 낀','술통 사이의','그물 아래'])act(q);
    act('선체 균형 레일');dial([3,1,3],'#bRow','#scGo');await wait(950);check(S.solved[1],'ballast 5/4/7');stages.push('cargo');
    act('대포 — 어딘가');act('화약 배선반');
    // Connected upper route: inlet -> (0,0) -> (0,1) -> (0,2) -> outlet.
    for(const [i,n] of [[0,3],[1,1],[2,1],[3,3],[5,1]])many('#pGrid .ptile',n,i);
    await wait(1500);check(S.solved[2],'cannon pipe');stages.push('gun deck');
    act('항해일지');act('돛 조율표');act('잠긴 해도 서랍');many('#sailRow [data-i="0"]',1);many('#sailRow [data-i="2"]',2);click('#sailGo');await wait(1000);act('남쪽 하늘의 성도');for(let i=0;i<5;i++)click('#skySvg circle',i);await wait(650);check(S.solved[3]&&G.coins===4,'navigation/seals');stages.push('navigation');
    act('『을』');click('#chOpen');check(!G.goldKey,'wrong chest');act('『갑』');click('#chOpen');act('선장의 벽화');act('벽화 아래의 경구');act('보물 금고의 제단');dial([3,2,1,0],'#aRow','#aGo');check(G.vault,'vault');act('붉은 수염의 보물');await wait(3200);check(S.ended,'wave ending');stages.push('captain');
  } else if(id==='prom'){
    act('승무원 사물함');act('승무원 서열표');act('포드 전원 눈금판');act('격벽 D-1 키패드');
    for(const c of '7294⏎'){const b=[...document.querySelectorAll('#kpG button')].find(b=>b.textContent.trim()===c);check(b,'prom keypad '+c);b.click();}check(G.doorOpen[0],'D1');stages.push('cryosleep');
    act('보안 감사 메모');for(const n of ['ALPHA','BETA','GAMMA'])act('서브루틴 단말기 '+n);act('랙 2 마스터');act('진단 코드 출력');act('ASCII 코드표');act('격벽 D-2 제어');document.getElementById('pwIn').value='HELIOS';click('#pwGo');check(G.doorOpen[1],'D2');stages.push('server');
    act('함장 항해 일지');act('함장의 좌우명');act('행성 관측 데이터');act('행성 정렬 콘솔');for(const n of [4,5,6,7,2,1,3,0])click('.pbtn',n);await wait(1050);act('항법 데이터 칩');act('비상 공구함');check(G.inv.chip&&G.inv.wrench,'equipment');stages.push('bridge');
    act('기밀문 배선 패널');for(const [socket,color] of [2,3,1,0,4].entries()){click('.wchip',color);click('.socket',socket);}click('#wGo');check(G.doorOpen[3],'D4');stages.push('docking');
    act('코어 제어 단말기');click('.qopt',0);check(!G.flags.coreDown,'wrong quiz');
    act('코어 제어 단말기');click('.qopt',1);click('.qopt',1);check(quizIdx===1,'double click must not advance twice');close();await wait(1000);check(!modalOpen,'closed quiz must not reopen');
    act('코어 제어 단말기');for(const n of [1,1,2,2]){click('.qopt',n);await wait(1000);}check(G.flags.coreDown,'core shutdown');act('탈출선 콘솔');close();act('탈출선 콘솔');click('button[onclick="launchPod()"]');await wait(4000);check(G.over,'prom ending');stages.push('pod launch');
  } else if(id==='temple'){
    for(const d of ['동','남','서','북'])act('「'+d+'」의 화로');act('다이얼');dial([4,3,3,6],'#dialRow','#dialGo');await wait(2700);check(S.solved[0],'first temple door');stages.push('glyphs');
    for(const q of ['깨진 항아리','기둥 뒤','마른 샘'])act(q);act('별지도 제단');for(let i=0;i<6;i++)click('#starSvg [data-k="t"][data-i="'+i+'"]');await wait(3700);check(S.solved[1],'stars');stages.push('stars');
    act('청동 저울');for(const i of [0,1,3])click('#stoneRow .dialSlot',i);click('#scaleGo');act('톱니 문');many('#h1',2);many('#h2',1);many('#h3',3);await wait(3500);check(S.solved[2],'rings');stages.push('gears');
    act('제1수문의');dial([2,4,7],'#valveRow','#valveGo');act('수로');
    // Route described by the final hint, using six turns.
    const route=[[0,0,1],[0,1,2],[1,1,0],[2,1,0],[2,2,1],[2,3,3],[1,3,1],[1,4,1],[1,5,2],[2,5,0],[3,5,0]];
    for(const [r,c,target] of route){const turns=(target-pipeGrid[r][c].rot+4)%4;many('#pipeGrid .ptile',turns,r*6+c);}
    await wait(3900);check(S.solved[3]&&S.discs.length===4,'temple water/discs');stages.push('water');
    act('「악어」의 단지');click('#jarOpen');check(!G.keyFound,'wrong jar');act('「매」의 단지');click('#jarOpen');act('받침대');for(const [i,d] of [3,1,2,0].entries()){click('#dpool .dpick',d);click('#slotRow .dslot',i);}click('#discGo');await wait(3600);check(S.ended,'temple ending');stages.push('tomb');
  } else if(id==='apes'){
    act('금속 신분표');act('정비함 M-17');close();act('정비함 M-17');check(document.body.innerText.includes('23:40'),'reread patrol');act('전력 차단기');for(const d of ['달','탑','뼈'])act('감시 중계기 — '+d);act('중앙 기록 단말기');click('#claimSpindle');check(S.solved[0],'quarantine');stages.push('quarantine');
    act('시료 보관함');for(const q of ['생체 반응 기록','폐기 시료','기술자의'])act(q);act('기억 복원 장치');click('#bioRun');check(!G.miraAwake,'wrong wave');for(const i of [0,2,4,6,7,8])click('[data-bio="'+i+'"]');click('#bioRun');await wait(600);check(G.miraAwake&&S.solved[1],'Mira');stages.push('Mira');
    act('증거 보관함');act('증거 보관함');check(document.body.innerText.includes('북쪽 감시탑'),'reread north clue');act('의무 단말기');act('이송 단말기');act('나라의 봉기 인장 —');many('[data-seal="0"]',2);many('[data-seal="1"]',1);many('[data-seal="2"]',2);click('#sealCheck');await wait(450);act('비상 통로 윈치');check(S.solved[2]&&S.tools.has('crank'),'crank carried into next room');stages.push('prison');
    act('냉각 펌프 축');check(!S.tools.has('crank'),'crank installed');act('냉각수 배관 제어');click('#flowCheck');check(!G.pipeSolved,'disconnected water must fail');for(const [i,n] of [[0,1],[1,1],[2,1],[3,2],[5,2]])many('[data-p="'+i+'"]',n);click('#flowCheck');check(S.solved[3]&&G.pipeSolved,'coolant route');const chips=S.chips.length;act('냉각수 배관 제어');check(S.chips.length===chips,'no duplicate power cell');stages.push('reactor');
    for(const q of ['기억 복원 기록','수용동 봉기 기록','최종 통제 기록'])act(q);act('시간선 인증 배열 장치');for(const [i,d] of [1,2,0,3].entries()){click('[data-itempick="'+d+'"]');click('[data-slot="'+i+'"]');}click('#timelineCheck');click('#launchApprove');act('탈출선 조종석');await wait(1300);check(S.ended&&S.chips.length===4,'apes ending');stages.push('launch');
  } else if(id==='manor'){
    act('letter');for(const c of ['red','yellow','blue','green'])act('book_'+c);await wait(800);act('brassKey');act('drawer');act('uvItem');act('diaryItem');act('clock');many('#hourPlus',5);many('#minPlus',6);click('#clockSet');await wait(1600);act('safe');keypad('1937');act('safe');act('rug');act('hatch');await wait(2600);check(G.room===1,'manor study');stages.push('study');
    act('benchNote');act('jar_5');act('fusebox');act('poster');act('blackboard');act('cabinet');keypad('1678');act('cabinet');act('mixstation');many('#mixB',2);many('#mixR',1);many('#mixY',3);click('#mixGo');act('exitdoor');act('exitdoor');await wait(2500);check(G.room===2,'manor lab');stages.push('lab');
    // Solve by displayed orientation labels, not by setting puzzle state.
    for(let i=0;i<4;i++){const target=[1,3,0,2][i];let k=0;while(true){const mesh=interactables.find(o=>o.userData.id==='statue_'+i);check(mesh,'statue mesh');if(mesh.userData.dir===target)break;act('statue_'+i);check(++k<=4,'statue orientation');}}
    await wait(800);act('papyrus');act('scale');click('#choiceBtns button',0);act('scarab');act('sarcophagus');symbols(['👁','🐦','🐍','☥']);act('ankh');act('ankhdoor');await wait(2800);check(G.room===3,'manor relic room');stages.push('relics');
    act('obsnote');act('telescope');act('chart');act('celglobe');keypad('729');act('prism');act('pedestal');for(const c of ['blue','yellow','red','green'])act('lever_'+c);await wait(1100);act('floorhatch');await wait(2400);check(G.room===4,'observatory');stages.push('observatory');
    act('stonedoor');symbols(['📖','⚗','☥','★']);act('pathmural');close();
    // Follow the pressure-plate path through actual room update/collision logic.
    const path=[[0,1],[1,1],[1,2],[2,2],[2,1],[2,0],[3,0]];
    for(const [c,r] of path){player.x=0.2+(c+.5)*.8;player.z=-1.2+(r+.5)*.8;currentRoom.update(.016,1);await wait(40);check(Math.abs(player.x-(.2+(c+.5)*.8))<.01,'safe path tile');}
    player.x=4;player.z=-1;currentRoom.update(.016,2);
    act('finalletter');act('heart');click('#choiceBtns button',takeHeart?0:1);act('stairs');await wait(1700);check(G.ended,'manor ending');stages.push(takeHeart?'collector':'detective');
  }
  return {id,stages,ending:document.querySelector(id==='prom'?'#winOv':'#ending').innerText};
};
