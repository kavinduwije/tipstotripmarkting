import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const dir=`${root}artifacts/ugc-product-fr`;
const qa=`${dir}/qa/pause-fix`;
const input=`${dir}/tips-to-trip-product-ugc-fr-60s.mp4`;
const output=`${dir}/tips-to-trip-product-ugc-fr-60s-pause-fixed.mp4`;
// Cover the entire reported interval, including the last word's quiet tail.
const start=43,end=45;
mkdirSync(qa,{recursive:true});
function run(cmd,args) {
  const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(r.status!==0)throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout;
}
const matte=`${qa}/app-cutaway-matte.png`;
// Keep the existing header, supplied logo, captions and app pixels. During the
// silent tail, center the same moving app screen instead of showing a talking face.
await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><clipPath id="body"><rect y="215" width="720" height="933"/></clipPath></defs><g clip-path="url(#body)"><rect y="215" width="720" height="933" fill="#F4F9F7"/><circle cx="760" cy="855" r="335" fill="#E0F2EC"/><rect x="132" y="225" width="456" height="916" rx="28" fill="#C4DAD1"/><rect x="136" y="229" width="448" height="908" rx="24" fill="#FFFFFF"/></g></svg>')).png().toFile(matte);
const enable=`gte(t,${start})*lt(t,${end})`;
run('ffmpeg',['-hide_banner','-v','error','-y','-i',input,'-loop','1','-i',matte,
  '-filter_complex',`[0:v]split=2[base][app];[app]crop=440:900:28:233[phone];[base][1:v]overlay=0:0:enable='${enable}':shortest=1[stage];[stage][phone]overlay=140:233:enable='${enable}':shortest=1[out]`,
  '-map','[out]','-map','0:a:0','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-r','30','-fps_mode','cfr','-c:a','copy','-map_metadata','0','-t','60','-movflags','+faststart',output]);
const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,width,height,r_frame_rate,nb_frames:format=duration','-of','json',output]));
const video=probe.streams.find(s=>s.codec_type==='video');
if(Number(probe.format.duration)!==60||video.width!==720||video.height!==1280||video.r_frame_rate!=='30/1'||video.nb_frames!=='1800')throw new Error('Invalid corrected export');
run('ffmpeg',['-hide_banner','-v','error','-xerror','-i',output,'-map','0:v','-map','0:a','-f','null','-']);
function audioHash(file) {
  const lines=run('ffmpeg',['-hide_banner','-v','error','-i',file,'-map','0:a','-c','copy','-f','streamhash','-hash','sha256','-']);
  return lines.trim();
}
const sourceAudio=audioHash(input),finalAudio=audioHash(output);
if(sourceAudio!==finalAudio)throw new Error('Audio changed during visual correction');
const verification={output,source:input,scope:'Reported presenter mismatch at 43–45 seconds only',method:'App-only cutaway; no regenerated mouth animation or speech',cutaway:{start,end,firstFrame:1290,lastFrameExclusive:1350,presenterReturnsAtSeconds:45},probe,fullDecodePassed:true,audioStreamUnchanged:true,audioSHA256:finalAudio,originalFileSHA256:createHash('sha256').update(readFileSync(input)).digest('hex'),finalFileSHA256:createHash('sha256').update(readFileSync(output)).digest('hex'),visualReviewPending:true};
writeFileSync(`${qa}/verification.json`,JSON.stringify(verification,null,2));
console.log(`Exported and decoded: ${output}. Audio stream unchanged; 60 seconds, 720 × 1280, 30 fps.`);
