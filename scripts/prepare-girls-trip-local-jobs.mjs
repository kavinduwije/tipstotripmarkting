import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,base=`${root}artifacts/girls-trip-en`,rev=`${base}/lip-sync-revision`,local=`${rev}/local-trials`;
const spec=JSON.parse(readFileSync(`${root}scripts/girls-trip-english.json`)),shots=JSON.parse(readFileSync(`${root}scripts/girls-trip-shots.json`)).filter(s=>s.speaker||s.lines);
mkdirSync(local,{recursive:true});
const jobs=[];
for(const s of shots){
 if(s.speaker){jobs.push({shot:s.id,input:`${rev}/inputs/${s.id}.mp4`,audio:`${rev}/inputs/${s.id}.wav`,face:-1,seconds:s.duration});continue;}
 for(let face=0;face<4;face++){
  const name=`${s.id}-friend${face+1}`,audio=`${rev}/inputs/${name}.wav`,lines=spec.dialogues.filter(d=>s.lines.includes(d.id)&&d.speaker===`friend${face+1}`);
  let args,filter;
  if(lines.length){args=lines.flatMap(d=>['-i',`${base}/elevenlabs/${d.id}.wav`]);filter=lines.map((d,i)=>`[${i}:a]adelay=${Math.round((d.at-s.at)*1000)}:all=1[a${i}]`).join(';')+';'+lines.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${lines.length}:normalize=0,apad,atrim=duration=${s.duration}[a]`;}
  else{args=['-f','lavfi','-i','anullsrc=r=48000:cl=mono'];filter=`[0:a]atrim=duration=${s.duration}[a]`;}
  const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args,'-filter_complex',filter,'-map','[a]','-ar','48000','-ac','1','-c:a','pcm_s16le',audio],{encoding:'utf8'});if(r.status)throw Error('Could not prepare isolated speech.');
  jobs.push({shot:name,source:s.id,input:face===0?`${rev}/inputs/${s.id}.mp4`:`${local}/${s.id}-friend${face}-face${face-1}.mp4`,audio,face,seconds:s.duration});
 }
}
writeFileSync(`${rev}/local-jobs.json`,JSON.stringify(jobs,null,2));
console.log(`${jobs.length} face-specific jobs prepared; other speakers never share a driving track.`);
