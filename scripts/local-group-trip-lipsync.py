"""Free local MuseTalk 1.5 trial; keep outputs separate until visual review.

Uses the original Higgsfield video, matching dry ElevenLabs audio, OpenCV face
tracking, and a feathered lower-face composite. No remote inference is called.
Upstream code/weights: https://github.com/TMElyralab/MuseTalk (MIT).
"""
from pathlib import Path
import sys,json,time,subprocess,argparse
import cv2,numpy as np,torch
from scipy.ndimage import median_filter
from transformers import WhisperModel
REPO=Path('/private/tmp/MuseTalk-main')
sys.path.insert(0,str(REPO))
from musetalk.models.vae import VAE
from musetalk.models.unet import UNet,PositionalEncoding
from musetalk.utils.audio_processor import AudioProcessor

ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT/'artifacts/group-trip-en'; REV=BASE/'revision-02'
parser=argparse.ArgumentParser();parser.add_argument('--shot',default='speaking-hotel');parser.add_argument('--face',type=int,default=-1);parser.add_argument('--audio');parser.add_argument('--seconds',type=float);parser.add_argument('--batch',action='store_true');parser.add_argument('--base',type=Path);parser.add_argument('--outdir',type=Path);parser.add_argument('--jobs',type=Path);args=parser.parse_args()
if args.base:BASE=args.base.resolve()
outdir=args.outdir.resolve() if args.outdir else REV/'lipsync/local-trials';outdir.mkdir(parents=True,exist_ok=True)
device=torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
dtype=torch.float16 if device.type=='mps' else torch.float32
print(f'Local processing: OpenCV {cv2.__version__}, PyTorch {torch.__version__}, device {device}',flush=True)
torch.set_num_threads(6);torch.manual_seed(281002)
vae=VAE(model_path=str(REPO/'models/sd-vae'),use_float16=device.type=='mps')
vae.vae=vae.vae.to(device=device,dtype=dtype)
unet=UNet(str(REPO/'models/musetalkV15/musetalk.json'),str(REPO/'models/musetalkV15/unet.pth'),use_float16=device.type=='mps',device=device)
pe=PositionalEncoding(384).to(device=device,dtype=dtype)
whisper=WhisperModel.from_pretrained(str(REPO/'models/whisper'),local_files_only=True).to(device=device,dtype=dtype).eval()
processor=AudioProcessor(str(REPO/'models/whisper'))
timesteps=torch.tensor([0],device=device)
def process(job):
 shot=job['shot'];face=job.get('face',-1);center=job.get('center');seconds=job.get('seconds')
 audio=Path(job['audio']);input_video=Path(job.get('input',BASE/(job.get('source',shot)+'.mp4')))
 output=outdir/f'{shot}-face{face}.mp4'
 expected=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(input_video)]))
 if output.exists() and (outdir/f'{shot}-face{face}.json').exists() and abs(json.loads((outdir/f'{shot}-face{face}.json').read_text())['frames']/json.loads((outdir/f'{shot}-face{face}.json').read_text())['fps']-(seconds or expected))<.04:
  print(f'{shot}: cached local trial',flush=True);return
 cap=cv2.VideoCapture(str(input_video));fps=cap.get(cv2.CAP_PROP_FPS);frames=[]
 while True:
  ok,f=cap.read()
  if not ok:break
  frames.append(f)
  if seconds and len(frames)>=round(seconds*fps):break
 cap.release()
 det=cv2.FaceDetectorYN.create(str(REPO/'face-yunet.onnx'),'',(frames[0].shape[1],frames[0].shape[0]),.65,.3,5000)
 boxes=[];previous=None
 for n,frame in enumerate(frames):
  _,found=det.detect(frame)
  if found is not None and len(found):
   if previous is None:
    found=sorted(found,key=lambda b:b[0]);b=min(found,key=lambda b:np.linalg.norm(np.array([b[0]+b[2]/2,b[1]+b[3]/2])-np.array(center))) if center else (found[face] if face>=0 else max(found,key=lambda b:b[2]*b[3]))
   else:
    pc=np.array([previous[0]+previous[2]/2,previous[1]+previous[3]/2]);b=min(found,key=lambda b:np.linalg.norm(np.array([b[0]+b[2]/2,b[1]+b[3]/2])-pc))
   if previous is None or np.linalg.norm(np.array(b[:2])-np.array(previous[:2]))<previous[2]:previous=b
  if previous is None:raise RuntimeError('No usable face in first frame; supply reviewed face coordinates.')
  x,y,w,h=map(int,previous[:4]);nose=float(previous[9]);bottom=min(frame.shape[0],round(y+1.05*h));top=max(0,round(nose-(bottom-nose)));boxes.append([max(0,x),top,min(frame.shape[1],x+w),bottom])
 boxes=median_filter(np.asarray(boxes),size=(5,1)).astype(int)
 cv2.imwrite(str(outdir/f'{shot}-face-input.jpg'),frames[0][boxes[0,1]:boxes[0,3],boxes[0,0]:boxes[0,2]])
 with torch.inference_mode():
  features,length=processor.get_audio_feature(str(audio));chunks=processor.get_whisper_chunk(features,device,dtype,whisper,length,fps=int(fps))
  chunks=chunks[:len(frames)]
  output=outdir/f'{shot}-face{face}.mp4'
  silent=outdir/f'{shot}-face{face}-silent.mp4'
  H,W=frames[0].shape[:2]
  pipe=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{W}x{H}','-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',str(silent)],stdin=subprocess.PIPE)
  start=time.time()
  yy,xx=np.mgrid[:256,:256]
  mask=np.clip((1-((xx-128)/108)**2-((yy-188)/64)**2)*8,0,1).astype(np.float32)
  mask=cv2.GaussianBlur(mask,(15,15),4)
  active=[i for i in range(len(chunks)) if not job.get('intervals') or any(a<=i/fps<b for a,b in job['intervals'])]
  replacements={}
  for first in range(0,len(active),2):
   indices=active[first:first+2];latents=[]
   for i in indices:
    x1,y1,x2,y2=boxes[i];crop=cv2.resize(frames[i][y1:y2,x1:x2],(256,256),interpolation=cv2.INTER_LANCZOS4)
    latents.append(vae.get_latents_for_unet(crop))
   latent=torch.cat(latents).to(dtype=dtype);audiofeature=pe(chunks[indices].to(device=device,dtype=dtype))
   pred=unet.model(latent,timesteps,encoder_hidden_states=audiofeature).sample
   recon=vae.decode_latents(pred)
   for i,replacement in zip(indices,recon):replacements[i]=replacement
   if first%10==0:print(f'{shot}: {first+len(indices)}/{len(active)} active frames, {time.time()-start:.1f}s',flush=True)
  for i,original in enumerate(frames):
   if i in replacements:
    x1,y1,x2,y2=boxes[i];replacement=cv2.resize(replacements[i],(x2-x1,y2-y1),interpolation=cv2.INTER_CUBIC);alpha=cv2.resize(mask,(x2-x1,y2-y1))[...,None]
    original[y1:y2,x1:x2]=(replacement*alpha+original[y1:y2,x1:x2]*(1-alpha)).clip(0,255).astype(np.uint8)
   pipe.stdin.write(original.tobytes())
  pipe.stdin.close();assert pipe.wait()==0
  subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(audio),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-shortest',str(output)],check=True)
  (outdir/f'{shot}-face{face}.json').write_text(json.dumps({'status':'trial-awaiting-visual-review','input':str(input_video),'audio':str(audio),'output':str(output),'model':'MuseTalk 1.5','remoteInference':False,'additionalPaidRequests':0,'device':str(device),'opencvVersion':cv2.__version__,'boxes':boxes.tolist(),'frames':len(chunks),'fps':fps,'elapsedSeconds':time.time()-start},indent=2))
  print(output,flush=True)
jobs=json.loads((args.jobs or REV/'lipsync/local-jobs.json').read_text()) if args.batch or args.jobs else [{'shot':args.shot,'audio':args.audio or str(REV/'lipsync/inputs'/f'{args.shot}.wav'),'face':args.face,'seconds':args.seconds}]
for job in jobs:process(job)
