import{readFileSync,writeFileSync,mkdirSync,existsSync}from'node:fs';
import{spawnSync}from'node:child_process';
const root=new URL('../',import.meta.url).pathname;
const campaign=process.argv.find(x=>x.startsWith('--campaign='))?.slice(11)??'travel';
const spec=JSON.parse(readFileSync(`${root}scripts/${campaign}-buddy-story-english.json`));
const dir=root+spec.directory,qa=`${dir}/qa`,edit=`${dir}/edit`;
mkdirSync(edit,{recursive:true});
const parse=p=>JSON.parse(readFileSync(p));
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:6*1024*1024});if(r.status!==0)throw Error(`Performance preparation failed: ${r.stderr.slice(-1000)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const norm=s=>s.toLowerCase().replace(/\bneela\b/g,'nila').replace(/\bpractice\b/g,'practise').replaceAll('travelers','travellers').replaceAll('traveler','traveller').replaceAll('traveling','travelling').replace(/[^a-z0-9]/g,'');
function energy(file){
 const b=readFileSync(file),out=[];
 for(let i=0;i+320<=b.length;i+=320){let sum=0;for(let j=0;j<320;j+=2)sum+=b.readInt16LE(i+j)**2;out.push(Math.sqrt(sum/160));}return out;
}
function corr(a,b,start,end,lag){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(let i=start;i<Math.min(end,a.length);i++){if(i+lag<0||i+lag>=b.length)continue;const av=a[i],bv=b[i+lag];n++;x+=av;y+=bv;xx+=av*av;yy+=bv*bv;xy+=av*bv;}return(n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));}
function alignmentWords(a){const out=[];let text='',start,end;const flush=()=>{if(text)out.push({text,start,end});text='';};a.characters.forEach((c,i)=>{if(/\s/.test(c)){flush();return;}if(!text)start=a.character_start_times_seconds[i];text+=c;end=a.character_end_times_seconds[i];});flush();return out;}
const nativeReview=parse(`${qa}/native-lipsync-review.json`);if(!nativeReview.approved)throw Error('Review native lip sync before preparing final voices.');
const selection={createdAt:new Date().toISOString(),dialogues:[],policy:'Native speaking takes reviewed before cadence-preserving ElevenLabs conversion. Audio and picture receive matching frame-aligned leading trims and identical speed adjustments where needed.'};
const report={createdAt:new Date().toISOString(),automaticChecksOnly:true,requiresFinalVisualReview:true,dialogues:[]};
for(const s of spec.dialogues){
 const final=parse(`${qa}/${s.id}-final.scribe.json`),sourceFile=`${dir}/elevenlabs/${s.id}.mp3`;
 if(norm(final.text)!==norm(s.text))throw Error(`Spoken wording needs independent review for ${s.id}; expected and transcript retained in campaign files.`);
 let trim=0,speed=1,words=final.words.filter(w=>w.type==='word').map(w=>({text:w.text,start:w.start,end:w.end})),timing;
 if(s.native){
  const source=parse(`${qa}/${s.id}-native.scribe.json`),nativeAlignment=`${qa}/${s.id}-native.alignment.json`,finalAlignment=`${qa}/${s.id}-final.alignment.json`,sw=existsSync(nativeAlignment)?parse(nativeAlignment).words.filter(w=>w.text.trim()):source.words.filter(w=>w.type==='word');
  if(existsSync(finalAlignment))words=parse(finalAlignment).words.filter(w=>w.text.trim()).map(w=>({text:w.text,start:w.start,end:w.end}));
  if(norm(source.text)!==norm(s.text))throw Error(`Native wording needs review for ${s.id}.`);
  for(const[label,file]of[['native',`${qa}/${s.id}-native.wav`],['final',sourceFile]])ff(['-i',file,'-ac','1','-ar','16000','-f','s16le',`${qa}/${s.id}-${label}.pcm`]);
  const a=energy(`${qa}/${s.id}-native.pcm`),b=energy(`${qa}/${s.id}-final.pcm`),windows=[];
  const first=Math.max(0,Math.floor(sw[0].start*100)-10),last=Math.ceil(sw.at(-1).end*100)+10;
  // A very short final fricative can produce a false lag peak. Compare the
  // last phrase in a full overlapping context window rather than a fragment.
  const starts=[];for(let start=first;start<last;start+=200){const use=last-start<100?Math.max(first,last-200):start;if(!starts.includes(use))starts.push(use);}
  for(const start of starts){const end=Math.min(start+200,last);let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=corr(a,b,start,end,lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}windows.push({start:start/100,end:end/100,...best});}
  const sameWords=sw.length===words.length&&sw.every((w,i)=>norm(w.text)===norm(words[i].text));
  const wordDeltas=sameWords?sw.map((w,i)=>({word:w.text,startDelta:words[i].start-w.start,endDelta:words[i].end-w.end})):[];
  timing={envelopeWindows:windows,matchingWordSegmentation:sameWords,wordDeltas,sourceSamples:a.length*160,convertedSamples:b.length*160,sourceSpeechStart:sw[0].start,sourceSpeechEnd:sw.at(-1).end};
  if(windows.some(w=>Math.abs(w.shiftSeconds)>.06||w.correlation<.6))throw Error(`Voice Changer cadence needs review for ${s.id}; no automatic approval.`);
  if(sw.at(-1).end>s.slot-.07){trim=Math.floor(Math.max(0,sw[0].start-.13)*30)/30;speed=Math.max(1,(sw.at(-1).end-trim)/(s.slot-.1));}
  if(speed>1.12)throw Error(`Native performance exceeds the natural edit slot: ${s.id}.`);
  const video=`${edit}/performance-${s.id}.mp4`;
  ff(['-i',`${dir}/native-${s.id}.mp4`,'-vf',`trim=start=${trim},setpts=(PTS-STARTPTS)/${speed},fps=30,tpad=stop_mode=clone:stop_duration=2,trim=duration=${s.slot}`,'-an','-frames:v',String(Math.round(s.slot*30)),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',video]);
 }else{
  const meta=parse(sourceFile+'.json');words=alignmentWords(meta.alignment);speed=Math.max(1,words.at(-1).end/(s.slot-.12));if(speed>1.15)throw Error(`Voiceover needs more breathing room: ${s.id}.`);
 }
 if(s.voiceSegments){
  if(s.native||speed!==1)throw Error('Segmented narration requires off-screen unmodified-speed speech.');
  const seg=s.voiceSegments;
  if(seg.some((x,i)=>x.sourceStart<0||x.sourceEnd<=x.sourceStart||x.targetStart<0||x.targetStart+x.sourceEnd-x.sourceStart>s.slot+1e-6||(i&&x.targetStart<seg[i-1].targetStart+seg[i-1].sourceEnd-seg[i-1].sourceStart)))throw Error(`Invalid narration segments: ${s.id}`);
  const sourcePCM=`${edit}/${s.id}-segments-source.pcm`,targetPCM=`${edit}/${s.id}-segments-timeline.pcm`;
  ff(['-i',sourceFile,'-ar','48000','-ac','1','-f','s16le',sourcePCM]);
  const sourceBytes=readFileSync(sourcePCM),timeline=Buffer.alloc(Math.round(s.slot*48000)*2);
  for(const x of seg){const start=Math.round(x.sourceStart*48000)*2,end=Math.min(sourceBytes.length,Math.round(x.sourceEnd*48000)*2),target=Math.round(x.targetStart*48000)*2;if(end>start)sourceBytes.copy(timeline,target,start,end);}
  writeFileSync(targetPCM,timeline);
  ff(['-f','s16le','-ar','48000','-ac','1','-i',targetPCM,'-c:a','pcm_s16le',`${edit}/audio-${s.id}.wav`]);
  words=words.map(w=>{const x=seg.find(x=>(w.start+w.end)/2>=x.sourceStart&&(w.start+w.end)/2<x.sourceEnd);if(!x)throw Error(`Narration word outside edit segments: ${s.id} ${w.text}`);return {...w,start:w.start-x.sourceStart+x.targetStart,end:w.end-x.sourceStart+x.targetStart};});
 }else ff(['-i',sourceFile,'-af',`atrim=start=${trim},asetpts=PTS-STARTPTS,atempo=${speed},apad,atrim=duration=${s.slot}`,'-ar','48000','-ac','1','-c:a','pcm_s16le',`${edit}/audio-${s.id}.wav`]);
 words=words.map(w=>({...w,text:w.text.replace(/\bpractice\b/ig,'practise').replace(/MeetBuddy/ig,'Meet Buddy').replace(/travelers/ig,'travellers').replace(/traveler\b/ig,'traveller').replace(/traveling/ig,'travelling'),start:Math.max(0,(w.start-trim)/speed),end:Math.max(0,(w.end-trim)/speed)}));
 const row={id:s.id,at:s.at,slot:s.slot,native:s.native,trimSeconds:trim,speed,audioSegments:s.voiceSegments,words,expected:s.text,transcript:final.text,timing};
 selection.dialogues.push(row);report.dialogues.push(row);console.log(`${s.id}: trim ${trim.toFixed(3)}s, tempo ${speed.toFixed(3)}, speech ends ${words.at(-1).end.toFixed(3)}s.`);
}
writeFileSync(`${dir}/performance-selection.json`,JSON.stringify(selection,null,2));writeFileSync(`${qa}/voice-timing.json`,JSON.stringify(report,null,2));
console.log('Performance prepared; final visible review remains required.');
