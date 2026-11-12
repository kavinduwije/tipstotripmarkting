import {readFileSync,writeFileSync,copyFileSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const sharpTagline=process.argv.includes('--sharp-tagline');
const root=new URL('../',import.meta.url).pathname,prior=root+'artifacts/countries-stock-en',revisionSource=root+'artifacts/countries-stock-en-35s',dir=root+'artifacts/'+(sharpTagline?'countries-stock-en-35s-sharp':'countries-stock-en-35s'),edit=dir+'/edit',qa=dir+'/qa',stage=process.argv[2]??'render';
for(const s of [edit,qa,dir+'/exports'])mkdirSync(s,{recursive:true});
const output=dir+'/exports/tips-to-trip-countries-real-footage-en-35s.mp4';
const plan={duration:35,width:720,height:1280,fps:30,sourcePicture:'artifacts/countries-stock-en/edit/picture.mp4',countriesUnchangedThroughSeconds:27,germany:{at:21.5,until:35,source:'artifacts/countries-stock-en/clean/Germany.mp4',sourceRangeSeconds:[0,13.5]},closing:{at:27,until:35,fadeInSeconds:.4,background:'Continuing real filmed Germany footage',splashBackgroundUsed:false,text:['DOWNLOAD','Tips to Trip','NOW'],tagline:"Discover what's nearby",storeBadges:['App Store','Google Play'],logo:'brandKIT/02-Logo/TipsToTrip-Original-Logo-1024.png'},narration:{at:33,text:'Download Tips to Trip now.',voiceId:'s3TPKV1kjDlVtZbl4Ksh',delivery:'Slower, stable and restrained',officialTimestamps:'elevenlabs/download.mp3.json'},music:{source:'artifacts/countries-stock-en/elevenlabs/music.mp3',duckFrom:32.5,duckGain:.16,fadeOutFrom:33.7,fadeOutUntil:35},transitionSoundEffects:false};
writeFileSync(dir+'/scene-plan.json',JSON.stringify(plan,null,2));
if(sharpTagline){plan.closing.taglineStyle='Crisp white text with no glow, shadow or blur';plan.closing.text=['DOWNLOAD','Tips To Trip','NOW'];writeFileSync(dir+'/scene-plan.json',JSON.stringify(plan,null,2));copyFileSync(revisionSource+'/qa/audio-mix.json',qa+'/audio-mix.json');}
copyFileSync(prior+'/edit/fonts.conf',edit+'/fonts.conf');process.env.FONTCONFIG_FILE=edit+'/fonts.conf';
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(cmd+': '+r.stderr.slice(-1800));return r;};
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
const asyncFF=args=>new Promise((resolve,reject)=>{const p=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);let error='';p.stderr.on('data',b=>error=(error+b).slice(-2000));p.on('error',reject);p.on('exit',n=>n===0?resolve():reject(Error(error)));});
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const probe=p=>JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',p]).stdout);
async function graphics(){
 const logo=await sharp(root+plan.closing.logo).extract({left:82,top:82,width:860,height:860}).resize(264,264).ensureAlpha().composite([{input:Buffer.from('<svg width="264" height="264"><circle cx="132" cy="132" r="131.5" fill="white"/></svg>'),blend:'dest-in'}]).png().toBuffer();
 const tagline=await sharp({text:{text:'<span foreground="#FFFFFF" letter_spacing="1000">Discover what’s nearby</span>',font:'Inter SemiBold 30',fontfile:root+'brandKIT/04-Fonts/Inter-Variable.ttf',align:'center',width:640,rgba:true}}).png().toBuffer(),m=await sharp(tagline).metadata();
 let closingLayout=prior+'/edit/app-overlay.png';
 if(sharpTagline){
  const title=await sharp({text:{text:'<span foreground="#FFFFFF" letter_spacing="2200">Tips To Trip</span>',font:'Inter Bold 47',fontfile:root+'brandKIT/04-Fonts/Inter-Variable.ttf',align:'center',width:640,rgba:true}}).png().toBuffer(),tm=await sharp(title).metadata();
  const cleared=await sharp(closingLayout).composite([{input:Buffer.from('<svg width="720" height="1280"><rect x="0" y="195" width="720" height="65" fill="white"/></svg>'),blend:'dest-out'}]).png().toBuffer();
  closingLayout=await sharp(cleared).composite([{input:title,left:Math.round((720-tm.width)/2),top:203}]).png().toBuffer();
 }
 const scrim=Buffer.from('<svg width="720" height="1280"><defs><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#020B0D" stop-opacity=".34"/><stop offset=".5" stop-color="#020B0D" stop-opacity=".18"/><stop offset="1" stop-color="#020B0D" stop-opacity=".48"/></linearGradient></defs><rect width="720" height="1280" fill="url(#shade)"/></svg>');
 await sharp({create:{width:720,height:1280,channels:4,background:'#00000000'}}).composite([{input:scrim},{input:closingLayout},{input:logo,left:228,top:500},{input:tagline,left:Math.round((720-m.width)/2),top:884}]).png().toFile(edit+'/germany-closing-overlay.png');
 copyFileSync(prior+'/edit/logo.png',edit+'/corner-logo.png');
 console.log('Transparent closing layout ready: Germany remains the background.');
}
async function picture(){
 await asyncFF(['-i',prior+'/edit/picture.mp4','-loop','1','-framerate','30','-i',edit+'/germany-closing-overlay.png','-loop','1','-framerate','30','-i',edit+'/corner-logo.png','-filter_complex','[0:v]trim=duration=35,setpts=PTS-STARTPTS[b];[1:v]format=rgba,fade=t=in:st=27:d=0.4:alpha=1[c];[b][c]overlay=0:0:enable=\'gte(t,27)\'[v];[v][2:v]overlay=610:35:enable=\'gte(t,27)\',format=yuv420p[o]','-map','[o]','-an','-t','35','-frames:v','1050','-r','30','-c:v','libx264','-crf','17','-preset','fast','-threads','4','-filter_complex_threads','2',edit+'/picture.mp4']);
 console.log('35-second picture rendered; closing sits over Germany from 27 seconds.');
}
function audio(){
 const source=dir+'/elevenlabs/download.mp3',alignment=JSON.parse(readFileSync(source+'.json')),speech=JSON.parse(readFileSync(dir+'/elevenlabs/download.scribe.json'));
 if(speech.text.toLowerCase().replace(/[^a-z]/g,'')!=='downloadtipstotripnow')throw Error('Narration wording requires review.');
 ff(['-i',source,'-af','highpass=f=70,lowpass=f=10000,equalizer=f=3200:t=q:w=1:g=-1.3,loudnorm=I=-17:TP=-2:LRA=7','-ar','48000','-ac','1','-f','s16le',edit+'/voice.pcm']);
 const voice=readFileSync(edit+'/voice.pcm'),voiceSeconds=voice.length/96000;
 if(voiceSeconds>1.95||Math.max(...alignment.alignment.character_end_times_seconds)>1.95)throw Error('Calm narration would overrun the 35-second ending.');
 const timeline=Buffer.alloc(35*96000);voice.copy(timeline,33*96000);writeFileSync(edit+'/voice-timeline.pcm',timeline);
 ff(['-f','s16le','-ar','48000','-ac','1','-i',edit+'/voice-timeline.pcm','-ar','48000','-ac','2',edit+'/voice-timeline.wav']);
 // Commit normalized music at 48 kHz before applying clock-based automation.
 // This prevents loudnorm's internal resampling from altering the duck timing.
 ff(['-i',prior+'/elevenlabs/music.mp3','-af','atrim=duration=35,asetpts=PTS-STARTPTS,loudnorm=I=-20:TP=-4:LRA=9','-ar','48000','-ac','2','-t','35',edit+'/music-normalized.wav']);
 ff(['-i',edit+'/music-normalized.wav','-af',"asetpts=N/SR/TB,afade=t=in:d=0.15,volume='if(lt(t,32.5),1,if(lt(t,33),1-(t-32.5)*1.68,.16))':eval=frame,afade=t=out:st=33.7:d=1.3",'-ar','48000','-ac','2','-t','35',edit+'/music-bed.wav']);
 ff(['-i',edit+'/music-bed.wav','-i',edit+'/voice-timeline.wav','-filter_complex','[0:a][1:a]amix=inputs=2:normalize=0:duration=longest,atrim=duration=35,asetpts=N/SR/TB[a]','-map','[a]','-ar','48000','-ac','2','-t','35',edit+'/mix-first.wav']);
 const log=run('ffmpeg',['-hide_banner','-i',edit+'/mix-first.wav','-af','loudnorm=I=-16:TP=-2.5:LRA=9:print_format=json','-f','null','-']).stderr,b=log.lastIndexOf('{'),measure=JSON.parse(log.slice(b,log.indexOf('}',b)+1));
 ff(['-i',edit+'/mix-first.wav','-af',`loudnorm=I=-16:TP=-2.5:LRA=9:measured_I=${measure.input_i}:measured_TP=${measure.input_tp}:measured_LRA=${measure.input_lra}:measured_thresh=${measure.input_thresh}:offset=${measure.target_offset}:linear=true`,'-ar','48000','-ac','2',edit+'/final-mix.wav']);
 writeFileSync(qa+'/audio-mix.json',JSON.stringify({measure,voiceSeconds,voiceAt:33,voiceEndsAt:33+voiceSeconds,voiceSettings:alignment.input.voice_settings,independentTranscript:speech.text,musicOnlyUntil:33,transitionSoundEffects:false},null,2));
 console.log('Calmer narration mixed at 33 seconds; ends at '+(33+voiceSeconds).toFixed(3)+' seconds.');
}
async function mux(){await asyncFF(['-i',edit+'/picture.mp4','-i',sharpTagline?revisionSource+'/exports/tips-to-trip-countries-real-footage-en-35s.mp4':edit+'/final-mix.wav','-map','0:v','-map','1:a','-c:v','copy',...(sharpTagline?['-c:a','copy']:['-c:a','aac','-b:a','192k','-ar','48000']),'-t','35','-movflags','+faststart',output]);console.log('New 35-second export ready.');}
function verify(){
 const p=probe(output),v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio');
 if(v.width!==720||v.height!==1280||v.avg_frame_rate!=='30/1'||Number(v.nb_read_frames)!==1050||Math.abs(Number(p.format.duration)-35)>.034||a.channels!==2||Number(a.sample_rate)!==48000||a.codec_name!=='aac')throw Error('Final format mismatch.');
 run('ffmpeg',['-hide_banner','-v','error','-i',output,'-f','null','-']);
 ff(['-i',output,'-vn','-ar','48000','-ac','2','-f','s16le',qa+'/decoded-audio.pcm']);
 const decodedSeconds=statSync(qa+'/decoded-audio.pcm').size/192000;if(Math.abs(decodedSeconds-35)>.034)throw Error('Decoded audio duration mismatch.');
 const log=run('ffmpeg',['-hide_banner','-i',output,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']).stderr,b=log.lastIndexOf('{'),loud=JSON.parse(log.slice(b,log.indexOf('}',b)+1));
 if(Math.abs(Number(loud.input_i)+16)>1||Number(loud.input_tp)>-1)throw Error('Audio level mismatch.');
 const original=JSON.parse(readFileSync(prior+'/qa/final-verification.json'));if(!original.technicalPassed||!original.productionApproved)throw Error('Original stock footage export lacks approval.');
 const result={file:output,technicalPassed:true,width:v.width,height:v.height,fps:30,frames:1050,duration:Number(p.format.duration),decodedAudioSeconds:decodedSeconds,fullDecodePassed:true,loudnessLUFS:Number(loud.input_i),truePeakDbTP:Number(loud.input_tp),sourceType:'real filmed stock footage',closingBackground:'Germany footage; no app splash background',closingAt:27,voiceAt:33,narration:JSON.parse(readFileSync(qa+'/audio-mix.json')),originalPictureSha256:hash(prior+'/edit/picture.mp4'),bytes:statSync(output).size,sha256:hash(output),productionApproved:false,verifiedAt:new Date().toISOString()};
 writeFileSync(qa+'/final-verification.json',JSON.stringify(result,null,2));
 console.log('Verified: 35 seconds, 1050 frames, 720 × 1280, stereo, full decode; '+loud.input_i+' LUFS.');
}
if(stage==='graphics')await graphics();else if(stage==='picture')await picture();else if(stage==='audio')audio();else if(stage==='mux')await mux();else if(stage==='verify')verify();else if(stage==='render'){await graphics();await picture();if(!sharpTagline)audio();await mux();verify();}else throw Error('Choose graphics/picture/audio/mux/verify/render.');
