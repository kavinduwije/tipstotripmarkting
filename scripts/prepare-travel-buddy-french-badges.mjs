import sharp from 'sharp';
const root=new URL('../',import.meta.url).pathname,dir=`${root}artifacts/travel-buddy-fr`;
// Keep enclosed white store lettering; remove the edge-connected grey rim,
// matching the user's approved borderless English export.
for(const name of ['app-store-fr','google-play-fr']){
 const {data,info}=await sharp(`${dir}/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,seen=new Uint8Array(w*h),queue=[];
 const add=(x,y)=>{const p=y*w+x,q=p*4;if(seen[p])return;if(data[q+3]>=50&&Math.max(data[q],data[q+1],data[q+2])<60)return;seen[p]=1;queue.push(p);};
 for(let x=0;x<w;x++){add(x,0);add(x,h-1);}for(let y=0;y<h;y++){add(0,y);add(w-1,y);}
 for(let i=0;i<queue.length;i++){const p=queue[i],x=p%w,y=Math.floor(p/w);if(x)add(x-1,y);if(x<w-1)add(x+1,y);if(y)add(x,y-1);if(y<h-1)add(x,y+1);}
 for(let p=0;p<seen.length;p++)if(seen[p]){data[p*4]=data[p*4+1]=data[p*4+2]=data[p*4+3]=0;}
 await sharp(data,{raw:{width:w,height:h,channels:4}}).png().toFile(`${dir}/${name}-borderless.png`);
}
