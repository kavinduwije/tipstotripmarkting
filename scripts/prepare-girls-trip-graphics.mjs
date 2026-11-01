import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url).pathname,dir=`${root}artifacts/girls-trip-en`;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const tx=(x,y,s,size=25,weight=400,c='#171E1E')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${c}">${esc(s)}</text>`;
const svg=s=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="602" height="1234">${s}</svg>`);
// Preserve the supplied OS share sheet and every sharing action; tailor example
// copy and targets to the fictional Barcelona story. No backend update claimed.
let patch=rect(125,166,440,89,'#C0C4C4')+tx(130,198,'Grace',28,700)+tx(130,235,'France',22);
patch+=rect(34,274,535,252,'#C0C4C4')+tx(36,314,'Girls’ trip to Barcelona',34,700)+tx(36,365,'France → Spain',25)+tx(36,419,'Three days of beaches, cafés',26)+tx(36,455,'and sunset views.',26)+tx(36,508,'Dates: 1 Nov 2026 – 3 Nov 2026',24);
patch+=rect(133,740,366,68,'#FAF9FD')+tx(137,769,'Check out “Girls’ trip to Barcelona”',20,400,'#777777')+tx(137,799,'on Tips to Trip: https://tipstotrip.com/…',19,400,'#777777');
const avatar=[];
for(const [i,name]of [[1,'Ella'],[2,'Sophie'],[3,'Chloe']]){
 const data=await sharp(`${dir}/references/friend${i}.png`).resize(76,76,{fit:'cover'}).composite([{input:Buffer.from('<svg width="76" height="76"><circle cx="38" cy="38" r="38" fill="white"/></svg>'),blend:'dest-in'}]).png().toBuffer();
 avatar.push({input:data,left:57+(i-1)*114,top:868});
 patch+=rect(37+(i-1)*114,957,112,63,'#FAF9FD')+tx(62+(i-1)*114,982,name,21);
}
// Retain native service badges by putting the original lower-right badge over
// each new avatar, and preserve WhatsApp/Messages/Mail sharing actions below.
const source=sharp(`${dir}/qa/source-share.png`),badges=[];
const grace=await sharp(`${dir}/references/friend4.png`).resize(76,76,{fit:'cover'}).modulate({brightness:.75}).composite([{input:Buffer.from('<svg width="76" height="76"><circle cx="38" cy="38" r="38" fill="white"/></svg>'),blend:'dest-in'}]).png().toBuffer();
avatar.push({input:grace,left:36,top:166});
for(let i=0;i<3;i++)badges.push({input:await source.clone().extract({left:107+i*114,top:915,width:39,height:40}).png().toBuffer(),left:107+i*114,top:915});
await source.composite([{input:svg(patch)},...avatar,...badges]).png().toFile(`${dir}/demo/share.png`);
// Portrait-safe group establishing plate: whole four-person reference retained.
const blur=await sharp(`${dir}/cast-master.png`).resize(720,1280,{fit:'cover'}).blur(28).modulate({brightness:.5}).png().toBuffer();
await sharp(blur).composite([{input:await sharp(`${dir}/cast-master.png`).resize(720,538).png().toBuffer(),left:0,top:350}]).png().toFile(`${dir}/planning-group-portrait.png`);
const spec=JSON.parse(readFileSync(`${root}scripts/girls-trip-english.json`));
writeFileSync(`${dir}/source-edits.json`,JSON.stringify({campaign:spec.campaign,destination:'Barcelona',route:{from:'France',to:'Spain',sourceFieldsPreserved:true},sources:spec.sourceFiles,originalRecordingsPreserved:true,backendClaim:false,edits:[{stage:'gallery',operation:'Replace nine unrelated gallery thumbnails and selected post image with cached Barcelona city photos; retain native tabs, selection tick, Done, Preview, Add photo and X controls.',tracking:'demo/gallery-tracking.json',assetCredits:'demo/asset-sources.json'},{stage:'share',operation:'Replace example post copy, author and contact portraits/names to match fictional Barcelona trip; retain original native share actions and service badges.',file:'demo/share.png',marketingComposite:true},{stage:'chat',operation:'Use real group-chat recording without generated interface or fabricated messages.'}],narrative:'Travel Buddy is presented over the real manual trip planner. No generated AI answer is inserted or represented as a live result.',generatedVisuals:'Higgsfield',dialogueAndMusic:'ElevenLabs',priorCampaignExportsPreserved:true},null,2));
console.log('Share graphic and editorial manifest prepared.');
