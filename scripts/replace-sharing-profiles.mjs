import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const spanish=process.argv.includes('--spanish');
const language=spanish?'es':'fr';
const dir=`${root}artifacts/ugc-product-${language}`;
const profileDir=`${root}artifacts/ugc-product-fr/sharing-profiles`;
const qa=`${dir}/qa/sharing-profiles`;
const frames=`${qa}/overlays`;
const input=`${dir}/tips-to-trip-product-ugc-${language}-60s${spanish?'':'-pause-fixed'}.mp4`;
const output=`${dir}/tips-to-trip-product-ugc-${language}-60s-fresh-profiles.mp4`;
mkdirSync(frames,{recursive:true});
function run(cmd,args) {
  const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(r.status!==0)throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout;
}
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const inputHash=hash(input);
// The same recording is retimed differently in each language. These entrance
// and cut frames were reviewed in each completed export, including loading frames.
const first=spanish?696:639,last=spanish?731:686;
const fullyLoaded=spanish?700:643;
run('ffmpeg',['-hide_banner','-v','error','-y','-i',input,'-vf',`select=between(n\\,${first}\\,${last}),crop=420:330:39:800`,'-fps_mode','vfr','-start_number',String(first),`${qa}/track-%06d.png`]);
const ids=['camille','lea','self','hugo','ines'];
const labels=[['Camille','Moreau'],['Léa'],['Note to self'],['Hugo'],['Inès','Martin']];
const centers=[59,143,226,309,392];
const circle=Buffer.from('<svg width="54" height="54"><circle cx="27" cy="27" r="27" fill="white"/></svg>');
const avatars=[];
for(const id of ids) {
  // Crop to the face, excluding any generated peripheral social UI.
  const avatar=await sharp(`${profileDir}/${id}.png`).extract({left:180,top:180,width:1176,height:1176}).resize(54,54).composite([{input:circle,blend:'dest-in'}]).png().toBuffer();
  avatars.push(avatar);
  await sharp(avatar).toFile(`${qa}/${id}-avatar.png`);
}
const tracking=[];
for(let n=first;n<=last;n++) {
  const original=`${qa}/track-${String(n).padStart(6,'0')}.png`;
  const {data,info}=await sharp(original).removeAlpha().raw().toBuffer({resolveWithObject:true});
  let yMin=Infinity,yMax=-Infinity,count=0;
  // The original first avatar's orange disk tracks the share-sheet spring.
  // Exclude the app-icon row, which also contains warm colors during swiping.
  for(let y=35;y<(n<fullyLoaded?250:160);y++)for(let x=35;x<85;x++) {
    const p=(y*info.width+x)*info.channels,[r,g,b]=data.subarray(p,p+3);
    const orange=n<fullyLoaded ? r>205&&g>100&&g<245&&b>100&&b<240&&r>g+12&&r>b+15 : r>185&&g>80&&g<200&&b>80&&b<195&&r>g+25&&r>b+20;
    if(orange){yMin=Math.min(yMin,y);yMax=Math.max(yMax,y);count++;}
  }
  if(n!==first&&count<600)throw new Error(`Share sheet tracking failed at frame ${n}`);
  // The first loading frame has white avatars; its separator is 165 px lower.
  const dy=n===first?165:Math.round((yMin+yMax)/2-91);
  const comps=avatars.map((image,i)=>({input:image,left:centers[i]-27,top:4}));
  const text=labels.map((lines,i)=>lines.map((line,j)=>`<text x="${centers[i]}" y="${82+j*19}" text-anchor="middle">${line}</text>`).join('')).join('');
  comps.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="420" height="114"><g fill="#111111" font-family="Arial" font-size="14">${text}</g></svg>`),left:0,top:0});
  // Retain the actual destination service badges from this same moving frame.
  for(let i=0;i<5;i++) {
    const bx=[68,151,234,317,400][i];
    const width=Math.min(27,420-bx);
    const badgeMask=Buffer.from(`<svg width="${width}" height="28"><rect width="27" height="28" rx="7" fill="white"/></svg>`);
    const badge=await sharp(original).extract({left:bx,top:101+dy,width,height:28}).ensureAlpha().composite([{input:badgeMask,blend:'dest-in'}]).png().toBuffer();
    comps.push({input:badge,left:bx,top:40});
  }
  let patch=await sharp({create:{width:420,height:114,channels:4,background:{r:250,g:250,b:252,alpha:1}}}).composite(comps).png().toBuffer();
  if(n<fullyLoaded)patch=await sharp(patch).composite([{input:Buffer.from(`<svg width="420" height="114"><rect width="420" height="114" fill="#fafafc" opacity="${n===first?0.9:n===first+1?0.45:0.25}"/></svg>`)}]).png().toBuffer();
  if(n<fullyLoaded+2)patch=await sharp(patch).blur(n<fullyLoaded+1?0.7:0.4).png().toBuffer();
  const clippedHeight=Math.min(114,1127-(861+dy));
  patch=await sharp(patch).extract({left:0,top:0,width:420,height:clippedHeight}).png().toBuffer();
  await sharp({create:{width:720,height:1280,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:patch,left:39,top:861+dy}]).png().toFile(`${frames}/profile-${String(n).padStart(6,'0')}.png`);
  tracking.push({frame:n,seconds:n/30,verticalOffset:dy,detectedPixels:count});
}
writeFileSync(`${qa}/overlay-tracking.json`,JSON.stringify(tracking,null,2));
run('ffmpeg',['-hide_banner','-v','error','-y','-i',input,'-framerate','30','-start_number',String(first),'-i',`${frames}/profile-%06d.png`,
  '-filter_complex',`[1:v]setpts=PTS+${first}/(30*TB)[profiles];[0:v][profiles]overlay=0:0:eof_action=pass:enable='between(n,${first},${last})'[out]`,
  '-map','[out]','-map','0:a:0','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-r','30','-fps_mode','cfr','-c:a','copy','-map_metadata','0','-t','60','-movflags','+faststart',output]);
const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','stream=codec_type,width,height,r_frame_rate,nb_frames:format=duration','-of','json',output]));
const video=probe.streams.find(s=>s.codec_type==='video');
if(Number(probe.format.duration)!==60||video.width!==720||video.height!==1280||video.r_frame_rate!=='30/1'||video.nb_frames!=='1800')throw new Error('Invalid export');
run('ffmpeg',['-hide_banner','-v','error','-xerror','-i',output,'-map','0:v','-map','0:a','-f','null','-']);
const audioHash=file=>run('ffmpeg',['-hide_banner','-v','error','-i',file,'-map','0:a','-c','copy','-f','streamhash','-hash','sha256','-']).trim();
const audio=audioHash(input);
if(audio!==audioHash(output))throw new Error('Audio changed');
if(inputHash!==hash(input))throw new Error('Source changed');
writeFileSync(`${qa}/verification.json`,JSON.stringify({source:input,output,language,scope:'Fictional names and generated profile photos in the Sharing text contact row',firstFrame:first,lastFrame:last,profileProvider:'Higgsfield',profileModel:'higgsfield-ai/soul/v2/standard',profileAssetsReused:true,profiles:ids.map((id,i)=>({id,displayName:labels[i].join(' '),file:`${profileDir}/${id}.png`,fictional:true})),noteToSelfLabelPreserved:true,probe,fullDecodePassed:true,audioStreamUnchanged:true,audioSHA256:audio,sourceFileUnchanged:true,sourceSHA256:inputHash,outputSHA256:hash(output),visualReviewPending:true},null,2));
console.log(`Exported: ${output}. Full decode passed; audio unchanged; 60 seconds, 720 × 1280, 30 fps.`);
