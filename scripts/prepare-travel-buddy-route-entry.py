"""Use the supplied native name/from/to interaction, with pinned source/action frames."""
from pathlib import Path
import cv2,numpy as np,json,subprocess
B=Path(__file__).resolve().parent.parent/'artifacts/travel-buddy-en';R=B/'revision-05';R.mkdir(exist_ok=True)
# Each pin is a frame in the six-second replacement and a second in the supplied recording.
pins=[(0,3),(3,4),(9,5),(18,6.7),(27,8.2),(36,9.8),(42,10.3),(46,10.4),(47,10.433),(48,10.467),(50,10.6),(56,11.5),(60,11.633),(63,12.25),(68,12.75),(77,14.25),(83,15.2),(86,15.233),(88,15.267),(89,15.3),(93,16.0),(94,16.1),(96,16.5),(99,17.2),(110,18.6),(117,19.65),(121,19.733),(122,19.767),(125,20.1),(127,20.8),(128,20.9),(129,21),(132,21.333),(133,21.467),(134,21.533)]
source_map=np.round(np.interp(np.arange(135),*[np.array(pins)[:,i] for i in [0,1]])*30).astype(int)
source=cv2.VideoCapture(str(R/'native-entry-source-26s.mp4'));old=cv2.VideoCapture(str(B/'revision-03/app-screen-feed-touch-aligned.mp4'))
pipe=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','456x896','-r','30','-i','-','-an','-c:v','libx264','-preset','fast','-crf','16','-pix_fmt','yuv420p',str(R/'entry-app-feed.mp4')],stdin=subprocess.PIPE)
frames=[]
for n in range(180):
 if n<135:cap=source;index=int(source_map[n]);origin='supplied-native-entry'
 else:cap=old;index=300+(n-135)*2;origin='previous-native-calendar-edit'
 cap.set(cv2.CAP_PROP_POS_FRAMES,index);ok,f=cap.read();assert ok,(n,index);pipe.stdin.write(f.tobytes());frames.append({'replacementFrame':n,'finalFrame':n+150,'source':origin,'sourceFrame':index})
pipe.stdin.close();assert pipe.wait()==0
prior=json.loads((B/'revision-04/touch-action-map.json').read_text());events=[e for e in prior['events'] if e['time']>=11]
# Contacts on native fields/results, rather than a hand imitating the accelerated keyboard keystrokes.
def tap(name,n,xy,box,approach=.24,release=.16):
 events.append({'name':name,'type':'tap','time':(150+n)/30,'frame':150+n,'xy':xy,'targetBounds':box,'approach':approach,'release':release,'evidence':'Pinned to the supplied native recording and its visible field / result state; see entry-edit-plan.json.'})
tap('trip-name-field',0,[220,349],[40,320,416,387],.25,.15)
tap('spain-flag-emoji',47,[345,552],[316,529,376,577],.2,.14)
tap('from-field',60,[220,288],[40,255,416,322],.16,.14)
tap('select-france',88,[180,340],[40,307,416,375],.2,.13)
tap('to-field',94,[220,350],[40,315,416,385],.16,.13)
tap('select-spain',122,[180,340],[40,307,416,375],.22,.13)
tap('calendar-next-november',128,[384,382],[357,355,411,408],.14,.1)
tap('calendar-next-december',133,[384,382],[357,355,411,408],.12,.1)
for name,oldtime,newn,xy,box in [('start-date-20',8+19/30,160,[75,637],[51,614,99,662]),('end-date-31',9+10/30,170,[279,688],[256,664,304,712]),('save-route',10+20/30,175,[192,851],[84,821,302,883])]:
 # At 2x playback, native first contact dates quantise to the nearest retained frame.
 newn=135+round((oldtime-8)*15)
 tap(name,newn,xy,box,.25,.15)
events.sort(key=lambda e:e['time'])
prior.update(events=events,method='Native route-entry replaces promo and adds actual From France / To Spain search and selection. Existing corrected hand and UI footage after final 11 seconds is reused unchanged. Individual accelerated native keystrokes remain unobstructed; contacts are on actual fields, emoji, country results and calendar controls.',entrySource='entry-edit-plan.json')
(R/'touch-action-map.json').write_text(json.dumps(prior,indent=2)+'\n')
plan={'replacementFinalTimeline':[5,11],'nativeRecording':'General-assesets/Meet Buddy/Trip creation - trip preferences - trip details.mov','name':'Trip to Spain 🇪🇸','from':'France','to':'Spain','nativeNameFromTo':True,'nativeTypingAndAutocompletePreserved':True,'nameFinalTimeline':[5,7],'fromFinalTimeline':[7,8.2],'toFinalTimeline':[8.2,9.5],'datesFinalTimeline':[9.5,11],'pins':pins,'frames':frames,'reason':'Trim and accelerate typing/search pauses to fit the existing create-and-route narration; retain 58-second runtime and all later feature timings.','sourceAfter11':'../revision-04/hands-screen-composited.mp4 (from local second 6 onward)','backendClaim':False}
(R/'entry-edit-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
print('Prepared six-second native Trip to Spain / France / Spain journey.')
