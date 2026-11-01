import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,base=`${root}artifacts/girls-trip-en`,rev=`${base}/lip-sync-revision`;
const original=`${base}/tips-to-trip-girls-trip-barcelona-en-60s.mp4`,file=`${rev}/tips-to-trip-girls-trip-barcelona-en-lipsync-60s.mp4`;
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:24*1024*1024});if(r.status!==0)throw Error(`${cmd}: ${r.stderr.slice(-1000)}`);return r;}
function streamHash(path,selector){return run('ffmpeg',['-v','error','-i',path,'-map',selector,'-c','copy','-f','hash','-hash','sha256','-']).stdout.trim();}
function audioTimes(path){return JSON.parse(run('ffprobe',['-v','error','-select_streams','a:0','-show_packets','-show_entries','packet=pts_time,duration_time','-of','json',path]).stdout).packets;}
const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_format','-show_streams','-of','json',file]).stdout);
const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio'),subs=probe.streams.find(s=>s.codec_type==='subtitle');
run('ffmpeg',['-v','error','-i',file,'-map','0:v','-map','0:a','-f','null','-']);
const originalAudio=streamHash(original,'0:a:0'),correctedAudio=streamHash(file,'0:a:0');
const originalCaptions=streamHash(original,'0:s:0'),correctedCaptions=streamHash(file,'0:s:0');
const oldTimes=audioTimes(original),newTimes=audioTimes(file),audioTimingUnchanged=oldTimes.length===newTimes.length&&oldTimes.every((p,i)=>Math.abs(Number(p.pts_time)-Number(newTimes[i].pts_time))<.00005&&Math.abs(Number(p.duration_time)-Number(newTimes[i].duration_time))<.00005);
const decoded=spawnSync('ffmpeg',['-v','error','-i',file,'-vn','-ar','48000','-ac','1','-f','s16le','-'],{maxBuffer:16*1024*1024});if(decoded.status!==0)throw Error('Decoded audio validation failed.');
const audioSeconds=decoded.stdout.length/2/48000;
const preservation=JSON.parse(readFileSync(`${rev}/edit-preservation.json`));
const checks={duration:Math.abs(Number(probe.format.duration)-60)<.035,dimensions:video.width===720&&video.height===1280,frameRate:video.r_frame_rate==='30/1',frames:Number(video.nb_read_frames)===1800,audioPresent:!!audio,captionsPresent:!!subs,decodedAudioDuration:Math.abs(audioSeconds-60)<.05,audioPacketsUnchanged:originalAudio===correctedAudio,audioTimingUnchanged,subtitlePacketsUnchanged:originalCaptions===correctedCaptions,sevenSpeakingShotsReplaced:preservation.correctedSpeakingShots.length===7,seventeenShotsReused:preservation.unchangedShots.length===17,fullDecode:true};
const report={file,checks,technicalChecksPassed:Object.values(checks).every(Boolean),duration:probe.format.duration,audioSeconds,audioSha256:correctedAudio,subtitleSha256:correctedCaptions,limitation:'Technical checks do not establish mouth animation quality or phoneme-level synchronisation; see visual-review.json.'};
writeFileSync(`${rev}/qa/final-ffprobe.json`,JSON.stringify(probe,null,2));writeFileSync(`${rev}/qa/final-verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.technicalChecksPassed)process.exitCode=1;
