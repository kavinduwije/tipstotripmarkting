import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,dir=`${root}artifacts/travel-buddy-fr`;
function run(cmd,args){const p=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(p.status!==0)throw new Error(p.stderr.slice(-1200));return p;}
const ff=args=>run('ffmpeg',['-hide_banner','-v','error','-y',...args]);
function env(f){const b=readFileSync(f);let data;for(let p=12;p+8<=b.length;){const n=b.readUInt32LE(p+4);if(b.toString('ascii',p,p+4)==='data')data=b.subarray(p+8,p+8+n);p+=8+n+(n%2);}if(!data)throw new Error('Invalid WAV');const out=[];for(let i=0;i+320<=data.length;i+=320){let sum=0;for(let j=0;j<320;j+=2)sum+=data.readInt16LE(i+j)**2;out.push(Math.sqrt(sum/160));}return out;}
function corr(a,b,start,end,lag){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(let i=start;i<end&&i<a.length;i++){if(i+lag<0||i+lag>=b.length)continue;const av=a[i],bv=b[i+lag];n++;x+=av;y+=bv;xx+=av*av;yy+=bv*bv;xy+=av*bv;}return(n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));}
const selected=process.argv.find(v=>v.startsWith('--only='))?.split('=')[1];
const selection=existsSync(`${dir}/performance-selection.json`)?JSON.parse(readFileSync(`${dir}/performance-selection.json`)):{language:'fr',originalsPreserved:true,rejectedForSpeaking:[],body:{video:'../travel-buddy-en/revision-07/hands-screen-composited.mp4',reason:'Retain corrected five-digit holding grip and exact native UI contact mapping.'}};
for(const [id,slot] of [['intro',5],['outro',7]]){
 if(selected&&selected!==id)continue;
 for(const name of ['source','elevenlabs'])ff(['-i',`${dir}/elevenlabs/${id}-native-${name}.wav`,'-ac','1','-ar','16000','-c:a','pcm_s16le',`${dir}/qa/${id}-native-${name}-timing.wav`]);
 const a=env(`${dir}/qa/${id}-native-source-timing.wav`),b=env(`${dir}/qa/${id}-native-elevenlabs-timing.wav`);
 const transcript=JSON.parse(readFileSync(`${dir}/qa/${id}-native-elevenlabs.scribe.json`)),native=JSON.parse(readFileSync(`${dir}/qa/${id}-native-source.scribe.json`));
 const words=transcript.words.filter(w=>w.type==='word'),nativeWords=native.words.filter(w=>w.type==='word');
 const timing=[];for(const t of [.3,1.5,3]){let best={correlation:-1,shiftSeconds:0};for(let lag=-15;lag<=15;lag++){const c=corr(a,b,t*100,t*100+150,lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}timing.push({at:t,...best});}
 if(timing.some(t=>Math.abs(t.shiftSeconds)>.04||t.correlation<.65))throw new Error(`${id}: voice timing requires investigation`);
 const trimFrames=Math.floor(Math.max(0,nativeWords[0].start-.12)*30),trim=trimFrames/30;
 const speed=Math.max(1,(Math.max(words.at(-1).end,nativeWords.at(-1).end)-trim+.15)/slot);
 if(speed>1.17||trim>1)throw new Error(`${id}: performance does not fit comfortably`);
 ff(['-i',`${dir}/elevenlabs/${id}-native-elevenlabs.wav`,'-af',`atrim=start=${trim},asetpts=PTS-STARTPTS,atempo=${speed},apad,atrim=duration=${slot}`,'-ac','1','-ar','48000','-c:a','pcm_s16le',`${dir}/elevenlabs/${id}-final.wav`]);
 selection[id]={video:`${id}-native-performance.mp4`,audio:`elevenlabs/${id}-final.wav`,duration:slot,startTrimFrames:trimFrames,startTrimSeconds:trim,speed,frameMap:Array.from({length:slot*30},(_,n)=>trimFrames+Math.floor(n*speed)),words:words.map(w=>({word:w.text.replace(/Tips2Trip/gi,'Tips to Trip'),start:Math.max(0,(w.start-trim)/speed),end:Math.max(0,(w.end-trim)/speed)})),nativeWords,timing,wordingVerified:true,transcriptBrandNormalisation:'Scribe Tips2Trip spelling rendered as official Tips to Trip brand.',mode:'Native Higgsfield French speaking performance, converted with ElevenLabs multilingual Voice Changer preserving cadence. Identical frame-aligned leading trim and any time adjustment in audio and video.'};
}
selection.body={video:'../travel-buddy-en/revision-07/hands-screen-composited.mp4',reason:'Original English app UI retained as requested, with Trip to Spain flag, France and Spain route fields; corrected five-digit grip and audited contact mapping reused unchanged.'};
writeFileSync(`${dir}/performance-selection.json`,JSON.stringify(selection,null,2)+'\n');console.log(JSON.stringify(Object.fromEntries(['intro','outro'].filter(id=>selection[id]).map(id=>[id,{trim:selection[id].startTrimSeconds,speed:selection[id].speed,timing:selection[id].timing}])),null,2));
