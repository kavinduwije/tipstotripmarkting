"""Clean only the requested source ranges; preserve the supplied originals."""
from pathlib import Path
import cv2, numpy as np, json, subprocess, sys
from scipy.ndimage import gaussian_filter
from scipy.optimize import differential_evolution, minimize
ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'artifacts/countries-fluid-en'
SOURCE=ROOT/'General-assesets/Countries'
ROWS=[('Spain',4,8),('France',18,24),('Portugal',4,8),('Sri Lanka',8,12),('Italy',4,10),('Germany',0,15)]
ROI=(280,210,410,115)
def learn():
    # Fixed translucent graphic is isolated by consensus across independent moving scenes.
    per=[]
    for name,_,_ in ROWS:
        c=cv2.VideoCapture(str(SOURCE/(name+'.mp4'))); total=c.get(cv2.CAP_PROP_FRAME_COUNT)/c.get(cv2.CAP_PROP_FPS); stack=[]
        for t in np.arange(.2,total-.2,.33):
            c.set(cv2.CAP_PROP_POS_MSEC,t*1000); ok,f=c.read()
            if not ok: continue
            g=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
            low=gaussian_filter(g,9)
            residual=(g-low)/np.maximum(1-low,.16)
            x,y,w,h=ROI;stack.append(residual[y:y+h,x:x+w])
        c.release();per.append(np.median(stack,axis=0))
    consensus=np.mean(per,axis=0)
    vis=np.clip((consensus+.04)*1600,0,255).astype(np.uint8)
    cv2.imwrite(str(DIR/'qa/watermark-consensus.png'),cv2.resize(vis,None,fx=3,fy=3))
    np.save(DIR/'edit/watermark-consensus.npy',consensus)
    mask=(consensus>.019).astype(np.uint8)*255
    mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    full=np.zeros((540,960),np.uint8);x,y,w,h=ROI;full[y:y+h,x:x+w]=mask
    cv2.imwrite(str(DIR/'edit/watermark-mask.png'),full)
    cv2.imwrite(str(DIR/'qa/watermark-mask-preview.png'),cv2.resize(mask,None,fx=3,fy=3))
    print('Watermark consensus and candidate mask prepared.')
def refine():
    a=np.load(DIR/'edit/watermark-consensus.npy')
    mask=np.zeros(a.shape,np.uint8)
    # Bounds follow only the six wordmark glyphs; reject stationary scenery.
    for x0,y0,x1,y1 in [(84,38,140,95),(146,39,192,95),(193,39,246,95),(244,39,294,95),(297,25,329,95),(330,38,387,95)]:
        m=(a[y0:y1,x0:x1]>.025).astype(np.uint8)*255
        m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
        n,labels,stats,_=cv2.connectedComponentsWithStats(m)
        if n>1:m=(labels==(1+np.argmax(stats[1:,cv2.CC_STAT_AREA]))).astype(np.uint8)*255
        mask[y0:y1,x0:x1]=m
    # The small stylised symbol has disconnected strokes and a dot.
    poly=np.array([(14,56),(54,14),(62,12),(69,15),(71,23),(69,30),(45,50),(62,40),(68,39),(73,43),(73,50),(58,61),(67,59),(72,63),(74,70),(70,77),(50,92),(44,94),(41,91),(25,94),(18,91),(13,88),(12,80),(19,73),(42,58),(25,66),(17,68),(13,65)],np.int32)
    cv2.fillPoly(mask,[poly],255);cv2.circle(mask,(48,101),4,255,-1)
    mask=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    full=np.zeros((540,960),np.uint8);x,y,w,h=ROI;full[y:y+h,x:x+w]=mask
    cv2.imwrite(str(DIR/'edit/watermark-mask.png'),full)
    for name,_,_ in ROWS:
        f=cv2.imread(str(DIR/'qa'/(name+'-source.png')))
        out=cv2.inpaint(f,full,3,cv2.INPAINT_TELEA)
        cv2.imwrite(str(DIR/'qa'/(name+'-clean-test.png')),out)
    cv2.imwrite(str(DIR/'qa/watermark-mask-refined.png'),cv2.resize(mask,None,fx=3,fy=3))
    print('Glyph mask and six cleanup previews ready.')
def inverse():
    a=np.load(DIR/'edit/watermark-consensus.npy')
    src=cv2.imread(str(DIR/'edit/envato-template.png'),cv2.IMREAD_GRAYSCALE).astype(np.float32)/255
    def template(p):
        x,y,w,h=p
        return cv2.warpAffine(src,np.float32([[w/src.shape[1],0,x],[0,h/src.shape[0],y]]),(410,115),flags=cv2.INTER_LINEAR)
    target=a-np.mean(a)
    def cost(p):
        m=template(p); hp=m-cv2.GaussianBlur(m,(0,0),9)
        return -np.sum(hp*target)/np.sqrt(np.sum(hp*hp)*np.sum(target*target))
    fit=differential_evolution(cost,[(7,25),(5,25),(355,390),(75,103)],seed=1011,maxiter=100,popsize=10,tol=.00001)
    matte=template(fit.x)
    full=np.zeros((540,960),np.float32);x,y,w,h=ROI;full[y:y+h,x:x+w]=matte
    np.save(DIR/'edit/watermark-matte.npy',full)
    cv2.imwrite(str(DIR/'qa/watermark-template-fit.png'),(matte*255).astype(np.uint8))
    report={'method':'Inverse translucent compositing using registered official wordmark geometry; no rectangular blur or replacement imagery','geometry':fit.x.tolist(),'correlation':-fit.fun,'alpha':.3,'reference':'https://assets.elements.envato.com/apps/storefront/EnvatoLogoDark-d7fdce89d7315fa71e83.svg'}
    (DIR/'qa/watermark-registration.json').write_text(json.dumps(report,indent=2))
    for name,_,_ in ROWS:
        f=cv2.imread(str(DIR/'qa'/(name+'-source.png'))).astype(np.float32)
        alpha=full[:,:,None]*.3
        out=np.clip((f-alpha*255)/(1-alpha),0,255).astype(np.uint8)
        cv2.imwrite(str(DIR/'qa'/(name+'-inverse-test.png')),out)
    print(json.dumps(report),flush=True)
def fit_glyphs():
    a=np.load(DIR/'edit/watermark-consensus.npy')
    src=cv2.imread(str(DIR/'edit/envato-template.png'),cv2.IMREAD_GRAYSCALE).astype(np.float32)/255
    n,labels,stats,_=cv2.connectedComponentsWithStats((src>.5).astype(np.uint8))
    pieces=[]
    initial=json.loads((DIR/'qa/watermark-registration.json').read_text())['geometry']
    for i in range(1,n):
        bx,by,bw,bh,area=stats[i]
        psrc=src[by:by+bh,bx:bx+bw].copy()
        psrc[labels[by:by+bh,bx:bx+bw]!=i]=0
        psrc=np.pad(psrc,3)
        iw=initial[2]/src.shape[1];ih=initial[3]/src.shape[0]
        init=[initial[0]+(bx-3)*iw,initial[1]+(by-3)*ih,(bw+6)*iw,(bh+6)*ih]
        def templ(p):
            x,y,w,h=p
            return cv2.warpAffine(psrc,np.float32([[w/psrc.shape[1],0,x],[0,h/psrc.shape[0],y]]),(410,115),flags=cv2.INTER_LINEAR)
        def cost(p):
            m=templ(p); hp=m-cv2.GaussianBlur(m,(0,0),5)
            return -np.sum(hp*a)/np.sqrt(np.sum(hp*hp)+1e-6)
        delta=9 if area>1500 else 5
        fit=differential_evolution(cost,[(init[0]-delta,init[0]+delta),(init[1]-delta,init[1]+delta),(init[2]*.82,init[2]*1.15),(init[3]*.82,init[3]*1.15)],seed=420+i,maxiter=70,popsize=8,tol=.00005)
        pieces.append(templ(fit.x))
    matte=np.maximum.reduce(pieces)
    full=np.zeros((540,960),np.float32);x,y,w,h=ROI;full[y:y+h,x:x+w]=matte
    np.save(DIR/'edit/watermark-matte.npy',full)
    cv2.imwrite(str(DIR/'qa/watermark-glyph-fit.png'),(matte*255).astype(np.uint8))
    hp=matte-cv2.GaussianBlur(matte,(0,0),5)
    alphas={}
    for name,start,end in ROWS:
        c=cv2.VideoCapture(str(SOURCE/(name+'.mp4')));fps=c.get(cv2.CAP_PROP_FPS); rows=[];i=0
        while True:
            ok,f=c.read()
            if not ok:break
            if i%max(1,round(fps/2))==0:
                g=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
                lo=cv2.GaussianBlur(g,(0,0),5)
                r=(g-lo)/np.maximum(1-lo,.2);rows.append(r[y:y+h,x:x+w])
            i+=1
        c.release()
        observed=np.median(rows,axis=0)
        alpha=float(np.sum(hp*observed)/np.sum(hp*hp))
        alpha=float(np.clip(alpha,.05,.4));alphas[name]=alpha
        f=cv2.imread(str(DIR/'qa'/(name+'-source.png'))).astype(np.float32)
        am=full[:,:,None]*alpha
        out=np.clip((f-am*255)/(1-am),0,255).astype(np.uint8)
        cv2.imwrite(str(DIR/'qa'/(name+'-glyph-test.png')),out)
    (DIR/'edit/watermark-alphas.json').write_text(json.dumps(alphas,indent=2))
    print(json.dumps(alphas),flush=True)
def finish_tests():
    matte=np.load(DIR/'edit/watermark-matte.npy')
    binary=(matte>.4).astype(np.uint8)
    edge=(cv2.dilate(binary,np.ones((5,5),np.uint8))-cv2.erode(binary,np.ones((5,5),np.uint8)))*255
    cv2.imwrite(str(DIR/'edit/watermark-edge-mask.png'),edge)
    alphas={'Spain':.15,'France':.3,'Portugal':.3,'Sri Lanka':.3,'Italy':.3,'Germany':.3}
    (DIR/'edit/watermark-alphas.json').write_text(json.dumps(alphas,indent=2))
    for name,_,_ in ROWS:
        f=cv2.imread(str(DIR/'qa'/(name+'-source.png'))).astype(np.float32)
        am=matte[:,:,None]*alphas[name]
        out=np.clip((f-am*255)/(1-am),0,255).astype(np.uint8)
        out=cv2.inpaint(out,edge,2,cv2.INPAINT_TELEA)
        cv2.imwrite(str(DIR/'qa'/(name+'-finished-test.png')),out)
    print('Inverse composite with narrow contour cleanup prepared.')
if __name__=='__main__':
    if '--finish-tests' in sys.argv:finish_tests()
    elif '--glyphs' in sys.argv:fit_glyphs()
    elif '--inverse' in sys.argv:inverse()
    elif '--refine' in sys.argv:refine()
    else:learn()
