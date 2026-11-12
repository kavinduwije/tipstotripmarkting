from pathlib import Path
import cv2,numpy as np,json,sys
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'artifacts/countries-fluid-en';S=ROOT/'General-assesets/Countries'
M=np.load(D/'edit/watermark-matte.npy')
mask=cv2.dilate((M>.05).astype(np.uint8)*255,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,15)))
mask=cv2.bitwise_or(mask,cv2.imread(str(D/'edit/watermark-mask.png'),0))
cv2.imwrite(str(D/'edit/restoration-mask.png'),mask)
sift=cv2.SIFT_create(nfeatures=3000,contrastThreshold=.025)
matcher=cv2.BFMatcher()
def frame(c,t):
 c.set(cv2.CAP_PROP_POS_MSEC,t*1000);ok,f=c.read();return f if ok else None
def features(f):
 valid=np.full(mask.shape,255,np.uint8);valid[210:330,275:700]=0
 return sift.detectAndCompute(cv2.cvtColor(f,cv2.COLOR_BGR2GRAY),valid)
def restore(c,t):
 f=frame(c,t);k0,d0=features(f);total=c.get(cv2.CAP_PROP_FRAME_COUNT)/c.get(cv2.CAP_PROP_FPS)
 candidates=[]; quality=[];needed=mask>0
 for dt in [.5,-.5,1,-1,2,-2,3,-3,4,-4,6,-6,8,-8]:
  if t+dt<0 or t+dt>=total-.05:continue
  ref=frame(c,t+dt);k1,d1=features(ref)
  matches=matcher.knnMatch(d1,d0,k=2);good=[a for a,b in matches if a.distance<.7*b.distance]
  if len(good)<20:continue
  p1=np.float32([k1[m.queryIdx].pt for m in good]);p0=np.float32([k0[m.trainIdx].pt for m in good])
  h,ok=cv2.findHomography(p1,p0,cv2.RANSAC,1.5)
  if h is None or ok.sum()<20:continue
  warped=cv2.warpPerspective(ref,h,(960,540),flags=cv2.INTER_CUBIC)
  valid=cv2.warpPerspective(255-mask,h,(960,540),flags=cv2.INTER_LINEAR)>254
  valid&=needed
  patch=warped.astype(np.float32);patch[~valid]=np.nan
  candidates.append(patch);quality.append({'offset':dt,'inliers':int(ok.sum()),'validPixels':int(valid.sum())})
 # The median rejects moving people and minor registration errors.
 import warnings
 with warnings.catch_warnings():
  warnings.simplefilter('ignore',RuntimeWarning);replacement=np.nanmedian(candidates,axis=0)
 valid=np.isfinite(replacement[:,:,0])&needed
 out=f.copy();out[valid]=np.clip(replacement[valid],0,255).astype(np.uint8)
 missing=needed&~valid
 if missing.any():out=cv2.inpaint(out,missing.astype(np.uint8)*255,2,cv2.INPAINT_TELEA)
 return out,{'t':t,'coverage':float(valid.sum()/needed.sum()),'donors':quality}
rows=[('Spain',4),('Sri Lanka',8),('Italy',4)]
report={}
for name,t in rows:
 c=cv2.VideoCapture(str(S/(name+'.mp4')));out,r=restore(c,t);c.release();report[name]=r
 cv2.imwrite(str(D/'qa'/(name+'-temporal-test.png')),out)
 print(name,r['coverage'],flush=True)
(D/'qa/temporal-restoration-test.json').write_text(json.dumps(report,indent=2))
