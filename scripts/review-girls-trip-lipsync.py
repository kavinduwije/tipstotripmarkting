"""Create side-by-side mouth-frame evidence, never an automatic visual approval."""
import argparse,json,math
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('metadata',nargs='+');p.add_argument('--times');p.add_argument('--label',default='mouth-review');a=p.parse_args()
out=Path(__file__).resolve().parent.parent/'artifacts/girls-trip-en/lip-sync-revision/qa';out.mkdir(exist_ok=True,parents=True)
for item in a.metadata:
 m=json.loads(Path(item).read_text());fps=m['fps'];boxes=m['boxes'];length=m['frames']/fps
 times=[float(t) for t in a.times.split(',')] if a.times else np.linspace(.03,max(.03,length-.07),min(18,max(9,math.ceil(length*4))))
 caps=[cv2.VideoCapture(m['input']),cv2.VideoCapture(m['output'])]
 width=180;height=178;cols=6;rows=math.ceil(len(times)/cols)
 canvas=Image.new('RGB',(cols*width,rows*(height*2+24)),(22,26,32));d=ImageDraw.Draw(canvas)
 for k,t in enumerate(times):
  index=min(len(boxes)-1,round(t*fps));x1,y1,x2,y2=boxes[index];w=x2-x1;h=y2-y1
  for v,cap in enumerate(caps):
   cap.set(cv2.CAP_PROP_POS_FRAMES,index);ok,f=cap.read()
   if not ok:raise RuntimeError(f'Missing review frame {item} {index}')
   crop=f[max(0,y1-int(h*.25)):min(f.shape[0],y2+int(h*.1)),max(0,x1-int(w*.1)):min(f.shape[1],x2+int(w*.1))]
   im=Image.fromarray(cv2.cvtColor(crop,cv2.COLOR_BGR2RGB));im.thumbnail((width,height));x=(k%cols)*width;y=(k//cols)*(height*2+24)
   canvas.paste(im,(x+(width-im.width)//2,y+24+v*height));d.text((x+5,y+4),f'{t:.2f}s / source, repair',fill='white')
 for cap in caps:cap.release()
 target=out/(Path(item).stem+'-'+a.label+'.jpg');canvas.save(target,quality=92);print(target)
