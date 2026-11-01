import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(readFileSync(`${root}scripts/group-trip-english.json`));
const dir=`${root}${spec.directory}`,revision=process.argv.includes("--revision-02"),work=revision?`${dir}/revision-02`:dir;
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`${cmd} verification failed: ${r.stderr.slice(-1000)}`);return r;}
const save=(p,d)=>writeFileSync(p,JSON.stringify(d,null,2));
function decode(p,rate=8000){const r=spawnSync('ffmpeg',['-v','error','-i',p,'-vn','-ar',String(rate),'-ac','1','-f','s16le','-'],{maxBuffer:16*1024*1024});if(r.status!==0)throw new Error('Audio decoding failed.');return new Int16Array(r.stdout.buffer,r.stdout.byteOffset,r.stdout.length/2);}
function compare(a,b){let best={correlation:-2,lagSamples:0};for(let lag=-1600;lag<=1600;lag+=8){let xy=0,xx=0,yy=0;for(let j=0;j<a.length;j+=8){const k=j+lag;if(k<0||k>=b.length)continue;xy+=a[j]*b[k];xx+=a[j]*a[j];yy+=b[k]*b[k];}const c=xy/Math.sqrt(xx*yy);if(c>best.correlation)best={correlation:c,lagSamples:lag};}return{...best,lagSeconds:best.lagSamples/8000};}
const mapping={'hotel':'speaking-hotel','city':'speaking-city','messages':'speaking-messages','table':'speaking-table','suggest':'speaking-suggest','handle':'speaking-handle','find-out':'speaking-find-out','lisbon-brief':'speaking-lisbon-brief','sunset-idea':'speaking-sunset-idea-v3','have-plan':'speaking-have-plan','agree':'speaking-agree-v2'};
const performanceFile=shot=>revision&&existsSync(`${work}/lipsync/${shot}.mp4`)?`${work}/lipsync/${shot}.mp4`:`${dir}/${shot}.mp4`;
const timing=[];
for(const [id,shot]of Object.entries(mapping)){const file=performanceFile(shot);if(!existsSync(file))continue;const c=compare(decode(`${dir}/elevenlabs/${id}.wav`),decode(file));timing.push({id,shot,file,...c,passed:c.correlation>.95&&Math.abs(c.lagSeconds)<.06});}
for(const shot of ['sunset-speaking','next-speaking-seated','cta-speaking']){const file=performanceFile(shot);if(!existsSync(file))continue;const c=compare(decode(`${dir}/elevenlabs/${shot}-driving.wav`),decode(file));timing.push({shot,file,...c,passed:c.correlation>.95&&Math.abs(c.lagSeconds)<.06});}
save(`${work}/qa/driving-audio-verification.json`,{comparisons:timing,limitation:'Waveform alignment verifies that the model preserved the driving-audio timing. Visible mouth shapes and speaker assignment require separate visual review.'});
if(process.argv.includes('--sources-only')){console.log(JSON.stringify(timing,null,2));process.exit(timing.some(v=>!v.passed)?1:0);}
const file=revision?`${work}/tips-to-trip-less-planning-more-memories-en-105s-revised.mp4`:`${dir}/tips-to-trip-less-planning-more-memories-en-105s.mp4`;
const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_format','-show_streams','-of','json',file]).stdout);
save(`${work}/qa/final-ffprobe.json`,probe);
const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio'),subs=probe.streams.find(s=>s.codec_type==='subtitle');
const decoded=decode(file,48000),decodedDuration=decoded.length/48000;
const finalAlignment=compare(decode(`${work}/edit/final-mix.wav`),decode(file));
run('ffmpeg',['-v','error','-i',file,'-map','0:v','-map','0:a','-f','null','-']);
const loudnessLog=run('ffmpeg',['-hide_banner','-i',file,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr;
const loudness=JSON.parse(loudnessLog.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const captions=JSON.parse(readFileSync(`${work}/captions.json`));
const edit=JSON.parse(readFileSync(`${work}/edit/edit-plan.json`));
const checks={duration:Math.abs(Number(probe.format.duration)-105)<.07,width:video.width===720,height:video.height===1280,frameRate:video.r_frame_rate==='30/1',frames:Number(video.nb_read_frames)===3150,audioPresent:!!audio,captionsPresent:!!subs,captionsWithinVideo:captions.every(c=>c.start>=0&&c.end<=105&&c.end>c.start),endCardHold:edit.at(-1).at===101&&edit.at(-1).end===105,decodedAudioDuration:Math.abs(decodedDuration-105)<.05,finalAudioAlignment:Math.abs(finalAlignment.lagSeconds)<.025&&finalAlignment.correlation>.99,sourceTiming:timing.length===14&&timing.every(v=>v.passed),fullDecode:true,loudness:Math.abs(Number(loudness.input_i)+16)<1.1,truePeak:Number(loudness.input_tp)<=-1.1};
const report={file,duration:Number(probe.format.duration),decodedAudioDuration:decodedDuration,width:video.width,height:video.height,frameRate:video.r_frame_rate,frames:Number(video.nb_read_frames),captionCues:captions.length,endCardSeconds:4,finalAudioAlignment:finalAlignment,loudness,checks,technicalChecksPassed:Object.values(checks).every(Boolean),visualReviewFile:'qa/visual-review.json',rejectedRequests:readdirSync(dir).filter(n=>n.endsWith('.pending.json')).flatMap(n=>{const d=JSON.parse(readFileSync(`${dir}/${n}`));return ['failed','submission_rejected','nsfw','moderated'].includes(d.status)?[{file:n,status:d.status,requestId:d.request_id,model:d.model}]:[];})};
save(`${work}/qa/final-verification.json`,report);console.log(JSON.stringify(report,null,2));if(!report.technicalChecksPassed)process.exitCode=1;
