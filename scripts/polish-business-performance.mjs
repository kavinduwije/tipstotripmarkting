import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const dir=`${root}artifacts/ugc-business-es`,voice=`${dir}/elevenlabs`,backup=`${voice}/before-polish`;
mkdirSync(backup,{recursive:true});
function run(args){const r=spawnSync('ffmpeg',['-hide_banner','-v','error','-y',...args],{encoding:'utf8',maxBuffer:2e6});if(r.status!==0)throw new Error(r.stderr);}
// Reviewed against independent Scribe word times and the original waveform.
// All cuts land on video frames; the same cuts are applied to speech and visuals.
const edits=[
  [{start:0,end:7/30,reason:'Remove an unprompted opening filler'}],
  [{start:100/30,end:111/30,reason:'Remove the duplicated des syllable before descripción'},{start:171/30,end:178/30,reason:'Remove a filler before Si necesitas un logo'}],
  [{start:169/30,end:189/30,reason:'Remove an unprompted eh between publicaciones and se descubren'}],
  []
];
for(let i=1;i<=4;i++){
  const id=`segment-0${i}`,metaPath=`${voice}/${id}.json`,wav=`${voice}/${id}.wav`;
  for(const ext of ['json','wav'])if(!existsSync(`${backup}/${id}.${ext}`))copyFileSync(`${voice}/${id}.${ext}`,`${backup}/${id}.${ext}`);
  const original=JSON.parse(readFileSync(`${backup}/${id}.json`));
  const cuts=edits[i-1],keep=[];let cursor=0;
  for(const cut of cuts){if(cut.start>cursor)keep.push({start:cursor,end:cut.start});cursor=cut.end;}if(cursor<15)keep.push({start:cursor,end:15});
  const audioFilter=keep.map((p,n)=>`[0:a]atrim=start=${p.start}:end=${p.end},asetpts=PTS-STARTPTS[a${n}]`).join(';')+';'+keep.map((_,n)=>`[a${n}]`).join('')+`concat=n=${keep.length}:v=0:a=1,apad,atrim=duration=15[out]`;
  run(['-i',`${backup}/${id}.wav`,'-filter_complex',audioFilter,'-map','[out]','-ar','44100','-ac','1','-c:a','pcm_s16le',wav]);
  const rawVideo=`${dir}/presenter-segment-0${i}.mp4`;
  const videoFilter=keep.map((p,n)=>`[0:v]trim=start=${p.start}:end=${p.end},setpts=PTS-STARTPTS[v${n}]`).join(';')+';'+keep.map((_,n)=>`[v${n}]`).join('')+`concat=n=${keep.length}:v=1:a=0,fps=30,tpad=stop_mode=clone:stop_duration=2,trim=duration=15[v]`;
  run(['-i',rawVideo,'-i',wav,'-filter_complex',videoFilter,'-map','[v]','-map','1:a','-r','30','-frames:v','450','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000','-t','15',`${dir}/presenter-polished-0${i}.mp4`]);
  const nativeFilter=audioFilter.replaceAll('[0:a]','[0:a]');
  run(['-i',rawVideo,'-filter_complex',nativeFilter,'-map','[out]','-ac','1','-ar','16000','-c:a','pcm_s16le',`${dir}/qa/presenter-polished-0${i}.wav`]);
  const alignment=original.preparedAlignment;
  const adjust=t=>Math.max(0,t-cuts.reduce((total,p)=>total+Math.max(0,Math.min(t,p.end)-p.start),0));
  const metadata={...original,preparedAlignment:{...alignment,character_start_times_seconds:alignment.character_start_times_seconds.map(adjust),character_end_times_seconds:alignment.character_end_times_seconds.map(adjust)},performancePolish:{cuts,preparedDurationSeconds:15,method:'Identical frame-aligned cuts in narration and generated presenter video, then pad only the quiet tail'}};
  writeFileSync(metaPath,JSON.stringify(metadata,null,2));
}
for(const part of [1,2]){
  const i=(part-1)*2+1;
  for(const f of [`${dir}/presenter-0${part}.mp4`,`${dir}/presenter-0${part}.wav`,`${dir}/presenter-0${part}.transcript.json`,`${voice}/presenter-0${part}.mp3`,`${voice}/presenter-0${part}.wav`]){
    const b=`${backup}/${f.startsWith(voice)?'voice':'presenter'}-${f.split('/').at(-1)}`;if(existsSync(f)&&!existsSync(b))copyFileSync(f,b);
  }
  run(['-i',`${dir}/presenter-polished-0${i}.mp4`,'-i',`${dir}/presenter-polished-0${i+1}.mp4`,'-filter_complex','[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]','-map','[v]','-map','[a]','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-r','30','-frames:v','900','-c:a','aac','-b:a','192k','-ar','48000','-t','30',`${dir}/presenter-0${part}.mp4`]);
  run(['-i',`${dir}/qa/presenter-polished-0${i}.wav`,'-i',`${dir}/qa/presenter-polished-0${i+1}.wav`,'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[a]','-map','[a]','-ar','16000','-ac','1','-c:a','pcm_s16le',`${dir}/presenter-0${part}.wav`]);
  run(['-i',`${voice}/segment-0${i}.wav`,'-i',`${voice}/segment-0${i+1}.wav`,'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[a]','-map','[a]','-c:a','libmp3lame','-b:a','128k',`${voice}/presenter-0${part}.mp3`]);
  run(['-i',`${voice}/presenter-0${part}.mp3`,'-ar','16000','-ac','1','-c:a','pcm_s16le',`${voice}/presenter-0${part}.wav`]);
  const words=[];
  for(let j=0;j<2;j++){
    const a=JSON.parse(readFileSync(`${voice}/segment-0${i+j}.json`)).preparedAlignment;let word='',s=0,e=0;
    const flush=()=>{if(word)words.push({start:s+j*15,end:e+j*15,word});word='';};
    a.characters.forEach((ch,n)=>{if(/\s/.test(ch)){flush();return;}if(!word)s=a.character_start_times_seconds[n];word+=ch;e=a.character_end_times_seconds[n];});flush();
  }
  writeFileSync(`${voice}/presenter-0${part}.transcript.json`,JSON.stringify([{start:words[0].start,end:words.at(-1).end,text:words.map(w=>w.word).join(' '),words}],null,2));
  const meta=JSON.parse(readFileSync(`${dir}/presenter-0${part}.json`));meta.performancePolish='Identical frame-aligned cuts in the original generated segments and supplied driving audio';writeFileSync(`${dir}/presenter-0${part}.json`,JSON.stringify(meta,null,2));
}
const plan=JSON.parse(readFileSync(`${root}scripts/ugc-business-spanish-scenes.json`));
const revised={'02-create':4.2,'03-location':7,'04-categories':9.466667,'05-profile-focus':13,'08-logo':20.1,'09-select-logo':25.033333,'10-created':27.9,'13-map':38.633333,'14-map-focus':43};
for(const scene of plan){
  if(revised[scene.id]!==undefined)scene.at=revised[scene.id];
  // Show the app at the speech repair points so the presenter cuts stay invisible.
  if(['07-description','12-discovery'].includes(scene.id))scene.appOnly=true;
}
writeFileSync(`${dir}/scene-timing.json`,JSON.stringify(plan,null,2));
writeFileSync(`${dir}/qa/performance-polish.json`,JSON.stringify({edits,rawGenerationsPreserved:true,originalNarrationPreservedIn:backup,audioAndVideoEditedTogether:true,noSpeechAccelerated:true,videoDurationSeconds:60,reviewPending:true},null,2));
console.log('Polished Spanish narration and presenter together; raw generations and narration preserved.');
