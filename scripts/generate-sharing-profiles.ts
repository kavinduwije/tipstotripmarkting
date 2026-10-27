import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {config,higgsfield,APIError,AuthenticationError} from '@higgsfield/client/v2';

const root=fileURLToPath(new URL('../',import.meta.url));
const meetBuddy=process.argv.includes('--meet-buddy');
const dir=`${root}artifacts/${meetBuddy?'meet-buddy-en/profiles':'ugc-product-fr/sharing-profiles'}`;
const model='higgsfield-ai/soul/v2/standard';
const profiles=meetBuddy?[
{id:'travellers-a',name:'Fictional traveler portraits A',description:'Exactly TWELVE separate photorealistic adult traveler headshots in an exact 4-column by 3-row contact sheet, 12 equal square cells, no gaps and no borders, each cell contains only ONE unique person. Six women and six men ages 24 to 35, diverse European, South Asian, East Asian and African backgrounds, distinct hairstyles and different friendly faces, casual colorful travel clothing, softly blurred outdoor daylight backgrounds. Every face centered within its own square cell, entire head and shoulders visible, enough breathing room, eye contact, realistic skin, candid friendly smiles. No cell spanning, no duplicated faces, no text or UI.'},
{id:'travellers-b',name:'Fictional traveler portraits B',description:'Exactly TWELVE separate photorealistic adult traveler headshots in an exact 4-column by 3-row contact sheet, 12 equal square cells, no gaps and no borders, each cell contains only ONE unique person. Six women and six men ages 25 to 38, diverse British, French, Portuguese, Sri Lankan, Latin American and African appearances, distinct hairstyles and different approachable faces. Casual colorful travel clothing, natural coastal or park backgrounds, every face centered in its own square cell, full head visible and shoulders, realistic skin, authentic warm smiles, daylight. No duplicated faces, no cell spanning, no text or UI.'}
]:[
  {id:'camille',name:'Camille Moreau',description:'Fictional adult French woman age 27, shoulder-length dark brown hair, brown eyes, relaxed genuine smile, olive linen blouse, softly blurred sunny park'},
  {id:'lea',name:'Léa',description:'Fictional adult French woman age 25, curly black hair, warm dark skin, relaxed genuine smile, cream t-shirt, softly blurred coastal path'},
  {id:'self',name:'Note to self',description:'Fictional adult man age 29, dark short hair, light stubble, relaxed genuine smile, navy t-shirt, softly blurred leafy city street'},
  {id:'hugo',name:'Hugo',description:'Fictional adult French man age 28, sandy brown hair, clean shaven, relaxed genuine smile, light blue shirt, softly blurred outdoor cafe'},
  {id:'ines',name:'Inès Martin',description:'Fictional adult French woman age 26, wavy chestnut hair, warm olive skin, relaxed genuine smile, teal blouse, softly blurred Mediterranean village'}
];
type Result={status:string;request_id?:string;images?:Array<{url:string}>};
async function exists(p:string){try{await access(p);return true;}catch{return false;}}
async function main(){
  loadEnvFile(`${root}.env.local`);
  const credentials=process.env.HF_CREDENTIALS;
  if(!credentials||!/^[^:\s]+:[^:\s]+$/.test(credentials))throw new Error('Credentials must be configured locally');
  config({credentials,maxRetries:0});
  await mkdir(dir,{recursive:true});
  for(const [i,p] of profiles.entries()){
    const pending=`${dir}/${p.id}.pending.json`,complete=`${dir}/${p.id}.json`,image=`${dir}/${p.id}.png`;
    const input={prompt:meetBuddy?p.description:`Natural photorealistic social profile photograph. ${p.description}. Head and shoulders, face centered, full hair visible with comfortable margin, looking toward camera, soft natural daylight, realistic skin texture, candid everyday travel-network profile photo. One person only. This is an entirely fictional person, not a celebrity. No text, logos, watermarks, borders or UI.`,batch_size:1,resolution:meetBuddy?'1080p':'720p',aspect_ratio:meetBuddy?'4:3':'1:1',enhance_prompt:false,seed:meetBuddy?250317+i:221700+i};
    let result:Result;
    if(await exists(complete)){result=JSON.parse(await readFile(complete,'utf8'));console.log(`Reusing ${p.id}.`);}
    else{
      if(await exists(pending)){result=JSON.parse(await readFile(pending,'utf8'));console.log(`Resuming ${p.id}; no duplicate submission.`);}
      else{
        await writeFile(pending,JSON.stringify({status:'submission_started',model,input},null,2));
        console.log(`Generating fictional ${p.id} profile with Higgsfield (billable).`);
        try{result=await higgsfield.subscribe(model,{input,withPolling:false});}
        catch(e){
          const status=e instanceof AuthenticationError?401:e instanceof APIError?e.statusCode:undefined;
          if(status&&[400,401,403,404,422].includes(status))await writeFile(pending,JSON.stringify({status:'submission_rejected',httpStatus:status,model,input},null,2));
          throw new Error(status?`Profile submission rejected (HTTP ${status}); state saved.`:'Profile submission uncertain; inspect saved state before retrying.');
        }
        await writeFile(pending,JSON.stringify({...result,model,input},null,2));
      }
      if(!result.request_id)throw new Error('Saved profile request has no request ID; do not resubmit automatically.');
      const requestId=result.request_id;
      const began=Date.now();
      while(!['completed','failed','nsfw','moderated','canceled','cancelled'].includes(result.status)){
        if(Date.now()-began>15*60*1000)throw new Error('Profile polling timeout; request state saved.');
        await new Promise(resolve=>setTimeout(resolve,10000));
        const response=await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(requestId)}/status`,{headers:{Authorization:`Key ${credentials}`},signal:AbortSignal.timeout(60000)});
        if(!response.ok)throw new Error(`Profile status check rejected (HTTP ${response.status}).`);
        result=await response.json() as Result;
        await writeFile(pending,JSON.stringify({...result,model,input},null,2));
        console.log(`${p.id}: ${['queued','in_progress','completed','failed','nsfw','moderated','canceled','cancelled'].includes(result.status)?result.status:'waiting'}`);
      }
      if(result.status!=='completed'||!result.images?.[0]?.url)throw new Error('Profile generation unsuccessful; saved state retained.');
      await writeFile(complete,JSON.stringify({...result,model,input,name:p.name},null,2));
    }
    if(!await exists(image)){
      const url=result.images?.[0]?.url;
      if(!url||new URL(url).protocol!=='https:')throw new Error('Profile output URL missing or invalid.');
      const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw new Error('Profile image download failed.');
      await writeFile(image,Buffer.from(await response.arrayBuffer()));
    }
    console.log(`Saved ${p.id} profile.`);
  }
  await writeFile(`${dir}/profiles.json`,JSON.stringify({provider:'Higgsfield',model,profiles:profiles.map(({id,name})=>({id,name,file:`${id}.png`,fictional:true}))},null,2));
}
main().catch(e=>{console.error(e instanceof Error&&e.message.startsWith('Profile')||e instanceof Error&&e.message.startsWith('Saved')||e instanceof Error&&e.message.startsWith('Credentials')?e.message:'Profile generation could not complete; inspect saved request state.');process.exitCode=1;});
