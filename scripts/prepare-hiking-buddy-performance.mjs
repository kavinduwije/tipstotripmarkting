import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{spawnSync}from'node:child_process';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(readFileSync(`${root}scripts/hiking-buddy-spanish.json`));
const dir=root+spec.directory,qa=`${dir}/qa`,edit=`${dir}/edit`;
mkdirSync(edit,{recursive:true});
const parse=p=>JSON.parse(readFileSync(p));
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:6*1024*1024});if(r.status!==0)throw Error(`Performance preparation failed: ${r.stderr.slice(-1000)}`);return r;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const norm=s=>s.toLowerCase().replaceAll('travelers','travellers').replaceAll('traveler','traveller').replaceAll('traveling','travelling').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
function energy(file){
 const b=readFileSync(file),out=[];
 for(let i=0;i+320<=b.length;i+=320){let sum=0;for(let j=0;j<320;j+=2)sum+=b.readInt16LE(i+j)**2;out.push(Math.sqrt(sum/160));}return out;
}
function corr(a,b,start,end,lag){let n=0,x=0,y=0,xx=0,yy=0,xy=0;for(let i=start;i<Math.min(end,a.length);i++){if(i+lag<0||i+lag>=b.length)continue;const av=a[i],bv=b[i+lag];n++;x+=av;y+=bv;xx+=av*av;yy+=bv*bv;xy+=av*bv;}return(n*xy-x*y)/Math.sqrt((n*xx-x*x)*(n*yy-y*y));}
function alignmentWords(a){const out=[];let text='',start,end;const flush=()=>{if(text)out.push({text,start,end});text='';};a.characters.forEach((c,i)=>{if(/\s/.test(c)){flush();return;}if(!text)start=a.character_start_times_seconds[i];text+=c;end=a.character_end_times_seconds[i];});flush();return out;}
function scriptPunctuation(words,script){const expected=script.split(/\s+/);let pos=0;return words.map(w=>{let n=1;while(n<=3&&norm(expected.slice(pos,pos+n).join(' '))!==norm(w.text))n++;if(n>3)throw Error('Caption wording cannot be aligned with the verified script.');const text=expected.slice(pos,pos+n).join(' ');pos+=n;return{...w,text};});}
const nativeReview=parse(`${qa}/native-lipsync-review.json`);if(!nativeReview.approved)throw Error('Review native lip sync before preparing final voices.');
const selection={createdAt:new Date().toISOString(),dialogues:[],policy:'Native speaking takes reviewed before cadence-preserving ElevenLabs conversion. Audio and picture receive matching frame-aligned leading trims and identical speed adjustments where needed.'};
const report={createdAt:new Date().toISOString(),automaticChecksOnly:true,requiresFinalVisualReview:true,dialogues:[]};
for(const s of spec.dialogues){
 const final=parse(`${qa}/${s.id}-final.scribe.json`),sourceFile=`${dir}/elevenlabs/${s.voiceFile??`${s.id}.mp3`}`;
 if(norm(final.text)!==norm(s.text))throw Error(`Spoken wording needs independent review for ${s.id}; expected and transcript retained in campaign files.`);
 let trim=0,speed=1,words=final.words.filter(w=>w.type==='word').map(w=>({text:w.text,start:w.start,end:w.end})),timing;
 if(s.native){
  const source=parse(`${qa}/${s.id}-native.scribe.json`),sw=source.words.filter(w=>w.type==='word');
  if(norm(source.text)!==norm(s.text))throw Error(`Native wording needs review for ${s.id}.`);
  for(const[label,file]of[['native',`${qa}/${s.id}-native.wav`],['final',sourceFile]])ff(['-i',file,'-ac','1','-ar','16000','-f','s16le',`${qa}/${s.id}-${label}.pcm`]);
  const a=energy(`${qa}/${s.id}-native.pcm`),b=energy(`${qa}/${s.id}-final.pcm`),windows=[];
  for(let start=Math.max(0,Math.floor(sw[0].start*100)-10);start<sw.at(-1).end*100;start+=200){let best={correlation:-1,shiftSeconds:0};for(let lag=-20;lag<=20;lag++){const c=corr(a,b,start,Math.min(start+200,Math.ceil(sw.at(-1).end*100)+10),lag);if(c>best.correlation)best={correlation:c,shiftSeconds:lag/100};}windows.push({start:start/100,...best});}
  const sameWords=sw.length===words.length&&sw.every((w,i)=>norm(w.text)===norm(words[i].text));
  const wordDeltas=sameWords?sw.map((w,i)=>({word:w.text,startDelta:words[i].start-w.start,endDelta:words[i].end-w.end})):[];
  timing={envelopeWindows:windows,matchingWordSegmentation:sameWords,wordDeltas,sourceSamples:a.length*160,convertedSamples:b.length*160,sourceSpeechStart:sw[0].start,sourceSpeechEnd:sw.at(-1).end};
  if(windows.some(w=>Math.abs(w.shiftSeconds)>.06||w.correlation<.6))throw Error(`Voice Changer cadence needs review for ${s.id}; no automatic approval.`);
  if(sw.at(-1).end>s.slot-.07){trim=Math.floor(Math.max(0,sw[0].start-.13)*30)/30;speed=Math.max(1,(sw.at(-1).end-trim)/(s.slot-.1));}
  if(speed>1.12)throw Error(`Native performance exceeds the natural edit slot: ${s.id}.`);
  const video=`${edit}/performance-${s.id}.mp4`;
  ff(['-i',`${dir}/${s.nativeFile??`native-${s.id}.mp4`}`,'-vf',`trim=start=${trim},setpts=(PTS-STARTPTS)/${speed},fps=30,tpad=stop_mode=clone:stop_duration=2,trim=duration=${s.slot}`,'-an','-frames:v',String(Math.round(s.slot*30)),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',video]);
 }else{
  const meta=parse(sourceFile+'.json');if(s.captionTiming!=='scribe')words=alignmentWords(meta.alignment);speed=Math.max(s.playbackSpeed??1,words.at(-1).end/(s.slot-.12));if(speed>1.15)throw Error(`Voiceover needs more breathing room: ${s.id}.`);
 }
 ff(['-i',sourceFile,'-af',`atrim=start=${trim},asetpts=PTS-STARTPTS,atempo=${speed},apad,atrim=duration=${s.slot}`,'-ar','48000','-ac','1','-c:a','pcm_s16le',`${edit}/audio-${s.id}.wav`]);
 for(const o of s.captionWordOverrides??[]){if(o.start!==undefined)words[o.index].start=o.start;if(o.end!==undefined)words[o.index].end=o.end;}
 words=scriptPunctuation(words,s.text).map(w=>({...w,start:Math.max(0,(w.start-trim)/speed),end:Math.max(0,(w.end-trim)/speed)}));
 const row={id:s.id,at:s.at,slot:s.slot,native:s.native,trimSeconds:trim,speed,words,expected:s.text,transcript:final.text,timing};
 selection.dialogues.push(row);report.dialogues.push(row);console.log(`${s.id}: trim ${trim.toFixed(3)}s, tempo ${speed.toFixed(3)}, speech ends ${words.at(-1).end.toFixed(3)}s.`);
}
writeFileSync(`${dir}/performance-selection.json`,JSON.stringify(selection,null,2));writeFileSync(`${qa}/voice-timing.json`,JSON.stringify(report,null,2));
console.log('Performance prepared; final visible review remains required.');
