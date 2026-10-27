import sharp from 'sharp';
import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';
import{spawnSync}from'node:child_process';
import{createHash}from'node:crypto';
import{fileURLToPath}from'node:url';
import{dir,root,esc,text,prepare,mapScreen,listScreen,statusScreen,profileScreen,requestScreen,requestsScreen,activityScreen}from'./meet-buddy-demo.mjs';
const edit=`${dir}/edit`,frames=`${edit}/frames`;mkdirSync(frames,{recursive:true});
const spec=JSON.parse(readFileSync(`${root}scripts/meet-buddy-english.json`));
const performanceApproved=existsSync(`${dir}/performance-approval.json`)&&JSON.parse(readFileSync(`${dir}/performance-approval.json`)).approved===true;
const revision=process.argv.find(v=>v.startsWith('--revision='))?.split('=')[1];
if(revision&&!/^[a-z0-9-]+$/.test(revision))throw new Error('Invalid revision name');
const output=`${dir}/tips-to-trip-meet-buddy-travel-status-en-60s${revision?'-'+revision:''}${performanceApproved?'':'-review-draft'}.mp4`;
const svg=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280">${s}</svg>`;
const rect=(x,y,w,h,fill,r=20)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${r}"/>`;
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:12*1024*1024});if(r.status!==0)throw new Error(`${cmd} media stage failed: ${r.stderr.slice(-2000)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const performance=existsSync(`${dir}/performance-selection.json`)?JSON.parse(readFileSync(`${dir}/performance-selection.json`)):null;
const inputOffsets=performance?.inputOffsets??[0,15,30,48];
const scenes=[
 {id:'01-idea',at:0,end:4.8,layout:'full',title:'WHAT ARE YOU DOING?',sub:'WHO ELSE WANTS TO JOIN?',kind:'map'},
 {id:'02-discover',at:4.8,end:9.6,layout:'side',title:'Meet Buddy',sub:'Discover travellers around you.',kind:'map',side:['See who’s nearby.','See what they’re doing.','Find your next plan.']},
 {id:'03-list',at:9.6,end:15,layout:'app',title:'Your people are nearby.',sub:'Meet Buddy · Map or list',kind:'list'},
 {id:'04-update-status',at:15,end:22.1,layout:'side',title:'Share what you’re doing.',sub:'Travel Status · Your plan, right now.',kind:'status',side:['Open your profile.','Update your status.','Tap Save.']},
 {id:'05-live-status',at:22.1,end:24.4,layout:'side',title:'Your plan is on the map.',sub:'Travel Status · Weligama Beach · 5:00 PM',kind:'live-map',side:['A plan.','A place.','A moment to meet.']},
 {id:'06-coffee',at:24.4,end:25.4,layout:'app',title:'Coffee?',sub:'A quick chat. A new connection.',kind:'coffee'},
 {id:'07-yoga',at:25.4,end:26.3,layout:'app',title:'Yoga?',sub:'Find someone with a similar plan.',kind:'yoga'},
 {id:'08-sunset',at:26.3,end:27,layout:'app',title:'Sunset?',sub:'Some moments are better shared.',kind:'sunset'},
 {id:'09-find-match',at:27,end:30,layout:'app',title:'Find your kind of plan.',sub:'Surfing · Weligama Beach · 5:00 PM',kind:'surf'},
 {id:'10-same-moment',at:30,end:34.83,layout:'side',title:'Same place. Same interest.',sub:'Same moment.',kind:'match',side:['Weligama Beach.','Surfing at 5:00 PM.','Someone keen to join.']},
 {id:'11-profile',at:34.83,end:37.37,layout:'side',title:'Start with their profile.',sub:'Meet Buddy · Get to know your buddy.',kind:'profile',side:['Their introduction.','Their distance.','Their current plan.']},
 {id:'12-request',at:37.37,end:39.8,layout:'side',title:'Make the first move.',sub:'Send a Meet Buddy request with a note.',kind:'request',side:['A friendly hello.','A shared activity.','A simple request.']},
 {id:'13-sent',at:39.8,end:40.1,layout:'side',title:'Request sent.',sub:'Your next connection starts here.',kind:'sent',side:['Request sent.','Awaiting response.','A plan to share.']},
 {id:'14-manage',at:40.1,end:43,layout:'side',title:'Keep your requests together.',sub:'Received · Accepted · Sent · Blocked',kind:'requests',side:['Check Sent.','Await their response.','Stay organised.']},
 {id:'15-request-pause',at:43,end:48,layout:'app',title:'DISCOVER. CONNECT. MEET.',sub:'Your Meet Buddy requests, in one place.',kind:'requests'},
 {id:'16-different-plans',at:48,end:55.77,layout:'side',title:'Every traveller has a plan.',sub:'One network. So many possibilities.',kind:'regional',side:['Surfing. Coffee. Yoga.','Hiking. Sunset. Food.','Find your people.']},
 {id:'17-fast-status',at:55.77,end:56.17,layout:'app',title:'Your activity.',sub:'Share your Travel Status.',kind:'surf'},
 {id:'18-fast-nearby',at:56.17,end:56.57,layout:'app',title:'Your moment.',sub:'Discover a traveller nearby.',kind:'live-map'},
 {id:'19-fast-profile',at:56.57,end:56.97,layout:'app',title:'Your people.',sub:'Open their profile.',kind:'profile'},
 {id:'20-fast-request',at:56.97,end:57.37,layout:'app',title:'Find your buddy.',sub:'Send a Meet Buddy request.',kind:'request'},
 {id:'21-brand-close',at:57.37,end:60,layout:'end',title:'MEET BUDDY',sub:'Your activity. Your moment. Your people.'}
];
if(performance){
 const updates={'01-idea':{end:5.73},'02-discover':{at:5.73,end:11},'03-list':{at:11},'04-update-status':{layout:'app'},'05-live-status':{layout:'app'},'10-same-moment':{end:35.5},'11-profile':{at:35.5,end:38.2},'12-request':{at:38.2,end:40.63},'13-sent':{at:40.63,end:41.2},'14-manage':{at:41.2,end:43.5},'15-request-pause':{at:43.5,end:46.5},'16-different-plans':{at:46.5,end:55.1},'17-fast-status':{at:55.1,end:55.57},'18-fast-nearby':{at:55.57,end:56.03},'19-fast-profile':{at:56.03,end:56.5},'20-fast-request':{at:56.5,end:57},'21-brand-close':{at:57}};
 for(const s of scenes)Object.assign(s,updates[s.id]??{});
}
// Quantize edits once to whole frames. Keep the fourth driving performance at
// 48 seconds, preserving the short reading pause after the request journey.
for(const s of scenes){s.startFrame=Math.round(s.at*30);s.endFrame=Math.round(s.end*30);s.at=s.startFrame/30;s.end=s.endFrame/30;s.duration=s.end-s.at;s.part=s.at>=inputOffsets[3]?4:s.at>=30?3:s.at>=15?2:1;}
writeFileSync(`${edit}/edit-plan.json`,JSON.stringify(scenes,null,2));
const words=[];
for(let i=1;i<=4;i++){
 if(performance){words.push(...performance.segments[i-1].words.map(w=>({...w,start:w.start+inputOffsets[i-1],end:w.end+inputOffsets[i-1]})));continue;}
 const m=JSON.parse(readFileSync(`${dir}/elevenlabs/segment-0${i}.json`)),a=m.preparedAlignment??m.alignment;let w='',first=0,last=0;
 const flush=()=>{if(w)words.push({start:first+inputOffsets[i-1],end:last+inputOffsets[i-1],word:w});w='';};
 a.characters.forEach((c,n)=>{if(/\s/.test(c)){flush();return;}if(!w)first=a.character_start_times_seconds[n];w+=c;last=a.character_end_times_seconds[n];});flush();
}
const cues=[];let group=[];
const add=()=>{if(!group.length)return;const sentence=group.map(w=>w.word).join(' ');let lines=[sentence];if(sentence.length>42){let parts=sentence.split(' '),best=1;for(let n=1;n<parts.length;n++)if(Math.abs(parts.slice(0,n).join(' ').length-parts.slice(n).join(' ').length)<Math.abs(parts.slice(0,best).join(' ').length-parts.slice(best).join(' ').length))best=n;lines=[parts.slice(0,best).join(' '),parts.slice(best).join(' ')];}cues.push({start:group[0].start,end:Math.min(60,group.at(-1).end),text:lines.join('\n')});group=[];};
for(const w of words){if(group.length&&(w.start-group.at(-1).end>.5||group.map(x=>x.word).join(' ').length+w.word.length>67))add();group.push(w);if(/[?.!]$/.test(w.word)||group.length>=8)add();}add();
const stamp=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
writeFileSync(`${dir}/captions.json`,JSON.stringify(cues,null,2));writeFileSync(`${dir}/captions.srt`,cues.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
function cap(t){const c=cues.find(c=>t>=c.start&&t<c.end);if(!c)return '';const lines=c.text.split('\n'),y=lines.length===2?1080:1110;return rect(28,y,624,lines.length===2?91:61,'#153B32',14)+lines.map((l,i)=>text(340,y+37+i*32,l,25,'white',700,'middle')).join('');}
await prepare();
const logo=await sharp(`${root}${spec.logo}`).extract({left:98,top:99,width:828,height:812}).resize(512,512).png().toBuffer();
const logoUri=`data:image/png;base64,${logo.toString('base64')}`;
const stores=[];for(const f of ['AppleStoreLogo','PlayStoreLogo'])stores.push(await sharp(`${root}General-assesets/${f}.png`).extract({left:29,top:220,width:542,height:162}).resize(262,79).png().toBuffer());
function branding(){return `<defs><clipPath id="brandClip"><circle cx="636" cy="84" r="58"/></clipPath></defs><image x="578" y="26" width="116" height="116" href="${logoUri}" clip-path="url(#brandClip)"/>`;}
function appFor(s,t){const local=t-s.at;switch(s.kind){case'map':return mapScreen(local,{zoom:s.at>0});case'list':return listScreen(local,s.duration);case'status':return statusScreen(local);case'live-map':return mapScreen(local,{status:true});case'coffee':return activityScreen(1);case'yoga':return activityScreen(2);case'sunset':return activityScreen(3);case'surf':return activityScreen(0);case'match':return mapScreen(local,{status:true,selected:local>4});case'profile':return profileScreen();case'request':return requestScreen(local);case'sent':return profileScreen(true);case'requests':return requestsScreen();case'regional':return mapScreen(local,{regional:true});default:return null;}}
const renderSignature=createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).update(readFileSync(`${root}scripts/meet-buddy-demo.mjs`)).update(JSON.stringify(cues)).update(JSON.stringify(scenes)).update(JSON.stringify(performance)).digest('hex');
const reuseFrames=existsSync(`${edit}/frames.sha256`)&&readFileSync(`${edit}/frames.sha256`,'utf8')===renderSignature&&existsSync(`${frames}/001799.png`);
if(!process.argv.includes('--mix-only')&&!reuseFrames){
 let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<1800){const n=next++,t=n/30,s=scenes.find(s=>n>=s.startFrame&&n<s.endFrame);let p='',layers=[];
  if(s.layout==='full'){
    p+='<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#102E28" stop-opacity="0"/><stop offset=".6" stop-color="#102E28" stop-opacity=".86"/><stop offset="1" stop-color="#102E28" stop-opacity=".96"/></linearGradient></defs><rect x="0" y="710" width="720" height="570" fill="url(#shade)"/>';
    p+=text(240,818,'WHAT ARE',31,'white',700)+text(240,862,'YOU DOING?',37,'white',700)+text(240,924,'WHO ELSE WANTS',22,'#A5F6D6',700)+text(240,958,'TO JOIN?',27,'#A5F6D6',700);
    const a=await sharp(Buffer.from(appFor(s,t))).resize(178,364).png().toBuffer();layers.push({input:a,left:38,top:662});
  }else if(s.layout==='end'){
    p+=rect(0,0,720,1280,'#F3F9F5',0)+`<circle cx="360" cy="318" r="214" fill="#E0F3EB"/><image x="251" y="209" width="218" height="218" href="${logoUri}"/>`;
    p+=text(360,513,'MEET BUDDY',49,'#114F42',700,'middle')+text(360,594,'Your activity.',35,'#1B5D4D',700,'middle')+text(360,648,'Your moment.',35,'#1B5D4D',700,'middle')+text(360,702,'Your people.',35,'#1B5D4D',700,'middle')+text(360,796,'Right time. Right place. Right tips.',25,'#3C7060',700,'middle')+text(360,843,'Tips are next to you…!!!',24,'#4D7A69',400,'middle');
    stores.forEach((input,i)=>layers.push({input,left:82+i*280,top:921}));
  }else{
    p+=rect(28,43,248,38,'#DDF5E9',19)+text(46,69,s.kind==='status'||s.kind==='live-map'?'TRAVEL STATUS':'SEE WHO’S DOING WHAT',15,'#197565',700)+text(28,162,s.title,s.title.length>30?30:34,'#173F32',700)+text(28,202,s.sub,s.sub.length>44?18:21,'#537769');
    const appOnly=s.layout==='app',w=appOnly?416:396,h=Math.round(w*1236/604),x=appOnly?142:28,y=appOnly?213:244;
    p+=rect(x-5,y-5,w+10,h+10,'#C4DED2',28);
    const a=await sharp(Buffer.from(appFor(s,t))).resize(w,h).png().toBuffer();layers.push({input:a,left:x,top:y});
    if(!appOnly){p+='<rect x="453" y="244" width="244" height="437" rx="22" fill="none" stroke="#B8D9C9" stroke-width="4"/>';s.side.forEach((v,i)=>p+=text(459,749+i*42,v,v.length>22?16:18,i===0?'#147461':'#466F60',i===0?700:400));p+=text(459,925,'YOUR NEXT',18,'#287A64',700)+text(459,956,'ADVENTURE',23,'#287A64',700);}
  }
  // Composite the phone first and all captions/brand on top. The side-frame
  // background covers only the presenter border, leaving its video visible.
  let canvas=await sharp(Buffer.from(svg(p))).composite(layers).png().toBuffer();
  canvas=await sharp(canvas).composite([{input:Buffer.from(svg((s.layout==='end'?'':branding())+cap(t)))}]).png().toBuffer();
  await sharp(canvas).png().toFile(`${frames}/${String(n).padStart(6,'0')}.png`);
  if(n%180===0)console.log(`Preparing graphics ${Math.round(n/30)} / 60 seconds`);
 }}));writeFileSync(`${edit}/frames.sha256`,renderSignature);
}
if(process.argv.includes('--frames-only'))process.exit(0);
for(const s of scenes){
 const file=`${edit}/${s.id}.mp4`,sig=createHash('sha256').update(JSON.stringify(s)+renderSignature).digest('hex');
 if(process.argv.includes('--mix-only')){if(!existsSync(file))throw new Error(`Missing scene ${s.id}`);continue;}
 if(existsSync(file)&&existsSync(file+'.sha256')&&readFileSync(file+'.sha256','utf8')===sig)continue;
 console.log(`Rendering ${s.id}`);const args=['-f','lavfi','-i',`color=c=0xF3F9F5:s=720x1280:r=30:d=${s.duration}`];let filter='[0:v]setsar=1[out]';
 if(['side','full'].includes(s.layout)){
  args.push('-ss',String(s.at-inputOffsets[s.part-1]),'-i',performance?.segments[s.part-1].video??`${dir}/presenter-segment-0${s.part}.mp4`);
  filter=s.layout==='full'?'[1:v]setpts=PTS-STARTPTS,fps=30,scale=720:1280,setsar=1[out]':'[1:v]setpts=PTS-STARTPTS,fps=30,scale=234:426:force_original_aspect_ratio=increase,crop=234:426,setsar=1[actor];[0:v][actor]overlay=458:249:shortest=1[out]';
 }
 // A side PNG must have a transparent actor window. Its border stays visible.
 args.push('-framerate','30','-start_number',String(s.startFrame),'-i',`${frames}/%06d.png`);const input=s.layout==='side'||s.layout==='full'?2:1;
 filter+=`;[out][${input}:v]overlay=0:0:shortest=1[v]`;
 ff([...args,'-filter_complex',filter,'-map','[v]','-an','-frames:v',String(s.endFrame-s.startFrame),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',file]);writeFileSync(file+'.sha256',sig);
}
writeFileSync(`${edit}/concat.txt`,scenes.map(s=>`file '${s.id}.mp4'`).join('\n'));
const speech=`${edit}/narration.wav`;
const speechInputs=Array.from({length:4},(_,i)=>['-i',performance?.segments[i].audio??`${dir}/elevenlabs/segment-0${i+1}.wav`]).flat();
ff([...speechInputs,'-filter_complex',`[0:a][1:a][2:a]concat=n=3:v=0:a=1[first];[3:a]atrim=duration=${60-inputOffsets[3]},adelay=${(inputOffsets[3]-45)*1000}:all=1[last];[first][last]concat=n=2:v=0:a=1[a]`,'-map','[a]','-ac','1','-ar','48000','-c:a','pcm_s24le',speech]);
const music=`${dir}/elevenlabs/music.mp3`,mix=`${edit}/final-mix.wav`;
const vf='[0:a]loudnorm=I=-16:TP=-2:LRA=9,aresample=48000,asplit=2[voice][key];[1:a]aresample=48000,apad,atrim=duration=60,loudnorm=I=-30:TP=-9:LRA=8,aresample=48000,afade=t=in:d=0.6,afade=t=out:st=57:d=3[music];[music][key]sidechaincompress=threshold=.03:ratio=6:attack=25:release=300[ducked];[voice][ducked]amix=inputs=2:duration=first:normalize=0[amix]';
const measured=run('ffmpeg',['-hide_banner','-i',speech,'-i',music,'-filter_complex',vf+';[amix]loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json[a]','-map','[a]','-f','null','-']).stderr;
const match=measured.match(/\{\s*"input_i"[\s\S]*?\}/);if(!match)throw new Error('Missing mix measurement');const m=JSON.parse(match[0]);
const norm=`loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
ff(['-i',speech,'-i',music,'-filter_complex',vf+`;[amix]${norm},aresample=48000,asetpts=N/SR/TB[a]`,'-map','[a]','-t','60','-c:a','pcm_s24le','-ar','48000',mix]);
ff(['-reinit_filter','0','-f','concat','-safe','0','-i',`${edit}/concat.txt`,'-i',mix,'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-metadata:s:a:0','language=eng','-t','60','-movflags','+faststart',output]);
writeFileSync(`${edit}/mix-settings.json`,JSON.stringify({narration:-16,music:-30,ducking:{threshold:.03,ratio:6,attack:25,release:300},finalTarget:-16,truePeakTarget:-1.5,measurement:m,inputOffsets,finalNarrationFade:false},null,2));
console.log(`Finished ${output}`);
