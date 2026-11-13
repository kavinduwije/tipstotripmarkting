import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {dir,prepare,profileScreen,requestScreen} from './surf-buddy-demo.mjs';

// Revise the completed export so the bottom sheet, native sent transition,
// captions and original audio all come directly from the reviewed video.
const source=`${dir}/exports/tips-to-trip-surf-buddy-en-60s.mp4`;
const output=`${dir}/exports/tips-to-trip-surf-buddy-en-60s-nia-profile-fixed.mp4`;
const revision=`${dir}/profile-fix`;
mkdirSync(revision,{recursive:true});
function run(cmd,args){
 const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:12*1024*1024});
 if(r.status!==0)throw Error(`${cmd}: ${r.stderr.slice(-1800)}`);
 return r;
}
const ff=args=>run('ffmpeg',['-hide_banner','-y',...args]);
await prepare();
for(const [id,screen,height] of [['profile',profileScreen(),234],['request-background',requestScreen(0),152]]){
 const raster=`${revision}/${id}-native.png`,scaled=`${revision}/${id}-scaled.png`;
 await sharp(Buffer.from(screen)).png().toFile(raster);
 ff(['-loglevel','error','-i',raster,'-vf','scale=502:1027:flags=lanczos','-frames:v','1',scaled]);
 // Even output placement prevents YUV chroma rounding from moving the patch.
 await sharp(scaled).extract({left:131,top:123,width:236,height}).png().toFile(`${revision}/${id}.png`);
}
ff(['-loglevel','error','-i',source,'-loop','1','-i',`${revision}/profile.png`,'-loop','1','-i',`${revision}/request-background.png`,
 '-filter_complex',"[0:v][1:v]overlay=240:278:enable='between(n,810,959)+between(n,1095,1184)'[profile];[profile][2:v]overlay=240:278:enable='between(n,960,1094)'[v]",
 '-map','[v]','-map','0:a:0','-map_metadata','0','-c:v','libx264','-crf','15','-preset','fast','-pix_fmt','yuv420p','-threads','4',
 '-c:a','copy','-t','60','-movflags','+faststart',output]);
const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',output]).stdout);
const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
if(v.width!==720||v.height!==1280||v.avg_frame_rate!=='30/1'||Number(v.nb_read_frames)!==1800||Number(probe.format.duration)!==60||!a)throw Error('Unexpected export format');
ff(['-v','error','-xerror','-i',output,'-map','0:v','-map','0:a','-f','null','-']);
const audioHash=f=>ff(['-loglevel','error','-i',f,'-map','0:a','-c','copy','-f','hash','-hash','sha256','-']).stdout.trim();
const sourceAudio=audioHash(source),finalAudio=audioHash(output);
if(sourceAudio!==finalAudio)throw Error('Original audio was changed');
const pcm=`${revision}/decoded-audio.pcm`;
ff(['-loglevel','error','-i',output,'-vn','-ar','48000','-ac','1','-f','s16le',pcm]);
const decodedAudioSeconds=readFileSync(pcm).length/(48000*2);
if(Math.abs(decodedAudioSeconds-60)>.03)throw Error('Decoded audio duration mismatch');
const comparison=ff(['-i',source,'-i',output,'-filter_complex',
 '[0:v]trim=start_frame=960:end_frame=1095,setpts=PTS-STARTPTS,crop=502:750:109:432[old];[1:v]trim=start_frame=960:end_frame=1095,setpts=PTS-STARTPTS,crop=502:750:109:432[new];[old][new]ssim',
 '-an','-f','null','-']).stderr;
const sheetSSIM=Number(comparison.match(/All:([\d.]+)/)?.[1]);
if(!(sheetSSIM>.995))throw Error(`Bottom sheet preservation requires review: SSIM ${sheetSSIM}`);
const captions=JSON.parse(readFileSync(`${dir}/edit/caption-timing.json`));
if(!captions.length||captions.some(c=>c.start<0||c.end>60||c.start>=c.end))throw Error('Caption timing mismatch');
writeFileSync(`${revision}/verification.json`,JSON.stringify({source,output,technicalPassed:true,
 duration:60,width:720,height:1280,fps:30,frames:1800,fullDecodePassed:true,
 correctedFrames:{profile:[[810,959],[1095,1184]],dimmedBackground:[[960,1094]]},
 scope:'Nia Williams photo, name and handle in the profile from 27 seconds through the final Meet Buddy frame at 39.4667 seconds. The app scene ends at 39.5 seconds.',
 bottomSheet:{sourcePixelsRetained:true,comparisonFrames:135,ssim:sheetSSIM,photosAndNamesUnedited:true},
 audio:{copiedUnchanged:true,sha256:finalAudio,decodedAudioSeconds},
 captions:{sourcePixelsRetained:true,cues:captions.length,sidecar:'exports/surf-buddy-en.srt'},
 visualReview:'pending',createdAt:new Date().toISOString()},null,2));
console.log(`Exported and technically verified: ${output}\nBottom sheet SSIM: ${sheetSSIM}; original audio copied unchanged.`);
