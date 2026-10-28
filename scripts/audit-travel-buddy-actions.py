import cv2,numpy as np,json
from pathlib import Path
b=Path('artifacts/travel-buddy-en');r=b/'revision-04';c=cv2.VideoCapture(str(b/'revision-03/app-screen-feed-touch-aligned.mp4'));c.set(cv2.CAP_PROP_POS_FRAMES,210);last=None;flow=[];tests={'flexible':(18.7,19.1,(40,455,150,505)),'easygoing':(20.1,20.6,(40,475,265,525)),'workcation':(17.55,17.85,(180,218,310,265)),'party':(20.85,21.1,(250,540,400,590))};changes={k:[] for k in tests}
for i in range(1320):
 ok,f=c.read();assert ok;t=5+i/30;gray=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)
 if last is not None:
  for k,(start,end,(x0,y0,x1,y1)) in tests.items():
   if start<=t<=end:
    score=np.mean(abs(gray[y0:y1,x0:x1].astype(float)-last[y0:y1,x0:x1])>20)
    if score>.02:changes[k].append((round(t,4),round(float(score),3)))
  if any(a<=t<=z for a,z in [(15.6,17.45),(19.25,19.8),(21.2,21.9),(22.3,24.95),(25.05,27.4)]):
   roi=last[100:800,20:435];pts=cv2.goodFeaturesToTrack(roi,150,.02,15)
   if pts is not None:
    pts+=np.array([20,100],np.float32);nxt,status,err=cv2.calcOpticalFlowPyrLK(last,gray,pts,None);disp=(nxt-pts).reshape(-1,2);valid=(status[:,0]==1)&(np.abs(disp[:,0])<3)&(np.abs(disp[:,1])<100);dy=float(np.median(disp[valid,1])) if valid.sum()>15 else 0
   else:dy=0
   flow.append({'frame':i,'time':t,'dy':dy})
 last=gray
(r/'scroll-flow.json').write_text(json.dumps(flow,indent=2));print(changes)
for a,z in [(15.6,17.45),(19.25,19.8),(21.2,21.9),(22.3,24.95),(25.05,27.4)]:
 vals=[v for v in flow if a<=v['time']<=z and v['dy']<-1.5];print(a,z,'motion',[(round(v['time'],3),round(v['dy'],1)) for v in vals[::3]])
