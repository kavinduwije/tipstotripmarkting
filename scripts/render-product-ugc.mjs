import sharp from 'sharp';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const french=process.argv.includes('--french');
const business=process.argv.includes('--business');
const dir=`${root}artifacts/${business?`ugc-business-${french?'fr':'es'}`:`ugc-product-${french?'fr':'es'}`}`, edit=`${dir}/edit`;
const spec=JSON.parse(readFileSync(`${root}scripts/${business?`ugc-business-${french?'french':'spanish'}`:`ugc-product-${french?'french':'spanish'}`}.json`,'utf8'));
const social=business&&french,width=social?1080:720,height=width*16/9;
const px=n=>Math.round(n*width/720);
const logo=readFileSync(`${root}${spec.logo}`);
const output=`${dir}/tips-to-trip-${business?'business':'product'}-ugc-${french?'fr':'es'}-60s.mp4`;
mkdirSync(edit,{recursive:true});
const defaultScenes=[
  {id:'01-hook',at:0,full:true,title:['Tu próximo viaje,','con gente nueva.'],tag:'CONOCE · VIAJA · DESCUBRE'},
  {id:'02-meet-map',at:5.2,source:'Meet buddy.mov',start:0,length:4,feature:'Meet Buddy',title:'Encuentra gente cerca',sub:'Activa Go Live y explora el mapa',step:'01',side:['Cerca de ti','Abre un perfil','Empieza con un hola']},
  {id:'03-meet-profile',at:9.2,source:'Meet buddy.mov',start:4,length:4,feature:'Meet Buddy',title:'Conoce su perfil',sub:'Mira su presentación y distancia',step:'02',side:['Presentación','Distancia','Afinidad']},
  {id:'04-meet-request',at:11.5,source:'Meet buddy.mov',start:13,length:14,feature:'Meet Buddy',title:'Da el primer paso',sub:'Escribe una nota y envía tu solicitud',step:'03',side:['Una nota','Una solicitud','Un nuevo plan']},
  {id:'05-travel-browse',at:15.6,source:'Travel buddy.mov',start:0,length:4,feature:'Travel Buddy',title:'Encuentra tu próxima escapada',sub:'Explora viajes y destinos',step:'01',side:['Destino','Fechas','Compañía']},
  {id:'06-travel-details',at:21,source:'Travel buddy.mov',start:4,length:6,feature:'Travel Buddy',title:'Revisa todos los detalles',sub:'Descubre el itinerario y las fechas',step:'02',side:['Itinerario','Fotos del viaje','Preferencias']},
  {id:'07-travel-join',at:24.4,source:'Travel buddy.mov',start:14,length:5,feature:'Travel Buddy',title:'Solicita unirte al viaje',sub:'Request to Join → solicitud pendiente',step:'03',side:['Envía la solicitud','Espera respuesta','Revisa Mis viajes']},
  {id:'08-my-trips',at:30,source:'Travel buddy post group chat.mov',start:0,length:3.5,feature:'Travel Buddy',title:'Tus viajes, en un solo lugar',sub:'Solicitudes y viajes aceptados',step:'04',side:['Solicitados','Aceptados','Entra al chat']},
  {id:'09-group-chat',at:35.5,source:'Travel buddy post group chat.mov',start:10,length:6.5,feature:'Travel Buddy',title:'Planead la aventura juntos',sub:'Presupuesto, itinerario y planes',step:'05',side:['Chat del grupo','Presupuesto','Planes en común']},
  {id:'10-hosting',at:41.5,source:'Travel buddy post group chat.mov',start:6,length:3,feature:'Travel Buddy',title:'Si organizas, revisa el grupo',sub:'Manage Requests → participantes',step:'06',side:['Tu viaje','Participantes','Manage Requests']},
  {id:'11-near-feed',at:45.6,source:'Near you.mov',start:0,length:4,feature:'Near You',title:'Descubre planes locales',sub:'Eventos, ofertas y publicaciones',step:'01',side:['Eventos','Ofertas','Planes locales']},
  {id:'12-near-filters',at:50.2,source:'Near you.mov',start:11,length:4,feature:'Near You',title:'Explora lo que te interesa',sub:'Busca y filtra por tipo de publicación',step:'02',side:['Busca','Filtra','Explora']},
  {id:'13-near-map',at:52.1,source:'Near you.mov',start:22,length:4,feature:'Near You',title:'Mira qué hay cerca',sub:'Cambia del feed al mapa',step:'03',side:['En el mapa','Cerca de ti','Tu próximo plan']},
  {id:'14-close',at:54.9,full:true,title:['¿Te vienes?','La aventura empieza aquí.'],tag:'CONOCE · VIAJA · DESCUBRE'}
];
const scenes=existsSync(`${dir}/scene-timing.json`)?JSON.parse(readFileSync(`${dir}/scene-timing.json`,'utf8')):business?JSON.parse(readFileSync(`${root}scripts/ugc-business-${french?'french':'spanish'}-scenes.json`,'utf8')):french?JSON.parse(readFileSync(`${root}scripts/ugc-product-french-scenes.json`,'utf8')):defaultScenes;
for(let i=0;i<scenes.length;i++) {scenes[i].duration=Number(((scenes[i+1]?.at??60)-scenes[i].at).toFixed(6));scenes[i].presenter=scenes[i].at>=30?2:1;}
writeFileSync(`${edit}/edit-plan.json`,JSON.stringify(scenes,null,2));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(x,y,s,size=28,color='#143C37',weight=400)=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(s)}</text>`;
async function artwork(s) {
  const p=[];
  if(s.full) {
    p.push('<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#082F2A" stop-opacity="0"/><stop offset="0.45" stop-color="#082F2A" stop-opacity="0.85"/><stop offset="1" stop-color="#082F2A" stop-opacity="0.98"/></linearGradient></defs>');
    p.push(`<rect x="0" y="${social?650:820}" width="720" height="${social?630:460}" fill="url(#shade)"/>`);
    p.push(text(social?48:32,social?770:970,s.tag,17,'#A8EDDB',700));
    s.title.forEach((v,i)=>p.push(text(social?48:32,(social?830:1030)+i*54,v,s.id==='14-close'||s.id==='18-close'?39:45,'#FFFFFF',700)));
  } else {
    p.push('<rect width="720" height="1280" fill="#F4F9F7"/><circle cx="760" cy="855" r="335" fill="#E0F2EC"/>');
    p.push(`<rect x="28" y="34" width="${Math.max(190,Math.min(400,s.feature.length*11+32))}" height="40" rx="20" fill="#D9F5EA"/>`);
    p.push(text(44,61,s.feature,21,'#116F61',700));
    p.push(text(28,151,s.title,s.title.length>28?29:32,'#123E36',700));
    p.push(text(28,187,s.sub,s.sub.length>45?18:20,'#52746C'));
    const phoneX=s.appOnly?132:20;
    p.push(`<rect x="${phoneX}" y="225" width="456" height="916" rx="28" fill="#C4DAD1"/><rect x="${phoneX+4}" y="229" width="448" height="908" rx="24" fill="#FFFFFF"/>`);
    if(!s.appOnly){
    p.push('<rect x="488" y="225" width="204" height="368" rx="18" fill="#B7D8CA"/>');
    p.push(text(490,685,s.step,64,'#168976',700));
    s.side.forEach((v,i)=>p.push(text(490,737+i*35,v,v.length>15?18:20,'#244E44',i===0?700:400)));
    p.push('<rect x="490" y="870" width="160" height="3" rx="1.5" fill="#A4CCBB"/>');
    p.push(text(490,910,business?(french?'Créez.':'Crea.'):french?'Rencontre.':'Conecta.',22,'#1D6052',700),text(490,941,business?(french?'Publiez.':'Publica.'):french?'Explore.':'Explora.',22,'#1D6052',700),text(490,972,business?(french?'Connectez.':'Conecta.'):french?'Partage.':'Comparte.',22,'#1D6052',700));
    }
  }
  p.push(`<defs><clipPath id="logo"><circle cx="628" cy="88" r="68"/></clipPath></defs><image x="560" y="20" width="136" height="136" href="data:image/png;base64,${logo.toString('base64')}" clip-path="url(#logo)"/>`);
  const path=`${edit}/${s.id}.png`;
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 720 1280">${p.join('')}</svg>`)).png().toFile(path);
  return path;
}
function run(command,args) {
  const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(r.status!==0) throw new Error(`${command} failed: ${r.stderr}`);
  return r;
}
function ffmpeg(args) {return run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);}
for(const s of scenes) {
  const art=await artwork(s);
  if(process.argv.includes('--graphics-only')) continue;
  const target=`${edit}/${s.id}.mp4`;
  if(process.argv.includes('--mix-only')) {if(!existsSync(target))throw new Error(`Missing scene ${s.id}`);continue;}
  const actor=`${dir}/presenter-0${s.presenter}.mp4`,actorStart=s.at-(s.presenter===2?30:0);
  const signature=createHash('sha256').update(JSON.stringify(s)+readFileSync(fileURLToPath(import.meta.url))+logo).update(s.appOnly?'app-demonstration':readFileSync(actor)).digest('hex');
  const hashPath=`${edit}/${s.id}.sha256`;
  if(existsSync(target)&&existsSync(hashPath)&&readFileSync(hashPath,'utf8')===signature) {console.log(`Reusing ${s.id}`);continue;}
  console.log(`Rendering ${s.id}`);
  let inputs,filter;
  if(s.full) {
    inputs=['-ss',String(actorStart),'-i',actor,'-loop','1','-i',art];
    filter=`[0:v]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=2[v];[v][1:v]overlay=0:0:shortest=1[out]`;
  } else if(s.appOnly){
    inputs=['-loop','1','-i',art,'-ss',String(s.start),'-t',String(s.length),'-i',`${spec.sourceDirectory}/${s.source}`];
    filter=`[1:v]setpts=${s.duration/s.length}*(PTS-STARTPTS),fps=30,scale=${px(440)}:${px(900)}:force_original_aspect_ratio=decrease,pad=${px(440)}:${px(900)}:(ow-iw)/2:(oh-ih)/2:color=0xF4F9F7,setsar=1,tpad=stop_mode=clone:stop_duration=2[app];[0:v][app]overlay=${px(140)}:${px(233)}:shortest=1[out]`;
  } else {
    inputs=['-loop','1','-i',art,'-ss',String(s.start),'-t',String(s.length),'-i',`${spec.sourceDirectory}/${s.source}`,'-ss',String(actorStart),'-i',actor];
    // Fit app recordings without stretching the UI; pad the phone canvas if needed.
    filter=`[1:v]setpts=${s.duration/s.length}*(PTS-STARTPTS),fps=30,scale=${px(440)}:${px(900)}:force_original_aspect_ratio=decrease,pad=${px(440)}:${px(900)}:(ow-iw)/2:(oh-ih)/2:color=0xF4F9F7,setsar=1,tpad=stop_mode=clone:stop_duration=2[app];[2:v]setpts=PTS-STARTPTS,fps=30,scale=${px(204)}:${px(362)}:force_original_aspect_ratio=increase,crop=${px(204)}:${px(362)},setsar=1,tpad=stop_mode=clone:stop_duration=2[actor];[0:v][app]overlay=${px(28)}:${px(233)}:shortest=1[screen];[screen][actor]overlay=${px(488)}:${px(228)}:shortest=1[out]`;
  }
  ffmpeg([...inputs,'-filter_complex',filter,'-map','[out]','-an','-frames:v',String(Math.round(s.duration*30)),'-r','30','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p',target]);
  writeFileSync(hashPath,signature);
}
if(process.argv.includes('--graphics-only')) process.exit(0);
if(process.argv.includes('--clips-only')) process.exit(0);
writeFileSync(`${edit}/concat.txt`,scenes.map(s=>`file '${s.id}.mp4'`).join('\n'));
const ass=`${dir}/captions.ass`;
if(!existsSync(ass)) throw new Error('Verified Spanish captions must be prepared before final export');
// Render timed caption graphics locally; no libass-enabled FFmpeg build is required.
const cues=JSON.parse(readFileSync(`${dir}/captions.json`,'utf8'));
const capDir=`${edit}/captions`;mkdirSync(capDir,{recursive:true});
await sharp({create:{width,height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).png().toFile(`${capDir}/blank.png`);
const capSequence=[];let cursor=0;
function captionEntry(file,duration) {if(duration>0.001)capSequence.push(`file '${file}'\noption framerate 30\nduration ${duration.toFixed(6)}`);}
for(const [i,cue] of cues.entries()) {
  captionEntry('blank.png',cue.start-cursor);
  const lines=cue.text.split('\n');
  const y=social?930:1154;
  const graphic=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 720 1280"><rect x="${social?48:24}" y="${lines.length>1?y:y+28}" width="${social?600:672}" height="${lines.length>1?92:64}" rx="14" fill="#102F29" fill-opacity="0.92"/>${lines.map((line,n)=>`<text x="${social?348:360}" y="${lines.length>1?y+36+n*34:y+69}" text-anchor="middle" font-family="Arial" font-size="${social?26:28}" font-weight="700" fill="#FFFFFF">${esc(line)}</text>`).join('')}</svg>`;
  const file=`caption-${String(i).padStart(3,'0')}.png`;
  await sharp(Buffer.from(graphic)).png().toFile(`${capDir}/${file}`);
  captionEntry(file,cue.end-cue.start);cursor=cue.end;
}
captionEntry('blank.png',60-cursor);capSequence.push("file 'blank.png'\noption framerate 30");
writeFileSync(`${capDir}/sequence.txt`,capSequence.join('\n'));
ffmpeg(['-f','concat','-safe','0','-i',`${capDir}/sequence.txt`,'-vf','fps=30','-t','60','-c:v','qtrle','-pix_fmt','argb',`${edit}/caption-overlay.mov`]);
// The French music has a fuller middle section: keep its lift underneath speech.
const musicTarget=french||business?-30:-27, musicPeak=-9;
const ducking={threshold:french?0.03:0.075,ratio:french?6:4,attackMs:25,releaseMs:300};
const voiceFilter=`[1:a]aresample=48000,apad,atrim=duration=30,asetpts=PTS-STARTPTS[v1];[2:a]aresample=48000,apad,atrim=duration=30,asetpts=PTS-STARTPTS[v2];[v1][v2]concat=n=2:v=0:a=1,loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[voice][key];[3:a]aresample=48000,apad,atrim=duration=60,asetpts=PTS-STARTPTS,loudnorm=I=${musicTarget}:TP=${musicPeak}:LRA=8,aresample=48000,afade=t=in:d=0.6,afade=t=out:st=57.5:d=2.5[music];[music][key]sidechaincompress=threshold=${ducking.threshold}:ratio=${ducking.ratio}:attack=${ducking.attackMs}:release=${ducking.releaseMs}[ducked];[voice][ducked]amix=inputs=2:duration=longest:normalize=0,afade=t=out:st=59.7:d=0.3[amix]`;
const inputs=['-reinit_filter','0','-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',`${dir}/elevenlabs/presenter-01.mp3`,'-i',`${dir}/elevenlabs/presenter-02.mp3`,'-i',`${dir}/elevenlabs/music.mp3`,'-i',`${edit}/caption-overlay.mov`];
console.log('Measuring narration and ducked music mix.');
const measured=run('ffmpeg',['-hide_banner',...inputs,'-filter_complex',`${voiceFilter};[amix]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]`,'-map','[a]','-f','null','-']).stderr;
const match=measured.match(/\{\s*"input_i"[\s\S]*?\}/);
if(!match) throw new Error('Mix measurement missing');
const m=JSON.parse(match[0]);
const norm=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
console.log('Exporting the captioned product video.');
// Finish audio separately so a scene's changing video color metadata cannot reset
// stateful narration, music or loudness filters during the final video export.
const finalMix=`${edit}/final-mix.wav`;
ffmpeg([...inputs,'-filter_complex',`${voiceFilter};[amix]${norm},aresample=48000,asetpts=N/SR/TB[a]`,'-map','[a]','-c:a','pcm_s24le','-ar','48000','-t','60',finalMix]);
ffmpeg([...inputs,'-i',finalMix,'-filter_complex','[0:v]setpts=N/(30*TB)[base];[base][4:v]overlay=0:0:shortest=1,fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration=60[v]','-map','[v]','-map','5:a','-r','30','-fps_mode','cfr','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-metadata:s:a:0',`language=${french?'fra':'spa'}`,'-t','60','-movflags','+faststart',output]);
writeFileSync(`${edit}/mix-settings.json`,JSON.stringify({voiceTargetLUFS:-16,musicTargetLUFS:musicTarget,ducking,finalTargetLUFS:-16,truePeakTargetDb:-1.5,measurement:m},null,2));
console.log(`Finished: ${output}`);
