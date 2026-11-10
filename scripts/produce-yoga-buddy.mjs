import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {config,higgsfield,APIError,AuthenticationError,NotEnoughCreditsError} from '@higgsfield/client/v2';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(await readFile(`${root}scripts/yoga-buddy-english.json`,'utf8'));
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
 if(stage==='cast'){
  const input={prompt:`Photorealistic premium travel film casting continuity photograph. Two clearly adult fictional female travellers stand side by side in a quiet tropical coastal garden in Weligama, each holding a rolled yoga mat at her outside hip. Left: ${spec.cast[0].appearance}. Right: ${spec.cast[1].appearance}. ${spec.continuity} Wide three-quarter two-person photograph from knees upwards, faces equally large and detailed, comfortable space between people, both look into camera with gentle closed-lip smiles, relaxed shoulders. Authentic natural skin texture, flyaway hairs, minimal makeup, believable human anatomy. Documentary cinematography, 50mm lens, soft natural morning light. Frame both faces fully inside the central image, each occupies her own half. Mat colours clearly visible. No text, captions, logos, watermarks, beauty filters or other people.`,quality:'high',resolution:'2k',aspect_ratio:'4:3',enhance_prompt:false,moderation:'auto'};
  const r=await generate('cast-master','marketing-studio/image',input);await download(r.images[0].url,`${dir}/cast-master.png`);console.log('Cast ready for review.');
 }else if(stage==='native'){
  const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw Error('Cast review required.');
  const image=await upload(`${dir}/cast-master.png`,'image/png');
  for(const s of spec.dialogues.filter(s=>s.native)){if(!wants(s.id))continue;const c=spec.cast.find(c=>c.id===s.speaker);
   const action=s.id==='hook'?'She stands holding her rolled lavender yoga mat against her hip, briefly takes in the garden, then turns her eyes to camera and addresses the viewer naturally. Only a tiny glance before the first word. The mat stays low, away from her face.':s.id==='intro'?'She sits comfortably cross-legged on her unrolled lavender yoga mat on the garden lawn. She speaks to camera with relaxed upright posture, then glances down at a smartphone held naturally, its back towards camera. No screen visible.':s.id==='ready'?'She stands holding her rolled ochre yoga mat at her outside hip, speaking to her friend just beside the camera with a small warm smile.':'She stands holding her rolled lavender yoga mat at her outside hip, speaking warmly to her friend just beside camera. She smiles after finishing.';
   const input={prompt:`One continuous photorealistic travel film dialogue shot in Weligama, Sri Lanka. The image is a cast reference: show ONLY ${c.name}, ${c.appearance}; use her exact reference identity. ${spec.continuity} ${action} Eye-level chest-up medium close-up with clearly readable face and lips, subtle handheld documentary camera stability, gentle natural breathing, relaxed shoulders, unhurried small movements. She speaks clear natural British English with precisely synchronised visible mouth movements and says exactly once: "${s.text}". Begin speaking within the first 0.25 seconds, finish all words with a comfortable short closed-mouth tail before the clip ends. Native speech audio must be clean, intelligible, close-microphone sound with no music or garden noise. Preserve consonant closures, natural vowel shapes, exact speech onset and pauses. Never mumble, repeat words or add words. No other people, no additional speech, singing, text, subtitles, logos, watermark, jump cuts or scene transitions.`,image_urls:[image],duration:s.generationDuration??Math.max(4,s.slot),resolution:'720p',aspect_ratio:'9:16',output_format:'mp4',generate_audio:true};
   const r=await generate(`native-${s.id}`,spec.videoModel,input);await download(r.video.url,`${dir}/native-${s.id}.mp4`);console.log(`${s.id}: native spoken take ready for lip-sync review; final voice NOT generated.`);
  }
  }else if(stage==='broll'){
  const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw Error('Cast review required.');
  const refs=[await upload(`${dir}/cast-master.png`,'image/png')];
  const shots=[
   {id:'arrival',duration:4,prompt:`Both women meet on the flat short-grass lawn at the entrance to the wooden yoga pavilion. Mia in sage green stands on the left holding her rolled lavender mat at her outside hip; Leila in dusty rose approaches from the right holding her rolled ochre mat, stops a comfortable metre away. They smile and give a tiny relaxed wave with their free hands. No hugging, handshake or dialogue. Medium-wide two shot, believable mat handling, short sleeves and full-length leggings remain unchanged.`},
   {id:'walk',duration:4,prompt:`Camera follows smoothly from behind the same two women walking side by side along a short garden path towards the open-sided wooden yoga pavilion. Mia in sage green on left carrying one tightly rolled lavender mat at her outside hip, Leila in dusty rose on right carrying one tightly rolled ochre mat. Normal natural walking, relaxed shoulders, full-length charcoal leggings. Soft morning sun through palms, glimpses of calm sea. A subtle friendly glance, no speech.`},
   {id:'mats',duration:4,prompt:`Low eye-level medium-wide view beside the wooden yoga pavilion on a clean level grassy clearing. Both women are kneeling side by side. Their own yoga mats are ALREADY fully unrolled and flat on the lawn in front of them, lavender on left for Mia in sage green and ochre on right for Leila in dusty rose. They gently smooth the near mat edges with their palms then settle into relaxed upright kneeling. Exactly two mats with flat stable rectangular shapes and realistic proportions. Do not roll or throw anything. Clearly show both matching women and both full-length leggings, relaxed natural movement.`},
   {id:'practice',duration:6,prompt:`Medium-wide side-front view of the same two adult women sitting comfortably cross-legged on their own yoga mats side by side on level short grass beside the yoga pavilion. Mia in sage green on the lavender mat on left, Leila in dusty rose on the ochre mat on right. They slowly raise both arms from relaxed hands on knees up overhead on an easy morning breath, then hold a relaxed seated upward stretch. One simple symmetrical movement, calm faces, upright comfortable backs, no contortions, complex poses, hands overlapping faces or standing. Bare feet, charcoal full-length leggings and short-sleeve shirts. Gentle breeze, natural anatomy, stable identity and wardrobe.`},
   {id:'wide',duration:4,prompt:`Beautiful wide cinematic shot from a comfortable distance of the same two adult women sitting cross-legged side by side on their lavender and ochre yoga mats beside the open-sided wooden pavilion in the coastal palm garden. Mia sage green on left, Leila dusty rose on right, full-length charcoal leggings. They calmly rest their palms on their knees, eyes softly closed, shoulders relaxed, quietly sharing a morning yoga breath. A slow subtle camera pull back reveals palm shade and a glimpse of the calm Indian Ocean beyond. Exactly two women and two rectangular mats, believable garden in Weligama, no cliffs, no complex yoga poses.`}
  ];
  for(const shot of shots){if(!wants(shot.id))continue;
   const input={prompt:`Premium photorealistic yoga friendship travel story, same fictional adult cast as reference. ${spec.cast.map(c=>c.name+': '+c.appearance).join('. ')}. ${spec.continuity} ${shot.prompt} Preserve exact identities, mat colours and wardrobe. Comfortable authentic holiday energy. No speech, voice, music, text, logos, subtitles or fabricated app screens.`,image_urls:refs,duration:shot.duration,resolution:'720p',aspect_ratio:'9:16',output_format:'mp4',generate_audio:false};
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
     const input={text:s.text,model_id:'eleven_multilingual_v2',language_code:'en',voice_settings:{stability:.5,similarity_boost:.78,style:.12,use_speaker_boost:true,speed:1},seed:911260+spec.dialogues.indexOf(s)};
     await save(pending,{status:'submission_started',mode:'voiceover',voice:c.voice,input});const r=await eleven(`/v1/text-to-speech/${c.voice}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const d=await r.json();if(!d.audio_base64||!d.alignment)throw Error('ElevenLabs incomplete voiceover output.');await writeFile(file,Buffer.from(d.audio_base64,'base64'));delete d.audio_base64;await save(meta,{...d,input,voice:c.voice,mode:'voiceover',requestId:r.headers.get('request-id')});
    }
   }
   console.log(`${s.id}: final voice saved; timing review still required.`);
  }
 }else if(stage==='review-voices'){
  for(const s of spec.dialogues){if(!wants(s.id))continue;const target=`${dir}/qa/${s.id}-final.scribe.json`;if(await exists(target)){console.log(`${s.id}: ${JSON.parse(await readFile(target,'utf8')).text}`);continue;}if(await exists(target+'.pending.json'))throw Error('ElevenLabs final transcript pending.');const f=new FormData();f.append('file',new Blob([await readFile(`${dir}/elevenlabs/${s.id}.mp3`)],{type:'audio/mpeg'}),'final.mp3');f.append('model_id','scribe_v2');f.append('language_code','en');f.append('tag_audio_events','false');await save(target+'.pending.json',{status:'submission_started'});const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(target,d);console.log(`${s.id}: ${d.text}`);}
 }else if(stage==='review-export'){
  const target=`${dir}/qa/final-mix.scribe.json`;
  if(await exists(target)){console.log(JSON.parse(await readFile(target,'utf8')).text);return;}
  if(await exists(target+'.pending.json'))throw Error('ElevenLabs final mix transcript pending; inspect before retry.');
  const f=new FormData();f.append('file',new Blob([await readFile(`${dir}/edit/final-mix.wav`)],{type:'audio/wav'}),'final-mix.wav');f.append('model_id','scribe_v2');f.append('language_code','en');f.append('tag_audio_events','false');
  await save(target+'.pending.json',{status:'submission_started'});const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(target,d);console.log(d.text);
 }else if(stage==='ambience'){
  const p=`${dir}/elevenlabs/beach-ambience.mp3`;if(await exists(p))return;if(await exists(p+'.pending.json'))throw Error('ElevenLabs ambience pending; inspect before retry.');
  const input={text:'Quiet natural tropical coastal garden ambience in Weligama at morning. Soft palm leaves rustle in a light breeze with very faint distant gentle surf. Warm realistic documentary field recording. No close wind on microphone, people, speech, shouting, music or dramatic sounds. Seamless understated continuous bed.',duration_seconds:12,loop:true,prompt_influence:.4,model_id:'eleven_text_to_sound_v2'};
  await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/sound-generation?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{status:'completed',input,requestId:r.headers.get('request-id')});console.log('Quiet coastal-garden ambience ready.');
 }else if(stage==='music'){
  const p=`${dir}/elevenlabs/music.mp3`;if(await exists(p))return;if(await exists(p+'.pending.json'))throw Error('ElevenLabs music pending; inspect before resubmitting.');
  const input={prompt:'Original instrumental only. Premium warm realistic yoga friendship travel film, 60 seconds, relaxed sunny indie acoustic guitar with organic light drums, rounded bass, subtle airy keys and warm cinematic space. 86 BPM. A inviting sparse opening for a question, gentle optimistic build from 15 seconds during the app discovery, a brief soft lift at 39 seconds when friends meet, a calm uplifting shared yoga experience at 50 seconds, resolved three-second brand ending from 57 to 60. No singing, speech, vocal chops, chants or sound effects. Keep midrange sparse for two conversational female voices, never overpowering or frantic.',music_length_ms:60000,model_id:'music_v1',force_instrumental:true};
  await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/music?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{status:'completed',input,requestId:r.headers.get('request-id')});console.log('ElevenLabs instrumental ready.');
 }else if(stage==='review-native'){
  for(const s of spec.dialogues.filter(s=>s.native)){if(!wants(s.id))continue;
   const source=`${dir}/native-${s.id}.mp4`,wav=`${dir}/qa/${s.id}-native.wav`,target=`${dir}/qa/${s.id}-native.scribe.json`;
   ff(['-i',source,'-vn','-ac','1','-ar','48000',wav]);
   if(!(await exists(target))){if(await exists(target+'.pending.json'))throw Error('ElevenLabs native transcript pending; inspect before retry.');
    const f=new FormData();f.append('file',new Blob([await readFile(wav)],{type:'audio/wav'}),'native.wav');f.append('model_id','scribe_v2');f.append('language_code','en');f.append('tag_audio_events','false');await save(target+'.pending.json',{status:'submission_started'});
    const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(target,d);
   }
   console.log(`${s.id}: ${JSON.parse(await readFile(target,'utf8')).text}`);
   ff(['-i',source,'-vf',"fps=5,scale=216:384,tile=8x5",'-frames:v','1',`${dir}/qa/${s.id}-native-contact.jpg`]);
  }
 }else throw Error('Choose cast, native, broll, review-native, voices, review-voices, ambience or music.');
}
main().catch(async e=>{const message=e instanceof Error&&/^(Higgsfield|ElevenLabs|Configure|Cast|Choose|Media)/.test(e.message)?e.message:'Production incomplete; saved states retained; no raw API errors logged.';await mkdir(dir,{recursive:true});await save(`${dir}/production-status.json`,{stage,status:'incomplete',message,completedExport:false,updatedAt:new Date().toISOString()});console.error(message);process.exitCode=1;});
