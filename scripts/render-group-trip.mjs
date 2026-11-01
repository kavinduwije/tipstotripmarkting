import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(readFileSync(`${root}scripts/group-trip-english.json`));
const dir=`${root}${spec.directory}`,revision=process.argv.includes("--revision-02"),work=revision?`${dir}/revision-02`:dir,edit=`${work}/edit`;
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
 {at:0,end:.8,file:'planning-establish',ss:0},
 {at:.8,end:3.6,file:'speaking-hotel',ss:0},
 {at:3.6,end:6.1,file:'speaking-city',ss:0},
 {at:6.1,end:10.6,file:'speaking-messages',ss:0},
 {at:10.6,end:14.1,file:'speaking-table',ss:0},
 {at:14.1,end:18,file:'planning-establish',ss:0,hook:true},
 {at:18,end:18.7,file:'planning-establish',ss:2},
 {at:18.7,end:22.6,file:'speaking-suggest',ss:0},
 {at:22.6,end:25.6,file:'speaking-handle',ss:0},
 {at:25.6,end:26,file:'speaking-suggest',ss:2.5},
 {at:26,end:28.3,file:'speaking-find-out',ss:0},
 {at:28.3,end:30.4,file:'speaking-suggest',ss:1.2},
 {at:30.4,end:31.9,file:'speaking-lisbon-brief',ss:0},
 {at:31.9,end:34.2,app:0,ss:4,title:'Create your trip.',step:'01 / A SHARED START'},
 {at:34.2,end:37.1,app:0,ss:25,title:'Build your itinerary.',step:'02 / YOUR KIND OF TRIP'},
 {at:37.1,end:39.2,file:'speaking-sunset-idea-v3',ss:0},
 {at:39.2,end:42.1,app:0,ss:173.1,title:'See the plan together.',step:'03 / EXAMPLE ITINERARY'},
 {at:42.1,end:44.3,app:0,ss:125.5,title:'Choose your preferences.',step:'04 / FIND YOUR TRAVEL VIBE'},
 {at:44.3,end:46.2,app:0,ss:181.0,title:'Share the adventure.',step:'05 / BRING EVERYONE IN'},
 {at:46.2,end:50.7,app:1,ss:101.5,title:'Keep the chat together.',step:'06 / SAME TRIP. SAME CONVERSATION.',quotes:true},
 {at:50.7,end:51,file:'speaking-suggest',ss:2.5},
 {at:51,end:54.2,file:'speaking-have-plan',ss:0},
 {at:54.2,end:56.5,file:'speaking-agree-v2',ss:0},
 {at:56.5,end:58,file:'speaking-suggest',ss:2.0},
 {at:58,end:63,file:'lisbon-streets',ss:0},
 {at:63,end:67,file:'lisbon-pastries',ss:0},
 {at:67,end:70,file:'lisbon-itinerary',ss:0},
 {at:70,end:73,file:'lisbon-selfie',ss:0},
 {at:73,end:76,file:'lisbon-beach',ss:0},
 {at:76,end:85,file:'sunset-speaking',ss:0},
 {at:85,end:97,file:'next-speaking-seated',ss:0},
 {at:97,end:101,file:'cta-speaking',ss:0},
 {at:101,end:105,card:true}
 ].map((s,i)=>{
 if(revision&&i===13)s={...s,end:35.6,ss:0,demo:'creation.mp4',title:'Create your trip.',step:'01 / SPAIN → LISBON'};
 if(revision&&i===14)s={...s,at:35.6,ss:0,demo:'preferences.mp4',title:'Choose your preferences.',step:'02 / YOUR KIND OF TRIP'};
 if(revision&&i===16)s={...s,ss:0,demo:'itinerary.png',step:'03 / YOUR SHARED ITINERARY'};
 if(revision&&i===17)s={...s,ss:0,demo:'preferences-selected.png'};
 if(revision&&i===18)s={...s,ss:0,demo:'share.png'};
 if(revision&&i===19)s={...s,ss:0,demo:'chat.png',quotes:false};
 if(revision&&[9,11,20,23].includes(i)&&existsSync(`${work}/lipsync/reaction-ben.mp4`))s={...s,file:'reaction-ben',ss:2.5};
 return({...s,id:String(i+1).padStart(2,'0'),startFrame:Math.round(s.at*30),endFrame:Math.round(s.end*30)});
});
save(`${edit}/edit-plan.json`,plan);
const cues=[];
for(const s of spec.dialogues){
 if(s.id.startsWith('cta-')&&s.speaker!=='friend2')continue;
 if(s.id.startsWith('destination-'))continue;
 const m=JSON.parse(readFileSync(`${dir}/elevenlabs/${s.id}.mp3.json`)),a=m.preparedAlignment;
 const words=[];let word='',start=0,end=0;const flush=()=>{if(word)words.push({word,start:s.at+start,end:s.at+end});word='';};
 a.characters.forEach((c,i)=>{if(/\s/.test(c)){flush();return;}if(!word)start=a.character_start_times_seconds[i];word+=c;end=a.character_end_times_seconds[i];});flush();
 let group=[];const add=()=>{if(!group.length)return;let lines=[group.map(w=>w.word).join(' ')];if(lines[0].length>38){const w=lines[0].split(' ');let best=1;for(let i=1;i<w.length;i++)if(Math.abs(w.slice(0,i).join(' ').length-w.slice(i).join(' ').length)<Math.abs(w.slice(0,best).join(' ').length-w.slice(best).join(' ').length))best=i;lines=[w.slice(0,best).join(' '),w.slice(best).join(' ')];}cues.push({start:group[0].start,end:Math.min(s.at+s.slot,group.at(-1).end+.1),text:lines.join('\n'),speaker:s.speaker,id:s.id});group=[];};
 for(const w of words){if(group.length&&(group.map(v=>v.word).join(' ').length+w.word.length>56||w.start-group.at(-1).end>.45))add();group.push(w);if(/[.!?]$/.test(w.word)||group.length>=8)add();}add();
}
cues.push({start:94.2,end:96,text:'Rome! Barcelona!\nJapan! Iceland!',speaker:'group',id:'destinations'});
cues.sort((a,b)=>a.start-b.start);
save(`${work}/captions.json`,cues);
const stamp=t=>{const ms=Math.round(t*1000);return`${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
writeFileSync(`${work}/captions.srt`,cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
for(let i=0;i<cues.length;i++){const c=cues[i],lines=c.text.split('\n'),h=lines.length===2?90:58;c.graphic=await graphic(`caption-${i}`,rect(0,0,644,h,'#071F27',14)+lines.map((l,j)=>text(322,36+j*33,l,27,'#FFFFFF',600)).join(''),644,h);c.height=h;}
const hook=await graphic('hook',rect(62,402,596,186,'#092C33',24)+text(360,457,'Planning a group trip',36)+text(360,508,'shouldn’t feel like this.',36)+text(360,551,'There has to be a better way.',23,'#B7D9D5',400));
const stores=[];for(const f of ['AppleStoreLogo','PlayStoreLogo']){const b=revision?readFileSync(`${work}/${f}-transparent.png`):await sharp(`${root}General-assesets/${f}.png`).extract({left:29,top:220,width:542,height:162}).resize(270,81).png().toBuffer();stores.push(`data:image/png;base64,${b.toString('base64')}`);}
const card=await graphic('endcard',bg+text(360,221,'Turn ‘we should go’',43)+text(360,282,'into ‘remember when?’',43)+`<image href="${logoUri}" x="233" y="393" width="254" height="254"/>`+text(360,752,'Download TipToTrip now.',33,'#FFFFFF',600)+`<image href="${stores[0]}" x="78" y="839" width="270" height="81"/><image href="${stores[1]}" x="372" y="839" width="270" height="81"/>`+text(360,1030,'Less planning chaos.',28,'#B7EADD',500)+text(360,1074,'More memories.',35,'#FFFFFF',700));
if(!revision)save(`${dir}/source-edits.json`,{sourceFiles:spec.sourceFiles,recordingsAltered:false,editorialEdits:plan.filter(s=>s.app!==undefined).map(s=>({timeline:[s.at,s.end],source:spec.sourceFiles[s.app],sourceStart:s.ss,operations:['trim','crop status bar','scale','editorial title','subtitles'],generatedInterface:false})),chatQuotes:{text:spec.chatQuotes,method:'Editorial quote cards outside the native phone screen; illustrative conversation, not a live backend result.'},destination:'Lisbon is the fictional travel story. Native recorded example trip remains unchanged.',generations:{castReference:'cast-master-v2.png',rejectedCastReference:'cast-master.png',failedRequest:'scene01-meltdown.pending.json',replacement:'Short separate audio-driven speaking shots; original failed request retained.'}});
const scriptHash=createHash('sha256').update(readFileSync(new URL(import.meta.url))).update(JSON.stringify(cues)).digest('hex');
for(const s of plan){
 const output=`${edit}/shots/${s.id}.mp4`,sig=createHash('sha256').update(scriptHash+JSON.stringify(s)).digest('hex');
 if(process.argv.includes('--audio-only')){if(!existsSync(output))throw new Error(`Missing rendered shot ${s.id}`);continue;}
 const onlyShots=process.argv.find(a=>a.startsWith('--only-shots='))?.slice(13).split(',');
 if(onlyShots&&!onlyShots.includes(s.id)){if(!existsSync(output))throw new Error(`Missing rendered shot ${s.id}`);continue;}
 if(existsSync(output)&&existsSync(output+'.sha256')&&readFileSync(output+'.sha256','utf8')===sig)continue;
 const length=(s.endFrame-s.startFrame)/30,args=[];let filter='',inputCount=0;
 if(s.card){args.push('-loop','1','-framerate','30','-i',card);inputCount++;filter='[0:v]setsar=1[v0]';}
 else if(s.app!==undefined){
  args.push('-loop','1','-framerate','30','-i',background);if(s.demo?.endsWith('.png'))args.push('-loop','1','-framerate','30');args.push('-ss',String(s.ss),'-i',s.demo?`${work}/demo/${s.demo}`:`${root}${spec.sourceFiles[s.app]}`);inputCount+=2;
  const panel=await graphic(`app-${s.id}`,text(42,58,s.step,16,'#A7E8DC',600,'start')+text(360,126,s.title,s.title.length>26?34:38)+rect(117,159,486,944,'#04171E',24)+rect(121,163,478,936,'#638987',21));
  args.push('-loop','1','-framerate','30','-i',panel);inputCount++;
  filter=`[0:v][2:v]overlay=0:0[b];[1:v]trim=duration=${length},setpts=PTS-STARTPTS,fps=30,crop=602:1182:0:52,scale=470:922,setsar=1[app];[b][app]overlay=125:170:shortest=1[v0]`;
  if(s.quotes){
   const q=['Love the first day 🙌','Can we do the beach on Saturday?','Yes! Sunset after?','I’m in ☀️'];
   // Editorial comments are visually separate from the genuine app recording.
   for(let j=0;j<4;j++){const p=await graphic(`quote-${j}`,rect(0,0,604,78,'#D7F2E8',16)+text(302,29,'THE GROUP’S IDEAS',13,'#2C6C64',700)+text(302,57,q[j],j===1?24:26,'#153D3B',600),604,78);args.push('-loop','1','-framerate','30','-i',p);filter+=`;[v${j}][${inputCount}:v]overlay=58:1105:enable='between(t,${.9+j*.9},${.9+(j+1)*.9})'[v${j+1}]`;inputCount++;}
   filter+=';[v4]null[vbase]';
  }
 }else{
  const corrected=`${work}/lipsync/${s.file}.mp4`,file=revision&&existsSync(corrected)?corrected:`${dir}/${s.file}.mp4`;if(!existsSync(file))throw new Error(`Missing generated shot: ${s.file}`);
  args.push('-ss',String(s.ss),'-i',file);inputCount++;
  filter=`[0:v]trim=duration=${length},setpts=PTS-STARTPTS,fps=30,scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,tpad=stop_mode=clone:stop_duration=2,trim=duration=${length}${s.at<18?',eq=saturation=0.82:brightness=-.015':''}[v0]`;
 }
 let label=s.quotes?'vbase':'v0';
 args.push('-loop','1','-framerate','30','-i',logoLayer);filter+=`;[${label}][${inputCount}:v]overlay=0:0[vbrand]`;inputCount++;label='vbrand';
 if(s.hook){args.push('-loop','1','-framerate','30','-i',hook);filter+=`;[${label}][${inputCount}:v]overlay=0:0:enable='gte(t,1.1)'[vhook]`;inputCount++;label='vhook';}
 const selectedCues=cues.filter(c=>c.start<s.end&&c.end>s.at);
 for(let j=0;j<selectedCues.length;j++){const c=selectedCues[j];args.push('-loop','1','-framerate','30','-i',c.graphic);filter+=`;[${label}][${inputCount}:v]overlay=38:${1190-c.height}:enable='between(t,${Math.max(0,c.start-s.at).toFixed(3)},${Math.min(length,c.end-s.at).toFixed(3)})'[vc${j}]`;inputCount++;label=`vc${j}`;}
 filter+=`;[${label}]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[outfinal]`;
 console.log(`Rendering ${s.id}: ${s.at}–${s.end}`);
 ff([...args,'-filter_complex_threads','1','-filter_complex',filter,'-map','[outfinal]','-an','-frames:v',String(s.endFrame-s.startFrame),'-r','30','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_trc','bt709','-color_primaries','bt709',output]);writeFileSync(output+'.sha256',sig);
}
writeFileSync(`${edit}/concat.txt`,plan.map(s=>`file 'shots/${s.id}.mp4'`).join('\n'));
// Construct audio separately. Video filter timing must never reset the soundtrack.
const speech=`${edit}/dialogue.wav`,inputs=spec.dialogues.flatMap(s=>['-i',`${dir}/elevenlabs/${s.id}.wav`]);
const speechChains=spec.dialogues.map((s,i)=>`[${i}:a]volume=${s.id.startsWith('cta-')?.48:1},adelay=${Math.round(s.at*1000)}:all=1[a${i}]`);
ff([...inputs,'-filter_complex',speechChains.join(';')+';'+spec.dialogues.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${spec.dialogues.length}:normalize=0,apad,atrim=duration=105,asetpts=N/SR/TB[a]`,'-map','[a]','-ar','48000','-ac','1','-c:a','pcm_s24le',speech]);
const notification=`${edit}/notification.wav`;
ff(['-f','lavfi','-i','sine=frequency=880:duration=0.13:sample_rate=48000','-af','volume=0.18,afade=t=out:st=0.025:d=0.105','-ac','1',notification]);
const mix=`${edit}/final-mix.wav`;
const audioInputs=['-i',speech,'-i',`${dir}/elevenlabs/music-tension.mp3`,'-i',`${dir}/elevenlabs/music-adventure.mp3`,'-i',`${dir}/elevenlabs/sigh.mp3`,'-i',`${dir}/elevenlabs/laugh.mp3`,'-i',notification];
const chain='[0:a]loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[voice][key];[1:a]aresample=48000,atrim=duration=17,loudnorm=I=-32:TP=-9:LRA=8,afade=t=in:d=0.4,afade=t=out:st=16:d=1,apad,atrim=duration=105[tension];[2:a]aresample=48000,atrim=duration=87,loudnorm=I=-28:TP=-8:LRA=8,afade=t=in:d=0.5,afade=t=out:st=83:d=4,adelay=18000:all=1,apad,atrim=duration=105[adventure];[tension][adventure]amix=inputs=2:normalize=0[music];[music][key]sidechaincompress=threshold=0.025:ratio=6:attack=15:release=260[ducked];[3:a]loudnorm=I=-26:TP=-9:LRA=7,aresample=48000,adelay=15050:all=1,apad,atrim=duration=105[sigh];[4:a]loudnorm=I=-27:TP=-9:LRA=7,aresample=48000,adelay=88400:all=1,apad,atrim=duration=105[laugh];[5:a]asplit=3[n0][n1][n2];[n0]adelay=50:all=1[n00];[n1]adelay=3350:all=1[n11];[n2]adelay=5850:all=1[n22];[n00][n11][n22]amix=inputs=3:normalize=0,apad,atrim=duration=105[notify];[voice][ducked][sigh][laugh][notify]amix=inputs=5:normalize=0:duration=first[sum]';
const measured=run('ffmpeg',['-hide_banner',...audioInputs,'-filter_complex',chain+';[sum]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]','-map','[a]','-f','null','-']).stderr;
const m=JSON.parse(measured.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const norm=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
ff([...audioInputs,'-filter_complex',chain+`;[sum]${norm},aresample=48000,apad,atrim=duration=105,asetpts=N/SR/TB[a]`,'-map','[a]','-ar','48000','-ac','2','-c:a','pcm_s24le',mix]);
save(`${edit}/mix-settings.json`,{dialogueTargetLUFS:-16,musicTargetLUFS:-28,duckingRatio:6,finalTargetLUFS:-16,truePeakTarget:-1.5,measured:m,audioRenderedSeparately:true});
const output=revision?`${work}/tips-to-trip-less-planning-more-memories-en-105s-revised.mp4`:`${dir}/tips-to-trip-less-planning-more-memories-en-105s.mp4`;
ff(['-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',mix,'-i',`${work}/captions.srt`,'-map','0:v','-map','1:a','-map','2:s','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-c:s','mov_text','-metadata:s:a:0','language=eng','-metadata:s:s:0','language=eng','-disposition:s:0','0','-t','105','-movflags','+faststart',output]);
console.log(output);
