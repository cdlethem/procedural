#!/usr/bin/env python3
"""Re-evaluate the preserved R1 capture after correcting the 640px PNG helper."""
import json
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from tools import run_relief_marks_pde as runner

def main():
    original = ROOT / 'evidence/reproductions/r1-p3d/result.json'
    failed = json.loads(original.read_text())
    if failed.get('error') != 'invalid PNG dimensions/alpha: baseline.png' or failed.get('exit_code') != 0:
        raise RuntimeError('Not the reviewed postprocessing-only failure')
    stderr = failed.get('stderr', '')
    if stderr and not runner.KNOWN_STDERR.fullmatch(stderr):
        raise RuntimeError('Unrecognized runtime stderr')
    for name, expected in failed['input_sha256'].items():
        path = ROOT / name
        if name == 'tools/run_relief_marks_pde.py':
            path = ROOT / '.work/diagnostics/r1/run-relief-before-png-fix.py'
        if runner.sha(path) != expected:
            raise RuntimeError('Captured source binding changed: ' + name)
    output = ROOT / '.work/reproductions/r1-relief-marks-root1'
    result = runner.validate_native(output)
    result.update(status='passed', scope=failed['scope'], visual_review='pending',
                  original_failed_result={'path':runner.rel(original),'sha256':runner.sha(original)},
                  correction='PNG dimensions960x960 and actual relief-marks.png save filename per staged PDE; no render repeated or tolerances changed',
                  input_sha256=failed['input_sha256'],
                  evaluator_sha256={runner.rel(Path(__file__)):runner.sha(Path(__file__)),
                                    'tools/run_relief_marks_pde.py':runner.sha(ROOT/'tools/run_relief_marks_pde.py')})
    target = ROOT / 'evidence/reproductions/r1-p3d/evaluated-result.json'
    if target.exists(): raise RuntimeError('Preserve prior evaluation')
    runner.write(target, result)
    print(json.dumps({'status':'passed','result':runner.rel(target)}))

if __name__ == '__main__': main()
