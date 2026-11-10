import sharp from 'sharp';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const dir=`${root}artifacts/hiking-buddy-es`;
const shared=`${root}artifacts/meet-buddy-en`;
const spec=JSON.parse(readFileSync(`${root}scripts/hiking-buddy-spanish.json`));
export const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export const text=(x,y,s,size=26,color='#192624',weight=400,anchor='start')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}">${esc(s)}</text>`;
const box=(x,y,w,h,fill='#F4FAF8',r=20,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const image=(uri,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="${uri}"/>`;
const data=f=>`data:image/png;base64,${readFileSync(f).toString('base64')}`;
const svg=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="604" height="1236">${s}</svg>`;
const location=['Potes','Potes','Camaleño','Potes','Potes','Mogrovejo','Fuente Dé','Potes'];
const activities=['Senderismo','Un café','Paseando','Senderismo','Explorando','Un café','Senderismo','Gastronomía'];
const names=['Maya Laurent','Isabel Costa','Aiko Tanaka','Lucía Martín','Lucas Moreau','Mateo Silva','Oliver Chen','Noah Mensah','Amara James','Theo Martin','Arjun Perera','Nila Fernando','Ethan Brooks','Chloe Wilson','Sofia Mendes','Leo Laurent','Adam Clarke','Lina Dias','Hugo Costa','Emma Reed','Camille Moreau','Lea Martin','Alex Morgan','Hugo Bernard'];
let portraits,refs,map,region,nav,bar,controls,own,bell;
export const profiles=names.map((name,i)=>({name,activity:i===3?'Senderismo':activities[i%8],place:i===3?'Potes':location[i%8],distance:i===3?'1.2 km away':`${(0.2+(i%10)*0.3).toFixed(1)} km away`,countries:1+i%8,fictional:true}));
export async function prepare(){
 mkdirSync(`${dir}/demo`,{recursive:true});mkdirSync(`${dir}/qa`,{recursive:true});
 portraits=profiles.map((p,i)=>data(i===3?`${dir}/ines-avatar.png`:`${shared}/profiles/crops/${i}.png`));
 own=data(`${dir}/lucia-avatar.png`);
 const tiles=JSON.parse(readFileSync(`${dir}/maps/tiles.json`));
 if(!existsSync(`${dir}/maps/potes.png`))await sharp({create:{width:768,height:1280,channels:3,background:'#E7EFE4'}}).composite(tiles.tiles.map((r,i)=>({input:`${root}${r.path}`,left:(i%3)*256,top:Math.floor(i/3)*256}))).png().toFile(`${dir}/maps/potes.png`);
 map=data(`${dir}/maps/potes.png`);region=map;
 controls=Object.fromEntries(['list','map','requests','profile','help','location'].map(id=>[id,data(`${shared}/demo/control-${id}.png`)]));
 bell=data(`${shared}/demo/bell.png`);nav=data(`${shared}/demo/nav.png`);bar=data(`${shared}/demo/bar.png`);
 refs=Object.fromEntries(['status-edit','profile','request','sent','requests'].map(id=>[id,data(`${shared}/qa/${id}-reference.png`)]));
 writeFileSync(`${dir}/demo/source-edits.json`,JSON.stringify({
 sources:['General-assesets/Meet buddy.mov','General-assesets/How to update meet buddy live user status cloud.mov','General-assesets/Meet buddy request sending steps.mov','General-assesets/Meet Buddy list view.png','General-assesets/Meet buddy screen chat cloud status example.png'],
 nativeReferences:'Frames and button crops retained from the earlier Meet Buddy production; no controls replaced by generated icons.',
 changes:['Fictional adult Lucía and Inés names and avatars from the new Higgsfield cast','User-scripted Potes hiking invitation in native Travel Status','User-scripted quick-note response in the native Live meet request sheet','Accurate Potes/Camaleño map tiles and fictional nearby traveller badges','Edited immediate saved status for demonstration; not backend evidence','Two native live-gallery thumbnail contents replaced with fictional hiking pictures; no new gallery controls'],
 requestOutcome:'Native request composition displays the fictional Inés note. A sent request remains awaiting response. The Al día siguiente hiking meeting is a fictional story time jump, not a recorded acceptance.',
 mapAttribution:'© OpenStreetMap contributors',floatingControls:JSON.parse(readFileSync(`${shared}/demo/floating-controls.json`))
 },null,2));
}
export function avatar(i,x,y,r=38,id='a'){
  const uri=i===-1?own:portraits[i];
  return `<defs><clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath></defs><circle cx="${x}" cy="${y}" r="${r+3}" fill="#fff"/><image x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" preserveAspectRatio="xMidYMin slice" href="${uri}" clip-path="url(#${id})"/>`;
}
function header(){return image(bar,0,0,604,62)+box(0,62,604,107,'#F4FAF8',0)+avatar(-1,64,114,38,'own-head')+text(302,98,'Current Location⌄',18,'#455450',700,'middle')+text(302,140,'Potes, España',25,'#1b2421',700,'middle')+`<path d="M248 148H355" stroke="#273D36"/>`+`<defs><clipPath id="bellclip"><circle cx="541" cy="113" r="40"/></clipPath></defs><g clip-path="url(#bellclip)">${image(bell,501,73,79,81)}</g>`;}
function go(){return box(23,188,200,78,'#F7FCFA',28)+text(44,235,'Go Live',22,'#172E29',700)+box(129,202,82,48,'#0C7978',24)+`<circle cx="186" cy="226" r="19" fill="white"/>`;}
function bottom(){return `<defs><clipPath id="navClip"><rect x="0" y="1121" width="604" height="115" rx="32"/></clipPath></defs><g clip-path="url(#navClip)">${image(nav,0,1121,604,115)}</g>`;}
function controlButtons(listMode=false){
 const x=listMode?491:495,ys=listMode?[621,729,836]:[624,732,839];
 return image(controls[listMode?'map':'list'],x-12,ys[0]-12,112,118)
   +image(controls.requests,x-12,ys[1]-12,112,118)
   +image(controls.profile,x-12,ys[2]-12,112,118)
   +image(controls.help,x+12,listMode?938:941,76,76)
   +(listMode?'':image(controls.location,495,165,100,106));
}
function buttonPointer(x,y,t=0){const r=26+8*Math.sin(t*Math.PI);return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFFFFF" fill-opacity=".35" stroke="#07A69E" stroke-width="4"/><circle cx="${x}" cy="${y}" r="8" fill="#05796E"/>`;}
function cloud(i,x,y,label,sub='',dir=1,highlight=false){
  const w=label.length>15||sub.length>22?288:224,h=sub?85:61,bx=Math.max(16,Math.min(604-w-16,dir>0?x-38:x-w+38)),by=y-(sub?141:116);
  return box(bx,by,w,h,highlight?'#E8FFEE':'#F9FDFB',22,highlight?'#0B9485':'#e0e8e5')+`<path d="M${x-8} ${by+h}l8 14 12-14" fill="${highlight?'#E8FFEE':'#F9FDFB'}"/>`+text(bx+19,by+34,label,23,'#233C36',700)+(sub?text(bx+19,by+61,sub,18,'#4C7267'):'' )+avatar(i,x,y,29,`map-${i}-${Math.round(x)}`)+`<circle cx="${x}" cy="${y+32}" r="8" fill="#268FE2" stroke="#fff" stroke-width="2"/>`;
}
export function mapScreen(t=0,{zoom=false,status=false,regional=false,selected=false}={}){
  const m=regional?region:map;
  let s=`<defs><clipPath id="mapClip"><rect x="0" y="165" width="604" height="956"/></clipPath></defs><g clip-path="url(#mapClip)">`;
  if(zoom&&!regional){const z=1+Math.min(.16,t*.02);s+=`<g transform="translate(${302*(1-z)} ${635*(1-z)}) scale(${z})">`;}
  // Reframe the cached maps around land. Marker badges and their location
  // dots must stay inland, including when the nearby map zooms.
  s+=`<image x="0" y="165" width="604" height="1007" href="${m}"/>`;
  s+=cloud(0,125,425,'Explorando','Potes',-1)+cloud(2,465,425,'Senderismo','Camaleño',1)+cloud(1,125,645,'Un café','Potes',-1)+cloud(3,465,645,'Senderismo','Potes · Mañana',1,true)+cloud(11,445,815,'Paseando','Mogrovejo',-1);
  if(status)s+=cloud(-1,125,915,'Senderismo','Picos de Europa · Mañana',-1,true);
  else s+=avatar(-1,125,915,29,'map-self');
  if(zoom&&!regional)s+='</g>';
  s+='</g>'+header()+go()+controlButtons()+box(238,1090,366,31,'#F8FCFA',0)+text(586,1112,'© OpenStreetMap contributors',16,'#3f5950',400,'end')+bottom();
  if(selected)s+=buttonPointer(465,645,Math.min(1,t));
  return svg(s);
}
export function listScreen(t,duration=5.4){
  const viewport=835,row=218,total=profiles.length*row;
  // A quick directory scroll, easing into the first and last readable cards.
  const p=Math.max(0,Math.min(1,(t-.5)/(duration-1))),ease=p<.5?2*p*p:1-2*(1-p)*(1-p);
  const offset=ease*(total-viewport);
  let s=box(0,0,604,1236,'#F5FBF9',0)+`<defs><clipPath id="listClip"><rect x="0" y="273" width="604" height="848"/></clipPath></defs><g clip-path="url(#listClip)"><g transform="translate(0 ${273-offset})">`;
  profiles.forEach((p,i)=>{const y=i*row;s+=box(18,y,568,202,'#F0F6F4',34,'#D4DEDA')+avatar(i,82,y+67,47,`list-${i}`)+text(163,y+43,p.name,28,'#192C25',700)+text(553,y+44,'›',40,'#475A53',700)+box(443,y+55,91,35,'#A6F4F5',18)+text(488,y+79,'● Live',20,'#126A69',700,'middle')+text(163,y+84,'⌖ '+p.place,22,'#566962')+text(163,y+121,p.activity,23,'#213D34')+text(550,y+158,'➤ '+p.distance,19,'#0B7975',700,'end')+box(163,y+145,149,39,'#E1E9E6',19)+text(237,y+172,'◉ '+p.countries+' countries',18,'#4B5B55',700,'middle');});
  s+='</g></g>'+header()+go()+bottom()+controlButtons(true);
  s+=box(594,286,5,815,'#E1E8E4',2)+box(594,286+ease*725,5,90,'#65B6AB',2);
  return svg(s);
}
function wrap(value,n){const lines=[];let line='';for(const w of value.split(' ')){if((line+' '+w).trim().length>n){lines.push(line);line=w;}else line=(line+' '+w).trim();}if(line)lines.push(line);return lines;}
export function statusScreen(t){
  const value=spec.hikingStatus;
  const typed=value.slice(0,Math.floor(Math.max(0,Math.min(1,(t-.8)/3.5))*value.length));
  let s=image(refs['status-edit'],0,0,604,1236)+box(185,151,230,181,'#F4FAF8',0)+avatar(-1,301,249,76,'edit-own')+box(70,338,480,88,'#F4FAF8',0)+text(302,378,'Lucía Martín',37,'#192624',700,'middle')+text(302,414,'@luciamartin',25,'#53645D',400,'middle');
  const lines=wrap(typed,42);
  s+=box(28,649,548,200,'#F4FAF8',4,'#126E62')+lines.map((line,i)=>text(48,681+i*29,line,22,'#273D35')).join('')+box(412,852,165,37,'#F4FAF8',0)+text(552,877,typed.length+'/1000',19,'#57635D',400,'end');
  s+=image(data(`${dir}/lucia-gallery.png`),31,1003,167,167)+image(data(`${dir}/mountain-gallery.png`),219,1003,167,167);
  if(t>6.3)s+=buttonPointer(523,598,(t-6.3)/.7);
  return svg(s);
}
export function profileScreen(sent=false,t=0){
  let s=image(refs.profile,0,0,604,1236)+box(160,150,280,277,'#F4FAF8',0)+avatar(-1,302,238,77,'profile-avatar')+text(302,373,'Lucía Martín',37,'#192624',700,'middle')+text(302,415,'@luciamartin',24,'#4B5E54',400,'middle');
  s+=box(22,680,562,68,'#F4FAF8',0)+text(31,713,'Senderismo · Picos de Europa',24,'#273D35')+text(31,743,'Mañana · ¿Te apuntas a la ruta?',23,'#43675B');
  if(sent)s+=box(32,764,546,76,'#D9E3DE',38)+text(302,813,'Request sent',25,'#697C72',700,'middle')+box(0,1083,604,41,'#153F35',0)+text(302,1112,'Live buddy request sent',20,'#FFFFFF',400,'middle');
  if(t>0&&t<1)s+=buttonPointer(302,800,t);
  return svg(s);
}
export function requestScreen(t=0){
  const note=spec.responseNote;
  const typed=note.slice(0,Math.floor(Math.min(1,t/1.15)*note.length));
  let s=image(refs.request,0,0,604,1236)+box(160,150,280,180,'#626565',0)+`<g opacity="0.48">${avatar(-1,302,238,77,'request-profile-background')}</g>`+box(55,544,490,56,'#DEE7E3',0)+text(62,579,'Cuéntale a Lucía tu plan.',23,'#405B4F');
  s+=box(95,628,415,161,'#DEE7E3',0)+`<defs><clipPath id="nia-note"><circle cx="176" cy="676" r="36"/></clipPath></defs><image href="${data(`${dir}/ines-avatar.png`)}" x="140" y="640" width="72" height="72" clip-path="url(#nia-note)"/>`+avatar(-1,431,676,36,'request-other')+text(302,688,'↔',35,'#087E74',700,'middle')+text(176,745,'Inés García',23,'#1D382D',700,'middle')+text(176,775,'@inesgarcia',20,'#54655C',400,'middle')+text(431,745,'Lucía Martín',23,'#1D382D',700,'middle')+text(431,775,'@luciamartin',20,'#54655C',400,'middle');
  s+=box(65,827,479,154,'#E4ECE8',17)+wrap(typed,32).map((line,i)=>text(88,866+i*31,line,22,'#2A4438')).join('')+box(426,990,119,35,'#E7EFEA',0)+text(522,1019,typed.length+'/500',20,'#53645A',400,'end');
  if(t>1.6)s+=buttonPointer(381,1081,(t-1.6)/.5);
  return svg(s);
}
export function profileRecordingPatch(){
 return svg(box(160,150,280,277,'#F4FAF8',0)+avatar(-1,302,238,77,'recorded-ella')+text(302,373,'Lucía Martín',37,'#192624',700,'middle')+text(302,415,'@luciamartin',24,'#4B5E54',400,'middle')+box(22,680,562,68,'#F4FAF8',0)+text(31,713,'Senderismo · Picos de Europa',24,'#273D35')+text(31,743,'Mañana · ¿Te apuntas a la ruta?',23,'#43675B'));
}
export function requestsScreen(){
  return svg(image(refs.requests,0,0,604,1236)+box(18,227,480,97,'#F4FAF8',0)+avatar(3,58,271,30,'sent-avatar')+text(126,266,'Lucía Martín',25,'#243D32')+text(126,304,'Awaiting response',23,'#4C6559'));
}
export function activityScreen(kind){
  const options=[['SENDERISMO','Potes','9:00',3],['UN CAFÉ','Potes','10:00',1],['PASEANDO','Mogrovejo','11:00',2],['PAISAJE','Fuente Dé','17:00',11]];
  const [name,place,time,id]=options[kind];
  return svg(box(0,0,604,1236,'#F4FAF8',0)+header()+bottom()+text(302,281,'TRAVEL STATUS',25,'#078278',700,'middle')+avatar(id,302,423,94,'activity-avatar')+text(302,571,profiles[id].name,34,'#1C392F',700,'middle')+box(48,625,508,337,'#E6F9F1',36,'#A6D7C7')+text(302,712,name,32,'#107969',700,'middle')+text(302,783,place,29,'#294C3D',400,'middle')+text(302,847,time,32,'#264A3D',700,'middle')+text(302,911,'Anyone keen to join?',23,'#507E6B',400,'middle'));
}
if(process.argv.includes('--prepare-demo')){await prepare();for(const [name,s]of [['map',mapScreen(0)],['list',listScreen(0)],['status',statusScreen(6)],['profile',profileScreen()],['request',requestScreen(1.5)],['requests',requestsScreen()],['region',mapScreen(0,{regional:true})]])await sharp(Buffer.from(s)).png().toFile(`${dir}/qa/demo-${name}.png`);console.log('Prepared isolated Spanish hiking-story app previews; native controls retained.');}
