#!/usr/bin/env python3
"""Run frozen separable-blur vectors and focused Java core checks."""
from __future__ import annotations
import argparse, hashlib, json, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / 'packages/java/src/main/java/org/procedurals/raster/SeparableBlur2D.java'
NATIVE = ROOT / 'tests/native/SeparableBlurNative.java'
CATALOG = ROOT / 'catalog/operations/separable-blur-2d.json'
FIXTURE = ROOT / 'fixtures/operations/separable-blur-2d.json'

def digest(path: Path) -> str: return hashlib.sha256(path.read_bytes()).hexdigest()
def carrier(value: object) -> str:
    if value is None: return 'null'
    if isinstance(value, bool): return 'Boolean.' + str(value).upper()
    if isinstance(value, (int, float)): return 'Double.valueOf(' + json.dumps(str(value)) + ')'
    if isinstance(value, str): return json.dumps(value)
    if isinstance(value, list): return 'list(' + ','.join(carrier(v) for v in value) + ')'
    if isinstance(value, dict): return 'map(' + ','.join(x for k, v in value.items() for x in (json.dumps(k), carrier(v))) + ')'
    raise TypeError('unsupported fixture carrier: ' + repr(value))
def typed(case: dict) -> str:
    value = case['input']; source = value['source']
    pixels = ','.join('(int)' + str(pixel) + 'L' for pixel in source['pixels'])
    x = ','.join(str(v) for v in value['kernelX']); y = ','.join(str(v) for v in value['kernelY'])
    return 'SeparableBlur2D.blur(%s,%s,new int[]{%s},new double[]{%s},new double[]{%s},%sL)' % (source['width'], source['height'], pixels, x, y, value['maxSamples'])
def vector_source(fixture: dict) -> str:
    cases, calls = [], []
    for index, case in enumerate(fixture['cases']):
        invoke = 'SeparableBlur2D.blur(' + carrier(case['input']) + ')'
        if 'output' in case:
            body = 'exact(%s,%s.toValues(),%s);exact(%s,%s.toValues(),%s);' % (carrier(case['output']), invoke, json.dumps(case['id'] + ' object'), carrier(case['output']), typed(case), json.dumps(case['id'] + ' typed'))
        else:
            body = 'expect(new Action(){public void run(){%s;}},%s,%s);' % (invoke, json.dumps(case['error']), json.dumps(case['id']))
        cases.append('static void c%d(){%s}' % (index, body)); calls.append('c%d();' % index)
    return '''package org.procedurals.raster; import java.util.*; public final class SeparableBlurVectors {
static int assertions; interface Action { void run(); }
static List<Object> list(Object... values){return new ArrayList<Object>(Arrays.asList(values));}
static Map<String,Object> map(Object... values){Map<String,Object> out=new LinkedHashMap<String,Object>();for(int i=0;i<values.length;i+=2)out.put((String)values[i],values[i+1]);return out;}
static void ok(boolean value,String message){assertions++;if(!value)throw new AssertionError(message);}
static void exact(Object expected,Object actual,String message){if(expected instanceof Number){ok(actual instanceof Number&&Double.doubleToRawLongBits(((Number)expected).doubleValue())==Double.doubleToRawLongBits(((Number)actual).doubleValue()),message);return;}if(expected instanceof List){List<?>a=(List<?>)expected,b=(List<?>)actual;ok(a.size()==b.size(),message);for(int i=0;i<a.size();i++)exact(a.get(i),b.get(i),message);return;}if(expected instanceof Map){Map<?,?>a=(Map<?,?>)expected,b=(Map<?,?>)actual;ok(a.keySet().equals(b.keySet()),message);for(Object k:a.keySet())exact(a.get(k),b.get(k),message);return;}ok(expected.equals(actual),message);}
static void expect(Action action,String code,String message){try{action.run();throw new AssertionError(message+" missing error");}catch(SeparableBlur2D.SeparableBlurException error){ok(code.equals(error.code),message);}}
%s public static void main(String[] args){%s System.out.println("{\\"status\\":\\"passed\\",\\"cases\\":%d,\\"assertions\\":"+assertions+"}");}}
''' % (' '.join(cases), ' '.join(calls), len(fixture['cases']))
def run(command: list[str]) -> subprocess.CompletedProcess[str]: return subprocess.run(command, cwd=ROOT, text=True, capture_output=True, check=True, timeout=120)
def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument('--java-home', type=Path, default=ROOT/'.work/toolchains/jdk-17.0.20.1+1'); parser.add_argument('--output', type=Path, default=ROOT/'.work/conformance/separable-blur-java.json'); args = parser.parse_args()
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get('catalog_sha256') != digest(CATALOG): raise RuntimeError('fixture/catalog binding mismatch')
    java, javac = args.java_home/'bin/java', args.java_home/'bin/javac'
    bound = [CATALOG, FIXTURE, CORE, NATIVE, Path(__file__), java, javac, args.java_home/'release', args.java_home/'lib/modules']
    before = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    build_root = ROOT/'.work/build'; build_root.mkdir(parents=True, exist_ok=True); build = Path(tempfile.mkdtemp(prefix='separable-blur-', dir=build_root)); vectors = build/'SeparableBlurVectors.java'; vectors.write_text(vector_source(fixture))
    run([str(javac), '--release', '8', '-d', str(build), str(CORE), str(NATIVE), str(vectors)])
    vector_result = json.loads(run([str(java), '-cp', str(build), 'org.procedurals.raster.SeparableBlurVectors']).stdout)
    native_result = json.loads(run([str(java), '-cp', str(build), 'org.procedurals.raster.SeparableBlurNative']).stdout)
    after = {str(path.relative_to(ROOT)): digest(path) for path in bound}
    if before != after: raise RuntimeError('bound input changed during check')
    report = {'status':'passed','operation':'raster.separable-blur-2d','fixture_cases':len(fixture['cases']),'valid_cases_both_entrypoints':sum('output' in case for case in fixture['cases']),'vectors':vector_result,'native':native_result,'source_sha256_before':before,'source_sha256_after':after,'javac_release':'8','runtime':run([str(java), '-version']).stderr.strip(),'scope':'Java core exact vectors and focused ownership/carrier/index checks; no renderer or support claim.'}
    args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(report, indent=2)+'\n'); print(json.dumps({'status':'passed','report':str(args.output)}))
if __name__ == '__main__': main()
