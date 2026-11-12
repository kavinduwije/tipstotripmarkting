import {readFileSync,writeFileSync,copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Downloaded camera footage is preserved unchanged. No watermark reconstruction,
// generative processing, frame interpolation or synthetic camera motion is used.
const root=new URL('../',import.meta.url).pathname,dir=root+'artifacts/countries-stock-en';
for(const sub of ['clean','edit','qa','elevenlabs','exports'])mkdirSync(dir+'/'+sub,{recursive:true});
const sources=[
 {country:'Spain',id:30268393,slug:'breathtaking-montserrat-aerial-landscape',author:'Nirjhar Basak',location:'Montserrat, Catalonia, Spain',file:'Spain-original.mp4',trimStartSeconds:4,trimEndSeconds:8},
 {country:'France',id:32495414,slug:'aerial-view-of-paris-with-eiffel-tower',author:'Travel with Lenses',location:'Paris, France — Eiffel Tower viewed from Montparnasse',file:'France-original.mp4',trimStartSeconds:4,trimEndSeconds:10},
 {country:'Portugal',id:4333055,slug:'people-walking-in-the-town-square',author:'Hervé Piglowski',location:'Rua Augusta, Lisbon, Portugal',file:'Portugal-original.mp4',trimStartSeconds:4,trimEndSeconds:8},
 {country:'Sri Lanka',id:13234027,slug:'drone-video-of-the-nine-arch-bridge-in-ella-sri-lanka',author:'Rudi De Ceuster',location:'Nine Arch Bridge, Ella, Sri Lanka',file:'Sri Lanka-original.mp4',trimStartSeconds:3,trimEndSeconds:7},
 {country:'Italy',id:32697877,slug:'stunning-4k-capture-of-milan-s-duomo-cathedral',author:'Earth Photart',location:'Duomo di Milano, Milan, Italy',file:'Italy-alternative-original.mp4',trimStartSeconds:.4,trimEndSeconds:6.4},
 {country:'Germany',id:40043156,slug:'brandenburger-tor-in-der-abenddammerung-mit-verkehrsfluss',author:'Ivan Chumak',location:'Brandenburg Gate, Berlin, Germany',file:'Germany-original.mp4',trimStartSeconds:0,trimEndSeconds:15}
];
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:4*1024*1024});if(r.status!==0)throw Error(cmd+': '+r.stderr.slice(-1800));return r.stdout;};
for(const source of sources){
 const original=dir+'/stock/'+source.file,out=dir+'/clean/'+source.country+'.mp4';
 const probe=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',original])),video=probe.streams.find(s=>s.codec_type==='video');
 if(Number(probe.format.duration)+.001<source.trimEndSeconds)throw Error(source.country+': source too short.');
 Object.assign(source,{pageUrl:source.country==='Germany'?`https://www.pexels.com/de-de/video/${source.slug}-${source.id}/`:`https://www.pexels.com/video/${source.slug}-${source.id}/`,downloadUrl:`https://www.pexels.com/download/video/${source.id}/`,license:'Pexels License',licenseUrl:'https://www.pexels.com/license/',originalPath:'stock/'+source.file,originalSha256:createHash('sha256').update(readFileSync(original)).digest('hex'),sourceWidth:video.width,sourceHeight:video.height,sourceFps:video.avg_frame_rate,sourceDurationSeconds:Number(probe.format.duration),cleanPath:'clean/'+source.country+'.mp4',portraitCrop:'Centre crop after scaling to 1280px height',syntheticVideo:false});
 if(!existsSync(out)||process.argv.includes('--force')){
  const duration=source.trimEndSeconds-source.trimStartSeconds;
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(source.trimStartSeconds),'-i',original,'-an','-vf',`setpts=PTS-STARTPTS,scale=-2:1280:flags=lanczos,crop=720:1280:(iw-ow)/2:0,setsar=1,fps=30,trim=duration=${duration},setpts=PTS-STARTPTS,format=yuv420p`,'-frames:v',String(Math.round(duration*30)),'-c:v','libx264','-preset','fast','-crf','16','-threads','4','-movflags','+faststart',out]);
 }
 source.cleanSha256=createHash('sha256').update(readFileSync(out)).digest('hex');
 console.log(source.country+': real footage trimmed to '+(source.trimEndSeconds-source.trimStartSeconds)+' seconds.');
}
writeFileSync(dir+'/stock-manifest.json',JSON.stringify({sourceType:'real filmed stock footage',licenseCheckedAt:'2026-11-11',licenseUrl:'https://www.pexels.com/license/',licenseUse:'Pexels permits downloading, editing, advertising and social media use. Attribution optional; source credits retained. No endorsement is implied.',sources},null,2));
const prior=root+'artifacts/countries-kling4-en';
for(const name of ['download.mp3','download.mp3.json','download.scribe.json','music.mp3','music.mp3.json'])copyFileSync(prior+'/elevenlabs/'+name,dir+'/elevenlabs/'+name);
for(const name of ['final-mix.wav','fx-timeline.pcm','voice.pcm','voice-timeline.wav','app-vertical.mp4'])copyFileSync(prior+'/edit/'+name,dir+'/edit/'+name);
writeFileSync(dir+'/SOURCE-CREDITS.txt','Tips to Trip — real filmed country scenery\n\nFootage sourced from Pexels under the Pexels License: https://www.pexels.com/license/\n\n'+sources.map(s=>`${s.country}: ${s.location}\nFilmmaker: ${s.author}\nSource: ${s.pageUrl}\nSelected range: ${s.trimStartSeconds}–${s.trimEndSeconds} seconds\n`).join('\n')+'\nNarration and music: existing ElevenLabs production assets. App footage and branding: supplied Tips to Trip assets.\nNo generated scenery or watermark removal used in this version.\n');
writeFileSync(root+'artifacts/countries-reference-en/production-status.json',JSON.stringify({status:'superseded_by_real_filmed_stock',reason:'User selected real filmed stock footage after five terminal Higgsfield credit failures. Completed Spain tests and all request states preserved; no requests resubmitted.',replacementDirectory:'artifacts/countries-stock-en',updatedAt:new Date().toISOString()},null,2));
console.log('Sources, license, trims and original checksums recorded; existing music, voice and closing footage reused.');
