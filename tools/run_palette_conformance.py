#!/usr/bin/env python3
"""Execute native cyclic-palette cores; renderer/host integration is not covered."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home, java_value, run, assert_positive_zeros
CONTRACT=ROOT/'catalog/operations/cyclic-palette.json'


def run_java(home, fixture):
    build=ROOT/'.work/build/palette-java'
    if build.exists(): shutil.rmtree(build)
    core=build/'core';test=build/'tests';core.mkdir(parents=True);test.mkdir()
    calls=[]
    for c in fixture['cases']:
        points='new Object[]{'+','.join(java_value(q['input']) for q in c.get('queries',[]))+'}'
        calls.append(f'caseRun({java_value(c["id"])},{java_value(c["input"])},{points});')
    for q in fixture['query_cases']:
        value=q['input']
        # A JSON integer beyond binary64 becomes a nonfinite native query value.
        # This still exercises core validation; no synthetic error is emitted.
        if isinstance(value,int) and abs(value)>float.fromhex('0x1.fffffffffffffp+1023'):
            expression='Double.POSITIVE_INFINITY' if value>0 else 'Double.NEGATIVE_INFINITY'
        else:expression=java_value(value)
        calls.append(f'queryRun({java_value(q["id"])},{expression});')
    source=test/'PaletteNative.java'
    source.write_text((ROOT/'tests/native/PaletteNative.java.in').read_text().replace('/* SHARED_FIXTURE_CALLS */','\n'.join(calls)))
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    run([home/'bin/javac','--release','8','-d',core,*sources])
    run([home/'bin/javac','--release','8','-cp',core,'-d',test,source])
    result=json.loads(run([home/'bin/java','-cp',f'{core}:{test}','org.procedurals.color.PaletteNative']).stdout)
    actual={c['id']:c for c in result['cases']}
    for expected in fixture['cases']:
        got=actual[expected['id']]
        if 'error' in expected:assert got.get('error')==expected['error'],got
        else:
            assert got['serialized']==expected['serialized'],got
            assert got['outputs']==[q['output'] for q in expected['queries']],got
            assert_positive_zeros(got)
    queries={c['id']:c for c in result['query_cases']}
    for expected in fixture['query_cases']:assert queries[expected['id']]['error']==expected['error'],expected
    assert result['native_checks_passed']
    jar=ROOT/'dist/procedurals-core-0.1.0.jar';jar.parent.mkdir(exist_ok=True)
    run([home/'bin/jar','cf',jar,'-C',core,'org'])
    result.update(runtime=run([home/'bin/java','-version']).stderr.strip(),
                  artifact=str(jar.relative_to(ROOT)),artifact_sha256=hashlib.sha256(jar.read_bytes()).hexdigest())
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',choices=['all','java','javascript','python'],default='all')
    parser.add_argument('--java-home');parser.add_argument('--output',type=Path,default=ROOT/'.work/conformance/cyclic-palette.json')
    args=parser.parse_args();contract=json.loads(CONTRACT.read_text());fixture_path=ROOT/contract['fixtures'];fixture=json.loads(fixture_path.read_text())
    results={}
    if args.target in {'all','java'}:results['java']=run_java(java_home(args.java_home),fixture)
    if args.target in {'all','javascript'}:results['javascript']=json.loads(run(['node',ROOT/'tests/native/palette-javascript.mjs']).stdout)
    if args.target in {'all','python'}:results['python']=json.loads(run([sys.executable,ROOT/'tests/native/palette-python.py']).stdout)
    for target,result in results.items():
        if result.get('failures'):raise RuntimeError(f'{target}: native failures')
        # Independently recomputed with the Fraction oracle for all 250,000 queries.
        if result['benchmark']['checksum'] != 1947414708739:
            raise RuntimeError(f'{target}: incorrect palette benchmark checksum')
    checksums={r['benchmark']['checksum'] for r in results.values()}
    if len(checksums)!=1:raise RuntimeError(f'Palette benchmark checksum mismatch: {checksums}')
    sources=sorted((ROOT/'packages/java/src').rglob('*.java'))+sorted((ROOT/'packages/javascript/src').rglob('*.js'))+sorted((ROOT/'packages/python/procedurals').rglob('*.py'))
    sources += [ROOT/'tests/native/PaletteNative.java.in',ROOT/'tests/native/palette-javascript.mjs',ROOT/'tests/native/palette-python.py',Path(__file__).resolve(),ROOT/'tools/run_grid_conformance.py']
    report={'operation':contract['id'],'version':contract['version'],'scope':'portable native cores only; no Processing/p5/py5/Android host or reproduction claim',
            'contract_sha256':hashlib.sha256(CONTRACT.read_bytes()).hexdigest(),'fixture_sha256':hashlib.sha256(fixture_path.read_bytes()).hexdigest(),
            'source_sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources if p.exists()},'results':results}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':list(results),'report':str(args.output),'scope':report['scope']}))

if __name__=='__main__':main()
