import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(readFileSync(root+'scripts/meet-buddy-seedance25.json'));
const dir=root+spec.directory,qa=dir+'/qa';mkdirSync(qa,{recursive:true});
function run(command,args){const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:12*1024*1024});if(r.status!==0)throw Error(`${command} verification failed: ${r.stderr.slice(-1200)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-y',...args]);
ff(['-loglevel','error','-i',`${dir}/edit/final-mix.wav`,'-ar','48000','-ac','1','-f','s16le',`${qa}/reference-mix.pcm`]);
const pcm=path=>{const b=readFileSync(path);return new Int16Array(b.buffer,b.byteOffset,b.length/2);};
const reference=pcm(`${qa}/reference-mix.pcm`);
function correlation(a,b,start=0,length=Math.min(a.length,b.length)-start){let ab=0,aa=0,bb=0;for(let i=start;i<Math.min(start+length,a.length,b.length);i++){const x=a[i],y=b[i];ab+=x*y;aa+=x*x;bb+=y*y;}return ab/Math.sqrt(aa*bb);}
const result={createdAt:new Date().toISOString(),duration:spec.duration,models:{video:spec.videoModel,voice:spec.voiceModel,music:spec.musicModel},captions:'Burned-in English captions and separate SRT; official ElevenLabs timing',exports:[]};
for(const f of spec.exports){const file=`${dir}/exports/tips-to-trip-meet-buddy-${f.id}-35s.mp4`;
 const p=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]).stdout);writeFileSync(`${qa}/${f.id}-ffprobe.json`,JSON.stringify(p,null,2));
 const video=p.streams.find(s=>s.codec_type==='video'),audio=p.streams.find(s=>s.codec_type==='audio'),sub=p.streams.find(s=>s.codec_type==='subtitle');
 if(video.width!==f.width||video.height!==f.height||video.avg_frame_rate!=='30/1'||Number(video.nb_read_frames)!==spec.duration*30||video.pix_fmt!=='yuv420p'||audio.codec_name!=='aac'||Number(audio.sample_rate)!==48000||sub)throw Error(`Technical format mismatch: ${f.id}`);
 if(Math.abs(Number(p.format.duration)-spec.duration)>.08)throw Error(`Container duration mismatch: ${f.id}`);
 ff(['-v','error','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-']);
 const raw=`${qa}/${f.id}-decoded.pcm`;ff(['-v','error','-i',file,'-vn','-ar','48000','-ac','1','-f','s16le',raw]);const decoded=pcm(raw),decodedSeconds=decoded.length/48000,corr=correlation(reference,decoded);
 if(Math.abs(decodedSeconds-spec.duration)>.08||corr<.97)throw Error(`Decoded audio mismatch: ${f.id}`);
 const byLine=spec.dialogues.map(s=>({line:s.id,at:s.at,correlation:correlation(reference,decoded,Math.round(s.at*48000),Math.round(s.slot*48000))}));if(byLine.some(s=>s.correlation<.97))throw Error(`Narration timing mismatch: ${f.id}`);
 const loud=ff(['-i',file,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-']).stderr;
 const jsonStart=loud.lastIndexOf('{');const measurement=JSON.parse(loud.slice(jsonStart,loud.indexOf('}',jsonStart)+1));if(Math.abs(Number(measurement.input_i)+16)>1||Number(measurement.input_tp)>-1)throw Error(`Audio loudness outside target: ${f.id}`);
 if(sub)throw Error(`Duplicate embedded captions: ${f.id}`);
 const row={id:f.id,file,width:video.width,height:video.height,fps:30,frames:Number(video.nb_read_frames),duration:Number(p.format.duration),decodedAudioSeconds:decodedSeconds,referenceMixCorrelation:corr,narrationWindows:byLine,loudnessLUFS:Number(measurement.input_i),truePeakDbTP:Number(measurement.input_tp),videoCodec:video.codec_name,audioCodec:audio.codec_name,subtitles:'Burned in; separate SRT',fullDecodePassed:true,bytes:statSync(file).size,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')};result.exports.push(row);console.log(`${f.id}: ${row.frames} frames, ${decodedSeconds.toFixed(3)}s decoded audio, ${row.loudnessLUFS} LUFS, ${row.truePeakDbTP} dBTP, correlation ${corr.toFixed(5)}.`);
}
const visual=JSON.parse(readFileSync(`${qa}/performance-review.json`));result.performanceReview=visual;result.technicalPassed=true;writeFileSync(`${qa}/final-verification.json`,JSON.stringify(result,null,2));console.log('All four exports passed technical verification.');
