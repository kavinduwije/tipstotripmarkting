"""Track actual recorded app screens into Higgsfield phone plates; preserve hands and bezels."""
import argparse, json, subprocess
from pathlib import Path
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'artifacts/travel-buddy-en'
EDIT = DIR / 'edit'
parser = argparse.ArgumentParser()
parser.add_argument('mode', choices=['intro', 'hands', 'outro'])
parser.add_argument('--app-feed', type=Path, help='Use a separately documented revised native screen feed.')
parser.add_argument('--output', type=Path, help='Preserve the original composite by writing a separate revision.')
parser.add_argument('--segments-json', type=Path, help='Reviewed motion takes and frame-aligned source trims.')
args = parser.parse_args()

def green_mask(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([35, 85, 65]), np.array([90, 255, 255]))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
    if count < 2:
        raise RuntimeError('Phone green region missing')
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    mask = np.uint8(labels == largest) * 255
    if stats[largest, cv2.CC_STAT_AREA] < 4000:
        raise RuntimeError('Phone green region too small')
    # Fill tiny generated lettering; retain the camera island and real finger occlusion.
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is not None:
        for i, contour in enumerate(contours):
            if hierarchy[0, i, 3] >= 0 and cv2.contourArea(contour) < 110:
                cv2.drawContours(mask, [contour], -1, 255, -1)
    return mask

def quad_from_mask(mask):
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull = cv2.convexHull(max(contours, key=cv2.contourArea))
    quad = cv2.approxPolyN(hull, 4, epsilon_percentage=-1, ensure_convex=True).reshape(4, 2).astype(np.float32)
    s = quad.sum(axis=1)
    d = quad[:, 0] - quad[:, 1]
    return np.array([quad[np.argmin(s)], quad[np.argmax(d)], quad[np.argmax(s)], quad[np.argmin(d)]], dtype=np.float32)

def load_track(name):
    file = DIR / f'{name}.mp4'
    target = EDIT / f'{name}.tracking.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return np.array(json.loads(target.read_text())['quads'], dtype=np.float32)
    cap = cv2.VideoCapture(str(file))
    quads, areas = [], []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if frame.shape[:2] != (1280, 720):
            frame = cv2.resize(frame, (720, 1280))
        mask = green_mask(frame)
        quads.append(quad_from_mask(mask))
        areas.append(int(np.count_nonzero(mask)))
    cap.release()
    if not quads:
        raise RuntimeError('No plate frames decoded')
    raw = np.array(quads)
    # Centred median removes subpixel detection noise without delaying motion.
    filtered = np.array([np.median(raw[max(0, i-2):min(len(raw), i+3)], axis=0) for i in range(len(raw))])
    target.write_text(json.dumps({'source': str(file), 'fps': 30, 'frames': len(raw), 'quads': filtered.tolist(), 'greenAreaRange': [min(areas), max(areas)], 'method': 'Largest chroma region; enclosing four-sided hull, centred 5-frame median. Only keyed screen pixels replaced, preserving camera island, bezel and fingers.'}, indent=2))
    return filtered

def replace(frame, app, quad):
    mask = green_mask(frame)
    h, w = app.shape[:2]
    transform = cv2.getPerspectiveTransform(np.float32([[0, 0], [w-1, 0], [w-1, h-1], [0, h-1]]), quad)
    warped = cv2.warpPerspective(app, transform, (720, 1280), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    # Cover the 1-pixel green fringe; protect skin and the black camera island.
    alpha = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
    alpha = cv2.GaussianBlur(alpha, (3, 3), .6).astype(np.float32)[:, :, None] / 255
    return np.clip(frame * (1-alpha) + warped * alpha, 0, 255).astype(np.uint8)

if args.mode == 'intro':
    segments = [('brunette-performance', 0, 210)]
    app_file, app_start = EDIT / 'intro-screen-feed-positive.mp4', 0
elif args.mode == 'hands':
    segments = [('hands-performance', 0, 90), ('hands-steady-performance', 150, 210), ('hands-steady-performance', 210, 210), ('hands-steady-performance', 150, 210), ('hands-steady-performance', 300, 120), ('hands-steady-performance', 180, 210), ('hands-steady-performance', 150, 270)]
    app_file, app_start = EDIT / 'app-screen-feed.mp4', 210
else:
    selection = json.loads((DIR / 'performance-selection.json').read_text())
    segments = [('blonde-native-performance', selection['outro']['startTrimFrames'], 210)]
    app_file, app_start = EDIT / 'intro-screen-feed-positive.mp4', 0

frame_maps = []
if args.segments_json:
    selection = json.loads(args.segments_json.read_text())
    segments = [(s['name'], s['frameMap'][0], len(s['frameMap'])) for s in selection['segments']]
    frame_maps = [s['frameMap'] for s in selection['segments']]
tracks = {name: load_track(name) for name, _, _ in segments}
if args.app_feed:
    app_file = args.app_feed
app_cap = cv2.VideoCapture(str(app_file))
app_cap.set(cv2.CAP_PROP_POS_FRAMES, app_start)
output = args.output or EDIT / f'{args.mode}-screen-composited.mp4'
output.parent.mkdir(parents=True, exist_ok=True)
command = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', '720x1280', '-r', '30', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', str(output)]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
total = 0
for segment_number, (name, start, count) in enumerate(segments):
    cap = cv2.VideoCapture(str(DIR / f'{name}.mp4'))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    previous_index = start-1
    previous_frame = None
    for i in range(count):
        index = frame_maps[segment_number][i] if frame_maps else start+i
        if index == previous_index:
            ok, frame = True, previous_frame.copy()
        else:
            if index != previous_index+1:
                cap.set(cv2.CAP_PROP_POS_FRAMES, index)
            ok, frame = cap.read()
        if not ok:
            raise RuntimeError(f'Plate ended early: {name} frame {index}')
        previous_index, previous_frame = index, frame.copy()
        if frame.shape[:2] != (1280, 720):
            frame = cv2.resize(frame, (720, 1280))
        ok, app = app_cap.read()
        if not ok:
            app_cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, app = app_cap.read()
        if not ok:
            raise RuntimeError('App recording ended early')
        if args.mode == 'hands' and total < 90:
            app = cv2.imread(str(EDIT / 'promo' / f'{total:03d}.png'))
        else:
            # Fit the real UI below the physical camera island without covering its title.
            app = cv2.copyMakeBorder(app, 40, 0, 0, 0, cv2.BORDER_CONSTANT, value=(246, 249, 248))
        process.stdin.write(replace(frame, app, tracks[name][index]).tobytes())
        total += 1
    cap.release()
    print(f'{args.mode}: composited {total} frames', flush=True)
process.stdin.close()
if process.wait() != 0:
    raise RuntimeError('Composited video encoding failed')
app_cap.release()
print(output, flush=True)
