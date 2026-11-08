import {useEffect,useRef,type ReactNode} from 'react';

// Touch, mouse and keyboard use the same movement action. Pointer capture
// ensures that releasing a finger outside the button also stops repetition.
export default function RepeatButton({label,onStep,children}:{label:string;onStep:()=>void;children:ReactNode}){
 const action=useRef(onStep),delay=useRef<ReturnType<typeof setTimeout>|null>(null),repeat=useRef<ReturnType<typeof setInterval>|null>(null);
 action.current=onStep;
 function stop(){if(delay.current!==null)clearTimeout(delay.current);if(repeat.current!==null)clearInterval(repeat.current);delay.current=null;repeat.current=null;}
 useEffect(()=>{window.addEventListener('blur',stop);return()=>{stop();window.removeEventListener('blur',stop);};},[]);
 return <button aria-label={label} type="button" className="repeat-button" onPointerDown={e=>{
  if(e.button!==0)return;e.preventDefault();stop();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);action.current();
  delay.current=setTimeout(()=>{repeat.current=setInterval(()=>action.current(),70);},350);
 }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop} onClick={e=>{if(e.detail===0)action.current();}}>{children}</button>;
}
