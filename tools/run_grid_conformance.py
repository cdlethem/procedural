#!/usr/bin/env python3
"""Build and run native regular-grid cores from the shared contract fixtures.

This verifies Java/JavaScript/Python calculations, not Processing/p5/py5/Android adapters.
"""
from __future__ import annotations
import math
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'fixtures/operations/regular-grid.json'


def java_value(value):
    if value is None: return 'null'
    if value is True: return 'Boolean.TRUE'
    if value is False: return 'Boolean.FALSE'
    if isinstance(value, str): return json.dumps(value)
    if isinstance(value, (int, float)): return f'Double.valueOf({json.dumps(str(value))})'
    if isinstance(value, list): return 'list(' + ','.join(java_value(v) for v in value) + ')'
    if isinstance(value, dict): return 'map(' + ','.join(java_value(x) for kv in value.items() for x in kv) + ')'
    raise TypeError(value)


def run(cmd, **kwargs):
    try:
        return subprocess.run([str(x) for x in cmd], check=True, capture_output=True, text=True, cwd=ROOT, **kwargs)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"Native command failed: {cmd[0]}\n{exc.stdout}\n{exc.stderr}") from exc


def assert_positive_zeros(value):
    if isinstance(value, dict):
        for item in value.values(): assert_positive_zeros(item)
    elif isinstance(value, list):
        for item in value: assert_positive_zeros(item)
    elif isinstance(value, float) and value == 0:
        assert math.copysign(1.0, value) == 1.0, 'noncanonical negative zero'


def java_home(explicit=None):
    if explicit: return Path(explicit)
    if os.environ.get('JAVA_HOME'): return Path(os.environ['JAVA_HOME'])
    if shutil.which('javac'): return Path(shutil.which('javac')).resolve().parents[1]
    homes = sorted((ROOT / '.work/toolchains').glob('jdk-17*'))
    if len(homes) == 1: return homes[0]
    raise RuntimeError('Pass --java-home or set JAVA_HOME to a JDK; no unique repository-local JDK found.')


def run_java(home):
    fixture = json.loads(FIXTURES.read_text())
    build = ROOT / '.work/build/grid-java'
    # This dedicated generated directory belongs only to this runner. Never package
    # a deleted/renamed class left by an earlier compilation.
    if build.exists():
        shutil.rmtree(build)
    build.mkdir(parents=True, exist_ok=True)
    template = (ROOT / 'tests/native/GridNative.java.in').read_text()
    calls = []
    for case in fixture['cases']:
        indices = 'new Object[]{' + ','.join(java_value(i) for i in case.get('indices', [])) + '}'
        calls.append(f'caseRun({java_value(case["id"])}, {java_value(case["input"])}, {indices});')
    for case in fixture['access_cases']:
        calls.append(f'accessRun({java_value(case["id"])}, {java_value(case["index"])});')
    source = build / 'GridNative.java'
    source.write_text(template.replace('/* SHARED_FIXTURE_CALLS */', '\n'.join(calls)))
    core_sources = sorted((ROOT / 'packages/java/src/main/java').rglob('*.java'))
    run([home/'bin/javac', '--release', '8', '-d', build, *core_sources, source])
    result = json.loads(run([home/'bin/java', '-cp', build, 'GridNative']).stdout)
    actual = {r['id']: r for r in result['cases']}
    for expected in fixture['cases']:
        got = actual[expected['id']]
        if 'error' in expected:
            assert got.get('error') == expected['error'], (expected['id'], got)
        else:
            assert 'error' not in got, got
            assert got['size'] == expected['size'] and got['points'] == expected['points'], (expected['id'],got)
            assert got['serialized'] == expected['input'], (expected['id'], 'serialization',got)
            assert_positive_zeros(got['points'])
            assert_positive_zeros(got['serialized'])
    access = {r['id']:r for r in result['access']}
    for expected in fixture['access_cases']:
        assert access[expected['id']]['error'] == expected['error'], expected
    assert result['native_checks_passed'], result
    jar_dir = ROOT / 'dist'
    jar_dir.mkdir(exist_ok=True)
    jar = jar_dir / 'procedurals-core-0.1.0.jar'
    run([home/'bin/jar', 'cf', jar, '-C', build, 'org'])
    result.update(runtime=run([home/'bin/java','-version']).stderr.strip(), artifact=str(jar.relative_to(ROOT)),
                  artifact_sha256=hashlib.sha256(jar.read_bytes()).hexdigest())
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--java-home')
    p.add_argument('--target',choices=['java','javascript','python','all'],default='all')
    p.add_argument('--output',type=Path,default=ROOT/'.work/conformance/regular-grid.json')
    args=p.parse_args()
    results={}
    if args.target in {'java','all'}: results['java']=run_java(java_home(args.java_home))
    if args.target in {'javascript','all'}:
        results['javascript']=json.loads(run(['node', ROOT/'tests/native/grid-javascript.mjs']).stdout)
    if args.target in {'python','all'}:
        results['python']=json.loads(run([sys.executable, ROOT/'tests/native/grid-python.py', '--benchmark']).stdout)
    for target, result in results.items():
        if result.get('failures'):
            raise RuntimeError(f'{target}: native runner reports failures')
    sources = sorted((ROOT/'packages/java/src').rglob('*.java')) + sorted((ROOT/'packages/javascript/src').rglob('*.js')) + sorted((ROOT/'packages/python/procedurals').rglob('*.py'))
    sources += [ROOT/'tests/native/GridNative.java.in', ROOT/'tests/native/grid-javascript.mjs', ROOT/'tests/native/grid-python.py', Path(__file__).resolve()]
    source_hashes = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
    contract=ROOT/'catalog/operations/regular-grid.json'
    report={'operation':'layout.regular-grid','version':'0.1.0','scope':'native portable cores only; no renderer/Android validation',
            'contract_sha256':hashlib.sha256(contract.read_bytes()).hexdigest(),
            'fixture_sha256':hashlib.sha256(FIXTURES.read_bytes()).hexdigest(),'source_sha256':source_hashes,'results':results}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':list(results),'report':str(args.output),'scope':report['scope']}))


if __name__=='__main__': main()
