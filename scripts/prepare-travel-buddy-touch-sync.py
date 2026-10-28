"""Deterministic hand rig and action audit for cached native app footage."""
from pathlib import Path
import cv2,numpy as np,json
from PIL import Image,ImageDraw
B=Path(__file__).resolve().parent.parent/'artifacts/travel-buddy-en';R=B/'revision-04';Q=R/'qa';Q.mkdir(parents=True,exist_ok=True)
# Recover source crops from preserved completed generations, without a new billable request.
def extract(file,time,target):
 cap=cv2.VideoCapture(str(file));cap.set(cv2.CAP_PROP_POS_MSEC,time*1000);ok,frame=cap.read();cap.release()
 if not ok:raise RuntimeError(f'Cached hand source unavailable: {file.name}')
 cv2.imwrite(str(target),frame)
extract(B/'hands-steady-performance.mp4',6,Q/'base.png')
extract(B/'revision-03/hands-tapping-performance.mp4',5,Q/'pointing.png')
source=B.parent.parent/'General-assesets/Meet Buddy/Trip creation - trip preferences - trip details.mov'
cap=cv2.VideoCapture(str(source));cap.set(cv2.CAP_PROP_POS_MSEC,10200);ok,k=cap.read();cap.release()
if not ok:raise RuntimeError('Native keyboard source unavailable')
cv2.imwrite(str(Q/'source-keyboard-10.2.png'),cv2.resize(k[52:1234,:],(456,896)))
# The rig uses the already generated Higgsfield hand; no new app UI or hand image.
base=cv2.imread(str(Q/'base.png'));hand=cv2.imread(str(Q/'pointing.png'))
# Keep the left support, phone and native curled support fingers. Remove the separate idle right hand.
keep=np.zeros(base.shape[:2],np.uint8)
poly=np.array([[0,0],[720,0],[720,330],[611,330],[619,555],[621,646],[544,686],[540,856],[418,876],[375,921],[309,955],[230,1017],[219,1095],[145,1280],[0,1280]])
cv2.fillPoly(keep,[poly],255)
# Use the original studio background sampled from an unoccluded patch, softly extended.
bg=np.empty_like(base);bg[:]=np.median(base[25:90,540:690].reshape(-1,3),axis=0)
a=cv2.GaussianBlur(keep,(9,9),2)[:,:,None]/255
clean=(base*a+bg*(1-a)).astype(np.uint8);cv2.imwrite(str(R/'clean-phone-plate.png'),clean)
# Foreground polygon follows the real generated right index and hand outline.
poly=np.array([[261,516],[280,517],[300,530],[320,556],[342,589],[371,633],[406,679],[446,725],[477,758],[487,735],[497,712],[514,700],[540,696],[561,701],[580,715],[593,746],[604,760],[618,738],[632,731],[651,732],[674,745],[689,766],[700,753],[719,751],[719,1279],[652,1279],[594,1165],[548,1080],[505,1012],[465,944],[434,887],[407,842],[384,804],[358,768],[334,732],[315,696],[297,656],[280,621],[266,588],[251,556],[244,535],[247,523]])
mask=np.zeros(hand.shape[:2],np.uint8);cv2.fillPoly(mask,[poly],255);mask=cv2.GaussianBlur(mask,(3,3),.65)
hsv=cv2.cvtColor(hand,cv2.COLOR_BGR2HSV)
green=cv2.inRange(hsv,np.array([30,60,45]),np.array([95,255,255]))
mask[green>0]=0
mask=cv2.erode(mask,np.ones((2,2),np.uint8))
hand[:,:,1]=np.minimum(hand[:,:,1],np.maximum(hand[:,:,0],hand[:,:,2])*1.06).astype(np.uint8)
cv2.imwrite(str(R/'hand-rig-matte.png'),mask)
# Pad cropped hand beyond the frame to ensure the wrist never terminates in view.
hand=cv2.copyMakeBorder(hand,0,700,0,700,cv2.BORDER_REPLICATE);mask=cv2.copyMakeBorder(mask,0,700,0,700,cv2.BORDER_REPLICATE)
cv2.imwrite(str(R/'hand-rig-colour.png'),hand)
def rig(target):
 tip=np.array([261.,521.]);anchor=np.array([900.,1480.]);v=tip-anchor;w=np.array(target)-anchor
 scale=np.linalg.norm(w)/np.linalg.norm(v);ang=np.arctan2(w[1],w[0])-np.arctan2(v[1],v[0]);c,s=np.cos(ang)*scale,np.sin(ang)*scale;A=np.array([[c,-s],[s,c]]);off=anchor-A@anchor;M=np.column_stack((A,off))
 col=cv2.warpAffine(hand,M,(720,1280));a=cv2.warpAffine(mask,M,(720,1280))[:,:,None]/255
 return (clean*(1-a)+col*a).astype(np.uint8)
sheet=Image.new('RGB',(4*288,2*512))
for n,p in enumerate([(220,200),(450,200),(220,450),(450,450),(220,720),(450,720),(300,830),(620,700)]):
 im=Image.fromarray(cv2.cvtColor(rig(p),cv2.COLOR_BGR2RGB));im.thumbnail((288,512));sheet.paste(im,(n%4*288,n//4*512))
sheet.save(Q/'rig-prototypes.jpg')
# Actual native UI audit at half-second intervals.
cap=cv2.VideoCapture(str(B/'revision-03/app-screen-feed-touch-aligned.mp4'))
for name,start,end in [('create',5,15),('preferences',15,22),('details-share',22,33),('manage',33,40),('chat',40,49)]:
 times=np.arange(start,end,.5);cols=7;rows=int(np.ceil(len(times)/cols));sh=Image.new('RGB',(cols*228,rows*470),'white');d=ImageDraw.Draw(sh)
 for n,t in enumerate(times):
  cap.set(cv2.CAP_PROP_POS_MSEC,(t+2)*1000);ok,f=cap.read();assert ok;im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));im=im.resize((228,448));x=n%cols*228;y=n//cols*470;sh.paste(im,(x,y));d.text((x+5,y+450),f'{t:.2f}',fill='black')
 sh.save(Q/f'actions-{name}.jpg')
