import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access,rename} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {config,higgsfield,APIError,AuthenticationError,NotEnoughCreditsError} from '@higgsfield/client/v2';
const root=new URL('../',import.meta.url).pathname;
const campaign=process.argv.find(x=>x.startsWith('--campaign='))?.slice(11)??'travel';
const spec=JSON.parse(await readFile(`${root}scripts/${campaign}-buddy-story-english.json`,'utf8'));
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
 if(process.argv.includes('--retry-rejected')&&await exists(pending)){const old=JSON.parse(await readFile(pending,'utf8'));const failure=await exists(`${dir}/${id}.failure.json`)?JSON.parse(await readFile(`${dir}/${id}.failure.json`,'utf8')):null;if(!['failed','submission_rejected'].includes(old.status)||(failure?.reason??old.reason)!=='insufficient_credits')throw Error('Higgsfield retry requires confirmed rejected credit state.');await rename(pending,pending+`.rejected-${Date.now()}`);if(failure)await rename(`${dir}/${id}.failure.json`,`${dir}/${id}.failure-${Date.now()}.json`);}
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
 if(stage==='voice-lookup'){
  const q=process.argv.find(x=>x.startsWith('--search='))?.slice(9)??spec.cast[0].voice;const d=await(await eleven('/v1/shared-voices?page_size=100&include_custom_rates=true&include_live_moderated=true&search='+encodeURIComponent(q))).json();await save(`${dir}/elevenlabs/voice-lookup.json`,d);console.log(JSON.stringify({total:d.total_count,hasMore:d.has_more,voices:d.voices?.map(v=>({id:v.voice_id,name:v.name,owner:v.public_owner_id}))}));
 }else if(stage==='voice-enable'){
  const id=spec.cast[0].voice;const d=await(await eleven('/v1/shared-voices?search='+encodeURIComponent(id)+'&page_size=100&include_custom_rates=true&include_live_moderated=true')).json();const v=d.voices?.find(v=>v.voice_id===id);if(!v)throw Error('ElevenLabs requested voice absent from matching shared library results.');await save(`${dir}/elevenlabs/requested-voice-library.json`,{voiceId:v.voice_id,name:v.name,gender:v.gender,accent:v.accent,language:v.language,publicOwnerId:v.public_owner_id,description:v.description});const added=await(await eleven(`/v1/voices/add/${v.public_owner_id}/${id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({new_name:v.name})})).json();console.log(JSON.stringify({voiceId:added.voice_id,name:v.name,gender:v.gender,accent:v.accent,status:'added'}));
 }else if(stage==='voice-check'){
  const r=await eleven('/v1/voices/'+spec.cast[0].voice);const v=await r.json();console.log(JSON.stringify({voiceId:v.voice_id,name:v.name,category:v.category,labels:v.labels},null,2));
 }else if(stage==='native'){
  const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw Error('Cast review required.');
  const image=await upload(`${dir}/cast-master.png`,'image/png');
  for(const s of spec.dialogues.filter(s=>s.native)){if(!wants(s.id))continue;const c=spec.cast.find(c=>c.id===s.speaker);
   const action='She is seated comfortably beside a bright guesthouse courtyard window. She looks directly into the camera with a warm engaging creator expression. Her lips and face are fully visible, hands low outside frame. No phone. A restrained small smile after the final words.';
   const input={prompt:`One continuous photorealistic travel film dialogue shot in Galle, Sri Lanka. The image is a cast reference: show ONLY ${c.name}, ${c.appearance}; use her exact reference identity. ${spec.continuity} ${action} Eye-level chest-up medium close-up with clearly readable face and lips, subtle handheld documentary camera stability, gentle natural breathing, relaxed shoulders, unhurried small movements. She speaks clear natural British English with precisely synchronised visible mouth movements and says exactly once: "${s.text}". Begin speaking within the first 0.25 seconds, finish all words with a comfortable short closed-mouth tail before the clip ends. Native speech audio must be clean, intelligible, close-microphone sound with no music or garden noise. Preserve consonant closures, natural vowel shapes, exact speech onset and pauses. Never mumble, repeat words or add words. No other people, no additional speech, singing, text, subtitles, logos, watermark, jump cuts or scene transitions.`,image_urls:[image],duration:s.generationDuration??Math.max(4,s.slot),resolution:'720p',aspect_ratio:'9:16',output_format:'mp4',generate_audio:true};
   const r=await generate(`native-${s.id}`,spec.videoModel,input);await download(r.video.url,`${dir}/native-${s.id}.mp4`);console.log(`${s.id}: native spoken take ready for lip-sync review; final voice NOT generated.`);
  }
  }else if(stage==='broll'){
  const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw Error('Cast review required.');
  const refs=[await upload(`${dir}/cast-master.png`,'image/png')];
  const shots=spec.broll;
  for(const shot of shots){if(!wants(shot.id))continue;
   const input={prompt:`Premium photorealistic cinematic friendship travel story, same fictional adult cast as reference. ${spec.cast.map(c=>c.name+': '+c.appearance).join('. ')}. ${spec.continuity} ${shot.prompt} Preserve exact identities, mat colours and wardrobe. Comfortable authentic holiday energy. No speech, voice, music, text, logos, subtitles or fabricated app screens.`,image_urls:refs,duration:shot.duration,resolution:'720p',aspect_ratio:'9:16',output_format:'mp4',generate_audio:false};
   const r=await generate(`broll-${shot.id}`,spec.videoModel,input);await download(r.video.url,`${dir}/broll-${shot.id}.mp4`);console.log(`${shot.id}: ready for visual review.`);
  }
 }else if(stage==='voices'){
  const review=JSON.parse(await readFile(`${dir}/qa/native-lipsync-review.json`,'utf8'));if(!review.approved||spec.dialogues.filter(s=>s.native).some(s=>!review.takes?.[s.id]?.approved))throw Error('Higgsfield native lip-sync review required before final voice generation.');
  for(const s of spec.dialogues){if(!wants(s.id))continue;
   const c={...spec.cast.find(c=>c.id===s.speaker),voice:s.native?spec.cast.find(c=>c.id===s.speaker).dialogueVoice:spec.narratorVoice},file=`${dir}/elevenlabs/${s.id}.mp3`,meta=file+'.json',pending=file+'.pending.json';
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
  const input={prompt:campaign==='travel'?'Original instrumental only, premium 60 second high-energy social travel film. Bold modern electronic indie groove, 112 BPM, deep clean bass, crisp drums, neon synth pulses, atmospheric organic travel warmth. Sparse rising first three seconds, confident rhythmic drop at three seconds, immediate controlled level for voice. Clear rhythmic variations at 19, 28 and 42 seconds, uplifting friendship lift at 50, resolved brand ending at 57 to 60. Stylish contemporary digital energy, avoid harshness or frantic noise. No vocals, chants, spoken words or vocal chops. Sparse midrange for narration.':'Original instrumental only, premium 60 second realistic solo travel friendship short film. Modern warm cinematic indie electronic groove, 104 BPM, deep round bass, crisp understated drums, soft acoustic guitar, atmospheric neon synth accents. Dramatic sparse three-second opening then immediate space for intimate narration. Curious hopeful pulse during app discovery, warm emotional lift when friends meet at 34 seconds, sunlit optimistic lift at 43, satisfying resolved brand ending at 57 to 60. No vocals, chants, speech or vocal chops; sparse midrange for narration.',music_length_ms:60000,model_id:'music_v1',force_instrumental:true};
  await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/music?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{status:'completed',input,requestId:r.headers.get('request-id')});console.log('ElevenLabs instrumental ready.');
 }else if(stage==='impact'){
  const p=`${dir}/elevenlabs/impact.mp3`;if(await exists(p))return;if(await exists(p+'.pending.json'))throw Error('ElevenLabs impact pending; inspect before retry.');const input={text:'Epic cinematic stereo wind riser into a huge thunderous deep bass boom impact, premium theatrical sound design. First one second builds a rushing airy wind swell into a powerful low thunder hit, then rich deep sub-bass with a lingering rolling decay and spacious reverb fading smoothly into silence. High quality stereo, no music, voices, speech or clipping.',duration_seconds:5,prompt_influence:.55,model_id:'eleven_text_to_sound_v2'};await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/sound-generation?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{status:'completed',input,requestId:r.headers.get('request-id')});console.log('Wind-to-boom impact ready.');
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
