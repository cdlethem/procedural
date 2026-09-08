#!/usr/bin/env python3
"""Compile and run frozen Java branch-tree conformance without a renderer."""
from __future__ import annotations
import argparse, hashlib, json, shutil, struct, subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'catalog/operations/seeded-endpoint-branches.json'
FIXTURE = ROOT / 'fixtures/operations/seeded-endpoint-branches.json'
CORE = ROOT / 'packages/java/src/main/java/org/procedurals/topology/BranchTree2D.java'
NATIVE = ROOT / 'tests/native/BranchTreeNative.java'
REVIEW = ROOT / 'design/operations/branch-tree-contract-review.md'
FROZEN_CATALOG = '38984f84dfcf5837386e0d830c8bf1f5554b04adcc6e36187c8a497899681881'
FROZEN_FIXTURE = '5368de8f8e268ac2f376a45f08d97e690a3192708b4d42a2b6d393894f88a13c'


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def invoke(args: list[Path | str], timeout: int = 300) -> subprocess.CompletedProcess[str]:
    args = [str(arg) for arg in args]
    try:
        return subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=True, timeout=timeout)
    except subprocess.CalledProcessError as error:
        raise RuntimeError('command failed:\n' + ' '.join(args) + '\n' + error.stdout + error.stderr) from error


def jvalue(value: Any) -> str:
    if value is None: return 'null'
    if value is True: return 'Boolean.TRUE'
    if value is False: return 'Boolean.FALSE'
    if isinstance(value, str): return json.dumps(value)
    if isinstance(value, (int, float)): return 'Double.valueOf(' + json.dumps(str(value)) + ')'
    if isinstance(value, list): return 'list(' + ', '.join(jvalue(item) for item in value) + ')'
    if isinstance(value, dict):
        values = []
        for key, item in value.items(): values.extend((jvalue(key), jvalue(item)))
        return 'map(' + ', '.join(values) + ')'
    raise TypeError(value)


def raw_bits(value: float) -> str:
    return struct.pack('>d', float(value)).hex()


def error_checks(case: dict[str, Any]) -> list[str]:
    expected, detail = case['error'], case.get('error_detail')
    lines = ['try { BranchTree2D.generate(input); fail("expected error"); }',
             'catch (BranchTree2D.BranchArithmeticException e) {']
    if detail and 'stage' in detail:
        lines += [f'  equal("{expected}", e.code, "code");',
                  f'equal({detail["parentIndex"]}, e.parentIndex, "parent");',
                  f'equal({detail["slotIndex"]}, e.slotIndex, "slot");',
                  f'equal("{detail["stage"]}", e.stage, "stage");']
    else: lines += ['  throw e;']
    lines += ['} catch (BranchTree2D.SegmentLimitException e) {']
    if detail and 'parentIndex' in detail and 'stage' not in detail:
        lines += [f'equal("{expected}", e.code, "code");',
                  f'equal({detail["parentIndex"]}, e.parentIndex, "parent");',
                  f'equal({detail["slotIndex"]}, e.slotIndex, "slot");']
    else: lines += ['  throw e;']
    lines += ['} catch (BranchTree2D.BranchException e) {', f'equal("{expected}", e.code, "code");', '}']
    return lines


def success_checks(case: dict[str, Any]) -> list[str]:
    output, comparison = case['output'], case['comparison']
    lines = ['BranchTree2D result = BranchTree2D.generate(input);',
             f'equal({len(output["segments"])}, result.size(), "size");']
    tolerances = comparison.get('segments_abs')
    for i, row in enumerate(output['segments']):
        lines.append(f'double[] s{i} = result.segmentAt({i}L);')
        for component, expected in enumerate(row):
            if tolerances is None:
                lines.append(f'raw(s{i}[{component}], "{raw_bits(expected)}", "segment {i}/{component}");')
            else:
                lines.append(f'within(s{i}[{component}], {expected!r}, {tolerances[i][component]!r}, "segment {i}/{component}");')
    for field, accessor in [('headings', 'headingAt'), ('lengths', 'lengthAt')]:
        for i, expected in enumerate(output[field]):
            lines.append(f'raw(result.{accessor}({i}L), "{case["exact_attribute_bits"][field][i]}", "{field} {i}");')
    for field, accessor in [('parents', 'parentAt'), ('generations', 'generationAt'), ('childCounts', 'childCountAt')]:
        for i, expected in enumerate(output[field]): lines.append(f'equal({expected}, result.{accessor}({i}L), "{field} {i}");')
    lines.append('topology(result);')
    return lines


def vectors_source(fixture: dict[str, Any]) -> str:
    methods, calls = [], []
    for ordinal, case in enumerate(fixture['cases']):
        calls.append(f'case{ordinal}();')
        body = [f'Object input = {jvalue(case["input"])};']
        body += error_checks(case) if 'error' in case else success_checks(case)
        methods.append('  private static void case%d() {\n    %s\n  }' % (ordinal, '\n    '.join(body)))
    seeds = []
    for vector in fixture['seed_vectors']:
        body = [f'Object stream = stream({vector["seed"]}L);', 'int[] state = state(stream);']
        for i, value in enumerate(vector['initial_state']): body.append(f'unsigned({value}L, state[{i}], "initial state");')
        for entry in vector['first_10']:
            body.append(f'unsigned({entry["output_u32"]}L, next(stream), "rng output");')
            body.append('state = state(stream);')
            for i, value in enumerate(entry['post_state']): body.append(f'unsigned({value}L, state[{i}], "post state");')
        seeds.append('    {\n      ' + '\n      '.join(body) + '\n    }')
    return '''package org.procedurals.topology;
import java.lang.reflect.*;
import java.util.*;
/** Generated exact fixture vectors; source data stays in the shared JSON fixture. */
public final class BranchTreeVectors {
  private static int assertions;
  private static void check(boolean c, String m) { assertions++; if (!c) throw new AssertionError(m); }
  private static void fail(String m) { throw new AssertionError(m); }
  private static void equal(int e, int a, String m) { check(e == a, m); }
  private static void equal(String e, String a, String m) { check(e.equals(a), m); }
  private static void raw(double a, String e, String m) { check(Double.doubleToRawLongBits(a) == Long.parseUnsignedLong(e, 16), m); }
  private static void within(double a, double e, double d, String m) { if (d == 0.0) raw(a, Long.toUnsignedString(Double.doubleToRawLongBits(e), 16), m); else check(Math.abs(a - e) <= d, m); }
  private static void unsigned(long e, int a, String m) { check(e == Integer.toUnsignedLong(a), m); }
  private static List<Object> list(Object... v) { return new ArrayList<Object>(Arrays.asList(v)); }
  private static Map<String,Object> map(Object... v) { Map<String,Object> m = new LinkedHashMap<String,Object>(); for (int i = 0; i < v.length; i += 2) m.put((String)v[i], v[i + 1]); return m; }
  private static void topology(BranchTree2D r) { for (int i = 0; i < r.size(); i++) { int p = r.parentAt(i); double[] s = r.segmentAt(i); if (i == 0) { equal(-1,p,"root parent"); equal(0,r.generationAt(i),"root generation"); } else { check(p >= 0 && p < i,"parent order"); double[] q=r.segmentAt(p); raw(s[0],Long.toUnsignedString(Double.doubleToRawLongBits(q[2]),16),"parent x"); raw(s[1],Long.toUnsignedString(Double.doubleToRawLongBits(q[3]),16),"parent y"); equal(r.generationAt(p)+1,r.generationAt(i),"generation"); } int c=0; for (int j=0;j<r.size();j++) if(r.parentAt(j)==i)c++; equal(c,r.childCountAt(i),"child count"); } }
  private static Object stream(long seed) throws Exception { Class<?> c=Class.forName("org.procedurals.topology.BranchTree2D$Xoshiro128StarStar11"); Constructor<?> k=c.getDeclaredConstructor(long.class); k.setAccessible(true); return k.newInstance(seed); }
  private static int next(Object s) throws Exception { Method m=s.getClass().getDeclaredMethod("nextU32"); m.setAccessible(true); return ((Integer)m.invoke(s)).intValue(); }
  private static int[] state(Object s) throws Exception { int[] o=new int[4]; String[] n={"s0","s1","s2","s3"}; for(int i=0;i<4;i++){Field f=s.getClass().getDeclaredField(n[i]);f.setAccessible(true);o[i]=f.getInt(s);}return o; }
  private static void rngVectors() throws Exception {
%s
  }
%s
  public static void main(String[] args) throws Exception { rngVectors(); %s System.out.println("{\\"status\\":\\"passed\\",\\"fixture_cases\\":%d,\\"assertions\\":"+assertions+"}"); }
}
''' % ('\n'.join(seeds), '\n'.join(methods), ''.join(calls), len(fixture['cases']))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--java-home')
    parser.add_argument('--output', type=Path, default=ROOT / 'evidence/conformance/branch-tree-java.json')
    args = parser.parse_args()
    if sha(CATALOG) != FROZEN_CATALOG or sha(FIXTURE) != FROZEN_FIXTURE: raise RuntimeError('frozen catalog/fixture hash mismatch')
    fixture = json.loads(FIXTURE.read_text())
    if fixture.get('catalog_sha256') != sha(CATALOG): raise RuntimeError('fixture catalog binding stale')
    home = Path(args.java_home) if args.java_home else next((ROOT / '.work/toolchains').glob('jdk-17*'))
    bound = [CATALOG, FIXTURE, REVIEW, CORE, NATIVE, Path(__file__).resolve()]
    before = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    build = ROOT / '.work/build/branch-tree-java'; shutil.rmtree(build, ignore_errors=True); build.mkdir(parents=True)
    vectors = build / 'BranchTreeVectors.java'; vectors.write_text(vectors_source(fixture))
    invoke([home / 'bin/javac', '--release', '8', '-d', build, CORE, vectors])
    vector_result = json.loads(invoke([home / 'bin/java', '-cp', build, 'org.procedurals.topology.BranchTreeVectors'], 180).stdout)
    invoke([home / 'bin/javac', '--release', '8', '-cp', build, '-d', build, NATIVE])
    native_result = json.loads(invoke([home / 'bin/java', '-cp', build, 'org.procedurals.topology.BranchTreeNative'], 300).stdout)
    if vector_result.get('status') != 'passed' or native_result.get('status') != 'passed': raise RuntimeError('failed vector/native report')
    after = {str(path.relative_to(ROOT)): sha(path) for path in bound}
    if before != after: raise RuntimeError('bound input changed during run')
    report = {'operation':'topology.seeded-endpoint-branches-2d','scope':'Java core fixture/native ownership/workload evidence only; no renderer, package, or other-target claim.', 'contract_sha256':{str(CATALOG.relative_to(ROOT)):sha(CATALOG)}, 'fixture_sha256':{str(FIXTURE.relative_to(ROOT)):sha(FIXTURE)}, 'source_sha256_before':before, 'source_sha256_after':after, 'vectors':vector_result, 'native':native_result, 'runtime':invoke([home/'bin/java','-version']).stderr.strip()}
    args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(json.dumps(report, indent=2, sort_keys=True)+'\n')
    print(json.dumps({'passed':True,'cases':vector_result['fixture_cases'],'report':str(args.output)}))
if __name__ == '__main__': main()
