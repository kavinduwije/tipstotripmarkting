import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

const root=new URL('../',import.meta.url).pathname;
const base=`${root}artifacts/hiking-buddy-es`;
const previous=`${base}/voice-energetic-v2`;
const revision=`${base}/voice-soft-breaths-v3`;
const original=`${base}/exports/tips-to-trip-hiking-buddy-es-energetic-60s.mp4`;
const output=`${base}/exports/tips-to-trip-hiking-buddy-es-energetic-soft-breaths-60s.mp4`;
const spec=JSON.parse(readFileSync(`${root}scripts/hiking-buddy-spanish.json`));
const stage=process.argv[2]??'clean';
for(const folder of ['audio','qa'])mkdirSync(`${revision}/${folder}`,{recursive:true});
const save=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2));
const parse=file=>JSON.parse(readFileSync(file));
function run(command,args){const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:16*1024*1024});if(result.status!==0)throw Error(`${command} failed: ${result.stderr.slice(-1500)}`);return result;}
const ff=args=>run('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
function wav(file){
 const buffer=readFileSync(file);let format,dataOffset,dataBytes;
 for(let at=12;at+8<buffer.length;){const id=buffer.toString('ascii',at,at+4),size=buffer.readUInt32LE(at+4);if(id==='fmt ')format={encoding:buffer.readUInt16LE(at+8),channels:buffer.readUInt16LE(at+10),rate:buffer.readUInt32LE(at+12),bits:buffer.readUInt16LE(at+22)};if(id==='data'){dataOffset=at+8;dataBytes=size;break;}at+=8+size+(size%2);}
 if(!format||format.encoding!==1||format.bits!==16||format.rate!==48000||format.channels!==2||!dataOffset||dataOffset+dataBytes>buffer.length)throw Error('Expected stereo 48kHz PCM16 source.');
 return{buffer,format,dataOffset,dataBytes,frames:dataBytes/4};
}
function level(source,start,end){let sum=0,peak=0,n=0;for(let frame=Math.round(start*48000);frame<Math.min(source.frames,Math.round(end*48000));frame++)for(let c=0;c<2;c++){const value=source.buffer.readInt16LE(source.dataOffset+frame*4+c*2)/32768;sum+=value*value;peak=Math.max(peak,Math.abs(value));n++;}return{rmsDbFS:20*Math.log10(Math.max(1e-12,Math.sqrt(sum/Math.max(1,n)))),peakDbFS:20*Math.log10(Math.max(1e-12,peak))};}
function speechRegions(){
 const protectedIntervals=[],gaps=[];
 for(const line of spec.dialogues.filter(s=>s.speaker==='lucia')){
  const transcript=parse(`${previous}/qa/${line.id}.processed.scribe.json`),words=transcript.words.filter(w=>w.type==='word').map(w=>({...w}));
  // Scribe attaches Tú to the long preceding pause; the reviewed source
  // waveform and visible onset place the actual word at about 2.04 seconds.
  if(line.id==='hello')words[1].start=2.04;
  const merged=[];
  for(const word of words){const start=Math.max(0,word.start-.08),end=Math.min(line.slot,word.end+.08),last=merged.at(-1);if(last&&start<=last.end)last.end=Math.max(last.end,end);else merged.push({start,end});}
  let cursor=0;
  for(const interval of merged){if(interval.start-cursor>=.12)gaps.push({id:line.id,start:line.at+cursor,end:line.at+interval.start});protectedIntervals.push({id:line.id,start:line.at+interval.start,end:line.at+interval.end});cursor=interval.end;}
  if(line.slot-cursor>=.12)gaps.push({id:line.id,start:line.at+cursor,end:line.at+line.slot});
 }
 return{protectedIntervals,gaps:gaps.map(g=>({...g,reductionDb:g.end-g.start>=.22?20:14,fadeSeconds:Math.min(.03,(g.end-g.start)/4)}))};
}
function loudness(file,peak=-2.9){const log=run('ffmpeg',['-hide_banner','-i',file,'-vn','-af',`loudnorm=I=-16:TP=${peak}:LRA=7:print_format=json`,'-f','null','-']).stderr;const start=log.lastIndexOf('{');return JSON.parse(log.slice(start,log.indexOf('}',start)+1));}
async function clean(){
 const source=wav(`${previous}/edit/narration.wav`),cleaned={...source,buffer:Buffer.from(source.buffer)},regions=speechRegions(),gain=new Float32Array(source.frames).fill(1);
 for(const gap of regions.gaps){const first=Math.round(gap.start*48000),last=Math.min(source.frames,Math.round(gap.end*48000)),fade=Math.round(gap.fadeSeconds*48000),floor=10**(-gap.reductionDb/20);for(let frame=first;frame<last;frame++){const edge=Math.min(1,(frame-first)/fade,(last-1-frame)/fade),blend=(1-Math.cos(Math.max(0,edge)*Math.PI))/2;gain[frame]=Math.min(gain[frame],1-(1-floor)*blend);}}
 let changedSamples=0;
 for(let frame=0;frame<source.frames;frame++)if(gain[frame]<1)for(let c=0;c<2;c++){const at=source.dataOffset+frame*4+c*2,old=source.buffer.readInt16LE(at),value=Math.round(old*gain[frame]);cleaned.buffer.writeInt16LE(value,at);if(old!==value)changedSamples++;}
 let speechSamplesChecked=0;
 for(const interval of regions.protectedIntervals){const first=Math.round(interval.start*48000),last=Math.round(interval.end*48000);for(let frame=first;frame<last;frame++)for(let c=0;c<2;c++){const at=source.dataOffset+frame*4+c*2;if(source.buffer.readInt16LE(at)!==cleaned.buffer.readInt16LE(at))throw Error('A protected speech sample changed.');speechSamplesChecked++;}}
 writeFileSync(`${revision}/audio/narration.wav`,cleaned.buffer);
 // Replace just the narration contribution in the existing unnormalized mix.
 // The existing music/ambience and their ducking are carried over sample for sample.
 const mix=wav(`${previous}/edit/mix-raw.wav`);if(mix.frames!==source.frames)throw Error('Mix and narration lengths differ.');const rebuilt=Buffer.from(mix.buffer);let clipped=0;
 for(let frame=0;frame<source.frames;frame++)for(let c=0;c<2;c++){const at=frame*4+c*2,value=mix.buffer.readInt16LE(mix.dataOffset+at)-source.buffer.readInt16LE(source.dataOffset+at)+cleaned.buffer.readInt16LE(cleaned.dataOffset+at);if(value>32767||value< -32768)clipped++;rebuilt.writeInt16LE(Math.max(-32768,Math.min(32767,value)),mix.dataOffset+at);}
 if(clipped)throw Error('Narration replacement clipped the mix.');writeFileSync(`${revision}/audio/mix-raw.wav`,rebuilt);
 const intervals=regions.gaps.map(g=>{const before=level(source,g.start,g.end),after=level(cleaned,g.start,g.end);return{...g,before,after,measuredReductionDb:before.rmsDbFS-after.rmsDbFS};});
 const report={createdAt:new Date().toISOString(),sourceNarration:`${previous}/edit/narration.wav`,sourceVideo:original,method:'Manual-style gain rides confined to transcript-derived pauses, with 80ms protection around every spoken word and 30ms smooth fades. Attenuate long pauses by 20dB and shorter gaps by 14dB. No waveform samples removed, shifted, stretched, regenerated or edited inside protected speech.',sourceFrames:source.frames,cleanedFrames:cleaned.frames,sampleRate:48000,channels:2,durationSeconds:source.frames/48000,changedSamples,speechSamplesChecked,protectedSpeechSamplesUnchanged:true,secondarySpeakerUnchanged:true,existingMusicAndAmbienceReused:true,intervals,protectedIntervals:regions.protectedIntervals};save(`${revision}/qa/cleanup.json`,report);
 const width=1500,height=500,plotW=1440,plotH=180,items=[];
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
 for(const [row,track,label]of[[0,source,'Original energetic narration'],[1,cleaned,'Breaths softened · spoken words preserved']]){const y=35+row*235;items.push(`<text x="30" y="${y}" fill="#172e32" font-size="21">${esc(label)}</text>`);for(const gap of regions.gaps)items.push(`<rect x="${30+gap.start/60*plotW}" y="${y+12}" width="${(gap.end-gap.start)/60*plotW}" height="${plotH}" fill="#dff2ea"/>`);let d='';for(let x=0;x<plotW;x++){const start=Math.floor(x/plotW*track.frames),end=Math.floor((x+1)/plotW*track.frames);let sum=0;for(let i=start;i<end;i++)sum+=(track.buffer.readInt16LE(track.dataOffset+i*4)/32768)**2;const rms=Math.sqrt(sum/Math.max(1,end-start)),db=20*Math.log10(Math.max(1e-6,rms)),yy=y+12+plotH-Math.max(0,Math.min(1,(db+65)/60))*plotH;d+=`${x?'L':'M'}${30+x},${yy.toFixed(1)} `;}items.push(`<path d="${d}" stroke="${row?'#078b75':'#61787f'}" fill="none" stroke-width="1.2"/>`);for(let t=0;t<=60;t+=5)items.push(`<text x="${30+t/60*plotW}" y="${y+plotH+30}" fill="#455c62" font-size="13">${t}s</text>`);}
 await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${items.join('')}</svg>`)).png().toFile(`${revision}/qa/breath-level-comparison.png`);
 console.log(`Softened ${intervals.length} pauses; ${speechSamplesChecked} protected speech samples are identical; duration remains ${report.durationSeconds}s.`);
}
function mix(){const report=parse(`${revision}/qa/cleanup.json`);if(!report.protectedSpeechSamplesUnchanged)throw Error('Speech preservation review incomplete.');const file=`${revision}/audio/mix-raw.wav`,m=loudness(file);save(`${revision}/qa/mix-input-levels.json`,m);ff(['-i',file,'-af',`loudnorm=I=-16:TP=-2.9:LRA=7:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,'-ar','48000','-ac','2',`${revision}/audio/final-mix.wav`]);console.log('Clean narration remixed with the existing soundtrack.');}
function render(){ff(['-i',original,'-i',`${revision}/audio/final-mix.wav`,'-map','0:v:0','-map','1:a:0','-map','0:s?','-map_metadata','0','-c:v','copy','-c:s','copy','-c:a','aac','-b:a','192k','-ar','48000','-metadata:s:a:0','language=spa','-t','60','-movflags','+faststart',output]);copyFileSync(`${base}/exports/hiking-buddy-es-energetic.srt`,`${base}/exports/hiking-buddy-es-energetic-soft-breaths.srt`);console.log(`Exported ${output}`);}
function verify(){
 const p=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',output]).stdout),v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio');save(`${revision}/qa/ffprobe.json`,p);
 if(v.width!==720||v.height!==1280||v.avg_frame_rate!=='30/1'||Number(v.nb_read_frames)!==1800||a.codec_name!=='aac'||Number(a.sample_rate)!==48000||Math.abs(Number(p.format.duration)-60)>.05)throw Error('Export format mismatch.');
 ff(['-v','error','-i',output,'-map','0:v:0','-map','0:a:0','-f','null','-']);const videoHash=file=>run('ffmpeg',['-v','error','-i',file,'-map','0:v:0','-c','copy','-f','hash','-hash','sha256','-']).stdout.trim(),oldHash=videoHash(original),newHash=videoHash(output);if(oldHash!==newHash)throw Error('Video stream changed.');
 for(const[name,file]of[['reference',`${revision}/audio/final-mix.wav`],['decoded',output]])ff(['-i',file,'-vn','-ac','1','-ar','48000','-f','s16le',`${revision}/qa/${name}.pcm`]);
 const data=name=>{const b=readFileSync(`${revision}/qa/${name}.pcm`);return new Int16Array(b.buffer,b.byteOffset,b.length/2);},reference=data('reference'),decoded=data('decoded');const correlation=(start=0,end=reference.length)=>{let xy=0,xx=0,yy=0;for(let i=start;i<Math.min(end,reference.length,decoded.length);i++){xy+=reference[i]*decoded[i];xx+=reference[i]**2;yy+=decoded[i]**2;}return xy/Math.sqrt(xx*yy);};const c=correlation(),seconds=decoded.length/48000,windows=spec.dialogues.map(s=>({id:s.id,correlation:correlation(Math.round(s.at*48000),Math.round((s.at+s.slot)*48000))}));if(c<.97||windows.some(w=>w.correlation<.97)||Math.abs(seconds-60)>.08)throw Error('Decoded audio timing mismatch.');
 const levels=loudness(output);save(`${revision}/qa/final-levels.json`,levels);if(Math.abs(Number(levels.input_i)+16)>.8||Number(levels.input_tp)>-1.1)throw Error('Export loudness outside target.');
 const captionsUnchanged=readFileSync(`${base}/exports/hiking-buddy-es-energetic.srt`).equals(readFileSync(`${base}/exports/hiking-buddy-es-energetic-soft-breaths.srt`));if(!captionsUnchanged)throw Error('Captions changed.');const cleanup=parse(`${revision}/qa/cleanup.json`);
 const result={passed:true,createdAt:new Date().toISOString(),file:output,originalPreserved:original,videoStreamUnchanged:true,oldVideoHash:oldHash,newVideoHash:newHash,captionsUnchanged,duration:Number(p.format.duration),decodedAudioSeconds:seconds,frames:1800,width:720,height:1280,fps:30,fullDecodePassed:true,referenceMixCorrelation:c,dialogueWindows:windows,loudnessLUFS:Number(levels.input_i),truePeakDbTP:Number(levels.input_tp),spokenSampleTimingUnchanged:true,protectedSpeechSamplesUnchanged:cleanup.protectedSpeechSamplesUnchanged,breathCleanup:'qa/cleanup.json',limitations:'Breath attenuation was verified by waveform levels and protected-speech sample equality. No audio playback listening review was available.',sha256:createHash('sha256').update(readFileSync(output)).digest('hex')};save(`${revision}/qa/final-verification.json`,result);save(`${revision}/production-status.json`,{status:'completed',file:output,originalPreserved:original,verification:'qa/final-verification.json',updatedAt:new Date().toISOString()});save(`${base}/latest-export.json`,{file:output,revision:'soft-breaths-v3',originalPreserved:original,verification:'voice-soft-breaths-v3/qa/final-verification.json',videoStreamUnchanged:true,captionsUnchanged:true,updatedAt:new Date().toISOString()});console.log(`Verified: unchanged video/captions, ${seconds.toFixed(3)}s decoded audio, ${levels.input_i} LUFS, ${levels.input_tp} dBTP.`);
}
if(stage==='clean')await clean();else if(stage==='mix')mix();else if(stage==='render')render();else if(stage==='verify')verify();else throw Error('Choose clean, mix, render or verify.');
