"""Compare the decoded final narration with its unchanged dry voice track."""
from pathlib import Path
import json
import sys
import numpy as np
from scipy.signal import correlate

root = Path(__file__).resolve().parents[1]
shorter = '--stock35' in sys.argv
directory = root / ('artifacts/countries-stock-en-35s' if shorter else 'artifacts/countries-stock-en' if '--stock' in sys.argv else 'artifacts/countries-reference-en' if '--reference' in sys.argv else 'artifacts/countries-kling4-en')
rate = 48000
expected_start = 33 if shorter else 37.25
dry = np.fromfile(directory / 'edit/voice.pcm', dtype='<i2').astype(float)
decoded = np.fromfile(directory / 'qa/decoded-audio.pcm', dtype='<i2').reshape(-1, 2).mean(axis=1)
window_start = expected_start - .15
window = decoded[round(window_start * rate):round((expected_start + len(dry) / rate + .15) * rate)]
reference = dry - dry.mean()
scores = correlate(window, reference, mode='valid', method='fft')
index = int(np.argmax(scores))
actual_start = window_start + index / rate
match = window[index:index + len(reference)]
correlation = float(np.corrcoef(reference, match)[0, 1])
drift = actual_start - expected_start
result = {
    'expectedStartSeconds': expected_start,
    'detectedStartSeconds': actual_start,
    'driftMilliseconds': drift * 1000,
    'waveformCorrelationWithDryNarration': correlation,
    'decodedAudioSeconds': len(decoded) / rate,
    'dryNarrationSeconds': len(dry) / rate,
    'method': 'FFT cross-correlation of dry speech against decoded final stereo mix, within ±150 ms of planned placement.',
    'passed': abs(drift) < .04 and correlation > .6,
    'lipSync': 'Not applicable: no speaking presenter in this montage.'
}
(directory / 'qa/narration-timing.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
if not result['passed']:
    raise SystemExit('Narration timing requires investigation.')
