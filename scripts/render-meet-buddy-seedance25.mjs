import {readFileSync,writeFileSync,mkdirSync,existsSync,linkSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(readFileSync(`${root}scripts/meet-buddy-seedance25.json`));
const dir=`${root}${spec.directory}`,edit=`${dir}/edit`;
for(const p of [edit,`${edit}/font-cache`,`${dir}/exports`])mkdirSync(p,{recursive:true});
const fontConfig=`${edit}/fonts.conf`;
writeFileSync(fontConfig,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${root}brandKIT/04-Fonts</dir><cachedir>${edit}/font-cache</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE=fontConfig;
const sharp=(await import('sharp')).default;
const only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
const stage=process.argv[2]??'all';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:12*1024*1024});if(r.status!==0)throw Error(`${cmd} failed: ${r.stderr.slice(-2000)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const ffAsync=async args=>{const{spawn}=await import('node:child_process');await new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:['ignore','ignore','pipe']});let errors='';p.stderr.on('data',d=>{errors=(errors+d).slice(-4000);});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(`FFmpeg failed: ${errors}`)));});};
const rect=(x,y,w,h,fill,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${r}"/>`;
const svg=(w,h,body)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const scenes=[
 {id:'hook',at:0,len:4,type:'person',source:'edit/speaking-hook-aligned.mov',start:0,headline:'Solo trip.\nWho’s taking\nthe photos?',side:'Solo trip.\nWho’s taking\nthe photos?'},
 {id:'reveal',at:4,len:4,type:'app',start:.2,headline:'Find travellers\nnearby.',label:'Meet Buddy',step:1},
 {id:'map',at:8,len:2.5,type:'app',start:1.8,headline:'Explore\nthe map.',label:'Meet Buddy',step:1},
 {id:'profile',at:10.5,len:2,type:'app',start:4.9,headline:'See who’s\nnearby.',label:'Meet Buddy',step:1},
 {id:'request',at:12.5,len:1.5,type:'app',start:8.2,headline:'Like\nthe vibe?',label:'Say hello',step:2},
 {id:'note',at:14,len:1.5,type:'app',start:12.4,speed:2,headline:'Add a\nquick hello.',label:'Say hello',step:2},
 {id:'send',at:15.5,len:2,type:'app',start:17.5,headline:'Send a\nmeet request.',label:'Make a plan',step:3},
 {id:'sent',at:17.5,len:1.5,type:'app',start:28.3,headline:'Request\nsent.',label:'Meet Buddy',step:3},
 {id:'pending',at:19,len:2.5,type:'app',start:32.8,headline:'Wait for\na reply.',label:'Meet Buddy',step:3},
 {id:'coffee',at:21.5,len:4,type:'person',source:'broll-coffee.mp4',start:0,headline:'A coffee.\nA new plan.',side:'A coffee.\nA city walk.\nA new plan.'},
 {id:'walk',at:25.5,len:4,type:'person',source:'broll-walk.mp4',start:0,headline:'Make room for\ngood company.',side:'Good tips.\nGreat company.'},
 {id:'close',at:29.5,len:5.5,type:'close',headline:'Meet Buddy'}
];
writeFileSync(`${edit}/source-edits.json`,JSON.stringify({source:spec.source,appPixelsRecreated:false,alteredUsers:false,requestOutcome:'Awaiting response; no acceptance implied',edits:'Trimmed actual recording; note typing accelerated 2x; long send wait removed editorially. No native controls replaced. Friendship montage is illustrative.',scenes},null,2));
async function textLayer(str,size,width,color='#18343B',font='Nunito',align='left'){
 return sharp({text:{text:`<span foreground="${color}">${esc(str)}</span>`,font:`${font} ${font==='Nunito'?'ExtraBold':'SemiBold'} ${size}`,fontfile:`${root}brandKIT/04-Fonts/${font}-Variable.ttf`,width,align,rgba:true,spacing:Math.round(size*.05)}}).png().toBuffer();
}
async function addText(items,str,x,y,size,width,color,font='Nunito',align='left'){
 const input=await textLayer(str,size,width,color,font,align);const m=await sharp(input).metadata();items.push({input,left:Math.round(x+(align==='center'?(width-m.width)/2:0)),top:Math.round(y)});return m;
}
async function logo(items,x,y,size=192){const margin=Math.round(size*.125);items.push({input:await sharp(`${root}brandKIT/02-Logo/TipsToTrip-Original-Logo-1024.png`).resize(size,size).png().toBuffer(),left:x+margin,top:y+margin});}
const layout=f=>{
 const W=f.width,H=f.height,wide=W>H,square=H===W,vertical=H>1600;
 return {W,H,wide,square,vertical,logoX:wide?1620:780,logoY:vertical?250:55,
  phone:wide?{x:1050,y:95,w:420,h:860}:vertical?{x:210,y:415,w:550,h:1126}:square?{x:60,y:70,w:400,h:819}:{x:60,y:240,w:440,h:900},
  captionY:vertical?1580:square?925:wide?920:1190,captionFont:vertical?52:wide?48:42,
  captionMargin:vertical?270:square?90:wide?80:90};
};
async function graphics(f,s){const l=layout(f),{W,H}=l,p=l.phone,items=[];
 const isApp=s.type==='app',isClose=s.type==='close';
 let bg=rect(0,0,l.wide&&s.type==='person'?960:W,H,isApp||isClose?'#EAF8F7':l.wide?'#18343B':'none');
 if(isApp||isClose||l.wide)bg+=`<defs><clipPath id="routeclip"><rect width="${l.wide&&s.type==='person'?960:W}" height="${H}"/></clipPath></defs><path clip-path="url(#routeclip)" d="M ${-W*.2} ${H*.7} Q ${W*.45} ${H*.1} ${W*1.2} ${H*.6}" fill="none" stroke="${l.wide&&!isApp&&!isClose?'#25494F':'#D2EFED'}" stroke-width="${W*.12}"/>`;
 if(s.type==='person'&&!l.wide){bg+=`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18343B" stop-opacity="0"/><stop offset="1" stop-color="#18343B" stop-opacity=".92"/></linearGradient></defs><rect x="0" y="${H*.53}" width="${W}" height="${H*.47}" fill="url(#g)"/>`;}
 items.push({input:svg(W,H,bg),left:0,top:0});
 if(isApp){
  items.push({input:svg(W,H,rect(p.x-14,p.y-14,p.w+28,p.h+28,'#18343B',36)+rect(p.x-7,p.y-7,p.w+14,p.h+14,'#FFFFFF',30)),left:0,top:0});
  const tx=l.vertical?70:l.wide?125:l.square?550:570,ty=l.vertical?270:l.wide?210:l.square?330:400,tw=l.vertical?650:l.wide?780:l.square?460:440;
  await addText(items,s.label,tx,ty,l.vertical?62:l.wide?48:44,tw,'#0F7F8C');
  if(l.vertical){await addText(items,s.headline.replaceAll('\n',' '),tx,ty+83,37,670,'#18343B','Inter');}
  else await addText(items,s.headline,tx,l.wide?340:l.square?440:520,l.wide?88:60,l.wide?790:tw,'#18343B');
  const py=l.vertical?1568:l.wide?740:l.square?710:920;
  if(!l.vertical){await addText(items,'Explore. Say hello.\nSee where it goes.',tx,py,l.wide?36:28,l.wide?700:450,'#0F7F8C','Inter');}
  const progY=l.vertical?1730:l.wide?1018:H-40,progW=l.vertical?800:l.wide?740:880,progX=l.wide?125:l.vertical?70:70;
  items.push({input:svg(W,H,Array.from({length:3},(_,i)=>rect(progX+i*(progW/3+12),progY,progW/3-12,7,i<s.step?'#14A9B7':'#C7E8E5',4)).join('')),left:0,top:0});
 }else if(s.type==='person'){
  const tx=l.wide?120:75,ty=l.wide?280:l.vertical?1150:l.square?630:850,tw=l.wide?790:l.vertical?900:900;
  if(!(l.square&&['coffee','walk'].includes(s.id)))await addText(items,l.wide?s.side:s.headline,tx,ty,l.wide?92:l.vertical?88:l.square?62:72,tw,'#FFFFFF');
  if(l.wide)await addText(items,'Meet Buddy',tx,160,45,760,'#FFCF33','Inter');
 }else{
  const size=l.wide?260:l.vertical?340:260,tile=size*1.25,x=Math.round((W-tile)/2),y=l.vertical?420:l.wide?130:145;
  await logo(items,x,y,size);
  const baseY=y+tile+(l.vertical?65:40);
  await addText(items,'Meet Buddy',60,baseY,l.vertical?100:86,W-120,'#18343B','Nunito','center');
  await addText(items,'Good tips. Great company.',60,baseY+(l.vertical?142:112),l.vertical?48:40,W-120,'#0F7F8C','Nunito','center');
  const by=baseY+(l.vertical?250:210),bw=l.vertical?300:280,gap=28;
  const badges=await Promise.all(['AppleStoreLogo.png','PlayStoreLogo.png'].map(async n=>sharp(await sharp(root+'General-assesets/'+n).trim({background:'#FFFFFF',threshold:20}).png().toBuffer()).resize(bw,100,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer()));
  for(let i=0;i<2;i++)items.push({input:badges[i],left:Math.round((W-(bw*2+gap))/2+i*(bw+gap)),top:Math.round(by)});
  await addText(items,'Download Tips to Trip',60,by+145,l.vertical?44:35,W-120,'#18343B','Inter','center');
 }
 if(!isClose)await logo(items,l.logoX,l.logoY);
 const path=`${edit}/${f.id}/${s.id}-overlay.png`;await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(items).png().toFile(path);
 return {path,l};
}
function words(alignment,at){const a=alignment,chars=a.characters,out=[];let w='',start,end;for(let i=0;i<chars.length;i++){if(/\s/.test(chars[i])){if(w){out.push({word:w,start:at+start,end:at+end});w='';}}else{if(!w)start=a.character_start_times_seconds[i];w+=chars[i];end=a.character_end_times_seconds[i];}}if(w)out.push({word:w,start:at+start,end:at+end});return out;}
function cues(){const out=[];for(const s of spec.dialogues){const m=JSON.parse(readFileSync(`${dir}/elevenlabs/${s.id}.mp3.json`));const ws=words(m.preparedAlignment,s.at);let group=[];const flush=()=>{if(group.length){out.push({start:group[0].start,end:group.at(-1).end,text:group.map(w=>w.word).join(' ')});group=[];}};for(const w of ws){if(group.length&&(group.length>=4||[...group,w].map(w=>w.word).join(' ').length>29))flush();group.push(w);if(/[.!?]$/.test(w.word))flush();}flush();}return out;}
const assTime=s=>`${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${(s%60).toFixed(2).padStart(5,'0')}`;
const srtTime=s=>`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${(s%60).toFixed(3).padStart(6,'0').replace('.',',')}`;
async function captions(f){const l=layout(f),cs=cues();writeFileSync(`${edit}/${f.id}/captions.ass`,`[Script Info]\nScriptType: v4.00+\nPlayResX: ${l.W}\nPlayResY: ${l.H}\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Inter,${l.captionFont},&H00FFFFFF,&H00FFFFFF,&H0018343B,&H8018343B,-1,0,0,0,100,100,0,0,3,8,0,2,70,120,${l.captionMargin},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`+cs.map((c,i)=>`Dialogue: 0,${assTime(c.start)},${assTime(Math.min(c.end+.06,cs[i+1]?.start??c.end+.12))},Default,,0,0,0,,${c.text.replaceAll('{','').replaceAll('}','')}`).join('\n'));
 writeFileSync(`${dir}/exports/meet-buddy-en.srt`,cs.map((c,i)=>`${i+1}\n${srtTime(c.start)} --> ${srtTime(Math.min(c.end+.06,cs[i+1]?.start??c.end+.12))}\n${c.text}\n`).join('\n'));writeFileSync(`${edit}/caption-timing.json`,JSON.stringify(cs,null,2));}
async function captionFrames(f){
 const l=layout(f),cs=cues(),folder=`${edit}/${f.id}/caption-frames`;mkdirSync(folder,{recursive:true});
 const blank=`${folder}/blank.png`;await sharp({create:{width:l.W,height:120,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toFile(blank);
 const images=[];
 for(let i=0;i<cs.length;i++){const c=cs[i],t=await textLayer(c.text,l.captionFont,l.wide?800:l.W-200,'#FFFFFF','Inter','center'),m=await sharp(t).metadata(),center=l.wide&&c.start<29.5?480:l.W/2,x=Math.round(center-m.width/2),y=Math.round((120-m.height)/2),file=`${folder}/cue-${i}.png`;
  await sharp({create:{width:l.W,height:120,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:svg(l.W,120,rect(x-24,y-14,m.width+48,m.height+28,'#18343B',16)),left:0,top:0},{input:t,left:x,top:y}]).png().toFile(file);images.push(file);
 }
 for(let frame=0;frame<Math.round(spec.duration*30);frame++){const t=frame/30,i=cs.findIndex((c,i)=>t>=c.start&&t<Math.min(c.end+.06,cs[i+1]?.start??c.end+.12)),target=`${folder}/${String(frame).padStart(6,'0')}.png`;if(existsSync(target))unlinkSync(target);linkSync(i>=0?images[i]:blank,target);}
 return{folder,y:l.H-l.captionMargin-120};
}
async function audio(){const inputs=spec.dialogues.flatMap(s=>['-i',`${dir}/elevenlabs/${s.id}.wav`]),filters=spec.dialogues.map((s,i)=>`[${i}:a]asetpts=PTS-STARTPTS,adelay=${Math.round(s.at*1000)}:all=1[a${i}]`);
 ff([...inputs,'-filter_complex',filters.join(';')+';'+spec.dialogues.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${spec.dialogues.length}:normalize=0,apad,atrim=duration=${spec.duration},loudnorm=I=-16:TP=-1.5:LRA=7[a]`,'-map','[a]','-ar','48000','-ac','2',`${edit}/narration.wav`]);
 ff(['-i',`${edit}/narration.wav`,'-i',`${dir}/elevenlabs/music.mp3`,'-filter_complex',`[0:a]asplit=2[voice][duck];[1:a]atrim=duration=${spec.duration},asetpts=PTS-STARTPTS,loudnorm=I=-26:TP=-4:LRA=6,afade=t=in:d=0.18,afade=t=out:st=${spec.duration-1.2}:d=1.2[m];[m][duck]sidechaincompress=threshold=0.025:ratio=5:attack=12:release=350[bed];[voice][bed]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=7,apad,atrim=duration=${spec.duration}[a]`,'-map','[a]','-ar','48000','-ac','2',`${edit}/final-mix.wav`]);console.log('Narration and ducked music mix ready.');}
async function render(f){mkdirSync(`${edit}/${f.id}`,{recursive:true});await captions(f);const segmentFiles=[];
 for(const s of scenes){const out=`${edit}/${f.id}/${s.id}.mp4`;segmentFiles.push(out);if(existsSync(out)&&!process.argv.includes('--force'))continue;
  const {path,l}=await graphics(f,s),{W,H}=l;let args,filter;
  if(s.type==='close'){args=['-loop','1','-i',path];filter=`[0:v]fps=30,format=yuv420p[v]`;}
  else if(s.type==='app'){const p=l.phone;args=['-ss',String(s.start),'-i',root+spec.source,'-loop','1','-i',path];filter=`[1:v]fps=30[bg];[0:v]setpts=(PTS-STARTPTS)/${s.speed??1},fps=30,scale=${p.w}:${p.h}:flags=lanczos,setsar=1[app];[bg][app]overlay=${p.x}:${p.y}:shortest=1,format=yuv420p[v]`;}
  else{args=['-ss',String(s.start),'-i',`${dir}/${s.source}`,'-loop','1','-i',path];if(l.wide){
   filter=`[0:v]setpts=PTS-STARTPTS,fps=30,scale=960:1080:force_original_aspect_ratio=increase,crop=960:1080:0:(ih-oh)*0.35,setsar=1,pad=1920:1080:960:0:color=0x18343B[person];[person][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`;
  }else filter=`[0:v]setpts=PTS-STARTPTS,fps=30,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:0:(ih-oh)*0.35,setsar=1[person];[person][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`;}
  await ffAsync([...args,'-filter_complex',filter,'-map','[v]','-t',String(s.len),'-r','30','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-threads','4',out]);console.log(`${f.id}: ${s.id}`);
 }
 const list=`${edit}/${f.id}/concat.txt`;writeFileSync(list,segmentFiles.map(p=>`file '${p}'`).join('\n'));const silent=`${edit}/${f.id}/picture.mp4`;
 ff(['-f','concat','-safe','0','-i',list,'-c','copy',silent]);
 const out=`${dir}/exports/tips-to-trip-meet-buddy-${f.id}-35s.mp4`,cap=await captionFrames(f);
 await ffAsync(['-i',silent,'-i',`${edit}/final-mix.wav`,'-framerate','30','-i',`${cap.folder}/%06d.png`,'-filter_complex',`[0:v][2:v]overlay=0:${cap.y}:shortest=1[v]`,'-map','[v]','-map','1:a','-c:v','libx264','-preset','fast','-crf','18','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-metadata','title=Meet Buddy — Who is taking the photos?','-pix_fmt','yuv420p','-movflags','+faststart','-t',String(spec.duration),'-threads','4',out]);console.log(`Exported ${out}`);
}
if(stage==='audio')await audio();
else if(stage==='graphics'){for(const f of spec.exports.filter(f=>!only||f.id===only)){mkdirSync(`${edit}/${f.id}`,{recursive:true});for(const s of scenes)await graphics(f,s);await captions(f);}}
else if(stage==='render'||stage==='all'){if(stage==='all'||!existsSync(`${edit}/final-mix.wav`))await audio();for(const f of spec.exports.filter(f=>!only||f.id===only))await render(f);}
else throw Error('Choose audio, graphics or render.');
