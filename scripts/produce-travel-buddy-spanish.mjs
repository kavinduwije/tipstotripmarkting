import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access,rename} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {config,higgsfield,APIError,AuthenticationError,NotEnoughCreditsError} from '@higgsfield/client/v2';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(await readFile(`${root}scripts/travel-buddy-${process.argv.includes('--french')?'french':'spanish'}.json`,'utf8'));
const speechLanguage=spec.speechLanguage??'Spanish from Spain';
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
 config({credentials,maxRetries:0});await mkdir(`${dir}/elevenlabs`,{recursive:true});await mkdir(`${dir}/qa`,{recursive:true});
 if(stage==='audit-audio'){
  const history=await(await eleven('/v1/history?page_size=100')).json();
  for(const s of spec.dialogues){const pending=`${dir}/elevenlabs/${s.id}.mp3.pending.json`;if(!(await exists(pending))||await exists(`${dir}/elevenlabs/${s.id}.mp3`))continue;
   const matches=(history.history??[]).filter(h=>h.text===s.text&&h.voice_id===spec.voiceId);
   await save(`${dir}/qa/${s.id}-submission-audit.json`,{checkedAt:new Date().toISOString(),endpoint:'/v1/history?page_size=100',exactTextAndVoiceMatches:matches.length,items:matches.map(h=>({id:h.history_item_id,date:h.date_unix,text:h.text}))});
   if(matches.length)throw new Error(`${s.id}: matching service history exists; recover instead of submitting`);
   await rename(pending,`${pending}.no-history-${Date.now()}`);console.log(`${s.id}: no matching service history; failed request archived before retry.`);
  }
 }else if(stage==='audio'){
  for(const s of spec.dialogues){if(selected&&s.id!==selected)continue;
   const file=`${dir}/elevenlabs/${s.id}.mp3`,meta=`${dir}/elevenlabs/${s.id}.json`,pending=file+'.pending.json';
   if(!(await exists(file))){
    if(await exists(pending))throw new Error(`${s.id}: inspect saved speech request before retry`);
    const input={text:s.text,model_id:'eleven_multilingual_v2',voice_settings:{stability:s.id==='preferences'?.6:.48,similarity_boost:.8,style:s.id==='preferences'?0:.12,use_speaker_boost:true,speed:1.04},seed:281010+spec.dialogues.indexOf(s)};
    await save(pending,{status:'submission_started',input});
    const r=await eleven(`/v1/text-to-speech/${spec.voiceId}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const d=await r.json();
    if(!d.audio_base64||!d.alignment)throw new Error('Speech output incomplete');await writeFile(file,Buffer.from(d.audio_base64,'base64'));delete d.audio_base64;await save(meta,{...d,text:s.text,input,requestId:r.headers.get('request-id')});
   }
   const m=JSON.parse(await readFile(meta,'utf8')),d=duration(file),speed=Math.max(1,d/(s.slot-.2));
   if(speed>1.17)throw new Error(`${s.id}: narration exceeds comfortable pacing; revise timing`);
   ff(['-i',file,'-af',`atempo=${speed},apad,atrim=duration=${s.slot}`,'-ac','1','-ar','48000','-c:a','pcm_s16le',`${dir}/elevenlabs/${s.id}.wav`]);
   await save(meta,{...m,sourceDuration:d,speed,slot:s.slot,at:s.at,preparedAlignment:{characters:m.alignment.characters,character_start_times_seconds:m.alignment.character_start_times_seconds.map(v=>v/speed),character_end_times_seconds:m.alignment.character_end_times_seconds.map(v=>v/speed)}});
   console.log(`${s.id}: ${d.toFixed(2)}s source; ${s.slot}s slot; speed ${speed.toFixed(3)}.`);
  }
 }else if(stage==='portraits'){
  for(const p of spec.portraits){if(selected&&selected!==p.id)continue;
   const r=await generation(`${p.id}-portrait`,'higgsfield-ai/soul/v2/standard',{prompt:p.prompt,seed:p.seed,batch_size:1,resolution:'1080p',aspect_ratio:'9:16',enhance_prompt:false});await download(r.images[0].url,`${dir}/${p.id}-reference.png`);
  }
 }else if(stage==='visuals'){
  for(const id of ['intro','outro']){if(selected&&selected!==id)continue;
   const source=JSON.parse(await readFile(`${dir}/${id}-portrait.json`,'utf8'));
   const audio=await upload(`${dir}/elevenlabs/${id}.wav`,'audio/wav');
   const line=spec.dialogues.find(s=>s.id===id);
   const input={prompt:`One continuous locked camera commercial shot of this exact fictional adult woman holding the phone. She speaks the supplied ${speechLanguage} audio in accurate lip synchronization, every word, onset and pause. Script: "${line.text}". Warm natural creator delivery, rested comfortable face, relaxed shoulders, gentle breathing. Keep identity, outfit, background, smartphone position and scale. Entire phone faces camera with all corners visible; screen stays uniform vivid green, no UI. The left hand holds it still with exactly one thumb and four curled fingers. ${id==='intro'?'Free hand makes one small open presenting gesture beside the phone.':'Free hand gently points at the phone then gives a single natural thumbs-up after speaking.'} Mouth closes in silence. No extra speech, music, captions, graphics or cuts.`,image_url:source.images[0].url,audio_url:audio,duration:line.slot,resolution:'720p',prompt_extend:false,negative_prompt:'extra fingers, duplicated fingers, fused fingers, broken joints, frozen mouth, distorted phone, camera movement, zoom, text, subtitles, watermark, UI, changing phone orientation',seed:id==='intro'?281101:281102};
   const r=await generation(`${id}-performance`,'wan/v2.7/image-to-video',input);await download(r.video.url,`${dir}/${id}-performance.mp4`);
  }
 }else if(stage==='native-speakers'){
  for(const id of ['intro','outro']){if(selected&&selected!==id)continue;
   const source=JSON.parse(await readFile(`${dir}/${id}-portrait.json`,'utf8')),line=spec.dialogues.find(s=>s.id===id);
   const prompt=`The exact same fictional adult woman in the reference presents this smartphone and speaks directly to camera in clear native ${speechLanguage}. Natural accurate mouth animation and synchronized intelligible dry speech. Begin speaking within the first quarter-second. Say exactly this script, no additional words: "${line.text}". Finish by ${id==='intro'?'4.7':'6.0'} seconds. Warm trustworthy energetic conversational creator, comfortable unhurried gestures, relaxed shoulders. ${id==='intro'?'Free hand makes one small open presenting gesture, then a natural smile.':'Point at the phone gently and give one natural thumbs-up only after the final spoken words.'} Preserve face, hair, outfit, background and phone position. Phone display is completely solid vivid green throughout, all corners visible, facing camera. One holding thumb and four fingers only. One continuous locked camera shot. No cuts, no music, no extra speech, no captions, no graphics, no text.`;
   const result=await generation(`${id}-native-performance`,'alibaba/wan-3.0-prime/image-to-video',{prompt,image_url:source.images[0].url,duration:id==='intro'?6:8,resolution:'720p',aspect_ratio:'9:16',generate_audio:true,enable_thinking:false,seed:id==='intro'?281201:281202});
   await download(result.video.url,`${dir}/${id}-native-performance.mp4`);
  }
 }else if(stage==='native-review'||stage==='native-voice'){
  for(const id of ['intro','outro']){if(selected&&selected!==id)continue;
   const native=`${dir}/elevenlabs/${id}-native-source.wav`,review=`${dir}/qa/${id}-native-source.scribe.json`;
   if(!(await exists(native)))ff(['-i',`${dir}/${id}-native-performance.mp4`,'-vn','-ar','44100','-ac','1','-c:a','pcm_s16le',native]);
   async function transcribe(file,target){if(await exists(target))return JSON.parse(await readFile(target,'utf8'));if(await exists(target+'.pending.json'))throw new Error('Speech review pending');await save(target+'.pending.json',{status:'submission_started',model:'scribe_v2'});const form=new FormData();form.append('file',new Blob([await readFile(file)],{type:'audio/wav'}),'speech.wav');form.append('model_id','scribe_v2');form.append('language_code',spec.language);form.append('tag_audio_events','false');const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:form})).json();await save(target,d);return d;}
   const s=await transcribe(native,review);console.log(`${id} native: ${s.text}`);
   const norm=s=>s.toLowerCase().replace(/tips\s*2\s*trip/g,'tips to trip').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
   if(norm(s.text)!==norm(spec.dialogues.find(s=>s.id===id).text))throw new Error(`${id}: native wording requires review before voice conversion`);
   if(stage==='native-review')continue;
   const file=`${dir}/elevenlabs/${id}-native-elevenlabs.mp3`;
   if(!(await exists(file))){if(await exists(file+'.pending.json'))throw new Error('Voice conversion pending');await save(file+'.pending.json',{status:'submission_started',model:'eleven_multilingual_sts_v2'});const form=new FormData();form.append('audio',new Blob([await readFile(native)],{type:'audio/wav'}),'source.wav');form.append('model_id','eleven_multilingual_sts_v2');form.append('voice_settings',JSON.stringify({stability:.55,similarity_boost:.8,style:0,use_speaker_boost:true}));form.append('remove_background_noise','true');form.append('seed',id==='intro'?'281211':'281212');const response=await eleven(`/v1/voice-changer/${spec.voiceId}?output_format=mp3_44100_128`,{method:'POST',body:form});await writeFile(file,Buffer.from(await response.arrayBuffer()));await save(file+'.json',{model:'eleven_multilingual_sts_v2',voiceId:spec.voiceId,source:native,requestId:response.headers.get('request-id'),cadencePreserved:true});}
   ff(['-i',file,'-ar','48000','-ac','1','-c:a','pcm_s16le',`${dir}/elevenlabs/${id}-native-elevenlabs.wav`]);
   const converted=await transcribe(`${dir}/elevenlabs/${id}-native-elevenlabs.wav`,`${dir}/qa/${id}-native-elevenlabs.scribe.json`);console.log(`${id} converted: ${converted.text}`);
   if(norm(converted.text)!==norm(spec.dialogues.find(s=>s.id===id).text))throw new Error(`${id}: converted wording requires review`);
  }
 }else if(stage==='transcribe'){
  for(const s of spec.dialogues){if(selected&&selected!==s.id)continue;const p=`${dir}/qa/${s.id}.scribe.json`;
   if(await exists(p)){console.log(`${s.id}: ${JSON.parse(await readFile(p,'utf8')).text}`);continue;}
   if(await exists(p+'.pending.json'))throw new Error('Speech review pending; inspect before retry');
   const f=new FormData();f.append('file',new Blob([await readFile(`${dir}/elevenlabs/${s.id}.wav`)],{type:'audio/wav'}),'speech.wav');f.append('model_id','scribe_v2');f.append('language_code',spec.language);f.append('tag_audio_events','false');await save(p+'.pending.json',{status:'submission_started',model:'scribe_v2'});
   const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(p,d);console.log(`${s.id}: ${d.text}`);
  }
 }else throw new Error('Choose audio, portraits, visuals or transcribe');
}
main().catch(e=>{console.error(e instanceof Error&&/^(Higgsfield|ElevenLabs|[a-z-]+:|Enter|Missing|Upload|Choose|Speech|Media|Polling|Output)/.test(e.message)?e.message:'Production incomplete; request states retained. No raw service errors logged.');process.exitCode=1;});
