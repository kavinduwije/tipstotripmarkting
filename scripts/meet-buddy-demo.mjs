import sharp from 'sharp';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const dir=`${root}artifacts/meet-buddy-en`;
export const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export const text=(x,y,s,size=26,color='#192624',weight=400,anchor='start')=>`<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${color}">${esc(s)}</text>`;
const box=(x,y,w,h,fill='#F4FAF8',r=20,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const image=(uri,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" href="${uri}"/>`;
const data=f=>`data:image/png;base64,${readFileSync(f).toString('base64')}`;
const svg=s=>`<svg xmlns="http://www.w3.org/2000/svg" width="604" height="1236">${s}</svg>`;
const location=['Weligama Beach','Weligama','Weligama','Mirissa','Weligama','Galle','Ella','Colombo'];
const activities=['Surfing','Having Coffee','Yoga','Watching Sunset','Exploring','Coffee','Hiking','Food'];
const names=['Maya Laurent','Isabel Costa','Aiko Tanaka','Daniel Walker','Lucas Moreau','Mateo Silva','Oliver Chen','Noah Mensah','Amara James','Theo Martin','Arjun Perera','Nila Fernando','Ethan Brooks','Chloe Wilson','Sofia Mendes','Leo Laurent','Adam Clarke','Lina Dias','Hugo Costa','Emma Reed','Camille Moreau','Lea Martin','Alex Morgan','Hugo Bernard'];
let portraits,refs,map,region,nav,bar,controls,own,bell;
export const profiles=names.map((name,i)=>({name,activity:i===3?'Surfing':activities[i%8],place:i===3?'Weligama Beach':location[i%8],distance:i===3?'1.2 km away':`${(0.2+(i%10)*0.3).toFixed(1)} km away`,countries:1+i%8,fictional:true}));
export async function prepare(){
  mkdirSync(`${dir}/demo`,{recursive:true});mkdirSync(`${dir}/profiles/crops`,{recursive:true});
  // The first generated contact sheet contains eight usable portraits, the
  // second twelve. Crop away synthetic name strips; reuse four approved cached
  // Higgsfield portraits to reach twenty-four distinct fictional travelers.
  let index=0;
  for(const [file,rows,labelInset] of [['travellers-a',2,true],['travellers-b',3,false]]){
    const p=`${dir}/profiles/${file}.png`,m=await sharp(p).metadata();
    for(let y=0;y<rows;y++)for(let x=0;x<4;x++){
      const cw=Math.floor(m.width/4),ch=Math.floor(m.height/rows);
      const crop={left:x*cw+12,top:y*ch+12,width:cw-24,height:labelInset?ch-116:ch-24};
      await sharp(p).extract(crop).resize(200,200,{fit:'cover',position:'attention'}).toFile(`${dir}/profiles/crops/${index++}.png`);
    }
  }
  for(const id of ['camille','lea','self','hugo'])await sharp(`${root}artifacts/ugc-product-fr/sharing-profiles/${id}-avatar.png`).resize(200,200).toFile(`${dir}/profiles/crops/${index++}.png`);
  portraits=profiles.map((p,i)=>data(`${dir}/profiles/crops/${i}.png`));
  own=data(`${dir}/presenter-reference-cropped.png`);
  for(const [z,x0,y0,name]of [[13,5925,3958,'weligama'],[7,91,60,'sri-lanka']]){
    const out=`${dir}/maps/${name}.png`;
    if(!existsSync(out))await sharp({create:{width:768,height:1024,channels:3,background:'#dcecdf'}}).composite(Array.from({length:12},(_,i)=>({input:`${dir}/maps/${z}-${x0+i%3}-${y0+Math.floor(i/3)}.png`,left:i%3*256,top:Math.floor(i/3)*256}))).png().toFile(out);
  }
  map=data(`${dir}/maps/weligama.png`);region=data(`${dir}/maps/sri-lanka.png`);
  const screenshot=`${root}General-assesets/Meet buddy screen chat cloud status example.png`;
  await sharp(screenshot).extract({left:0,top:1126,width:604,height:115}).png().toFile(`${dir}/demo/nav.png`);
  await sharp(screenshot).extract({left:0,top:0,width:604,height:62}).png().toFile(`${dir}/demo/bar.png`);
  // Preserve the actual Flutter button faces and Material icons from the
  // supplied screenshots. Rounded alpha masks discard the old map/card behind
  // each button; cached transparent shadows let them sit on the revised map.
  const listScreenshot=`${root}General-assesets/Meet Buddy list view.png`;
  const controlSources=[
    ['list',screenshot,495,624,88,26,true],
    ['map',listScreenshot,491,621,88,26,true],
    ['requests',screenshot,495,732,88,26,true],
    ['profile',screenshot,495,839,88,26,true],
    ['help',screenshot,507,941,76,38,false],
    ['location',screenshot,507,177,76,38,true],
  ];
  controls={};
  for(const [id,source,left,top,size,radius,shadow]of controlSources){
    const mask=Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="white"/></svg>`);
    const face=await sharp(source).extract({left,top,width:size,height:size}).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
    const path=`${dir}/demo/control-${id}.png`;
    if(shadow){
      const backdrop=Buffer.from(`<svg width="${size+24}" height="${size+30}"><defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter></defs><rect x="12" y="18" width="${size}" height="${size}" rx="${radius}" fill="#000" opacity=".22" filter="url(#shadow)"/></svg>`);
      await sharp(backdrop).composite([{input:face,left:12,top:12}]).png().toFile(path);
    }else await sharp(face).png().toFile(path);
    controls[id]=data(path);
  }
  await sharp(screenshot).extract({left:501,top:73,width:79,height:81}).png().toFile(`${dir}/demo/bell.png`);
  bell=data(`${dir}/demo/bell.png`);
  nav=data(`${dir}/demo/nav.png`);bar=data(`${dir}/demo/bar.png`);
  refs=Object.fromEntries(['status-edit','profile','request','sent','requests'].map(id=>[id,data(`${dir}/qa/${id}-reference.png`)]));
  writeFileSync(`${dir}/demo/floating-controls.json`,JSON.stringify({
    source:'Native button faces cropped from the supplied map and list screenshots; alpha masks remove the old background.',
    appSource:'/Users/kavinduwijewickrama/tipstotrip-v02',
    references:['lib/widgets/map_list_view_toggle_button.dart','lib/screens/travel_buddy_screen.dart:LiveBuddyFloatingActions','lib/widgets/guided_tour.dart:GuideReplayButton'],
    order:['list/map toggle','Meet Buddy requests (handshake_outlined)','Meet Buddy profile (person_pin_circle_outlined)','Replay screen guide (help_outline_rounded)'],
    mapOnly:'Native my_location button in the upper-right map corner',
    controlSources:controlSources.map(([id,source,left,top,size,radius,shadow])=>({id,source:source.slice(root.length),crop:{left,top,width:size,height:size},radius,shadow}))
  },null,2));
  writeFileSync(`${dir}/profiles/people.json`,JSON.stringify({count:24,provider:'Higgsfield',profiles:profiles.map((p,i)=>({...p,image:`crops/${i}.png`}))},null,2));
  writeFileSync(`${dir}/demo/source-edits.json`,JSON.stringify({sources:['General-assesets/Meet Buddy list view.png','General-assesets/Meet buddy screen chat cloud status example.png','General-assesets/How to update meet buddy live user status cloud.mov','General-assesets/Meet buddy request sending steps.mov','General-assesets/Meet buddy.mov'],modified:['24 fictional traveler profiles and expanded scrolling list','Current location Sri Lanka, accurate Weligama and Sri Lanka map viewports','Updated Travel Status immediately after Save','Names, avatars and notes on actual recorded profile and request screens'],mapAttribution:'© OpenStreetMap contributors',scope:'Marketing demonstration edit; does not assert the recorded app backend updated live.',requestOutcome:'Sent / awaiting response, not an accepted connection'},null,2));
}
export function avatar(i,x,y,r=38,id='a'){
  const uri=i===-1?own:portraits[i];
  return `<defs><clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath></defs><circle cx="${x}" cy="${y}" r="${r+3}" fill="#fff"/><image x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" preserveAspectRatio="xMidYMin slice" href="${uri}" clip-path="url(#${id})"/>`;
}
function header(){return image(bar,0,0,604,62)+box(0,62,604,107,'#F4FAF8',0)+avatar(-1,64,114,38,'own-head')+text(302,98,'Current Location⌄',18,'#455450',700,'middle')+text(302,140,'Sri Lanka',27,'#1b2421',700,'middle')+`<path d="M248 148H355" stroke="#273D36"/>`+`<defs><clipPath id="bellclip"><circle cx="541" cy="113" r="40"/></clipPath></defs><g clip-path="url(#bellclip)">${image(bell,501,73,79,81)}</g>`;}
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
  s+=regional?`<image x="-800" y="-120" width="1920" height="2560" href="${m}"/>`:`<image x="-420" y="140" width="1500" height="2000" href="${m}"/>`;
  if(regional){
    // Positions follow actual geographic coordinates on the stitched viewport.
    const geo=(lat,lon)=>{const x=(lon+180)/360*128,y=(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*128;return[(x-91)*256*2.5-800,(y-60)*256*2.5-120];};
    const entries=[[3,6,80.428,'Surfing','Weligama',-1],[5,6.046,80.217,'Coffee','Galle',1],[2,6.023,80.435,'Yoga','Weligama',-1],[6,6.866,81.046,'Hiking','Ella',1],[7,6.927,79.861,'Food','Colombo',-1],[1,5.965,80.455,'Sunset','Mirissa',1]];
    const inlandCallouts=[[160,480],[290,480],[160,710],[435,710],[175,925],[390,925]];
    entries.forEach(([i,lat,lon,label,place,d],n)=>{const [gx,gy]=geo(lat,lon),[x,y]=inlandCallouts[n];s+=`<path d="M${gx} ${gy}L${x} ${y}" stroke="#39A791" stroke-width="2" stroke-opacity=".5"/><circle cx="${gx}" cy="${gy}" r="5" fill="#007B6F"/>`;s+=cloud(i,x,y,label,place,d,n===0);});
  }else{
    s+=cloud(0,125,425,'Exploring','Weligama',-1)+cloud(2,465,425,'Yoga','Weligama',1)+cloud(1,125,645,'Having Coffee','Weligama',-1)+cloud(3,465,645,'Surfing','Weligama Beach · 5:00 PM',1,true)+cloud(11,445,815,'Watching Sunset','Mirissa',-1);
    if(status)s+=cloud(-1,125,915,'Surfing','Weligama Beach · 5:00 PM',-1,true);
    else s+=avatar(-1,125,915,29,'map-self');
  }
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
export function statusScreen(t){
  const value='Surfing · Weligama Beach · 5:00 PM';
  const typed=value.slice(0,Math.floor(Math.max(0,Math.min(1,(t-.8)/3.5))*value.length));
  let s=image(refs['status-edit'],0,0,604,1236)+box(185,151,230,181,'#F4FAF8',0)+avatar(-1,301,249,76,'edit-own')+box(70,338,480,88,'#F4FAF8',0)+text(302,378,'Zoe Bennett',37,'#192624',700,'middle')+text(302,414,'@zoebennett',25,'#53645D',400,'middle');
  s+=box(28,649,548,200,'#F4FAF8',4,'#126E62')+text(53,697,typed.length>25?typed.slice(0,25):typed,25,'#273D35')+(typed.length>25?text(53,736,typed.slice(25),25,'#273D35'):'')+box(420,853,150,37,'#F4FAF8',0)+text(552,877,typed.length+'/1000',19,'#57635D',400,'end');
  if(t>6.3)s+=buttonPointer(523,598,(t-6.3)/.7);
  return svg(s);
}
export function profileScreen(sent=false,t=0){
  let s=image(refs.profile,0,0,604,1236)+box(160,150,280,277,'#F4FAF8',0)+avatar(3,302,238,77,'profile-avatar')+text(302,373,'Daniel Walker',37,'#192624',700,'middle')+text(302,415,'@danielwalker',24,'#4B5E54',400,'middle');
  s+=box(22,680,562,68,'#F4FAF8',0)+text(31,713,'Surfing · Weligama Beach',25,'#273D35')+text(31,743,'5:00 PM · Anyone keen to join?',24,'#43675B');
  if(sent)s+=box(32,764,546,76,'#D9E3DE',38)+text(302,813,'Request sent',25,'#697C72',700,'middle')+box(0,1083,604,41,'#153F35',0)+text(302,1112,'Live buddy request sent',20,'#FFFFFF',400,'middle');
  if(t>0&&t<1)s+=buttonPointer(302,800,t);
  return svg(s);
}
export function requestScreen(t=0){
  const note='Surfing at 5? I would love to join!';
  const typed=note.slice(0,Math.floor(Math.min(1,t/1.15)*note.length));
  let s=image(refs.request,0,0,604,1236)+box(160,150,280,180,'#626565',0)+`<g opacity="0.48">${avatar(3,302,238,77,'request-profile-background')}</g>`+box(55,544,490,56,'#DEE7E3',0)+text(62,579,'Let Daniel know you want to meet up.',23,'#405B4F');
  s+=box(95,628,415,161,'#DEE7E3',0)+avatar(-1,176,676,36,'request-self')+avatar(3,431,676,36,'request-other')+text(302,688,'↔',35,'#087E74',700,'middle')+text(176,745,'Zoe Bennett',23,'#1D382D',700,'middle')+text(176,775,'@zoebennett',20,'#54655C',400,'middle')+text(431,745,'Daniel Walker',23,'#1D382D',700,'middle')+text(431,775,'@danielwalker',20,'#54655C',400,'middle');
  s+=box(65,827,479,154,'#E4ECE8',17)+text(88,886,typed.slice(0,22),24,'#2A4438')+text(88,925,typed.slice(22),24,'#2A4438')+box(426,990,119,35,'#E7EFEA',0)+text(522,1019,typed.length+'/500',20,'#53645A',400,'end');
  if(t>1.6)s+=buttonPointer(381,1081,(t-1.6)/.5);
  return svg(s);
}
export function requestsScreen(){
  return svg(image(refs.requests,0,0,604,1236)+box(18,227,480,97,'#F4FAF8',0)+avatar(3,58,271,30,'sent-avatar')+text(126,266,'Daniel Walker',25,'#243D32')+text(126,304,'Awaiting response',23,'#4C6559'));
}
export function activityScreen(kind){
  const options=[['SURFING','Weligama Beach','5:00 PM',3],['HAVING COFFEE','Weligama','4:30 PM',1],['YOGA','Weligama','6:00 PM',2],['WATCHING SUNSET','Mirissa','6:15 PM',11]];
  const [name,place,time,id]=options[kind];
  return svg(box(0,0,604,1236,'#F4FAF8',0)+header()+bottom()+text(302,281,'TRAVEL STATUS',25,'#078278',700,'middle')+avatar(id,302,423,94,'activity-avatar')+text(302,571,profiles[id].name,34,'#1C392F',700,'middle')+box(48,625,508,337,'#E6F9F1',36,'#A6D7C7')+text(302,712,name,32,'#107969',700,'middle')+text(302,783,place,29,'#294C3D',400,'middle')+text(302,847,time,32,'#264A3D',700,'middle')+text(302,911,'Anyone keen to join?',23,'#507E6B',400,'middle'));
}
if(process.argv.includes('--prepare-demo')){await prepare();for(const [name,s]of [['map',mapScreen(0)],['list',listScreen(0)],['status',statusScreen(5.5)],['profile',profileScreen()],['request',requestScreen(1.5)],['requests',requestsScreen()],['region',mapScreen(0,{regional:true})]])await sharp(Buffer.from(s)).png().toFile(`${dir}/qa/demo-${name}.png`);console.log('Prepared 24 fictional profiles and seven app previews.');}
