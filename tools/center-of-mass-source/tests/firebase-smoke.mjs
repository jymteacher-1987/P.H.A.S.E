// Explicit opt-in integration check: writes only this anonymous user's private
// diagnostic record, never a leaderboard entry. No credentials are logged.
import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,signInAnonymously} from 'firebase/auth';
import {getFirestore,doc,setDoc,getDoc,getDocs,collection,query,orderBy,limit,serverTimestamp,terminate} from 'firebase/firestore';
import {firebaseConfig} from '../lib/firebase-config.ts';
import {SHAPES,centroid,scoreGuess,bounds} from '../lib/physics.ts';
if(process.env.CENTER_LAB_FIREBASE_CHECK!=='1')throw new Error('Set CENTER_LAB_FIREBASE_CHECK=1 to opt in.');
const timeout=setTimeout(()=>{console.error('Firebase diagnostic timed out');process.exit(1)},35000);
const app=initializeApp(firebaseConfig,'diagnostic-'+Date.now()),db=getFirestore(app);
try {
 const {user}=await signInAnonymously(getAuth(app));
 const rounds=SHAPES.map((s,i)=>{const c=centroid(s.points),point={x:c.x+3+i,y:c.y-2};return {prediction:true,shapeId:s.id,point,score:scoreGuess(s,point),ms:2000};});
 const total=rounds.reduce((a,r)=>a+r.score,0),ms=20000;
 const data={name:'연결 검증',total,ms,uid:user.uid,runId:crypto.randomUUID(),version:'lamina-v2',rankKey:Math.round(total*100)*100000000-ms,createdAt:serverTimestamp()};
 const ref=doc(db,'connectionChecks',user.uid);
 for(const [i,part] of ['first','second'].entries()){const subset=rounds.slice(i*5,i*5+5);await setDoc(doc(db,'centerLabRuns',user.uid,'games',data.runId,'parts',part),{rounds:subset,total:subset.reduce((a,r)=>a+r.score,0),ms:10000,version:'lamina-v2'});console.log('PASS: validated private part',part);}await setDoc(ref,data);const saved=(await getDoc(ref)).data();if(saved.total!==total||!Number.isInteger(saved.total))throw new Error('Integer save mismatch');
 console.log('PASS: anonymous sign-in, private diagnostic write/read, integer scores');
 let denied=false;try{await setDoc(ref,{...data,total:1000,rankKey:100000*100000000-ms});}catch(e){denied=e.code==='permission-denied';}if(!denied)throw new Error('Tampered score was accepted');
 console.log('PASS: tampered total rejected');
 const bad=rounds.slice(0,5).map(r=>({...r}));bad[0].score++;
 let badDenied=false;try{await setDoc(doc(db,'centerLabRuns',user.uid,'games',crypto.randomUUID(),'parts','first'),{rounds:bad,total:bad.reduce((a,r)=>a+r.score,0),ms:10000,version:'lamina-v2'});}catch(e){badDenied=e.code==='permission-denied';}if(!badDenied)throw new Error('Tampered individual score accepted');
 console.log('PASS: tampered individual score rejected');
 for(const perfect of [true,false]){
  const subset=SHAPES.slice(0,5).map(s=>{const c=centroid(s.points),point=perfect?c:{x:c.x+bounds(s.points).diagonal,y:c.y};return {prediction:true,shapeId:s.id,point,score:scoreGuess(s,point),ms:2000};});
  await setDoc(doc(db,'centerLabRuns',user.uid,'games',crypto.randomUUID(),'parts','first'),{rounds:subset,total:subset.reduce((a,r)=>a+r.score,0),ms:10000,version:'lamina-v2'});
 }
 console.log('PASS: valid zero and perfect integer scores accepted');

 const board=await getDocs(query(collection(db,'centerLabScores'),orderBy('rankKey','desc'),limit(30)));
 console.log('PASS: leaderboard query; entries =',board.size);
}finally {clearTimeout(timeout);await terminate(db);await deleteApp(app);}
