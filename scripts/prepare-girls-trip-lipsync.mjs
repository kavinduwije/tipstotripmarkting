import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const base=`${root}artifacts/girls-trip-en`,out=`${base}/lip-sync-revision`;
mkdirSync(`${out}/inputs`,{recursive:true});
function run(cmd,args){const r=spawnSync(cmd,args,{encoding:'utf8'});if(r.status!==0)throw Error(`${cmd}: ${r.stderr.slice(-1200)}`);return r.stdout;}
const shots=JSON.parse(readFileSync(`${root}scripts/girls-trip-shots.json`)).filter(s=>s.speaker||s.lines);
const inputs=[];
for(const s of shots){
 const source=`${base}/${s.id}.mp4`,video=`${out}/inputs/${s.id}.mp4`,audio=`${out}/inputs/${s.id}.wav`;
 const probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-of','json',source]));
 const vs=probe.streams.find(v=>v.codec_type==='video'),duration=Number(vs.duration);
 run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',source,'-map','0:v:0','-c:v','copy','-an',video]);
 run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`${base}/elevenlabs/${s.id}-driving.wav`,'-af',`apad,atrim=duration=${duration},asetpts=N/SR/TB`,'-ar','48000','-ac','1','-c:a','pcm_s16le',audio]);
 inputs.push({shot:s.id,video:video.slice(root.length),audio:audio.slice(root.length),duration,multiSpeaker:!!s.lines,sourceSha256:createHash('sha256').update(readFileSync(source)).digest('hex'),audioSha256:createHash('sha256').update(readFileSync(audio)).digest('hex')});
 console.log(`${s.id}: ${duration}s, dry matching audio prepared`);
}
writeFileSync(`${out}/manifest.json`,JSON.stringify({status:'inputs_prepared',provider:'Higgsfield Lipsync Studio',model:'Sync Lipsync 3',originalPreserved:true,correctionCompleted:false,audio:'Exact matching ElevenLabs driving speech; no music',inputs},null,2));
