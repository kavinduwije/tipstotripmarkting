import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const stock=process.argv.includes('--stock'),photographic=process.argv.includes('--reference'),kling4=process.argv.includes('--kling4'),revised=kling4||photographic||stock;
const root=new URL('../',import.meta.url).pathname,d=root+'artifacts/'+(stock?'countries-stock-en':photographic?'countries-reference-en':kling4?'countries-kling4-en':'countries-fluid-en'),preview=process.argv.includes('--preview'),draft=process.argv.includes('--draft'),edit=d+(preview?'/edit-preview':'/edit'),file=d+'/exports/'+(stock?'tips-to-trip-countries-real-footage-en-42s':photographic?'tips-to-trip-countries-photo-guided-en-42s':kling4?'tips-to-trip-countries-kling4-en-42s':'tips-to-trip-countries-fluid-en-42s')+(preview?'-preview-watermarked':draft?'-watermark-removed-draft':'')+'.mp4';
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(cmd+': '+r.stderr.slice(-1500));return r;};
const probe=p=>JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',p]).stdout);
const p=probe(file),v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio');
if(v.width!==720||v.height!==1280||v.avg_frame_rate!=='30/1'||Number(v.nb_read_frames)!==1260||Math.abs(Number(p.format.duration)-42)>.04||a.codec_name!=='aac'||Number(a.sample_rate)!==48000||a.channels!==2)throw Error('Format mismatch.');
run('ffmpeg',['-hide_banner','-v','error','-i',file,'-f','null','-']);
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',file,'-vn','-ac','2','-ar','48000','-f','s16le',d+'/qa/decoded-audio.pcm']);
const decoded=readFileSync(d+'/qa/decoded-audio.pcm'),audioSeconds=decoded.length/(48000*2*2);
if(Math.abs(audioSeconds-42)>.04)throw Error('Decoded audio duration mismatch.');
const log=run('ffmpeg',['-hide_banner','-i',file,'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']).stderr,b=log.lastIndexOf('{'),loud=JSON.parse(log.slice(b,log.indexOf('}',b)+1));
if(Math.abs(Number(loud.input_i)+16)>1||Number(loud.input_tp)>-1)throw Error('Audio loudness mismatch.');
const plan=JSON.parse(readFileSync(d+'/scene-plan.json')),sceneChecks=plan.countries.map(r=>{const q=probe(edit+'/'+r.name+'-vertical.mp4'),frames=Number(q.streams[0].nb_read_frames);if(frames!==r.len*30)throw Error(r.name+': trim duration mismatch.');return {...r,frames,sourceRangeSeconds:revised?[0,r.len]:[r.start,r.end]};});
const speech=JSON.parse(readFileSync(d+'/elevenlabs/download.scribe.json'));
if(speech.text.toLowerCase().replace(/[^a-z]/g,'')!=='downloadtipstotripnow')throw Error('Narration wording mismatch.');
let stockChecks;
if(stock){
 const manifest=JSON.parse(readFileSync(d+'/stock-manifest.json'));
 if(manifest.sourceType!=='real filmed stock footage'||manifest.sources.length!==6)throw Error('Stock source manifest mismatch.');
 stockChecks=plan.countries.map(row=>{
  const s=manifest.sources.find(s=>s.country===row.name);
  if(!s||s.syntheticVideo!==false||s.license!=='Pexels License'||s.licenseUrl!=='https://www.pexels.com/license/'||!s.pageUrl.startsWith('https://www.pexels.com/')||Math.abs(s.trimEndSeconds-s.trimStartSeconds-row.len)>.001||s.sourceDurationSeconds<s.trimEndSeconds)throw Error(row.name+': source provenance or trim mismatch.');
  for(const [path,expected] of [[s.originalPath,s.originalSha256],[s.cleanPath,s.cleanSha256]])if(createHash('sha256').update(readFileSync(d+'/'+path)).digest('hex')!==expected)throw Error(row.name+': source checksum mismatch.');
  const q=probe(d+'/'+s.cleanPath),v=q.streams.find(s=>s.codec_type==='video');
  if(Number(v.nb_read_frames)!==row.len*30||v.width!==720||v.height!==1280||v.avg_frame_rate!=='30/1'||q.streams.some(s=>s.codec_type==='audio'))throw Error(row.name+': prepared clip mismatch.');
  return {country:row.name,location:s.location,author:s.author,pageUrl:s.pageUrl,licenseUrl:s.licenseUrl,sourceRangeSeconds:[s.trimStartSeconds,s.trimEndSeconds],sourceOriginalUnchanged:true,syntheticVideo:false};
 });
}
if(revised){if(!stock)for(const row of plan.countries){const g=JSON.parse(readFileSync(d+'/generations/'+row.name+'.json'));if(g.status!=='completed'||!(photographic?['alibaba/wan-3.0-prime/image-to-video','bytedance/seedance-2.5/image-to-video']:['kling-video/v4.0/text-to-video']).includes(g.model))throw Error(row.name+': incomplete generation.');}const fx=readFileSync(edit+'/fx-timeline.pcm');if(fx.some(b=>b!==0))throw Error('Unexpected transition sound effects.');}
const result={file,technicalPassed:true,width:v.width,height:v.height,fps:30,frames:1260,duration:Number(p.format.duration),decodedAudioSeconds:audioSeconds,stereo:true,loudnessLUFS:Number(loud.input_i),truePeakDbTP:Number(loud.input_tp),fullDecodePassed:true,sceneChecks,narration:{text:speech.text,at:37.25,officialTimestamps:'elevenlabs/download.mp3.json',independentTranscript:'elevenlabs/download.scribe.json',lipSync:'Not applicable: this montage contains no speaking presenter.'},sourceWatermarksPresent:preview,productionApproved:!revised&&!preview&&!draft,generationModel:photographic?'Image-to-video from real photographs; model recorded per scene':kling4?'kling-video/v4.0/text-to-video':undefined,cleanupLimitation:draft?'Watermark glyphs replaced with spatial reconstruction; softened and distorted scenery remains in the treated area.':undefined,sha256:createHash('sha256').update(readFileSync(file)).digest('hex'),bytes:statSync(file).size,verifiedAt:new Date().toISOString()};
writeFileSync(d+'/qa/'+(preview?'preview':draft?'cleanup-draft':'final')+'-verification.json',JSON.stringify(result,null,2));
if(stock){result.stockChecks=stockChecks;result.generationModel=undefined;result.sourceType='real filmed stock footage';writeFileSync(d+'/qa/final-verification.json',JSON.stringify(result,null,2));}
writeFileSync(d+'/production-status.json',JSON.stringify({status:preview?'review_preview_complete_awaiting_unwatermarked_sources':draft?'cleanup_draft_complete':'completed',finalExportApproved:!revised&&!preview&&!draft,file,sourceOriginalsModified:false,watermarkCleanup:{approved:false,reason:revised?'New generated scenery replaces failed cleanup footage. No stock source is modified.':draft?'User-requested draft saved separately with disclosed spatial reconstruction artefacts.':'Spatial inpainting smears building details; inverse-composite tests retain glyph edges; temporal reprojection produces foreground parallax defects. Rejected tests are not used in the preview.'},updatedAt:new Date().toISOString()},null,2));
if(stock)writeFileSync(d+'/production-status.json',JSON.stringify({status:'technical_verification_passed_awaiting_visual_review',finalExportApproved:false,file,sourceType:'real filmed stock footage',sourceOriginalsModified:false,sourceManifest:'stock-manifest.json',watermarkRemovalUsed:false,generatedSceneryUsed:false,updatedAt:new Date().toISOString()},null,2));
console.log(`Verified ${preview?'review preview':'export'}: 42 seconds, 720 × 1280, 30 fps, stereo, ${loud.input_i} LUFS, ${loud.input_tp} dBTP; full decode passed.`);
