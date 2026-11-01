import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access,readdir} from 'node:fs/promises';
import {spawnSync,spawn} from 'node:child_process';
import sharp from 'sharp';
import {config,higgsfield,APIError,AuthenticationError,NotEnoughCreditsError} from '@higgsfield/client/v2';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(await readFile(`${root}scripts/girls-trip-english.json`,'utf8'));
const dir=`${root}${spec.directory}`;
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const save=(p,d)=>writeFile(p,JSON.stringify(d,null,2));
let credentials,key;
const selected=process.argv.find(v=>v.startsWith('--only='))?.slice(7);
const take=process.argv.find(v=>v.startsWith('--take='))?.slice(7);
const wants=id=>!selected||selected.split(',').includes(id);
const voices={friend1:'EXAVITQu4vr4xnSDxMaL',friend2:'cgSgspJ2msm6clMCkdW9',friend3:'FGY2WhTYpPnrIDTdsKH5',friend4:'Xb7hH8MSUJpSbSDYk0k2'};
function ff(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw new Error('Media preparation failed.');return r;}
function duration(p){const r=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',p],{encoding:'utf8'});return Number(r.stdout.trim());}
async function eleven(path,init={}){
  let r;try{r=await fetch(`https://api.elevenlabs.io${path}`,{...init,headers:{...init.headers,'xi-api-key':key},signal:AbortSignal.timeout(180000)});}catch{throw new Error('ElevenLabs connection failed; request state retained.');}
  if(!r.ok){const d=await r.json().catch(()=>({}));const reason=['quota_exceeded','invalid_api_key','missing_permissions','voice_not_found','subscription_required'].includes(d.detail?.status)?d.detail.status:'request_rejected';throw new Error(`ElevenLabs HTTP ${r.status}: ${reason}`);}return r;
}
async function upload(p,type){
  const cache=p+'.upload.json';if(await exists(cache))return JSON.parse(await readFile(cache,'utf8')).url;
  const r=await fetch('https://api.higgsfield.ai/files/generate-upload-url',{method:'POST',headers:{Authorization:`Key ${credentials}`,'Content-Type':'application/json'},body:JSON.stringify({content_type:type}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error(`Higgsfield upload slot HTTP ${r.status}`);
  const d=await r.json();const put=await fetch(d.upload_url,{method:'PUT',headers:d.upload_headers,body:await readFile(p),signal:AbortSignal.timeout(120000)});if(!put.ok)throw new Error('Higgsfield upload failed.');await save(cache,{url:d.public_url});return d.public_url;
}
async function generate(id,model,input){
  const done=`${dir}/${id}.json`,pending=`${dir}/${id}.pending.json`;
  if(await exists(done))return JSON.parse(await readFile(done,'utf8'));
  let result;
  if(await exists(pending)){
    result=JSON.parse(await readFile(pending,'utf8'));
    if(!result.request_id)throw new Error(`${id}: saved request ${result.status}; inspect before resubmitting.`);
    console.log(`Resuming ${id}; no new submission.`);
  }else{
    await save(pending,{status:'submission_started',model,input});
    console.log(`Submitting ${id} through Higgsfield (billable).`);
    try{result=await higgsfield.subscribe(model,{input,withPolling:false});}
    catch(e){
      const reason=e instanceof NotEnoughCreditsError?'insufficient_credits':e instanceof AuthenticationError?'authentication_rejected':e instanceof APIError?'api_rejected':'ambiguous_network_failure';
      await save(pending,{status:reason==='ambiguous_network_failure'?'submission_ambiguous':'submission_rejected',reason,httpStatus:e instanceof APIError?e.statusCode:undefined,model,input});
      await save(`${dir}/production-status.json`,{status:'blocked',provider:'Higgsfield',stage:id,reason,httpStatus:e instanceof APIError?e.statusCode:undefined,completedExport:false,updatedAt:new Date().toISOString()});
      throw new Error(`Higgsfield ${id}: ${reason}. State retained; no automatic duplicate submission.`);
    }
    await save(pending,{...result,model,input});
  }
  if(!result.request_id)throw new Error('Higgsfield request ID missing; inspect before resubmitting.');
  const requestId=result.request_id,started=Date.now();let last='';
  while(!['completed','failed','nsfw','moderated','canceled','cancelled'].includes(result.status)){
    if(Date.now()-started>30*60*1000)throw new Error('Higgsfield polling timed out; request retained.');
    await new Promise(resolve=>setTimeout(resolve,15000));
    const r=await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(requestId)}/status`,{headers:{Authorization:`Key ${credentials}`},signal:AbortSignal.timeout(60000)});
    if(!r.ok)throw new Error(`Higgsfield status HTTP ${r.status}; request retained.`);
    result=await r.json();await save(pending,{...result,request_id:requestId,model,input});
    if(last!==result.status){console.log(`${id}: ${['queued','in_progress','completed','failed','nsfw','moderated','canceled','cancelled'].includes(result.status)?result.status:'waiting'}`);last=result.status;}
  }
  if(result.status!=='completed'||!(result.images?.[0]?.url||result.video?.url))throw new Error(`Higgsfield ${id}: generation unsuccessful; state retained.`);
  await save(done,{...result,request_id:requestId,model,input});return result;
}
async function download(url,p){if(await exists(p))return;const r=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw new Error(`Higgsfield download HTTP ${r.status}`);await writeFile(p,Buffer.from(await r.arrayBuffer()));}
async function main(){
 loadEnvFile(`${root}.env.local`);credentials=process.env.HF_CREDENTIALS;key=process.env.ELEVENLABS_API_KEY;
 if(!credentials||!key)throw Error('Configure missing service keys locally in .env.local.');
 config({credentials,maxRetries:0});for(const sub of ['references','qa','elevenlabs','demo'])await mkdir(`${dir}/${sub}`,{recursive:true});
 const stage=process.argv[2];
 if(stage==='status'){
  for(const name of (await readdir(dir)).filter(n=>n.endsWith('.pending.json'))){const p=`${dir}/${name}`,d=JSON.parse(await readFile(p,'utf8'));if(!d.request_id||!wants(name.replace('.pending.json','')))continue;const r=await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(d.request_id)}/status`,{headers:{Authorization:`Key ${credentials}`},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`Higgsfield status HTTP ${r.status}`);const current=await r.json();await save(p,{...current,request_id:d.request_id,model:d.model,input:d.input});console.log(`${name}: ${current.status}`);}
 }else if(stage==='batch'){
  const all=JSON.parse(await readFile(`${root}scripts/girls-trip-shots.json`,'utf8')).filter(s=>wants(s.id));
  for(const group of [all.filter(s=>!s.lines),all.filter(s=>s.lines)]){
   const queue=[...group];const workers=Array.from({length:3},async()=>{while(queue.length){const s=queue.shift();await new Promise((resolve,reject)=>{const c=spawn(process.execPath,[new URL(import.meta.url).pathname,'scenes',`--only=${s.id}`],{stdio:'inherit'});c.on('error',reject);c.on('exit',code=>code===0?resolve():reject(Error(`Higgsfield ${s.id}: production step unsuccessful.`)));});}});await Promise.all(workers);
  }
 }else if(stage==='references'){
  const sources=JSON.parse(await readFile(`${dir}/references/download-sources.json`,'utf8'));
  for(let i=0;i<sources.length;i++){const [user,file,token]=sources[i],p=`${dir}/references/friend${i+1}.png`;if(await exists(p))continue;const url=`https://firebasestorage.googleapis.com/v0/b/tipstotripchat.firebasestorage.app/o/${encodeURIComponent(`users/${user}/profile/${file}`)}?alt=media&token=${token}`;const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`Reference ${i+1}: HTTP ${r.status}`);await writeFile(p,Buffer.from(await r.arrayBuffer()));console.log(`Reference ${i+1} downloaded.`);}
 }else if(stage==='audio'){
  await save(`${dir}/elevenlabs/casting.json`,{voices,narrator:'friend4',source:'Four distinct existing adult female ElevenLabs voices; no cloning.'});
  for(const s of spec.dialogues){if(!wants(s.id))continue;const file=`${dir}/elevenlabs/${s.id}.mp3`,meta=file+'.json',pending=file+'.pending.json';
   if(!(await exists(file))){if(await exists(pending))throw Error(`ElevenLabs ${s.id}: pending request requires inspection.`);const input={text:s.text,model_id:'eleven_multilingual_v2',voice_settings:{stability:.42,similarity_boost:.78,style:.25,use_speaker_boost:true,speed:1.10},seed:110100+spec.dialogues.indexOf(s)};await save(pending,{status:'submission_started',voiceId:voices[s.speaker],input});const r=await eleven(`/v1/text-to-speech/${voices[s.speaker]}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const d=await r.json();if(!d.audio_base64||!d.alignment)throw Error('ElevenLabs output incomplete.');await writeFile(file,Buffer.from(d.audio_base64,'base64'));delete d.audio_base64;await save(meta,{...d,input,voiceId:voices[s.speaker],requestId:r.headers.get('request-id')});}
   const m=JSON.parse(await readFile(meta,'utf8')),sourceDuration=duration(file),speechEnd=m.alignment.character_end_times_seconds.at(-1),speed=Math.max(1,speechEnd/(s.slot-.08));
   if(speed>1.3)throw Error(`ElevenLabs ${s.id}: source needs timing revision (${sourceDuration.toFixed(2)}s for ${s.slot}s).`);
   ff(['-i',file,'-af',`atempo=${speed},apad,atrim=duration=${s.slot}`,'-ar','48000','-ac','1','-c:a','pcm_s16le',`${dir}/elevenlabs/${s.id}.wav`]);await save(meta,{...m,sourceDuration,speed,slot:s.slot,at:s.at,preparedAlignment:{characters:m.alignment.characters,character_start_times_seconds:m.alignment.character_start_times_seconds.map(v=>v/speed),character_end_times_seconds:m.alignment.character_end_times_seconds.map(v=>v/speed)}});console.log(`${s.id}: prepared (${sourceDuration.toFixed(2)}s, tempo ${speed.toFixed(3)}).`);
  }
 }else if(stage==='transcribe'){
  for(const s of spec.dialogues){if(!wants(s.id))continue;const p=`${dir}/qa/${s.id}.scribe.json`;if(await exists(p)){console.log(`${s.id}: ${JSON.parse(await readFile(p,'utf8')).text}`);continue;}if(await exists(p+'.pending.json'))throw Error('ElevenLabs transcription pending.');const form=new FormData();form.append('file',new Blob([await readFile(`${dir}/elevenlabs/${s.id}.wav`)],{type:'audio/wav'}),'speech.wav');form.append('model_id','scribe_v2');form.append('language_code','en');form.append('tag_audio_events','false');await save(p+'.pending.json',{status:'submission_started'});const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:form})).json();await save(p,d);console.log(`${s.id}: ${d.text}`);}
 }else if(stage==='cast'){
  const refs=await Promise.all(spec.cast.map(c=>upload(`${dir}/references/${c.id}.png`,'image/png')));
  const r=await generate('cast-master','marketing-studio/image',{prompt:`Photorealistic cinematic travel comedy commercial. Four white adult female friends, aged 25 to 26. Identity reference images 1, 2, 3, 4 correspond exactly to four different women, in this left-to-right order: ${spec.cast.map((c,i)=>`${i+1}: ${c.name}, ${c.wardrobe}`).join('; ')}. Preserve their reference faces and hair, distinct identities. All four sit side by side on one sofa in a cosy modern apartment, slightly crowded together, coffee table in foreground with laptop seen from behind, snacks, travel notes and phones. All four faces fully visible, equally sharp on one plane, close friendly ensemble framing, landscape 4:3, front-facing seated row with each face equally large and unobscured. Natural gentle comic frustration, all four look towards the camera, phones held with screens towards themselves. Exactly four adult women, no extra people, no men, nobody in foreground obscuring faces. Modest relaxed gestures, lips closed, no speech. Photographic skin and realistic anatomy, warm natural light, no text, logos or generated UI.`,image_urls:refs,quality:'high',resolution:'2k',aspect_ratio:'4:3',enhance_prompt:false,moderation:'auto'});await download(r.images[0].url,`${dir}/cast-master.png`);console.log('Cast reference ready for review.');
 }else if(stage==='scenes'){
  const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw Error('Cast review required.');const shots=JSON.parse(await readFile(`${root}scripts/girls-trip-shots.json`,'utf8'));
  for(const s of shots){if(!wants(s.id))continue;let input,model;
   const prompt=s.speaker?`Single-person portrait close-up, EXACTLY ONE adult woman visible throughout, the woman in the image reference. Keep her exact identity, hair and clothes. Fixed locked camera at eye level, fixed framing from head to upper torso. No zooming out, no pullback, no reframing, no cuts. No other faces, no other people at any point. She addresses friends outside the frame. Same sofa and apartment background as reference. ${s.prompt} Relaxed natural speaking performance, subtle facial expressions, realistic anatomy. No music, additional speech, text, logos or interface. `:`Realistic warm cinematic travel comedy, portrait 9:16. Preserve the exact four adult women and their facial identity, hair and clothes from the reference. Left to right in the group reference: ${spec.cast.map(c=>`${c.name}, ${c.wardrobe}`).join('; ')}. ${s.prompt} Natural small gestures, relaxed shoulders, believable phone handling, phone screens always face the women. No extra people, no text, captions, logos or generated interface. `;
   if(s.speaker){const audio=`${dir}/elevenlabs/${s.line}.wav`,drive=`${dir}/elevenlabs/${s.id}-driving.wav`;ff(['-i',audio,'-af',`apad,atrim=duration=${s.duration}`,'-ar','48000','-ac','1',drive]);input={prompt:prompt+`The only visible speaker is ${spec.cast.find(c=>c.id===s.speaker).name}. Speak exactly with precise lip synchronisation to the supplied audio: "${spec.dialogues.find(d=>d.id===s.line).text}". Respect every pause, mouth closed during silence.`,image_url:await upload(`${dir}/${s.speaker}-portrait.png`,'image/png'),audio_url:await upload(drive,'audio/wav'),duration:s.duration,resolution:'720p',prompt_extend:false,negative_prompt:'identity change, distorted hands, text, music, extra speech, cuts',seed:110300+shots.indexOf(s)};model='wan/v2.7/image-to-video';}
   else if(s.lines){const lines=spec.dialogues.filter(d=>s.lines.includes(d.id)),drive=`${dir}/elevenlabs/${s.id}-driving.wav`,inp=lines.flatMap(d=>['-i',`${dir}/elevenlabs/${d.id}.wav`]);const chains=lines.map((d,i)=>`[${i}:a]volume=${d.id.startsWith('cta-')?.48:1},adelay=${Math.round((d.at-s.at)*1000)}:all=1[a${i}]`);ff([...inp,'-filter_complex',chains.join(';')+';'+lines.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${lines.length}:normalize=0,apad,atrim=duration=${s.duration}[a]`,'-map','[a]','-ar','48000','-ac','1',drive]);input={prompt:prompt+`Precise lip sync with the driving audio. Speaker timeline: ${lines.map(d=>`${(d.at-s.at).toFixed(2)} seconds: ${spec.cast.find(c=>c.id===d.speaker).name} says "${d.text}"`).join('; ')}. Only assigned speaker moves lips, all four speak the CTA together.`,image_url:await upload(`${dir}/${s.base}-frame.png`,'image/png'),audio_url:await upload(drive,'audio/wav'),duration:s.duration,resolution:'720p',prompt_extend:false,negative_prompt:'identity change, distorted hands, text, music, extra speech, cuts',seed:110300+shots.indexOf(s)};model='wan/v2.7/image-to-video';}
   else{input={prompt,image_urls:[await upload(`${dir}/cast-master.png`,'image/png')],duration:s.duration,resolution:'720p',aspect_ratio:'9:16',prompt_extend:false,generate_audio:false,enable_thinking:false,seed:110300+shots.indexOf(s)};model='alibaba/wan-3.0-prime/reference-to-video';}
   const r=await generate(s.id,model,input);await download(r.video.url,`${dir}/${s.id}.mp4`);if(s.frame)ff(['-ss','0.2','-i',`${dir}/${s.id}.mp4`,'-frames:v','1',`${dir}/${s.id}-frame.png`]);console.log(`${s.id}: downloaded.`);
  }
 }else if(stage==='music'){
  for(const t of [{id:'music-tension',length:12000,prompt:'Instrumental only, light comic holiday planning chaos, sparse pizzicato and marimba, playful gentle ticking percussion, no vocals, no speech, lots of room for dialogue.'},{id:'music-adventure',length:48000,prompt:'Instrumental only, sunny upbeat pop travel advert, warm acoustic guitar, light lively drums, joyful bass and handclaps, 108 BPM, energetic friendship holiday in Barcelona, warm sunset ending with a clean resolved four-second logo hold, no vocals, no speech, room for dialogue.'}]){if(!wants(t.id))continue;const p=`${dir}/elevenlabs/${t.id}.mp3`;if(await exists(p))continue;if(await exists(p+'.pending.json'))throw Error('ElevenLabs music pending.');const input={prompt:t.prompt,music_length_ms:t.length,model_id:'music_v1',force_instrumental:true};await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/music?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{status:'completed',input,requestId:r.headers.get('request-id')});console.log(`${t.id}: downloaded.`);}
 }else throw Error('Choose references, cast, audio, transcribe, scenes or music.');
}
main().catch(e=>{console.error(e instanceof Error&&/^(Higgsfield|ElevenLabs|Configure|Reference|Cast|Choose)/.test(e.message)?e.message:'Production incomplete; saved request states retained. No raw service errors logged.');process.exitCode=1;});
