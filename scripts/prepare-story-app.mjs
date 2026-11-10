import sharp from 'sharp';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,dir=root+'artifacts/travel-buddy-story-en';
for(const p of ['demo','qa','demo/avatars','demo/gallery'])mkdirSync(`${dir}/${p}`,{recursive:true});
const ff=a=>{const r=spawnSync('ffmpeg',['-v','error','-y',...a],{encoding:'utf8'});if(r.status)throw Error(r.stderr.slice(-1200));};
const svg=s=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="602" height="1234">${s}</svg>`);
const tx=(x,y,s,size=26,weight=400,fill='#172122')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${fill}">${s.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text>`;
const rect=(x,y,w,h,c,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const circle=Buffer.from('<svg width="160" height="160"><circle cx="80" cy="80" r="80" fill="white"/></svg>');
const faces=[];
for(const [name,input,box]of [['Erin',`${dir}/cast-master.png`,{left:278,top:45,width:390,height:390}],['Nila',`${dir}/cast-master.png`,{left:825,top:48,width:390,height:390}],['Leo',`${root}artifacts/meet-buddy-en/profiles/crops/7.png`,null],['Ava',`${root}artifacts/meet-buddy-en/profiles/crops/1.png`,null]]){
 let p=sharp(input);if(box)p=p.extract(box);const b=await p.resize(160,160,{fit:'cover'}).composite([{input:circle,blend:'dest-in'}]).png().toBuffer();writeFileSync(`${dir}/demo/avatars/${name}.png`,b);faces.push(`data:image/png;base64,${b.toString('base64')}`);
}
const img=(id,x,y,w,h)=>`<image href="${faces[id]}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const gallery=sharp(`${dir}/gallery-master.png`),m=await gallery.metadata();
for(let i=0;i<6;i++)await gallery.clone().extract({left:(i%3)*Math.floor(m.width/3),top:Math.floor(i/3)*Math.floor(m.height/2),width:Math.floor(m.width/3),height:Math.floor(m.height/2)}).png().toFile(`${dir}/demo/gallery/${i}.png`);
const source=`${root}General-assesets/Travel Buddy/TravelBuddyPostCreationSharing.mov`,chat=`${root}General-assesets/Travel Buddy/Manage trip - group chat.mov`;
for(const [id,t,input]of [['share',110,source],['details',106,source],['manage-pending',8,chat],['manage-joined',17,chat],['chat-typing',101,chat],['chat-sent',111,chat]])ff(['-ss',String(t),'-i',input,'-frames:v','1',`${dir}/qa/${id}-native.png`]);
// Keep original native sheet, app/service actions and badges. Replace all contact identity pixels.
const shareNative=sharp(`${dir}/qa/share-native.png`),badges=[];
for(let i=0;i<3;i++)badges.push({input:await shareNative.clone().extract({left:107+i*114,top:915,width:39,height:40}).ensureAlpha().composite([{input:Buffer.from('<svg width="39" height="40"><circle cx="19.5" cy="20" r="17" fill="white"/></svg>'),blend:'dest-in'}]).png().toBuffer(),left:107+i*114,top:915});
let p=rect(125,166,440,89,'#C0C4C4')+tx(130,198,'Erin',28,700)+tx(130,235,'Sri Lanka',22)+rect(35,850,420,178,'#FAF9FD')+img(0,36,166,76,76);
for(let i=0;i<3;i++)p+=img(i,57+i*114,868,76,76)+tx(62+i*114,982,['Erin','Nila','Leo'][i],21);
await shareNative.composite([{input:svg(p)},...badges]).png().toFile(`${dir}/demo/share.png`);
let detailsPatch=rect(126,166,440,89,'#F4FAF8')+tx(130,198,'Erin',28,700)+tx(130,235,'Sri Lanka',22)+img(0,36,166,76,76);
await sharp(`${dir}/qa/details-native.png`).composite([{input:svg(detailsPatch)}]).png().toFile(`${dir}/demo/details.png`);
// Native request cards/buttons retained. Fictional names/photos replace identities only.
p='';for(let i=0;i<4;i++){const y=350+i*227;p+=rect(43,y+15,500,87,'#EBF2F1')+img([1,3,0,2][i],47,y+24,66,66)+tx(125,y+49,['Nila','Ava','Erin','Leo'][i],25,700)+tx(125,y+84,'Requested to join',22,400,'#465152');}
await sharp(`${dir}/qa/manage-pending-native.png`).composite([{input:svg(p)}]).png().toFile(`${dir}/demo/manage-pending.png`);
// Broad identity masks in joined rows leave native green joined indicators and remove controls visible.
p='';for(let i=0;i<4;i++){const y=343+i*133;p+=rect(38,y+6,450,106,'#E8F0EF')+img([1,3,0,2][i],49,y+25,62,62)+tx(125,y+53,['Nila','Ava','Erin','Leo'][i],25,700)+tx(125,y+84,'Joined this trip',20,400,'#53625D');}
await sharp(`${dir}/qa/manage-joined-native.png`).composite([{input:svg(p)}]).png().toFile(`${dir}/demo/manage-joined.png`);
// Use the real recorded chat and retain its message text/keyboard. Replace names, avatars, status names and mention.
let common=rect(0,0,602,62,'#D0DFE1')+tx(35,40,'10:44',25,700)+rect(166,65,70,68,'#D0DFE1')+`<image href="data:image/png;base64,${readFileSync(`${dir}/demo/gallery/0.png`).toString('base64')}" x="177" y="74" width="50" height="50" clip-path="url(#tripPhoto)"/><defs><clipPath id="tripPhoto"><circle cx="202" cy="99" r="25"/></clipPath></defs>`;
let typing=common+rect(156,169,292,47,'#D9E2E0',24)+tx(185,199,'Nila joined the trip.',21,600)+rect(41,253,178,48,'#D5E1E2')+img(1,42,254,38,38)+tx(91,279,'Nila',23,700)+rect(41,452,164,49,'#D5E1E2')+img(3,42,453,38,38)+tx(91,479,'Ava',23,700)+rect(100,662,414,66,'#E0E8E9',20)+tx(110,700,'@Nila Can you book tickets?',24);
await sharp(`${dir}/qa/chat-typing-native.png`).composite([{input:svg(typing)}]).png().toFile(`${dir}/demo/chat-typing.png`);
const chatTop=await sharp(`${dir}/demo/chat-typing.png`).extract({left:0,top:0,width:602,height:735}).png().toBuffer();
await sharp({create:{width:602,height:1234,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:chatTop,left:0,top:0}]).png().toFile(`${dir}/demo/chat-typing-patch.png`);
const manifest={createdAt:new Date().toISOString(),sources:[source.replace(root,''),chat.replace(root,'')],originalsPreserved:true,backendClaim:false,identities:{Erin:'new generated casting photograph, left',Nila:'new generated casting photograph, right',Leo:'cached fictional generated profile 7',Ava:'cached fictional generated profile 1'},gallery:{sourceStart:74.6,sourceDuration:3,replacement:'six newly generated travel photographs; every visible original gallery thumbnail replaced; selection marker redrawn over generated images to remove source-photo edge pixels; native tabs and Done/Preview preserved'},sharing:{sourceTime:110,changes:'All three original contact photos, names and note-to-self label replaced with fictional Erin, Nila and Leo. Original share service badges and application action icons preserved. Author identity replaced.'},groupChat:{sourceTrim:[100,105],changes:'Participant names, DPs, joined status name and composer mention replaced. Native message wording, back arrow, attachments and send controls retained in a fully sanitised stable chat-body composite; native keyboard remains animated underneath. Full opaque body replacement prevents original identities leaking when the keyboard/composer reflows.'},manageRequests:'Fictional identities replace name/photo areas; native buttons preserved.',narrative:'Create flow is recorded France to Spain example. Shared trip details are a separate recorded Sri Lanka example; voiceover explicitly introduces Have a trip to share. No fabricated claim of completed new post publication.'};
writeFileSync(`${dir}/demo/source-edits.json`,JSON.stringify(manifest,null,2));
console.log('Fictional avatars, generated gallery tiles and native-screen privacy composites prepared.');
