import {readFileSync,writeFileSync,mkdirSync,existsSync,linkSync,unlinkSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import sharp from 'sharp';
const root=new URL('../',import.meta.url).pathname,spec=JSON.parse(readFileSync(root+'scripts/carousel-buddy-story-english.json')),dir=root+spec.directory,edit=dir+'/edit',qa=dir+'/qa';
for(const x of [edit,qa,dir+'/exports',dir+'/demo',edit+'/font-cache'])mkdirSync(x,{recursive:true});
process.env.FONTCONFIG_FILE=edit+'/fonts.conf';writeFileSync(process.env.FONTCONFIG_FILE,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${root}brandKIT/04-Fonts</dir><cachedir>${edit}/font-cache</cachedir></fontconfig>`);
const W=720,H=1280,FPS=30,stage=process.argv[2]??'render',only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const prior=root+'artifacts/travel-buddy-story-en',create=root+spec.sources[0],chat=root+spec.sources[1];
const scenes=[
{id:'hook',at:0,len:6,source:dir+'/edit/performance-hook.mp4',headline:'MAYBE NEXT YEAR?',strap:'SOUND FAMILIAR?',type:'presenter'},
{id:'alone',at:6,len:5,source:dir+'/broll-alone.mp4',headline:'THE TRIP WAS STILL ON.',strap:'A DIFFERENT PLAN',type:'story'},
{id:'create',at:11,len:5,app:true,source:create,start:4,speed:2,headline:'Create a Travel Buddy post',chapter:'01 / MAKE THE PLAN',example:'Recorded creation example · France → Spain'},
{id:'route',at:16,len:3,app:true,source:create,start:17,speed:2.5,headline:'Your route. Your dates.',chapter:'01 / MAKE THE PLAN',example:'Recorded creation example · France → Spain'},
{id:'itinerary',at:19,len:3,app:true,source:create,start:42,speed:2,headline:'Plan the places you want to go',chapter:'01 / MAKE THE PLAN',example:'Recorded creation example · France → Spain'},
{id:'preferences',at:22,len:1.5,app:true,source:create,start:82,speed:3,headline:'Choose your travel preferences',chapter:'01 / MAKE THE PLAN',example:'Recorded creation example · France → Spain'},
{id:'publish',at:23.5,len:1.5,app:true,source:create,start:91,speed:6,headline:'Post your Travel Buddy request',chapter:'01 / MAKE THE PLAN',example:'Recorded creation example · France → Spain'},
{id:'details',at:25,len:3,app:true,source:dir+'/demo/details.png',still:true,headline:'A posted trip. Ready to share.',chapter:'02 / SHARE THE PLAN',example:'Separate recorded example · Sri Lanka',tap:true},
{id:'share',at:28,len:6,app:true,source:dir+'/demo/share.png',still:true,headline:'Choose where to share it',chapter:'02 / SHARE THE PLAN',example:'Native sharing options · recorded example'},
{id:'manage',at:34,len:3,app:true,source:dir+'/demo/manage-joined.png',still:true,headline:'Your group, together',chapter:'03 / PLAN TOGETHER',example:'Recorded group management example'},
{id:'chat',at:37,len:2,app:true,source:chat,start:100,speed:2.45,patch:dir+'/demo/chat-typing-patch.png',headline:'One trip. One group chat.',chapter:'03 / PLAN TOGETHER',example:'Recorded trip chat · fictional demo identities'},
{id:'conversation',at:39,len:5,type:'conversation',headline:'Keep the details together',chapter:'03 / PLAN TOGETHER',example:'Recorded conversation · fictional demo identities'},
{id:'planning',at:44,len:5,source:dir+'/broll-planning.mp4',headline:'FROM A TRIP IDEA…',strap:'PEOPLE WHO WANT TO GO',type:'story'},
{id:'walk',at:49,len:4,source:dir+'/broll-walk.mp4',headline:'…TO A PLAN TOGETHER.',strap:'YOUR NEXT CHAPTER',type:'story'},
{id:'send',at:53,len:4,type:'carousel',headline:'SEND THIS TO YOUR',strap:'“MAYBE NEXT YEAR” FRIEND.'},
{id:'close',at:57,len:3,type:'close'}
];
writeFileSync(edit+'/scene-plan.json',JSON.stringify(scenes,null,2));
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:14*1024*1024});if(r.status!==0)throw Error(cmd+' failed: '+r.stderr.slice(-2200));return r;}
const ff=a=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...a]);
const asyncFF=a=>new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...a]);let e='';p.stderr.on('data',b=>e=(e+b).slice(-2500));p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(e)));});
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const svg=s=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">${s}</svg>`);
async function txt(s,size,width,color='#FFFFFF',align='left'){return sharp({text:{text:`<span foreground="${color}">${esc(s)}</span>`,font:`Inter Bold ${size}`,fontfile:root+'brandKIT/04-Fonts/Inter-Variable.ttf',width,align,rgba:true,spacing:5}}).png().toBuffer();}
async function add(ops,s,size,x,y,width,color='#FFFFFF',align='left'){const b=await txt(s,size,width,color,align),m=await sharp(b).metadata();ops.push({input:b,left:Math.round(x+(align==='center'?(width-m.width)/2:0)),top:Math.round(y)});}
async function mask(w,h,r){return Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="white"/></svg>`);}
async function card(p,w,h){return sharp(p).resize(w,h,{fit:'cover'}).ensureAlpha().composite([{input:await mask(w,h,18),blend:'dest-in'}]).png().toBuffer();}
async function store(n){const inset=n==='PlayStoreLogo.png'?4:1,{data,info}=await sharp(root+'General-assesets/'+n).trim({background:'#FFFFFF',threshold:40}).toBuffer({resolveWithObject:true}),w=info.width-2*inset,h=info.height-2*inset;const b=await sharp(data).extract({left:inset,top:inset,width:w,height:h}).ensureAlpha().composite([{input:await mask(w,h,13),blend:'dest-in'}]).png().toBuffer();return sharp(b).resize(230,79,{fit:'contain',background:'#00000000'}).png().toBuffer();}
async function graphics(){
 const logo=await sharp(root+'General-assesets/app_logo_white.png').resize(76,76).png().toBuffer();
 const bg=svg('<defs><radialGradient id="b"><stop stop-color="#163A40"/><stop offset="1" stop-color="#071216"/></radialGradient></defs><rect width="720" height="1280" fill="url(#b)"/><ellipse cx="360" cy="1060" rx="290" ry="88" fill="#051014"/><path d="M-60 330Q360 180 780 330M-60 1100Q360 1280 780 1100" fill="none" stroke="#77EDD1" stroke-opacity=".12"/>');
 await sharp(bg).png().toFile(edit+'/background.png');
 for(const [i,p]of ['details.png','share.png','chat-typing.png'].entries()){
  const b=await card(dir+'/demo/'+p,220,452);
  await sharp(b).affine(i===0?[[.82,.12],[0,1]]:[[.82,-.12],[0,1]],{background:'#00000000'}).modulate({brightness:.32}).blur(1.2).png().toFile(edit+`/side-${i}.png`);
  await sharp(dir+'/demo/'+p).resize(454,930).ensureAlpha().composite([{input:await mask(454,930,18),blend:'dest-in'}]).png().toFile(edit+`/carousel-${i}.png`);
 }
 await sharp(await mask(454,930,18)).png().toFile(edit+'/card-mask.png');
 await sharp(await card(dir+'/demo/chat-conversation.png',500,540)).png().toFile(edit+'/conversation-card.png');
 // Transparent margins prevent perspective sampling from extending edge pixels.
 for(const [i,p]of ['details.png','share.png','chat-sent.png'].entries()){
  const w=i===1?340:220,h=i===1?697:452;
  const screen=await card(dir+'/demo/'+p,w,h);
  const shade=await sharp(Buffer.from(`<svg width="${w+80}" height="${h+80}"><rect x="40" y="48" width="${w}" height="${h}" rx="18" fill="#000" fill-opacity=".65"/></svg>`)).blur(12).png().toBuffer();
  await sharp(shade).composite([{input:screen,left:40,top:40}]).png().toFile(edit+`/carousel-padded-${i}.png`);
 }
 await sharp(svg('<circle cx="562" cy="330" r="23" fill="#83F0D5" fill-opacity=".22" stroke="#83F0D5" stroke-width="4"/><circle cx="562" cy="330" r="31" fill="none" stroke="#83F0D5" stroke-opacity=".4" stroke-width="2"/>')).png().toFile(edit+'/tap-overlay.png');
 for(const s of scenes){const ops=[];
  if(s.app||s.type==='conversation'){
   await add(ops,s.chapter,17,34,40,550,'#83F0D5');await add(ops,s.headline,34,34,79,548);await add(ops,s.example,15,34,132,650,'#AAC2C6');
   ops.push({input:svg(s.type==='conversation'?'<rect x="107" y="358" width="506" height="546" rx="22" fill="none" stroke="#83F0D5" stroke-opacity=".65" stroke-width="2"/>':'<rect x="130" y="259" width="460" height="936" rx="22" fill="none" stroke="#83F0D5" stroke-opacity=".65" stroke-width="2"/>'),left:0,top:0});
   if(s.type==='conversation')await add(ops,'One place for your trip plans.',25,40,960,640,'#83F0D5','center');
   for(let i=0;i<3;i++)ops.push({input:Buffer.from(`<svg width="84" height="5"><rect width="84" height="5" rx="2" fill="${i===Number(s.chapter[1])-1?'#83F0D5':'#29434A'}"/></svg>`),left:222+i*96,top:1210});
  }else if(s.type==='close'){
   ops.push({input:svg('<rect width="720" height="1280" fill="#071216"/><circle cx="360" cy="400" r="260" fill="#133C3E" fill-opacity=".45"/><path d="M80 530H640M80 920H640" stroke="#83F0D5" stroke-opacity=".25"/>'),left:0,top:0});
   ops.push({input:await sharp(root+'General-assesets/app_logo_white.png').resize(172,172).png().toBuffer(),left:274,top:205});
   await add(ops,'Travel Buddy',61,40,428,640,'#FFFFFF','center');await add(ops,'MAKE A DIFFERENT PLAN.',30,40,562,640,'#83F0D5','center');
   for(const[i,n]of ['AppleStoreLogo.png','PlayStoreLogo.png'].entries())ops.push({input:await store(n),left:119+i*252,top:678});
   await add(ops,'Available on iOS & Android',20,40,796,640,'#C5D8DA','center');
  }else if(s.type==='carousel'){
   await add(ops,s.headline,34,40,168,640,'#FFFFFF','center');await add(ops,s.strap,36,45,218,630,'#83F0D5','center');
  }else{
   ops.push({input:svg('<defs><linearGradient id="top" x2="0" y2="1"><stop stop-color="#041012" stop-opacity=".75"/><stop offset="1" stop-color="#041012" stop-opacity="0"/></linearGradient><linearGradient id="bot" x2="0" y2="1"><stop stop-color="#041012" stop-opacity="0"/><stop offset="1" stop-color="#041012" stop-opacity=".9"/></linearGradient></defs><rect width="720" height="390" fill="url(#top)"/><rect y="900" width="720" height="380" fill="url(#bot)"/>'),left:0,top:0});
   await add(ops,s.strap,16,35,54,535,'#83F0D5');await add(ops,s.headline,s.id==='hook'?51:38,35,110,565);
   if(s.id==='hook')await add(ops,'The travel story of: Alex',15,35,1204,640,'#DBE9E9');
  }
  ops.push({input:logo,left:610,top:35});
  await sharp({create:{width:720,height:1280,channels:4,background:'#00000000'}}).composite(ops).png().toFile(edit+'/'+s.id+'-overlay.png');
 }
 console.log('Carousel cards, chapter titles, brand overlays and closing card ready.');
}
async function captions(){
 const selection=JSON.parse(readFileSync(dir+'/performance-selection.json')),cues=[];
 for(const s of selection.dialogues){let group=[];const flush=()=>{if(group.length){cues.push({start:s.at+group[0].start,end:s.at+group.at(-1).end,text:group.map(w=>w.text).join(' '),app:s.at>=11&&s.at<44});group=[];}};for(const w of s.words){if(group.length&&(group.length>=5||w.start-group.at(-1).end>.35||[...group,w].map(w=>w.text).join(' ').length>33))flush();group.push(w);if(/[.!?]$/.test(w.text))flush();}flush();}
 const assTime=t=>`${Math.floor(t/3600)}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`;
 const srtTime=t=>`${String(Math.floor(t/3600)).padStart(2,'0')}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${(t%60).toFixed(3).padStart(6,'0').replace('.',',')}`;
 const fix=s=>s.replace(/tips to trip/ig,'Tips to Trip').replace(/travel buddy/ig,'Travel Buddy').replace(/\s+([.,!?])/g,'$1');
 for(let i=0;i<cues.length;i++){cues[i].text=fix(cues[i].text);cues[i].end=Math.min(cues[i].end+.08,cues[i+1]?.start??60);}
 const header='[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 1280\nWrapStyle: 2\nScaledBorderAndShadow: yes\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Inter,30,&H00FFFFFF,&H00FFFFFF,&H00110E08,&H00110E08,-1,0,0,0,100,100,0,0,3,10,0,2,36,36,177,1\nStyle: App,Inter,28,&H00FFFFFF,&H00FFFFFF,&H00110E08,&H00110E08,-1,0,0,0,100,100,0,0,3,9,0,8,35,35,172,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
 writeFileSync(edit+'/captions.ass',header+cues.map(c=>`Dialogue: 0,${assTime(c.start)},${assTime(c.end)},${c.app?'App':'Default'},,0,0,0,,${c.text.replaceAll('{','').replaceAll('}','')}\n`).join(''));
 writeFileSync(dir+'/exports/travel-buddy-carousel-en.srt',cues.map((c,i)=>`${i+1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n'));writeFileSync(edit+'/caption-timing.json',JSON.stringify(cues,null,2));
 const folder=edit+'/captions';mkdirSync(folder,{recursive:true});const blank=folder+'/blank.png';await sharp({create:{width:720,height:112,channels:4,background:'#00000000'}}).png().toFile(blank);const images=[];
 for(const [i,c]of cues.entries()){const b=await txt(c.text,c.app?28:30,620,'#FFFFFF','center'),m=await sharp(b).metadata(),x=Math.round((720-m.width)/2),y=Math.round((112-m.height)/2),p=folder+'/cue-'+i+'.png',bg=Buffer.from(`<svg width="720" height="112"><rect x="${x-13}" y="${y-10}" width="${m.width+26}" height="${m.height+20}" rx="11" fill="#081215" fill-opacity=".92"/></svg>`);await sharp({create:{width:720,height:112,channels:4,background:'#00000000'}}).composite([{input:bg,left:0,top:0},{input:b,left:x,top:y}]).png().toFile(p);images.push(p);}
 for(let f=0;f<1800;f++){const t=f/30,i=cues.findIndex(c=>t>=c.start&&t<c.end),target=folder+'/'+String(f).padStart(5,'0')+'.png';if(existsSync(target))unlinkSync(target);linkSync(i>=0?images[i]:blank,target);}return folder;
}
function audio(){
 const timeline=Buffer.alloc(60*48000*2);
 for(const row of spec.dialogues){const pcm=edit+'/'+row.id+'-timeline-source.pcm';ff(['-i',edit+'/audio-'+row.id+'.wav','-ar','48000','-ac','1','-f','s16le',pcm]);readFileSync(pcm).copy(timeline,Math.round(row.at*48000)*2);}
 writeFileSync(edit+'/narration-timeline.pcm',timeline);
 ff(['-f','s16le','-ar','48000','-ac','1','-i',edit+'/narration-timeline.pcm','-af','asetpts=N/SR/TB,loudnorm=I=-16:TP=-1.5:LRA=7','-t','60','-ar','48000','-ac','2',edit+'/narration.wav']);
 ff(['-i',edit+'/narration.wav','-i',dir+'/elevenlabs/music.mp3','-i',dir+'/elevenlabs/impact.mp3','-filter_complex','[0:a]asplit=3[voice][ducka][duckb];[1:a]asetpts=PTS-STARTPTS,atrim=duration=60,loudnorm=I=-25:TP=-4:LRA=6,afade=t=in:d=0.35,afade=t=out:st=58:d=2[m];[m][ducka]sidechaincompress=threshold=0.025:ratio=5:attack=12:release=350[bed];[2:a]asetpts=PTS-STARTPTS,loudnorm=I=-22:TP=-5:LRA=7,afade=t=in:d=0.15,afade=t=out:st=13:d=2[sfx];[sfx][duckb]sidechaincompress=threshold=0.025:ratio=6:attack=8:release=250[fx];[voice][bed][fx]amix=inputs=3:normalize=0:duration=longest,asetpts=N/SR/TB,loudnorm=I=-16:TP=-2.5:LRA=7,atrim=duration=60[a]','-map','[a]','-t','60','-ar','48000','-ac','2',edit+'/mix-first.wav']);
 const log=run('ffmpeg',['-hide_banner','-i',edit+'/mix-first.wav','-af','loudnorm=I=-16:TP=-2.5:LRA=7:print_format=json','-f','null','-']).stderr,b=log.lastIndexOf('{'),m=JSON.parse(log.slice(b,log.indexOf('}',b)+1));
 ff(['-i',edit+'/mix-first.wav','-af',`loudnorm=I=-16:TP=-2.5:LRA=7:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,'-ar','48000','-ac','2',edit+'/final-mix.wav']);writeFileSync(qa+'/mix-normalisation.json',JSON.stringify({targetLUFS:-16,PCMTruePeakCeiling:-2.5,measurement:m},null,2));console.log('Narration, ducked instrumental and 15-second suspense/riser mix ready.');
}
async function renderScene(s){
 const out=edit+'/scene-'+s.id+'.mp4';if(existsSync(out)&&!process.argv.includes('--force'))return out;
 const args=[],frames=Math.round(s.len*30);let filter;
 if(s.app){
  args.push('-framerate','30','-loop','1','-i',edit+'/background.png');
  if(s.still)args.push('-framerate','30','-loop','1','-i',s.source);else args.push('-ss',String(s.start??0),'-i',s.source);
  args.push('-framerate','30','-loop','1','-i',edit+'/card-mask.png','-framerate','30','-loop','1','-i',edit+'/side-0.png','-framerate','30','-loop','1','-i',edit+'/side-2.png','-framerate','30','-loop','1','-i',edit+'/'+s.id+'-overlay.png');
  let screen=`[1:v]setpts=(PTS-STARTPTS)/${s.speed??1},fps=30,scale=454:930,setsar=1,format=rgba[screen]`;
  if(s.patch){args.push('-framerate','30','-loop','1','-i',s.patch);screen=`[1:v]setpts=(PTS-STARTPTS)/${s.speed??1},format=rgba[raw];[raw][6:v]overlay=0:0,fps=30,scale=454:930,setsar=1,format=rgba[screen]`;}
  if(s.tap)args.push('-framerate','30','-loop','1','-i',edit+'/tap-overlay.png');
  const e=`(exp(-on/4)+if(gt(on,${frames-9}),(on-${frames-9})/12,0))`;
  filter=`${screen};[screen][2:v]alphamerge,perspective=x0='65*${e}':y0='38*${e}':x1='W-12*${e}':y1='4*${e}':x2='65*${e}':y2='H-38*${e}':x3='W-12*${e}':y3='H-4*${e}':sense=destination:eval=frame[card];[0:v][3:v]overlay=x='-110+7*sin(t)':y='400+8*sin(t)'[b1];[b1][4:v]overlay=x='600+5*sin(t)':y='360-8*sin(t)'[b2];[b2][card]overlay=x='133+65*exp(-8*t)':y=262:shortest=1[p];${s.tap?"[p][6:v]overlay=0:0:enable='between(t,1.5,2.6)'[tapped];[tapped]":'[p]'}[5:v]overlay=0:0[v]`;
 }else if(s.type==='conversation'){
  args.push('-framerate','30','-loop','1','-i',edit+'/background.png','-framerate','30','-loop','1','-i',edit+'/conversation-card.png','-framerate','30','-loop','1','-i',edit+'/'+s.id+'-overlay.png');
  filter="[1:v]scale=500:540,format=rgba[chat];[0:v][chat]overlay=x=110:y=361[p];[p][2:v]overlay=0:0[v]";
 }else if(s.type==='carousel'){
  args.push('-framerate','30','-loop','1','-i',edit+'/background.png');for(let i=0;i<3;i++)args.push('-framerate','30','-loop','1','-i',edit+`/carousel-padded-${i}.png`);args.push('-framerate','30','-loop','1','-i',edit+'/'+s.id+'-overlay.png');
  filter=`[1:v]format=rgba,perspective=x0='18+2*sin(on/40)':y0=20:x1=W:y1=0:x2='18+2*sin(on/40)':y2=H-20:x3=W:y3=H:sense=destination:eval=frame,colorchannelmixer=rr=.78:gg=.78:bb=.78[a];[3:v]format=rgba,perspective=x0=0:y0=0:x1='W-18-2*sin(on/40)':y1=20:x2=0:y2=H:x3='W-18-2*sin(on/40)':y3=H-20:sense=destination:eval=frame,colorchannelmixer=rr=.78:gg=.78:bb=.78[b];[2:v]format=rgba,perspective=x0='3+2*sin(on/45)':y0=3:x1=W-3:y1=0:x2='3+2*sin(on/45)':y2=H-3:x3=W-3:y3=H:sense=destination:eval=frame[c];[0:v][a]overlay=x='-10-3*sin(t*.7)':y='404+3*sin(t*.7)'[q];[q][b]overlay=x='430+3*sin(t*.7)':y='404-3*sin(t*.7)'[r];[r][c]overlay=x='150+2*sin(t*.7)':y='325+3*sin(t*.7)'[p];[p][4:v]overlay=0:0[v]`;
 }else if(s.type==='close'){
  args.push('-framerate','30','-loop','1','-i',edit+'/close-overlay.png');filter='[0:v]format=yuv420p[v]';
 }else{
  args.push('-ss',String(s.start??0),'-i',s.source,'-framerate','30','-loop','1','-i',edit+'/'+s.id+'-overlay.png');
  filter=`[0:v]setpts=PTS-STARTPTS,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30[base];[base][1:v]overlay=0:0[v]`;
 }
 filter=filter.replace(/\[v\]$/,`,tpad=stop_mode=clone:stop_duration=1,trim=duration=${s.len},setpts=PTS-STARTPTS,format=yuv420p[v]`);
 await asyncFF([...args,'-filter_complex',filter,'-map','[v]','-an','-t',String(s.len),'-frames:v',String(frames),'-r','30','-c:v','libx264','-crf','17','-preset','fast','-threads','4',out]);console.log('Picture: '+s.id);return out;
}
async function render(){
 if(!only){const review=JSON.parse(readFileSync(qa+'/final-voice-review.json'));if(!review.approved)throw Error('Final voice timing review required.');}
 const paths=[];for(const s of scenes){if(only&&!only.split(',').includes(s.id))continue;paths.push(await renderScene(s));}
 if(only)return;
 for(const [i,p]of paths.entries()){const n=Number(run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames','-of','csv=p=0',p]).stdout);if(n!==Math.round(scenes[i].len*30))throw Error('Scene frame count mismatch '+scenes[i].id);}
 writeFileSync(edit+'/concat.txt',paths.map(p=>`file '${p}'`).join('\n'));ff(['-f','concat','-safe','0','-i',edit+'/concat.txt','-c','copy',edit+'/picture.mp4']);const captionDir=await captions();
 const out=dir+'/exports/'+(process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'tips-to-trip-travel-buddy-carousel-en-60s.mp4');
 const originalAudio=process.argv.includes('--preserve-audio')?dir+'/exports/tips-to-trip-travel-buddy-carousel-en-60s.mp4':null;
 await asyncFF(['-i',edit+'/picture.mp4','-i',originalAudio??edit+'/final-mix.wav','-framerate','30','-i',captionDir+'/%05d.png','-filter_complex',"[0:v][2:v]overlay=0:y='if(gte(t,11)*lt(t,44),158,if(gte(t,53)*lt(t,57),1080,1018))':shortest=1[v]",'-map','[v]','-map','1:a','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p','-r','30',...(originalAudio?['-c:a','copy']:['-c:a','aac','-b:a','192k','-ar','48000']),'-t','60','-movflags','+faststart','-metadata','title='+spec.title,'-threads','4',out]);console.log('Exported: '+out);
}
if(stage==='graphics')await graphics();else if(stage==='audio')audio();else if(stage==='captions')await captions();else if(stage==='render')await render();else throw Error('Choose graphics, audio, captions or render.');
