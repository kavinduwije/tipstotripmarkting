import sharp from 'sharp';
import {readFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url).pathname,dir=`${root}artifacts/travel-buddy-en`,edit=`${dir}/edit`;
mkdirSync(`${edit}/promo`,{recursive:true});
const source=`${root}General-assesets/Meet Buddy/Trip creation - trip preferences - trip details.mov`;
function ff(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});if(r.status!==0)throw new Error('Screen preparation failed');}
ff(['-i',`${dir}/tips-to-trip-travel-buddy-en-60s-app-edit-preview.mp4`,'-vf','crop=456:896:132:192,setsar=1','-an','-c:v','libx264','-preset','fast','-crf','16','-r','30',`${edit}/app-screen-feed.mp4`]);
ff(['-ss','165','-i',source,'-vf','crop=602:1182:0:52,scale=456:896,setsar=1','-frames:v','1',`${edit}/hero-app-screen.png`]);
ff(['-loop','1','-framerate','30','-i',`${edit}/hero-app-screen.png`,'-t','7','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',`${edit}/intro-screen-feed-positive.mp4`]);
ff(['-ss','10','-i',source,'-frames:v','1',`${edit}/promo-source-clean.png`]);
const b=readFileSync(`${edit}/promo-source-clean.png`);
for(let n=0;n<90;n++){
 const count=Math.max(0,Math.min(5,Math.floor((n-10)/8)+1)),s='promo'.slice(0,count)+(n%26<16?'|':'');
 const p=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="602" height="1234"><rect x="127" y="486" width="405" height="62" fill="#E1E9E8"/><text x="135" y="528" fill="#233A3B" font-family="Arial" font-size="26">${s}</text></svg>`);
 await sharp(b).composite([{input:p}]).png().toFile(`${edit}/promo/${String(n).padStart(3,'0')}.png`);
}
console.log('Prepared native app feeds, a positive recorded hero frame and the requested promo entry.');
