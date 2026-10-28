"""Requested Barcelona gallery and fictional sharing contacts, in native screen space."""
from pathlib import Path
import json
import subprocess
import cv2
import numpy as np
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'artifacts/travel-buddy-en'
REV = BASE / 'revision-02'
ASSETS = REV / 'assets'
QA = REV / 'qa'
QA.mkdir(parents=True, exist_ok=True)
IDS = [31244837, 27550036, 16841068, 13426112, 16429021, 17070681, 14434675, 33455437, 34947043]
photos = [Image.open(ASSETS / f'barcelona-{i}.jpg').convert('RGB') for i in IDS]

def rgb(frame):
    return Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert('RGBA')

def rounded_photo(photo, size, radius=0, dim=1):
    im = ImageOps.fit(photo, size, method=Image.Resampling.LANCZOS).convert('RGBA')
    if dim != 1:
        a = np.array(im)
        a[:, :, :3] = (a[:, :, :3].astype(float)*dim).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(a)
    if radius:
        m = Image.new('L', size)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0]-1, size[1]-1), radius, fill=255)
        im.putalpha(m)
    return im

reference = cv2.imread(str(QA / 'feed-31.png'))
# The photo content is tracked before perspective compositing. Brightness changes
# from the native share modal do not affect normalised template correlation.
templates = [reference[220:244, 41:181], reference[220:244, 218:358]]
avatars = []
profiles = [('camille', 'Emma', 'Wilson'), ('hugo', 'Lucas', 'Martin'), ('lea', 'Sofia', 'Costa')]
for identifier, first, last in profiles:
    original = ROOT / f'artifacts/ugc-product-fr/sharing-profiles/{identifier}-avatar.png'
    image = Image.open(original).convert('RGBA').resize((56, 56), Image.Resampling.LANCZOS)
    image.save(ASSETS / f'{first.lower()}-avatar.png')
    avatars.append(image)
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
cap = cv2.VideoCapture(str(BASE / 'edit/app-screen-feed.mp4'))
output = REV / 'app-screen-feed-barcelona-contacts.mp4'
process = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '456x896', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', '-pix_fmt', 'yuv420p', str(output)], stdin=subprocess.PIPE)
tracking = []
for n in range(1800):
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f'Source feed ended at {n}')
    im = rgb(frame)
    edits = []
    picker = None
    if 450 <= n < 510:
        # Follow the native picker and stop the replacement as soon as it closes.
        blue = cv2.inRange(cv2.cvtColor(frame, cv2.COLOR_BGR2HSV), np.array([100, 100, 90]), np.array([130, 255, 255]))
        blue[:150] = 0
        blue[750:] = 0
        contours, _ = cv2.findContours(blue, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        buttons = [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 3000 and 100 < cv2.boundingRect(c)[2] < 180 and cv2.boundingRect(c)[0] < 200]
        if buttons:
            picker = buttons[0]
    if picker is not None:
        offset = picker[1]-270
        for i in range(9):
            x, y = (i % 3)*152, 354+(i//3)*154+offset
            width, height = min(152, 456-x), min(154, 815+offset-y, 896-y)
            tile = frame[y:y+height, x:x+width]
            hsv = cv2.cvtColor(tile, cv2.COLOR_BGR2HSV)
            mask = cv2.inRange(hsv, np.array([100, 110, 120]), np.array([125, 255, 255]))
            mask[48:] = 0
            mask[:, 48:] = 0
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            circles = [c for c in contours if 90 < cv2.contourArea(c) < 1300]
            if circles:
                im.paste((222, 223, 226, 255), (x, y, x+width, y+height))
                photo = rounded_photo(photos[i], (width-26, height-26), 17)
                im.alpha_composite(photo, (x+13, y+13))
                c = max(circles, key=cv2.contourArea)
                (cx, cy), r = cv2.minEnclosingCircle(c)
                cx, cy, radius = round(cx+x), round(cy+y), int(np.ceil(r))+1
                box = (cx-radius, cy-radius, cx+radius+1, cy+radius+1)
                badge = rgb(frame).crop(box)
                bm = Image.new('L', badge.size)
                ImageDraw.Draw(bm).ellipse((0, 0, badge.width-1, badge.height-1), fill=255)
                badge.putalpha(bm)
                im.alpha_composite(badge, (box[0], box[1]))
            else:
                im.alpha_composite(rounded_photo(photos[i], (width-2, height-2)), (x+1, y+1))
        edits.append('nine Barcelona gallery tiles; native selected checkmarks retained')
    if 720 <= n < 1050:
        grey = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        for i, template in enumerate(templates):
            search = grey[75:896, (28 if i == 0 else 205):(194 if i == 0 else 371)]
            result = cv2.matchTemplate(search, cv2.cvtColor(template, cv2.COLOR_BGR2GRAY), cv2.TM_CCOEFF_NORMED)
            _, score, _, point = cv2.minMaxLoc(result)
            if score > .78:
                x = 28 if i == 0 else 205
                y = 75+point[1]-2
                # Match the native dimmed backdrop while its share modal is open.
                dim = .78 if n >= 885 else 1
                patch = rounded_photo(photos[3 if i == 0 else 2], (167, 125), 12, dim)
                visible = min(125, 896-y)
                if visible > 0:
                    im.alpha_composite(patch.crop((0, 0, 167, visible)), (x, y))
                    edits.append({'tripPhoto': i, 'y': y, 'score': round(score, 4)})
    if 885 <= n < 1050:
        # All native modal frames in this edit settle at this row. Track the
        # original orange contact so any source spring movement is retained.
        r, g, b = [frame[:, :, i].astype(int) for i in [2, 1, 0]]
        m = np.uint8((r > 185) & (g > 95) & (g < 210) & (b > 70) & (b < 190) & (r > g+25) & (r > b+30))*255
        m[:400] = 0
        m[:, :128] = 0
        m[:, 188:] = 0
        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = [c for c in contours if cv2.contourArea(c) > 250]
        if not contours:
            raise RuntimeError(f'Contact tracking failed at frame {n}')
        x, y, w, h = cv2.boundingRect(max(contours, key=cv2.contourArea))
        dy = round(y+h/2-645.5)
        # Erase only avatar/name content, preserving separators and native actions.
        im.paste((250, 250, 252, 255), (12, 602+dy, 445, 741+dy))
        draw = ImageDraw.Draw(im)
        for i, (avatar, (_, first, last)) in enumerate(zip(avatars, profiles)):
            cx = [71, 158, 244][i]
            im.alpha_composite(avatar, (cx-28, 618+dy))
            draw.text((cx, 686+dy), first, font=font, fill='#111111', anchor='mt')
            draw.text((cx, 705+dy), last, font=font, fill='#111111', anchor='mt')
            # Restore native service badges from this same frame.
            bx, by = [82, 168, 254][i], 657+dy
            badge = rgb(frame).crop((bx, by, bx+25, by+25))
            mask = Image.new('L', (25, 25))
            ImageDraw.Draw(mask).ellipse((0, 0, 24, 24), fill=255)
            badge.putalpha(mask)
            im.alpha_composite(badge, (bx, by))
        edits.append({'fictionalSharingContacts': [f'{f} {l}' for _, f, l in profiles], 'nativeRowOffset': dy})
    if edits:
        tracking.append({'originalFrame': n, 'originalSeconds': n/30, 'edits': edits})
    if n in [450, 465, 480, 509, 840, 870, 885, 900, 930, 1049]:
        im.convert('RGB').save(QA / f'revised-feed-{n:04d}.png')
    process.stdin.write(im.convert('RGB').tobytes())
process.stdin.close()
if process.wait() != 0:
    raise RuntimeError('Revised feed encoding failed')
cap.release()
(REV / 'screen-edit-tracking.json').write_text(json.dumps(tracking, indent=2)+'\n')
sources = [
    {'id':31244837,'photographer':'Anna Holodna','description':'Barcelona skyline and Sagrada Familia'},
    {'id':27550036,'photographer':'Jasinto Shabani','description':'Sagrada Familia exterior'},
    {'id':16841068,'photographer':'Gianluca Pugliese','description':'Park Guell panorama'},
    {'id':13426112,'photographer':'Mehmet Turgut Kirkgoz','description':'Barcelona from Park Guell'},
    {'id':16429021,'photographer':'AXP Photography','description':'Casa Batllo'},
    {'id':17070681,'photographer':'Eugenio Felix','description':'Park Guell mosaic tower'},
    {'id':14434675,'photographer':'Michael Giugliano','description':'Park Guell cityscape'},
    {'id':33455437,'photographer':'Dark Astraal','description':'Park Guell and Barcelona skyline'},
    {'id':34947043,'photographer':'Cristian Loayza','description':'Casa Batllo facade'},
]
for source in sources:
    source.update({'file':f'assets/barcelona-{source["id"]}.jpg','sourceUrl':f'https://www.pexels.com/photo/{source["id"]}/','licenseUrl':'https://www.pexels.com/license/'})
(REV / 'asset-sources.json').write_text(json.dumps({'cityPhotos':sources,'fictionalContacts':[{'name':f'{f} {l}','portraitSource':f'artifacts/ugc-product-fr/sharing-profiles/{i}.png','provider':'Higgsfield, cached generated portrait','fictional':True} for i,f,l in profiles]},indent=2)+'\n')
print(output)
