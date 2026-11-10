import {readFileSync,writeFileSync,mkdirSync,existsSync,linkSync,unlinkSync} from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import sharp from 'sharp';
import * as demo from './meet-story-demo.mjs';
const root=new URL('../',import.meta.url).pathname,campaign=process.argv.find(a=>a.startsWith('--campaign='))?.split('=')[1]??'travel';
if(!['travel','meet'].includes(campaign))throw Error('Choose travel or meet.');
const spec=JSON.parse(readFileSync(`${root}scripts/${campaign}-buddy-story-english.json`)),dir=root+spec.directory;
const prepare=async()=>{if(campaign==='meet')await demo.prepare();};
const edit=`${dir}/edit`,stage=process.argv[2]??'render';
for(const p of [edit,`${edit}/app`,`${edit}/font-cache`,`${dir}/exports`,`${dir}/qa`])mkdirSync(p,{recursive:true});
process.env.FONTCONFIG_FILE=`${edit}/fonts.conf`;
writeFileSync(process.env.FONTCONFIG_FILE,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${root}brandKIT/04-Fonts</dir><cachedir>${edit}/font-cache</cachedir></fontconfig>`);
const W=720,H=1280,fps=30;
const createSource='General-assesets/Travel Buddy/TravelBuddyPostCreationSharing.mov',chatSource='General-assesets/Travel Buddy/Manage trip - group chat.mov';
const scenes=campaign==='travel'?[
{id:'opener',at:0,len:3,opener:true},
{id:'hook',at:3,len:7,source:'edit/performance-hook.mp4'},
{id:'create',at:10,len:3,app:true,recording:createSource,start:4,speed:2,headline:'Create your Travel Buddy post',chapter:'01 / MAKE A PLAN'},
{id:'route',at:13,len:3,app:true,recording:createSource,start:15,speed:2.5,headline:'Your route. Your dates.',chapter:'01 / MAKE A PLAN'},
{id:'itinerary',at:16,len:3,app:true,recording:createSource,start:40,speed:2,headline:'Build your itinerary',chapter:'01 / MAKE A PLAN'},
{id:'gallery-final',at:19,len:5,app:true,source:'demo/gallery-private-safe.mp4',speed:.6,headline:'Give your trip a little personality',chapter:'02 / ADD YOUR PHOTOS'},
{id:'preferences-fast',at:24,len:2,app:true,recording:createSource,start:82,speed:2,headline:'Find the right travel buddies',chapter:'02 / SET YOUR PREFERENCES'},
{id:'publish',at:26,len:2,app:true,recording:createSource,start:91,speed:5.4,headline:'Post your Travel Buddy request',chapter:'02 / READY TO GO'},
{id:'details',at:28,len:3,app:true,still:'demo/details.png',headline:'A trip worth sharing',chapter:'03 / SHARE A POST'},
{id:'share-final',at:31,len:4,app:true,still:'demo/share.png',headline:'Bring your friends into the plan',chapter:'03 / SHARE A POST'},
{id:'pending',at:35,len:4,app:true,still:'demo/manage-pending.png',headline:'Review who wants to join',chapter:'04 / BUILD YOUR GROUP'},
{id:'joined',at:39,len:3,app:true,still:'demo/manage-joined.png',headline:'Your travel group, together',chapter:'04 / BUILD YOUR GROUP'},
{id:'chat',at:42,len:5,app:true,recording:chatSource,start:100,patch:'demo/chat-typing-patch.png',headline:'One trip. One group chat.',chapter:'05 / PLAN TOGETHER'},
{id:'planning',at:47,len:3,source:'broll-planning.mp4',start:1},
{id:'cta',at:50,len:7,source:'edit/performance-cta.mp4'},
{id:'close',at:57,len:3,source:'broll-walk.mp4',start:1,brandEnding:true}
]:[
{id:'opener',at:0,len:3,opener:true},
{id:'hook',at:3,len:7,source:'edit/performance-hook.mp4'},
{id:'alone',at:10,len:2,source:'broll-alone.mp4',start:1,label:'Nila · Sri Lanka'},
{id:'map',at:12,len:5,app:true,headline:'Find your people nearby',chapter:'01 / OPEN MEET BUDDY'},
{id:'profile',at:17,len:4,app:true,headline:'A shared interest. A simple hello.',chapter:'02 / MEET ERIN'},
{id:'request',at:21,len:6,app:true,headline:'Say hello with a quick note',chapter:'03 / SEND A MEET REQUEST'},
{id:'sent',at:27,len:2,app:true,recording:'General-assesets/Meet buddy.mov',start:28.7,sourceDuration:1.5,nativePatch:true,headline:'Your meet request is sent',chapter:'04 / AWAITING A RESPONSE'},
{id:'pending',at:29,len:5,app:true,headline:'Give them time to reply',chapter:'04 / AWAITING A RESPONSE'},
{id:'meeting',at:34,len:3,source:'broll-meeting.mp4',start:1,label:'A little later · A plan to meet'},
{id:'coffee',at:37,len:1.5,source:'broll-alone.mp4',start:1,detail:true},
{id:'walk',at:38.5,len:2,source:'../travel-buddy-story-en/broll-walk.mp4',start:.5},
{id:'ocean',at:40.5,len:2.5,source:'edit/coastal-photo-cutaway.mp4',start:0},
{id:'together',at:43,len:4,source:'../travel-buddy-story-en/broll-planning.mp4',start:1},
{id:'walk-return',at:47,len:3,source:'../travel-buddy-story-en/broll-walk.mp4',start:2},
{id:'cta',at:50,len:7,source:'edit/performance-cta.mp4'},
{id:'close',at:57,len:3,source:'../travel-buddy-story-en/broll-walk.mp4',start:1,brandEnding:true}
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
 const base=s.app?'<rect width="720" height="1280" fill="#080F1C"/><path d="M0 0H720V6H0Z" fill="#6BFFD8"/><path d="M0 1245H720" stroke="#6BFFD8" stroke-opacity=".3"/>':'<defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#071120" stop-opacity="0"/><stop offset="1" stop-color="#071120" stop-opacity=".68"/></linearGradient></defs><rect y="880" width="720" height="400" fill="url(#v)"/>';
 items.push({input:svg(base),left:0,top:0});
 if(s.brandEnding){
  items.push({input:svg('<rect width="720" height="1280" fill="#050B18" fill-opacity=".82"/><path d="M80 432H640M80 848H640" stroke="#6BFFD8" stroke-opacity=".32"/>'),left:0,top:0});
  items.push({input:await sharp(`${root}General-assesets/app_logo_white.png`).resize(170,170).png().toBuffer(),left:275,top:215});
  await add(items,spec.feature,62,40,470,640,'#FFFFFF','center');
  await add(items,campaign==='travel'?'Make the plan.\nFind your people.':'Your next story\nstarts with hello.',42,40,570,640,'#6BFFD8','center');
  for(const[i,n]of['AppleStoreLogo.png','PlayStoreLogo.png'].entries())items.push({input:await storeBadge(n,224,76),left:124+i*248,top:755});
  await add(items,'Available on iOS & Android',21,40,875,640,'#D3DEE9','center','Inter');
 }else if(s.app){
  await add(items,s.chapter,17,40,43,530,'#6BFFD8','left','Inter');
  await add(items,s.headline,31,40,83,530,'#FFFFFF');
  items.push({input:svg('<rect x="129" y="274" width="462" height="934" rx="20" fill="#253D4C"/>'),left:0,top:0});
 }else if(s.label)await add(items,s.label,26,42,905,630,'#FFFFFF','left','Inter');
 // Supplied logo stays in the upper right in every scene, including the close.
 items.push({input:await sharp(`${root}General-assesets/app_logo_white.png`).resize(78,78).png().toBuffer(),left:603,top:43});
 const p=`${edit}/${s.id}-overlay.png`;await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(items).png().toFile(p);return p;
}
async function opener(){
 const folder=`${edit}/opener`;mkdirSync(folder,{recursive:true});
 const logo=await sharp(`${root}General-assesets/app_logo_white.png`).resize(78,78).png().toBuffer();
 for(let f=0;f<90;f++){
  const t=f/30,phase=t<.7?0:t<1.5?1:2,start=[0,.7,1.5][phase],age=t-start;
  const phrase=spec.opener[phase].replace('MAKE THE PLAN.','MAKE\nTHE PLAN.').replace('ONE NEW FRIEND.','ONE NEW\nFRIEND.');
  const size=phase===1?92:76,glitch=age<.13||f===67||f===68,dx=glitch?9:2;
  const items=[{input:svg('<rect width="720" height="1280" fill="#070B15"/><path d="M-70 400L790 200M-70 980L790 780" stroke="#153544" stroke-width="2"/><rect x="28" y="28" width="664" height="1224" fill="none" stroke="#204554"/>'),left:0,top:0}];
  const particles=Array.from({length:30},(_,i)=>{const x=(i*137+Math.round(t*(25+i%6)))%680+20,y=(i*257+Math.round(t*(12+i%7)))%1170+50;return `<path d="M${x-14} ${y+5}L${x} ${y}" stroke="${i%3?'#58D2D5':'#F843BE'}" stroke-opacity=".35"/>`;}).join('');items.push({input:svg(particles),left:0,top:0});
  await add(items,spec.feature.toUpperCase(),22,52,325,610,'#6BFFD8','left','Inter');
  for(const [color,offset,blur]of [['#ED35AD',-dx,5],['#42F9F1',dx,3],['#FFFFFF',0,0]]){
   let b=await text(phrase,size,620,color,'center','Inter');const m=await sharp(b).metadata();if(blur)b=await sharp(b).blur(blur).png().toBuffer();items.push({input:b,left:Math.round((720-m.width)/2+offset),top:Math.round(490+(1-Math.min(1,age/.18))*20)});
  }
  if(glitch)items.push({input:svg(`<rect x="55" y="${547+f%4*41}" width="610" height="7" fill="#58F9E2" fill-opacity=".5"/><rect x="100" y="${734-f%5*23}" width="520" height="3" fill="#F943B4"/>`),left:0,top:0});
  await add(items,'YOUR PEOPLE. YOUR NEXT CHAPTER.',18,52,980,610,'#9CABB9','left','Inter');
  items.push({input:logo,left:603,top:43});
  await sharp({create:{width:W,height:H,channels:4,background:'#070B15'}}).composite(items).png().toFile(`${folder}/${String(f).padStart(5,'0')}.png`);
 }
 console.log('90 neon/glitch opener frames prepared.');
}
async function app(){
 await prepare();
 if(campaign==='travel')return;
 for(const s of scenes.filter(s=>s.app&&!s.recording)){
  const folder=`${edit}/app/${s.id}`;mkdirSync(folder,{recursive:true});
  for(let i=0;i<Math.round(s.len*12);i++){
   const t=i/12;let screen;
   if(s.id==='map')screen=demo.mapScreen(t,{selected:t>3.9});
   else if(s.id==='profile')screen=demo.profileScreen(false,0,'leila');
   else if(s.id==='request')screen=demo.requestScreen(t<4.8?Math.min(1.5,t*.45):1.6+(t-4.8)*.2);
   else screen=demo.requestsScreen();
   await sharp(Buffer.from(screen)).png().toFile(`${folder}/${String(i).padStart(5,'0')}.png`);
  }
  console.log(`Native-frame app demonstration: ${s.id}`);
 }
}
function cues(){
 const selection=JSON.parse(readFileSync(`${dir}/performance-selection.json`)),out=[];
 for(const s of selection.dialogues){let group=[];const flush=()=>{if(group.length){out.push({start:s.at+group[0].start,end:s.at+group.at(-1).end,text:group.map(w=>w.text).join(' ')});group=[];}};
  for(const w of s.words){if(group.length&&(group.length>=5||[...group,w].map(w=>w.text).join(' ').length>32))flush();group.push(w);if(/[.!?]$/.test(w.text))flush();}flush();
 }return out.map(c=>({...c,text:c.text.replace(/\btips to trip\b/gi,'Tips to Trip').replace(/\bmeet\s*buddy\b/gi,'Meet Buddy').replace(/\btravel\s*buddy\b/gi,'Travel Buddy').replace(/^./,c=>c.toUpperCase())}));
}
const srtTime=t=>`${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${(t%60).toFixed(3).padStart(6,'0').replace('.',',')}`;
async function captions(){
 const cs=cues(),folder=`${edit}/captions`;mkdirSync(folder,{recursive:true});
 const blank=`${folder}/blank.png`;await sharp({create:{width:W,height:150,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toFile(blank);
 const images=[];
 for(let i=0;i<cs.length;i++){
  const c=cs[i],b=await text(c.text,31,600,'#FFFFFF','center','Inter'),m=await sharp(b).metadata(),x=Math.round((W-m.width)/2),y=Math.round((150-m.height)/2),p=`${folder}/cue-${i}.png`;
  const bg=Buffer.from(`<svg width="720" height="150"><rect x="${x-17}" y="${y-10}" width="${m.width+34}" height="${m.height+20}" rx="13" fill="#080F1C" fill-opacity=".88"/></svg>`);
  await sharp({create:{width:W,height:150,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:bg,left:0,top:0},{input:b,left:x,top:y}]).png().toFile(p);images.push(p);
 }
 for(let frame=0;frame<1800;frame++){const t=frame/30,i=cs.findIndex((c,i)=>t>=c.start&&t<Math.min(c.end+.06,cs[i+1]?.start??60)),target=`${folder}/${String(frame).padStart(5,'0')}.png`;if(existsSync(target))unlinkSync(target);linkSync(i>=0?images[i]:blank,target);}
 writeFileSync(`${edit}/caption-timing.json`,JSON.stringify(cs,null,2));
 writeFileSync(`${dir}/exports/${campaign}-buddy-story-en.srt`,cs.map((c,i)=>`${i+1}\n${srtTime(c.start)} --> ${srtTime(Math.min(c.end+.06,cs[i+1]?.start??60))}\n${c.text}\n`).join('\n'));return folder;
}
async function audio(){
 const inputs=spec.dialogues.flatMap(s=>['-i',`${dir}/edit/audio-${s.id}.wav`]);
 const filters=spec.dialogues.map((s,i)=>`[${i}:a]asetpts=PTS-STARTPTS,adelay=${Math.round(s.at*1000)}:all=1[a${i}]`);
 ff([...inputs,'-filter_complex',filters.join(';')+';'+spec.dialogues.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${spec.dialogues.length}:normalize=0,apad,atrim=duration=60,loudnorm=I=-16:TP=-1.5:LRA=7[a]`,'-map','[a]','-ar','48000','-ac','2',`${edit}/narration.wav`]);
 ff(['-i',`${edit}/narration.wav`,'-i',`${dir}/elevenlabs/music.mp3`,'-i',`${root}artifacts/travel-buddy-story-en/elevenlabs/impact.mp3`,'-filter_complex',"[0:a]asplit=2[voice][duck];[1:a]atrim=duration=60,asetpts=PTS-STARTPTS,loudnorm=I=-25:TP=-4:LRA=6,afade=t=in:d=0.25,afade=t=out:st=58.5:d=1.5[m];[m][duck]sidechaincompress=threshold=0.025:ratio=5:attack=10:release=350[bed];[2:a]asetpts=PTS-STARTPTS,loudnorm=I=-18:TP=-3:LRA=7,afade=t=out:st=2.7:d=1.7[hit];[voice][bed][hit]amix=inputs=3:normalize=0,loudnorm=I=-16:TP=-2.5:LRA=7,apad,atrim=duration=60[a]",'-map','[a]','-ar','48000','-ac','2',`${edit}/final-mix.wav`]);
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
  let input,filter;
  if(s.opener){input=['-framerate','30','-i',`${edit}/opener/%05d.png`];filter='[0:v]format=yuv420p[v]';}
  else {
   const graphics=await overlay(s);
   if(s.app){
    const media=s.recording?['-ss',String(s.start),'-i',root+s.recording]:s.still?['-loop','1','-i',`${dir}/${s.still}`]:s.source?['-i',`${dir}/${s.source}`]:['-framerate','12','-i',`${edit}/app/${s.id}/%05d.png`];
    input=[...media,'-loop','1','-i',graphics];
    const trim=s.sourceDuration?`trim=duration=${s.sourceDuration},`:'';
    let pre=`[0:v]${trim}setpts=(PTS-STARTPTS)/${s.speed??1},fps=30,setsar=1`;
    if(s.patch||s.nativePatch){
     let patch=s.patch?`${dir}/${s.patch}`:`${edit}/sent-native-patch.png`;
     if(s.nativePatch)await sharp(Buffer.from(demo.profileRecordingPatch())).png().toFile(patch);
     input.push('-loop','1','-i',patch);
     const size=s.nativePatch?'604:1236':'602:1234';
     pre+=`,scale=${size}[native];[native][2:v]overlay=0:0:shortest=1`;
    }
    filter=`${pre},tpad=stop_mode=clone:stop_duration=3,scale=450:922:flags=lanczos[app];[1:v]fps=30[bg];[bg][app]overlay=135:280:shortest=1,format=yuv420p[v]`;
   }else{
    input=['-ss',String(s.start??0),'-i',`${dir}/${s.source}`,'-loop','1','-i',graphics];
    filter=`[0:v]setpts=PTS-STARTPTS,fps=30,${s.detail?'crop=400:710:0:420,':''}scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`;
   }
  }
  filter=filter.replace(/\[v\]$/,`,tpad=stop_mode=clone:stop_duration=1,trim=duration=${s.len},setpts=PTS-STARTPTS[v]`);
  await ffAsync([...input,'-filter_complex',filter,'-map','[v]','-an','-t',String(s.len),'-frames:v',String(Math.round(s.len*30)),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-threads','4',out]);console.log(`Picture: ${s.id}`);
 }
 for(const[i,path]of paths.entries()){
  const n=Number(run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','csv=p=0',path]).stdout.trim());if(n!==Math.round(scenes[i].len*30))throw Error(`Scene frame count mismatch ${scenes[i].id}: ${n}`);
 }
 writeFileSync(`${edit}/concat.txt`,paths.map(p=>`file '${p}'`).join('\n'));
 ff(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-c','copy',`${edit}/picture.mp4`]);
 const captionDir=await captions(),out=`${dir}/exports/tips-to-trip-${campaign}-buddy-story-en-60s.mp4`;
 const appStart=campaign==='travel'?10:12,appEnd=campaign==='travel'?47:34;
 await ffAsync(['-i',`${edit}/picture.mp4`,'-i',`${edit}/final-mix.wav`,'-framerate','30','-i',`${captionDir}/%05d.png`,'-filter_complex',`[0:v][2:v]overlay=0:y='if(gte(t,${appStart})*lt(t,${appEnd}),130,1010)':shortest=1[v]`,'-map','[v]','-map','1:a','-c:v','libx264','-crf','17','-preset','fast','-r','30','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-t','60','-movflags','+faststart','-metadata',`title=${spec.title}`,'-threads','4',out]);
 console.log(`Exported: ${out}`);
}
if(stage==='app')await app();
else if(stage==='graphics'){await opener();for(const s of scenes.filter(s=>!s.opener))await overlay(s);}
else if(stage==='audio')await audio();
else if(stage==='render')await render();
else throw Error('Choose app, graphics, audio or render.');
