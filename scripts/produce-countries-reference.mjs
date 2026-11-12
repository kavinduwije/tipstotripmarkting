import {loadEnvFile} from 'node:process';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {config,higgsfield,APIError} from '@higgsfield/client/v2';

const root=new URL('../',import.meta.url).pathname,dir=root+'artifacts/countries-reference-en';
const stage=process.argv[2]??'status';
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const save=(p,j)=>writeFile(p,JSON.stringify(j,null,2));
await mkdir(dir+'/generations',{recursive:true});await mkdir(dir+'/clean',{recursive:true});
loadEnvFile(root+'.env.local');if(!process.env.HF_CREDENTIALS)throw Error('Configure HF_CREDENTIALS locally.');
config({credentials:process.env.HF_CREDENTIALS,maxRetries:0});
const plans=JSON.parse(await readFile(dir+'/generation-plan.json'));
const selected=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
for(const plan of plans.filter(p=>!selected||selected.includes(p.id))){
 const pending=dir+'/generations/'+plan.id+'.pending.json',final=dir+'/generations/'+plan.id+'.json';
 try{
  if(stage==='submit'){
   if(await exists(pending)){console.log(plan.id+': saved request reused');continue;}
   await save(pending,{status:'submission_started',...plan,submittedAt:new Date().toISOString()});
   try{const r=await higgsfield.subscribe(plan.model,{input:plan.input,withPolling:false});await save(pending,{...plan,...r});console.log(plan.id+': '+r.status);}
   catch(e){const code=e instanceof APIError?e.statusCode:undefined;await save(pending,{...plan,status:code?'submission_rejected':'submission_ambiguous',httpStatus:code,errorType:e.name,networkCode:/^(ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT)$/.test(e.code??'')?e.code:undefined});throw Error(plan.id+': '+(code?'HTTP '+code:e.name)+'; request state retained.');}
  }else if(stage==='status'){
   if(!await exists(pending)){console.log(plan.id+': not submitted');continue;}
   let j=JSON.parse(await readFile(await exists(final)?final:pending));
   if(!['completed','failed','nsfw','canceled'].includes(j.status)){
    if(!j.status_url){console.log(plan.id+': '+j.status);continue;}
    let r;try{r=await fetch(j.status_url,{headers:{Authorization:'Key '+process.env.HF_CREDENTIALS},signal:AbortSignal.timeout(45000)});}catch{throw Error(plan.id+': status connection failed; no new request submitted.');}
    if(!r.ok)throw Error(plan.id+': status HTTP '+r.status);
    j={...j,...await r.json()};await save(['completed','failed','nsfw','canceled'].includes(j.status)?final:pending,j);
   }
   console.log(plan.id+': '+j.status);
   if(j.status==='completed'&&j.video?.url&&!await exists(dir+'/clean/'+plan.id+'.mp4')){
    const r=await fetch(j.video.url,{signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(plan.id+': download HTTP '+r.status);
    await writeFile(dir+'/clean/'+plan.id+'.mp4',Buffer.from(await r.arrayBuffer()));console.log(plan.id+': downloaded');
   }
  }else throw Error('Choose submit or status.');
 }catch(e){console.error(e.message.startsWith(plan.id)?e.message:'Production failed; request state retained.');process.exitCode=1;break;}
}
