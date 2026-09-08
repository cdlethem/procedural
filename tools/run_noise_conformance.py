#!/usr/bin/env python3
"""Execute native gradient-noise cores; renderer/host integration is not covered."""
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
CONTRACT=ROOT/'catalog/operations/gradient-noise-2d-01.json'


def run_java(home, fixture):
    build=ROOT/'.work/build/noise-java'
    if build.exists(): shutil.rmtree(build)
    core=build/'core';test=build/'tests';core.mkdir(parents=True);test.mkdir()
    calls=[]
    for c in fixture['cases']:
        points='new Object[]{'+','.join(java_value(q['input']) for q in c.get('queries',[]))+'}'
        calls.append(f'caseRun({java_value(c["id"])},{java_value(c["input"])},{points});')
    for q in fixture['query_cases']:calls.append(f'queryRun({java_value(q["id"])},{java_value(q["input"])});')
    for v in fixture['mix_vectors']:calls.append(f'check((GradientNoise2D01.mix((int){v["input"]}L)&0xffffffffL)=={v["output"]}L);')
    for v in fixture['corner_vectors']:calls.append(f'check((GradientNoise2D01.corner((int){v["seed"]}L,{v["i"]}L,{v["j"]}L)&0xffffffffL)=={v["output"]}L);')
    source=test/'NoiseNative.java'
    source.write_text((ROOT/'tests/native/NoiseNative.java.in').read_text().replace('/* SHARED_FIXTURE_CALLS */','\n'.join(calls)))
    sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
    run([home/'bin/javac','--release','8','-d',core,*sources])
    run([home/'bin/javac','--release','8','-cp',core,'-d',test,source])
    result=json.loads(run([home/'bin/java','-cp',f'{core}:{test}','org.procedurals.fields.NoiseNative']).stdout)
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
                  mix_vectors=len(fixture['mix_vectors']),corner_vectors=len(fixture['corner_vectors']),
                  artifact=str(jar.relative_to(ROOT)),artifact_sha256=hashlib.sha256(jar.read_bytes()).hexdigest())
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target',choices=['all','java','javascript','python'],default='all')
    parser.add_argument('--java-home');parser.add_argument('--output',type=Path,default=ROOT/'.work/conformance/gradient-noise-2d-01.json')
    args=parser.parse_args();contract=json.loads(CONTRACT.read_text());fixture_path=ROOT/contract['fixtures'];fixture=json.loads(fixture_path.read_text())
    results={}
    if args.target in {'all','java'}:results['java']=run_java(java_home(args.java_home),fixture)
    if args.target in {'all','javascript'}:results['javascript']=json.loads(run(['node',ROOT/'tests/native/noise-javascript.mjs']).stdout)
    if args.target in {'all','python'}:results['python']=json.loads(run([sys.executable,ROOT/'tests/native/noise-python.py','--benchmark']).stdout)
    for target,result in results.items():
        if result.get('failures'):raise RuntimeError(f'{target}: native failures')
        assert result['benchmark']['checksum']==123399.9596239042, (target,'benchmark checksum')
    sources=sorted((ROOT/'packages/java/src').rglob('*.java'))+sorted((ROOT/'packages/javascript/src').rglob('*.js'))+sorted((ROOT/'packages/python/procedurals').rglob('*.py'))
    sources += [ROOT/'tests/native/NoiseNative.java.in',ROOT/'tests/native/noise-javascript.mjs',ROOT/'tests/native/noise-python.py',Path(__file__).resolve(),ROOT/'tools/run_grid_conformance.py']
    report={'operation':contract['id'],'version':contract['version'],'scope':'portable native cores only; no Processing/p5/py5/Android host or reproduction claim',
            'contract_sha256':hashlib.sha256(CONTRACT.read_bytes()).hexdigest(),'fixture_sha256':hashlib.sha256(fixture_path.read_bytes()).hexdigest(),
            'source_sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources if p.exists()},'results':results}
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':list(results),'report':str(args.output),'scope':report['scope']}))

if __name__=='__main__':main()
