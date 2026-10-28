import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,dir=`${root}artifacts/travel-buddy-en`;
function ff(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});if(r.status!==0)throw new Error('Performance media preparation failed');}
function env(file){const b=readFileSync(file);let data;for(let p=12;p+8<=b.length;){const size=b.readUInt32LE(p+4);if(b.toString('ascii',p,p+4)==='data')data=b.subarray(p+8,p+8+size);p+=8+size+(size%2);}if(!data)throw new Error('Invalid PCM');const out=[];for(let i=0;i+320<=data.length;i+=320){let sum=0;for(let j=0;j<320;j+=2)sum+=data.readInt16LE(i+j)**2;out.push(Math.sqrt(sum/160));}return out;}
function corr(a,b,start,end,lag){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(let i=start;i<end&&i<a.length;i++){if(i+lag<0||i+lag>=b.length)continue;const av=a[i],bv=b[i+lag];n++;x+=av;y+=bv;xx+=av*av;yy+=bv*bv;xy+=av*bv;}return(n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));}
for(const name of ['source','elevenlabs'])ff(['-i',`${dir}/elevenlabs/outro-native-${name}.wav`,'-ac','1','-ar','16000','-c:a','pcm_s16le',`${dir}/qa/outro-native-${name}-timing.wav`]);
const a=env(`${dir}/qa/outro-native-source-timing.wav`),b=env(`${dir}/qa/outro-native-elevenlabs-timing.wav`),timing=[];
for(const start of [50,200,400]){let best={correlation:-1,shiftSeconds:0};for(let lag=-25;lag<=25;lag++){const c=corr(a,b,start,start+200,lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}timing.push({at:start/100,...best});}
writeFileSync(`${dir}/qa/outro-voice-timing.json`,JSON.stringify(timing,null,2));
if(timing.some(t=>Math.abs(t.shiftSeconds)>.04||t.correlation<.7))throw new Error('Converted closing cadence requires investigation');
const source=JSON.parse(readFileSync(`${dir}/qa/outro-native-source.scribe.json`)),converted=JSON.parse(readFileSync(`${dir}/qa/outro-native-elevenlabs.scribe.json`));
const words=converted.words.filter(w=>w.type==='word'),sourceWords=source.words.filter(w=>w.type==='word');
const trimFrames=Math.floor(Math.max(0,sourceWords[0].start-.18)*30),trim=trimFrames/30;
if(trimFrames>30||words.at(-1).end-trim>6.75)throw new Error('Closing speech does not fit its slot');
ff(['-i',`${dir}/elevenlabs/outro-native-elevenlabs.wav`,'-af',`atrim=start=${trim},asetpts=PTS-STARTPTS,apad,atrim=duration=7`,'-ac','1','-ar','48000','-c:a','pcm_s16le',`${dir}/elevenlabs/outro-final.wav`]);
const selection={intro:{video:'brunette-performance.mp4',audio:'elevenlabs/intro.wav',mode:'Non-speaking phone presentation with verified ElevenLabs voiceover. The audio-driven model did not animate speech, so this take is used as product B-roll only.'},hands:{typing:'hands-performance.mp4',steady:'hands-steady-performance.mp4',at:7,end:51,realScreenCompositing:true},outro:{video:'blonde-native-performance.mp4',audio:'elevenlabs/outro-final.wav',at:51,end:58,startTrimFrames:trimFrames,startTrimSeconds:trim,words:words.map(w=>({word:w.text,start:Math.max(0,w.start-trim),end:Math.max(0,w.end-trim)})),nativeWords:sourceWords,voiceModel:'eleven_multilingual_sts_v2',timing,wordingVerified:true,mode:'Native Higgsfield Wan 3.0 Prime speaking performance and cadence-preserving ElevenLabs Voice Changer, with identical frame-aligned leading cut.'},endcard:{at:58,end:60},rejectedForSpeaking:['brunette-performance.mp4','blonde-performance.mp4'],originalsPreserved:true};
writeFileSync(`${dir}/performance-selection.json`,JSON.stringify(selection,null,2));
console.log(JSON.stringify({trimFrames,trimSeconds:trim,timing,lastSpokenWord:words.at(-1).end-trim},null,2));
