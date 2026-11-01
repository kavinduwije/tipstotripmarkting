"""Authorised Barcelona gallery replacements in the supplied native recording."""
from pathlib import Path
import json, subprocess
import cv2
import numpy as np
from PIL import Image, ImageOps, ImageDraw

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'artifacts/girls-trip-en'
ASSETS=ROOT/'artifacts/travel-buddy-en/revision-02/assets'
IDS=[31244837,27550036,16841068,13426112,16429021,17070681,14434675,33455437,34947043]
photos=[Image.open(ASSETS/f'barcelona-{i}.jpg').convert('RGB') for i in IDS]
def photo(i,w,h,r=0):
 im=ImageOps.fit(photos[i],(w,h),method=Image.Resampling.LANCZOS).convert('RGBA')
 if r:
  m=Image.new('L',(w,h));ImageDraw.Draw(m).rounded_rectangle((0,0,w-1,h-1),r,fill=255);im.putalpha(m)
 return im
cap=cv2.VideoCapture(str(OUT/'demo/gallery-native.mp4'))
writer=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','602x1234','-r','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',str(OUT/'demo/gallery-barcelona.mp4')],stdin=subprocess.PIPE)
tracking=[]
while True:
 ok,frame=cap.read()
 if not ok:break
 original=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)).convert('RGBA');im=original.copy()
 # Native picker is fully settled in the selected trim. Detect Photos tab.
 hsv=cv2.cvtColor(frame,cv2.COLOR_BGR2HSV)
 picker=bool(np.count_nonzero(cv2.inRange(hsv[410:475,145:319],np.array([100,100,90]),np.array([130,255,255])))>6000)
 if picker:
  for i in range(9):
   x=(i%3)*201;y=521+(i//3)*202;w=min(200,602-x);h=201
   mask=cv2.inRange(hsv[y:y+48,x:x+48],np.array([100,110,120]),np.array([130,255,255]))
   if np.count_nonzero(mask)>250:
    im.paste((222,223,226,255),(x,y,x+w,y+h));im.alpha_composite(photo(i,w-36,h-36,21),(x+18,y+18))
    # Preserve the exact native selected badge, including its white tick.
    badge=original.crop((x+4,y+4,x+43,y+43));m=Image.new('L',badge.size);ImageDraw.Draw(m).ellipse((0,0,38,38),fill=255);badge.putalpha(m);im.alpha_composite(badge,(x+4,y+4))
   else:im.alpha_composite(photo(i,w,h),(x,y))
  # The picker exposes part of a fourth row below the October heading.
  done_visible=np.count_nonzero(cv2.inRange(hsv[1160:1234,400:580],np.array([100,100,90]),np.array([130,255,255])))>1000
  if not done_visible:
   im.alpha_composite(photo(5,200,190),(0,1209));im.alpha_composite(photo(6,200,190),(201,1209));im.alpha_composite(photo(7,199,190),(402,1209))
  tracking.append('nine Barcelona photos, native selected badge preserved')
 else:
  # Match the selected first tile once the picker closes; preserve its native X.
  im.alpha_composite(photo(3,139,145,20),(72,687))
  badge=original.crop((184,686,215,718));im.alpha_composite(badge,(184,686))
  tracking.append('selected Barcelona photo follows through into post')
 writer.stdin.write(im.convert('RGB').tobytes())
writer.stdin.close()
if writer.wait()!=0:raise RuntimeError('Gallery encoding failed')
cap.release()
(OUT/'demo/gallery-tracking.json').write_text(json.dumps({'source':'TravelBuddyPostCreationSharing.mov','sourceStart':74.6,'fps':30,'frames':len(tracking),'operations':tracking},indent=2))
sources=json.loads((ROOT/'artifacts/travel-buddy-en/revision-02/asset-sources.json').read_text())
(OUT/'demo/asset-sources.json').write_text(json.dumps({'cityPhotos':sources['cityPhotos'],'cachedPhotosReused':True},indent=2))
print(f'Barcelona gallery prepared: {len(tracking)} frames.')
