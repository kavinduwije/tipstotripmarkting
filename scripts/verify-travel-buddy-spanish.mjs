import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname,dir=`${root}artifacts/travel-buddy-es`;
const spec=JSON.parse(readFileSync(`${root}scripts/travel-buddy-spanish.json`)),performance=JSON.parse(readFileSync(`${dir}/performance-selection.json`));
const output=`${dir}/tips-to-trip-travel-buddy-es-58s.mp4`;
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`${cmd}: ${r.stderr.slice(-1000)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-v','error','-y',...args]);
const probe=f=>JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration:stream_tags=language:format=duration','-of','json',f]).stdout);
const p=probe(output),v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio'),sub=p.streams.find(s=>s.codec_type==='subtitle');
if(Number(p.format.duration)!==58||v.width!==720||v.height!==1280||v.r_frame_rate!=='30/1'||v.nb_frames!=='1740'||!a||sub?.tags?.language!=='spa'||a?.tags?.language!=='spa')throw new Error('Incorrect export format');
run('ffmpeg',['-v','error','-xerror','-i',output,'-map','0:v','-map','0:a','-f','null','-']);
for(const [input,name]of[[output,'decoded-final'],[`${dir}/edit/narration.wav`,'expected-narration']])ff(['-i',input,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',`${dir}/qa/${name}.wav`]);
const decodedDuration=Number(probe(`${dir}/qa/decoded-final.wav`).format.duration);if(Math.abs(decodedDuration-58)>.03)throw new Error('Decoded audio duration incorrect');
function env(f){const b=readFileSync(f);let d;for(let pos=12;pos+8<=b.length;){const size=b.readUInt32LE(pos+4);if(b.toString('ascii',pos,pos+4)==='data')d=b.subarray(pos+8,pos+8+size);pos+=8+size+(size%2);}if(!d)throw new Error('Invalid WAV');const vals=[];for(let i=0;i+320<=d.length;i+=320){let sum=0;for(let j=0;j<320;j+=2)sum+=d.readInt16LE(i+j)**2;vals.push(Math.sqrt(sum/160));}return vals;}
function corr(a,b,start,end,lag){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(let i=start;i<end&&i<a.length;i++){if(i+lag<0||i+lag>=b.length)continue;const av=a[i],bv=b[i+lag];n++;x+=av;y+=bv;xx+=av*av;yy+=bv*bv;xy+=av*bv;}return(n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));}
const expected=env(`${dir}/qa/expected-narration.wav`),decoded=env(`${dir}/qa/decoded-final.wav`),timing=[];
for(const s of spec.dialogues){const start=Math.round(s.at*100),end=start+Math.min(400,s.slot*100);let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=corr(expected,decoded,start,end,lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}timing.push({section:s.id,start:s.at,...best});}
if(timing.some(t=>t.correlation<.8||Math.abs(t.shiftSeconds)>.04))throw new Error('Exported speech timing requires review');
const loud=run('ffmpeg',['-hide_banner','-i',output,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr;
const loudness=JSON.parse(loud.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);if(Math.abs(Number(loudness.input_i)+16)>1.2||Number(loudness.input_tp)>-1)throw new Error('Mix loudness requires correction');
const norm=s=>s.toLowerCase().replace(/tips\s*2\s*trip/g,'tips to trip').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
const speechReview=spec.dialogues.map(s=>{const presenter=['intro','outro'].includes(s.id),r=JSON.parse(readFileSync(`${dir}/qa/${presenter?s.id+'-native-elevenlabs':s.id}.scribe.json`)),last=presenter?performance[s.id].words.at(-1).end:r.words.filter(w=>w.type==='word').at(-1).end;return{id:s.id,expected:s.text,transcript:r.text,exactWordsMatch:norm(s.text)===norm(r.text),lastWordEnd:last,slot:s.slot};});
if(speechReview.some(r=>!r.exactWordsMatch||r.lastWordEnd>r.slot))throw new Error('Spoken content or section boundary requires review');
const cues=JSON.parse(readFileSync(`${dir}/captions.json`));if(cues.some((c,i)=>c.start<0||c.end>58||c.end<=c.start||(i&&c.start<cues[i-1].end)))throw new Error('Caption boundaries invalid');
ff(['-i',output,'-vf','fps=1/2,scale=180:320,tile=6x5','-frames:v','1',`${dir}/qa/final-contact.jpg`]);
for(const [name,time]of[['opening',1],['entry',5.8],['route',7.8],['photos',14],['preferences',19],['details',24],['share',31],['manage',35],['requests',38],['chat',44],['closing-speaking',51],['closing-gesture',55],['endcard',57]])ff(['-ss',String(time),'-i',output,'-frames:v','1',`${dir}/qa/final-${name}.png`]);
const report={status:'technical-verification-passed-awaiting-visual-review',technicalChecksPassed:true,output,sha256:createHash('sha256').update(readFileSync(output)).digest('hex'),probe:p,fullDecodePassed:true,decodedAudioDuration:decodedDuration,loudness,exportedNarrationTiming:timing,speechReview,captions:{cues:cues.length,burnedIn:true,optionalMovText:true,sidecar:'captions.srt',language:'Spanish from Spain'},performance:'performance-selection.json',approvedFinalCampaign:false};
writeFileSync(`${dir}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,duration:58,dimensions:'720 × 1280',fps:30,fullDecodePassed:true,loudnessLUFS:loudness.input_i,truePeakDBTP:loudness.input_tp,captionCues:cues.length,speechSectionsVerified:speechReview.length},null,2));
