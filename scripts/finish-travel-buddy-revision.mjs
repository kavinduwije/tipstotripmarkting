import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,base=`${root}artifacts/travel-buddy-en`,rev=`${base}/revision-02`,edit=`${base}/edit`;
mkdirSync(`${rev}/qa`,{recursive:true});
const original=`${base}/tips-to-trip-travel-buddy-en-60s.mp4`,output=`${base}/tips-to-trip-travel-buddy-en-58s-revised.mp4`;
const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex'),originalHash=hash(original);
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`${cmd}: ${r.stderr.slice(-1500)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-v','error','-y',...args]);
const probe=f=>JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration:format=duration','-of','json',f]).stdout);
// The official caption alignment ends the final opening word at 4.458 s.
// Remove 60 silent frames after it, retaining the full spoken brand name.
const cut={startFrame:135,endFrame:195,start:4.5,end:6.5,removedSeconds:2};
const originalCues=JSON.parse(readFileSync(`${base}/captions-final.json`));
if(originalCues.some(c=>c.start<cut.end&&c.end>cut.start))throw new Error('Cut overlaps a captioned spoken word');
const cues=originalCues.map(c=>({...c,start:c.start>=cut.end?c.start-2:c.start,end:c.end>=cut.end?c.end-2:c.end}));
if(cues.some((c,i)=>c.start<0||c.end>58||c.end<=c.start||(i&&c.start<cues[i-1].end)))throw new Error('Revised caption boundaries invalid');
const stamp=t=>{const n=Math.round(t*1000);return`00:${String(Math.floor(n/60000)).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')},${String(n%1000).padStart(3,'0')}`;};
writeFileSync(`${rev}/captions-revised.json`,JSON.stringify(cues,null,2));
writeFileSync(`${rev}/captions-revised.srt`,cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
console.log('Finishing revised physical-phone demonstration');
ff(['-loop','1','-framerate','30','-i',`${edit}/background.png`,'-i',`${rev}/hands-screen-composited.mp4`,'-framerate','30','-start_number','210','-i',`${edit}/final-overlays/%06d.png`,'-filter_complex_threads','1','-filter_complex','[1:v]scale=864:1536,crop=720:930:72:135,setsar=1[phone];[0:v][phone]overlay=0:170:shortest=1[base];[base][2:v]overlay=0:0:shortest=1[out]','-map','[out]','-an','-frames:v','1320','-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',`${rev}/final-hands-revised.mp4`]);
writeFileSync(`${rev}/concat.txt`,[`file '${edit}/final-intro.mp4'`,`file '${rev}/final-hands-revised.mp4'`,`file '${edit}/final-outro.mp4'`,`file '${edit}/final-endcard.mp4'`].join('\n'));
console.log('Removing opening pause and retiming captions and audio');
ff(['-f','concat','-safe','0','-i',`${rev}/concat.txt`,'-i',`${edit}/campaign-final-mix.wav`,'-i',`${rev}/captions-revised.srt`,'-filter_complex_threads','1','-filter_complex',`[0:v]split=2[v0][v1];[v0]trim=end_frame=${cut.startFrame},setpts=PTS-STARTPTS[before];[v1]trim=start_frame=${cut.endFrame},setpts=PTS-STARTPTS[after];[before][after]concat=n=2:v=1:a=0[v];[1:a]asplit=2[a0][a1];[a0]atrim=end=${cut.start},asetpts=PTS-STARTPTS,afade=t=out:st=4.485:d=0.015[ab];[a1]atrim=start=${cut.end},asetpts=PTS-STARTPTS,afade=t=in:d=0.015[aa];[ab][aa]concat=n=2:v=0:a=1,asetpts=N/SR/TB[a]`,'-map','[v]','-map','[a]','-map','2:s','-frames:v','1740','-t','58','-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-c:s','mov_text','-disposition:s:0','0','-metadata:s:a:0','language=eng','-metadata:s:s:0','language=eng','-movflags','+faststart',output]);
const p=probe(output),v=p.streams.find(s=>s.codec_type==='video');
if(Number(p.format.duration)!==58||v.nb_frames!=='1740'||v.width!==720||v.height!==1280||v.r_frame_rate!=='30/1'||!p.streams.some(s=>s.codec_type==='audio')||!p.streams.some(s=>s.codec_type==='subtitle'))throw new Error('Incorrect revised format');
run('ffmpeg',['-v','error','-xerror','-i',output,'-map','0:v','-map','0:a','-f','null','-']);
ff(['-i',output,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',`${rev}/qa/decoded-final.wav`]);
ff(['-i',`${edit}/final-narration.wav`,'-filter_complex',`[0:a]asplit=2[a][b];[a]atrim=end=${cut.start},asetpts=PTS-STARTPTS[x];[b]atrim=start=${cut.end},asetpts=PTS-STARTPTS[y];[x][y]concat=n=2:v=0:a=1[out]`,'-map','[out]','-ac','1','-ar','16000','-c:a','pcm_s16le',`${rev}/qa/expected-narration.wav`]);
const removed=run('ffmpeg',['-hide_banner','-ss',String(cut.start),'-t','2','-i',`${edit}/final-narration.wav`,'-af','volumedetect','-f','null','-']).stderr;
const maxDb=Number(removed.match(/max_volume: ([-\d.]+)/)?.[1]);
if(!Number.isFinite(maxDb)||maxDb>-45)throw new Error(`Removed interval may include speech: ${maxDb} dB`);
function envelope(file){const b=readFileSync(file);let data;for(let pos=12;pos+8<b.length;){const size=b.readUInt32LE(pos+4);if(b.toString('ascii',pos,pos+4)==='data'){data=b.subarray(pos+8,pos+8+size);break;}pos+=8+size+(size%2);}if(!data)throw new Error('Invalid WAV');const vals=[];for(let i=0;i+320<=data.length;i+=320){let total=0;for(let j=0;j<320;j+=2)total+=data.readInt16LE(i+j)**2;vals.push(Math.sqrt(total/160));}return vals;}
const expected=envelope(`${rev}/qa/expected-narration.wav`),decoded=envelope(`${rev}/qa/decoded-final.wav`);
function corr(start,end,lag){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(let i=start;i<end;i++){const a=expected[i],b=decoded[i+lag];if(a===undefined||b===undefined)continue;n++;x+=a;y+=b;xx+=a*a;yy+=b*b;xy+=a*b;}return(n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));}
const timing=[['intro',0],['create',5],['preferences',15],['details',22],['share',29],['manage',33],['chat',40],['outro',49]].map(([section,start])=>{let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=corr(start*100,start*100+Math.min(section==='share'?350:400,5800-start*100),lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}return{section,start,...best};});
if(timing.some(t=>t.correlation<.8||Math.abs(t.shiftSeconds)>.04))throw new Error('Revised narration timing requires review');
const duration=Number(probe(`${rev}/qa/decoded-final.wav`).format.duration);
if(Math.abs(duration-58)>.03)throw new Error('Decoded audio duration incorrect');
const loud=run('ffmpeg',['-hide_banner','-i',output,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','-']).stderr;
const loudness=JSON.parse(loud.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
if(Math.abs(Number(loudness.input_i)+16)>1.2||Number(loudness.input_tp)>-1)throw new Error('Mix loudness requires correction');
if(originalHash!==hash(original))throw new Error('Original export changed');
for(const [name,time] of [['opening-before-cut',4.45],['opening-after-cut',4.52],['create',5.1],['gallery',13.5],['gallery-last-frame',14.96],['trip-photos',26.8],['sharing-first',27.5],['sharing',30],['sharing-last',32.96],['closing',53.3],['endcard',56.5]])ff(['-ss',String(time),'-i',output,'-frames:v','1',`${rev}/qa/final-${name}.png`]);
ff(['-i',output,'-vf','fps=1/2,scale=180:320,tile=6x5','-frames:v','1',`${rev}/qa/final-contact.jpg`]);
const edits={previousExport:original,sourceFileUnchanged:true,previousExportSha256:originalHash,output,outputSha256:hash(output),requestedChanges:[{type:'remove-opening-silent-wait',originalTimeline:cut,removedNarrationMaxDb:maxDb,reason:'Frame-aligned silent cut immediately after the complete spoken brand name; identical video, audio and caption time mapping.'},{type:'replace-gallery-images',originalStart:15,originalEnd:17,revisedStart:13,revisedEnd:15,tiles:9,subject:'Barcelona city landmarks',followThrough:'Both selected trip photos also replaced as they enter the details view; native scroll retained.'},{type:'replace-sharing-contacts',originalStart:29.5,originalEnd:35,revisedStart:27.5,revisedEnd:33,names:['Emma Wilson','Lucas Martin','Sofia Costa'],fictional:true,portraits:'Reused cached Higgsfield fictional portraits',controls:'Native service badges, share actions, modal title, preview and separators preserved.'}],backendClaim:false,sourceEditsInherited:'../source-edits.json',assetSources:'asset-sources.json',tracking:'screen-edit-tracking.json',originalsPreserved:true};
writeFileSync(`${rev}/source-edits.json`,JSON.stringify(edits,null,2));
const report={output,status:'technical-checks-passed-awaiting-visual-review',approvedFinalCampaign:false,probe:p,fullDecodePassed:true,decodedAudioDuration:duration,loudness,exportedNarrationTiming:timing,allPreviouslyVerifiedSpokenWordsRetained:true,removedNarrationMaxDb:maxDb,captions:{cues:cues.length,retimedBySameCut:true,burnedIn:true,optionalMovText:true,sidecar:'captions-revised.srt'},sourceFileUnchanged:true,previousExportSha256:originalHash,outputSha256:hash(output),sourceEdits:'source-edits.json',visualReviewPending:true};
writeFileSync(`${rev}/verification.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({output,duration:58,frames:1740,fullDecodePassed:true,removedNarrationMaxDb:maxDb,loudnessLUFS:loudness.input_i,timing},null,2));
