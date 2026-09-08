"""Measure the four registered candidate images; does not render or judge appearance."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
CONFIG = HERE / 'experiment.json'
config = json.loads(CONFIG.read_text())
images = {}
results = []
for case in config['values']:
    path = ROOT / '.work/experiments/cp1-noise-choice' / (case['id']+'.png')
    with Image.open(path) as source:
        image = source.convert('RGB')
    if image.size != (640, 640):
        raise ValueError(f'{case["id"]}: wrong dimensions')
    images[case['id']] = image
    results.append({'id':case['id'],'path':str(path.relative_to(ROOT)),
                    'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'dimensions':list(image.size)})
comparisons = []
for a,b in [('single','four'),('single-rotated','four-rotated'),('single','single-rotated'),('four','four-rotated')]:
    diff = ImageChops.difference(images[a], images[b])
    red, green, blue = diff.split()
    changed = 1 - ImageChops.lighter(ImageChops.lighter(red, green), blue).histogram()[0] / (640*640)
    comparisons.append({'a':a,'b':b,'rgb_mae_0_1':sum(ImageStat.Stat(diff).mean)/(3*255),
                        'changed_pixel_fraction':changed})
report = {'scope':'candidate-design experiment; no corpus baseline or conformance claim',
          'configuration_sha256':hashlib.sha256(CONFIG.read_bytes()).hexdigest(),
          'implementation_sha256':hashlib.sha256((HERE/'NoiseChoiceProbe.java').read_bytes()).hexdigest(),
          'measurement_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'images':results,'comparisons':comparisons}
(HERE/'measurements.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(comparisons,indent=2))
