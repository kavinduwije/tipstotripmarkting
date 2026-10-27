import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const spanish=process.argv.includes('--spanish');
const out=fileURLToPath(new URL(spanish?'../artifacts/ugc-es/':'../artifacts/ugc/',import.meta.url));
const outputName=spanish?'tips-to-trip-ugc-es-60s':'tips-to-trip-ugc-60s';
const narration=JSON.parse(readFileSync(`${out}/narration.json`,'utf8'));
const normalize=s=>s.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]/g,'');
const cues=[];
for(let part=0;part<2;part++) {
  const words=JSON.parse(readFileSync(`${out}/presenter-0${part+1}.transcript.json`,'utf8')).flatMap(s=>s.words);
  const expected=narration[part].dialogue.split(/\s+/);
  const aligned=words.length===expected.length;
  for(let i=0;i<words.length;) {
    const count=words.length-i<=8?words.length-i:6;
    const group=words.slice(i,i+count);
    const text=group.map((w,j)=>aligned && normalize(w.word)===normalize(expected[i+j])?expected[i+j]:w.word.trim()).join(' ');
    const cleaned=spanish?text.replace(/TipsToTrip/gi,'Tips to Trip').replace(/MidBody/gi,'Meet Buddy').replace(/GoLive/gi,'Go Live').replace(/apartece/gi,'apetece').replace(/apetece de hacer/gi,'apetece hacer'):text;
    const next=words[i+count];
    cues.push({start:part*30+group[0].start,end:Math.min((part+1)*30,part*30+group.at(-1).end+0.12,next?part*30+next.start-0.01:Infinity),text:cleaned});
    i+=count;
  }
}
function timestamp(seconds) {
  const ms=Math.round(seconds*1000);
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
}
writeFileSync(`${out}/${outputName}.srt`,cues.map((c,i)=>`${i+1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}\n`).join('\n'));
console.log(`Wrote ${cues.length} timed caption cues.`);
