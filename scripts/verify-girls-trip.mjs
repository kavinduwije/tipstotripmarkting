import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,spec=JSON.parse(readFileSync(`${root}scripts/girls-trip-english.json`)),dir=`${root}${spec.directory}`;
const shots=JSON.parse(readFileSync(`${root}scripts/girls-trip-shots.json`));
const save=(p,d)=>writeFileSync(p,JSON.stringify(d,null,2));
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(`${cmd} verification failed: ${r.stderr.slice(-700)}`);return r;}
function decode(p,rate=8000){const r=spawnSync('ffmpeg',['-v','error','-i',p,'-vn','-ar',String(rate),'-ac','1','-f','s16le','-'],{maxBuffer:24*1024*1024});if(r.status!==0)throw Error('Audio decoding failed.');return new Int16Array(r.stdout.buffer,r.stdout.byteOffset,r.stdout.length/2);}
function compare(a,b){let best={correlation:-2,lagSamples:0};for(let lag=-1600;lag<=1600;lag+=8){let xy=0,xx=0,yy=0;for(let j=0;j<a.length;j+=8){const k=j+lag;if(k<0||k>=b.length)continue;xy+=a[j]*b[k];xx+=a[j]*a[j];yy+=b[k]*b[k];}const c=xy/Math.sqrt(xx*yy);if(c>best.correlation)best={correlation:c,lagSamples:lag};}return {...best,lagSeconds:best.lagSamples/8000};}
const normal=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const speech=spec.dialogues.map(s=>{const p=`${dir}/qa/${s.id}.scribe.json`;return{id:s.id,expected:s.text,heard:existsSync(p)?JSON.parse(readFileSync(p)).text:'',passed:existsSync(p)&&normal(JSON.parse(readFileSync(p)).text)===normal(s.text)};});
save(`${dir}/qa/spoken-content-verification.json`,{speech,passed:speech.every(s=>s.passed),method:'Independent ElevenLabs Scribe transcription of each final prepared voice track; punctuation and feature-name capitalisation ignored.'});
const timing=[];
for(const s of shots.filter(s=>s.speaker||s.lines)){
 if(!existsSync(`${dir}/${s.id}.mp4`)){timing.push({shot:s.id,passed:false,missing:true});continue;}
 const c=compare(decode(`${dir}/elevenlabs/${s.id}-driving.wav`),decode(`${dir}/${s.id}.mp4`));timing.push({shot:s.id,...c,passed:c.correlation>.95&&Math.abs(c.lagSeconds)<.06});
}
save(`${dir}/qa/driving-audio-verification.json`,{comparisons:timing,limitation:'Waveform comparison verifies the timing of the model soundtrack against driving speech. Mouth shapes and speaker assignment are reviewed separately.'});
if(process.argv.includes('--sources-only')){console.log(JSON.stringify({speech,timing},null,2));process.exit(speech.every(s=>s.passed)&&timing.every(s=>s.passed)?0:1);}
const file=`${dir}/tips-to-trip-girls-trip-barcelona-en-60s.mp4`;
const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_format','-show_streams','-of','json',file]).stdout);save(`${dir}/qa/final-ffprobe.json`,probe);
const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio'),subs=probe.streams.find(s=>s.codec_type==='subtitle');
const decodedDuration=decode(file,48000).length/48000,finalAlignment=compare(decode(`${dir}/edit/final-mix.wav`),decode(file));
run('ffmpeg',['-v','error','-i',file,'-map','0:v','-map','0:a','-f','null','-']);
const log=run('ffmpeg',['-hide_banner','-i',file,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr,loudness=JSON.parse(log.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const captions=JSON.parse(readFileSync(`${dir}/captions.json`)),edit=JSON.parse(readFileSync(`${dir}/edit/edit-plan.json`));
const checks={duration:Math.abs(Number(probe.format.duration)-60)<.035,dimensions:video.width===720&&video.height===1280,frameRate:video.r_frame_rate==='30/1',frames:Number(video.nb_read_frames)===1800,audioPresent:!!audio,captionsPresent:!!subs,captionsWithinVideo:captions.every(c=>c.start>=0&&c.end<=60&&c.end>c.start),endCardHold:edit.at(-1).at===56&&edit.at(-1).end===60,decodedAudioDuration:Math.abs(decodedDuration-60)<.05,finalAudioAlignment:Math.abs(finalAlignment.lagSeconds)<.025&&finalAlignment.correlation>.99,sourceTiming:timing.length===7&&timing.every(v=>v.passed),spokenContent:speech.every(v=>v.passed),fullDecode:true,loudness:Math.abs(Number(loudness.input_i)+16)<1,truePeak:Number(loudness.input_tp)<=-1.1};
const report={file,duration:Number(probe.format.duration),decodedAudioDuration:decodedDuration,width:video.width,height:video.height,frameRate:video.r_frame_rate,frames:Number(video.nb_read_frames),captionCues:captions.length,endCardSeconds:4,finalAudioAlignment:finalAlignment,loudness,checks,technicalChecksPassed:Object.values(checks).every(Boolean),visualReviewFile:'qa/visual-review.json',sourceEdits:'source-edits.json',failedRequestsPreserved:['cast-planning.pending.json']};
save(`${dir}/qa/final-verification.json`,report);console.log(JSON.stringify(report,null,2));if(!report.technicalChecksPassed)process.exitCode=1;
