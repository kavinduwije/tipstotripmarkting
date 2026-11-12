import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access,copyFile,rename} from 'node:fs/promises';
import {config,higgsfield,APIError} from '@higgsfield/client/v2';

const root=new URL('../',import.meta.url).pathname;
const dir=root+'artifacts/countries-kling4-en';
const stage=process.argv[2]??'status';
const model='kling-video/v4.0/text-to-video';
const scenes=[
 {name:'Spain',duration:4,scene:'Montserrat, Catalonia, Spain. A real-world aerial view of the Santa Maria de Montserrat monastery, pale stone monastery buildings nestled against enormous serrated ochre conglomerate mountain spires, green Mediterranean vegetation below, clear blue sky. A slow stabilized drone push forward and slightly upward reveals the monastery and dramatic mountain backdrop. Warm late-afternoon sunshine, geographically coherent architecture.'},
 {name:'France',duration:6,scene:'Paris, France. A picturesque aerial view of the white Sacre-Coeur basilica on Montmartre, its central dome and smaller domes beautifully visible above authentic Parisian pale stone buildings and zinc rooftops, distant city skyline in soft haze. Slow stabilized drone glide sideways and gently forward, maintaining the basilica in the central portrait composition. Soft warm morning sunshine, realistic architectural proportions.'},
 {name:'Portugal',duration:4,scene:'Lisbon, Portugal. The grand pale limestone Arco da Rua Augusta triumphal arch at Praca do Comercio, framed by elegant ochre yellow buildings with terracotta rooftops; sunlit patterned square below and clear blue sky above. Slow smooth drone push toward the arch from above the square. The arch and its rooftop statuary remain sharp and central. Bright natural afternoon sunshine.'},
 {name:'Sri Lanka',duration:4,scene:'Colombo, Sri Lanka. The distinctive Colombo Lotus Tower rises above the tropical city beside Beira Lake: a slender tall magenta pink stem, green lotus petal crown beneath the purple bulb, narrow antenna above, with modern skyline and lush trees below. Slow stabilized aerial lateral glide with realistic subtle parallax, keeping the complete recognizable tower central and well within frame. Beautiful tropical late-afternoon light, soft natural atmospheric haze.'},
 {name:'Italy',duration:6,scene:'Milan, Italy. The authentic Duomo di Milano Gothic cathedral with elaborate white marble spires and its broad cathedral square. The bronze equestrian monument of Vittorio Emanuele II appears in the near foreground on a stone pedestal, with the cathedral behind. Slow stabilized cinematic drone glide gently upward and forward, maintaining a strong layered composition. Warm golden evening light, a few tiny naturally moving adult visitors in the distance.'},
 {name:'Germany',duration:15,scene:'Dresden, Germany. A magnificent aerial glide over the restored historic old town, the great stone dome of the Frauenkirche behind the glass dome of the Dresden Academy of Fine Arts crowned by the golden winged figure of Pheme. Detailed red tile roofs and authentic baroque pale sandstone facades, a subtle glimpse of the Elbe skyline. One continuous smooth slow drone arc to the right with gentle forward motion over the full fifteen seconds, natural consistent parallax and sunlight. Warm late-afternoon light, stable landmark geometry.'}
];
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const save=(p,x)=>writeFile(p,JSON.stringify(x,null,2));
for(const x of ['','generations','clean','qa','exports','elevenlabs','edit'])await mkdir(dir+'/'+x,{recursive:true});
loadEnvFile(root+'.env.local');
if(!process.env.HF_CREDENTIALS)throw Error('Configure HF_CREDENTIALS locally in .env.local.');
config({credentials:process.env.HF_CREDENTIALS,maxRetries:0});
await save(dir+'/brief.json',{model,scenes,width:720,height:1280,fps:30,duration:42,sourcePolicy:'New AI-generated destination scenery from text. Original stock files and failed cleanup drafts preserved. No watermarked frame is used as a generation reference.',countryTitles:{holdSeconds:2,fadeOutSeconds:.35},sound:'Cached ElevenLabs instrumental and closing narration only; no transition effects.',closingText:['DOWNLOAD','Tips to Trip','NOW'],references:['https://console.higgsfield.ai/models/kling-video/v4.0/text-to-video/api-reference','https://docs.higgsfield.ai/docs/how-to/sdk']});
async function submit(s){
 const p=dir+'/generations/'+s.name+'.pending.json';
 if(await exists(p)){
  const old=JSON.parse(await readFile(p));
  if(process.argv.includes('--retry-credit-rejection')&&old.status==='submission_rejected'&&old.httpStatus===403&&!old.request_id){
   await rename(p,dir+'/generations/'+s.name+'.credit-rejection-'+Date.now()+'.json');
  }else if(process.argv.includes('--retry-confirmed-dns-failure')&&s.name==='Spain'&&old.status==='submission_ambiguous'&&!old.request_id){
   await rename(p,dir+'/generations/Spain.sandbox-dns-failure.json');
   await save(dir+'/qa/network-retry.json',{reason:'Initial sandbox request failed immediately. Independent API preflight returned ENOTFOUND. No request ID or status URL was returned. Retrying once with network escalation; original failure retained.',at:new Date().toISOString()});
  }else{console.log(s.name+': existing request retained');return;}
 }
 const input={prompt:'Premium photorealistic tourism commercial footage. Vertical portrait 9:16 composition, natural true-to-life colors, superb fine architectural detail, convincing optical depth and physically realistic movement. '+s.scene+' One unbroken camera shot, no cuts, no speed ramps, no artificial zoom, no warping or morphing buildings. Reserve breathing room around the main landmark. No title, captions, typography, logos, watermark, frames, borders or interface. No narration, dialogue or music.',duration:s.duration,resolution:'1080p',aspect_ratio:'9:16'};
 await save(p,{status:'submission_started',model,input,at:new Date().toISOString()});
 try{const r=await higgsfield.subscribe(model,{input,withPolling:false});await save(p,{...r,model,input});console.log(s.name+': '+r.status+'; request saved');}
 catch(e){const code=e instanceof APIError?e.statusCode:undefined;const errorType=e.name,networkCode=/^(ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT)$/.test(e.code??'')?e.code:undefined;await save(p,{status:code?'submission_rejected':'submission_ambiguous',httpStatus:code,errorType,networkCode,model,input});throw Error(s.name+': '+(code?'Higgsfield HTTP '+code:networkCode??errorType??'uncertain submission')+'; saved state retained.');}
}
async function status(s){
 const p=dir+'/generations/'+s.name+'.pending.json';if(!await exists(p)){console.log(s.name+': not submitted');return;}
 const j=JSON.parse(await readFile(p));const final=dir+'/generations/'+s.name+'.json';
 let r=await exists(final)?JSON.parse(await readFile(final)):j;
 if(r.status!=='completed'){
  if(!j.status_url){console.log(s.name+': '+j.status);return;}
  let res;try{res=await fetch(j.status_url,{headers:{Authorization:'Key '+process.env.HF_CREDENTIALS},signal:AbortSignal.timeout(45000)});}catch{throw Error(s.name+': status network error; no duplicate submission.');}
  if(!res.ok)throw Error(s.name+': status HTTP '+res.status);
  const raw=await res.json();r={...j,...raw};
  if(['completed','failed','nsfw','canceled'].includes(r.status))await save(final,r);else await save(p,r);
 }
 console.log(s.name+': '+r.status);
 if(r.status==='completed'&&r.video?.url&&!await exists(dir+'/clean/'+s.name+'.mp4')){
  const res=await fetch(r.video.url,{signal:AbortSignal.timeout(180000)});if(!res.ok)throw Error(s.name+': download HTTP '+res.status);
  await writeFile(dir+'/clean/'+s.name+'.mp4',Buffer.from(await res.arrayBuffer()));console.log(s.name+': downloaded');
 }
}
try{
 if(stage==='submit'){for(const s of scenes)await submit(s);}
 else if(stage==='status'){for(const s of scenes)await status(s);}
 else if(stage==='prepare'){
  for(const n of ['download.mp3','download.mp3.json','download.scribe.json','music.mp3','music.mp3.json'])await copyFile(root+'artifacts/countries-fluid-en/elevenlabs/'+n,dir+'/elevenlabs/'+n);
  await copyFile('/private/tmp/countries-kling4-text-doc.txt',dir+'/qa/kling4-official-api-reference.txt');
  console.log('Cached ElevenLabs voice and music prepared.');
 }else throw Error('Choose submit, status or prepare.');
}catch(e){const message=/^(Spain|France|Portugal|Sri Lanka|Italy|Germany|Choose)/.test(e.message)?e.message:'Production failed; saved state retained and no raw API error logged.';await save(dir+'/production-status.json',{status:'incomplete',stage,message,at:new Date().toISOString()});console.error(message);process.exitCode=1;}
