import {loadEnvFile} from 'node:process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
const calm35=process.argv.includes('--calm35');
const root=new URL('../',import.meta.url).pathname,dir=root+'artifacts/'+(calm35?'countries-stock-en-35s':'countries-fluid-en')+'/elevenlabs';
mkdirSync(dir,{recursive:true});loadEnvFile(root+'.env.local');
const key=process.env.ELEVENLABS_API_KEY;
if(!key)throw Error('Enter ELEVENLABS_API_KEY locally in .env.local.');
const save=(p,x)=>writeFileSync(p,JSON.stringify(x,null,2));
async function request(id,path,input,json=false){
 const file=dir+'/'+id+'.mp3',meta=file+'.json',state=file+'.pending.json';
 if(existsSync(file)){console.log(id+': cached');return;}
 if(existsSync(state))throw Error(id+': saved request exists; inspect state before resubmitting.');
 save(state,{status:'submission_started',startedAt:new Date().toISOString(),input,path});
 let r;try{r=await fetch('https://api.elevenlabs.io'+path,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(240000)});}catch(e){save(state,{status:'connection_failed',code:['ENOTFOUND','EAI_AGAIN','ECONNRESET','ETIMEDOUT'].includes(e.cause?.code)?e.cause.code:'ambiguous',input,path});throw Error(id+': connection failed; state saved.');}
 if(!r.ok){save(state,{status:'rejected',httpStatus:r.status,input,path});throw Error(id+': ElevenLabs HTTP '+r.status);}
 if(json){const d=await r.json();if(!d.audio_base64||!d.alignment)throw Error('Incomplete narration response.');writeFileSync(file,Buffer.from(d.audio_base64,'base64'));delete d.audio_base64;save(meta,{...d,input,voice:'s3TPKV1kjDlVtZbl4Ksh',requestId:r.headers.get('request-id')});}
 else{writeFileSync(file,Buffer.from(await r.arrayBuffer()));save(meta,{status:'completed',input,requestId:r.headers.get('request-id')});}
 save(state,{status:'completed',completedAt:new Date().toISOString()});console.log(id+': completed');
}
if(calm35){
 await request('download','/v1/text-to-speech/s3TPKV1kjDlVtZbl4Ksh/with-timestamps?output_format=mp3_44100_128',{text:'Download Tips to Trip now.',model_id:'eleven_multilingual_v2',voice_settings:{stability:.82,similarity_boost:.78,style:0,use_speaker_boost:true,speed:.84},seed:20261111},true);
}else{
if(!existsSync(dir+'/impact.mp3')){copyFileSync(root+'artifacts/travel-buddy-story-en/elevenlabs/impact.mp3',dir+'/impact.mp3');save(dir+'/impact.mp3.json',{cachedSource:'artifacts/travel-buddy-story-en/elevenlabs/impact.mp3',reason:'Completed ElevenLabs stereo wind riser into thunderous bass boom matches this brief exactly.'});}
await request('download','/v1/text-to-speech/s3TPKV1kjDlVtZbl4Ksh/with-timestamps?output_format=mp3_44100_128',{text:'Download Tips to Trip now.',model_id:'eleven_multilingual_v2',language_code:'en',voice_settings:{stability:.55,similarity_boost:.78,style:.18,use_speaker_boost:true,speed:1},seed:111026},true);
await request('whoosh','/v1/sound-generation?output_format=mp3_44100_128',{text:'One single premium cinematic stereo fluid swoosh transition. Soft rushing wind gathers immediately, sweeps smoothly from left to right with a liquid airy texture, then a very short clean low impact and soft decaying tail. Modern travel film transition, elegant and energetic. No water splashes, voices or music.',duration_seconds:1.2,prompt_influence:.55,model_id:'eleven_text_to_sound_v2'});
await request('music','/v1/music?output_format=mp3_44100_128',{prompt:'Original 42 second premium cinematic travel advert instrumental. Immediate airy wind-like tension swell and deep controlled cinematic impact into an uplifting modern electronic groove, 110 BPM, punchy clean bass, wide atmospheric synths, crisp drums and sunlit travel energy. Smooth liquid motion feeling, memorable rhythmic pulse. Small fresh variations around 4, 10, 13, 17 and 22 seconds. Expansive long final destination passage from 22 to 36 seconds, then confident brand resolution at 36 seconds, sparse clean midrange with room for a short spoken call to action around 37 seconds, resolved ending and reverb tail into silence at 42 seconds. No vocals, speech, singing, chants or vocal chops.',music_length_ms:42000,model_id:'music_v1',force_instrumental:true});
}
const transcript=dir+'/download.scribe.json';
if(!existsSync(transcript)){
 if(existsSync(transcript+'.pending.json'))throw Error('Narration transcript request saved; inspect before retry.');
 save(transcript+'.pending.json',{status:'submission_started'});
 const f=new FormData();f.append('file',new Blob([readFileSync(dir+'/download.mp3')],{type:'audio/mpeg'}),'download.mp3');f.append('model_id','scribe_v2');f.append('language_code','en');f.append('tag_audio_events','false');
 const r=await fetch('https://api.elevenlabs.io/v1/speech-to-text',{method:'POST',headers:{'xi-api-key':key},body:f,signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw Error('Narration verification HTTP '+r.status);
 const d=await r.json();save(transcript,d);console.log('Independent narration transcript: '+d.text);
}
