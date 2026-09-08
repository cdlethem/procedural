#!/usr/bin/env python3
"""Explain observed horizontal runs in the completed CP2 finer-field design image."""
import hashlib
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'packages/python'))
from procedurals.fields import gradient_noise_2d_01

field = gradient_noise_2d_01({'seed': 42})
rows = []
for row in range(4):
    for column in range(6):
        start = [60 + column * 104.0, 80 + row * 160.0]
        x, y = start
        longest = run = 0
        witness = None
        for index in range(2000):
            heading = -20.0 + 40.0 * field.sample(x * 0.01, y * 0.01)
            dx = 0.4 * math.cos(heading)
            dy = 0.4 * math.sin(heading)
            run = run + 1 if abs(dy) < 1e-10 else 0
            if run > longest:
                longest = run
                witness = {'index': index, 'position': [x, y], 'heading': heading}
            x = x + dx
            y = y + dy
        rows.append({'path': row * 6 + column, 'start': start,
                     'longest_near_horizontal_run_steps': longest,
                     'end_of_longest_run': witness, 'endpoint': [x, y]})
inputs = [Path(__file__).resolve(), ROOT / 'packages/python/procedurals/fields.py',
          ROOT / 'evidence/parameter-experiments/cp2-path-choice/experiment.json',
          ROOT / 'evidence/parameter-experiments/cp2-path-choice/result.json']
report = {'status': 'completed_diagnostic',
          'scope': 'Post-render Python mechanism inspection of the predeclared finer-field case; no new render, portable tolerance or artistic parameter recommendation.',
          'criterion': 'abs(per-step dy)<1e-10; descriptive classification only',
          'input_sha256': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs},
          'paths': rows}
output = ROOT / 'evidence/investigations/cp2-field-alignment.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'status': report['status'], 'paths_with_over_100_near_horizontal_steps': sum(r['longest_near_horizontal_run_steps'] > 100 for r in rows)}))
