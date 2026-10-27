import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile, access, copyFile, rename } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { config, higgsfield, APIError, AuthenticationError, NotEnoughCreditsError } from '@higgsfield/client/v2';

const root = fileURLToPath(new URL('../', import.meta.url));
const french=process.argv.includes('--french');
const business=process.argv.includes('--business');
const meetBuddy=process.argv.includes('--meet-buddy');
const audioDriven=french||business||meetBuddy;
const appDemoFinish=business&&french&&process.argv.includes('--app-demo-finish');
const dir = `${root}artifacts/${meetBuddy?'meet-buddy-en':business?`ugc-business-${french?'fr':'es'}`:french?'ugc-product-fr':'ugc-product-es'}`;
type Result = { status: string; request_id: string; images?: Array<{url: string}>; video?: {url: string} };
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
async function main() {
  loadEnvFile(`${root}.env.local`);
  const credentials = process.env.HF_CREDENTIALS;
  if (!credentials || !/^[^:\s]+:[^:\s]+$/.test(credentials)) throw new Error('Configure credentials locally');
  config({credentials, maxRetries: 0});
  await mkdir(dir,{recursive:true});
  const spec = JSON.parse(await readFile(`${root}scripts/${meetBuddy?'meet-buddy-english':business?`ugc-business-${french?'french':'spanish'}`:`ugc-product-${french?'french':'spanish'}`}.json`,'utf8')) as {appearance:string;dialogues:string[];performancePrompt?:string};
  async function generate(id: string, model: string, input: Record<string,unknown>): Promise<Result> {
    const complete = `${dir}/${id}.json`, pending = `${dir}/${id}.pending.json`;
    if (await exists(complete)) { console.log(`Reusing completed ${id}.`); return JSON.parse(await readFile(complete,'utf8')); }
    if(await exists(pending)){
      const saved=JSON.parse(await readFile(pending,'utf8'));
      if(saved.status==='submission_rejected'&&process.argv.includes('--retry-rejected'))await rename(pending,`${pending}.rejected-${Date.now()}`);
      if(saved.status==='failed'&&process.argv.includes('--retry-failed'))await rename(pending,`${pending}.failed-${Date.now()}`);
    }
    let result: Result;
    if (await exists(pending)) { result=JSON.parse(await readFile(pending,'utf8')); console.log(`Resuming ${id}; no new billable submission.`); }
    else {
      // Record intent before submission; an ambiguous network failure must not resubmit.
      await writeFile(pending,JSON.stringify({status:'submission_started',model,input},null,2));
      console.log(`Submitting ${id} through Higgsfield (billable).`);
      try{result=await higgsfield.subscribe(model,{input,withPolling:false});}
      catch(error){
        if(error instanceof AuthenticationError||error instanceof APIError&&[400,403,404,422].includes(error.statusCode??0))await writeFile(pending,JSON.stringify({status:'submission_rejected',httpStatus:error instanceof AuthenticationError?401:(error as APIError).statusCode,model,input},null,2));
        throw error;
      }
      await writeFile(pending,JSON.stringify({...result,model,input},null,2));
    }
    if (!result.request_id) throw new Error('Ambiguous request: inspect service before resubmitting');
    const started=Date.now(); let previous=''; let lastNotice=0;
    while (!['completed','failed','nsfw','moderated','canceled','cancelled'].includes(result.status)) {
      if (Date.now()-started>35*60*1000) throw new Error('Polling timeout; pending request saved');
      await new Promise(resolve=>setTimeout(resolve,15000));
      const response=await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(result.request_id)}/status`,{headers:{Authorization:`Key ${credentials}`},signal:AbortSignal.timeout(60000)});
      if(!response.ok) { if(response.status>=500) continue; throw new Error('Status request rejected'); }
      result=await response.json() as Result;
      await writeFile(pending,JSON.stringify({...result,model,input},null,2));
      if(result.status!==previous || Date.now()-lastNotice>60000) { console.log(`${id}: ${['queued','in_progress','completed','failed','nsfw','moderated','canceled','cancelled'].includes(result.status)?result.status:'waiting'}`);previous=result.status;lastNotice=Date.now(); }
    }
    if(result.status!=='completed' || !(result.video?.url || result.images?.[0]?.url)) throw new Error('Generation unsuccessful; request state saved');
    await writeFile(complete,JSON.stringify({...result,model,input},null,2));
    console.log(`${id} completed.`);
    return result;
  }
  async function download(url: string, path: string) {
    if(await exists(path)) return;
    if(new URL(url).protocol!=='https:') throw new Error('Invalid output URL');
    const r=await fetch(url,{signal:AbortSignal.timeout(180000)});
    if(!r.ok) throw new Error('Output download failed');
    await writeFile(path,Buffer.from(await r.arrayBuffer()));
  }
  const portrait=await generate(french?'presenter-portrait-clean':'presenter-portrait','higgsfield-ai/soul/v2/standard',{prompt:spec.appearance,batch_size:1,resolution:'1080p',aspect_ratio:'9:16',enhance_prompt:false,seed:meetBuddy?250107:business?(french?211117:211107):french?221111:2206});
  if(french)await writeFile(`${dir}/presenter-portrait.json`,JSON.stringify({...portrait,model:'higgsfield-ai/soul/v2/standard'},null,2));
  let imageUrl=portrait.images![0]!.url;
  await download(imageUrl,`${dir}/${french?'presenter-reference-clean.png':'presenter-reference.png'}`);
  if(french)await copyFile(`${dir}/presenter-reference-clean.png`,`${dir}/presenter-reference.png`);
  if(process.argv.includes('--portrait-only')) return;
  if(audioDriven) {
    function ffmpeg(args:string[]){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(r.status!==0)throw new Error('French media preparation failed');}
    async function upload(path:string,contentType='audio/wav'){
      const meta=path+'.upload.json';if(await exists(meta))return JSON.parse(await readFile(meta,'utf8')).url as string;
      const response=await fetch('https://api.higgsfield.ai/files/generate-upload-url',{method:'POST',headers:{Authorization:`Key ${credentials}`,'Content-Type':'application/json'},body:JSON.stringify({content_type:contentType}),signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw new Error('Audio upload slot unavailable');
      const info=await response.json() as {upload_url:string;public_url:string;upload_headers:Record<string,string>};
      if(new URL(info.upload_url).protocol!=='https:'||new URL(info.public_url).protocol!=='https:')throw new Error('Invalid upload URL');
      const put=await fetch(info.upload_url,{method:'PUT',headers:info.upload_headers,body:new Uint8Array(await readFile(path)),signal:AbortSignal.timeout(120000)});
      if(!put.ok)throw new Error('Audio upload failed');await writeFile(meta,JSON.stringify({url:info.public_url},null,2));return info.public_url;
    }
    if(business||meetBuddy){
      const review=JSON.parse(await readFile(`${dir}/portrait-review.json`,'utf8'));
      if(!review.preparedPortraitApproved)throw new Error('Review the clean business portrait before animation');
      imageUrl=await upload(`${dir}/presenter-reference-cropped.png`,'image/png');
    }
    if(meetBuddy&&process.argv.includes('--native-performance')) {
      const selected=Number(process.argv.find(v=>v.startsWith('--part='))?.split('=')[1]??0);
      const results=await Promise.allSettled(spec.dialogues.map(async(_dialogue,i)=>{
        if(selected&&selected!==i+1)return;
        const standard=process.argv.includes('--wan-standard');
        const id=`native${standard?'-standard':''}-segment-0${i+1}`;
        const prompt=`The same fictional adult British woman aged 25 in the starting portrait speaks directly to camera in natural British English. Preserve her face, copper brown hair, outfit, background and framing. One continuous relaxed eye-level chest-up creator take. Her mouth starts speaking immediately within the first quarter second. Friendly energetic trustworthy delivery, comfortable shoulders, calm breathing, subtle gestures and natural expressions. Speak the exact script clearly at a conversational pace, finish within 14 seconds and rest silently afterwards. Clean dry dialogue only, no music, no sound effects, no subtitles, no overlays, no extra words. EXACT SPOKEN SCRIPT: "${spec.dialogues[i]}"`;
        const r=await generate(id,standard?'alibaba/wan-3.0/image-to-video':'alibaba/wan-3.0-prime/image-to-video',{prompt,image_url:imageUrl,duration:15,resolution:'720p',aspect_ratio:'9:16',generate_audio:true,enable_thinking:false,seed:250507+i});
        await download(r.video!.url,`${dir}/${id}.mp4`);
      }));
      if(results.some(r=>r.status==='rejected'))throw new Error('Native presenter performance incomplete');
      return;
    }
    const ids=spec.dialogues.slice(0,appDemoFinish?2:undefined).map((_,i)=>`presenter-segment-0${i+1}`);
    if(appDemoFinish)for(const id of ids)if(!(await exists(`${dir}/${id}.json`)))throw new Error('Complete the accepted presenter takes before assembling the app demonstration finish');
    const results=await Promise.allSettled(ids.map(async(id,i)=>{
      const wav=`${dir}/elevenlabs/segment-0${i+1}.wav`;
      if(!(await exists(wav)))throw new Error('Prepare French ElevenLabs narration before visuals');
      const audioUrl=await upload(wav);
      const prompt=spec.performancePrompt??(business?'The fictional adult 21-year-old Spanish UGC creator in the supplied portrait speaks exactly in synchronization with the supplied Spanish driving audio. Preserve her distinct identity, low dark ponytail, outfit, cafe workspace and daylight. Friendly energetic trustworthy conversational performance: natural warm eye contact, small purposeful gestures, occasional genuine gentle smile and expressive eyebrows. She looks rested and comfortable, shoulders relaxed, breathing effortless. Explain like a knowledgeable friend, never an overexcited announcer. One continuous chest-up take with fixed eye-level smartphone camera, no cuts or camera movement. Follow every speech onset and pause from the supplied audio; close her lips naturally and rest during silence. No additional speech, music, sound effects, screens, interface, captions, text, logos or watermarks.':'The fictional adult 22-year-old French travel creator in the supplied portrait speaks naturally, precisely synchronized with the supplied French driving audio. Preserve her distinct auburn bob, face, outfit, room and soft daylight. She looks rested and comfortable, with relaxed shoulders and effortless breathing. Warm engaged eye contact, occasional gentle smile, subtle eyebrow expression and small unhurried hand gestures. Energetic friendly confidence without theatrical excitement or excessive movement. Fixed eye-level smartphone camera, one continuous chest-up take, no cuts or camera motion. Use only the exact speech and pauses in the provided audio. No additional speech, music, effects, text or branding.');
      const r=await generate(id,'wan/v2.7/image-to-video',{prompt,image_url:imageUrl,audio_url:audioUrl,duration:15,resolution:business&&french?'1080p':'720p',prompt_extend:false,negative_prompt:'exhausted expression, strained breathing, exaggerated gestures, frantic movement, shouting, subtitles, text, watermark, scene cuts, extra people',seed:(meetBuddy?250207:business?(french?211217:211207):221007)+i});
      await download(r.video!.url,`${dir}/${id}.mp4`);
    }));
    if(results.some(r=>r.status==='rejected'))throw new Error('French presenter segments incomplete');
    for(const part of appDemoFinish?[1]:[1,2]){
      const selected=ids.slice((part-1)*2,part*2),list=`${dir}/presenter-0${part}.concat.txt`;
      await writeFile(list,selected.map(id=>`file '${id}.mp4'`).join('\n'));
      if(business&&french||meetBuddy){
        // Each segment is exactly 15 seconds on the edit timeline. AAC tails
        // must not move the second segment's performance relative to narration.
        const inputs=selected.flatMap(id=>['-i',`${dir}/${id}.mp4`]);
        ffmpeg([...inputs,'-filter_complex','[0:a]atrim=duration=15,asetpts=PTS-STARTPTS[a0];[1:a]atrim=duration=15,asetpts=PTS-STARTPTS[a1];[a0][a1]concat=n=2:v=0:a=1[a]','-map','[a]','-ac','1','-ar','16000','-c:a','pcm_s16le',`${dir}/presenter-0${part}.wav`]);
        ffmpeg([...inputs,'-i',`${dir}/elevenlabs/presenter-0${part}.mp3`,'-filter_complex','[0:v]trim=duration=15,setpts=PTS-STARTPTS,fps=30[v0];[1:v]trim=duration=15,setpts=PTS-STARTPTS,fps=30[v1];[v0][v1]concat=n=2:v=1:a=0[v]','-map','[v]','-map','2:a','-r','30','-frames:v','900','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-t','30','-movflags','+faststart',`${dir}/presenter-0${part}.mp4`]);
        await writeFile(`${dir}/presenter-0${part}.json`,JSON.stringify({status:'completed',model:'wan/v2.7/image-to-video',segments:selected,drivingAudio:`elevenlabs/presenter-0${part}.mp3`,segmentDurationNormalized:15,resolution:meetBuddy?'720p':'1080p'},null,2));
        continue;
      }
      // Keep the model's actual driving audio for an independent timing check.
      ffmpeg(['-f','concat','-safe','0','-i',list,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',`${dir}/presenter-0${part}.wav`]);
      ffmpeg(['-reinit_filter','0','-f','concat','-safe','0','-i',list,'-i',`${dir}/elevenlabs/presenter-0${part}.mp3`,'-map','0:v','-map','1:a','-vf','fps=30,tpad=stop_mode=clone:stop_duration=1,trim=duration=30','-r','30','-fps_mode','cfr','-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-ar','48000','-t','30','-movflags','+faststart',`${dir}/presenter-0${part}.mp4`]);
      await writeFile(`${dir}/presenter-0${part}.json`,JSON.stringify({status:'completed',model:'wan/v2.7/image-to-video',segments:selected,drivingAudio:`elevenlabs/presenter-0${part}.mp3`},null,2));
    }
    if(appDemoFinish)await writeFile(`${dir}/production-mode.json`,JSON.stringify({presenterParts:[1],presenterSegments:ids,appDemonstrationOnlyFrom:30,additionalPresenterRequests:{status:'submission_rejected',httpStatus:403,reason:'Insufficient Higgsfield credits',segments:['presenter-segment-03','presenter-segment-04']},remainingNarration:'Fresh ElevenLabs French voiceover over actual app demonstrations',videoDurationSeconds:60},null,2));
    console.log(`${business?`${french?'French':'Spanish'} business`:'French'} audio-driven presenter completed and downloaded.`);return;
  }
  if(process.argv.includes('--repair-second')) {
    function ffmpeg(args:string[]) {const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(r.status!==0)throw new Error('Repair media preparation failed');}
    const voiceFile=`${dir}/elevenlabs/presenter-02-repair.mp3`;
    const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',voiceFile],{encoding:'utf8'});
    if(probe.status!==0)throw new Error('Repair narration missing');
    const length=Number(JSON.parse(probe.stdout).format.duration);
    const speed=length>29.7?length/29.7:1;
    const prepared=`${dir}/elevenlabs/presenter-02-repair-30s.wav`;
    ffmpeg(['-i',voiceFile,'-af',`atempo=${speed},apad,atrim=duration=30`,'-ar','44100','-ac','1',prepared]);
    async function upload(path:string) {
      const meta=path+'.upload.json';if(await exists(meta))return JSON.parse(await readFile(meta,'utf8')).url as string;
      const response=await fetch('https://api.higgsfield.ai/files/generate-upload-url',{method:'POST',headers:{Authorization:`Key ${credentials}`,'Content-Type':'application/json'},body:JSON.stringify({content_type:'audio/wav'}),signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw new Error('Audio upload slot unavailable');
      const info=await response.json() as {upload_url:string;public_url:string;upload_headers:Record<string,string>};
      if(new URL(info.upload_url).protocol!=='https:')throw new Error('Invalid upload URL');
      const put=await fetch(info.upload_url,{method:'PUT',headers:info.upload_headers,body:new Uint8Array(await readFile(path)),signal:AbortSignal.timeout(120000)});
      if(!put.ok)throw new Error('Audio upload failed');
      await writeFile(meta,JSON.stringify({url:info.public_url},null,2));return info.public_url;
    }
    const ids=['presenter-02-repair-a','presenter-02-repair-b'];
    const repaired=await Promise.allSettled(ids.map(async(id,i)=>{
      const wav=`${dir}/elevenlabs/${id}.wav`;
      ffmpeg(['-ss',String(i*15),'-i',prepared,'-t','15','-ar','44100','-ac','1',wav]);
      const audioUrl=await upload(wav);
      const prompt='The same adult Spanish travel creator from the supplied image speaks exactly in synchronization with the supplied Spanish driving audio. Preserve her face, outfit, apartment and natural smartphone composition. Fixed camera, one uninterrupted close-up take, lively friendly direct eye contact, subtle natural hand gestures. All speech and pauses come from the supplied audio only; no additional dialogue, music, sound effects, text, logos or cuts.';
      const r=await generate(id,'wan/v2.7/image-to-video',{prompt,image_url:imageUrl,audio_url:audioUrl,duration:15,resolution:'720p',prompt_extend:false,negative_prompt:'subtitles, text, watermarks, extra voices, scene cuts',seed:2207+i});
      await download(r.video!.url,`${dir}/${id}.mp4`);
    }));
    if(repaired.some(r=>r.status==='rejected'))throw new Error('Audio-driven repair incomplete');
    await writeFile(`${dir}/repair-concat.txt`,ids.map(id=>`file '${id}.mp4'`).join('\n'));
    ffmpeg(['-f','concat','-safe','0','-i',`${dir}/repair-concat.txt`,'-i',prepared,'-map','0:v','-map','1:a','-c:v','libx264','-preset','fast','-crf','18','-r','30','-c:a','aac','-b:a','192k','-ar','48000','-t','30','-movflags','+faststart',`${dir}/presenter-02-repaired.mp4`]);
    for(const file of ['presenter-02.mp4','presenter-02.json','presenter-02.wav','presenter-02.transcript.json','elevenlabs/presenter-02.mp3','elevenlabs/presenter-02.json','elevenlabs/presenter-02.wav','elevenlabs/presenter-02.transcript.json']) {
      const original=`${dir}/${file}`,backup=original.replace('presenter-02','presenter-02-native-rejected');
      if(await exists(original)&&!(await exists(backup)))await copyFile(original,backup);
    }
    await copyFile(`${dir}/presenter-02-repaired.mp4`,`${dir}/presenter-02.mp4`);
    await writeFile(`${dir}/presenter-02.json`,JSON.stringify({status:'completed',model:'wan/v2.7/image-to-video',segments:ids,drivingAudio:'elevenlabs/presenter-02-repair-30s.wav',reason:'Original Wan 3.0 second take failed speech intelligibility review.'},null,2));
    ffmpeg(['-i',prepared,'-c:a','libmp3lame','-b:a','128k',`${dir}/elevenlabs/presenter-02.mp3`]);
    const voice=JSON.parse(await readFile(`${dir}/elevenlabs/presenter-02-repair.json`,'utf8'));
    await writeFile(`${dir}/elevenlabs/presenter-02.json`,JSON.stringify({...voice,preparedDurationSeconds:30,speed},null,2));
    console.log('Second take repaired using ElevenLabs narration and Higgsfield audio-driven visuals.');return;
  }
  await writeFile(`${dir}/narration.json`,JSON.stringify(spec.dialogues.map((dialogue,i)=>({id:`presenter-0${i+1}`,dialogue})),null,2));
  const results=await Promise.allSettled(spec.dialogues.map(async (dialogue,i)=>{
    const id=`presenter-0${i+1}`;
    const prompt=`Animate the same adult 22-year-old Spanish travel creator from the portrait. Preserve her identity, outfit, background and composition. One continuous relaxed smartphone UGC take, fixed camera, friendly direct eye contact, small natural hand gestures, bright expressive but trustworthy delivery. Native Spanish from Spain. She speaks immediately and finishes the exact complete script within 29 seconds, at around 165 words per minute with natural short pauses. Clean dry dialogue audio, no music, background voices, overlays, subtitles, logos or cutaways. Natural synchronized mouth movement. EXACT dialogue: "${dialogue}"`;
    const r=await generate(id,'alibaba/wan-3.0/image-to-video',{prompt,image_url:imageUrl,duration:30,resolution:'720p',aspect_ratio:'9:16',generate_audio:true,enable_thinking:false});
    await download(r.video!.url,`${dir}/${id}.mp4`);
  }));
  if(results.some(r=>r.status==='rejected')) throw new Error('One or more presenter segments remain incomplete');
  console.log('Both new presenter takes completed and downloaded.');
}
main().catch((error:unknown)=>{
  process.exitCode=1;
  if(error instanceof AuthenticationError) console.error('Higgsfield authentication rejected; check locally.');
  else if(error instanceof NotEnoughCreditsError) console.error('Higgsfield credits or model access unavailable.');
  else if(error instanceof APIError) console.error(`Higgsfield API rejected operation${Number.isInteger(error.statusCode)?` (HTTP ${error.statusCode})`:''}.`);
  else console.error('Product generation incomplete. Saved request state must be checked before resubmitting. No raw errors or credentials logged.');
  process.exitCode=1;
});
