import sharp from 'sharp';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,base=`${root}artifacts/group-trip-en`,rev=`${base}/revision-02`;
mkdirSync(`${rev}/demo/creation`,{recursive:true});mkdirSync(`${rev}/qa`,{recursive:true});
const ff=a=>{const r=spawnSync('ffmpeg',['-v','error','-y',...a],{encoding:'utf8'});if(r.status)throw Error(r.stderr.slice(-1200));};
const svg=s=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="602" height="1234">${s}</svg>`);
const tx=(x,y,s,size=26,weight=400,fill='#172122')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${fill}">${s.replace(/&/g,'&amp;')}</text>`;
const rect=(x,y,w,h,c,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c}"/>`;
const native=(t,out,chat=false)=>ff(['-ss',String(t),'-i',`${root}General-assesets/Meet Buddy/${chat?'Manage trip - group chat':'Trip creation - trip preferences - trip details'}.mov`,'-frames:v','1',out]);
native(20,`${rev}/demo/entry-native.png`);native(181,`${rev}/demo/share-native.png`);native(105,`${rev}/demo/chat-native.png`,true);native(74,`${rev}/demo/chat-composer-native.png`,true);
native(174,`${rev}/demo/itinerary-native.png`);
native(120,`${rev}/demo/preferences-native.png`);mkdirSync(`${rev}/demo/preferences`,{recursive:true});
for(let n=0;n<45;n++){
 let p='';
 for(const [frame,x,y,w,label] of [[6,52,590,158,'Adventure'],[18,52,678,200,'Beach & Relax'],[30,266,678,204,'Food & Culture']])if(n>=frame){p+=`<rect x="${x}" y="${y}" width="${w}" height="58" rx="23" fill="#C4DFDF" stroke="#0D6F70" stroke-width="1.5"/><path d="M${x+15} ${y+29}l5 5 10-11" fill="none" stroke="#183D3E" stroke-width="2.5"/>`+tx(x+37,y+37,label,20,600);}
 await sharp(`${rev}/demo/preferences-native.png`).composite([{input:svg(p)}]).png().toFile(`${rev}/demo/preferences/${String(n).padStart(4,'0')}.png`);
}
ff(['-framerate','30','-i',`${rev}/demo/preferences/%04d.png`,'-an','-c:v','libx264','-crf','16','-pix_fmt','yuv420p',`${rev}/demo/preferences.mp4`]);
await sharp(`${rev}/demo/preferences/0044.png`).toFile(`${rev}/demo/preferences-selected.png`);
const faces=[];
for(let i=0;i<4;i++){
 const portrait=`${base}/friend${i+1}-closeup.png`;
 const [left,top]=[[0,255],[140,165],[150,255],[245,225]][i];
 const b=await sharp(portrait).extract({left,top,width:430,height:430}).resize(160,160).composite([{input:Buffer.from('<svg width="160" height="160"><circle cx="80" cy="80" r="80" fill="white"/></svg>'),blend:'dest-in'}]).png().toBuffer();
 writeFileSync(`${rev}/demo/avatar-${['Maya','Ben','Zoe','Leo'][i]}.png`,b);faces.push(`data:image/png;base64,${b.toString('base64')}`);
}
// Precise, authorised text substitutions over the supplied native fields.
for(let n=0;n<111;n++){
 const t=n/30,fields=[{value:'Trip to Lisboa',start:.1,end:1.1,y:198},{value:'Spain',start:1.35,end:1.9,y:306},{value:'Lisbon',start:2.1,end:2.7,y:413}];
 let patch='';
 for(const f of fields){const len=Math.floor(Math.max(0,Math.min(1,(t-f.start)/(f.end-f.start)))*f.value.length),str=f.value.slice(0,len);patch+=rect(129,f.y-30,353,41,'#E1E7E8')+tx(134,f.y,str);if(t>=f.start&&t<f.end+.12)patch+=rect(135+len*13,f.y-26,2,32,'#0B6C6D');}
 await sharp(`${rev}/demo/entry-native.png`).composite([{input:svg(patch)}]).png().toFile(`${rev}/demo/creation/${String(n).padStart(4,'0')}.png`);
}
ff(['-framerate','30','-i',`${rev}/demo/creation/%04d.png`,'-an','-c:v','libx264','-crf','16','-pix_fmt','yuv420p',`${rev}/demo/creation.mp4`]);
// Keep the operating system's share sheet, row spacing and application buttons.
let share=rect(133,744,365,64,'#FAF9FD')+tx(137,770,'Check out “Trip to Lisboa” on Tips',20,400,'#777777')+tx(137,798,'To Trip: https://tipstotrip.com/p/trip…',20,400,'#777777')+rect(30,851,530,171,'#FAF9FD');
for(let i=0;i<4;i++){const x=51+i*133;share+=`<image href="${faces[i]}" x="${x}" y="867" width="76" height="76"/>`+tx(x+11,978,['Maya','Ben','Zoe','Leo'][i],21);}
const sharePhotos=[];
for(const [file,left,top,width,height] of [['lisbon-streets',151,140,330,117],['lisbon-selfie',37,340,222,165],['lisbon-pastries',270,340,222,165]]){
 const still=`${rev}/demo/${file}-share.png`;ff(['-ss','1','-i',`${base}/${file}.mp4`,'-frames:v','1',still]);
 const input=await sharp(still).resize(width,height,{fit:'cover'}).linear(.67,0).composite([{input:Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="15" fill="white"/></svg>`),blend:'dest-in'}]).png().toBuffer();
 sharePhotos.push({input,left,top});
}
await sharp(`${rev}/demo/share-native.png`).composite([...sharePhotos,{input:svg(share)}]).png().toFile(`${rev}/demo/share.png`);
// The original native header, message bubbles and composer remain the layout.
// This fictional conversation is a marketing composite, not a backend capture.
const composer=await sharp(`${rev}/demo/chat-composer-native.png`).extract({left:0,top:1135,width:602,height:99}).png().toBuffer();
let chat=rect(75,53,505,86,'#D0DFE1')+rect(0,141,602,994,'#F2F8F8');
chat+=`<image href="${faces[1]}" x="106" y="70" width="52" height="52"/>`+tx(174,105,'Trip to Lisboa',27,600);
const flag=await sharp({text:{text:'🇵🇹',font:'Apple Color Emoji 72',rgba:true}}).png().toBuffer();
chat+=`<image href="data:image/png;base64,${flag.toString('base64')}" x="355" y="78" width="36" height="31"/>`;
const messages=[['Maya','Love the first day!',0],['Zoe','Can we do the beach on Saturday?',2],['Ben','Yes! Sunset after?',1],['Leo','I’m in!',3]];
for(let i=0;i<4;i++){
 const y=205+i*215,w=i===1?548:380;
 chat+=rect(24,y,w,181,'#D5E1E2',31)+`<image href="${faces[messages[i][2]]}" x="44" y="${y+20}" width="42" height="42"/>`+tx(98,y+49,messages[i][0],22,700);
 if(i===1)chat+=tx(45,y+99,'Can we do the beach',25)+tx(45,y+133,'on Saturday?',25);else chat+=tx(45,y+105,messages[i][1],25);
 chat+=tx(45,y+160,`Oct 27, 10:4${i+3} PM`,17,400,'#485658');
}
await sharp(`${rev}/demo/chat-native.png`).composite([{input:svg(chat)},{input:composer,left:0,top:1135}]).png().toFile(`${rev}/demo/chat.png`);
// Match the native itinerary's example content to the Lisbon story.
ff(['-ss','2','-i',`${base}/lisbon-streets.mp4`,'-frames:v','1',`${rev}/demo/lisbon-still.png`]);
const lisbonPhoto=await sharp(`${rev}/demo/lisbon-still.png`).resize(330,144,{fit:'cover'}).png().toBuffer();
let itinerary=rect(120,199,135,33,'#E8F0F0')+tx(123,224,'3 days',22,700)+rect(369,199,160,33,'#E8F0F0')+tx(372,224,'72 hours',22,700);
itinerary+=rect(57,392,487,82,'#E8F0F0')+tx(60,417,'Review the shared plan and travel',20)+tx(60,444,'preferences together before your trip.',20);
itinerary+=rect(75,606,490,64,'#F2F8F8')+tx(78,636,'Alfama, Lisbon, Portugal',22,700);
itinerary+=rect(75,854,489,64,'#F2F8F8')+tx(78,885,'Praça do Comércio, Lisbon',22,700);
itinerary+=rect(75,1103,490,40,'#F2F8F8')+tx(78,1134,'Miradouro da Senhora do Monte',22,700);
await sharp(`${rev}/demo/itinerary-native.png`).composite([{input:svg(itinerary)},{input:lisbonPhoto,left:151,top:708}]).png().toFile(`${rev}/demo/itinerary.png`);
for(const name of ['AppleStoreLogo','PlayStoreLogo']){
 const {data,info}=await sharp(`${root}General-assesets/${name}.png`).extract({left:29,top:220,width:542,height:162}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,seen=new Uint8Array(w*h),q=[];const add=(x,y)=>{const p=y*w+x;if(seen[p]||Math.max(...data.subarray(p*4,p*4+3))<60)return;seen[p]=1;q.push(p);};
 for(let x=0;x<w;x++){add(x,0);add(x,h-1);}for(let y=0;y<h;y++){add(0,y);add(w-1,y);}for(let i=0;i<q.length;i++){const p=q[i],x=p%w,y=Math.floor(p/w);if(x)add(x-1,y);if(x<w-1)add(x+1,y);if(y)add(x,y-1);if(y<h-1)add(x,y+1);}
 for(let p=0;p<seen.length;p++)if(seen[p])data[p*4+3]=0;
 await sharp(data,{raw:{width:w,height:h,channels:4}}).resize(270,81).png().toFile(`${rev}/${name}-transparent.png`);
}
writeFileSync(`${rev}/source-edits.json`,JSON.stringify({requestedChanges:['Full Trip to Lisboa typing','From Spain; To Lisbon','Cast share targets','Trip to Lisboa Portugal chat with Maya, Ben, Zoe, Leo','Edge-connected white badge canvas removed'],contextEdits:['Lisbon itinerary examples','Share-sheet background photos reuse the Lisbon cast footage'],recordingsPreserved:true,nativeControlsPreserved:true,marketingComposite:true,backendClaim:false,avatarsSource:'../cast-master-v2.png via individual crops',previousExportPreserved:true,lipSyncStatus:'See lipsync/manifest.json and qa/visual-review.json'},null,2));
console.log('Revision app composites and transparent store badges prepared.');
