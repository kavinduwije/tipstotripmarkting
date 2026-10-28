import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(readFileSync(`${root}scripts/travel-buddy-english.json`));
const dir=`${root}${spec.directory}`,edit=`${dir}/edit`,frames=`${edit}/overlays`;
mkdirSync(frames,{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`${cmd}: ${r.stderr.slice(-1500)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const svg=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">${s}</svg>`;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const text=(x,y,s,size=32,fill='#FFFFFF',weight=600,anchor='start')=>`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${esc(s)}</text>`;
const rect=(x,y,w,h,fill,r=18)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${r}"/>`;
const appX=132,appY=192,appW=456,appH=896;
const src=spec.sourceFiles.map(p=>`${root}${p}`);
const scenes=[
 {id:'01-hook',at:0,end:3,source:0,ss:173,dur:3,title:'Got a trip in mind?',sub:'MAKE ROOM FOR A NEW CONNECTION',step:0,hook:true},
 {id:'02-discover',at:3,end:7,source:0,ss:164,dur:4,title:'Find your Travel Buddy.',sub:'One plan. More possibilities.',step:0,hook:true},
 {id:'03-create',at:7,end:10,source:0,ss:10,dur:3,title:'Create your trip.',sub:'Create Travel Buddy Post',step:1,promo:true},
 {id:'04-route',at:10,end:13,source:0,ss:22,dur:3,title:'Build your itinerary.',sub:'Your route. Your days. Your stops.',step:1},
 {id:'05-places',at:13,end:15,source:0,ss:33,dur:2,title:'Give the plan a place.',sub:'Add stops to each day.',step:1},
 {id:'06-photos',at:15,end:17,source:0,ss:112,dur:2,title:'Bring your trip to life.',sub:'Add your trip photos.',step:1},
 {id:'07-preferences',at:17,end:19.5,source:0,ss:117,dur:2.5,title:'Your trip. Your vibe.',sub:'Trip preferences',step:2},
 {id:'08-budget',at:19.5,end:21.8,source:0,ss:122.5,dur:2.3,title:'Find your kind of traveller.',sub:'Budget · Travel style',step:2},
 {id:'09-buddy',at:21.8,end:24,source:0,ss:130,dur:2.2,title:'A buddy who gets you.',sub:'Your ideal travel buddy',step:2},
 {id:'10-details',at:24,end:27,source:0,ss:173,dur:3,title:'The whole plan. Together.',sub:'Trip details',step:3},
 {id:'11-itinerary',at:27,end:29.5,source:0,ss:174.5,dur:2.5,title:'Every stop. Every detail.',sub:'Your itinerary in one place.',step:3},
 {id:'12-details-photos',at:29.5,end:31,source:0,ss:179,dur:1.5,title:'Ready to share.',sub:'Photos · Preferences · Plans',step:3},
 {id:'13-share',at:31,end:35,source:0,ss:180,dur:4,title:'Send the adventure.',sub:'Share your trip',step:4},
 {id:'14-manage',at:35,end:37,source:1,ss:2,dur:2,title:'Keep your plans together.',sub:'Manage trips',step:5},
 {id:'15-hosting',at:37,end:38.7,source:1,ss:4,dur:1.7,title:'Your trip. Your control.',sub:'Hosting · Manage Requests',step:5},
 {id:'16-requests',at:38.7,end:40.3,source:1,ss:6.2,dur:1.6,title:'Choose who joins.',sub:'Review travel buddy requests.',step:6},
 {id:'17-accept',at:40.3,end:42,source:1,ss:7.1,dur:1.7,title:'Make the connection.',sub:'Welcome your travel buddy.',step:6},
 {id:'18-chat',at:42,end:45.3,source:1,ss:74,dur:3.3,title:'The group starts here.',sub:'Group chat',step:7},
 {id:'19-compose',at:45.3,end:49,source:1,ss:94,dur:3.7,title:'Plan it together.',sub:'Share ideas. Ask a question.',step:7},
 {id:'20-message',at:49,end:52,source:1,ss:104,dur:3,title:'Next stop: together.',sub:'Keep the conversation in your trip.',step:7},
 {id:'21-download',at:52,end:57,card:true,title:'Your next adventure',sub:'starts with a connection.',step:8},
 {id:'22-endcard',at:57,end:60,card:true,title:'Download the app.',sub:'Find your Travel Buddy.',step:8}
].map(s=>({...s,startFrame:Math.round(s.at*30),endFrame:Math.round(s.end*30)}));
writeFileSync(`${edit}/edit-plan.json`,JSON.stringify(scenes,null,2));
const words=[];
for(const s of spec.dialogues){const m=JSON.parse(readFileSync(`${dir}/elevenlabs/${s.id}.json`)),a=m.preparedAlignment;let word='',start=0,end=0;const flush=()=>{if(word)words.push({word,start:start+s.at,end:end+s.at});word='';};a.characters.forEach((c,n)=>{if(/\s/.test(c)){flush();return;}if(!word)start=a.character_start_times_seconds[n];word+=c;end=a.character_end_times_seconds[n];});flush();}
const cues=[];let g=[];function flush(){if(!g.length)return;const s=g.map(w=>w.word).join(' ');let lines=[s];if(s.length>38){const p=s.split(' ');let best=1;for(let i=1;i<p.length;i++)if(Math.abs(p.slice(0,i).join(' ').length-p.slice(i).join(' ').length)<Math.abs(p.slice(0,best).join(' ').length-p.slice(best).join(' ').length))best=i;lines=[p.slice(0,best).join(' '),p.slice(best).join(' ')];}cues.push({start:g[0].start,end:g.at(-1).end,text:lines.join('\n')});g=[];}
for(const w of words){if(g.length&&(w.start-g.at(-1).end>.4||g.map(v=>v.word).join(' ').length+w.word.length>62))flush();g.push(w);if(/[.!?]$/.test(w.word)||g.length>=9)flush();}flush();
const stamp=t=>{const ms=Math.round(t*1000);return`00:${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
writeFileSync(`${dir}/captions.json`,JSON.stringify(cues,null,2));writeFileSync(`${dir}/captions.srt`,cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
const logo=await sharp(`${root}General-assesets/app_logo_white.png`).extract({left:98,top:99,width:828,height:812}).resize(512,512).png().toBuffer();
const logoUri=`data:image/png;base64,${logo.toString('base64')}`;
const stores=[];for(const f of ['AppleStoreLogo','PlayStoreLogo']){const b=await sharp(`${root}General-assesets/${f}.png`).extract({left:29,top:220,width:542,height:162}).resize(270,81).png().toBuffer();stores.push(`data:image/png;base64,${b.toString('base64')}`);}
const gradient='<defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#062B2F"/><stop offset=".56" stop-color="#0A4144"/><stop offset="1" stop-color="#0B222A"/></linearGradient></defs><rect width="720" height="1280" fill="url(#bg)"/><circle cx="-80" cy="650" r="330" fill="#16B9AC" opacity=".05"/><circle cx="760" cy="210" r="280" fill="#FFBDD2" opacity=".06"/>';
await sharp(Buffer.from(svg(gradient))).png().toFile(`${edit}/background.png`);
await sharp(Buffer.from(svg(`<defs><clipPath id="screen"><rect x="${appX}" y="${appY}" width="${appW}" height="${appH}" rx="18"/></clipPath></defs><rect x="${appX-9}" y="${appY-9}" width="${appW+18}" height="${appH+18}" fill="#020F14" rx="28"/><rect x="${appX-10}" y="${appY-10}" width="${appW+20}" height="${appH+20}" fill="none" stroke="#497576" stroke-width="2" rx="29"/>`))).png().toFile(`${edit}/phone-frame.png`);
// Exact recorded phone UI; only this requested text substitution is composited.
ff(['-ss','10','-i',src[0],'-frames:v','1',`${edit}/promo-source.png`]);
const promoSource=await sharp(`${edit}/promo-source.png`).png().toBuffer();
mkdirSync(`${edit}/promo`,{recursive:true});
for(let n=0;n<90;n++){
 const count=Math.max(0,Math.min(5,Math.floor((n-10)/8)+1)),entry='promo'.slice(0,count),cursor=n%26<16?'|':'';
 const patch=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="602" height="1234"><rect x="127" y="486" width="405" height="62" fill="#E1E9E8"/><text x="135" y="528" fill="#233A3B" font-family="Arial" font-size="26">${entry}${cursor}</text></svg>`);
 await sharp(promoSource).composite([{input:patch}]).png().toFile(`${edit}/promo/${String(n).padStart(3,'0')}.png`);
}
writeFileSync(`${dir}/source-edits.json`,JSON.stringify({sourceFiles:spec.sourceFiles,edits:[{type:'requested-demo-text',timelineStart:7,timelineEnd:10,sourceTime:10,field:'Trip name',entry:'promo',method:'Frame-aligned compositing into the native recorded field; keyboard, layout and controls retained.',backendClaim:false}],acceptedRequest:'The acceptance and joined-traveller state shown at 40.3–42 seconds come from the supplied second recording.',generatedVisualsBlocked:'Higgsfield first portrait submission rejected: insufficient credits. No new presenter or hands footage used in this app-edit preview.'},null,2));
const renderKey=createHash('sha256').update(readFileSync(new URL(import.meta.url))).update(JSON.stringify(cues)).digest('hex');
if(!existsSync(`${edit}/overlays.sha256`)||readFileSync(`${edit}/overlays.sha256`,'utf8')!==renderKey){
 let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<1800){const n=next++,t=n/30,s=scenes.find(s=>n>=s.startFrame&&n<s.endFrame);let p='';
  if(s.card){p+=gradient;const y=s.at===52?220:230;p+=text(360,y,s.title,s.at===52?43:48,'#FFF',700,'middle')+text(360,y+65,s.sub,33,'#A9E9DE',500,'middle');p+=`<image href="${logoUri}" x="226" y="414" width="268" height="268"/>`;p+=text(360,761,'TRAVEL BUDDY',26,'#FFD0DF',700,'middle')+text(360,817,'A plan worth sharing.',31,'#FFF',600,'middle');stores.forEach((uri,i)=>p+=`<image x="78" y="922" width="270" height="81" href="${i===0?uri:stores[0]}" opacity="${i===0?1:0}"/>`);p+=`<image x="372" y="922" width="270" height="81" href="${stores[1]}"/>`;
  }else{
   p+=rect(28,26,225,32,'#154D50',16)+text(42,48,'TRAVEL BUDDY',15,'#B5F1E5',700);
   const titleSize=s.title.length>27?34:39;p+=text(28,111,s.title,titleSize,'#FFF',700)+text(28,151,s.sub,s.sub.length>47?18:21,'#A7D5D0',400);
   const index=Math.min(7,s.step);for(let i=1;i<=7;i++)p+=rect(35+(i-1)*93,1217,79,4,i<=index?'#61E6D0':'#315154',2);
   if(s.hook)p+=rect(143,1011,434,60,'#092F34',14)+text(360,1050,'From a plan to your people.',24,'#FFF',700,'middle');
  }
  // Keep the supplied brand mark present on every scene.
  p+=`<defs><clipPath id="brand"><circle cx="649" cy="54" r="39"/></clipPath></defs><image x="610" y="15" width="78" height="78" href="${logoUri}" clip-path="url(#brand)"/>`;
  const c=cues.find(c=>t>=c.start&&t<c.end);if(c){const lines=c.text.split('\n'),y=1105,h=lines.length===2?85:55;p+=rect(38,y,644,h,'#031E26',14);lines.forEach((l,i)=>p+=text(360,y+35+i*32,l,26,'#FFFFFF',600,'middle'));}
  await sharp(Buffer.from(svg(p))).png().toFile(`${frames}/${String(n).padStart(6,'0')}.png`);
 }}));writeFileSync(`${edit}/overlays.sha256`,renderKey);
}
for(const s of scenes){const file=`${edit}/${s.id}.mp4`,sig=createHash('sha256').update(JSON.stringify(s)+renderKey).digest('hex');if(existsSync(file)&&existsSync(file+'.sha256')&&readFileSync(file+'.sha256','utf8')===sig)continue;
 console.log(`Rendering ${s.id}`);const length=(s.endFrame-s.startFrame)/30;
 let args=['-loop','1','-framerate','30','-i',`${edit}/background.png`],filter;
 if(s.card){filter='[0:v]setsar=1[v]';}
 else{args.push('-loop','1','-framerate','30','-i',`${edit}/phone-frame.png`);
  if(s.promo)args.push('-framerate','30','-i',`${edit}/promo/%03d.png`);else args.push('-ss',String(s.ss),'-i',src[s.source]);
  filter=`[0:v][1:v]overlay=0:0[bg];[2:v]trim=duration=${s.dur},setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=0.2,trim=duration=${length},crop=602:1182:0:52,scale=${appW}:${appH},setsar=1[app];[bg][app]overlay=${appX}:${appY}:shortest=1[v]`;
 }
 const overlayInput=s.card?1:3;args.push('-framerate','30','-start_number',String(s.startFrame),'-i',`${frames}/%06d.png`);
 filter+=`;[v][${overlayInput}:v]overlay=0:0:shortest=1[out]`;
 ff([...args,'-filter_complex_threads','1','-filter_complex',filter,'-map','[out]','-an','-frames:v',String(s.endFrame-s.startFrame),'-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',file]);writeFileSync(file+'.sha256',sig);
}
writeFileSync(`${edit}/concat.txt`,scenes.map(s=>`file '${s.id}.mp4'`).join('\n'));
const speech=`${edit}/narration.wav`,inputs=spec.dialogues.flatMap(s=>['-i',`${dir}/elevenlabs/${s.id}.wav`]);
ff([...inputs,'-filter_complex',`${spec.dialogues.map((_,i)=>`[${i}:a]`).join('')}concat=n=8:v=0:a=1,apad,atrim=duration=60[a]`,'-map','[a]','-ac','1','-ar','48000','-c:a','pcm_s24le',speech]);
const music=`${root}artifacts/meet-buddy-en/elevenlabs/music.mp3`,mix=`${edit}/final-mix.wav`;
const chain='[0:a]loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[voice][key];[1:a]aresample=48000,apad,atrim=duration=60,loudnorm=I=-29:TP=-9:LRA=8,aresample=48000,afade=t=in:d=0.4,afade=t=out:st=57:d=3[music];[music][key]sidechaincompress=threshold=.03:ratio=6:attack=20:release=280[ducked];[voice][ducked]amix=inputs=2:duration=first:normalize=0[sum]';
const measured=run('ffmpeg',['-hide_banner','-i',speech,'-i',music,'-filter_complex',chain+';[sum]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]','-map','[a]','-f','null','-']).stderr;
const m=JSON.parse(measured.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);const norm=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
ff(['-i',speech,'-i',music,'-filter_complex',chain+`;[sum]${norm},aresample=48000,asetpts=N/SR/TB[a]`,'-map','[a]','-t','60','-ac','2','-ar','48000','-c:a','pcm_s24le',mix]);
const output=`${dir}/tips-to-trip-travel-buddy-en-60s-app-edit-preview.mp4`;
ff(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',mix,'-i',`${dir}/captions.srt`,'-map','0:v','-map','1:a','-map','2:s','-c:v','copy','-c:a','aac','-b:a','192k','-c:s','mov_text','-disposition:s:0','0','-metadata:s:a:0','language=eng','-metadata:s:s:0','language=eng','-t','60','-movflags','+faststart',output]);
writeFileSync(`${edit}/mix-settings.json`,JSON.stringify({reusedElevenLabsMusic:music,narrationTargetLUFS:-16,musicTargetLUFS:-29,duckingRatio:6,finalTargetLUFS:-16,truePeakTarget:-1.5,measured:m},null,2));
console.log(output);
