#!/usr/bin/env python3
"""Compare public Java PathMarks output to the accepted private CP2 design evidence."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home,run

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--java-home')
    parser.add_argument('--output',type=Path,default=ROOT/'evidence/conformance/path-marks-commands-java.json')
    args=parser.parse_args();home=java_home(args.java_home)
    build=ROOT/'.work/build/path-marks-commands-java';build.mkdir(parents=True,exist_ok=True)
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    sources += [ROOT/'packages/java/examples/PathMarks/PathMarkComposition.java',ROOT/'tests/native/PathMarksCommands.java']
    baseline=ROOT/'evidence/parameter-experiments/cp2-path-choice/result.json'
    inputs=sources+[baseline,ROOT/'design/capabilities/cp2-public-example.md',Path(__file__).resolve(),ROOT/'tools/run_grid_conformance.py']
    inputs+=sorted((ROOT/'catalog/operations').glob('*.json'))
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    bindings={str(p.relative_to(ROOT)):sha(p) for p in inputs}
    run([home/'bin/javac','--release','8','-d',build,*sources])
    actual=json.loads(run([home/'bin/java','-cp',build,'PathMarksCommands'],timeout=60).stdout)
    expected={a['case']:a['native']['hashes'] for a in json.loads(baseline.read_text())['attempts'] if a['status']=='rendered'}
    for case in ('trace','marks','long-marks'):
        if actual['movement_sha256']!=expected[case]['movement_sha256']: raise RuntimeError(case+': changed movement')
        for field in ('geometry_sha256','colour_sha256','commands'):
            if actual[case][field]!=expected[case]['command_count' if field=='commands' else field]: raise RuntimeError(case+': changed '+field)
    if actual['marks']['geometry_sha256']!=actual['recolour']['geometry_sha256']: raise RuntimeError('recolour changed geometry')
    if actual['marks']['colour_sha256']==actual['recolour']['colour_sha256']: raise RuntimeError('palette edit did not change colour')
    if actual['marks']['geometry_sha256']==actual['long-marks']['geometry_sha256']: raise RuntimeError('length edit did not change geometry')
    if bindings!={str(p.relative_to(ROOT)):sha(p) for p in inputs}: raise RuntimeError('inputs changed during execution')
    report={'status':'passed','scope':'public Java composition/command equivalence and pure edits; no native renderer/UI/Android or source-pixel claim',
            'runtime':run([home/'bin/java','-version']).stderr.strip(),'source_sha256':bindings,'result':actual}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'report':str(args.output),'scope':report['scope']}))

if __name__=='__main__':main()
