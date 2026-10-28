"""Place cached Higgsfield fingertip at audited native UI actions, at the actual action frame."""
from pathlib import Path
import cv2,numpy as np,json,subprocess
B=Path(__file__).resolve().parent.parent/'artifacts/travel-buddy-en';R=B/'revision-04';E=B/'edit';FPS=30
base=cv2.imread(str(R/'clean-phone-plate.png'));colour=cv2.imread(str(R/'hand-rig-colour.png'));matte=cv2.imread(str(R/'hand-rig-matte.png'),0);matte=cv2.copyMakeBorder(matte,0,700,0,700,cv2.BORDER_REPLICATE)
quad=np.array(json.loads((E/'hands-steady-performance.tracking.json').read_text())['quads'][180],np.float32)
H=cv2.getPerspectiveTransform(np.float32([[0,0],[455,0],[455,935],[0,935]]),quad)
def screen_point(x,y):
 return cv2.perspectiveTransform(np.array([[[x,y+40]]],np.float32),H)[0,0]
# Explicit native app-space targets. Action frame numbers refer to the revised 58s export.
events=[]
def tap(name,time,xy,box,kind='native-visible-control',approach=.32,release=.24):
 events.append({'name':name,'type':'tap','time':round(time*30)/30,'frame':round(time*30),'xy':xy,'targetBounds':box,'evidence':kind,'approach':approach,'release':release})
for n,(letter,xy) in enumerate(zip('promo',[(428,667),(161,667),(383,667),(362,797),(383,667)])):
 tap('type-'+letter,5+(10+8*n)/30,xy,[xy[0]-19,xy[1]-23,xy[0]+19,xy[1]+23],'Requested promo text compositor increments at local frames 10,18,26,34,42.',.24,.12)
tap('start-date-20',8+19/30,[75,637],[51,614,99,662])
tap('end-date-31',9+10/30,[279,688],[256,664,304,712])
tap('save-route',10+20/30,[192,851],[84,821,302,883],'Native Save and continue at the recorded step-1 to step-2 transition.')
tap('add-map-photos',11+4/30,[291,546],[204,523,382,571],approach=.16,release=.2)
tap('save-itinerary',13-1/30,[192,851],[84,821,302,883],'Native Save and continue immediately before next gallery edit cut.')
tap('barcelona-left-photo',13+20/30,[76,615],[0,531,151,687])
tap('barcelona-right-photo',14.5,[380,458],[304,375,455,530])
tap('gallery-done',14+28/30,[399,867],[365,840,447,890],approach=.24,release=.18)
tap('workcation',17+22/30,[245,240],[180,218,310,265])
tap('flexible-budget',18+25/30,[86,485],[40,461,143,510])
tap('easygoing-style',20+13/30,[155,500],[40,478,265,523])
tap('party-lover-style',20+29/30,[326,563],[250,544,400,590])
tap('share-trip',27+14/30,[289,31],[273,10,308,53],'Native share icon immediately before sharing sheet opens.',approach=.45)
tap('manage-trips',33+14/30,[366,35],[293,10,438,62],approach=.4)
tap('hosting-tab',35+11/30,[280,95],[240,76,320,126])
tap('manage-requests',37+17/30,[330,509],[236,484,423,536])
# Scroll swipes use measured vertical content displacement from the unchanged recording.
flow=json.loads((R/'scroll-flow.json').read_text());lookup={v['frame']:v['dy'] for v in flow}
for a,z in [(15.6,16.0),(16.6,17.4),(19.3,19.7),(21.3,21.7),(22.65,23.3),(23.55,24.3),(24.5,24.95),(25.05,25.7),(25.9,26.8)]:
 hits=[v for v in flow if a<=v['time']<=z and v['dy']<-2.5]
 if not hits:continue
 start=hits[0]['frame'];delta=0;path=[]
 for f in range(start, min(start+15,round((z-5)*30))+1):
  dy=min(0,lookup.get(f,0));delta+=dy;path.append({'frame':f+150,'xy':[225,700+delta]})
  if delta<-210:break
 if len(path)<2:continue
 events.append({'name':f'native-scroll-{a}','type':'swipe','time':(start+150)/30,'frame':start+150,'path':path,'approach':.3,'release':.22,'evidence':'Fingertip drag uses same vertical displacement as tracked native content until release; later native inertia is left unobstructed.'})
events.sort(key=lambda e:e['time'])
# Disable swipes that overlap a following tap's approach.
events=[e for e in events if e['type']=='tap' or not any(e['time']-.1<t['time']<e['path'][-1]['frame']/30+.38 for t in events if t['type']=='tap')]
(R/'touch-action-map.json').write_text(json.dumps({'fps':30,'nativeAppSize':[456,896],'phoneQuad':quad.tolist(),'events':events,'method':'Native app targets mapped through the same screen homography as the UI. Cached Higgsfield hand rigidly rigged about an off-frame wrist. Finger clears the screen during static reading, montage jumps without a recorded control action, and group-chat typing whose individual source keystrokes are not retained.','backendClaim':False},indent=2))
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
cap=cv2.VideoCapture(str(B/'revision-03/app-screen-feed-touch-aligned.mp4'));cap.set(cv2.CAP_PROP_POS_FRAMES,210)
clean_keyboard=cv2.imread(str(R/'qa/source-keyboard-10.2.png'))
pipe=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','720x1280','-r','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',str(R/'hands-screen-composited.mp4')],stdin=subprocess.PIPE)
validation=[]
for f in range(1320):
 ok,app=cap.read();assert ok
 if f<90:app[526:]=clean_keyboard[526:]
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
(R/'touch-validation.json').write_text(json.dumps({'actions':validation,'contactFrames':len(validation),'positionTolerancePixels':.01,'allContactsInsideControls':all(v['insideControl'] for v in validation),'visualReviewPending':True,'nativeAppFrameSequenceUnchangedExceptPromoKeyboardPopupCleanup':True},indent=2))
print(R/'hands-screen-composited.mp4',flush=True)
