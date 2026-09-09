#!/usr/bin/env python3
"""Compare private Java clipping study to root's independent rational cases."""
import hashlib
import json
import math
from pathlib import Path
import subprocess
from fractions import Fraction

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / '.work/vector-clipping-study'
JDK = ROOT / '.work/toolchains/jdk-17.0.20.1+1/bin'
JAVA = ROOT / 'tools/diagnostics/clipping/SegmentClipStudy.java'


def main():
    subprocess.run(['python3', str(Path(__file__).with_name('exact_clip_study.py'))], cwd=ROOT, check=True)
    cases = json.loads((OUT / 'exact.json').read_text())['cases']
    calls, expectations = [], []
    for case in cases:
        for mode in ('original', 'winding', 'direction'):
            polygon = case['polygon'][::-1] if mode == 'winding' else case['polygon']
            segment = case['segment'][::-1] if mode == 'direction' else case['segment']
            intervals = [[Fraction(x) for x in pair] for pair in case['intervals']]
            if mode == 'direction':
                intervals = [[1-hi, 1-lo] for lo, hi in reversed(intervals)]
            points = ','.join('new SegmentClipStudy.Point(%sd,%sd)' % tuple(p) for p in polygon)
            coords = ','.join(str(v)+'d' for p in segment for v in p)
            calls.append('emit(new SegmentClipStudy.Point[]{'+points+'},new SegmentClipStudy.Segment('+coords+'));')
            expectations.append((case['id']+'/'+mode, intervals))
    source = '''public class CompareClipStudy {
static void emit(SegmentClipStudy.Point[] polygon, SegmentClipStudy.Segment segment) {
java.util.List<SegmentClipStudy.RetainedInterval> values = SegmentClipStudy.clip(polygon,new SegmentClipStudy.Segment[]{segment});
StringBuilder s=new StringBuilder("[");
for(int i=0;i<values.size();i++){if(i>0)s.append(','); SegmentClipStudy.RetainedInterval v=values.get(i);
s.append('[').append(v.sourceIndex).append(',').append(v.t0).append(',').append(v.t1).append(']');}
System.out.println(s.append(']'));
}
public static void main(String[] args){''' + '\n'.join(calls) + '}}\n'
    probe = OUT / 'CompareClipStudy.java'
    probe.write_text(source)
    classes = OUT / 'comparison-classes'
    classes.mkdir(exist_ok=True)
    before = hashlib.sha256(JAVA.read_bytes()).hexdigest()
    compile_cmd = [str(JDK/'javac'), '--release', '8', '-d', str(classes), str(JAVA), str(probe)]
    subprocess.run(compile_cmd, check=True)
    run = subprocess.run([str(JDK/'java'), '-cp', str(classes), 'CompareClipStudy'], capture_output=True, text=True, check=True)
    actuals = [json.loads(line) for line in run.stdout.splitlines()]
    assert len(actuals) == len(expectations)
    for (name, expected), actual in zip(expectations, actuals):
        assert len(expected) == len(actual), (name, expected, actual)
        for (lo, hi), (index, a, b) in zip(expected, actual):
            assert index == 0, name
            for exact, value in ((lo,a),(hi,b)):
                # Study comparison only; does not define a public numeric tolerance.
                assert math.isfinite(value) and abs(float(exact)-value) <= 4*math.ulp(float(exact)), (name,exact,value)
    assert before == hashlib.sha256(JAVA.read_bytes()).hexdigest(), 'source changed during comparison'
    report = dict(status='passed-private-comparison', cases=len(expectations), java_sha256=before,
                  probe_sha256=hashlib.sha256(probe.read_bytes()).hexdigest(),
                  oracle_result_sha256=hashlib.sha256((OUT/'exact.json').read_bytes()).hexdigest(),
                  compile_command=compile_cmd, limitations=['Moderate hand-known cases only.',
                  'Four-ULP diagnostic comparison is not a public numeric contract.',
                  'Polygon validity and near-degenerate robustness remain unproven.'])
    (OUT/'java-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
    print(f'{len(expectations)} exact-oracle Java comparisons passed')


if __name__ == '__main__':
    main()
