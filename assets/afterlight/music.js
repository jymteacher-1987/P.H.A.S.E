/* Original 32-bar adaptive score. Web Audio synthesis; no external recording. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AfterlightMusic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const tempo=act=>[138,146,156,168][Math.max(0,Math.min(3,act))];
  const hz=midi=>440*2**((midi-69)/12);
  // Four phrases: a pulse, a question, a rising reply, and the final approach.
  const chords=[[50,[0,3,7,10,14]],[46,[0,4,7,11,14]],[43,[0,3,7,10,14]],[45,[0,4,7,10,14]],[50,[0,3,7,10,14]],[46,[0,4,7,11,14]],[41,[0,4,7,11,14]],[45,[0,4,7,10,14]]];
  function step(index,act=0){
    const bar=Math.floor(index/8)%32,beat=index%8,section=Math.floor(bar/8),[root,chord]=chords[Math.floor(bar/4)],unit=30/tempo(act),events=[];
    const note=(midi,duration,gain,voice='pulse',delay=0,pan=0)=>events.push({kind:'note',freq:hz(midi),duration,gain,voice,delay,pan});
    // Sixteenth-note strings, wide harmony and a four-phrase melodic arc.
    const pattern=section%2?[0,2,1,2,0,3,2,4]:[0,2,1,2,0,2,3,2];
    note(root+12+chord[pattern[beat]],unit*.7,.085+(beat%2===0?.025:0),'strings',0,-.35);
    note(root+12+chord[pattern[(beat+3)%8]],unit*.42,.052,'pulse',unit*.5,.4);
    if(beat===0||beat===4)note(root-12+(beat===4&&bar%4===3?7:0),unit*3.5,.32,'bass');
    if(beat===0)for(const [i,n]of chord.slice(0,4).entries())note(root+n,unit*7.7,.063,'pad',0,(i-1.5)*.4);
    if((beat===0&&bar%2===0)||(beat===4&&section>=2))for(const n of chord.slice(0,3))note(root+12+n,unit*2.7,.063,'brass');
    const melody=[0,2,3,2,4,3,2,1];
    if([0,3,4,6].includes(beat))note(root+24+chord[melody[(bar%4*2+Math.floor(beat/2))%8]],unit*(beat===0?2.3:1.3),.072+section*.009,'lead',0,.15);
    if(bar%8===7&&beat>=4)note(root+24+chord[(beat-4)%5],unit*.65,.072,'lead',unit*.5,-.2);
    events.push({kind:'hat',duration:.055,gain:beat%2?.04:.025,pan:.45});
    if(beat===0||beat===4||(act>=2&&beat===7&&bar%2===1))events.push({kind:'kick',duration:.24,gain:.38});
    if(beat===2||beat===6)events.push({kind:'snare',duration:.16,gain:.1+(act*.009),pan:-.1});
    if(beat===0&&bar%4===0)events.push({kind:'crash',duration:1.1,gain:.095,pan:-.3});
    if(bar%4===3&&beat>=5){events.push({kind:'tom',freq:155-(beat-5)*28,duration:.24,gain:.19,pan:(beat-6)*.4});if(beat===7)events.push({kind:'snare',duration:.1,gain:.095,delay:unit*.5});}
    return events;
  }
  function create(ctx,destination){
    const bus=ctx.createGain();bus.gain.value=0;bus.connect(destination);
    // A shared short hall and quiet echo add depth without masking the signal controls.
    const hall=ctx.createConvolver(),wet=ctx.createGain(),impulse=ctx.createBuffer(2,Math.ceil(ctx.sampleRate*1.7),ctx.sampleRate);let roomSeed=13092026;
    for(let ch=0;ch<2;ch++){const samples=impulse.getChannelData(ch);for(let i=0;i<samples.length;i++){roomSeed=(Math.imul(roomSeed,1664525)+1013904223)>>>0;samples[i]=(roomSeed/4294967296*2-1)*Math.exp(-6*i/samples.length);}}
    hall.buffer=impulse;wet.gain.value=.22;bus.connect(hall);hall.connect(wet);wet.connect(destination);
    const delay=ctx.createDelay(.6),feedback=ctx.createGain(),echo=ctx.createGain();delay.delayTime.value=.23;feedback.gain.value=.24;echo.gain.value=.12;bus.connect(delay);delay.connect(feedback);feedback.connect(delay);delay.connect(echo);echo.connect(destination);
    const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*1.2),ctx.sampleRate),data=noise.getChannelData(0);let seed=20260913;
    for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/4294967296)*2-1;}
    let next=0,index=0,active=false;
    const envelope=(at,duration,gain,attack=.006,sustain=false)=>{const amp=ctx.createGain();amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),at+attack);if(sustain)amp.gain.exponentialRampToValueAtTime(gain*.6,at+duration*.7);amp.gain.exponentialRampToValueAtTime(.0001,at+duration);return amp;};
    function schedule(event,at){
      at+=event.delay||0;
      const {kind,duration,gain,voice}=event,amp=envelope(at,duration,gain,voice==='pad'?.1:voice==='brass'?.025:.006,['pad','brass','lead'].includes(voice));
      let filter,panner;const sources=[];
      if(ctx.createStereoPanner){panner=ctx.createStereoPanner();panner.pan.value=event.pan||0;amp.connect(panner);panner.connect(bus);}else amp.connect(bus);
      if(kind==='note'||kind==='kick'||kind==='tom'){
        const wide=['pad','brass','strings'].includes(voice);
        if(kind==='note'){filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(voice==='brass'?2100:voice==='pad'?900:voice==='strings'?1700:2300,at);if(voice==='brass')filter.frequency.exponentialRampToValueAtTime(650,at+duration);filter.Q.value=.6;filter.connect(amp);}
        for(const detune of wide?[-6,6]:[0]){const osc=ctx.createOscillator();osc.type=wide?'sawtooth':kind==='kick'||kind==='tom'||voice==='bass'?'sine':'triangle';osc.detune.value=detune;osc.frequency.setValueAtTime(kind==='kick'?125:event.freq,at);if(kind==='kick'||kind==='tom')osc.frequency.exponentialRampToValueAtTime(kind==='kick'?43:event.freq*.75,at+duration*.85);osc.connect(filter||amp);sources.push(osc);}
        if(wide){amp.gain.cancelScheduledValues(at);amp.gain.setValueAtTime(.0001,at);amp.gain.exponentialRampToValueAtTime(gain*.5,at+(voice==='pad'?.1:.015));if(voice!=='strings')amp.gain.exponentialRampToValueAtTime(gain*.3,at+duration*.7);amp.gain.exponentialRampToValueAtTime(.0001,at+duration);}
      }else{
        const source=ctx.createBufferSource();source.buffer=noise;filter=ctx.createBiquadFilter();filter.type=kind==='snare'?'bandpass':'highpass';filter.frequency.value=kind==='hat'?6200:kind==='crash'?3500:1800;filter.Q.value=.7;source.connect(filter);filter.connect(amp);sources.push(source);
      }
      let alive=sources.length;for(const source of sources){source.start(at);source.stop(at+duration+.02);source.onended=()=>{source.disconnect();if(--alive===0){if(filter)filter.disconnect();amp.disconnect();if(panner)panner.disconnect();}};}
    }
    return {
      tick(act){if(ctx.state!=='running')return;if(!active){active=true;next=ctx.currentTime+.025;bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setTargetAtTime(.7,ctx.currentTime,.035);}if(next<ctx.currentTime-.1)next=ctx.currentTime+.025;while(next<ctx.currentTime+.11){for(const event of step(index++,act))schedule(event,next);next+=30/tempo(act);}},
      pause(){if(!active)return;active=false;bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setTargetAtTime(0,ctx.currentTime,.025);},
      // The same synthesizer is usable with an OfflineAudioContext for audio validation.
      render(seconds,act=0){bus.gain.setValueAtTime(.7,0);let at=0,i=0;while(at<seconds){for(const event of step(i++,act))schedule(event,at);at+=30/tempo(act);}}
    };
  }
  return {tempo,step,create};
});
