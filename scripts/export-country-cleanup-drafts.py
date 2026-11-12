"""Non-destructive cleanup draft exports for the six requested source ranges."""
from pathlib import Path
import cv2,numpy as np,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'artifacts/countries-fluid-en';OUT=ROOT/'General-assesets/Countries'
ROWS=[('Spain',4,8),('France',18,24),('Portugal',4,8),('Sri Lanka',8,12),('Italy',4,10),('Germany',0,15)]
RESTORATION_MASK=cv2.imread(str(D/'edit/restoration-mask.png'),0)
def clean(f):
    # Broad contour safety margins remove all visible letter edges. This is a
    # spatial restoration draft: underlying fine detail cannot be recovered.
    return cv2.inpaint(f,RESTORATION_MASK,3,cv2.INPAINT_NS)
def export():
    result=[]
    (D/'clean').mkdir(exist_ok=True)
    for name,start,end in ROWS:
        target=OUT/(name+f' - {start:02d}-{end:02d}s watermark-removed DRAFT.mp4')
        if target.exists():raise RuntimeError('Refusing to overwrite existing derivative: '+target.name)
        raw=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(start),'-t',str(end-start),'-i',str(OUT/(name+'.mp4')),'-vf','fps=30','-f','rawvideo','-pix_fmt','bgr24','-'],stdout=subprocess.PIPE)
        enc=subprocess.Popen(['ffmpeg','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s','960x540','-r','30','-i','-','-an','-c:v','libx264','-crf','17','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart','-threads','4',str(target)],stdin=subprocess.PIPE)
        count=0
        while True:
            data=raw.stdout.read(960*540*3)
            if not data:break
            if len(data)!=960*540*3:raise RuntimeError('Incomplete decoded frame')
            f=np.frombuffer(data,np.uint8).reshape(540,960,3)
            enc.stdin.write(clean(f).tobytes());count+=1
        enc.stdin.close();rc1=raw.wait();rc2=enc.wait()
        if rc1 or rc2 or count!=(end-start)*30:raise RuntimeError('Cleanup encode failed for '+name)
        import shutil
        shutil.copy2(target,D/'clean'/(name+'.mp4'))
        result.append({'file':str(target),'source':str(OUT/(name+'.mp4')),'sourceRangeSeconds':[start,end],'frames':count,'quality':'cleanup draft, artefacts remain','originalModified':False})
        print(name+': '+str(count)+' cleaned draft frames saved',flush=True)
    (D/'qa/cleanup-draft-exports.json').write_text(json.dumps(result,indent=2))
if '--export' in sys.argv:export()
else:print("Run with --export to save six new cleanup draft files without replacing originals.")
