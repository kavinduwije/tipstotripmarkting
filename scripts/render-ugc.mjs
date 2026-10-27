import sharp from 'sharp';
import {mkdirSync, writeFileSync, existsSync, readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const spanish=process.argv.includes('--spanish');
const useLogo=process.argv.includes('--logo');
const elevenlabs=process.argv.includes('--elevenlabs');
if(elevenlabs && !spanish) throw new Error('The existing ElevenLabs narration is Spanish. Use --spanish.');
const out = `${root}artifacts/${spanish?'ugc-es':'ugc'}`;
const outputName=`tips-to-trip-ugc${spanish?'-es':''}${elevenlabs?'-elevenlabs':''}${useLogo?'-logo':''}-60s`;
const edit=`${out}/${useLogo?'edit-logo':'edit'}`;
const logoPath=`${root}General-assesets/app_logo_white.png`;
const logoBytes=useLogo?readFileSync(logoPath):null;
const logoArtwork=useLogo?`<defs><clipPath id="brand-logo"><circle cx="628" cy="92" r="68"/></clipPath></defs><image x="560" y="24" width="136" height="136" clip-path="url(#brand-logo)" href="data:image/png;base64,${logoBytes.toString('base64')}"/>`:'';
const src = '/Users/kavinduwijewickrama/remotion/my-video/Product screen recordings';
mkdirSync(edit, {recursive:true});
const scenes = spanish ? JSON.parse(readFileSync(new URL('ugc-spanish.json',import.meta.url),'utf8')).scenes : [
  {id:'01-hook', at:0, duration:6, presenter:1, full:true, title:['Meet people.', 'Make local plans.'], label:'MEET BUDDY + NEAR YOU'},
  {id:'02-browse', at:6, duration:8, presenter:1, source:'Meet Buddy part 2.mov', start:0, length:8, title:['Find your people'], label:'MEET BUDDY', step:'01', side:['Go Live', 'Browse the', 'map or list']},
  {id:'03-profile', at:14, duration:8, presenter:1, source:'Meet buddy.mov', start:5, length:3, title:['Get to know them'], label:'MEET BUDDY', step:'02', side:['Open a profile', 'Check distance', '+ match score']},
  {id:'04-request', at:22, duration:4, presenter:1, source:'Meet buddy.mov', start:13, length:14, title:['Start with a hello'], label:'MEET BUDDY', step:'03', side:['Add a note', 'Send your', 'meet request']},
  {id:'05-sent', at:26, duration:4, presenter:1, source:'Meet buddy.mov', start:29, length:6, title:['Your request is sent'], label:'MEET BUDDY', step:'04', side:['Sent requests', 'Awaiting a', 'response']},
  {id:'06-requests', at:30, duration:7, presenter:2, source:'Meet Buddy part 2.mov', start:13, length:8, title:['Keep track in one place'], label:'MEET BUDDY', step:'05', side:['Received', 'Accepted', 'Sent / Blocked']},
  {id:'07-discover', at:37, duration:6, presenter:2, source:'Near you.mov', start:0, length:4, title:['Find your next local plan'], label:'NEAR YOU', step:'01', side:['Discover', 'Local posts', 'Events + offers']},
  {id:'08-filters', at:43, duration:9, presenter:2, source:'Near you.mov', start:4, length:15, title:['Explore what interests you'], label:'NEAR YOU', step:'02', side:['Search', 'Filter by type', 'Browse the feed']},
  {id:'09-map', at:52, duration:3, presenter:2, source:'Near you.mov', start:22, length:4, title:['See what is nearby'], label:'NEAR YOU', step:'03', side:['Local discovery', 'In the feed', 'or on the map']},
  {id:'10-close', at:55, duration:5, presenter:2, full:true, title:['Find a buddy.', 'Discover your next plan.'], label:'TIPS TO TRIP'},
];

function xml(s) { return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function text(x,y,s,size=28,color='#102E2B',weight=400) {
  return `<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${color}">${xml(s)}</text>`;
}
async function art(scene, mode) {
  let pieces=[];
  if (scene.full) {
    pieces.push('<rect x="0" y="920" width="720" height="360" fill="#092E29" fill-opacity="0.92"/>');
    if(!useLogo) {
      pieces.push('<rect x="28" y="32" width="208" height="48" rx="24" fill="#DAFFF3"/>');
      pieces.push(text(48,64,'Tips to Trip',26,'#0A5649',700));
    }
    if(!(useLogo && scene.id==='10-close')) pieces.push(text(40,979,scene.label,19,'#A0E9D1',700));
    scene.title.forEach((s,i)=>pieces.push(text(40,1048+i*64,s,scene.id==='10-close'?42:52,'#FFFFFF',700)));
    pieces.push(text(40,1220,'MEET BUDDY  /  NEAR YOU',19,'#C2DFD7',700));
  } else if(mode==='base') {
    pieces.push('<rect width="720" height="1280" fill="#F3F8F5"/>');
    pieces.push('<circle cx="715" cy="850" r="280" fill="#E0F4EB"/>');
    if(!useLogo) {
      pieces.push(text(30,55,'Tips to Trip',24,'#0D6251',700));
      pieces.push(text(spanish?465:505,54,spanish?'DEMO REAL DE LA APP':'REAL APP DEMO',16,'#55776E',700));
    }
    pieces.push(text(30,112,scene.label,18,'#15826A',700));
    scene.title.forEach((s,i)=>pieces.push(text(30,165+i*40,s,33,'#102E2B',700)));
    pieces.push('<rect x="23" y="207" width="456" height="926" rx="30" fill="#BED3C9"/>');
    pieces.push('<rect x="27" y="210" width="448" height="920" rx="26" fill="#153E35"/>');
    pieces.push('<rect x="488" y="210" width="204" height="370" rx="20" fill="#DCEAE4"/>');
    pieces.push(text(488,710,scene.step,72,'#16836A',700));
    scene.side.forEach((s,i)=>pieces.push(text(488,762+i*40,s,22,'#294E45',i===0?700:400)));
    pieces.push('<rect x="30" y="1180" width="660" height="3" fill="#D3E4DC"/>');
    pieces.push(text(30,1220,'Meet Buddy',22,'#173E34',700));
    pieces.push(text(550,1220,'Near You',22,'#173E34',700));
    pieces.push(text(30,1251,spanish?'Conoce gente. Descubre nuevos planes.':'Find people. Discover local plans.',18,'#688179'));
  }
  if(useLogo) pieces.push(logoArtwork);
  const path=`${edit}/${scene.id}-${mode}.png`;
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">${pieces.join('')}</svg>`)).png().toFile(path);
  return path;
}
function ffmpeg(args) {
  const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args], {stdio:'inherit'});
  if(result.status!==0) throw new Error('FFmpeg failed');
}

for(const scene of scenes) {
  const file=`${edit}/${scene.id}.mp4`;
  const signature=createHash('sha256').update(JSON.stringify(scene)+readFileSync(fileURLToPath(import.meta.url),'utf8')+(logoBytes?.toString('base64')??'')).digest('hex');
  const signaturePath=`${edit}/${scene.id}.sha256`;
  if(existsSync(file) && existsSync(signaturePath) && readFileSync(signaturePath,'utf8')===signature) { console.log(`Reusing edit ${scene.id}`); continue; }
  const actor=`${out}/presenter-0${scene.presenter}.mp4`;
  if(!existsSync(actor)) { console.log('Remaining edits are waiting for the next presenter segment. Run ugc:render again after generation completes.'); process.exit(0); }
  const actorStart=scene.at-(scene.presenter===2?30:0);
  console.log(`Rendering ${scene.id}`);
  if(scene.full) {
    const overlay=await art(scene,'overlay');
    ffmpeg(['-ss',String(actorStart),'-i',actor,'-loop','1','-i',overlay,
      '-filter_complex','[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=1[v];[v][1:v]overlay=0:0:shortest=1[out]',
      '-map','[out]','-an','-t',String(scene.duration),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',file]);
  } else {
    const bg=await art(scene,'base');
    const filter=`[1:v]setpts=${scene.duration/scene.length}*(PTS-STARTPTS),fps=30,scale=444:908,setsar=1,tpad=stop_mode=clone:stop_duration=1[app];[2:v]setpts=PTS-STARTPTS,fps=30,scale=204:362:force_original_aspect_ratio=increase,crop=204:362,setsar=1,tpad=stop_mode=clone:stop_duration=1[actor];[0:v][app]overlay=29:216:shortest=1[screen];[screen][actor]overlay=488:214:shortest=1[out]`;
    ffmpeg(['-loop','1','-i',bg,'-ss',String(scene.start),'-t',String(scene.length),'-i',`${src}/${scene.source}`,'-ss',String(actorStart),'-i',actor,
      '-filter_complex',filter,'-map','[out]','-an','-t',String(scene.duration),'-r','30','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',file]);
  }
  writeFileSync(signaturePath,signature);
}
writeFileSync(`${edit}/concat.txt`, scenes.map(s=>`file '${s.id}.mp4'`).join('\n'));
const captions=`${out}/tips-to-trip-ugc${spanish?'-es':''}-60s.srt`;
if(elevenlabs) {
  // Preserve the already verified ElevenLabs audio and Spanish captions exactly.
  ffmpeg(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',`${out}/tips-to-trip-ugc-es-elevenlabs-60s.mp4`,
    '-map','0:v','-map','1:a','-map','1:s?','-c','copy','-t','60','-movflags','+faststart',`${out}/${outputName}.mp4`]);
} else ffmpeg(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',`${out}/presenter-01.mp4`,'-i',`${out}/presenter-02.mp4`,
  ...(existsSync(captions)?['-i',captions]:[]),
  '-filter_complex','[1:a]aresample=48000,apad,atrim=0:30,asetpts=PTS-STARTPTS[a1];[2:a]aresample=48000,apad,atrim=0:30,asetpts=PTS-STARTPTS[a2];[a1][a2]concat=n=2:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=59.75:d=0.25[a]',
  '-map','0:v','-map','[a]',...(existsSync(captions)?['-map','3:s','-c:s','mov_text','-metadata:s:s:0',`language=${spanish?'spa':'eng'}`]:[]),
  '-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-t','60','-movflags','+faststart',`${out}/${outputName}.mp4`]);
writeFileSync(`${edit}/edit-plan.json`,JSON.stringify(scenes,null,2));
console.log(`Finished: ${out}/${outputName}.mp4`);
