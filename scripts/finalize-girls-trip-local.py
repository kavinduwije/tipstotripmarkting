"""Keep the two non-speaking sunset friends' original smiles after review."""
from pathlib import Path
import json,subprocess
import cv2,numpy as np
base=Path(__file__).resolve().parent.parent/'artifacts/girls-trip-en'
rev=base/'lip-sync-revision';local=rev/'local-trials'
source=cv2.VideoCapture(str(base/'sunset-speaking.mp4'))
fixed=cv2.VideoCapture(str(local/'sunset-speaking-friend4-face3.mp4'))
tracks=[json.loads((local/f'sunset-speaking-friend{face+1}-face{face}.json').read_text()) for face in [0,3]]
output=local/'sunset-speaking-reviewed.mp4';fps=source.get(cv2.CAP_PROP_FPS)
w=int(source.get(cv2.CAP_PROP_FRAME_WIDTH));h=int(source.get(cv2.CAP_PROP_FRAME_HEIGHT))
pipe=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',str(output)],stdin=subprocess.PIPE)
yy,xx=np.mgrid[:256,:256];mask=np.clip((1-((xx-128)/108)**2-((yy-188)/64)**2)*12,0,1).astype(np.float32);mask=cv2.GaussianBlur(mask,(11,11),3)
i=0
while True:
 ok,original=source.read();ok2,corrected=fixed.read()
 if not ok:break
 if not ok2:raise RuntimeError('Correction ended before original video')
 for track in tracks:
  x1,y1,x2,y2=track['boxes'][i];alpha=cv2.resize(mask,(x2-x1,y2-y1))[...,None]
  original[y1:y2,x1:x2]=(corrected[y1:y2,x1:x2]*alpha+original[y1:y2,x1:x2]*(1-alpha)).clip(0,255).astype(np.uint8)
 pipe.stdin.write(original.tobytes());i+=1
pipe.stdin.close();assert pipe.wait()==0
source.release();fixed.release()
(rev/'qa/sunset-composite.json').write_text(json.dumps({'frames':i,'fps':fps,'correctedFaces':[0,3],'nativeSilentFacesPreserved':[1,2],'reason':'Silent face trials reduced natural listening smiles; keep native expressions for the two friends without dialogue.','output':str(output)},indent=2))
print(output)
