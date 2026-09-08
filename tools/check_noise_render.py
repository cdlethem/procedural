#!/usr/bin/env python3
"""Measure the registered public-core JAVA2D probe; does not render or certify corpus coverage."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parents[1]
PLAN=ROOT/'evidence/reproductions/gradient-noise-java2d/plan.json'
plan=json.loads(PLAN.read_text())
reference=ROOT/plan['reference'];candidate=ROOT/plan['candidate']
with Image.open(reference) as f: expected=f.convert('RGBA')
with Image.open(candidate) as f: actual=f.convert('RGBA')
assert expected.size==actual.size==(640,640), 'dimensions differ'
diff=ImageChops.difference(expected,actual)
# Inspect all channels; RGBA getbbox's default alpha-only behavior is insufficient.
assert all(not any(channel.histogram()[1:]) for channel in diff.split()), 'pixels differ'
paths=[PLAN,reference,candidate,ROOT/'tests/native/NoisePublicRenderProbe.java',
       ROOT/'packages/java/src/main/java/org/procedurals/fields/GradientNoise2D01.java',
       ROOT/'packages/java/src/main/java/org/procedurals/layout/RegularGrid.java',
       ROOT/'dist/procedurals-core-0.1.0.jar',ROOT/'.work/toolchains/processing-4.5.6/core-4.5.6.jar',Path(__file__).resolve()]
report={'scope':plan['scope'],'exact_rgba_pixels':True,'dimensions':list(actual.size),
        'sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
(ROOT/'evidence/reproductions/gradient-noise-java2d/result.json').write_text(json.dumps(report,indent=2)+'\n')
print('Public grid/noise JAVA2D probe exactly matches all pixels of the registered candidate design.')
