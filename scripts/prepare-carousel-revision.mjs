import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url).pathname,dir=root+'artifacts/travel-buddy-carousel-en',prior=root+'artifacts/travel-buddy-story-en';
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const text=(x,y,s,size=23,fill='#172122')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="600" fill="${fill}">${s}</text>`;
const avatar=async(p,w)=>sharp(p).resize(w,w).png().toBuffer();
const header=await sharp(dir+'/demo/chat-typing.png').extract({left:0,top:0,width:602,height:140}).png().toBuffer();
// Crop the keyboard away; native message bubbles and actual sent wording remain.
const patch=Buffer.from(`<svg width="602" height="650">${rect(0,140,602,92,'#F4FAF8')}${rect(42,252,175,44,'#D5E1E2')}${text(92,279,'Ava')}${rect(94,448,405,43,'#086967')}${text(145,475,'Alex',23,'#CCE0E0')}${rect(98,508,463,48,'#086967')}${text(100,540,'@Nila Can you book tickets?',24,'#FFFFFF')}</svg>`);
const cropped=await sharp(prior+'/qa/chat-sent-native.png').extract({left:0,top:0,width:602,height:650}).png().toBuffer();
await sharp(cropped).composite([{input:patch,left:0,top:0},{input:header,left:0,top:0},{input:await avatar(prior+'/demo/avatars/Ava.png',38),left:42,top:254},{input:await avatar(dir+'/demo/alex-avatar.png',38),left:94,top:449}]).png().toFile(dir+'/demo/chat-conversation.png');
await sharp(prior+'/qa/chat-sent-native.png').composite([{input:dir+'/demo/chat-conversation.png',left:0,top:0}]).png().toFile(dir+'/demo/chat-sent.png');
const manifest=JSON.parse(readFileSync(dir+'/demo/source-edits.json'));
manifest.revision02={requestedChanges:['Opening label: The travel story of: Alex','Typing shortened from seven to two seconds','39–44 seconds shows a crop of the actual recorded sent conversation without the keyboard','53–57 second cards contained within the frame, with transparent padded textures, balanced perspective, restrained motion and soft shadows'],audio:'Original final AAC stream copied without modification',conversation:{sourceFrame:111,source:manifest.sources[1],crop:{left:0,top:0,width:602,height:650},changes:'Keyboard cropped out. Partially obscured preceding bubble omitted. Native visible Hiii and sent ticket message retained; author and mentioned person changed to fictional Ava, Alex and Nila with corresponding fictional avatars. Header photo/name comes from the established privacy composite. This is an editorial demonstration, not a new backend transaction.'}};
manifest.groupChat.outputDuration=2;manifest.groupChat.speed=2.45;
writeFileSync(dir+'/demo/source-edits.json',JSON.stringify(manifest,null,2));
console.log('Revision conversation crop and source-edit record prepared.');
