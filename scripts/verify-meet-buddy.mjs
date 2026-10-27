import{readFileSync,writeFileSync,existsSync}from'node:fs';
import{spawnSync}from'node:child_process';
import{dir}from'./meet-buddy-demo.mjs';
const parse=f=>JSON.parse(readFileSync(f));
const approved=existsSync(`${dir}/performance-approval.json`)&&parse(`${dir}/performance-approval.json`).approved===true;
const performance=existsSync(`${dir}/performance-selection.json`)?parse(`${dir}/performance-selection.json`):null;
const revision=process.argv.find(v=>v.startsWith('--revision='))?.split('=')[1];
if(revision&&!/^[a-z0-9-]+$/.test(revision))throw new Error('Invalid revision name');
const output=`${dir}/tips-to-trip-meet-buddy-travel-status-en-60s${revision?'-'+revision:''}${approved?'':'-review-draft'}.mp4`;
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw new Error(`${cmd} verification failed`);return r;}
const probe=parseProbe(output);
function parseProbe(f){return JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_frames:format=duration','-of','json',f]).stdout);}
const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
if(Number(probe.format.duration)!==60||video.width!==720||video.height!==1280||video.r_frame_rate!=='30/1'||video.nb_frames!=='1800'||!audio)throw new Error('Invalid export format');
run('ffmpeg',['-hide_banner','-v','error','-xerror','-i',output,'-map','0:v','-map','0:a','-f','null','-']);
const final=`${dir}/qa/decoded-final.wav`,expected=`${dir}/qa/expected-narration.wav`;
for(const [input,target]of[[output,final],[`${dir}/edit/narration.wav`,expected]])run('ffmpeg',['-hide_banner','-v','error','-y','-i',input,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',target]);
const decodedDuration=Number(parseProbe(final).format.duration);if(Math.abs(decodedDuration-60)>.03)throw new Error('Decoded audio has incorrect duration');
function envelope(f){const b=readFileSync(f);let data;for(let p=12;p+8<=b.length;){const tag=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4);if(tag==='data')data=b.subarray(p+8,p+8+size);p+=8+size+(size%2);}if(!data)throw new Error('Invalid PCM');const out=[];for(let i=0;i+320<=data.length;i+=320){let sum=0;for(let j=0;j<320;j+=2)sum+=data.readInt16LE(i+j)**2;out.push(Math.sqrt(sum/160));}return out;}
function corr(a,b,start,end,lag){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(let i=start;i<end&&i<a.length;i++){if(i+lag<0||i+lag>=b.length)continue;const av=a[i],bv=b[i+lag];n++;x+=av;y+=bv;xx+=av*av;yy+=bv*bv;xy+=av*bv;}return(n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));}
const a=envelope(expected),b=envelope(final),timing=[];
for(let start=0;start<6000;start+=500){let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=corr(a,b,start,start+500,lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}timing.push({startSeconds:start/100,...best});}
writeFileSync(`${dir}/qa/exported-narration-timing.json`,JSON.stringify(timing,null,2));
if(timing.some(w=>Math.abs(w.shiftSeconds)>.04||w.correlation<.8))throw new Error('Exported narration timing requires investigation');
const measure=run('ffmpeg',['-hide_banner','-i',output,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
if(!measure)throw new Error('Missing loudness result');const loudness=JSON.parse(measure[0]);
if(Math.abs(Number(loudness.input_i)+16)>1.2||Number(loudness.input_tp)>-1)throw new Error('Audio mix needs adjustment');
const cues=parse(`${dir}/captions.json`);if(!cues.length||!existsSync(`${dir}/captions.srt`)||cues.some(c=>c.start<0||c.end>60||c.end<=c.start))throw new Error('Invalid captions');
const people=parse(`${dir}/profiles/people.json`);if(people.count<21)throw new Error('Fewer than requested profiles');
if(approved&&!performance)throw new Error('Approved export requires a reviewed performance selection');
const blockers=approved?[]:performance?[{stage:'review',reason:'Final visual performance approval pending'}]:[{stage:'dedicated-lip-sync',reason:'Sync Lipsync 3 requires a Plus or higher-tier plan'},{stage:'replacement-speaking-presenter',reason:'Higgsfield credit-balance errors'}];
const presenterRequests=performance?[1,3,4].map(i=>{const m=parse(`${dir}/native-segment-0${i}.json`);if(m.status!=='completed')throw new Error('Selected presenter request is not completed');return{part:i,requestId:m.request_id,status:m.status,model:m.model};}):[];
writeFileSync(`${dir}/verification.json`,JSON.stringify({output,status:approved?'approved-export':'review-draft',technicalChecksPassed:true,probe,fullDecodePassed:true,decodedDuration,loudness,exportedNarrationTiming:timing,captionFormat:'Burned-in English plus SRT sidecar',profiles:people.count,spokenContentReview:performance?['performance-multilingual/segment-01.scribe.json','qa/narration-01.scribe.json','performance-multilingual/segment-03.scribe.json','performance-multilingual/segment-04.scribe.json']:['qa/narration-01.scribe.json','qa/narration-02.scribe.json'],presenterRequests,voice:performance?.segments.map(s=>({part:s.part,model:s.model})),performanceTiming:performance?.segments.filter(s=>s.video).map(s=>({part:s.part,startTrimSeconds:s.startTrimSeconds,timing:s.timing})),visualPerformanceApproved:approved,blockers,productionNotes:performance?{travelStatus:'Full-screen app footage with ElevenLabs narration; no rejected presenter clip used',dedicatedPass:'Sync Lipsync 3 remains unavailable on the current plan; this export uses newly generated native speaking performances.'}:null,realTimeStatus:'Edited marketing demonstration; no claim that the recorded backend updated live'},null,2));
console.log(`Technical checks passed: 60s, 720 × 1280, 30fps, full decode, narration timing and loudness. ${approved?'Approved export.':'Review draft; presenter lip sync remains unapproved.'}`);
