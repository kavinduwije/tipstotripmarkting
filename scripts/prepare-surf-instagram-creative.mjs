import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {root,dir} from './surf-buddy-demo.mjs';

// Placement-specific revision. Reuse reviewed performances, audio and app pixels.
const out=`${dir}/instagram`,edit=`${dir}/edit`,W=720,H=1280;
mkdirSync(out,{recursive:true});
process.env.FONTCONFIG_FILE=`${edit}/fonts.conf`;
const source=`${dir}/exports/tips-to-trip-surf-buddy-en-60s-nia-profile-fixed.mp4`;
const video=`${dir}/exports/tips-to-trip-surf-buddy-en-instagram-safe-60s.mp4`;
const scenes=JSON.parse(readFileSync(`${edit}/scene-plan.json`));
const cues=JSON.parse(readFileSync(`${edit}/caption-timing.json`));
const bounds=[];
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status)throw Error(r.stderr.slice(-2500));return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const svg=(s,w=W,h=H)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${s}</svg>`);
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
async function label(items,t,size,x,y,width,color='#fff',align='left',font='Nunito',canvasW=W){
 const b=await sharp({text:{text:`<span foreground="${color}">${esc(t)}</span>`,font:`${font} ExtraBold ${size}`,fontfile:`${root}brandKIT/04-Fonts/${font}-Variable.ttf`,width,align,rgba:true,spacing:3}}).png().toBuffer();
 const m=await sharp(b).metadata(),left=Math.round(x+(align==='center'?(width-m.width)/2:0));
 items.push({input:b,left,top:y});
 bounds.push({text:t,canvasW,x:left,y,w:m.width,h:m.height});return m;
}
const logo=await sharp(`${root}General-assesets/app_logo_white.png`).resize(72,72).png().toBuffer();
for(const s of scenes){
 const items=[],plain=s.app||s.close;
 if(plain)items.push({input:svg('<rect width="720" height="1280" fill="#ECF6F3"/>'),left:0,top:0});
 else items.push({input:svg('<defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#102e30" stop-opacity="0"/><stop offset="1" stop-color="#102e30" stop-opacity=".75"/></linearGradient></defs><rect y="540" width="720" height="740" fill="url(#g)"/>'),left:0,top:0});
 items.push({input:logo,left:584,top:190});
 if(s.close){
  items.push({input:await sharp(`${root}General-assesets/app_logo_white.png`).resize(150,150).png().toBuffer(),left:285,top:260});
  await label(items,'Meet Buddy',52,60,438,600,'#153B3C','center');
  await label(items,"Don't surf alone.\nFind your surf buddy.",40,60,520,600,'#097E7C','center');
  for(const[i,n]of['AppleStoreLogo.png','PlayStoreLogo.png'].entries())items.push({input:await sharp(await sharp(`${root}General-assesets/${n}`).trim({background:'#fff',threshold:20}).png().toBuffer()).resize(220,74,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer(),left:128+i*244,top:680});
 }else if(s.app)await label(items,s.headline,28,52,190,500,'#173D3D');
 else if(s.headline)await label(items,s.headline,47,60,590,560);
 else if(s.label)await label(items,s.label,25,60,670,540);
 const overlay=`${out}/${s.id}-overlay.png`;
 await sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(items).png().toFile(overlay);
 const target=`${out}/scene-${s.id}.mp4`;let inputs,filter;
 if(s.close){inputs=['-loop','1','-i',overlay];filter='[0:v]fps=30,format=yuv420p[v]';}
 else if(s.app){
  inputs=['-i',`${edit}/scene-${s.id}.mp4`,'-loop','1','-i',overlay];
  let app='[0:v]';
  if(['profile','profile-detail','pending','sent','request'].includes(s.id)){
   const p=s.id==='request'?'request-background':'profile';
   inputs.push('-loop','1','-i',`${dir}/profile-fix/${p}.png`);
   filter='[0:v][2:v]overlay=240:278:shortest=1[patched];';app='[patched]';
  }else filter='';
  // Focus on the actual UI content; the request sheet retains both original DPs.
  const crop=s.id==='request'?'502:740:109:420':'502:800:109:220';
  filter+=`${app}crop=${crop},scale=-2:500:flags=lanczos,setsar=1[app];[1:v]fps=30[bg];[bg][app]overlay=(W-w)/2:260:shortest=1,format=yuv420p[v]`;
 }else{
  inputs=['-ss',String(s.start??0),'-i',`${dir}/${s.source}`,'-loop','1','-i',overlay];
  filter=`[0:v]setpts=PTS-STARTPTS,fps=30,scale=${Math.round(W*(s.zoom??1))}:${Math.round(H*(s.zoom??1))}:force_original_aspect_ratio=increase,crop=720:1280:(iw-ow)/2:${s.zoom?0:'(ih-oh)/2'},setsar=1[base];[base][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`;
 }
 if(!existsSync(target))ff([...inputs,'-filter_complex',filter,'-map','[v]','-an','-r','30','-frames:v',String(Math.round(s.len*30)),'-c:v','libx264','-crf','17','-preset','fast','-threads','4',target]);
 console.log(`Safe picture: ${s.id}`);
}
const filters=[],inputs=['-f','concat','-safe','0','-i',`${out}/concat.txt`,'-i',source];
writeFileSync(`${out}/concat.txt`,scenes.map(s=>`file '${out}/scene-${s.id}.mp4'`).join('\n'));
// Transparent caption strips are regenerated at a fixed position inside the Reels safe area.
for(let i=0;i<cues.length;i++){
 const c=cues[i],items=[];const m=await label(items,c.text,29,0,10,560,'#fff','center','Inter');
 const p=`${out}/caption-${i}.png`,height=m.height+20;
 const bg=svg(`<rect width="${m.width+30}" height="${height}" rx="12" fill="#123b3b" fill-opacity=".9"/>`,m.width+30,height);
 await sharp(bg).composite([{input:items[0].input,left:15,top:10}]).png().toFile(p);
 inputs.push('-loop','1','-i',p);
 filters.push(`[${i===0?'0:v':`c${i-1}`}][${i+2}:v]overlay=(W-w)/2:774:enable='gte(t,${c.start})*lt(t,${Math.min(c.end+.06,cues[i+1]?.start??60)})':shortest=1[c${i}]`);
 if(774+height>832)throw Error(`Caption exceeds safe area: ${c.text}`);
}
ff([...inputs,'-filter_complex',filters.join(';'),'-map',`[c${cues.length-1}]`,'-map','1:a:0','-c:v','libx264','-crf','17','-preset','fast','-threads','4','-r','30','-frames:v','1800','-c:a','copy','-t','60','-movflags','+faststart',video]);
// The still is an intentional branded layout assembled from existing campaign footage.
ff(['-ss','1','-i',`${dir}/native-hook.mp4`,'-frames:v','1',`${out}/still-source.png`]);
for(const [name,width,height,top] of [['feed',1080,1350,180],['stories',1080,1920,300]]){
 const photo=await sharp(`${out}/still-source.png`).resize(width,height,{fit:'cover'}).png().toBuffer();
 const items=[{input:svg('<defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#102e30" stop-opacity=".04"/><stop offset="1" stop-color="#102e30" stop-opacity=".9"/></linearGradient></defs><rect width="1080" height="1920" fill="url(#g)"/>',width,height),left:0,top:0}];
 items.push({input:await sharp(`${root}General-assesets/app_logo_white.png`).resize(104,104).png().toBuffer(),left:860,top});
 const textY=name==='feed'?730:790;
 await label(items,"Don't surf alone.",64,90,textY,850,'#fff','left','Nunito',width);
 await label(items,'Find your surf buddy.',57,90,textY+85,850,'#fff','left','Nunito',width);
 await label(items,'Meet Buddy on Tips to Trip',35,90,textY+180,840,'#d7f6eb','left','Inter',width);
 await label(items,'Install the app. Create your account.',31,90,textY+238,840,'#fff','left','Inter',width);
 await sharp(photo).composite(items).jpeg({quality:94}).toFile(`${out}/surf-buddy-image-${name}.jpg`);
}
const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',video]).stdout),v=probe.streams.find(s=>s.codec_type==='video');
if(v.width!==720||v.height!==1280||v.avg_frame_rate!=='30/1'||+v.nb_read_frames!==1800||+probe.format.duration!==60)throw Error('Export format mismatch');
ff(['-xerror','-i',video,'-f','null','-']);
const hash=p=>ff(['-i',p,'-map','0:a','-c','copy','-f','hash','-hash','sha256','-']).stdout.trim();
if(hash(video)!==hash(source))throw Error('Audio changed');
writeFileSync(`${out}/verification.json`,JSON.stringify({source,video,createdAt:new Date().toISOString(),duration:60,width:720,height:1280,fps:30,frames:1800,fullDecodePassed:true,audioCopiedUnchanged:true,safeArea:{top:180,bottom:832,sides:44,source:'Ads Manager native Safe zone on Reels and Stories dialog: Reels 14% top, 35% bottom; 6% sides; extra lower-right controls kept clear.'},profileFixRetained:true,requestPhotosRetained:true,bounds,visualReview:'pending'},null,2));
console.log(`Prepared ${video} and companion image layouts.`);
