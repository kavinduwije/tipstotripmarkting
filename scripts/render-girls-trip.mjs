import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(readFileSync(`${root}scripts/girls-trip-english.json`));
const dir=`${root}${spec.directory}`,work=dir,edit=`${work}/edit`,revision=false;
mkdirSync(`${edit}/graphics`,{recursive:true});mkdirSync(`${edit}/shots`,{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0)throw new Error(`${cmd}: ${r.stderr.slice(-1600)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const save=(p,d)=>writeFileSync(p,JSON.stringify(d,null,2));
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const text=(x,y,s,size=32,fill='#FFFFFF',weight=600,anchor='middle')=>`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}">${esc(s)}</text>`;
const rect=(x,y,w,h,fill,r=18)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${r}"/>`;
const svg=(s,w=720,h=1280)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${s}</svg>`;
const graphic=async(name,s,w=720,h=1280)=>{const p=`${edit}/graphics/${name}.png`;await sharp(Buffer.from(svg(s,w,h))).png().toFile(p);return p;};
const logo=await sharp(`${root}General-assesets/app_logo_white.png`).extract({left:98,top:99,width:828,height:812}).resize(512,512).png().toBuffer(),logoUri=`data:image/png;base64,${logo.toString('base64')}`;
const logoLayer=await graphic('brand',`<image href="${logoUri}" x="626" y="23" width="68" height="68"/>`);
const bg='<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#062A30"/><stop offset="1" stop-color="#0D4548"/></linearGradient></defs><rect width="720" height="1280" fill="url(#bg)"/><circle cx="760" cy="80" r="350" fill="#FFD1B1" opacity=".045"/><circle cx="-80" cy="1200" r="450" fill="#61DDCF" opacity=".06"/>';
const background=await graphic('background',bg);
const plan=[
 {at:0,end:.7,file:'planning-reactions',ss:0},
 {at:.7,end:3.2,file:'speaking-booking'},
 {at:3.2,end:4,file:'planning-reactions',ss:.4},
 {at:4,end:6.1,file:'speaking-agree-v2'},
 {at:6.1,end:7.5,file:'planning-reactions',ss:1.1,hook:true},
 {at:7.5,end:10.4,file:'speaking-itinerary-v2'},
 {at:10.4,end:12.4,file:'planning-reactions',ss:1.8,hook:true},
 {at:12.4,end:14.9,file:'speaking-idea-v2'},
 {at:14.9,end:16.4,file:'planning-reactions',ss:2.4},
 {at:16.4,end:18.5,file:'speaking-save'},
 {at:18.5,end:20,file:'planning-reactions',ss:.5},
 {at:20,end:22.6,app:0,ss:21.7,title:'France → Spain',step:'01 / CREATE YOUR TRIP'},
 {at:22.6,end:24.6,app:0,ss:43.2,title:'Plan your Barcelona days',step:'02 / BUILD YOUR ITINERARY'},
 {at:24.6,end:27,app:0,ss:0,demo:'gallery-barcelona.mp4',speed:4/3,title:'Add your Barcelona photos',step:'03 / MAKE IT YOURS'},
 {at:27,end:28.5,app:0,ss:82.4,title:'Choose your preferences',step:'04 / YOUR TRAVEL STYLE'},
 {at:28.5,end:30.3,app:0,ss:0,demo:'share.png',title:'Bring the girls together',step:'05 / SHARE YOUR TRIP'},
 {at:30.3,end:35,app:1,ss:105.2,title:'One trip. One group chat.',step:'06 / KEEP EVERYONE TOGETHER'},
 {at:35,end:38.5,file:'cafe'},
 {at:38.5,end:40.4,file:'streets'},
 {at:40.4,end:41.8,file:'selfie'},
 {at:41.8,end:43.3,file:'beach'},
 {at:43.3,end:49,file:'sunset-speaking'},
 {at:49,end:56,file:'invitation'},
 {at:56,end:60,card:true}
].map((s,i)=>({...s,ss:s.ss??0,id:String(i+1).padStart(2,'0'),startFrame:Math.round(s.at*30),endFrame:Math.round(s.end*30)}));
save(`${edit}/edit-plan.json`,plan);
const cues=[];
for(const s of spec.dialogues){
 if(s.id.startsWith('cta-')&&s.speaker!=='friend1')continue;
 if(s.id.startsWith('destination-'))continue;
 const m=JSON.parse(readFileSync(`${dir}/elevenlabs/${s.id}.mp3.json`)),a=m.preparedAlignment;
 const words=[];let word='',start=0,end=0;const flush=()=>{if(word)words.push({word,start:s.at+start,end:s.at+end});word='';};
 a.characters.forEach((c,i)=>{if(/\s/.test(c)){flush();return;}if(!word)start=a.character_start_times_seconds[i];word+=c;end=a.character_end_times_seconds[i];});flush();
 let group=[];const add=()=>{if(!group.length)return;let lines=[group.map(w=>w.word).join(' ')];if(lines[0].length>38){const w=lines[0].split(' ');let best=1;for(let i=1;i<w.length;i++)if(Math.abs(w.slice(0,i).join(' ').length-w.slice(i).join(' ').length)<Math.abs(w.slice(0,best).join(' ').length-w.slice(best).join(' ').length))best=i;lines=[w.slice(0,best).join(' '),w.slice(best).join(' ')];}cues.push({start:group[0].start,end:Math.min(s.at+s.slot,group.at(-1).end+.1),text:lines.join('\n'),speaker:s.speaker,id:s.id});group=[];};
 for(const w of words){if(group.length&&(group.map(v=>v.word).join(' ').length+w.word.length>56||w.start-group.at(-1).end>.45))add();group.push(w);if(/[.!?]$/.test(w.word)||group.length>=8)add();}add();
}
cues.sort((a,b)=>a.start-b.start);
save(`${work}/captions.json`,cues);
const stamp=t=>{const ms=Math.round(t*1000);return`${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
writeFileSync(`${work}/captions.srt`,cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
for(let i=0;i<cues.length;i++){const c=cues[i],lines=c.text.split('\n'),h=lines.length===2?90:58;c.graphic=await graphic(`caption-${i}`,rect(0,0,644,h,'#071F27',14)+lines.map((l,j)=>text(322,36+j*33,l,27,'#FFFFFF',600)).join(''),644,h);c.height=h;}
const hook=await graphic('hook',rect(55,835,610,130,'#092C33',24)+text(360,885,'Another girls’ trip',33)+text(360,933,'stuck in the group chat?',32));
const memories=await graphic('memories',rect(54,860,612,121,'#092C33',23)+text(360,909,'Less planning stress.',34)+text(360,953,'More moments like this.',34));
const stores=[];for(const f of ['AppleStoreLogo','PlayStoreLogo']){const b=readFileSync(`${root}artifacts/group-trip-en/revision-02/${f}-transparent.png`);stores.push(`data:image/png;base64,${b.toString('base64')}`);}
const card=await graphic('endcard',bg+text(360,267,'Make the girls’',46)+text(360,329,'trip happen.',46)+`<image href="${logoUri}" x="233" y="410" width="254" height="254"/>`+text(360,772,'Download Tips to Trip now.',33)+`<image href="${stores[0]}" x="78" y="855" width="270" height="81"/><image href="${stores[1]}" x="372" y="855" width="270" height="81"/>`+text(360,1045,'tipstotrip.com',27,'#B7EADD',500));
const scriptHash=createHash('sha256').update(readFileSync(new URL(import.meta.url))).update(JSON.stringify(cues)).digest('hex');
for(const s of plan){
 if(process.argv.includes('--available-only')&&s.file&&!existsSync(`${dir}/${s.file}.mp4`))continue;
 const output=`${edit}/shots/${s.id}.mp4`,sig=createHash('sha256').update(scriptHash+JSON.stringify(s)).digest('hex');
 if(process.argv.includes('--audio-only')){if(!existsSync(output))throw new Error(`Missing rendered shot ${s.id}`);continue;}
 const onlyShots=process.argv.find(a=>a.startsWith('--only-shots='))?.slice(13).split(',');
 if(onlyShots&&!onlyShots.includes(s.id)){if(!existsSync(output))throw new Error(`Missing rendered shot ${s.id}`);continue;}
 if(existsSync(output)&&existsSync(output+'.sha256')&&readFileSync(output+'.sha256','utf8')===sig)continue;
 const length=(s.endFrame-s.startFrame)/30,args=[];let filter='',inputCount=0;
 if(s.card){args.push('-loop','1','-framerate','30','-i',card);inputCount++;filter='[0:v]setsar=1[v0]';}
 else if(s.still){args.push('-loop','1','-framerate','30','-i',`${dir}/${s.still}`);inputCount++;filter='[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1[v0]';}
 else if(s.app!==undefined){
  args.push('-loop','1','-framerate','30','-i',background);if(s.demo?.endsWith('.png'))args.push('-loop','1','-framerate','30');args.push('-ss',String(s.ss),'-i',s.demo?`${work}/demo/${s.demo}`:`${root}${spec.sourceFiles[s.app]}`);inputCount+=2;
  const panel=await graphic(`app-${s.id}`,text(42,58,s.step,16,'#A7E8DC',600,'start')+text(360,126,s.title,s.title.length>26?34:38)+rect(117,159,486,944,'#04171E',24)+rect(121,163,478,936,'#638987',21));
  args.push('-loop','1','-framerate','30','-i',panel);inputCount++;
  filter=`[0:v][2:v]overlay=0:0[b];[1:v]trim=duration=${length*(s.speed??1)},setpts=(PTS-STARTPTS)/${s.speed??1},fps=30,crop=602:1182:0:52,scale=470:922,setsar=1[app];[b][app]overlay=125:170:shortest=1[v0]`;
  if(s.quotes){
   const q=['Love the first day 🙌','Can we do the beach on Saturday?','Yes! Sunset after?','I’m in ☀️'];
   // Editorial comments are visually separate from the genuine app recording.
   for(let j=0;j<4;j++){const p=await graphic(`quote-${j}`,rect(0,0,604,78,'#D7F2E8',16)+text(302,29,'THE GROUP’S IDEAS',13,'#2C6C64',700)+text(302,57,q[j],j===1?24:26,'#153D3B',600),604,78);args.push('-loop','1','-framerate','30','-i',p);filter+=`;[v${j}][${inputCount}:v]overlay=58:1105:enable='between(t,${.9+j*.9},${.9+(j+1)*.9})'[v${j+1}]`;inputCount++;}
   filter+=';[v4]null[vbase]';
  }
 }else{
  const corrected=`${work}/lipsync/${s.file}.mp4`,file=revision&&existsSync(corrected)?corrected:`${dir}/${s.file}.mp4`;if(!existsSync(file))throw new Error(`Missing generated shot: ${s.file}`);
  args.push('-ss',String(s.ss),'-i',file);inputCount++;
  filter=`[0:v]trim=duration=${length},setpts=PTS-STARTPTS,fps=30,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,tpad=stop_mode=clone:stop_duration=4,trim=duration=${length}${s.at<12?',eq=saturation=0.82:brightness=-.015':''}[v0]`;
 }
 let label=s.quotes?'vbase':'v0';
 args.push('-loop','1','-framerate','30','-i',logoLayer);filter+=`;[${label}][${inputCount}:v]overlay=0:0[vbrand]`;inputCount++;label='vbrand';
 if(s.at===41.8){args.push('-loop','1','-framerate','30','-i',memories);filter+=`;[${label}][${inputCount}:v]overlay=0:0[vmem]`;inputCount++;label='vmem';}
 if(s.hook){args.push('-loop','1','-framerate','30','-i',hook);filter+=`;[${label}][${inputCount}:v]overlay=0:0[vhook]`;inputCount++;label='vhook';}
 const selectedCues=cues.filter(c=>c.start<s.end&&c.end>s.at);
 for(let j=0;j<selectedCues.length;j++){const c=selectedCues[j];args.push('-loop','1','-framerate','30','-i',c.graphic);filter+=`;[${label}][${inputCount}:v]overlay=38:${1190-c.height}:enable='between(t,${Math.max(0,c.start-s.at).toFixed(3)},${Math.min(length,c.end-s.at).toFixed(3)})'[vc${j}]`;inputCount++;label=`vc${j}`;}
 filter+=`;[${label}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[outfinal]`;
 console.log(`Rendering ${s.id}: ${s.at}–${s.end}`);
 ff([...args,'-filter_complex_threads','1','-filter_complex',filter,'-map','[outfinal]','-an','-frames:v',String(s.endFrame-s.startFrame),'-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_trc','bt709','-color_primaries','bt709',output]);writeFileSync(output+'.sha256',sig);
}
if(process.argv.includes('--available-only')){console.log('Available shots rendered; final assembly waits for remaining generations.');process.exit(0);}
writeFileSync(`${edit}/concat.txt`,plan.map(s=>`file 'shots/${s.id}.mp4'`).join('\n'));
// Construct audio separately. Video filter timing must never reset the soundtrack.
const speech=`${edit}/dialogue.wav`,inputs=spec.dialogues.flatMap(s=>['-i',`${dir}/elevenlabs/${s.id}.wav`]);
const speechChains=spec.dialogues.map((s,i)=>`[${i}:a]volume=${s.id.startsWith('cta-')?.48:1},adelay=${Math.round(s.at*1000)}:all=1[a${i}]`);
ff([...inputs,'-filter_complex',speechChains.join(';')+';'+spec.dialogues.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${spec.dialogues.length}:normalize=0,apad,atrim=duration=60,asetpts=N/SR/TB[a]`,'-map','[a]','-ar','48000','-ac','1','-c:a','pcm_s24le',speech]);
const mix=`${edit}/final-mix.wav`;
const audioInputs=['-i',speech,'-i',`${dir}/elevenlabs/music-tension.mp3`,'-i',`${dir}/elevenlabs/music-adventure.mp3`];
const chain='[0:a]loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[voice][key];[1:a]aresample=48000,atrim=duration=12,loudnorm=I=-32:TP=-9:LRA=8,afade=t=in:d=0.3,afade=t=out:st=11.2:d=0.8,apad,atrim=duration=60[tension];[2:a]aresample=48000,atrim=duration=48,loudnorm=I=-28:TP=-8:LRA=8,afade=t=in:d=0.4,afade=t=out:st=44:d=4,adelay=12000:all=1,apad,atrim=duration=60[adventure];[tension][adventure]amix=inputs=2:normalize=0[music];[music][key]sidechaincompress=threshold=0.025:ratio=6:attack=15:release=260[ducked];[voice][ducked]amix=inputs=2:normalize=0:duration=first[sum]';
const measured=run('ffmpeg',['-hide_banner',...audioInputs,'-filter_complex',chain+';[sum]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]','-map','[a]','-f','null','-']).stderr;
const m=JSON.parse(measured.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const norm=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
ff([...audioInputs,'-filter_complex',chain+`;[sum]${norm},aresample=48000,apad,atrim=duration=60,asetpts=N/SR/TB[a]`,'-map','[a]','-ar','48000','-ac','2','-c:a','pcm_s24le',mix]);
save(`${edit}/mix-settings.json`,{dialogueTargetLUFS:-16,musicTargetLUFS:-28,duckingRatio:6,finalTargetLUFS:-16,truePeakTarget:-1.5,measured:m,audioRenderedSeparately:true});
const output=`${dir}/tips-to-trip-girls-trip-barcelona-en-60s.mp4`;
ff(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',mix,'-i',`${work}/captions.srt`,'-map','0:v','-map','1:a','-map','2:s','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-c:s','mov_text','-metadata:s:a:0','language=eng','-metadata:s:s:0','language=eng','-disposition:s:0','0','-t','60','-movflags','+faststart',output]);
console.log(output);
