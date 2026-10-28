"""Repair the holding grip while retaining the audited native UI and tapping rig."""
from pathlib import Path
import cv2,numpy as np,json,subprocess
B=Path(__file__).resolve().parent.parent/'artifacts/travel-buddy-en';R=B/'revision-07';P=B/'revision-04';E=B/'edit';FPS=30
base=cv2.imread(str(R/'clean-phone-plate.png'));colour=cv2.imread(str(P/'hand-rig-colour.png'));matte=cv2.imread(str(P/'hand-rig-matte.png'),0);matte=cv2.copyMakeBorder(matte,0,700,0,700,cv2.BORDER_REPLICATE)
quad=np.array(json.loads((E/'hands-steady-performance.tracking.json').read_text())['quads'][180],np.float32)
H=cv2.getPerspectiveTransform(np.float32([[0,0],[455,0],[455,935],[0,935]]),quad)
def screen_point(x,y):
 return cv2.perspectiveTransform(np.array([[[x,y+40]]],np.float32),H)[0,0]
events=json.loads((B/'revision-05/touch-action-map.json').read_text())['events']
def smooth(v):v=np.clip(v,0,1);return v*v*(3-2*v)
idle=np.array([900.,880.]);contact=np.array([265.,529.]);anchor=np.array([900.,1480.])
# Build one continuous contact path; nearby actions share a smooth bridge instead of competing gestures.
nodes=[]
def node(f,p,event):nodes.append((int(f),np.array(p,dtype=float),event))
for i,e in enumerate(events):
 first=e['frame'];last=e['frame'] if e['type']=='tap' else e['path'][-1]['frame']
 prev_end=(events[i-1]['frame'] if events[i-1]['type']=='tap' else events[i-1]['path'][-1]['frame']) if i else -1000
 if first-prev_end>=24:node(first-round(e['approach']*30),idle,None)
 if e['type']=='tap':
  p=screen_point(*e['xy']);node(first,p,e);node(first+1,p,e)
 else:
  for p in e['path']:node(p['frame'],screen_point(*p['xy']),e)
 next_start=events[i+1]['frame'] if i+1<len(events) else 9999
 if next_start-last>=24:node(last+round(e['release']*30),idle,None)
nodes.sort(key=lambda v:v[0])
def target_at(frame):
 if frame<nodes[0][0] or frame>nodes[-1][0]:return idle,None
 for i in range(1,len(nodes)):
  a,p,event=nodes[i-1];b,q,nxt=nodes[i]
  if a<=frame<=b:
   if frame==a:return p,event
   if frame==b:return q,nxt
   f=(frame-a)/(b-a);v=smooth(f);point=p*(1-v)+q*v
   # A modest lifted arc between controls, returning to the actual control centre at contact.
   if event and nxt and event is not nxt:point+=np.array([0,-10*np.sin(np.pi*f)])
   return point,nxt
 return idle,None

def draw_hand(image,point):
 if point[0]>=720:return image
 v=contact-anchor;w=point-anchor;sc=np.linalg.norm(w)/np.linalg.norm(v);ang=np.arctan2(w[1],w[0])-np.arctan2(v[1],v[0]);c,s=np.cos(ang)*sc,np.sin(ang)*sc;A=np.array([[c,-s],[s,c]]);M=np.column_stack((A,anchor-A@anchor));col=cv2.warpAffine(colour,M,(720,1280));a=cv2.warpAffine(matte,M,(720,1280)).astype(np.float32)/255
 a*=np.clip((720-point[0])/65,0,1)
 # Very soft real-contact shadow behind the generated hand.
 shadow=cv2.GaussianBlur(a,(17,17),4)*.12;out=image*(1-shadow[:,:,None]);out=out*(1-a[:,:,None])+col*a[:,:,None]
 return np.clip(out,0,255).astype(np.uint8)
basehsv=cv2.cvtColor(base,cv2.COLOR_BGR2HSV);m=cv2.inRange(basehsv,np.array([35,85,65]),np.array([90,255,255]));mask=cv2.GaussianBlur(cv2.dilate(m,np.ones((3,3),np.uint8)),(3,3),.6)[:,:,None]/255
cap=cv2.VideoCapture(str(B/'revision-05/entry-app-feed.mp4'))
later=cv2.VideoCapture(str(B/'revision-03/app-screen-feed-touch-aligned.mp4'));later.set(cv2.CAP_PROP_POS_FRAMES,390)
pipe=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','720x1280','-r','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',str(R/'hands-screen-composited.mp4')],stdin=subprocess.PIPE)
validation=[]
for f in range(1320):
 ok,app=(cap if f<180 else later).read();assert ok
 app=cv2.copyMakeBorder(app,40,0,0,0,cv2.BORDER_CONSTANT,value=(246,249,248));warped=cv2.warpPerspective(app,H,(720,1280),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE);image=(base*(1-mask)+warped*mask).astype(np.uint8)
 point,event=target_at(f+150);image=draw_hand(image,point)
 for e in events:
  if e['type']=='tap' and e['frame']==f+150:
   expected=screen_point(*e['xy']);err=float(np.linalg.norm(point-expected));assert err<.01,(e['name'],err)
   x0,y0,x1,y1=e['targetBounds'];x,y=e['xy'];assert x0<=x<=x1 and y0<=y<=y1
   validation.append({'action':e['name'],'finalFrame':f+150,'time':(f+150)/30,'nativeControl':e['xy'],'mappedFingertip':point.tolist(),'positionErrorPixelsInPlate':err,'nativeControlBounds':e['targetBounds'],'insideControl':True})
   cv2.imwrite(str(R/f'qa/contact-{e["name"]}.png'),image)
 pipe.stdin.write(image.tobytes())
 if f%300==0:print('composited',f,flush=True)
pipe.stdin.close();assert pipe.wait()==0
(R/'touch-validation.json').write_text(json.dumps({'actions':validation,'contactFrames':len(validation),'positionTolerancePixels':.01,'allContactsInsideControls':all(v['insideControl'] for v in validation),'visualReviewPending':True,'nativeEntrySource':'../revision-05/entry-edit-plan.json','nativeActionMap':'../revision-05/touch-action-map.json','holdingGripRepair':'clean-phone-plate.png','appFrameSequenceAndTapTimingRetained':True},indent=2))
print(R/'hands-screen-composited.mp4',flush=True)
