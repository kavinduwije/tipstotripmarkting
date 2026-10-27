import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const french=process.argv.includes('--french');
const business=process.argv.includes('--business');
const timedSegments=french||business;
const dir=fileURLToPath(new URL(`../artifacts/${business?`ugc-business-${french?'fr':'es'}`:`ugc-product-${french?'fr':'es'}`}/`,import.meta.url));
const clean=s=>s.replace(/TipsToTrip/gi,'Tips to Trip').replace(/(?:Mid[- ]?Body|MeetBody)/gi,'Meet Buddy').replace(/Go ?(?:Life|Lite)/gi,'Go Live').replace(/riqués tu join/gi,'Request to Join').replace(/Mis solicitud/gi,'Mi solicitud').replace(/revisó/gi,'reviso').replace(/^Viajas sola/,'¿Viajas sola').replace(/gente\./,'gente?').replace(/Busco filtro/gi,'Busco, filtro').replace(/ver que hay/gi,'ver qué hay').replace(/Te vienes a Tips to Trip\./gi,'¿Te vienes a Tips to Trip?');
function wrap(text) {
  if(text.length<=40)return text;
  const spaces=[...text.matchAll(/ /g)].map(m=>m.index);
  const split=spaces.reduce((best,p)=>Math.abs(p-text.length/2)<Math.abs(best-text.length/2)?p:best,spaces[0]);
  return `${text.slice(0,split)}\n${text.slice(split+1)}`;
}
const cues=[];
for(let part=0;part<2;part++) {
  const words=JSON.parse(readFileSync(`${dir}/elevenlabs/presenter-0${part+1}.transcript.json`,'utf8')).flatMap(s=>s.words).filter(w=>!(part===0&&w.start>=29.34&&/^\s*Y[. ]*$/i.test(w.word))).map(w=>({...w,word:part===0&&w.start>=17.8&&w.start<19?w.word.replace(/entravel/i,'en Travel').replace(/Body/i,'Buddy'):w.word}));
  for(let i=0;i<words.length;) {
    let count=Math.min(6,words.length-i);
    if(timedSegments)for(let j=1;j<count;j++)if(Math.floor(words[i+j].start/15)>Math.floor(words[i].start/15)){count=j;break;}
    for(let j=timedSegments?0:2;j<count;j++)if(/[.!?;:]$/.test(words[i+j].word.trim())) {count=j+1;break;}
    if(timedSegments&&/^[!?;:]$/.test(words[i+count]?.word.trim()??'')&&Math.floor(words[i+count].start/15)===Math.floor(words[i].start/15))count++;
    if(timedSegments&&!/[.!?;:]$/.test(words[i+count-1].word.trim())&&/[.!?;:]$/.test(words[i+count]?.word.trim()??'')&&Math.floor(words[i+count].start/15)===Math.floor(words[i].start/15))count++;
    if(/(?:Meet|Travel)\s*$/i.test(words[i+count-1].word)&&/^\s*Buddy/i.test(words[i+count]?.word??''))count++;
    if(/Near\s*$/i.test(words[i+count-1].word)&&/^\s*You/i.test(words[i+count]?.word??''))count++;
    if(words.length-(i+count)<=2)count=words.length-i;
    const group=words.slice(i,i+count),next=words[i+count];
    const start=part*30+group[0].start;
    const end=Math.min((part+1)*30,part*30+group.at(-1).end+0.12,next?part*30+next.start-0.01:Infinity);
    if(end<=start)throw new Error('Caption timing requires review');
    const raw=group.map(w=>w.word.trim()).join(' ');
    cues.push({start,end,text:wrap(timedSegments?raw:clean(raw))});i+=count;
  }
}
function timestamp(t,ass=false) {const unit=ass?100:1000,n=Math.round(t*unit);return `${String(Math.floor(n/(3600*unit))).padStart(ass?1:2,'0')}:${String(Math.floor(n/(60*unit))%60).padStart(2,'0')}:${String(Math.floor(n/unit)%60).padStart(2,'0')}${ass?'.':','}${String(n%unit).padStart(ass?2:3,'0')}`;}
writeFileSync(`${dir}/captions.srt`,cues.map((c,i)=>`${i+1}\n${timestamp(c.start)} --> ${timestamp(c.end)}\n${c.text}\n`).join('\n'));
const header=`[Script Info]\nScriptType: v4.00+\nPlayResX: 720\nPlayResY: 1280\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,28,&H00FFFFFF,&H00FFFFFF,&H50242F2A,&H50242F2A,-1,0,0,0,100,100,0,0,3,8,0,2,34,34,48,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
writeFileSync(`${dir}/captions.ass`,header+cues.map(c=>`Dialogue: 0,${timestamp(c.start,true)},${timestamp(c.end,true)},Default,,0,0,0,,${c.text.replaceAll('\n','\\N')}`).join('\n')+'\n');
writeFileSync(`${dir}/captions.json`,JSON.stringify(cues,null,2));
console.log(`Prepared ${cues.length} ${french?'French':'Spanish'} caption cues. Review feature names and transcript recognition before export.`);
