import fs from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const cleanHeader=process.argv.includes('--clean-header');
const root=new URL('../',import.meta.url).pathname,src=root+'artifacts/travel-buddy-story-en',original=root+'artifacts/travel-buddy-flyer-en',dir=original+(cleanHeader?'/clean-header':''),edit=dir+'/edit';
for(const p of [dir,edit,dir+'/exports',dir+'/qa',edit+'/font-cache'])fs.mkdirSync(p,{recursive:true});
process.env.FONTCONFIG_FILE=edit+'/fonts.conf';fs.writeFileSync(process.env.FONTCONFIG_FILE,`<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${root}brandKIT/04-Fonts</dir><cachedir>${edit}/font-cache</cachedir></fontconfig>`);
const W=1080,H=1920,stage=process.argv[2]??'render';
const scenes=[{id:'hook',at:0,len:3,type:'hook'},{id:'create',at:3,len:3,type:'product',colour:'#CEF6E4',title:'MAKE\nA PLAN.',sub:'Create your Travel Buddy post.',step:0},{id:'share',at:6,len:3,type:'product',colour:'#E5FA82',title:'SHARE\nTHE PLAN.',sub:'Send your post to your friends.',step:1},{id:'chat',at:9,len:3,type:'product',colour:'#A3E8ED',title:'PLAN\nTOGETHER.',sub:'One trip. One group chat.',step:2},{id:'close',at:12,len:3,type:'close'}];
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:12*1024*1024});if(r.status!==0)throw Error(`${cmd}: ${r.stderr.slice(-2200)}`);return r;};
const ff=a=>run('ffmpeg',['-hide_banner','-y',...a]);
const ffAsync=a=>new Promise((res,rej)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...a]);let err='';p.stderr.on('data',d=>err=(err+d).slice(-2500));p.on('error',rej);p.on('exit',c=>c===0?res():rej(Error(err)));});
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const svg=s=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${s}</svg>`);
async function type(text,size,width,colour='#FFFFFF',align='left',weight='Heavy'){
 return sharp({text:{text:`<span foreground="${colour}">${esc(text)}</span>`,font:`Inter ${weight} ${size}`,fontfile:root+'brandKIT/04-Fonts/Inter-Variable.ttf',width,align,rgba:true,spacing:0}}).png().toBuffer();
}
async function add(items,str,size,x,y,width,colour='#FFFFFF',align='left',weight='Heavy'){
 const b=await type(str,size,width,colour,align,weight),m=await sharp(b).metadata();items.push({input:b,left:Math.round(x+(align==='center'?(width-m.width)/2:0)),top:Math.round(y)});return m;
}
async function png(items,path,background={r:0,g:0,b:0,alpha:0}){await sharp({create:{width:W,height:H,channels:4,background}}).composite(items).png().toFile(path);}
async function badge(name){const inset=name==='PlayStoreLogo.png'?4:1,{data,info}=await sharp(root+'General-assesets/'+name).trim({background:'#FFFFFF',threshold:40}).toBuffer({resolveWithObject:true}),w=info.width-2*inset,h=info.height-2*inset;const masked=await sharp(data).extract({left:inset,top:inset,width:w,height:h}).ensureAlpha().composite([{input:Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="15" fill="white"/></svg>`),blend:'dest-in'}]).png().toBuffer();return sharp(masked).resize(350,120,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();}
async function graphics(){
 const logo=await sharp(root+'General-assesets/app_logo_white.png').resize(112,112).png().toBuffer();
 for(const s of scenes){
  const product=s.type==='product',c=product?'#102B29':'#FFFFFF',accent=product?'#102B29':'#8FFAD3';
  let decor='';
  if(product){decor=`<rect width="1080" height="1920" fill="${s.colour}"/><circle cx="1000" cy="1110" r="650" fill="white" fill-opacity=".2"/><path d="M92 740C280 660 170 1440 950 1530" fill="none" stroke="#164F47" stroke-opacity=".13" stroke-width="3" stroke-dasharray="8 12"/><circle cx="92" cy="740" r="12" fill="none" stroke="#164F47" stroke-width="4"/><circle cx="950" cy="1530" r="12" fill="#164F47"/><path d="M64 195H1016M64 1740H1016" stroke="#173C34" stroke-opacity=".25"/><rect x="48" y="32" width="984" height="1856" rx="3" fill="none" stroke="#164F47" stroke-opacity=".15"/>`;
   for(let i=0;i<30;i++)decor+=`<path d="M${64+i*5} 1640V1700" stroke="#1C5146" stroke-width="${i%4===0?3:1}" stroke-opacity=".32"/>`;
  }else decor='<rect width="1080" height="1920" fill="#07131B"/><path d="M-100 580L1180 250M-100 1720L1180 1390" stroke="#233F47" stroke-width="2"/><rect x="32" y="32" width="1016" height="1856" fill="none" stroke="#426D6B" stroke-opacity=".5"/>';
  await png([{input:svg(decor),left:0,top:0}],`${edit}/${s.id}-background.png`);
  const items=cleanHeader?[]:[{input:logo,left:912,top:64}];
  if(!cleanHeader)await add(items,'TRAVEL BUDDY',30,64,91,720,accent,'left','Bold');
  if(product){
   await add(items,s.title,119,64,250,930,c);
   await add(items,s.sub,34,69,520,950,c,'left','Medium');
   await add(items,String(s.step+1).padStart(2,'0'),126,52,1110,200,'#527D70','left','Bold');
   for(const[i,label]of['01 CREATE','02 SHARE','03 CHAT'].entries()){
    const active=i===s.step;if(active)items.push({input:svg(`<rect x="${64+i*320}" y="1768" width="290" height="72" rx="36" fill="#102B29"/>`),left:0,top:0});
    await add(items,label,25,64+i*320,1790,290,active?'#FFFFFF':'#47685F','center','Bold');
   }
  }else if(s.type==='hook'){
   await add(items,'STOP SAYING',84,64,285,960,'#FFFFFF');
   // Cyan and pink offsets provide a restrained neon RGB edge around the title.
   for(const[col,dx]of[['#F14EA7',-3],['#7BFFE4',3],['#FFFFFF',0]])await add(items,'SOMEDAY.',124,64+dx,400,960,col);
   items.push({input:svg('<rect x="64" y="599" width="805" height="105" fill="#93F8D0" transform="rotate(-2 64 599)"/>'),left:0,top:0});
   await add(items,'MAKE THE PLAN.',55,90,622,850,'#0B2927');
   await add(items,'CREATE  /  SHARE  /  CHAT',30,64,1775,950,'#93F8D0','left','Bold');
  }else{
   items.push({input:await sharp(root+'General-assesets/app_logo_white.png').resize(210,210).png().toBuffer(),left:435,top:300});
   await add(items,'FIND YOUR\nTRAVEL PEOPLE.',91,64,645,952,'#FFFFFF','center');
   await add(items,'Travel Buddy',45,64,975,952,'#95FAD3','center','Bold');
   await add(items,'Start your post today.',38,64,1110,952,'#FFFFFF','center','Medium');
   items.push({input:await badge('AppleStoreLogo.png'),left:170,top:1300},{input:await badge('PlayStoreLogo.png'),left:560,top:1300});
   await add(items,'CREATE  /  SHARE  /  CHAT',26,64,1570,952,'#95FAD3','center','Bold');
  }
  await png(items,`${edit}/${s.id}-type.png`);
 }
 // Masks retain the native app contents inside a simple product card.
 await sharp(Buffer.from('<svg width="564" height="1131"><rect width="564" height="1131" rx="36" fill="white"/></svg>')).png().toFile(edit+'/phone-mask.png');
 await sharp(Buffer.from('<svg width="952" height="790"><rect width="952" height="790" rx="30" fill="white"/></svg>')).png().toFile(edit+'/film-mask.png');
 console.log('Five motion-flyer layouts prepared.');
}
async function picture(){
 const paths=[];
 for(const s of scenes){
  const out=`${edit}/scene-${s.id}.mp4`;paths.push(out);if(fs.existsSync(out)&&!process.argv.includes('--force'))continue;
  let inputs,filter;
  if(s.type==='product'){
   const media=s.id==='create'?['-i',src+'/demo/gallery-private-safe.mp4']:s.id==='share'?['-loop','1','-i',src+'/demo/share.png']:['-ss','100','-i',root+'General-assesets/Travel Buddy/Manage trip - group chat.mov'];
   inputs=['-loop','1','-i',`${edit}/${s.id}-background.png`,...media,'-loop','1','-i',`${edit}/${s.id}-type.png`,'-loop','1','-i',edit+'/phone-mask.png'];
   const expr="(t/0.45)",easeX="258+180*pow(max(0,1-t/0.45),3)",easeY="594+35*pow(max(0,1-t/0.45),3)";
   let pre='[1:v]setpts=PTS-STARTPTS,fps=30,scale=602:1234[native];';
   if(s.id==='chat'){inputs.push('-loop','1','-i',src+'/demo/chat-typing-patch.png');pre+='[native][4:v]overlay=0:0:shortest=1[private];';}
   const screen=s.id==='chat'?'private':'native';
   filter=`${pre}[${screen}]scale=540:1107:flags=lanczos,format=rgba,pad=564:1131:12:12:color=#102B29[screen];[3:v]format=gray[mask];[screen][mask]alphamerge[card];[0:v]fps=30[bg];[bg][card]overlay=x='${easeX}':y='${easeY}':shortest=1[base];[2:v]format=rgba,fade=t=in:st=0:d=0.15:alpha=1[type];[base][type]overlay=0:0:shortest=1,format=yuv420p[v]`;
  }else if(s.type==='hook'){
   inputs=['-loop','1','-i',edit+'/hook-background.png','-i',src+'/broll-planning.mp4','-loop','1','-i',edit+'/hook-type.png','-loop','1','-i',edit+'/film-mask.png'];
   filter="[0:v]fps=30[bg];[1:v]setpts=PTS-STARTPTS,fps=30,crop=720:598:0:350,scale=952:790:flags=lanczos,format=rgba[film];[3:v]format=gray[mask];[film][mask]alphamerge[card];[bg][card]overlay=x='64+120*pow(max(0,1-t/0.4),3)':y=850:shortest=1[base];[2:v]format=rgba,fade=t=in:st=0:d=0.12:alpha=1[type];[base][type]overlay=x='if(lt(t,0.10),4*sin(t*190),0)':y=0:shortest=1,format=yuv420p[v]";
  }else{
   inputs=['-ss','1','-i',src+'/broll-walk.mp4','-loop','1','-i',edit+'/close-type.png'];
   filter="[0:v]setpts=PTS-STARTPTS,fps=30,scale=1080:1920:flags=lanczos,eq=brightness=-0.10:saturation=0.65,drawbox=x=0:y=0:w=iw:h=ih:color=0x031319@0.74:t=fill[base];[1:v]format=rgba,fade=t=in:st=0:d=0.18:alpha=1[type];[base][type]overlay=0:0:shortest=1,format=yuv420p[v]";
  }
  filter=filter.replace(/format=yuv420p\[v\]$/, 'format=rgba,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[v]');
  await ffAsync([...inputs,'-filter_complex',filter,'-map','[v]','-an','-t','3','-frames:v','90','-c:v','libx264','-crf','17','-preset','fast','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-color_range','tv','-threads','4',out]);console.log('Rendered '+s.id);
 }
 fs.writeFileSync(edit+'/concat.txt',paths.map(p=>`file '${p}'`).join('\n'));
 ff(['-v','error','-f','concat','-safe','0','-i',edit+'/concat.txt','-c','copy',edit+'/picture.mp4']);
}
function audio(){
 // Reuse the exact original instrumental, not the narration/impact mix.
 const music=src+'/elevenlabs/music.mp3';
 ff(['-v','error','-i',music,'-af','atrim=duration=15,asetpts=PTS-STARTPTS,afade=t=in:d=0.12,afade=t=out:st=13.8:d=1.2','-ar','48000','-ac','2',edit+'/music-edit.wav']);
 const log=ff(['-i',edit+'/music-edit.wav','-af','loudnorm=I=-16:TP=-2.5:LRA=7:print_format=json','-f','null','-']).stderr,j=log.lastIndexOf('{'),m=JSON.parse(log.slice(j,log.indexOf('}',j)+1));
 const f=`loudnorm=I=-16:TP=-2.5:LRA=7:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
 ff(['-v','error','-i',edit+'/music-edit.wav','-af',f,'-ar','48000','-ac','2',edit+'/final-music.wav']);
 fs.writeFileSync(dir+'/qa/music-provenance.json',JSON.stringify({sourceVideo:src+'/exports/tips-to-trip-travel-buddy-story-en-60s.mp4',sameOriginalBackgroundMusic:music,sourceMusicSha256:createHash('sha256').update(fs.readFileSync(music)).digest('hex'),sourceTrimSeconds:[0,15],narration:false,newAudioGenerated:false,edits:'Opening and ending fades; loudness adjusted for a music-only flyer',measurement:m},null,2));
}
async function render(){
 await graphics();await picture();
 if(cleanHeader){
  fs.copyFileSync(original+'/edit/final-music.wav',edit+'/final-music.wav');
  fs.copyFileSync(original+'/qa/music-provenance.json',dir+'/qa/music-provenance.json');
 }else audio();
 const out=dir+'/exports/tips-to-trip-travel-buddy-flyer-en-15s'+(cleanHeader?'-clean-header':'')+'.mp4';
 const musicInput=cleanHeader?original+'/exports/tips-to-trip-travel-buddy-flyer-en-15s.mp4':edit+'/final-music.wav';
 ff(['-v','error','-i',edit+'/picture.mp4','-i',musicInput,'-map','0:v','-map','1:a','-c:v','copy',...(cleanHeader?['-c:a','copy']:['-c:a','aac','-b:a','192k','-ar','48000']),'-t','15','-movflags','+faststart','-metadata','title=Travel Buddy — Create. Share. Chat.',out]);
 ff(['-v','error','-ss','1.5','-i',out,'-frames:v','1','-q:v','2',dir+'/exports/travel-buddy-flyer-cover.jpg']);
 ff(['-v','error','-i',out,'-vf','fps=1,scale=216:384,tile=5x3','-frames:v','1',dir+'/qa/contact-sheet.jpg']);
 fs.writeFileSync(dir+'/production-brief.json',JSON.stringify({format:'15-second 1080 x 1920 vertical motion flyer, 30 fps',concept:'Create / Share / Chat; bold poster typography, mint/lime/cyan product cards and realistic same-cast film windows',scenes,music:'Same saved original ElevenLabs instrumental as supplied reference; music-only, no narration',privacySource:src+'/demo/source-edits.json',privacy:'Use only sanitised gallery, sharing and chat assets. Native control faces and fictional identities retained. Edited app examples are not evidence of live backend updates.',visuals:'Reuse completed reviewed Higgsfield planning/walking footage. No new billable generations.'},null,2));
 if(cleanHeader)fs.writeFileSync(dir+'/revision.json',JSON.stringify({source:original+'/exports/tips-to-trip-travel-buddy-flyer-en-15s.mp4',changes:['Removed upper-left TRAVEL BUDDY label in every scene','Removed upper-right logo in every scene'],centralClosingBrandingRetained:true,audio:'Original AAC stream copied unchanged'},null,2));
 console.log('Ready for visual review: '+out);
}
if(stage==='graphics')await graphics();else if(stage==='render')await render();else throw Error('Choose graphics or render.');
