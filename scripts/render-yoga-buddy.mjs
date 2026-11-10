import {readFileSync,writeFileSync,mkdirSync,existsSync,linkSync,unlinkSync} from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import sharp from 'sharp';
import {dir,root,prepare,mapScreen,statusScreen,profileScreen,requestScreen,profileRecordingPatch} from './yoga-buddy-demo.mjs';
const spec=JSON.parse(readFileSync(`${root}scripts/yoga-buddy-english.json`));
const edit=`${dir}/edit`,stage=process.argv[2]??'render';
for(const p of [edit,`${edit}/app`,`${edit}/font-cache`,`${dir}/exports`,`${dir}/qa`])mkdirSync(p,{recursive:true});
process.env.FONTCONFIG_FILE=`${edit}/fonts.conf`;
writeFileSync(process.env.FONTCONFIG_FILE,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${root}brandKIT/04-Fonts</dir><cachedir>${edit}/font-cache</cachedir></fontconfig>`);
const W=720,H=1280,fps=30;
const scenes=[
 {id:'hook',at:0,len:8,source:'edit/performance-hook.mp4',headline:'Looking for a\nyoga buddy?'},
 {id:'intro',at:8,len:7,source:'edit/performance-intro.mp4'},
 {id:'open-app',at:15,len:2,app:true,headline:'Meet Buddy'},
 {id:'status',at:17,len:7,app:true,recording:true,statusRecording:true,start:5,sourceDuration:6,headline:'Share your yoga plan'},
 {id:'map',at:24,len:3,app:true,headline:'Find your people nearby'},
 {id:'profile',at:27,len:3,app:true,headline:'Same place. Same interest.'},
 {id:'profile-detail',at:30,len:2,app:true,headline:'Wanna meet? Say hello.'},
 {id:'request',at:32,len:4.5,app:true,headline:'Say hello with a quick note'},
 {id:'sent',at:36.5,len:1.5,app:true,recording:true,start:28.7,headline:'A new plan starts with hello'},
 {id:'pending',at:38,len:1.5,app:true,headline:'Request sent · Awaiting a response'},
 {id:'arrival',at:39.5,len:1.5,source:'broll-arrival.mp4',start:2.4,label:'A little later · Weligama garden'},
 {id:'hello',at:41,len:4,source:'edit/performance-hello.mp4'},
 {id:'ready',at:45,len:2,source:'edit/performance-ready.mp4'},
 {id:'lets-go',at:47,len:2,source:'edit/performance-lets-go.mp4'},
 {id:'walk',at:49,len:2,source:'broll-walk.mp4',start:.5},
 {id:'mats',at:51,len:2,source:'broll-mats.mp4',start:1},
 {id:'practice',at:53,len:4,source:'broll-practice.mp4',start:.8},
 {id:'wide',at:57,len:3,source:'broll-wide.mp4',start:1,brandEnding:true}
];
writeFileSync(`${edit}/scene-plan.json`,JSON.stringify(scenes,null,2));
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:12*1024*1024});if(r.status!==0)throw Error(`${cmd}: ${r.stderr.slice(-2000)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const ffAsync=async args=>new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);let e='';p.stderr.on('data',d=>e=(e+d).slice(-2500));p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(e)));});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const svg=s=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${s}</svg>`);
async function text(str,size,width,color='#FFFFFF',align='left',font='Nunito'){
 return sharp({text:{text:`<span foreground="${color}">${esc(str)}</span>`,font:`${font} ${font==='Nunito'?'ExtraBold':'SemiBold'} ${size}`,fontfile:`${root}brandKIT/04-Fonts/${font}-Variable.ttf`,width,align,rgba:true,spacing:3}}).png().toBuffer();
}
async function add(items,str,size,x,y,width,color='#FFFFFF',align='left',font='Nunito'){
 const b=await text(str,size,width,color,align,font),m=await sharp(b).metadata();items.push({input:b,left:Math.round(x+(align==='center'?(width-m.width)/2:0)),top:Math.round(y)});return m;
}
async function storeBadge(name,width,height){
 // Remove the supplied raster's white canvas and corner pixels. The Google
 // asset also has an outer grey keyline, so crop inside it before masking.
 const inset=name==='PlayStoreLogo.png'?4:1;
 const {data,info}=await sharp(`${root}General-assesets/${name}`).trim({background:'#FFFFFF',threshold:40}).toBuffer({resolveWithObject:true});
 const w=info.width-inset*2,h=info.height-inset*2;
 const mask=Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="15" fill="white"/></svg>`);
 return sharp(data).extract({left:inset,top:inset,width:w,height:h}).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer().then(b=>sharp(b).resize(width,height,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer());
}
async function overlay(s){
 const items=[];
 const base=s.app?'<rect width="720" height="1280" fill="#ECF6F3"/>':s.close?'<rect width="720" height="1280" fill="#E8F4F0"/>':'<defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#102E30" stop-opacity="0"/><stop offset="1" stop-color="#102E30" stop-opacity=".65"/></linearGradient></defs><rect y="880" width="720" height="400" fill="url(#v)"/>';
 items.push({input:svg(base),left:0,top:0});
 // Supplied branding is present in every scene, including the closing card.
 items.push({input:await sharp(`${root}General-assesets/app_logo_white.png`).resize(86,86).png().toBuffer(),left:596,top:48});
 if(s.close){
  items.push({input:await sharp(`${root}General-assesets/app_logo_white.png`).resize(240,240).png().toBuffer(),left:240,top:240});
  await add(items,'Meet Buddy',62,50,520,620,'#153B3C','center');
  await add(items,"Don't practise alone.\nFind your yoga buddy.",43,50,615,620,'#097E7C','center');
  for(const[i,n]of['AppleStoreLogo.png','PlayStoreLogo.png'].entries())items.push({input:await storeBadge(n,228,78),left:120+i*252,top:800});
 }else if(s.brandEnding){
  items.push({input:svg('<rect x="0" y="0" width="720" height="1280" fill="#103B36" fill-opacity=".32"/>'),left:0,top:0});
  items.push({input:await sharp(`${root}General-assesets/app_logo_white.png`).resize(168,168).png().toBuffer(),left:276,top:200});
  await add(items,'Meet Buddy',60,40,430,640,'#FFFFFF','center');
  await add(items,"Find your yoga buddy.",41,40,515,640,'#FFFFFF','center');
  for(const[i,n]of['AppleStoreLogo.png','PlayStoreLogo.png'].entries())items.push({input:await storeBadge(n,206,70),left:142+i*230,top:620});
 }else if(s.app){
  await add(items,s.headline,32,44,62,530,'#173D3D');
  items.push({input:svg('<rect x="103" y="149" width="514" height="1046" rx="26" fill="#163C3B"/>'),left:0,top:0});
 }else{
  if(s.headline)await add(items,s.headline,53,42,900,620);
  if(s.label)await add(items,s.label,26,42,890,620,'#FFFFFF','left','Inter');
 }
 const p=`${edit}/${s.id}-overlay.png`;await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(items).png().toFile(p);return p;
}
async function app(){
 await prepare();
 const selected=process.argv.find(a=>a.startsWith('--scenes='))?.slice(9).split(',');
 for(const s of scenes.filter(s=>s.app&&(!s.recording||s.statusRecording)&&(!selected||selected.includes(s.id)))){
  const folder=`${edit}/app/${s.id}`;mkdirSync(folder,{recursive:true});
  for(let i=0;i<Math.ceil(s.len*12);i++){
   const t=i/12;let screen;
   if(s.id==='open-app')screen=mapScreen(t,{status:false});
   else if(s.id==='status')screen=statusScreen(t,{patch:s.statusRecording});
   else if(s.id==='map')screen=mapScreen(t,{status:true,zoom:false});
   else if(s.id==='profile'||s.id==='profile-detail')screen=profileScreen(false,0,'leila');
   else if(s.id==='request')screen=requestScreen(t*.65);
   else screen=profileScreen(true,0,'leila');
   await sharp(Buffer.from(screen)).png().toFile(`${folder}/${String(i).padStart(5,'0')}.png`);
  }
  console.log(`App frames: ${s.id}`);
 }
}
function cues(){
 const selection=JSON.parse(readFileSync(`${dir}/performance-selection.json`)),out=[];
 for(const s of selection.dialogues){let group=[];const flush=()=>{if(group.length){out.push({start:s.at+group[0].start,end:s.at+group.at(-1).end,text:group.map(w=>w.text).join(' ')});group=[];}};
  for(const w of s.words){if(group.length&&(group.length>=5||[...group,w].map(w=>w.text).join(' ').length>32))flush();group.push(w);if(/[.!?]$/.test(w.text))flush();}flush();
 }return out.map(c=>({...c,text:c.text.replace(/\btips to trip\b/gi,'Tips to Trip').replace(/\bmeet\s*buddy\b/gi,'Meet Buddy')}));
}
const srtTime=t=>`${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${(t%60).toFixed(3).padStart(6,'0').replace('.',',')}`;
async function captions(){
 const cs=cues(),folder=`${edit}/captions`;mkdirSync(folder,{recursive:true});
 const blank=`${folder}/blank.png`;await sharp({create:{width:W,height:150,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toFile(blank);
 const images=[];
 for(let i=0;i<cs.length;i++){
  const c=cs[i],b=await text(c.text,31,600,'#FFFFFF','center','Inter'),m=await sharp(b).metadata(),x=Math.round((W-m.width)/2),y=Math.round((150-m.height)/2),p=`${folder}/cue-${i}.png`;
  const bg=Buffer.from(`<svg width="720" height="150"><rect x="${x-17}" y="${y-10}" width="${m.width+34}" height="${m.height+20}" rx="13" fill="#123B3B" fill-opacity=".88"/></svg>`);
  await sharp({create:{width:W,height:150,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:bg,left:0,top:0},{input:b,left:x,top:y}]).png().toFile(p);images.push(p);
 }
 for(let frame=0;frame<1800;frame++){const t=frame/30,i=cs.findIndex((c,i)=>t>=c.start&&t<Math.min(c.end+.06,cs[i+1]?.start??60)),target=`${folder}/${String(frame).padStart(5,'0')}.png`;if(existsSync(target))unlinkSync(target);linkSync(i>=0?images[i]:blank,target);}
 writeFileSync(`${edit}/caption-timing.json`,JSON.stringify(cs,null,2));
 writeFileSync(`${dir}/exports/yoga-buddy-en.srt`,cs.map((c,i)=>`${i+1}\n${srtTime(c.start)} --> ${srtTime(Math.min(c.end+.06,cs[i+1]?.start??60))}\n${c.text}\n`).join('\n'));return folder;
}
async function audio(){
 const inputs=spec.dialogues.flatMap(s=>['-i',`${dir}/edit/audio-${s.id}.wav`]);
 const filters=spec.dialogues.map((s,i)=>`[${i}:a]asetpts=PTS-STARTPTS,adelay=${Math.round(s.at*1000)}:all=1[a${i}]`);
 ff([...inputs,'-filter_complex',filters.join(';')+';'+spec.dialogues.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${spec.dialogues.length}:normalize=0,apad,atrim=duration=60,loudnorm=I=-16:TP=-1.5:LRA=7[a]`,'-map','[a]','-ar','48000','-ac','2',`${edit}/narration.wav`]);
 ff(['-i',`${edit}/narration.wav`,'-i',`${dir}/elevenlabs/music.mp3`,'-stream_loop','-1','-i',`${dir}/elevenlabs/beach-ambience.mp3`,'-filter_complex',"[0:a]asplit=2[voice][duck];[1:a]atrim=duration=60,asetpts=PTS-STARTPTS,loudnorm=I=-27:TP=-4:LRA=6,afade=t=in:d=0.3,afade=t=out:st=58.5:d=1.5[m];[m][duck]sidechaincompress=threshold=0.025:ratio=5:attack=10:release=350[bed];[2:a]atrim=duration=60,asetpts=PTS-STARTPTS,loudnorm=I=-36:TP=-8:LRA=5,volume='if(between(t,15,39.5),0.18,if(gte(t,59),0,1))':eval=frame,afade=t=in:d=0.25,afade=t=out:st=58.5:d=1.5[sea];[voice][bed][sea]amix=inputs=3:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=7,apad,atrim=duration=60[a]",'-map','[a]','-ar','48000','-ac','2',`${edit}/final-mix.wav`]);
 // Measure and normalise the finished mix in two passes. A -2.5 dBTP PCM
 // ceiling leaves headroom for AAC true-peak changes in the final export.
 const log=run('ffmpeg',['-hide_banner','-i',`${edit}/final-mix.wav`,'-af','loudnorm=I=-16:TP=-2.5:LRA=7:print_format=json','-f','null','-']).stderr;
 const begin=log.lastIndexOf('{'),measurement=JSON.parse(log.slice(begin,log.indexOf('}',begin)+1));
 writeFileSync(`${dir}/qa/mix-normalisation.json`,JSON.stringify({createdAt:new Date().toISOString(),targetLUFS:-16,targetPCMTruePeakDbTP:-2.5,measurement},null,2));
 const normalise=`loudnorm=I=-16:TP=-2.5:LRA=7:measured_I=${measurement.input_i}:measured_TP=${measurement.input_tp}:measured_LRA=${measurement.input_lra}:measured_thresh=${measurement.input_thresh}:offset=${measurement.target_offset}:linear=true`;
 ff(['-i',`${edit}/final-mix.wav`,'-af',normalise,'-ar','48000','-ac','2',`${edit}/final-mix-headroom.wav`]);
 writeFileSync(`${edit}/final-mix.wav`,readFileSync(`${edit}/final-mix-headroom.wav`));
 console.log('Separate narration and ducked music mix ready, with measured AAC peak headroom.');
}
async function render(){
 await prepare();
 const review=JSON.parse(readFileSync(`${dir}/qa/final-voice-review.json`));if(!review.approved)throw Error('Final voice and lip-sync timing review required.');
 const paths=[];
 for(const s of scenes){
  const out=`${edit}/scene-${s.id}.mp4`;paths.push(out);if(existsSync(out)&&!process.argv.includes('--force'))continue;
  const graphics=await overlay(s);let input,filter;
  if(s.close){input=['-loop','1','-i',graphics];filter='[0:v]fps=30,format=yuv420p[v]';}
  else if(s.app){
   const media=s.recording?['-ss',String(s.start),'-i',`${root}General-assesets/${s.statusRecording?'How to update meet buddy live user status cloud.mov':'Meet buddy.mov'}`]:['-framerate','12','-i',`${edit}/app/${s.id}/%05d.png`];
   input=[...media,'-loop','1','-i',graphics];
   if(s.recording){
    if(s.statusRecording)input.push('-framerate','12','-i',`${edit}/app/${s.id}/%05d.png`);
    else{const patch=`${edit}/${s.id}-native-patch.png`;await sharp(Buffer.from(profileRecordingPatch())).png().toFile(patch);input.push('-loop','1','-i',patch);}
    const nativeTrim=s.sourceDuration?`trim=duration=${s.sourceDuration},setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=${s.len-s.sourceDuration}`:'setpts=PTS-STARTPTS,fps=30';
    filter=`[1:v]fps=30[bg];[0:v]${nativeTrim},scale=604:1236,setsar=1[native];[native][2:v]overlay=0:0:shortest=1,scale=502:1027:flags=lanczos,setsar=1[app];[bg][app]overlay=109:155:shortest=1,format=yuv420p[v]`;
   }
   else filter='[1:v]fps=30[bg];[0:v]setpts=PTS-STARTPTS,fps=30,scale=502:1027:flags=lanczos,setsar=1[app];[bg][app]overlay=109:155:shortest=1,format=yuv420p[v]';
  }else{input=['-ss',String(s.start??0),'-i',`${dir}/${s.source}`,'-loop','1','-i',graphics];filter=`[0:v]setpts=PTS-STARTPTS,fps=30,scale=${Math.round(720*(s.zoom??1))}:${Math.round(1280*(s.zoom??1))}:force_original_aspect_ratio=increase,crop=720:1280:(iw-ow)/2:${s.zoom?0:'(ih-oh)/2'},setsar=1[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`;}
  filter=filter.replace(/\[v\]$/,`,tpad=stop_mode=clone:stop_duration=1,trim=duration=${s.len},setpts=PTS-STARTPTS[v]`);
  await ffAsync([...input,'-filter_complex',filter,'-map','[v]','-an','-t',String(s.len),'-frames:v',String(Math.round(s.len*30)),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-threads','4',out]);console.log(`Picture: ${s.id}`);
 }
 for(const [i,path]of paths.entries()){const n=Number(run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','csv=p=0',path]).stdout.trim());if(n!==Math.round(scenes[i].len*30))throw Error(`Scene frame count mismatch for ${scenes[i].id}: ${n}`);}
 writeFileSync(`${edit}/concat.txt`,paths.map(p=>`file '${p}'`).join('\n'));
 ff(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-c','copy',`${edit}/picture.mp4`]);
 const captionDir=await captions(),out=`${dir}/exports/${process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'tips-to-trip-yoga-buddy-en-60s.mp4'}`;
 await ffAsync(['-i',`${edit}/picture.mp4`,'-i',`${edit}/final-mix.wav`,'-framerate','30','-i',`${captionDir}/%05d.png`,'-filter_complex',"[0:v][2:v]overlay=0:y='if(between(t,15,39.5),910,1010)':shortest=1[v]",'-map','[v]','-map','1:a','-c:v','libx264','-crf','17','-preset','fast','-r','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-t','60','-movflags','+faststart','-metadata',`title=${spec.title}`,'-threads','4',out]);
 console.log(`Exported: ${out}`);
}
if(stage==='app')await app();
else if(stage==='graphics'){for(const s of scenes)await overlay(s);}
else if(stage==='audio')await audio();
else if(stage==='render')await render();
else throw Error('Choose app, graphics, audio or render.');
