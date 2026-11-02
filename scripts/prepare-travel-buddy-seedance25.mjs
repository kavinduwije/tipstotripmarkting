import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,spec=JSON.parse(readFileSync(root+'scripts/travel-buddy-seedance25.json')),dir=root+spec.directory,demo=dir+'/demo';
process.env.FONTCONFIG_FILE=root+'artifacts/meet-buddy-seedance25/edit/fonts.conf';
const sharp=(await import('sharp')).default;
for(const d of ['assets','frames-gallery','frames-selected','frames-share','qa'])mkdirSync(demo+'/'+d,{recursive:true});
const run=(args)=>{const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8',maxBuffer:8*1024*1024});if(r.status!==0)throw Error(r.stderr.slice(-1000));};
const source=root+spec.source,esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const svg=(w,h,s)=>Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${s}</svg>`);
const rect=(x,y,w,h,fill,rx=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${rx}"/>`;
async function text(s,size,width,colour='#111111',bold=false){return sharp({text:{text:`<span foreground="${colour}">${esc(s)}</span>`,font:`Inter ${bold?'Bold':'Regular'} ${size}`,fontfile:root+'brandKIT/04-Fonts/Inter-Variable.ttf',width,rgba:true}}).png().toBuffer();}
async function avatar(id,size){const c=spec.cast.find(x=>x.id===id);const b=await sharp(root+c.reference).extract({left:280,top:100,width:470,height:470}).resize(size,size).png().toBuffer();const mask=svg(size,size,`<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>`);return sharp(b).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();}
const ids=[31244837,16841068,16429021,27550036,17070681,14434675,13426112,33455437,34947043];
const photos=[];
for(const id of ids){const original=`${root}artifacts/travel-buddy-en/revision-02/assets/barcelona-${id}.jpg`,dest=`${demo}/assets/barcelona-${id}.jpg`;if(!existsSync(dest))writeFileSync(dest,readFileSync(original));photos.push(dest);}
const tiles=await Promise.all(photos.map(p=>sharp(p).resize(199,201,{fit:'cover'}).png().toBuffer()));
const selected=await sharp(photos[3]).resize(162,145,{fit:'cover'}).composite([{input:svg(162,145,rect(0,0,162,145,'white',20)),blend:'dest-in'}]).png().toBuffer();
const tracking=[];
function extract(name,start,len){const folder=`${demo}/frames-${name}`;run(['-ss',String(start),'-i',source,'-t',String(len),'-vf','fps=30','-start_number','0',`${folder}/%04d.png`]);return folder;}
async function encode(name,folder,len){run(['-framerate','30','-i',folder+'/%04d.png','-t',String(len),'-an','-c:v','libx264','-preset','fast','-crf','15','-pix_fmt','yuv420p','-movflags','+faststart',`${demo}/${name}.mp4`]);console.log(`${name}: native screen edit prepared.`);}
const galleryStart=74.2,galleryLen=2.5,gallery=extract('gallery',galleryStart,galleryLen);
for(const name of readdirSync(gallery).filter(n=>/^\d+\.png$/.test(n)).sort()){
 const path=gallery+'/'+name,b=readFileSync(path),{data,info}=await sharp(b).removeAlpha().raw().toBuffer({resolveWithObject:true});
 let top;
 for(let y=250;y<750;y++){let count=0;for(let x=145;x<320;x++){const p=(y*info.width+x)*3;if(data[p]<110&&data[p+1]>65&&data[p+1]<165&&data[p+2]>180)count++;}if(count>130){top=y;break;}}
 if(top===undefined)continue;
 const grid=top+110,items=[];
 for(let i=0;i<9;i++){const x=[0,201,402][i%3],y=grid+Math.floor(i/3)*203,h=Math.min(201,1234-y);if(h<=0)continue;
  const marked=[];for(let yy=y;yy<Math.min(y+48,1234);yy++)for(let xx=x;xx<Math.min(x+48,602);xx++){const p=(yy*602+xx)*3;if(data[p]<95&&data[p+1]>75&&data[p+1]<160&&data[p+2]>180)marked.push([xx,yy]);}
  items.push({input:h===201?tiles[i]:await sharp(tiles[i]).extract({left:0,top:0,width:199,height:h}).toBuffer(),left:x+1,top:y});
  if(i===3&&marked.length>110){const cx=Math.round(marked.reduce((a,p)=>a+p[0],0)/marked.length),cy=Math.round(marked.reduce((a,p)=>a+p[1],0)/marked.length),sx=Math.max(0,cx-22),sy=Math.max(0,cy-22),badge=await sharp(b).extract({left:sx,top:sy,width:45,height:45}).composite([{input:svg(45,45,'<circle cx="22.5" cy="22.5" r="22" fill="white"/>'),blend:'dest-in'}]).png().toBuffer();items.push({input:badge,left:sx,top:sy});}
 }
 let footer=1201;
 for(let y=1000;y<1215;y++){let count=0;for(let x=440;x<552;x++){const p=(y*602+x)*3;if(data[p]<110&&data[p+1]>65&&data[p+1]<165&&data[p+2]>180)count++;}if(count>85){footer=y-18;break;}}
 const fourthY=grid+655,visible=Math.min(201,footer-fourthY);if(visible>0)for(let i=0;i<3;i++)items.push({input:await sharp(tiles[i+6]).extract({left:0,top:0,width:199,height:visible}).toBuffer(),left:[1,202,403][i],top:fourthY});
 await sharp(b).composite(items).png().toFile(path+'.tmp');writeFileSync(path,readFileSync(path+'.tmp'));
 tracking.push({clip:'gallery',frame:Number(name.slice(0,4)),sourceSeconds:galleryStart+Number(name.slice(0,4))/30,nativePhotosButtonY:top,tiles:9});
}
await encode('gallery',gallery,galleryLen);
// Stop before the native transition to Criteria, so the replacement stays on Photos.
const chosen=extract('selected',77.15,.5);
for(const name of readdirSync(chosen).filter(n=>/^\d+\.png$/.test(n)).sort()){
 const path=chosen+'/'+name,b=readFileSync(path),items=[{input:selected,left:53,top:684}];
 // Retain the native remove-photo control over the replacement thumbnail.
 const cross=await sharp(b).extract({left:169,top:689,width:42,height:42}).composite([{input:svg(42,42,'<circle cx="21" cy="21" r="20" fill="white"/>'),blend:'dest-in'}]).png().toBuffer();items.push({input:cross,left:169,top:689});
 await sharp(b).composite(items).png().toFile(path+'.tmp');writeFileSync(path,readFileSync(path+'.tmp'));
}
await encode('selected',chosen,.5);
const sharing=extract('share',110.9,1.5),avatars=await Promise.all(['maya','sofia','chloe'].map(c=>avatar(c,72))),host=await avatar('ellie',74);
for(const name of readdirSync(sharing).filter(n=>/^\d+\.png$/.test(n)).sort()){
 const path=sharing+'/'+name,b=readFileSync(path),{data}=await sharp(b).removeAlpha().raw().toBuffer({resolveWithObject:true});
 // Track the settled native sheet edge from its white left interior.
 let sheet;for(let y=550;y<850;y++){const p=(y*602+24)*3;if(data[p]>240&&data[p+1]>240&&data[p+2]>240){sheet=y-15;break;}}
 if(sheet===undefined)throw Error('Native sharing sheet tracking failed.');const dy=sheet-617;
 const bg=(x,y)=>{const p=(y*602+x)*3;return`rgb(${data[p]},${data[p+1]},${data[p+2]})`;};
 const items=[{input:svg(602,1234,rect(28,157,546,371,bg(510,175))+rect(132,746+dy,375,70,bg(480,770+dy))+rect(35,851+dy,494,171,bg(450,900+dy))+rect(0,1224,602,10,bg(510,175))),left:0,top:0},{input:host,left:39,top:168}];
 for(const [str,size,width,x,y,bold] of [['Ellie’s Barcelona plan',25,445,128,177,true],['Spain',22,445,128,215,false],['Trip to Spain — Barcelona',35,530,38,282,true],['France → Spain',24,470,76,344,false],['Looking for a buddy to explore Barcelona.',25,520,38,396,false],['Dates: 22 Nov 2026 – 28 Nov 2026',23,530,38,488,false],['Check out “Trip to Spain — Barcelona”\non Tips to Trip: https://tipstotrip.co…',19,372,137,751+dy,false]])items.push({input:await text(str,size,width,'#262C2C',bold),left:x,top:y});
 for(let i=0;i<3;i++){const x=[58,171,285][i],cx=x+36;items.push({input:avatars[i],left:x,top:869+dy});items.push({input:await text(['Maya','Sofia','Chloe'][i],21,95),left:cx-26,top:963+dy});
  // Reapply native WhatsApp/Messages/Mail service badges from the same frame.
  const bx=[108,222,335][i],by=917+dy;items.push({input:await sharp(b).extract({left:bx,top:by,width:37,height:37}).png().toBuffer(),left:bx,top:by});}
 await sharp(b).composite(items).png().toFile(path+'.tmp');writeFileSync(path,readFileSync(path+'.tmp'));
 tracking.push({clip:'share',frame:Number(name.slice(0,4)),sheetOffset:dy,fictionalRecipients:['Maya','Sofia','Chloe'],nativeSharingActionsRetained:true});
}
await encode('share',sharing,1.5);
run(['-ss','51.25','-t','0.6','-i',source,'-vf','setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=3','-frames:v','75','-an','-c:v','libx264','-crf','15','-pix_fmt','yuv420p',`${demo}/day1.mp4`]);
run(['-ss','68.8','-t','0.5','-i',source,'-vf','setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=3','-frames:v','75','-an','-c:v','libx264','-crf','15','-pix_fmt','yuv420p',`${demo}/day2.mp4`]);
writeFileSync(`${demo}/source-edits.json`,JSON.stringify({source:spec.source,originalRetained:true,purpose:'User-requested marketing demonstration edits',changes:[{area:'Android image picker',change:'Nine gallery thumbnails replaced with cached licensed Barcelona photographs; native selection state and controls retained'},{area:'Selected photo preview',change:'Selected image follows the replacement Barcelona thumbnail; native remove control retained'},{area:'Share sheet suggested recipients',change:'Original avatars/names replaced with fictional campaign characters Maya, Sofia and Chloe; native service badges and sharing buttons retained'},{area:'Trip detail background and share preview title',change:'Barcelona continuity text and fictional host Ellie replace unrelated Sri Lanka trip text in the supplied sharing example'}],editorialHolds:[{clip:'selected.mp4',sourceStart:77.15,sourceReadSeconds:.5,outputSeconds:1.85,extensionAppliedInRenderer:true,reason:'Keep the replacement confined to Trip host photos and hold before the native transition to Criteria'},{clip:'day1.mp4',sourceStart:51.25,sourceReadSeconds:.6,outputSeconds:2.5,reason:'Hold the recorded completed Park Güell stop; omit loading wait and blank next-day entry'},{clip:'day2.mp4',sourceStart:68.8,sourceReadSeconds:.5,outputSeconds:2.5,reason:'Hold the recorded completed Sagrada Família stop; omit loading wait and blank next-day entry'}],actualBackendPublicationDemonstrated:false,messageSent:false,shareLinkControlsRecreated:false,photoSources:'assets-sources.json',tracking:'edit-tracking.json'},null,2));
writeFileSync(`${demo}/edit-tracking.json`,JSON.stringify(tracking,null,2));
const sources=JSON.parse(readFileSync(root+'artifacts/travel-buddy-en/revision-02/asset-sources.json'));
writeFileSync(`${demo}/assets-sources.json`,JSON.stringify({cityPhotos:sources.cityPhotos,characters:spec.cast.map(c=>({id:c.id,source:c.reference,fictional:true}))},null,2));
console.log('Requested demonstration edits and provenance recorded.');
