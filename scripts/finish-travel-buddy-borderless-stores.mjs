import sharp from 'sharp';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url).pathname;
const base=`${root}artifacts/travel-buddy-en`, edit=`${base}/edit`, rev=`${base}/revision-06`;
const previous=`${base}/tips-to-trip-travel-buddy-en-58s-route-entry.mp4`;
const output=`${base}/tips-to-trip-travel-buddy-en-58s-borderless-stores.mp4`;
mkdirSync(`${rev}/outro-overlays`,{recursive:true});
mkdirSync(`${rev}/qa`,{recursive:true});
const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
const previousHash=hash(previous);
function run(cmd,args){const p=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(p.status!==0)throw new Error(`${cmd}: ${p.stderr.slice(-1800)}`);return p.stdout;}
const ff=args=>run('ffmpeg',['-hide_banner','-v','error','-y',...args]);

// Remove only the edge-connected white canvas and grey outer rim. Enclosed
// white lettering and the store symbols remain untouched.
const stores=[];
for(const name of ['AppleStoreLogo','PlayStoreLogo']){
  const {data,info}=await sharp(`${root}General-assesets/${name}.png`).extract({left:29,top:220,width:542,height:162}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:w,height:h}=info,seen=new Uint8Array(w*h),queue=[];
  const add=(x,y)=>{const p=y*w+x;if(seen[p])return;const q=p*4;if(Math.max(data[q],data[q+1],data[q+2])<60)return;seen[p]=1;queue.push(p);};
  for(let x=0;x<w;x++){add(x,0);add(x,h-1);}for(let y=0;y<h;y++){add(0,y);add(w-1,y);}
  for(let i=0;i<queue.length;i++){const p=queue[i],x=p%w,y=Math.floor(p/w);if(x)add(x-1,y);if(x<w-1)add(x+1,y);if(y)add(x,y-1);if(y<h-1)add(x,y+1);}
  for(let p=0;p<seen.length;p++)if(seen[p]){data[p*4]=data[p*4+1]=data[p*4+2]=0;data[p*4+3]=0;}
  const png=await sharp(data,{raw:{width:w,height:h,channels:4}}).resize(270,81).png().toBuffer();
  writeFileSync(`${rev}/${name}-transparent.png`,png);stores.push(png);
}

// Rebuild the closing presenter from the cached clean performance and its
// original overlays, so removed corners reveal real footage below them.
const clear=Buffer.from('<svg width="720" height="1280"><rect x="78" y="984" width="270" height="81" fill="white"/><rect x="372" y="984" width="270" height="81" fill="white"/></svg>');
for(let n=0;n<210;n++){
  const clean=await sharp(`${edit}/final-overlays/${String(1530+n).padStart(6,'0')}.png`).composite([{input:clear,blend:'dest-out'}]).png().toBuffer();
  await sharp(clean).composite(stores.map((input,i)=>({input,left:78+i*294,top:984}))).png().toFile(`${rev}/outro-overlays/${String(n).padStart(6,'0')}.png`);
}
ff(['-i',`${edit}/outro-screen-composited.mp4`,'-framerate','30','-i',`${rev}/outro-overlays/%06d.png`,'-filter_complex_threads','1','-filter_complex','[0:v]fps=30,setpts=PTS-STARTPTS,setsar=1[b];[b][1:v]overlay=0:0:shortest=1[v]','-map','[v]','-frames:v','210','-an','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p',`${rev}/outro.mp4`]);

// The end card uses the original gradient underneath the same badge locations.
const patches=await Promise.all([78,372].map(left=>sharp(`${edit}/background.png`).extract({left,top:922,width:270,height:81}).png().toBuffer()));
const endClean=await sharp(`${edit}/overlays/001740.png`).composite(patches.map((input,i)=>({input,left:78+i*294,top:922}))).png().toBuffer();
await sharp(endClean).composite(stores.map((input,i)=>({input,left:78+i*294,top:922}))).png().toFile(`${rev}/endcard.png`);
ff(['-i',previous,'-i',`${rev}/outro.mp4`,'-loop','1','-framerate','30','-i',`${rev}/endcard.png`,'-filter_complex_threads','1','-filter_complex','[0:v]trim=end_frame=1470,setpts=PTS-STARTPTS[head];[1:v]trim=end_frame=210,setpts=PTS-STARTPTS[tail];[2:v]trim=end_frame=60,setpts=PTS-STARTPTS[card];[head][tail][card]concat=n=3:v=1:a=0[v]','-map','[v]','-map','0:a:0','-map','0:s:0','-frames:v','1740','-t','58','-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','copy','-c:s','copy','-disposition:s:0','0','-movflags','+faststart',output]);

const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,duration,nb_frames:format=duration','-of','json',output]));
const video=probe.streams.find(s=>s.codec_type==='video');
if(probe.format.duration!=='58.000000'||video.width!==720||video.height!==1280||video.r_frame_rate!=='30/1'||video.nb_frames!=='1740')throw new Error('Unexpected video format');
ff(['-xerror','-i',output,'-map','0:v','-map','0:a','-f','null','-']);
const streamHash=(file,kind)=>run('ffmpeg',['-v','error','-i',file,'-map',`0:${kind}:0`,'-c','copy','-f','hash','-hash','sha256','-']).trim();
const audioUnchanged=streamHash(previous,'a')===streamHash(output,'a');
const subtitlesUnchanged=streamHash(previous,'s')===streamHash(output,'s');
if(!audioUnchanged||!subtitlesUnchanged||previousHash!==hash(previous))throw new Error('Preserved streams or previous export changed');
for(const [name,time] of [['outro-start',49],['closing',53.3],['closing-end',55.9],['endcard',56.5]])ff(['-ss',String(time),'-i',output,'-frames:v','1',`${rev}/qa/${name}.png`]);
const edits={previousExport:previous,previousExportSha256:previousHash,output,outputSha256:hash(output),requestedChange:'Remove white borders from both store badges in the closing presenter and closing card.',method:'Remove edge-connected white canvas and grey rim from supplied native store assets; composite transparent badges over cached clean presenter footage and original end-card background.',affectedFinalTimes:[49,58],originalsPreserved:true,audioStreamUnchanged:audioUnchanged,subtitleStreamUnchanged:subtitlesUnchanged,previousSourceEdits:'../revision-05/source-edits.json'};
writeFileSync(`${rev}/source-edits.json`,JSON.stringify(edits,null,2)+'\n');
writeFileSync(`${rev}/verification.json`,JSON.stringify({output,outputSha256:hash(output),status:'technical-checks-passed-awaiting-visual-review',probe,fullDecodePassed:true,audioStreamUnchanged:audioUnchanged,subtitleStreamUnchanged:subtitlesUnchanged,sourceFileUnchanged:true,visualReviewPending:true,approvedFinalCampaign:false,priorVerification:'../revision-05/verification.json'},null,2)+'\n');
console.log(JSON.stringify({output,audioUnchanged,subtitlesUnchanged,fullDecodePassed:true}));
