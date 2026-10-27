import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{spawnSync}from'node:child_process';
import{dir}from'./meet-buddy-demo.mjs';
const path=`${dir}/performance-multilingual`,prepared=`${dir}/performance-prepared`;mkdirSync(prepared,{recursive:true});
const parse=f=>JSON.parse(readFileSync(f));
function ff(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});if(r.status!==0)throw new Error('Performance preparation failed');}
function env(f){const b=readFileSync(f);let d;for(let p=12;p+8<=b.length;){const size=b.readUInt32LE(p+4);if(b.toString('ascii',p,p+4)==='data')d=b.subarray(p+8,p+8+size);p+=8+size+(size%2);}if(!d)throw new Error('Invalid QA WAV');const v=[];for(let i=0;i+320<=d.length;i+=320){let sum=0;for(let j=0;j<320;j+=2)sum+=d.readInt16LE(i+j)**2;v.push(Math.sqrt(sum/160));}return v;}
function corr(a,b,start,end,lag){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(let i=start;i<end&&i<a.length;i++){if(i+lag<0||i+lag>=b.length)continue;const av=a[i],bv=b[i+lag];n++;x+=av;y+=bv;xx+=av*av;yy+=bv*bv;xy+=av*bv;}return(n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));}
const selection={inputOffsets:[0,15,30,46.5],segments:[],visualReview:'qa/native-01-review.jpg, qa/native-onset-01.jpg, qa/native-03-review.jpg, qa/native-04-review.jpg',mode:'Higgsfield native speaking performances with cadence-preserving ElevenLabs Voice Changer; close-up app footage with the same ElevenLabs voice for Travel Status'};
for(let i=1;i<=4;i++){
 const id=`segment-0${i}`;
 if(i===2){const m=parse(`${dir}/elevenlabs/${id}.json`),a=m.preparedAlignment??m.alignment,words=[];let word='',start=0,end=0;const flush=()=>{if(word)words.push({word,start,end});word='';};a.characters.forEach((c,n)=>{if(/\s/.test(c)){flush();return;}if(!word)start=a.character_start_times_seconds[n];word+=c;end=a.character_end_times_seconds[n];});flush();selection.segments.push({part:i,audio:`${dir}/elevenlabs/${id}.wav`,video:null,words,model:m.model??'eleven_multilingual_v2',reason:'Use a readable full-screen app demonstration for the Travel Status edit. Replacement native presenter request failed with a credit-balance error; it is not used.'});continue;}
 const sourceReview=parse(`${path}/${id}-source.scribe.json`),voiceReview=parse(`${path}/${id}.scribe.json`);
 const rawWords=sourceReview.words.filter(w=>w.type==='word');if(rawWords.at(-1).end>14.95)throw new Error('Speech reaches the clip boundary');
 const trim=Math.floor(Math.max(0,rawWords[0].start-.16)*30)/30;
 for(const [f,o]of[[`${path}/${id}-source.wav`,`${prepared}/${id}-qa-source.wav`],[`${path}/${id}.wav`,`${prepared}/${id}-qa-voice.wav`]])ff(['-i',f,'-ac','1','-ar','16000','-c:a','pcm_s16le',o]);
 const a=env(`${prepared}/${id}-qa-source.wav`),b=env(`${prepared}/${id}-qa-voice.wav`),timing=[];
 for(let start=0;start<1500;start+=500){let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=corr(a,b,start,start+500,lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}timing.push({startSeconds:start/100,...best});}
 writeFileSync(`${prepared}/${id}-timing.json`,JSON.stringify(timing,null,2));
 if(timing.some(w=>Math.abs(w.shiftSeconds)>.04||w.correlation<.65))throw new Error(`Voice Changer timing requires review for ${id}`);
 const audio=`${prepared}/${id}.wav`,video=`${prepared}/${id}.mp4`;
 ff(['-i',`${path}/${id}.wav`,'-af',`atrim=start=${trim},asetpts=PTS-STARTPTS,apad,atrim=duration=15`,'-ac','1','-ar','48000','-c:a','pcm_s16le',audio]);
 ff(['-i',`${dir}/native-${id}.mp4`,'-vf',`trim=start=${trim},setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=2,trim=duration=15`,'-an','-r','30','-frames:v','450','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',video]);
 const words=voiceReview.words.filter(w=>w.type==='word').map(w=>({word:w.text.replace(/traveling/ig,'travelling').replace(/travelers/ig,'travellers').replace(/traveler\b/ig,'traveller'),start:Math.max(0,w.start-trim),end:Math.max(0,w.end-trim)}));
 selection.segments.push({part:i,audio,video,words,model:parse(`${path}/${id}.json`).model,startTrimSeconds:trim,frameAligned:true,timing,spokenContent:voiceReview.text});
}
writeFileSync(`${dir}/performance-selection.json`,JSON.stringify(selection,null,2));
console.log('Prepared the reviewed performances with matching frame-aligned leading trims; original takes preserved.');
