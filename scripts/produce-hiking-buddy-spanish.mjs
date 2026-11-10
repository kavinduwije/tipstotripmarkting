import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {config,higgsfield,APIError,AuthenticationError,NotEnoughCreditsError} from '@higgsfield/client/v2';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(await readFile(`${root}scripts/hiking-buddy-spanish.json`,'utf8'));
const dir=`${root}${spec.directory}`;
const stage=process.argv[2],only=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
const wants=id=>!only||only.split(',').includes(id);
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const save=(p,d)=>writeFile(p,JSON.stringify(d,null,2));
let credentials,key;
function ff(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error('Media preparation failed.');}
function duration(p){return Number(spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',p],{encoding:'utf8'}).stdout.trim());}
async function eleven(path,init={}){
 let r;try{r=await fetch(`https://api.elevenlabs.io${path}`,{...init,headers:{...init.headers,'xi-api-key':key},signal:AbortSignal.timeout(240000)});}catch{throw Error('ElevenLabs connection failed; saved state retained.');}
 if(!r.ok){const d=await r.json().catch(()=>({}));const reason=['quota_exceeded','invalid_api_key','missing_permissions','voice_not_found','subscription_required','model_not_found','invalid_voice_settings'].includes(d.detail?.status)?d.detail.status:'request_rejected';throw Error(`ElevenLabs HTTP ${r.status}: ${reason}`);}return r;
}
async function upload(p,type){await mkdir(`${dir}/uploads`,{recursive:true});const cache=`${dir}/uploads/${p.split('/').at(-1)}.upload.json`;if(await exists(cache))return JSON.parse(await readFile(cache,'utf8')).url;
 const r=await fetch('https://api.higgsfield.ai/files/generate-upload-url',{method:'POST',headers:{Authorization:`Key ${credentials}`,'Content-Type':'application/json'},body:JSON.stringify({content_type:type}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`Higgsfield upload slot HTTP ${r.status}`);
 const d=await r.json();if(new URL(d.upload_url).protocol!=='https:'||new URL(d.public_url).protocol!=='https:')throw Error('Higgsfield invalid upload URL.');
 const put=await fetch(d.upload_url,{method:'PUT',headers:d.upload_headers,body:await readFile(p),signal:AbortSignal.timeout(120000)});if(!put.ok)throw Error(`Higgsfield upload HTTP ${put.status}`);await save(cache,{url:d.public_url});return d.public_url;
}
async function generate(id,model,input){const done=`${dir}/${id}.json`,pending=`${dir}/${id}.pending.json`;if(await exists(done))return JSON.parse(await readFile(done,'utf8'));
 let result;if(await exists(pending)){result=JSON.parse(await readFile(pending,'utf8'));if(!result.request_id)throw Error(`Higgsfield ${id}: saved ${result.status}; inspect before another submission.`);console.log(`Resuming ${id}; no new submission.`);}
 else{await save(pending,{status:'submission_started',model,input,startedAt:new Date().toISOString()});console.log(`Submitting ${id} (${model}; billable).`);
  try{result=await higgsfield.subscribe(model,{input,withPolling:false});}catch(e){const reason=e instanceof NotEnoughCreditsError?'insufficient_credits':e instanceof AuthenticationError?'authentication_rejected':e instanceof APIError?'api_rejected':'ambiguous_network_failure';await save(pending,{status:reason==='ambiguous_network_failure'?'submission_ambiguous':'submission_rejected',reason,httpStatus:e instanceof APIError?e.statusCode:undefined,networkCode:['ENOTFOUND','EAI_AGAIN','ECONNRESET','ETIMEDOUT'].includes(e.code)?e.code:undefined,model,input});throw Error(`Higgsfield ${id}: ${reason}${e instanceof APIError?' HTTP '+e.statusCode:''}. State retained.`);}
  await save(pending,{...result,model,input});}
 if(!result.request_id)throw Error('Higgsfield request ID missing; no resubmission.');const requestId=result.request_id,start=Date.now();let last='';
 while(!['completed','failed','nsfw','moderated','canceled','cancelled'].includes(result.status)){
  if(Date.now()-start>30*60*1000)throw Error('Higgsfield polling timeout; request retained.');await new Promise(r=>setTimeout(r,15000));
  const r=await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(requestId)}/status`,{headers:{Authorization:`Key ${credentials}`},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`Higgsfield status HTTP ${r.status}; request retained.`);result=await r.json();await save(pending,{...result,request_id:requestId,model,input});
  if(last!==result.status){console.log(`${id}: ${['queued','in_progress','completed','failed','nsfw','moderated','canceled','cancelled'].includes(result.status)?result.status:'waiting'}`);last=result.status;}}
 if(result.status!=='completed'||!(result.video?.url||result.images?.[0]?.url)){const details=JSON.stringify(result.error??result.errors??result.message??result.detail??'');const reason=/credit|balance|funds/i.test(details)?'insufficient_credits':'generation_failed';await save(`${dir}/${id}.failure.json`,{status:result.status,reason,requestId});throw Error(`Higgsfield ${id}: ${reason}; no usable output.`);}
 await save(done,{...result,request_id:requestId,model,input});return result;
}
async function download(url,p){if(await exists(p))return;if(new URL(url).protocol!=='https:')throw Error('Invalid output URL.');const r=await fetch(url,{signal:AbortSignal.timeout(240000)});if(!r.ok)throw Error(`Higgsfield download HTTP ${r.status}`);await writeFile(p,Buffer.from(await r.arrayBuffer()));}
async function main(){
 loadEnvFile(`${root}.env.local`);credentials=process.env.HF_CREDENTIALS;key=process.env.ELEVENLABS_API_KEY;
 if(!credentials||!key)throw Error('Configure missing service keys locally in .env.local.');
 config({credentials,maxRetries:0});for(const sub of ['elevenlabs','qa','edit','exports','demo'])await mkdir(`${dir}/${sub}`,{recursive:true});
 if(stage==='energetic'){
  const {reviseVoice}=await import('./revise-hiking-buddy-voice.mjs');
  await reviseVoice({spec,dir,eleven,only,action:process.argv.find(x=>x.startsWith('--action='))?.slice(9)??'catalog'});
 }else if(stage==='preflight'){
  const models=await(await eleven('/v1/models')).json();await save(`${dir}/qa/available-models.json`,models.map(m=>({id:m.model_id,tts:m.can_do_text_to_speech,sts:m.can_do_voice_conversion})));
  for(const c of spec.cast){const r=await eleven(`/v1/voices/${c.voice}`);const v=await r.json();console.log(`${c.name}: voice accessible (${v.name}); no audio generated.`);}
  console.log('ElevenLabs connected; model and voice access verified.');
 }else if(stage==='cast'){
  const input={prompt:`Photorealistic documentary travel-film casting continuity photograph. Exactly two fictional clearly adult Spanish female hikers standing side by side on a broad meadow trail near Potes in Picos de Europa, Spain. Left: ${spec.cast[0].appearance}. Right: ${spec.cast[1].appearance}. ${spec.continuity} Knee-up two-person photograph, both faces equally large and detailed, comfortable space between people, both look into camera with gentle closed-lip smiles, relaxed shoulders. Authentic natural skin texture, flyaway hairs, minimal makeup, believable anatomy, ordinary practical hiking clothes and backpacks. Documentary cinematography, 50mm lens. Each occupies her own half; faces fully visible and separate. No props in hands, poles, phone, text, captions, logos, watermarks, artificial beauty filters or other people.`,seed:911091,batch_size:1,resolution:'1080p',aspect_ratio:'4:3',enhance_prompt:false};
  const r=await generate('cast-master','higgsfield-ai/soul/v2/standard',input);await download(r.images[0].url,`${dir}/cast-master.png`);console.log('Cast ready for review.');
 }else if(stage==='retake-hello'){
  const c=spec.cast[0],line=spec.dialogues.find(s=>s.id==='hello');
  const input={prompt:`Cinematic photorealistic Spanish travel film, one continuous STATIC chest-up close shot. Use @image_1 as exact identity and wardrobe reference for this fictional adult woman, Lucía aged 27. ${spec.continuity} She has already stopped walking and stands completely still at a broad safe trail meeting point. Head and shoulders fill the frame; face frontal with eyes looking just to the right of lens toward her friend. Her mouth is sharply visible. Never show legs or walking. She greets her friend and says exactly once in clear conversational Spanish from Spain: "${line.text}". Start the line immediately after 0.15 seconds, deliver naturally within 3.3 seconds, then close lips into a small smile. The audio and visible mouth must be precisely synchronized from the first Hola through final plan, including closed lips for /m/ in mi and /p/ in plan and respondió. No speech-like mouth movement in pauses or after finishing. Keep her head mostly still, relaxed shoulders, no hand gestures, tiny natural eye movement. Clean dry close-mic speech only, no music, birds, wind, other people or other speech. No fillers, repetitions, captions, text, graphics, logos, watermark, cuts or camera movement.`,image_urls:[await upload(`${dir}/lucia-reference.png`,'image/png')],duration:4,resolution:'1080p',aspect_ratio:'9:16'};
  const r=await generate('native-hello-v2',spec.videoModel,input);await download(r.video.url,`${dir}/native-hello-v2.mp4`);console.log('Replacement hello ready for separate native lip-sync review.');
 }else if(stage==='native'){
  const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw Error('Cast review required.');
  const image=await upload(`${dir}/cast-master.png`,'image/png');
  for(const s of spec.dialogues.filter(s=>s.native)){if(!wants(s.id))continue;const c=spec.cast.find(c=>c.id===s.speaker);
   const action=s.id==='hook'?'She stands at the entrance of a broad hiking trail. Her ochre backpack is worn normally. Glance very briefly towards the limestone peaks then address the camera warmly.':s.id==='intro'?'She sits comfortably on a low rock at a safe scenic viewpoint. Her ochre backpack is beside her. Speak to the camera; only after speaking she glances down at a smartphone held low with its back to camera. No screen visible.':s.id==='ready'?'She stands on a safe village trail meeting point, looks just beside camera to her friend, speaks warmly and smiles.':'She stands at a safe village trail meeting point, looks just beside camera to her friend, speaks warmly then smiles.';
   const input={prompt:`One continuous photorealistic cinematic travel film dialogue shot. @image_1 is a cast reference. Show ONLY ${c.name}, ${c.appearance}; use her exact identity. ${spec.continuity} ${action} Eye-level chest-up medium close-up. Face frontal or only slightly turned; lips fully visible and sharp. Small realistic handheld documentary camera sway. Natural skin and comfortable adult energy. She speaks clear conversational native Spanish from Spain with precise synchronized mouth movements and says exactly once: "${s.text}". Begin at 0.2 seconds, finish all words naturally before final 0.25 seconds. ${s.id==='lets-go'?'This short line should finish before 1.6 seconds, followed by a closed-mouth smile.':''} Preserve consonant lip closures, Spanish vowel shapes, every word onset and pause. Intelligible dry close-microphone speech only, no music or wind noise. No mumbling, fillers, word repetition or extra speech. No other people, text, captions, graphics, logos, watermark, cuts, transitions or zoom. Relaxed shoulders and subtle unhurried gestures.`,image_urls:[image],duration:Math.max(3,s.slot),resolution:'1080p',aspect_ratio:'9:16'};
   const r=await generate(`native-${s.id}`,spec.videoModel,input);await download(r.video.url,`${dir}/native-${s.id}.mp4`);console.log(`${s.id}: native spoken take ready for lip-sync review; final voice NOT generated.`);
  }
  }else if(stage==='broll'){
  const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw Error('Cast review required.');
  const refs=[await upload(`${dir}/cast-master.png`,'image/png')];
  const shots=[
   {id:'response-phone',duration:4,prompt:'Show only Inés in clay-red fleece seated at a quiet stone village café terrace near Potes. Her blue daypack beside her. She reads her smartphone with its back to camera and types once naturally, interested small closed-mouth smile. Phone remains stable. Waist-up composition, no visible screen.'},
   {id:'arrival',duration:4,prompt:'Both women meet the next morning at a broad safe village trail entrance near Potes. Lucía in green with ochre backpack is on the left. Inés in clay-red with blue backpack walks in slowly from the right and stops a comfortable metre away. They exchange natural warm smiles and one tiny wave. No hugs, handshakes, speech or mouth talking. Medium-wide shot, ordinary natural motion.'},
   {id:'walk',duration:6,prompt:'Camera follows smoothly from behind both women walking side by side at a relaxed pace on a broad dry gravel hiking trail through green meadow slopes. Lucía in green with ochre backpack on left; Inés in clay-red with blue backpack on right. Pale rugged Picos de Europa limestone peaks behind. They briefly glance at each other, closed-mouth smiles, no speech. Natural walking, realistic boots, no poles or props, no cliff edges.'},
   {id:'waves',duration:6,prompt:'Wide cinematic landscape view at a safe grassy viewpoint set well back from any edge. Both hikers stand side by side seen from behind, Lucía green and ochre on left, Inés clay-red and slate-blue on right, taking in the magnificent green valley and layered pale limestone Picos de Europa mountains. Slow smooth camera pullback reveals the landscape, believable mild breeze, two ordinary unhurried adult hikers, no speech, no arm waving, no stunts.'}
  ];
  for(const shot of shots){if(!wants(shot.id))continue;
   const input={prompt:`Premium photorealistic hiking friendship travel film, same fictional adult cast as reference. ${spec.cast.map(c=>c.name+': '+c.appearance).join('. ')}. ${spec.continuity} ${shot.prompt} Preserve exact identities, backpack colours and wardrobe. Comfortable authentic holiday energy. No speech, voice, music, text, logos, subtitles or fabricated app screens.`,image_urls:refs,duration:shot.duration,resolution:'720p',aspect_ratio:'9:16'};
   const r=await generate(`broll-${shot.id}`,spec.videoModel,input);await download(r.video.url,`${dir}/broll-${shot.id}.mp4`);console.log(`${shot.id}: ready for visual review.`);
  }
 }else if(stage==='voices'){
  const review=JSON.parse(await readFile(`${dir}/qa/native-lipsync-review.json`,'utf8'));if(!review.approved||spec.dialogues.filter(s=>s.native).some(s=>!review.takes?.[s.id]?.approved))throw Error('Higgsfield native lip-sync review required before final voice generation.');
  for(const s of spec.dialogues){if(!wants(s.id))continue;
   const c=spec.cast.find(c=>c.id===s.speaker),file=`${dir}/elevenlabs/${s.id}.mp3`,meta=file+'.json',pending=file+'.pending.json';
   if(!(await exists(file))){if(await exists(pending))throw Error(`ElevenLabs ${s.id}: request pending; inspect before retry.`);
    if(s.native){
     const f=new FormData();f.append('audio',new Blob([await readFile(`${dir}/qa/${s.id}-native.wav`)],{type:'audio/wav'}),'performance.wav');f.append('model_id',spec.voiceModel);f.append('remove_background_noise','true');f.append('voice_settings',JSON.stringify({stability:.45,similarity_boost:.78,style:0,use_speaker_boost:true}));
     await save(pending,{status:'submission_started',mode:'cadence-preserving Voice Changer',model:spec.voiceModel,voice:c.voice,source:`qa/${s.id}-native.wav`});
     const r=await eleven(`/v1/voice-changer/${c.voice}?output_format=mp3_44100_128`,{method:'POST',body:f});await writeFile(file,Buffer.from(await r.arrayBuffer()));await save(meta,{model:spec.voiceModel,voice:c.voice,mode:'speech-to-speech',requestId:r.headers.get('request-id'),source:`qa/${s.id}-native.wav`});
    }else{
     const input={text:s.text,model_id:'eleven_multilingual_v2',language_code:'es',voice_settings:{stability:.5,similarity_boost:.78,style:.12,use_speaker_boost:true,speed:1},seed:911260+spec.dialogues.indexOf(s)};
     await save(pending,{status:'submission_started',mode:'voiceover',voice:c.voice,input});const r=await eleven(`/v1/text-to-speech/${c.voice}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const d=await r.json();if(!d.audio_base64||!d.alignment)throw Error('ElevenLabs incomplete voiceover output.');await writeFile(file,Buffer.from(d.audio_base64,'base64'));delete d.audio_base64;await save(meta,{...d,input,voice:c.voice,mode:'voiceover',requestId:r.headers.get('request-id')});
    }
   }
   console.log(`${s.id}: final voice saved; timing review still required.`);
  }
 }else if(stage==='review-voices'){
  for(const s of spec.dialogues){if(!wants(s.id))continue;const target=`${dir}/qa/${s.id}-final.scribe.json`;if(await exists(target)){console.log(`${s.id}: ${JSON.parse(await readFile(target,'utf8')).text}`);continue;}if(await exists(target+'.pending.json'))throw Error('ElevenLabs final transcript pending.');const f=new FormData();f.append('file',new Blob([await readFile(`${dir}/elevenlabs/${s.voiceFile??`${s.id}.mp3`}`)],{type:s.voiceFile?.endsWith('.wav')?'audio/wav':'audio/mpeg'}),s.voiceFile??'final.mp3');f.append('model_id','scribe_v2');f.append('language_code','es');f.append('tag_audio_events','false');await save(target+'.pending.json',{status:'submission_started'});const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(target,d);console.log(`${s.id}: ${d.text}`);}
 }else if(stage==='review-export'){
  const target=`${dir}/qa/final-export.scribe.json`,audio=`${dir}/qa/final-export.wav`;
  ff(['-i',`${dir}/exports/tips-to-trip-hiking-buddy-es-60s.mp4`,'-vn','-ac','1','-ar','48000',audio]);
  if(await exists(target)){console.log(JSON.parse(await readFile(target,'utf8')).text);return;}
  if(await exists(target+'.pending.json'))throw Error('ElevenLabs export transcript pending; inspect before retry.');
  const f=new FormData();f.append('file',new Blob([await readFile(audio)],{type:'audio/wav'}),'finished-export.wav');f.append('model_id','scribe_v2');f.append('language_code','es');f.append('tag_audio_events','false');await save(target+'.pending.json',{status:'submission_started'});
  const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(target,d);console.log(d.text);
 }else if(stage==='ambience'){
  const p=`${dir}/elevenlabs/mountain-ambience.mp3`;if(await exists(p))return;if(await exists(p+'.pending.json'))throw Error('ElevenLabs ambience pending; inspect before retry.');
  const input={text:'Natural quiet mountain meadow ambience in northern Spain. Soft gentle breeze through meadow grass, occasional distant small songbirds, faint leaves rustling. Authentic clear calm morning field recording. No storm, close wind, footsteps, people, voices or music. Seamless continuous quiet ambient bed.',duration_seconds:12,loop:true,prompt_influence:.4,model_id:'eleven_text_to_sound_v2'};
  await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/sound-generation?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{status:'completed',input,requestId:r.headers.get('request-id')});console.log('Quiet mountain ambience ready.');
 }else if(stage==='music'){
  const p=`${dir}/elevenlabs/music.mp3`;if(await exists(p))return;if(await exists(p+'.pending.json'))throw Error('ElevenLabs music pending; inspect before resubmitting.');
  const input={prompt:'Original instrumental only. Premium warm realistic Spanish mountain hiking friendship travel film, 60 seconds, organic plucked nylon guitar with organic light drums, rounded bass, subtle airy keys and warm cinematic space. 102 BPM. A playful sparse opening for a question, gentle optimistic build from 15 seconds during the app discovery, a brief soft lift at 39 seconds when the two hikers meet, joyful but relaxed adventure at 50 seconds, resolved three-second brand ending from 57 to 60. No singing, speech, vocal chops, chants or sound effects. Keep midrange sparse for two conversational female voices, never overpowering or frantic.',music_length_ms:60000,model_id:'music_v2_5',force_instrumental:true};
  await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/music?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{status:'completed',input,requestId:r.headers.get('request-id')});console.log('ElevenLabs instrumental ready.');
 }else if(stage==='review-native'){
  for(const s of spec.dialogues.filter(s=>s.native)){if(!wants(s.id))continue;
   const source=`${dir}/${s.nativeFile??`native-${s.id}.mp4`}`,wav=`${dir}/qa/${s.id}-native.wav`,target=`${dir}/qa/${s.id}-native.scribe.json`;
   ff(['-i',source,'-vn','-ac','1','-ar','48000',wav]);
   if(!(await exists(target))){if(await exists(target+'.pending.json'))throw Error('ElevenLabs native transcript pending; inspect before retry.');
    const f=new FormData();f.append('file',new Blob([await readFile(wav)],{type:'audio/wav'}),'native.wav');f.append('model_id','scribe_v2');f.append('language_code','es');f.append('tag_audio_events','false');await save(target+'.pending.json',{status:'submission_started'});
    const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(target,d);
   }
   console.log(`${s.id}: ${JSON.parse(await readFile(target,'utf8')).text}`);
   ff(['-i',source,'-vf',"fps=5,scale=216:384,tile=8x5",'-frames:v','1',`${dir}/qa/${s.id}-native-contact.jpg`]);
  }
 }else throw Error('Choose cast, native or review-native.');
}
main().catch(async e=>{const message=e instanceof Error&&/^(Higgsfield|ElevenLabs|Configure|Cast|Choose|Media)/.test(e.message)?e.message:'Production incomplete; saved states retained; no raw API errors logged.';const statusDir=stage==='energetic'?`${dir}/voice-energetic-v2`:dir;await mkdir(statusDir,{recursive:true});await save(`${statusDir}/production-status.json`,{stage,status:'incomplete',message,completedExport:false,updatedAt:new Date().toISOString()});console.error(message);process.exitCode=1;});
