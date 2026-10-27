import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const french=process.argv.includes('--french');
const business=process.argv.includes('--business');
const dir=`${root}artifacts/${business?`ugc-business-${french?'fr':'es'}`:`ugc-product-${french?'fr':'es'}`}`;
const parse=path=>JSON.parse(readFileSync(path,'utf8'));
const spec=parse(`${root}scripts/${business?`ugc-business-${french?'french':'spanish'}`:`ugc-product-${french?'french':'spanish'}`}.json`);
function envelope(path) {
  const b=readFileSync(path);let data,rate;
  for(let pos=12;pos+8<=b.length;) {const tag=b.toString('ascii',pos,pos+4),size=b.readUInt32LE(pos+4);if(tag==='fmt ') {if(b.readUInt16LE(pos+10)!==1||b.readUInt16LE(pos+22)!==16) throw new Error('QA WAV must be mono 16-bit PCM');rate=b.readUInt32LE(pos+12);}if(tag==='data') data=b.subarray(pos+8,pos+8+size);pos+=8+size+(size%2);}
  if(!data||rate!==16000) throw new Error('QA WAV must be 16 kHz PCM');
  const result=[];
  for(let i=0;i+320<=data.length;i+=320) {let sum=0;for(let j=0;j<320;j+=2)sum+=data.readInt16LE(i+j)**2;result.push(Math.sqrt(sum/160));}
  return result;
}
function correlation(a,b,start,end,lag) {
  let n=0,x=0,y=0,xx=0,yy=0,xy=0;
  for(let i=start;i<end&&i<a.length;i++) {if(i+lag<0||i+lag>=b.length) continue;const av=a[i],bv=b[i+lag];n++;x+=av;y+=bv;xx+=av*av;yy+=bv*bv;xy+=av*bv;}
  return (n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));
}
const timing=[];
const presenterParts=existsSync(`${dir}/production-mode.json`)?parse(`${dir}/production-mode.json`).presenterParts:[1,2];
for(const part of presenterParts) {
  const source=envelope(`${dir}/presenter-0${part}.wav`), converted=envelope(`${dir}/elevenlabs/presenter-0${part}.wav`);
  const windows=[];
  for(let start=0;start<3000;start+=500) {let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=correlation(source,converted,start,start+500,lag);if(c>best.correlation) best={correlation:c,shiftSeconds:lag/100};}windows.push({startSeconds:start/100,...best});}
  if(windows.some(w=>Math.abs(w.shiftSeconds)>0.04||w.correlation<0.65)) throw new Error('Converted narration timing needs review before export');
  timing.push({part,windows,sourceTranscript:parse(`${dir}/presenter-0${part}.transcript.json`).map(s=>s.text).join(' '),convertedTranscript:parse(`${dir}/elevenlabs/presenter-0${part}.transcript.json`).map(s=>s.text).join(' ')});
}
writeFileSync(`${dir}/elevenlabs/timing-verification.json`,JSON.stringify(timing,null,2));
if(existsSync(`${dir}/driving-output.wav`)) {
  const expected=envelope(`${dir}/elevenlabs/presenter-02.wav`),actual=envelope(`${dir}/driving-output.wav`);
  const windows=[];
  for(let start=0;start<3000;start+=500) {let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=correlation(expected,actual,start,start+500,lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}windows.push({startSeconds:start/100,...best});}
  if(windows.some(w=>Math.abs(w.shiftSeconds)>0.06||w.correlation<0.8))throw new Error('Higgsfield driving audio output requires sync review');
  writeFileSync(`${dir}/elevenlabs/driving-audio-verification.json`,JSON.stringify(windows,null,2));
}
console.log('Converted narration timing passed the audio envelope check.');
if(process.argv.includes('--audio-only')) process.exit(0);
function run(command,args) {const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw new Error(`${command} validation failed: ${r.stderr}`);return r;}
const output=`${dir}/tips-to-trip-${business?'business':'product'}-ugc-${french?'fr':'es'}-60s.mp4`;
const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_frames:format=duration','-of','json',output]).stdout);
const video=probe.streams.find(s=>s.codec_type==='video');
const width=business&&french?1080:720,height=width*16/9;
if(Number(probe.format.duration)!==60||video.width!==width||video.height!==height||video.r_frame_rate!=='30/1'||video.nb_frames!=='1800')throw new Error('Incorrect export dimensions, duration or frame count');
run('ffmpeg',['-hide_banner','-v','error','-xerror','-i',output,'-map','0:v','-map','0:a','-f','null','-']);
const qa=`${dir}/qa`;mkdirSync(qa,{recursive:true});
const decodedMix=`${qa}/final-mix.wav`,expectedVoice=`${qa}/expected-narration.wav`;
run('ffmpeg',['-hide_banner','-v','error','-y','-i',output,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',decodedMix]);
const decodedDuration=Number(JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration','-of','json',decodedMix]).stdout).format.duration);
if(Math.abs(decodedDuration-60)>0.03)throw new Error('Decoded audio duration differs from the container timeline');
run('ffmpeg',['-hide_banner','-v','error','-y','-i',`${dir}/elevenlabs/presenter-01.mp3`,'-i',`${dir}/elevenlabs/presenter-02.mp3`,'-filter_complex','[0:a]aresample=16000,apad,atrim=duration=30,asetpts=N/SR/TB[a];[1:a]aresample=16000,apad,atrim=duration=30,asetpts=N/SR/TB[b];[a][b]concat=n=2:v=0:a=1[out]','-map','[out]','-ac','1','-ar','16000','-c:a','pcm_s16le',expectedVoice]);
const expected=envelope(expectedVoice),actual=envelope(decodedMix),exportedMixTiming=[];
for(let start=0;start<6000;start+=500){let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=correlation(expected,actual,start,start+500,lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}exportedMixTiming.push({startSeconds:start/100,...best});}
writeFileSync(`${qa}/exported-mix-timing.json`,JSON.stringify(exportedMixTiming,null,2));
if(exportedMixTiming.some(w=>Math.abs(w.shiftSeconds)>0.04||w.correlation<0.8))throw new Error('Exported mixed narration is misaligned with the verified voice tracks');
const loud=run('ffmpeg',['-hide_banner','-i',output,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
if(!loud)throw new Error('No final loudness measurement');
const loudness=JSON.parse(loud[0]);
if(Math.abs(Number(loudness.input_i)+16)>1.2||Number(loudness.input_tp)>-1) throw new Error('Final mix requires loudness or peak adjustment');
const plan=parse(`${dir}/edit/edit-plan.json`);
const sourceFiles=[...new Set(plan.filter(s=>s.source).map(s=>s.source))];
for(const file of business?spec.sourceFiles:['Meet buddy.mov','Travel buddy.mov','Travel buddy post group chat.mov','Near you.mov']) if(!sourceFiles.includes(file))throw new Error('A requested recording is missing');
if(!existsSync(`${dir}/captions.ass`)||!existsSync(`${dir}/captions.srt`))throw new Error('Captions missing');
writeFileSync(`${dir}/verification.json`,JSON.stringify({output,probe,fullDecodePassed:true,decodedAudioDuration:decodedDuration,exportedMixTiming,sourceFiles,providers:{portrait:parse(`${dir}/presenter-portrait.json`).model,presenter:presenterParts.map(p=>parse(`${dir}/presenter-0${p}.json`).model),voice:[1,2].map(p=>parse(`${dir}/elevenlabs/presenter-0${p}.json`).model),music:parse(`${dir}/elevenlabs/music.json`).input.model_id},logo:spec.logo,captionFormat:`Burned-in ${french?'French':'Spanish'} captions; SRT sidecar`,timing,loudness},null,2));
console.log(`Verified: 60 seconds, ${width} × ${height}, 30 fps, full decode passed; ${sourceFiles.length} requested recordings, ${french?'French':'Spanish'} captions, ElevenLabs voice and music.`);
