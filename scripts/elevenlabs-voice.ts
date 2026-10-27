import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const french=process.argv.includes('--french');
const business=process.argv.includes('--business');
const meetBuddy=process.argv.includes('--meet-buddy');
const audioDriven=french||business||meetBuddy;
const product = process.argv.includes('--product')||audioDriven;
const assetDir = `${root}artifacts/${meetBuddy?'meet-buddy-en':business?`ugc-business-${french?'fr':'es'}`:french?'ugc-product-fr':product?'ugc-product-es':'ugc-es'}`;
const out = `${assetDir}/elevenlabs`;
const narrationLabel=meetBuddy?'British English Meet Buddy':business?`${french?'French':'Spanish'} business`:'French';
const productSpec = product ? JSON.parse(await readFile(`${root}scripts/${meetBuddy?'meet-buddy-english':business?`ugc-business-${french?'french':'spanish'}`:`ugc-product-${french?'french':'spanish'}`}.json`, 'utf8')) as {voiceDescription:string;dialogues:string[];musicPrompt:string} : undefined;
const voiceDescription = productSpec?.voiceDescription ?? "A native Spanish woman from Spain, an adult aged 25. Smooth velvety feminine voice in a warm lower-middle register, gently airy and subtly sultry, with a soft smile and confident playful charm. Relaxed, fluid articulation and rounded vowels. She sounds like an outgoing travel creator speaking personally to the listener about meeting new friends and discovering local adventures. Natural, inviting and conversational, with bright moments of enthusiasm. Clean studio audio with clear intelligible speech.";
type Preview = { generatedVoiceId: string; file: string; durationSeconds: number; language?: string };

class ServiceError extends Error {
  constructor(readonly operation: string, readonly httpStatus: number, readonly reason: string) { super("ElevenLabs operation failed"); }
}
async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
let apiKey: string;
async function ensureVoice():Promise<string>{
  if(await exists(`${out}/voice.json`))return JSON.parse(await readFile(`${out}/voice.json`,'utf8')).voiceId;
  if(business&&french&&process.argv.includes('--reuse-french-voice')){
    const source=`${root}artifacts/ugc-product-fr/elevenlabs/voice.json`;
    const voice=JSON.parse(await readFile(source,'utf8'));
    if(!voice.voiceId)throw new Error('Existing French voice unavailable');
    await writeFile(`${out}/voice.json`,JSON.stringify({...voice,reusedFrom:source,deliveryDirection:voiceDescription,reason:'Reuse the approved energetic French custom voice for a new French campaign, without changing account voices.'},null,2));
    console.log('Using the approved French creator voice for fresh narration.');return voice.voiceId;
  }
  if(business&&process.argv.includes('--reuse-spanish-voice')){
    const source=`${root}artifacts/ugc-product-es/elevenlabs/voice.json`;
    const voice=JSON.parse(await readFile(source,'utf8'));
    if(!voice.voiceId)throw new Error('Existing Spanish voice unavailable');
    await writeFile(`${out}/voice.json`,JSON.stringify({...voice,reusedFrom:source,deliveryDirection:voiceDescription,reason:'Account voice slot limit; reuse the existing energetic adult Spanish creator voice without deleting account voices.'},null,2));
    console.log('Reusing the existing energetic Spanish voice; no new account voice saved.');
    return voice.voiceId;
  }
  if(meetBuddy&&process.argv.includes('--use-british-voice')){
    const voiceId='Xb7hH8MSUJpSbSDYk0k2';
    await request(`/v1/voices/${voiceId}`);
    await writeFile(`${out}/voice.json`,JSON.stringify({voiceId,name:'Alice — clear, engaging British female voice',description:voiceDescription,selection:'Existing British voice, contemporary friendly delivery; no custom account voice added.'},null,2));
    console.log('Selected the existing clear, engaging British female voice.');return voiceId;
  }
  const design=JSON.parse(await readFile(`${out}/voice-design.json`,'utf8')) as {previews:Preview[]};
  const selection=process.argv.find(v=>v.startsWith('--preview='))??'--preview=1';
  const preview=design.previews[Number(selection.split('=')[1])-1];if(!preview)throw new Error('Select an available voice preview');
  const pending=`${out}/voice-save.pending.json`;if(await exists(pending))throw new Error('Check the account before saving the custom voice again');
  await writeFile(pending,JSON.stringify({status:'submission_started',selectedPreview:preview.file},null,2));
  console.log('Saving the selected custom voice to the ElevenLabs account.');
  const voice=await(await request('/v1/text-to-voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({voice_name:meetBuddy?'Tips to Trip — British creator 25':business?'Tips to Trip — Spanish business creator 21':french?'Tips to Trip — natural French creator 22':product?'Tips to Trip — energetic Spanish creator 22':'Tips to Trip — Spanish travel creator',voice_description:voiceDescription,generated_voice_id:preview.generatedVoiceId,labels:{gender:'female',age:'young',language:meetBuddy?'en':french?'fr':'es',accent:meetBuddy?'british':french?'french':'spanish',use_case:'social_media'}})})).json() as {voice_id:string};
  if(!voice.voice_id)throw new Error('No voice ID returned');
  await writeFile(`${out}/voice.json`,JSON.stringify({voiceId:voice.voice_id,description:voiceDescription,selectedPreview:preview.file},null,2));return voice.voice_id;
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, {
    ...init,
    headers: { ...init.headers, "xi-api-key": apiKey },
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) {
    // Never dump service exceptions, request headers or arbitrary response bodies.
    const data = await response.json().catch(() => ({})) as { detail?: { status?: string } };
    const reason = ["missing_permissions", "invalid_api_key", "quota_exceeded", "voice_not_found", "subscription_required", "voice_limit_reached"].includes(data.detail?.status ?? "") ? data.detail!.status! : "request_rejected";
    throw new ServiceError(path.split("?")[0], response.status, reason);
  }
  return response;
}

async function main() {
  loadEnvFile(`${root}.env.local`);
  apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey.trim()) { console.error("ELEVENLABS_API_KEY is missing. Enter it locally in .env.local."); process.exitCode = 1; return; }
  await mkdir(out, { recursive: true });
  if(meetBuddy&&process.argv.includes('--native-convert')){
    const multilingual=process.argv.includes('--multilingual-native');
    const voiceModel=multilingual?'eleven_multilingual_sts_v2':'eleven_english_sts_v2';
    const voiceId=await ensureVoice(),native=`${assetDir}/performance${multilingual?'-multilingual':''}`;await mkdir(native,{recursive:true});
    const selected=Number(process.argv.find(v=>v.startsWith('--part='))?.split('=')[1]??0);
    const ff=(args:string[])=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(r.status!==0)throw new Error('Native performance media preparation failed');};
    async function transcribe(file:string,target:string){
      if(await exists(target))return JSON.parse(await readFile(target,'utf8'));
      const pending=target+'.pending.json';if(await exists(pending))throw new Error('Inspect saved speech review before retrying');
      await writeFile(pending,JSON.stringify({status:'submission_started',file,model:'scribe_v2'},null,2));
      const form=new FormData();form.append('file',new Blob([new Uint8Array(await readFile(file))],{type:'audio/wav'}),'performance.wav');form.append('model_id','scribe_v2');form.append('language_code','en');form.append('tag_audio_events','false');
      const data=await(await request('/v1/speech-to-text',{method:'POST',body:form})).json() as {text:string;words:unknown[]};
      if(!data.text||!data.words)throw new Error('Independent speech review incomplete');await writeFile(target,JSON.stringify(data,null,2));return data;
    }
    for(let i=1;i<=4;i++){
      if(selected&&selected!==i)continue;
      if(process.argv.includes('--available-native')&&!(await exists(`${assetDir}/native-segment-0${i}.mp4`)))continue;
      const id=`segment-0${i}`,source=`${native}/${id}-source.wav`,target=`${native}/${id}.mp3`,pending=target+'.pending.json';
      if(!(await exists(source)))ff(['-i',`${assetDir}/native-segment-0${i}.mp4`,'-vn','-ac','1','-ar','44100','-c:a','pcm_s16le',source]);
      const review=await transcribe(source,`${native}/${id}-source.scribe.json`);console.log(`Native ${id}: ${review.text}`);
      if(process.argv.includes('--review-only'))continue;
      if(!(await exists(target))){
        if(await exists(pending))throw new Error('Inspect saved voice conversion before retrying');
        await writeFile(pending,JSON.stringify({status:'submission_started',source,model:voiceModel,voiceId},null,2));
        const form=new FormData();form.append('audio',new Blob([new Uint8Array(await readFile(source))],{type:'audio/wav'}),'native-performance.wav');form.append('model_id',voiceModel);form.append('voice_settings',JSON.stringify({stability:0.55,similarity_boost:0.8,style:0,use_speaker_boost:true}));form.append('seed',String(250607+i));form.append('remove_background_noise','true');
        console.log(`Converting ${id} to the British ElevenLabs voice (billable).`);
        const response=await request(`/v1/speech-to-speech/${voiceId}?output_format=mp3_44100_128`,{method:'POST',body:form});
        if(!(response.headers.get('content-type')??'').startsWith('audio/'))throw new Error('Voice conversion returned no audio');await writeFile(target,Buffer.from(await response.arrayBuffer()));
        await writeFile(`${native}/${id}.json`,JSON.stringify({model:voiceModel,voiceId,source,requestId:response.headers.get('request-id'),performance:'Higgsfield native scripted British English; original cadence retained'},null,2));
      }
      ff(['-i',target,'-af','apad,atrim=duration=15','-ac','1','-ar','48000','-c:a','pcm_s16le',`${native}/${id}.wav`]);
      const converted=await transcribe(`${native}/${id}.wav`,`${native}/${id}.scribe.json`);console.log(`Converted ${id}: ${converted.text}`);
    }
    return;
  }
  if((business||meetBuddy)&&process.argv.includes('--transcribe')){
    await mkdir(`${assetDir}/qa`,{recursive:true});
    for(const part of [1,2]){
      const id=`narration-0${part}${process.argv.includes('--polished')?'-polished':''}`,target=`${assetDir}/qa/${id}.scribe.json`,pending=`${assetDir}/qa/${id}.scribe.pending.json`;
      if(await exists(target)){console.log(`Reusing ${id} independent speech review.`);continue;}
      if(await exists(pending))throw new Error('Inspect saved transcription request before resubmitting');
      const file=`${out}/presenter-0${part}.wav`;
      const form=new FormData();
      form.append('file',new Blob([new Uint8Array(await readFile(file))],{type:'audio/wav'}),`narration-0${part}.wav`);
      form.append('model_id','scribe_v2');form.append('language_code',meetBuddy?'en':french?'fr':'es');form.append('tag_audio_events','false');
      await writeFile(pending,JSON.stringify({status:'submission_started',model:'scribe_v2',file},null,2));
      console.log(`Checking ${french?'French':'Spanish'} ${id} with independent speech recognition (billable).`);
      const data=await(await request('/v1/speech-to-text',{method:'POST',body:form})).json() as {text:string;language_code:string;words:unknown[]};
      if(!data.text||!data.words)throw new Error('Speech review incomplete');
      await writeFile(target,JSON.stringify(data,null,2));console.log(`${id}: ${data.text}`);
    }
    return;
  }
  if(audioDriven&&process.argv.includes('--tts')){
    const voiceId=await ensureVoice();
    const spec=productSpec!;
    function ffmpeg(args:string[]){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(r.status!==0)throw new Error('French narration preparation failed');}
    for(const [i,text]of spec.dialogues.entries()){
      const id=`segment-0${i+1}`,target=`${out}/${id}.mp3`,meta=`${out}/${id}.json`,pending=`${out}/${id}.pending.json`;
      if(!(await exists(target))){
        if(await exists(pending))throw new Error('Inspect saved French speech request before resubmitting');
        const input={text,model_id:'eleven_multilingual_v2',voice_settings:{stability:business?(french?0.55:0.48):0.55,similarity_boost:0.8,style:business?(french?0.1:0.15):0.1,use_speaker_boost:true,speed:business?1.0:0.98},seed:(business?(french?211017:211007):221006)+i,previous_text:spec.dialogues[i-1],next_text:spec.dialogues[i+1]};
        await writeFile(pending,JSON.stringify({status:'submission_started',input},null,2));
        console.log(`Generating ${narrationLabel} narration ${i+1}/4 with timestamps (billable).`);
        type Alignment={characters:string[];character_start_times_seconds:number[];character_end_times_seconds:number[]};
        const response=await request(`/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
        const data=await response.json() as {audio_base64:string;alignment:Alignment;normalized_alignment:Alignment};
        if(!data.audio_base64||!data.alignment)throw new Error('French speech output incomplete');
        await writeFile(target,Buffer.from(data.audio_base64,'base64'));
        await writeFile(meta,JSON.stringify({status:'completed',model:input.model_id,voiceId,input,alignment:data.alignment,normalizedAlignment:data.normalized_alignment,requestId:response.headers.get('request-id')},null,2));
      }else console.log(`Reusing French ${id}.`);
      const probe=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','json',target],{encoding:'utf8'});
      if(probe.status!==0)throw new Error('French narration duration unavailable');
      const duration=Number(JSON.parse(probe.stdout).format.duration);
      const speed=meetBuddy?1:duration<12.5?duration/13.5:1;
      const cuts:Array<{start:number;end:number}>=[];
      if(duration>14.9||business&&french||meetBuddy){
        const detection=spawnSync('ffmpeg',['-hide_banner','-i',target,'-af','silencedetect=noise=-40dB:d=0.3','-f','null','-'],{encoding:'utf8'});
        if(detection.status!==0)throw new Error('French pause analysis failed');
        const starts=[...detection.stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m=>Number(m[1]));
        const ends=[...detection.stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m=>Number(m[1]));
        const allPauses=starts.map((start,n)=>({start,end:ends[n]??duration}));
        if(business&&french||meetBuddy){
          const leading=allPauses.find(p=>p.start<0.01&&p.end>0.2);
          if(leading)cuts.push({start:0,end:leading.end-0.08});
        }
        const pauses=allPauses.filter(p=>p.start>0.1).sort((a,b)=>(b.end-b.start)-(a.end-a.start));
        let needed=Math.max(0,duration-(business&&french?14.75:14.65)-cuts.reduce((n,c)=>n+c.end-c.start,0));
        for(const p of pauses){
          const trailing=p.end>=duration-0.05;
          const available=Math.max(0,p.end-p.start-(trailing?0.15:business&&french?0.32:0.6));
          if(!trailing&&p.end-p.start<0.9)continue;
          const remove=Math.min(needed,available);if(remove<=0)continue;
          const start=trailing?p.end-remove:p.start+(p.end-p.start-remove)/2;
          cuts.push({start,end:start+remove});needed-=remove;if(needed<0.001)break;
        }
        if(needed>0.001)throw new Error(`French segment ${i+1} needs timing review; no speech was truncated or accelerated`);
      }
      cuts.sort((a,b)=>a.start-b.start);
      if(cuts.length){
        const keep:Array<{start:number;end:number}>=[];let cursor=0;
        for(const cut of cuts){keep.push({start:cursor,end:cut.start});cursor=cut.end;}if(cursor<duration)keep.push({start:cursor,end:duration});
        const filter=keep.map((p,n)=>`[0:a]atrim=start=${p.start}:end=${p.end},asetpts=PTS-STARTPTS[k${n}]`).join(';')+';'+keep.map((_,n)=>`[k${n}]`).join('')+`concat=n=${keep.length}:v=0:a=1,atempo=${speed},apad,atrim=duration=15[a]`;
        ffmpeg(['-i',target,'-filter_complex',filter,'-map','[a]','-ar','44100','-ac','1',`${out}/${id}.wav`]);
      }else ffmpeg(['-i',target,'-af',`atempo=${speed},apad,atrim=duration=15`,'-ar','44100','-ac','1',`${out}/${id}.wav`]);
      const m=JSON.parse(await readFile(meta,'utf8'));
      const adjust=(time:number)=>(time-cuts.reduce((sum,p)=>sum+Math.max(0,Math.min(time,p.end)-p.start),0))/speed;
      m.preparedAlignment={...m.alignment,character_start_times_seconds:m.alignment.character_start_times_seconds.map(adjust),character_end_times_seconds:m.alignment.character_end_times_seconds.map(adjust)};
      m.preparation={removedSilence:cuts,originalDurationSeconds:duration,preparedDurationSeconds:15,speechSpeedChanged:speed!==1,speed,direction:speed<1?'slowed with preserved pitch':'unchanged'};
      await writeFile(meta,JSON.stringify(m,null,2));
      console.log(`French ${id}: ${duration.toFixed(2)} seconds; ${speed<1?'slowed with preserved pitch for relaxed delivery':cuts.length?'only long boundary pauses shortened':'relaxed pauses retained'}.`);
    }
    for(const part of [1,2]){
      const start=(part-1)*2+1;
      ffmpeg(['-i',`${out}/segment-0${start}.wav`,'-i',`${out}/segment-0${start+1}.wav`,'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[a]','-map','[a]','-c:a','libmp3lame','-b:a','128k',`${out}/presenter-0${part}.mp3`]);
      ffmpeg(['-i',`${out}/presenter-0${part}.mp3`,'-ar','16000','-ac','1','-c:a','pcm_s16le',`${out}/presenter-0${part}.wav`]);
      const words:Array<{start:number;end:number;word:string}>=[];
      for(let n=0;n<2;n++){
        const m=JSON.parse(await readFile(`${out}/segment-0${start+n}.json`,'utf8'));
        const a=(m.preparedAlignment??m.alignment) as {characters:string[];character_start_times_seconds:number[];character_end_times_seconds:number[]};
        let word='',first=0,last=0;
        function flush(){if(word)words.push({start:first+n*15,end:last+n*15,word});word='';}
        for(let c=0;c<a.characters.length;c++){const ch=a.characters[c]!;if(/\s/.test(ch)){flush();continue;}if(!word)first=a.character_start_times_seconds[c]!;word+=ch;last=a.character_end_times_seconds[c]!;}flush();
      }
      const transcript=[{start:words[0]!.start,end:words.at(-1)!.end,text:words.map(w=>w.word).join(' '),words}];
      await writeFile(`${out}/presenter-0${part}.transcript.json`,JSON.stringify(transcript,null,2));
      await writeFile(`${out}/presenter-0${part}.json`,JSON.stringify({status:'completed',model:'eleven_multilingual_v2',voiceId,segments:[start,start+1],timingSource:'Official ElevenLabs character alignment; each segment padded to 15 seconds without speeding speech.'},null,2));
    }
    console.log(`${narrationLabel} narration and word timing prepared.`);return;
  }
  if (process.argv.includes('--tts-second')) {
    if (!productSpec) throw new Error('Select the product video for the narration repair');
    const target=`${out}/presenter-02-repair.mp3`;
    if(await exists(target)) {console.log('Reusing completed ElevenLabs narration repair.');return;}
    const pending=`${out}/presenter-02-repair.pending.json`;
    if(await exists(pending)) throw new Error('Inspect the saved narration repair before resubmitting');
    const {voiceId}=JSON.parse(await readFile(`${out}/voice.json`,'utf8')) as {voiceId:string};
    const input={text:productSpec.dialogues[1],model_id:'eleven_multilingual_v2',voice_settings:{stability:0.45,similarity_boost:0.8,style:0.15,use_speaker_boost:true,speed:1.0},seed:2206};
    await writeFile(pending,JSON.stringify({status:'submission_started',input},null,2));
    console.log('Generating clear scripted Spanish narration with ElevenLabs (billable).');
    const response=await request(`/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    if(!(response.headers.get('content-type')??'').startsWith('audio/')) throw new Error('No repaired narration returned');
    await writeFile(target,Buffer.from(await response.arrayBuffer()));
    await writeFile(`${out}/presenter-02-repair.json`,JSON.stringify({status:'completed',model:input.model_id,voiceId,input,requestId:response.headers.get('request-id')},null,2));
    console.log('Scripted Spanish narration completed.');return;
  }
  if (process.argv.includes('--music')) {
    if (!productSpec) throw new Error('Select the product video for background music');
    if (await exists(`${out}/music.mp3`)) { console.log('Reusing completed ElevenLabs music.'); return; }
    if (await exists(`${out}/music.pending.json`)) throw new Error('Check the saved music request before resubmitting');
    const input = {prompt:productSpec.musicPrompt,music_length_ms:60000,model_id:'music_v1',force_instrumental:true};
    await writeFile(`${out}/music.pending.json`, JSON.stringify({status:'submission_started',input},null,2));
    console.log('Composing a 60-second instrumental music bed using ElevenLabs credits.');
    const response = await request('/v1/music?output_format=mp3_44100_128', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    if (!(response.headers.get('content-type') ?? '').startsWith('audio/')) throw new Error('No music audio returned');
    await writeFile(`${out}/music.mp3`, Buffer.from(await response.arrayBuffer()));
    await writeFile(`${out}/music.json`, JSON.stringify({status:'completed',input,songId:response.headers.get('song-id'),requestId:response.headers.get('request-id')},null,2));
    console.log('ElevenLabs instrumental music completed.');
    return;
  }
  if (process.argv.includes("--list")) {
    const data = await (await request("/v2/voices?page_size=100")).json() as { voices: Array<{ voice_id: string; name: string; description?: string; labels?: Record<string, string> }> };
    const voices = data.voices.map(v => ({ id: v.voice_id, name: v.name, description: v.description, labels: v.labels }));
    await writeFile(`${out}/available-voices.json`, JSON.stringify(voices, null, 2));
    console.log(JSON.stringify(voices, null, 2));
    return;
  }
  if (process.argv.includes("--design")) {
    if (await exists(`${out}/voice-design.json`)) { console.log("Reusing saved voice design previews."); return; }
    if(await exists(`${out}/voice-design.pending.json`))throw new Error('Check saved voice design request before resubmitting');
    const { dialogues } = productSpec ?? JSON.parse(await readFile(`${root}scripts/ugc-spanish.json`, "utf8")) as { dialogues: string[] };
    await writeFile(`${out}/voice-design.pending.json`,JSON.stringify({status:'submission_started',description:voiceDescription},null,2));
    console.log(`Designing the ${french?'relaxed French':product?'energetic Spanish':'smooth Spanish'} adult travel voice using ElevenLabs credits.`);
    const data = await (await request("/v1/text-to-voice/design", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice_description: voiceDescription, model_id: "eleven_multilingual_ttv_v2", text: french||meetBuddy?dialogues.slice(0,2).join(' '):dialogues[0], guidance_scale: 5, seed: meetBuddy?250107:business?211007:french?221006:product?2206:2506 }),
    })).json() as { previews: Array<{ audio_base_64: string; generated_voice_id: string; duration_secs: number; language?: string }> };
    const previews: Preview[] = [];
    for (const [i, preview] of data.previews.entries()) {
      const file = `voice-preview-0${i + 1}.mp3`;
      await writeFile(`${out}/${file}`, Buffer.from(preview.audio_base_64, "base64"));
      previews.push({ generatedVoiceId: preview.generated_voice_id, file, durationSeconds: preview.duration_secs, language: preview.language });
    }
    if (!previews.length) throw new Error("No voice previews returned");
    await writeFile(`${out}/voice-design.json`, JSON.stringify({ description: voiceDescription, model: "eleven_multilingual_ttv_v2", previews }, null, 2));
    console.log(`Saved ${previews.length} voice previews.`);
    return;
  }
  if (process.argv.includes("--convert")) {
    let voiceId: string;
    if (await exists(`${out}/voice.json`)) {
      voiceId = JSON.parse(await readFile(`${out}/voice.json`, "utf8")).voiceId;
    } else {
      const design = JSON.parse(await readFile(`${out}/voice-design.json`, "utf8")) as { previews: Preview[] };
      const selection = process.argv.find(v => v.startsWith("--preview=")) ?? "--preview=1";
      const preview = design.previews[Number(selection.split("=")[1]) - 1];
      if (!preview) throw new Error("Select an available voice preview");
      console.log("Saving the selected custom voice to the ElevenLabs account.");
      const voice = await (await request("/v1/text-to-voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_name: product?"Tips to Trip — energetic Spanish creator 22":"Tips to Trip — Spanish travel creator", voice_description: voiceDescription, generated_voice_id: preview.generatedVoiceId, labels: { gender: "female", age: "young", language: "es", accent: "spanish", use_case: "social_media" } }),
      })).json() as { voice_id: string };
      if (!voice.voice_id) throw new Error("No voice ID returned");
      voiceId = voice.voice_id;
      await writeFile(`${out}/voice.json`, JSON.stringify({ voiceId, description: voiceDescription, selectedPreview: preview.file }, null, 2));
    }
    const settings = { stability: product?0.45:0.55, similarity_boost: 0.8, style: product?0.1:0, use_speaker_boost: true };
    for (const part of [1, 2]) {
      const target = `${out}/presenter-0${part}.mp3`;
      if (await exists(target)) { console.log(`Reusing converted presenter-0${part}.`); continue; }
      const sourcePath = `${out}/source-0${part}.wav`;
      if (!(await exists(sourcePath))) {
        const prepared = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", `${assetDir}/presenter-0${part}.mp4`, "-vn", "-ar", "44100", "-ac", "1", sourcePath], { stdio: "inherit" });
        if (prepared.status !== 0) throw new Error("Audio extraction failed");
      }
      const form = new FormData();
      form.append("audio", new Blob([new Uint8Array(await readFile(sourcePath))], { type: "audio/wav" }), `source-0${part}.wav`);
      form.append("model_id", "eleven_multilingual_sts_v2");
      form.append("voice_settings", JSON.stringify(settings));
      form.append("seed", "2506");
      console.log(`Converting presenter-0${part} using ElevenLabs credits.`);
      const response = await request(`/v1/speech-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, { method: "POST", body: form });
      if (!(response.headers.get("content-type") ?? "").startsWith("audio/")) throw new Error("No audio output returned");
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
      await writeFile(`${out}/presenter-0${part}.json`, JSON.stringify({ model: "eleven_multilingual_sts_v2", voiceId, voiceSettings: settings, source: `source-0${part}.wav`, output: `presenter-0${part}.mp3`, requestId: response.headers.get("request-id") }, null, 2));
      console.log(`Converted presenter-0${part}.`);
    }
    return;
  }
  console.error("Select a voice conversion operation before running this script.");
  process.exitCode = 1;
}
main().catch((error: unknown) => {
  if (error instanceof ServiceError) console.error(`ElevenLabs rejected ${error.operation}: HTTP ${error.httpStatus}, ${error.reason}.`);
  else console.error("ElevenLabs request failed. No credentials or raw exceptions were logged.");
  process.exitCode = 1;
});
