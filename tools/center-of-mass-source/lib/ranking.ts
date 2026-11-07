import {firebaseConfig} from './firebase-config';
import type {Point} from './physics';
export type GameRecord={id?:string;name:string;total:number;ms:number;rounds:{prediction:boolean;shapeId:string;point:Point;score:number;ms:number}[];createdAt:number};
export const onlineEnabled=true;
const KEY='center-lab-records-v2';
export function sortRecords(records:GameRecord[]){return records.sort((a,b)=>b.total-a.total||a.ms-b.ms||a.createdAt-b.createdAt).slice(0,30);}
function localRecords():GameRecord[]{try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter((r:GameRecord)=>typeof r.name==='string'&&Number.isFinite(r.total)&&Number.isFinite(r.ms)&&Array.isArray(r.rounds)&&r.rounds.length===10):[];}catch{return []}}
let clientPromise:ReturnType<typeof connect>|null=null;
async function connect(){const [{initializeApp,getApps},{getAuth,signInAnonymously},{getFirestore}]=await Promise.all([import('firebase/app'),import('firebase/auth'),import('firebase/firestore')]);const app=getApps().find(a=>a.name==='center-lab')||initializeApp(firebaseConfig,'center-lab');const auth=getAuth(app);await auth.authStateReady();const user=auth.currentUser||(await signInAnonymously(auth)).user;return {db:getFirestore(app),uid:user.uid};}
async function client(){if(!clientPromise)clientPromise=connect().catch(e=>{clientPromise=null;throw e});return clientPromise;}
export async function loadRecords(){try{const [{db},{getDocs,query,collection,orderBy,limit}]=await Promise.all([client(),import('firebase/firestore')]);const result=await getDocs(query(collection(db,'centerLabScores'),orderBy('rankKey','desc'),limit(30)));return {records:result.docs.map(d=>{const r=d.data();return {...r,id:d.id,createdAt:r.createdAt?.toMillis?.()||0} as GameRecord;}),message:'Firebase에 저장된 상위 30개 기록'};}catch{const records=sortRecords(localRecords());return {records,message:'온라인 연결 실패 · 이 기기의 기록만 표시합니다.'};}}
export async function saveRecord(record:GameRecord){
 try{localStorage.setItem(KEY,JSON.stringify(sortRecords([...localRecords().filter(r=>r.id!==record.id),record])));}catch{/* Online saving remains available if browser storage is blocked. */}
 try{const [{db,uid},{setDoc,getDoc,doc,serverTimestamp}]=await Promise.all([client(),import('firebase/firestore')]);
  const id=record.id||crypto.randomUUID(),ref=doc(db,'centerLabScores',id);
  for(const [i,part] of ['first','second'].entries()){
   const rounds=record.rounds.slice(i*5,i*5+5);
   const partRef=doc(db,'centerLabRuns',uid,'games',id,'parts',part),data={rounds,total:rounds.reduce((a,r)=>a+r.score,0),ms:rounds.reduce((a,r)=>a+r.ms,0),version:'lamina-v2'};
   try{await setDoc(partRef,data);}catch(e){const existing=(await getDoc(partRef).catch(()=>null))?.data();if(!existing||existing.version!==data.version||existing.total!==data.total||existing.ms!==data.ms||!rounds.every((r,i)=>{const saved=existing.rounds?.[i];return saved&&r.shapeId===saved.shapeId&&r.prediction===saved.prediction&&r.score===saved.score&&r.ms===saved.ms&&r.point.x===saved.point.x&&r.point.y===saved.point.y;}))throw e;}
  }
  const data={name:record.name.slice(0,16),total:record.total,ms:record.ms,uid,version:'lamina-v2',runId:id,rankKey:record.total*10000000000-record.ms,createdAt:serverTimestamp()};
  try{await setDoc(ref,data);}catch(e){const existing=await getDoc(ref).catch(()=>null);if(!existing?.exists()||existing.data().uid!==uid||existing.data().total!==record.total)throw e;}
  return '온라인 랭킹에 기록을 저장했어요!';
 }catch{throw new Error('온라인 저장에 실패했어요. 연결을 확인하고 다시 눌러 주세요.');}
}
