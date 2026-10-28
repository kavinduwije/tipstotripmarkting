import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access,rename} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {config,higgsfield,APIError,AuthenticationError,NotEnoughCreditsError} from '@higgsfield/client/v2';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(await readFile(`${root}scripts/travel-buddy-english.json`,'utf8'));
const dir=`${root}${spec.directory}`;
const stage=process.argv[2];
const selected=process.argv.find(v=>v.startsWith('--only='))?.split('=')[1];
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const save=(p,o)=>writeFile(p,JSON.stringify(o,null,2));
function ff(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});if(r.status!==0)throw new Error('Media preparation failed');}
function duration(p){const r=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',p],{encoding:'utf8'});return Number(r.stdout.trim());}
let credentials,key;
async function eleven(path,init={}){
 const r=await fetch(`https://api.elevenlabs.io${path}`,{...init,headers:{...init.headers,'xi-api-key':key},signal:AbortSignal.timeout(180000)});
 if(!r.ok){const e=await r.json().catch(()=>({}));const reason=['quota_exceeded','invalid_api_key','missing_permissions','voice_not_found','subscription_required'].includes(e.detail?.status)?e.detail.status:'request_rejected';throw new Error(`ElevenLabs HTTP ${r.status}: ${reason}`);}return r;
}
async function download(url,p){if(await exists(p))return;const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw new Error('Output download failed');await writeFile(p,Buffer.from(await r.arrayBuffer()));}
async function generation(id,model,input){
 const done=`${dir}/${id}.json`,pending=`${dir}/${id}.pending.json`;
 if(await exists(done))return JSON.parse(await readFile(done,'utf8'));
 if(await exists(pending)&&process.argv.includes('--retry-rejected')){
  const previous=JSON.parse(await readFile(pending,'utf8'));
  if(previous.status==='submission_rejected'&&previous.reason==='insufficient_credits')await rename(pending,`${pending}.rejected-${Date.now()}`);
 }
 let r;
 if(await exists(pending)){
  r=JSON.parse(await readFile(pending,'utf8'));
  if(!r.request_id)throw new Error(`${id}: inspect saved request before retry; no duplicate submitted`);
  console.log(`Resuming ${id}; no new submission.`);
 }else{
  await save(pending,{status:'submission_started',model,input});
  console.log(`Submitting ${id} to Higgsfield (billable).`);
  try{r=await higgsfield.subscribe(model,{input,withPolling:false});}
  catch(e){
   const reason=e instanceof NotEnoughCreditsError?'insufficient_credits':e instanceof AuthenticationError?'authentication_rejected':e instanceof APIError?'api_rejected':'ambiguous_network_failure';
   await save(pending,{status:reason==='ambiguous_network_failure'?'submission_ambiguous':'submission_rejected',reason,httpStatus:e instanceof APIError?e.statusCode:undefined,model,input});
   throw new Error(`Higgsfield ${id}: ${reason}`);
  }
  await save(pending,{...r,model,input});
 }
 if(!r.request_id)throw new Error('Missing request ID; inspect service before resubmitting');
 const began=Date.now();let last='';
 while(!['completed','failed','nsfw','moderated','canceled','cancelled'].includes(r.status)){
  if(Date.now()-began>30*60*1000)throw new Error('Polling timed out; request state retained');
  await new Promise(a=>setTimeout(a,15000));
  const response=await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(r.request_id)}/status`,{headers:{Authorization:`Key ${credentials}`},signal:AbortSignal.timeout(60000)});
  if(!response.ok){if(response.status>=500)continue;throw new Error(`Higgsfield status HTTP ${response.status}`);}
  r=await response.json();await save(pending,{...r,model,input});
  if(r.status!==last){console.log(`${id}: ${['queued','in_progress','completed','failed','nsfw','moderated','canceled','cancelled'].includes(r.status)?r.status:'waiting'}`);last=r.status;}
 }
 if(r.status!=='completed'||!(r.images?.[0]?.url||r.video?.url)){
  const raw=JSON.stringify(r).toLowerCase();const reason=/credit|balance/.test(raw)?'insufficient_credits':/moder|nsfw/.test(raw)?'moderated':'generation_failed';
  await save(`${dir}/${id}.failure.json`,{status:r.status,reason,requestId:r.request_id});throw new Error(`${id}: ${reason}`);
 }
 await save(done,{...r,model,input});return r;
}
async function upload(p,type){const cache=p+'.upload.json';if(await exists(cache))return JSON.parse(await readFile(cache,'utf8')).url;
 const r=await fetch('https://api.higgsfield.ai/files/generate-upload-url',{method:'POST',headers:{Authorization:`Key ${credentials}`,'Content-Type':'application/json'},body:JSON.stringify({content_type:type}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`Upload slot HTTP ${r.status}`);
 const info=await r.json();const put=await fetch(info.upload_url,{method:'PUT',headers:info.upload_headers,body:await readFile(p),signal:AbortSignal.timeout(120000)});if(!put.ok)throw new Error('Upload failed');await save(cache,{url:info.public_url});return info.public_url;
}
async function main(){
 loadEnvFile(`${root}.env.local`);credentials=process.env.HF_CREDENTIALS;key=process.env.ELEVENLABS_API_KEY;
 if(!credentials||!key)throw new Error('Enter the missing service key locally in .env.local');
 config({credentials,maxRetries:0});await mkdir(`${dir}/elevenlabs`,{recursive:true});
 if(stage==='portraits'){
  // Submit sequentially so an account-wide rejection stops further charges.
  for(const p of spec.portraits){if(selected&&p.id!==selected)continue;const r=await generation(`${p.id}-portrait`,'higgsfield-ai/soul/v2/standard',{prompt:p.prompt,seed:p.seed,batch_size:1,resolution:'1080p',aspect_ratio:'9:16',enhance_prompt:false});await download(r.images[0].url,`${dir}/${p.id}-reference.png`);}
 }else if(stage==='audio'){
  for(const s of spec.dialogues){if(selected&&s.id!==selected)continue;
   const file=`${dir}/elevenlabs/${s.id}.mp3`,meta=`${dir}/elevenlabs/${s.id}.json`,pending=file+'.pending.json';
   if(!(await exists(file))){
    if(await exists(pending))throw new Error(`${s.id}: inspect saved speech request before retry`);
    const input={text:s.text,model_id:'eleven_multilingual_v2',voice_settings:{stability:.48,similarity_boost:.8,style:.12,use_speaker_boost:true,speed:1.04},seed:271010+spec.dialogues.indexOf(s)};
    await save(pending,{status:'submission_started',input});
    const r=await eleven(`/v1/text-to-speech/${spec.voiceId}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const d=await r.json();
    if(!d.audio_base64||!d.alignment)throw new Error('Speech output incomplete');await writeFile(file,Buffer.from(d.audio_base64,'base64'));delete d.audio_base64;await save(meta,{...d,text:s.text,input,requestId:r.headers.get('request-id')});
   }
   const m=JSON.parse(await readFile(meta,'utf8')),d=duration(file),speed=Math.max(1,d/(s.slot-.25));
   if(speed>1.17)throw new Error(`${s.id}: narration exceeds comfortable pacing; revise timing`);
   ff(['-i',file,'-af',`atempo=${speed},apad,atrim=duration=${s.slot}`,'-ac','1','-ar','48000','-c:a','pcm_s16le',`${dir}/elevenlabs/${s.id}.wav`]);
   await save(meta,{...m,sourceDuration:d,speed,slot:s.slot,at:s.at,preparedAlignment:{characters:m.alignment.characters,character_start_times_seconds:m.alignment.character_start_times_seconds.map(v=>v/speed),character_end_times_seconds:m.alignment.character_end_times_seconds.map(v=>v/speed)}});
   console.log(`${s.id}: ${d.toFixed(2)}s source; ${s.slot}s timeline; speed ${speed.toFixed(3)}.`);
  }
 }else if(stage==='visuals'){
  for(const id of ['brunette','hands','hands-steady','blonde']){
   if(selected&&id!==selected)continue;
   const source=JSON.parse(await readFile(`${dir}/${id==='hands-steady'?'hands':id}-portrait.json`,'utf8'));
   const intro=id==='brunette',outro=id==='blonde';let audioUrl;
   if(intro||outro)audioUrl=await upload(`${dir}/elevenlabs/${intro?'intro':'outro'}.wav`,'audio/wav');
   const prompt=id==='hands'?'Locked-off macro product shot. Preserve this exact smartphone position, straight vertical orientation, size, framing, black bezel and bright solid green display. Two realistic female hands gently hold phone, the right index finger makes four slow tiny taps near the lower screen as if typing a short word, then rests beside phone. The phone and camera remain perfectly still, no zoom, no rotation, no reframing, display is entirely solid vivid green throughout. Anatomically correct fingers, calm movement, pink and white striped cuffs. No UI, no text, no symbols, no transitions.':`The same fictional adult ${intro?'25-year-old short brown-haired woman wearing her white and pink striped long sleeve crop top':'24-year-old fair-haired woman wearing her white t-shirt'} presents the phone in this exact studio composition. Speak exactly in precise lip synchronization with the supplied English audio, following every onset and pause, natural warm energetic trustworthy creator delivery. Preserve identity, clothing, high-key background and smartphone. Keep phone at same location and scale, fully facing camera, with perfectly solid vivid green display and all corners visible throughout. ${intro?'Her free hand makes one small open presenting gesture.':'Her free hand points gently to the screen, then gives one natural thumbs up after the final spoken words.'} Relaxed shoulders and comfortable pacing, modest natural expressions. Mouth closes during pauses. Fixed eye-level camera, no cuts, no extra speech, no music, no UI, text, logos, or watermarks.`;
   const performancePrompt=id==='hands-steady'?'Locked-off macro product shot. Preserve the exact smartphone position, scale and front-on orientation, realistic hands and striped sleeves. The right index finger moves gently away to rest beside the lower right edge, leaving the complete display unobstructed. Then both hands hold the phone calmly for the remaining shot with only very subtle natural micro-movement. Screen stays fully facing the camera and completely solid vivid green. No tapping, scrolling, or UI. No camera movement, zoom, rotation, text, symbols, cuts or transitions. Professional calm product demonstration.':id==='hands'?prompt.replace('four slow tiny taps','five small taps during the first three seconds'):prompt;
   const input={prompt:performancePrompt,image_url:source.images[0].url,...(audioUrl?{audio_url:audioUrl}:{}),duration:id==='hands'?8:id==='hands-steady'?15:intro?7:6,resolution:'720p',prompt_extend:false,negative_prompt:'extra fingers, malformed hands, distorted phone, camera movement, camera zoom, text, symbols, subtitles, watermark, UI, changing phone orientation',seed:271100+['brunette','hands','hands-steady','blonde'].indexOf(id)};
   const r=await generation(`${id}-performance`,'wan/v2.7/image-to-video',input);await download(r.video.url,`${dir}/${id}-performance.mp4`);
  }
 }else if(stage==='touch-motion'){
  await mkdir(`${dir}/revision-03`,{recursive:true});
  const source=JSON.parse(await readFile(`${dir}/hands-portrait.json`,'utf8'));
  const common='Locked-off premium macro product demonstration, one continuous shot. Preserve the exact smartphone position, scale, frontal orientation, black bezel, camera island, left supporting hand, pink and white striped cuffs and warm studio background of the reference. The phone remains completely stationary. The right hand has five anatomically correct fingers and uses its INDEX FINGER, gently curved, to actually touch the glass. Only the index fingertip touches; other fingers curl naturally. Phone display stays perfectly solid vivid chroma green with no UI, text or symbols. No camera movement, cuts, zoom, phone bending or rotation.';
  const gestures=[
   {id:'tapping',duration:12,prompt:'The right index finger visibly navigates options on the phone. Start near the lower screen as in the reference. During seconds 0–3 move the fingertip smoothly up to the upper-left third of the DISPLAY, make one clear gentle tap with a small lift and re-contact. During seconds 3–6 move down to the centre-left of the DISPLAY, make two distinct gentle taps with visible fingertip lifts between. During seconds 6–9 move to the lower-middle of the DISPLAY and make two gentle taps. During seconds 9–12 move back to the middle of the DISPLAY, make a final deliberate tap, then withdraw the index finger just to the right of the phone. Movements are natural, modest and purposeful; each contact briefly flattens the fingertip against the glass. Keep the finger visible and moving between these distinct areas.'},
   {id:'swiping',duration:8,prompt:'The right index finger performs two clear upward swipes on the actual phone glass. During seconds 0–2 the fingertip contacts the lower centre of the DISPLAY at about 80 percent of its height and slides slowly upward to 35 percent of the DISPLAY height, moving visibly through the middle. Lift the finger off the glass and return beside the lower right edge during seconds 2–4. Repeat the same slow upward swipe during seconds 4–6, then lift and rest beside the phone during seconds 6–8. The phone itself and left holding hand remain still. Natural soft contact, realistic finger joint motion.'}
  ];
  for(const g of gestures){if(selected&&g.id!==selected)continue;const id=`revision-03/hands-${g.id}-performance`;const input={prompt:`${common} ${g.prompt}`,image_url:source.images[0].url,duration:g.duration,resolution:'720p',prompt_extend:false,negative_prompt:'extra fingers, fused fingers, malformed hands, broken joints, rubber finger, distorted phone, moving phone, camera movement, zoom, text, symbols, UI, transitions',seed:g.id==='tapping'?271301:271302};const r=await generation(id,'wan/v2.7/image-to-video',input);await download(r.video.url,`${dir}/${id}.mp4`);}
 }else if(stage==='native-outro'){
  const source=JSON.parse(await readFile(`${dir}/blonde-portrait.json`,'utf8'));
  const prompt=`The same fictional adult blonde woman in her white t-shirt before the seamless white studio background presents this exact phone. She speaks directly to camera in natural clear British English, mouth starts within the first quarter-second, visible accurate synchronized mouth animation. Warm energetic trustworthy delivery. She says this exact script clearly, finishing by 5.8 seconds, then smiles and gives one natural thumbs up by 6.5 seconds: "${spec.dialogues.at(-1).text}". Preserve her identity, outfit, realistic hands, white background and phone position. Her free hand points to the phone before her thumbs up. Keep smartphone fully facing camera, its display solid vivid green with no UI throughout. One continuous fixed camera shot. Clean dry intelligible dialogue only, no background music, sound effects, extra speech, overlays, captions, logos or cuts.`;
  const r=await generation('blonde-native-performance','alibaba/wan-3.0-prime/image-to-video',{prompt,image_url:source.images[0].url,duration:8,resolution:'720p',aspect_ratio:'9:16',generate_audio:true,enable_thinking:false,seed:271205});
  await download(r.video.url,`${dir}/blonde-native-performance.mp4`);
 }else if(stage==='native-review'||stage==='native-voice'){
  const native=`${dir}/elevenlabs/outro-native-source.wav`,review=`${dir}/qa/outro-native-source.scribe.json`;
  if(!(await exists(native)))ff(['-i',`${dir}/blonde-native-performance.mp4`,'-vn','-ar','44100','-ac','1','-c:a','pcm_s16le',native]);
  async function transcribe(file,target){if(await exists(target))return JSON.parse(await readFile(target,'utf8'));if(await exists(target+'.pending.json'))throw new Error('Speech review already pending');await save(target+'.pending.json',{status:'submission_started',model:'scribe_v2'});const form=new FormData();form.append('file',new Blob([await readFile(file)],{type:'audio/wav'}),'speech.wav');form.append('model_id','scribe_v2');form.append('language_code','en');form.append('tag_audio_events','false');const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:form})).json();await save(target,d);return d;}
  const source=await transcribe(native,review);console.log(`Native outro: ${source.text}`);
  const norm=s=>s.toLowerCase().replace(/[^a-z]/g,'');if(norm(source.text)!==norm(spec.dialogues.at(-1).text))throw new Error('Speech source requires wording review before conversion');
  if(stage==='native-review')return;
  const file=`${dir}/elevenlabs/outro-native-elevenlabs.mp3`;
  if(!(await exists(file))){if(await exists(file+'.pending.json'))throw new Error('Voice conversion already pending');await save(file+'.pending.json',{status:'submission_started',model:'eleven_multilingual_sts_v2'});const form=new FormData();form.append('audio',new Blob([await readFile(native)],{type:'audio/wav'}),'source.wav');form.append('model_id','eleven_multilingual_sts_v2');form.append('voice_settings',JSON.stringify({stability:.55,similarity_boost:.8,style:0,use_speaker_boost:true}));form.append('remove_background_noise','true');form.append('seed','271206');const r=await eleven(`/v1/voice-changer/${spec.voiceId}?output_format=mp3_44100_128`,{method:'POST',body:form});await writeFile(file,Buffer.from(await r.arrayBuffer()));await save(file+'.json',{model:'eleven_multilingual_sts_v2',voiceId:spec.voiceId,source:native,requestId:r.headers.get('request-id'),cadencePreserved:true});}
  ff(['-i',file,'-ar','48000','-ac','1','-c:a','pcm_s16le',`${dir}/elevenlabs/outro-native-elevenlabs.wav`]);
  const converted=await transcribe(`${dir}/elevenlabs/outro-native-elevenlabs.wav`,`${dir}/qa/outro-native-elevenlabs.scribe.json`);console.log(`Converted outro: ${converted.text}`);if(norm(converted.text)!==norm(spec.dialogues.at(-1).text))throw new Error('Speech conversion requires wording review');
 }else if(stage==='transcribe'){
  for(const s of spec.dialogues){if(selected&&s.id!==selected)continue;const p=`${dir}/qa/${s.id}.scribe.json`;if(await exists(p)){console.log(`${s.id}: ${JSON.parse(await readFile(p,'utf8')).text}`);continue;}if(await exists(p+'.pending.json'))throw new Error('Speech review pending; inspect before retry');
   const f=new FormData();f.append('file',new Blob([await readFile(`${dir}/elevenlabs/${s.id}.wav`)],{type:'audio/wav'}),'speech.wav');f.append('model_id','scribe_v2');f.append('language_code','en');f.append('tag_audio_events','false');await save(p+'.pending.json',{status:'submission_started',model:'scribe_v2'});const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(p,d);console.log(`${s.id}: ${d.text}`);
  }
 }else throw new Error('Choose portraits, audio, visuals or transcribe');
}
main().catch(e=>{console.error(e instanceof Error&&/^(Higgsfield|ElevenLabs|[a-z-]+:|Enter|Missing|Upload|Choose|Speech|Media|Polling|Output)/.test(e.message)?e.message:'Production incomplete; request states retained. No raw service errors logged.');process.exitCode=1;});
