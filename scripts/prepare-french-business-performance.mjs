import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=`${root}artifacts/ugc-business-fr`,voice=`${dir}/elevenlabs`,backup=`${voice}/before-clean`;
for(let i=1;i<=4;i++)if(existsSync(`${dir}/presenter-segment-0${i}.pending.json`)||existsSync(`${dir}/presenter-segment-0${i}.json`))throw Error('Do not change driving narration after presenter submission');
mkdirSync(backup,{recursive:true});mkdirSync(`${dir}/qa`,{recursive:true});
function run(args){const r=spawnSync('ffmpeg',['-hide_banner','-v','error','-y',...args],{encoding:'utf8',maxBuffer:2e6});if(r.status!==0)throw Error(r.stderr);}
// Independent Scribe review of the actual prepared audio identified these
// unrequested words. Remove them BEFORE generating any audio-driven video.
const cuts=[{start:0,end:0.3,reason:'Remove unrequested Et before Vous'},{start:11.5,end:12.566667,reason:'Remove euh and shorten its surrounding gap, preserving complete neighboring words'}];
const id='segment-01';
for(const ext of ['json','wav'])if(!existsSync(`${backup}/${id}.${ext}`))copyFileSync(`${voice}/${id}.${ext}`,`${backup}/${id}.${ext}`);
const original=JSON.parse(readFileSync(`${backup}/${id}.json`));
const keep=[];let cursor=0;for(const p of cuts){if(p.start>cursor)keep.push({start:cursor,end:p.start});cursor=p.end;}keep.push({start:cursor,end:15});
const filter=keep.map((p,n)=>`[0:a]atrim=start=${p.start}:end=${p.end},asetpts=PTS-STARTPTS[a${n}]`).join(';')+';'+keep.map((_,n)=>`[a${n}]`).join('')+`concat=n=${keep.length}:v=0:a=1,apad,atrim=duration=15[out]`;
run(['-i',`${backup}/${id}.wav`,'-filter_complex',filter,'-map','[out]','-ar','44100','-ac','1','-c:a','pcm_s16le',`${voice}/${id}.wav`]);
const a=original.preparedAlignment,adjust=t=>Math.max(0,t-cuts.reduce((sum,p)=>sum+Math.max(0,Math.min(t,p.end)-p.start),0));
writeFileSync(`${voice}/${id}.json`,JSON.stringify({...original,preparedAlignment:{...a,character_start_times_seconds:a.character_start_times_seconds.map(adjust),character_end_times_seconds:a.character_end_times_seconds.map(adjust)},performanceClean:{cuts,beforeVideoGeneration:true,speechNotAccelerated:true}},null,2));
for(const part of [1,2]){
 const start=(part-1)*2+1;
 run(['-i',`${voice}/segment-0${start}.wav`,'-i',`${voice}/segment-0${start+1}.wav`,'-filter_complex','[0:a][1:a]concat=n=2:v=0:a=1[a]','-map','[a]','-c:a','libmp3lame','-b:a','128k',`${voice}/presenter-0${part}.mp3`]);
 run(['-i',`${voice}/presenter-0${part}.mp3`,'-ar','16000','-ac','1','-c:a','pcm_s16le',`${voice}/presenter-0${part}.wav`]);
 const words=[];
 for(let j=0;j<2;j++){
  const alignment=JSON.parse(readFileSync(`${voice}/segment-0${start+j}.json`)).preparedAlignment;let word='',s=0,e=0;
  function flush(){if(word)words.push({start:s+j*15,end:e+j*15,word});word='';}
  alignment.characters.forEach((ch,n)=>{if(/\s/.test(ch)){flush();return;}if(!word)s=alignment.character_start_times_seconds[n];word+=ch;e=alignment.character_end_times_seconds[n];});flush();
 }
 writeFileSync(`${voice}/presenter-0${part}.transcript.json`,JSON.stringify([{start:words[0].start,end:words.at(-1).end,text:words.map(w=>w.word).join(' '),words}],null,2));
}
const plan=JSON.parse(readFileSync(`${root}scripts/ugc-business-french-scenes.json`));
const times={'02-network':3.1,'03-network-map':8.45,'04-sales':11.4,'06-categories':18.433333,'07-audience':19.6,'08-details':20.666667,'09-logo':23,'10-select-logo':26.166667,'11-created':28.6,'13-feed':36.7,'14-map':41.933333,'15-experience':43.6,'16-ideas':45,'17-insights':48.666667,'18-close':50.933333,'19-end-card':57.4};
for(const scene of plan){
 if(times[scene.id]!==undefined)scene.at=times[scene.id];
 if(scene.id==='02-network')scene.appOnly=true;
 if(scene.id==='16-ideas'){scene.source='Features for travel business providers.mov';scene.start=50;scene.length=1.5;scene.feature='Statistiques';scene.title='Suivez l’intérêt des voyageurs';scene.sub='Visites, clics et favoris';scene.side=['Les visites','Les clics','Les favoris'];}
 if(scene.id==='12-publish'){scene.start=35;scene.length=5.5;}
 if(scene.id==='10-select-logo')scene.appOnly=true;
 if(scene.id==='17-insights'){scene.start=44;scene.length=4;scene.feature='Votre tableau de bord';scene.title='Des idées pour publier';scene.sub='Des recommandations pour votre activité';}
}
plan.push({id:'04b-preview',at:13.4,appOnly:true,source:'How to create business profile in tips to trip with generated business logos as well.mov',start:126,length:1.5,feature:'Votre activité',title:'Votre future vitrine',sub:'Un profil pour présenter vos expériences'});
plan.push({id:'05b-identity',at:16.6,source:'How to create business profile in tips to trip with generated business logos as well.mov',start:13,length:4,feature:'Votre profil',title:'Présentez votre activité',sub:'Nom, localisation et catégories',step:'02',side:['Votre nom','Votre localisation','Vos services']});
plan.sort((a,b)=>a.at-b.at);
writeFileSync(`${dir}/scene-timing.json`,JSON.stringify(plan,null,2));
writeFileSync(`${dir}/qa/narration-clean.json`,JSON.stringify({cuts,beforeVideoGeneration:true,originalNarrationPreserved:true,speechNotAccelerated:true,reviewPending:true,reason:'Remove unrequested hesitation and align marketing demonstrations to French speech'},null,2));
console.log('Cleaned narration before animation; original takes and official timestamps preserved.');
