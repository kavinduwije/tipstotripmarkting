import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname,base=`${root}artifacts/girls-trip-en`,rev=`${base}/lip-sync-revision`,edit=`${rev}/edit`;
mkdirSync(`${edit}/shots`,{recursive:true});mkdirSync(`${rev}/lipsync`,{recursive:true});
const plan=JSON.parse(readFileSync(`${base}/edit/edit-plan.json`)),cues=JSON.parse(readFileSync(`${base}/captions.json`));
const sources=new Map(JSON.parse(readFileSync(`${rev}/manifest.json`)).inputs.map(s=>[s.shot,s]));
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw Error(`${cmd}: ${r.stderr.slice(-1400)}`);return r;}
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
for(const s of sources.values()){
 const result=s.shot==='sunset-speaking'?`${rev}/local-trials/sunset-speaking-reviewed.mp4`:s.multiSpeaker?`${rev}/local-trials/${s.shot}-friend4-face3.mp4`:`${rev}/local-trials/${s.shot}-face-1.mp4`;
 if(!existsSync(result))throw Error(`Correction is incomplete: ${s.shot}`);
 copyFileSync(result,`${rev}/lipsync/${s.shot}.mp4`);
}
const rendered=[];
for(const s of plan){
 if(!sources.has(s.file)){rendered.push(`${base}/edit/shots/${s.id}.mp4`);continue;}
 const source=`${rev}/lipsync/${s.file}.mp4`,output=`${edit}/shots/${s.id}.mp4`,length=(s.endFrame-s.startFrame)/30;
 const signature=createHash('sha256').update(readFileSync(new URL(import.meta.url))).update(hash(source)+JSON.stringify(s)).digest('hex');
 if(!(existsSync(output)&&existsSync(output+'.sha256')&&readFileSync(output+'.sha256','utf8')===signature)){
  const args=['-ss',String(s.ss),'-i',source,'-loop','1','-framerate','30','-i',`${base}/edit/graphics/brand.png`];
  let filter=`[0:v]trim=duration=${length},setpts=PTS-STARTPTS,fps=30,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,tpad=stop_mode=clone:stop_duration=4,trim=duration=${length}${s.at<12?',eq=saturation=0.82:brightness=-.015':''}[v];[v][1:v]overlay=0:0[brand]`,label='brand',input=2;
  const selected=cues.map((c,i)=>({...c,index:i})).filter(c=>c.start<s.end&&c.end>s.at);
  for(const c of selected){
   const h=c.text.split('\n').length===2?90:58;
   args.push('-loop','1','-framerate','30','-i',`${base}/edit/graphics/caption-${c.index}.png`);
   filter+=`;[${label}][${input}:v]overlay=38:${1190-h}:enable='between(t,${Math.max(0,c.start-s.at).toFixed(3)},${Math.min(length,c.end-s.at).toFixed(3)})'[c${input}]`;label=`c${input++}`;
  }
  filter+=`;[${label}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[out]`;
  ff([...args,'-filter_complex_threads','1','-filter_complex',filter,'-map','[out]','-an','-frames:v',String(s.endFrame-s.startFrame),'-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_trc','bt709','-color_primaries','bt709',output]);
  writeFileSync(output+'.sha256',signature);
 }
 rendered.push(output);console.log(`Rebuilt speaking shot ${s.id}: ${s.file}`);
}
writeFileSync(`${edit}/concat.txt`,rendered.map(p=>`file '${p}'`).join('\n'));
const original=`${base}/tips-to-trip-girls-trip-barcelona-en-60s.mp4`,output=`${rev}/tips-to-trip-girls-trip-barcelona-en-lipsync-60s.mp4`;
ff(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',original,'-map','0:v:0','-map','1:a:0','-map','1:s:0','-c','copy','-disposition:s:0','0','-t','60','-movflags','+faststart',output]);
writeFileSync(`${rev}/edit-preservation.json`,JSON.stringify({original,output,originalSha256:hash(original),correctedSpeakingShots:plan.filter(s=>sources.has(s.file)).map(s=>s.id),unchangedShots:plan.filter(s=>!sources.has(s.file)).map(s=>({id:s.id,sha256:hash(`${base}/edit/shots/${s.id}.mp4`)})),audio:'Original compressed audio packets copied without re-encoding',captions:'Original subtitle stream and caption graphics retained',duration:60,approval:'Requires separate visual review'},null,2));
console.log(output);
