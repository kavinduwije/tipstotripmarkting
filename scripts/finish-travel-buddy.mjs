import sharp from 'sharp';
import{readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync}from'node:fs';
import{spawnSync}from'node:child_process';
const root=new URL('../',import.meta.url).pathname,dir=`${root}artifacts/travel-buddy-en`,edit=`${dir}/edit`,frames=`${edit}/final-overlays`;
mkdirSync(frames,{recursive:true});
const spec=JSON.parse(readFileSync(`${root}scripts/travel-buddy-english.json`)),performance=JSON.parse(readFileSync(`${dir}/performance-selection.json`));
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`${cmd}: ${r.stderr.slice(-1000)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const svg=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">${s}</svg>`;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const text=(x,y,s,size=32,fill='#103F45',weight=600,anchor='start')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${esc(s)}</text>`;
const rect=(x,y,w,h,fill,r=18)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${r}"/>`;
const logo=await sharp(`${root}General-assesets/app_logo_white.png`).extract({left:98,top:99,width:828,height:812}).resize(512,512).png().toBuffer(),logoUri=`data:image/png;base64,${logo.toString('base64')}`;
const stores=[];for(const name of ['AppleStoreLogo','PlayStoreLogo']){const b=await sharp(`${root}General-assesets/${name}.png`).extract({left:29,top:220,width:542,height:162}).resize(270,81).png().toBuffer();stores.push(`data:image/png;base64,${b.toString('base64')}`);}
const cues=JSON.parse(readFileSync(`${dir}/captions.json`)).filter(c=>c.start<51);
let group=[];function add(){if(!group.length)return;const sentence=group.map(w=>w.word).join(' ');let lines=[sentence];if(sentence.length>38){const p=sentence.split(' ');let best=1;for(let i=1;i<p.length;i++)if(Math.abs(p.slice(0,i).join(' ').length-p.slice(i).join(' ').length)<Math.abs(p.slice(0,best).join(' ').length-p.slice(best).join(' ').length))best=i;lines=[p.slice(0,best).join(' '),p.slice(best).join(' ')];}cues.push({start:51+group[0].start,end:51+group.at(-1).end,text:lines.join('\n')});group=[];}
for(const w of performance.outro.words){if(group.length&&(w.start-group.at(-1).end>.4||group.map(v=>v.word).join(' ').length+w.word.length>62))add();group.push(w);if(/[.!?]$/.test(w.word)||group.length>=9)add();}add();
const stamp=t=>{const ms=Math.round(t*1000);return`00:${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
writeFileSync(`${dir}/captions-final.json`,JSON.stringify(cues,null,2));writeFileSync(`${dir}/captions-final.srt`,cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
const cache=new Map();
for(let n=0;n<1800;n++){
 const f=`${String(n).padStart(6,'0')}.png`,t=n/30;
 if(t>=7&&t<51||t>=58){copyFileSync(`${edit}/overlays/${f}`,`${frames}/${f}`);continue;}
 let p='';
 if(t<7){p+='<defs><linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#F4F9F5" stop-opacity=".97"/><stop offset="1" stop-color="#F4F9F5" stop-opacity="0"/></linearGradient></defs><rect width="720" height="205" fill="url(#shade)"/>';p+=rect(28,28,208,32,'#104B4E',16)+text(42,50,'TRAVEL BUDDY',15,'#C5FFF1',700)+text(28,118,t<3?'Got a trip in mind?':'Find your Travel Buddy.',t<3?44:40,'#103F45',700)+text(28,160,t<3?'Make room for a new connection.':'A plan worth sharing.',25,'#255B60',500);}
 else{p+=text(30,79,'Your next adventure',38,'#103F45',700)+text(30,126,'starts with a connection.',28,'#33696C',500);stores.forEach((uri,i)=>p+=`<image x="${78+i*294}" y="984" width="270" height="81" href="${uri}"/>`);}
 p+=`<defs><clipPath id="brand"><circle cx="649" cy="54" r="39"/></clipPath></defs><image x="610" y="15" width="78" height="78" href="${logoUri}" clip-path="url(#brand)"/>`;
 const c=cues.find(c=>t>=c.start&&t<c.end);if(c){const lines=c.text.split('\n'),y=1105;p+=rect(38,y,644,lines.length===2?85:55,'#031E26',14);lines.forEach((l,i)=>p+=text(360,y+35+i*32,l,26,'#FFF',600,'middle'));}
 if(!cache.has(p))cache.set(p,await sharp(Buffer.from(svg(p))).png().toBuffer());writeFileSync(`${frames}/${f}`,cache.get(p));
}
const scenes=[{id:'intro',at:0,frames:210,video:`${edit}/intro-screen-composited.mp4`},{id:'hands',at:7,frames:1320,video:`${edit}/hands-screen-composited.mp4`},{id:'outro',at:51,frames:210,video:`${edit}/outro-screen-composited.mp4`},{id:'endcard',at:58,frames:60,video:`${edit}/22-endcard.mp4`}];
for(const s of scenes){console.log(`Finishing ${s.id}`);let inputs=['-i',s.video],filter,input=1;
 if(s.id==='hands'){inputs=['-loop','1','-framerate','30','-i',`${edit}/background.png`,'-i',s.video];filter='[1:v]scale=864:1536,crop=720:930:72:135,setsar=1[phone];[0:v][phone]overlay=0:170:shortest=1[base]';input=2;}else filter='[0:v]fps=30,setpts=PTS-STARTPTS,setsar=1[base]';
 if(s.id==='endcard'){ff([...inputs,'-map','0:v','-an','-frames:v',String(s.frames),'-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',`${edit}/final-${s.id}.mp4`]);continue;}
 inputs.push('-framerate','30','-start_number',String(Math.round(s.at*30)),'-i',`${frames}/%06d.png`);filter+=`;[base][${input}:v]overlay=0:0:shortest=1[out]`;
 ff([...inputs,'-filter_complex_threads','1','-filter_complex',filter,'-map','[out]','-an','-frames:v',String(s.frames),'-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',`${edit}/final-${s.id}.mp4`]);
}
writeFileSync(`${edit}/final-concat.txt`,scenes.map(s=>`file 'final-${s.id}.mp4'`).join('\n'));
const speech=`${edit}/final-narration.wav`,speechInputs=spec.dialogues.map(s=>`${dir}/elevenlabs/${s.id==='outro'?'outro-final':s.id}.wav`),slots=[7,10,7,7,4,7,9,7];
ff([...speechInputs.flatMap(f=>['-i',f]),'-filter_complex',slots.map((d,i)=>`[${i}:a]atrim=duration=${d},asetpts=PTS-STARTPTS[a${i}]`).join(';')+`;${slots.map((_,i)=>`[a${i}]`).join('')}concat=n=8:v=0:a=1,apad,atrim=duration=60[a]`,'-map','[a]','-ac','1','-ar','48000','-c:a','pcm_s24le',speech]);
const music=`${root}artifacts/meet-buddy-en/elevenlabs/music.mp3`,mix=`${edit}/campaign-final-mix.wav`;
const chain='[0:a]loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[voice][key];[1:a]aresample=48000,apad,atrim=duration=60,loudnorm=I=-29:TP=-9:LRA=8,aresample=48000,afade=t=in:d=0.4,afade=t=out:st=57:d=3[music];[music][key]sidechaincompress=threshold=.03:ratio=6:attack=20:release=280[ducked];[voice][ducked]amix=inputs=2:duration=first:normalize=0[sum]';
const measured=run('ffmpeg',['-hide_banner','-i',speech,'-i',music,'-filter_complex',chain+';[sum]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]','-map','[a]','-f','null','-']).stderr;
const m=JSON.parse(measured.match(/\{\s*"input_i"[\s\S]*?\}/)[0]),norm=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
ff(['-i',speech,'-i',music,'-filter_complex',chain+`;[sum]${norm},aresample=48000,asetpts=N/SR/TB[a]`,'-map','[a]','-t','60','-ac','2','-ar','48000','-c:a','pcm_s24le',mix]);
const output=`${dir}/tips-to-trip-travel-buddy-en-60s.mp4`;
ff(['-f','concat','-safe','0','-i',`${edit}/final-concat.txt`,'-i',mix,'-i',`${dir}/captions-final.srt`,'-map','0:v','-map','1:a','-map','2:s','-c:v','copy','-c:a','aac','-b:a','192k','-c:s','mov_text','-disposition:s:0','0','-metadata:s:a:0','language=eng','-metadata:s:s:0','language=eng','-t','60','-movflags','+faststart',output]);
writeFileSync(`${dir}/final-edit-plan.json`,JSON.stringify({scenes,bodyFeatureEdit:'edit/edit-plan.json',performance,mix:{targetLUFS:-16,truePeakTarget:-1.5,musicLUFS:-29,duckingRatio:6,measurement:m},sourceEdits:'source-edits.json',captionSource:'ElevenLabs TTS character timestamps and independently checked ElevenLabs Scribe word timestamps for the cadence-preserved native close.'},null,2));
console.log(output);
