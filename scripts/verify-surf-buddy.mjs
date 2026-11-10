import{readFileSync,writeFileSync,statSync,mkdirSync}from'node:fs';
import{spawnSync}from'node:child_process';
import{createHash}from'node:crypto';
const root=new URL('../',import.meta.url).pathname,spec=JSON.parse(readFileSync(`${root}scripts/surf-buddy-english.json`));
const dir=root+spec.directory,qa=`${dir}/qa`,file=`${dir}/exports/tips-to-trip-surf-buddy-en-60s.mp4`;
mkdirSync(qa,{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:12*1024*1024});if(r.status!==0)throw Error(`${cmd} verification failed: ${r.stderr.slice(-1200)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-y',...args]);
const p=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]).stdout);
writeFileSync(`${qa}/final-ffprobe.json`,JSON.stringify(p,null,2));
const v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio');
if(v.width!==720||v.height!==1280||v.avg_frame_rate!=='30/1'||Number(v.nb_read_frames)!==1800||v.pix_fmt!=='yuv420p'||a.codec_name!=='aac'||Number(a.sample_rate)!==48000)throw Error('Final video technical format mismatch.');
if(Math.abs(Number(p.format.duration)-60)>.08)throw Error('Final container duration mismatch.');
ff(['-v','error','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-']);
for(const[name,source]of[['reference',`${dir}/edit/final-mix.wav`],['decoded',file]])ff(['-loglevel','error','-i',source,'-vn','-ac','1','-ar','48000','-f','s16le',`${qa}/${name}-mix.pcm`]);
const pcm=p=>{const b=readFileSync(p);return new Int16Array(b.buffer,b.byteOffset,b.length/2);},reference=pcm(`${qa}/reference-mix.pcm`),decoded=pcm(`${qa}/decoded-mix.pcm`);
function corr(start=0,len=Math.min(reference.length,decoded.length)-start){let xy=0,xx=0,yy=0;for(let i=start;i<Math.min(start+len,reference.length,decoded.length);i++){const x=reference[i],y=decoded[i];xy+=x*y;xx+=x*x;yy+=y*y;}return xy/Math.sqrt(xx*yy);}
const seconds=decoded.length/48000,correlation=corr();if(Math.abs(seconds-60)>.08||correlation<.97)throw Error('Decoded final audio timing mismatch.');
const windows=spec.dialogues.map(s=>({id:s.id,at:s.at,slot:s.slot,correlation:corr(Math.round(s.at*48000),Math.round(s.slot*48000))}));if(windows.some(w=>w.correlation<.97))throw Error('Final dialogue-window timing mismatch.');
const log=ff(['-i',file,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=7:print_format=json','-f','null','-']).stderr,j=log.lastIndexOf('{'),loud=JSON.parse(log.slice(j,log.indexOf('}',j)+1));
if(Math.abs(Number(loud.input_i)+16)>1||Number(loud.input_tp)>-1)throw Error('Final audio is outside the loudness target.');
const captions=JSON.parse(readFileSync(`${dir}/edit/caption-timing.json`));if(!captions.length||captions.some((c,i)=>c.start<0||c.end>60||c.start>=c.end||(i&&c.start<captions[i-1].start)))throw Error('Caption timing is invalid.');
if(p.streams.some(s=>s.codec_type==='subtitle'))throw Error('Unexpected duplicate embedded subtitle stream.');
const native=JSON.parse(readFileSync(`${qa}/native-lipsync-review.json`)),voice=JSON.parse(readFileSync(`${qa}/final-voice-review.json`)),visual=JSON.parse(readFileSync(`${qa}/final-visual-review.json`));
if(!native.approved||!voice.approved||!visual.approved)throw Error('Required native, final voice or finished-picture review is incomplete.');
const result={technicalPassed:true,visualReviewPassed:true,file,createdAt:new Date().toISOString(),width:720,height:1280,fps:30,frames:Number(v.nb_read_frames),duration:Number(p.format.duration),decodedAudioSeconds:seconds,referenceMixCorrelation:correlation,narrationWindows:windows,loudnessLUFS:Number(loud.input_i),truePeakDbTP:Number(loud.input_tp),fullDecodePassed:true,captionCues:captions.length,captions:'Burned-in English captions and separate SRT; ElevenLabs word/character timestamps',nativeReviewBeforeFinalVoice:native.nativeReviewCompletedBeforeFinalVoiceGeneration,voiceReview:voice,visualReview:visual,bytes:statSync(file).size,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')};
writeFileSync(`${qa}/final-verification.json`,JSON.stringify(result,null,2));
writeFileSync(`${dir}/production-status.json`,JSON.stringify({status:'completed',completedExport:true,file,verification:'qa/final-verification.json',updatedAt:new Date().toISOString()},null,2));
console.log(`Verified: 720 × 1280, 30 fps, ${v.nb_read_frames} frames, ${seconds.toFixed(3)} seconds decoded audio, ${loud.input_i} LUFS, ${loud.input_tp} dBTP.`);
