import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname,dir=`${root}artifacts/travel-buddy-es`,en=`${root}artifacts/travel-buddy-en`,edit=`${dir}/edit`,frames=`${edit}/overlays`;
const stage=process.argv[2]??'prepare';
const spec=JSON.parse(readFileSync(`${root}scripts/travel-buddy-spanish.json`));
mkdirSync(frames,{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`${cmd}: ${r.stderr.slice(-1500)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-v','error','-y',...args]);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const svg=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">${s}</svg>`;
const text=(x,y,s,size=32,fill='#FFF',weight=600,anchor='start')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${esc(s)}</text>`;
const rect=(x,y,w,h,fill,r=18)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${r}"/>`;
const logo=await sharp(`${root}General-assesets/app_logo_white.png`).extract({left:98,top:99,width:828,height:812}).resize(512,512).png().toBuffer(),logoUri=`data:image/png;base64,${logo.toString('base64')}`;
const stores=['app-store-es','google-play-es'].map(n=>`data:image/png;base64,${readFileSync(`${dir}/${n}-borderless.png`).toString('base64')}`);
const brand=`<defs><clipPath id="brand"><circle cx="649" cy="54" r="39"/></clipPath></defs><image x="610" y="15" width="78" height="78" href="${logoUri}" clip-path="url(#brand)"/>`;
const gradient='<defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#062B2F"/><stop offset=".56" stop-color="#0A4144"/><stop offset="1" stop-color="#0B222A"/></linearGradient></defs><rect width="720" height="1280" fill="url(#bg)"/><circle cx="-80" cy="650" r="330" fill="#16B9AC" opacity=".05"/><circle cx="760" cy="210" r="280" fill="#FFBDD2" opacity=".06"/>';
const titles=[
 [5,8,'Crea tu viaje.','Crea una publicación de viaje',1],
 [8,11,'Prepara tu itinerario.','Tu ruta. Tus días. Tus paradas.',1],
 [11,13,'Dale forma a tu plan.','Añade lugares para cada día.',1],
 [13,15,'Dale vida a tu viaje.','Añade fotos del destino.',1],
 [15,17.5,'Tu viaje. A tu manera.','Preferencias de viaje',2],
 [17.5,19.8,'Encuentra gente afín.','Presupuesto · Estilo de viaje',2],
 [19.8,22,'Tu compañero ideal.','Elige con quién te gustaría viajar.',2],
 [22,25,'Todo tu plan, reunido.','Detalles del viaje',3],
 [25,27.5,'Cada parada. Cada detalle.','Tu itinerario en un solo lugar.',3],
 [27.5,29,'Listo para compartir.','Fotos · Preferencias · Planes',3],
 [29,33,'Comparte la aventura.','Comparte tu viaje',4],
 [33,35,'Tus planes, organizados.','Gestiona tus viajes',5],
 [35,36.7,'Tu viaje. Tú decides.','Tus viajes · Solicitudes',5],
 [36.7,38.3,'Elige quién se une.','Revisa las solicitudes.',6],
 [38.3,40,'Empieza la conexión.','Da la bienvenida a tus compañeros.',6],
 [40,43.3,'El grupo empieza aquí.','Chat del grupo',7],
 [43.3,47,'Organizadlo juntos.','Compartid ideas. Resolved dudas.',7],
 [47,49,'Próxima parada: juntos.','La conversación sigue en vuestro viaje.',7]
];
const stamp=t=>{const ms=Math.round(t*1000);return`00:${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};

if(stage==='prepare'){
 const performance=JSON.parse(readFileSync(`${dir}/performance-selection.json`));
 const words=[];
 for(const s of spec.dialogues){
  if(s.id==='intro'||s.id==='outro'){for(const w of performance[s.id].words)words.push({word:w.word,start:s.at+w.start,end:s.at+w.end});continue;}
  const m=JSON.parse(readFileSync(`${dir}/elevenlabs/${s.id}.json`)),a=m.preparedAlignment;let word='',start=0,end=0;
  const flush=()=>{if(word)words.push({word,start:s.at+start,end:s.at+end});word='';};
  a.characters.forEach((c,n)=>{if(/\s/.test(c)){flush();return;}if(!word)start=a.character_start_times_seconds[n];word+=c;end=a.character_end_times_seconds[n];});flush();
 }
 const cues=[];let group=[];
 function add(){if(!group.length)return;const sentence=group.map(w=>w.word).join(' '),parts=sentence.split(' ');let lines=[sentence];if(sentence.length>38){let best=1;for(let i=1;i<parts.length;i++)if(Math.abs(parts.slice(0,i).join(' ').length-parts.slice(i).join(' ').length)<Math.abs(parts.slice(0,best).join(' ').length-parts.slice(best).join(' ').length))best=i;lines=[parts.slice(0,best).join(' '),parts.slice(best).join(' ')];}cues.push({start:group[0].start,end:group.at(-1).end,text:lines.join('\n')});group=[];}
 for(const w of words){if(group.length&&(w.start-group.at(-1).end>.4||group.map(v=>v.word).join(' ').length+w.word.length>62))add();group.push(w);if(/[.!?]$/.test(w.word)||(/,$/.test(w.word)&&group.length>=3)||group.length>=14)add();}add();
 if(cues.some((c,i)=>c.start<0||c.end>58||c.end<=c.start||(i&&c.start<cues[i-1].end)))throw new Error('Invalid caption timing');
 writeFileSync(`${dir}/captions.json`,JSON.stringify(cues,null,2));writeFileSync(`${dir}/captions.srt`,cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
 const cache=new Map();
 for(let n=0;n<1740;n++){
  const t=n/30;let p='';
  if(t<5){p+='<defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#F4F9F5" stop-opacity=".97"/><stop offset="1" stop-color="#F4F9F5" stop-opacity="0"/></linearGradient></defs><rect width="720" height="205" fill="url(#shade)"/>';p+=rect(28,28,260,32,'#104B4E',16)+text(42,50,'COMPAÑEROS DE VIAJE',15,'#C5FFF1',700)+text(28,118,t<2.3?'¿Un viaje en mente?':'Encuentra con quién viajar.',t<2.3?43:37,'#103F45',700)+text(28,160,'Una aventura para compartir.',25,'#255B60',500);}
  else if(t<49){const s=titles.find(s=>t>=s[0]&&t<s[1]);if(!s)throw new Error('Missing title');p+=rect(28,26,260,32,'#154D50',16)+text(42,48,'COMPAÑEROS DE VIAJE',15,'#B5F1E5',700);p+=text(28,111,s[2],s[2].length>27?34:39,'#FFF',700)+text(28,151,s[3],s[3].length>35?20:21,'#A7D5D0',400);for(let i=1;i<=7;i++)p+=rect(35+(i-1)*93,1217,79,4,i<=s[4]?'#61E6D0':'#315154',2);}
  else if(t<56){p+=text(30,79,'Tu próxima aventura',38,'#103F45',700)+text(30,126,'empieza con una conexión.',28,'#33696C',500);stores.forEach((uri,i)=>p+=`<image x="${78+i*294}" y="984" width="270" height="81" href="${uri}"/>`);}
  else{p+=gradient+text(360,230,'Descarga la app.',48,'#FFF',700,'middle')+text(360,295,'Encuentra tu compañero de viaje.',30,'#A9E9DE',500,'middle')+`<image href="${logoUri}" x="226" y="414" width="268" height="268"/>`+text(360,761,'COMPAÑEROS DE VIAJE',25,'#FFD0DF',700,'middle')+text(360,817,'Un plan para compartir.',31,'#FFF',600,'middle');stores.forEach((uri,i)=>p+=`<image x="${78+i*294}" y="922" width="270" height="81" href="${uri}"/>`);}
  p+=brand;
  const c=cues.find(c=>t>=c.start&&t<c.end);if(c){const lines=c.text.split('\n');p+=rect(38,1105,644,lines.length===2?85:55,'#031E26',14);lines.forEach((l,i)=>p+=text(360,1140+i*32,l,26,'#FFF',600,'middle'));}
  if(!cache.has(p))cache.set(p,await sharp(Buffer.from(svg(p))).png().toBuffer());writeFileSync(`${frames}/${String(n).padStart(6,'0')}.png`,cache.get(p));
 }
 const audio=spec.dialogues.map(s=>`${dir}/elevenlabs/${s.id==='intro'||s.id==='outro'?s.id+'-final':s.id}.wav`);
 ff([...audio.flatMap(f=>['-i',f]),'-filter_complex',spec.dialogues.map((s,i)=>`[${i}:a]atrim=duration=${s.slot},asetpts=PTS-STARTPTS[a${i}]`).join(';')+`;${audio.map((_,i)=>`[a${i}]`).join('')}concat=n=8:v=0:a=1,apad,atrim=duration=58[a]`,'-map','[a]','-ac','1','-ar','48000','-c:a','pcm_s24le',`${edit}/narration.wav`]);
 const music=`${root}artifacts/meet-buddy-en/elevenlabs/music.mp3`;
 const chain='[0:a]loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[voice][key];[1:a]aresample=48000,apad,atrim=duration=58,loudnorm=I=-29:TP=-9:LRA=8,aresample=48000,afade=t=in:d=0.4,afade=t=out:st=55:d=3[music];[music][key]sidechaincompress=threshold=.03:ratio=6:attack=20:release=280[ducked];[voice][ducked]amix=inputs=2:duration=first:normalize=0[sum]';
 const measured=run('ffmpeg',['-hide_banner','-i',`${edit}/narration.wav`,'-i',music,'-filter_complex',chain+';[sum]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]','-map','[a]','-f','null','-']).stderr;
 const m=JSON.parse(measured.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
 const norm=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
 ff(['-i',`${edit}/narration.wav`,'-i',music,'-filter_complex',chain+`;[sum]${norm},aresample=48000,asetpts=N/SR/TB[a]`,'-map','[a]','-t','58','-ac','2','-ar','48000','-c:a','pcm_s24le',`${edit}/final-mix.wav`]);
 writeFileSync(`${edit}/edit-plan.json`,JSON.stringify({duration:58,fps:30,titles,captionTiming:'Official ElevenLabs character timestamps for body; independently checked Scribe word timestamps for cadence-preserved native presenter speech.',mix:{music,targetLUFS:-16,truePeak:-1.5,musicLUFS:-29,duckingRatio:6,measurement:m},body:'hands-screen-composited.mp4',nativeScreenTranslation:'../localisation/translation-audit.json'},null,2));
 console.log('Spanish titles, captions and audio mix prepared.');
}else if(stage==='render'){
 const scenes=[['intro',0,150,`${edit}/intro-screen-composited.mp4`],['hands',150,1320,`${edit}/hands-screen-composited.mp4`],['outro',1470,210,`${edit}/outro-screen-composited.mp4`],['endcard',1680,60,null]];
 for(const [id,at,count,video] of scenes){
  console.log(`Finishing ${id}`);let inputs,filter,overlay;
  if(id==='endcard'){inputs=['-framerate','30','-start_number',String(at),'-i',`${frames}/%06d.png`];filter='[0:v]setsar=1[out]';}
  else{if(id==='hands'){inputs=['-loop','1','-framerate','30','-i',`${en}/edit/background.png`,'-i',video];filter='[1:v]scale=864:1536,crop=720:930:72:135,setsar=1[p];[0:v][p]overlay=0:170:shortest=1[b]';overlay=2;}else{inputs=['-i',video];filter='[0:v]fps=30,setpts=PTS-STARTPTS,setsar=1[b]';overlay=1;}inputs.push('-framerate','30','-start_number',String(at),'-i',`${frames}/%06d.png`);filter+=`;[b][${overlay}:v]overlay=0:0:shortest=1[out]`;}
  ff([...inputs,'-filter_complex_threads','1','-filter_complex',filter,'-map','[out]','-an','-frames:v',String(count),'-r','30','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p',`${edit}/final-${id}.mp4`]);
 }
 writeFileSync(`${edit}/concat.txt`,scenes.map(([id])=>`file 'final-${id}.mp4'`).join('\n'));
 const output=`${dir}/tips-to-trip-travel-buddy-es-58s.mp4`;
 ff(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',`${edit}/final-mix.wav`,'-i',`${dir}/captions.srt`,'-map','0:v','-map','1:a','-map','2:s','-c:v','copy','-c:a','aac','-b:a','192k','-c:s','mov_text','-disposition:s:0','0','-metadata:s:a:0','language=spa','-metadata:s:s:0','language=spa','-t','58','-movflags','+faststart',output]);
 writeFileSync(`${dir}/render-result.json`,JSON.stringify({output,sha256:createHash('sha256').update(readFileSync(output)).digest('hex'),language:'es',separateLanguageVersion:true},null,2));console.log(output);
}else throw new Error('Choose prepare or render');
