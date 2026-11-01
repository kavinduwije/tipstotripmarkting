import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import sharp from 'sharp';
import {config,higgsfield,APIError,AuthenticationError,NotEnoughCreditsError} from '@higgsfield/client/v2';
const root=new URL('../',import.meta.url).pathname;
const spec=JSON.parse(await readFile(`${root}scripts/group-trip-english.json`,'utf8'));
const dir=`${root}${spec.directory}`;
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const save=(p,d)=>writeFile(p,JSON.stringify(d,null,2));
let credentials,key;
const selected=process.argv.find(v=>v.startsWith('--only='))?.slice(7);
const take=process.argv.find(v=>v.startsWith('--take='))?.slice(7);
const wants=id=>!selected||selected.split(',').includes(id);
const voices={friend1:'EXAVITQu4vr4xnSDxMaL',friend2:'TX3LPaxmHKxFdv7VOQHJ',friend3:'FGY2WhTYpPnrIDTdsKH5',friend4:'bIHbv24MWmeRgasZH58o'};
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
  if(!credentials||!key)throw new Error('Configure missing service keys locally in .env.local.');
  config({credentials,maxRetries:0});await mkdir(`${dir}/elevenlabs`,{recursive:true});await mkdir(`${dir}/qa`,{recursive:true});
  if(process.argv[2]==='cast'){
    const result=await generate('cast-master-v2','higgsfield-ai/soul/v2/standard',{prompt:spec.masterPrompt.replace('vertical 9:16','landscape 4:3').replace('around a small rectangular cafe table','seated side by side in a single straight row behind a rectangular dining table, all four facing the camera, nobody in foreground').replace('Medium wide frontal composition','Wide symmetrical frontal group portrait, all four faces on the same plane, each face fully visible and equally sharp, no person turned away. Medium wide frontal composition'),seed:281002,batch_size:1,resolution:'1080p',aspect_ratio:'4:3',enhance_prompt:false});
    await download(result.images[0].url,`${dir}/cast-master-v2.png`);
    console.log('Cast master downloaded; visual review required before scene generation.');
  }else if(process.argv[2]==='audio'){
    await save(`${dir}/elevenlabs/casting.json`,{voices,selection:'Four distinct existing ElevenLabs voices, new to this project’s prior campaigns. No new saved voice slots or cloning used.',accents:'International English; youthful conversational performances.',narrator:'friend2'});
    for(const s of spec.dialogues){if(!wants(s.id))continue;
      const file=`${dir}/elevenlabs/${s.id}.mp3`,meta=file+'.json',pending=file+'.pending.json';
      if(!(await exists(file))){
        if(await exists(pending))throw new Error(`ElevenLabs ${s.id}: existing pending request; inspect before resubmitting.`);
        const input={text:s.text,model_id:'eleven_multilingual_v2',voice_settings:{stability:.4,similarity_boost:.78,style:.22,use_speaker_boost:true,speed:1.03},seed:281100+spec.dialogues.indexOf(s)};
        await save(pending,{status:'submission_started',voiceId:voices[s.speaker],input});
        const r=await eleven(`/v1/text-to-speech/${voices[s.speaker]}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});const d=await r.json();
        if(!d.audio_base64||!d.alignment)throw new Error('ElevenLabs speech output incomplete.');
        await writeFile(file,Buffer.from(d.audio_base64,'base64'));delete d.audio_base64;await save(meta,{...d,input,voiceId:voices[s.speaker],requestId:r.headers.get('request-id')});
      }
      const m=JSON.parse(await readFile(meta,'utf8')),sourceDuration=duration(file),speechEnd=m.alignment.character_end_times_seconds.at(-1),speed=Math.max(1,speechEnd/(s.slot-.12));
      if(speed>1.2)throw new Error(`ElevenLabs ${s.id}: exceeds comfortable timing (${sourceDuration.toFixed(2)}s for ${s.slot}s slot).`);
      ff(['-i',file,'-af',`atempo=${speed},apad,atrim=duration=${s.slot}`,'-ar','48000','-ac','1','-c:a','pcm_s16le',`${dir}/elevenlabs/${s.id}.wav`]);
      await save(meta,{...m,sourceDuration,speed,slot:s.slot,at:s.at,preparedAlignment:{characters:m.alignment.characters,character_start_times_seconds:m.alignment.character_start_times_seconds.map(v=>v/speed),character_end_times_seconds:m.alignment.character_end_times_seconds.map(v=>v/speed)}});
      console.log(`${s.id}: ready, ${sourceDuration.toFixed(2)}s source, speed ${speed.toFixed(3)}.`);
    }
  }else if(process.argv[2]==='transcribe'){
    for(const s of spec.dialogues){if(!wants(s.id))continue;const p=`${dir}/qa/${s.id}.scribe.json`;if(await exists(p)){console.log(`${s.id}: ${JSON.parse(await readFile(p,'utf8')).text}`);continue;}if(await exists(p+'.pending.json'))throw new Error('ElevenLabs speech review pending; inspect before retry.');
      const f=new FormData();f.append('file',new Blob([await readFile(`${dir}/elevenlabs/${s.id}.wav`)],{type:'audio/wav'}),'speech.wav');f.append('model_id','scribe_v2');f.append('language_code','en');f.append('tag_audio_events','false');await save(p+'.pending.json',{status:'submission_started',model:'scribe_v2'});const d=await(await eleven('/v1/speech-to-text',{method:'POST',body:f})).json();await save(p,d);console.log(`${s.id}: ${d.text}`);
    }
  }else if(process.argv[2]==='closeups'){
    const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw new Error('Higgsfield cast needs review.');
    const x={friend1:0,friend2:400,friend3:990,friend4:1448};
    for(const s of spec.dialogues.filter(d=>['hotel','city','messages','table','suggest','handle','find-out','have-plan','agree','lisbon-brief','sunset-idea'].includes(d.id))){
      if(!wants(s.id))continue;
      const c=spec.cast.find(c=>c.id===s.speaker),portrait=`${dir}/${s.speaker}-closeup.png`;
      if(!(await exists(portrait)))await sharp(`${dir}/cast-master-v2.png`).extract({left:x[s.speaker],top:230,width:600,height:1066}).resize(720,1280).png().toFile(portrait);
      const id=`speaking-${s.id}${take?'-'+take:''}`;
      const driving=`${dir}/elevenlabs/${id}-padded.wav`;
      ff(['-i',`${dir}/elevenlabs/${s.id}.wav`,'-af',`apad,atrim=duration=${Math.max(3,Math.ceil(s.slot))}`,'-ar','48000','-ac','1',driving]);
      const r=await generate(id,'wan/v2.7/image-to-video',{prompt:`The same fictional adult ${c.name} in the reference, ${c.appearance}, ${c.wardrobe}. Preserve this exact face and clothing. Natural conversational travel comedy, in the same apartment dining room. The main person speaks exactly in precise lip synchronization with the supplied English audio, following every speech onset and pause. Say only: "${s.text}". ${['hotel','handle','have-plan'].includes(s.id)?'Amused scepticism and questioning eyebrows.':s.id==='messages'?'Looking from a phone just below frame to friends with a lightly overwhelmed expression.':s.id==='table'?'Understated dry comic timing.':s.id==='suggest'?'Has a promising idea, small smile, lifts a phone whose back faces camera.':'Warm conversational delivery, talking to a friend just beside camera.'} Relaxed shoulders, subtle natural facial expressions and unhurried gestures. Keep lips closed in pauses. Fixed eye-level medium close-up, no cuts. No added speech, music, captions, logos or screen UI.`,image_url:await upload(portrait,'image/png'),audio_url:await upload(driving,'audio/wav'),duration:Math.max(3,Math.ceil(s.slot)),resolution:'720p',prompt_extend:false,negative_prompt:'distorted face, changed identity, extra fingers, deformed hands, subtitles, text, logo, watermark, scene cuts, exaggerated gestures',seed:281300+spec.dialogues.indexOf(s)});
      await download(r.video.url,`${dir}/${id}.mp4`);console.log(`${id}: downloaded.`);
    }
  }else if(process.argv[2]==='ensemble'){
    const shots=[{id:'sunset-speaking',base:'sunset-base',at:76,duration:9,lines:['worth-it','better'],direction:'Zoe, the auburn-haired woman in the denim jacket, makes her amused remark, then Leo, the East Asian man in burgundy, replies. Maya and Ben listen with closed mouths. After the replies all four turn quietly to enjoy the sunset.'},{id:take==='seated'?'next-speaking-seated':'next-speaking',base:take==='seated'?'next-base-seated':'next-base',at:85,duration:12,lines:['remember','next','destination-maya','destination-ben','destination-zoe','destination-leo'],direction:'All four friends stay seated around the cafe table throughout, preserving the seated composition and visible tabletop. Maya, the woman in sage green, asks the nostalgic question. All four smile and laugh softly after her line. Ben, the Black man with glasses and cream linen shirt, then asks his question. At the end everyone starts to gesture with destination suggestions, then stops and looks knowingly at Ben’s phone.'},{id:'cta-speaking',base:'cta-base',at:97,duration:4,lines:['cta-maya','cta-ben','cta-zoe','cta-leo'],direction:'All four friends face camera and speak the same short CTA together. They then smile naturally at camera, with comfortable small welcoming gestures.'}];
    for(const s of shots){if(!wants(s.id))continue;
      const image=`${dir}/${s.base}-frame.png`;if(!(await exists(image)))ff(['-ss','1','-i',`${dir}/${s.base}.mp4`,'-frames:v','1',image]);
      const lines=spec.dialogues.filter(d=>s.lines.includes(d.id)),audio=`${dir}/elevenlabs/${s.id}-driving.wav`;
      const inputs=lines.flatMap(d=>['-i',`${dir}/elevenlabs/${d.id}.wav`]);
      const chains=lines.map((d,i)=>`[${i}:a]volume=${s.id==='cta-speaking'?.48:1},adelay=${Math.round((d.at-s.at)*1000)}:all=1[a${i}]`);
      ff([...inputs,'-filter_complex',chains.join(';')+';'+lines.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${lines.length}:normalize=0,apad,atrim=duration=${s.duration}[a]`,'-map','[a]','-ar','48000','-ac','1',audio]);
      const r=await generate(s.id,'wan/v2.7/image-to-video',{prompt:`Preserve the exact four adult friends, their identities, clothing, accessories, location and composition of the image. Realistic premium travel-comedy commercial. ${s.direction} Animate the correct speaker in exact lip synchronization with the supplied English audio, preserving every speech onset and pause, with subtle natural facial expression. Speaker timeline: ${lines.map(d=>`${(d.at-s.at).toFixed(2)} seconds: ${spec.cast.find(c=>c.id===d.speaker).name} says "${d.text}"`).join('; ')}. Other mouths remain closed while listening. Comfortable conversational energy, relaxed shoulders, modest gestures. Fixed eye-level camera, one continuous shot, no cuts, no extra people or dialogue, no music, text, captions, logos or invented interface.`,image_url:await upload(image,'image/png'),audio_url:await upload(audio,'audio/wav'),duration:s.duration,resolution:'720p',prompt_extend:false,negative_prompt:'changing identity, duplicate person, missing friend, deformed hands, subtitles, text, logo, watermark, exaggerated movement, scene cuts',seed:281400+shots.indexOf(s)});await download(r.video.url,`${dir}/${s.id}.mp4`);console.log(`${s.id}: downloaded.`);
    }
  }else if(process.argv[2]==='music'){
    const tracks=[{id:'music-tension',duration:18000,prompt:'Instrumental only. A lightly comic group holiday planning scene: dry pizzicato strings, sparse wooden marimba plucks and quiet ticking percussion, playful mild tension, tasteful and relatable, 100 BPM, no singing or human voice, no dramatic orchestral swell. Leave space for dialogue. End on a brief gentle unresolved pause.'},{id:'music-adventure',duration:87000,prompt:'Instrumental only. Premium upbeat Lisbon friendship travel advertisement, warm indie pop with sunny acoustic guitar, lively light drums, melodic bass, gentle handclaps and subtle Portuguese guitar colour. 106 BPM, optimistic joyful adventure and real shared memories. Starts with a clean bright beat, builds softly for travel montage, feels warm and reflective near the end, resolves naturally with a final four-second logo hold. Polished clean contemporary production, no vocals or spoken words, no chanting, leave space for dialogue.'}];
    for(const t of tracks){if(selected&&t.id!==selected)continue;const p=`${dir}/elevenlabs/${t.id}.mp3`;if(await exists(p))continue;if(await exists(p+'.pending.json'))throw new Error('ElevenLabs music request pending; inspect before retry.');const input={prompt:t.prompt,music_length_ms:t.duration,model_id:'music_v1',force_instrumental:true};await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/music?output_format=mp3_44100_128',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{input,requestId:r.headers.get('request-id'),status:'completed'});console.log(`${t.id}: downloaded.`);}
  }else if(process.argv[2]==='sfx'){
    const effects=[{id:'sigh',duration_seconds:2.0,text:'Exactly four young adult friends, two women and two men, give one small shared frustrated sigh after a planning mishap in a quiet dining room. Natural soft human exhalation, gentle comic resignation, no words, no speech, no music, no exaggerated groaning.'},{id:'laugh',duration_seconds:2.2,text:'A small group of four young adult friends, two women and two men, share a brief soft genuine relaxed laugh at an outdoor cafe. Close natural human chuckles, light and understated, no words, no speech, no music.'}];
    for(const t of effects){const p=`${dir}/elevenlabs/${t.id}.mp3`;if(await exists(p))continue;if(await exists(p+'.pending.json'))throw new Error('ElevenLabs sound request pending; inspect before retry.');const input={text:t.text,duration_seconds:t.duration_seconds,prompt_influence:.4,model_id:'eleven_text_to_sound_v2'};await save(p+'.pending.json',{status:'submission_started',input});const r=await eleven('/v1/sound-generation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await writeFile(p,Buffer.from(await r.arrayBuffer()));await save(p+'.json',{input,status:'completed'});console.log(`${t.id}: downloaded.`);}
  }else if(process.argv[2]==='scenes'){
    const review=JSON.parse(await readFile(`${dir}/qa/cast-review.json`,'utf8'));if(!review.approved)throw new Error('Higgsfield cast reference needs visual review.');
    const master=JSON.parse(await readFile(`${dir}/cast-master-v2.json`,'utf8'));
    const shots=JSON.parse(await readFile(`${root}scripts/group-trip-shots.json`,'utf8'));
    for(const s of shots){if(!wants(s.id))continue;
      const input={prompt:`Realistic premium travel advertisement, vertical 9:16. Use the four people in the supplied cast image as exact identity references. ${spec.cast.map(c=>`${c.name}: ${c.appearance}; wearing ${c.wardrobe}.`).join(' ')} ${spec.continuity} ${s.prompt} Preserve facial identity, hairstyles, clothing and accessories. Conversational and believable performance, relaxed shoulders and natural gestures. Realistic anatomy. No captions, logos, watermarks, invented interface or readable text.`,image_urls:[master.images[0].url],duration:s.duration,resolution:'720p',aspect_ratio:'9:16',prompt_extend:false,generate_audio:!!s.audio,enable_thinking:false,seed:281200+shots.indexOf(s)};
      if(s.audio){
        const lines=spec.dialogues.filter(d=>s.lines.includes(d.id)),p=`${dir}/elevenlabs/${s.id}-driving.wav`;
        const inputs=lines.flatMap(d=>['-i',`${dir}/elevenlabs/${d.id}.wav`]);
        const chains=lines.map((d,i)=>`[${i}:a]adelay=${Math.round((d.at-s.at)*1000)}:all=1[a${i}]`);
        ff([...inputs,'-filter_complex',chains.join(';')+';'+lines.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${lines.length}:normalize=0,apad,atrim=duration=${s.duration}[a]`,'-map','[a]','-ar','48000','-ac','1',p]);
        input.audio_urls=[await upload(p,'audio/wav')];input.prompt+=` Use the supplied audio as the exact performance soundtrack; preserve its wording, four distinct speaker voices, cadence and every pause. Animate only the correct speaker's lips at each cue; listeners keep lips closed. Timing in seconds: ${lines.map(d=>`${(d.at-s.at).toFixed(2)}: ${spec.cast.find(c=>c.id===d.speaker).name} says "${d.text}"`).join('; ')}. Do not add or alter any spoken words. No music.`;
      }
      const result=await generate(s.id,'alibaba/wan-3.0-prime/reference-to-video',input);await download(result.video.url,`${dir}/${s.id}.mp4`);console.log(`${s.id}: downloaded.`);
    }
  }else if(process.argv[2]==='voices'){
    const r=await fetch('https://api.elevenlabs.io/v2/voices?page_size=100',{headers:{'xi-api-key':key},signal:AbortSignal.timeout(60000)});
    if(!r.ok)throw new Error(`ElevenLabs voice list HTTP ${r.status}`);
    const d=await r.json();const voices=(d.voices??[]).map(v=>({id:v.voice_id,name:v.name,category:v.category,labels:v.labels,description:v.description}));
    await save(`${dir}/elevenlabs/available-voices.json`,voices);console.log(JSON.stringify(voices));
  }else throw new Error('Choose cast, voices, audio, transcribe or scenes.');
}
main().catch(e=>{console.error(e instanceof Error&&/^(Higgsfield|ElevenLabs|Configure|Choose|cast-master|Media)/.test(e.message)?e.message:'Production incomplete; saved request states retained. No raw service errors logged.');process.exitCode=1;});
