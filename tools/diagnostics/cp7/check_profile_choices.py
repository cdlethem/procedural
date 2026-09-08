#!/usr/bin/env python3
"""Check a future CP7 Java mesh dump against the frozen private Python topology oracle."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
JAVA = ROOT / 'tools/diagnostics/cp7/ProfileChoices.java'
PYTHON = ROOT / 'tools/diagnostics/cp7/profile_mesh_diagnostic.py'
DEFAULT_DUMP = ROOT / '.work/cp7-profile-choices/mesh-dump.json'
REPORT = ROOT / 'evidence/investigations/cp7-java-profile-geometry.json'
EXPECTED = {
    'baseline': (546, 1088, 0), 'waist': (546, 1088, 0), 'pointed': (514, 1024, 0),
    'coarse': (138, 272, 0), 'open': (544, 1024, 2),
}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_oracle():
    spec = importlib.util.spec_from_file_location('cp7_profile_oracle', PYTHON)
    if spec is None or spec.loader is None: raise RuntimeError('cannot load frozen Python diagnostic')
    module = importlib.util.module_from_spec(spec); sys.modules[spec.name] = module; spec.loader.exec_module(module)
    return module


def profile(case: str):
    if case in ('baseline', 'coarse', 'open'):
        return [(-160.0 + 20.0*j, 60.0) for j in range(17)]
    if case == 'waist':
        return [(-160.0 + 20.0*j, 60.0 - 36.0*math.cos((j / 16.0 - .5)*math.pi)) for j in range(17)]
    if case == 'pointed':
        return [(-160.0 + 20.0*j, 0.0 if j == 16 else 60.0*(1.0-j/16.0)) for j in range(17)]
    raise AssertionError(case)


def expected_mesh(oracle, case: str):
    slices = 8 if case == 'coarse' else 32
    bottom = case != 'open'
    top = case in ('baseline', 'waist', 'coarse')
    return oracle.mesh(profile(case), slices, bottom, top), slices


def parse_mesh(item: object):
    if not isinstance(item, dict): raise AssertionError('mesh record')
    identifier = item.get('id')
    positions = item.get('positions'); faces = item.get('faces')
    if not isinstance(identifier, str) or not isinstance(positions, list) or not isinstance(faces, list): raise AssertionError('dump shape')
    actual_positions=[]
    for row in positions:
        if not isinstance(row, list) or len(row) != 3 or any(type(v) not in (int,float) or isinstance(v,bool) or not math.isfinite(float(v)) for v in row): raise AssertionError('position carrier')
        actual_positions.append(tuple(float(v) for v in row))
    actual_faces=[]
    for face in faces:
        if not isinstance(face,dict) or set(face) != {'indices','kind','band','cell'}: raise AssertionError('face shape')
        indices,kind,band,cell=face['indices'],face['kind'],face['band'],face['cell']
        if not isinstance(indices,list) or len(indices)!=3 or any(type(i) is not int for i in indices): raise AssertionError('face indices')
        if kind not in ('side','bottom-cap','top-cap') or (band is not None and type(band) is not int) or type(cell) is not int: raise AssertionError('face metadata')
        if kind in ('bottom-cap','top-cap') and band == -1: band = None
        actual_faces.append((tuple(indices),kind,band,cell))
    return identifier,actual_positions,actual_faces


def coordinate_check(actual, expected, vertices):
    if len(actual)!=len(expected): raise AssertionError('vertex count')
    largest=0.0
    for index,(seen,want) in enumerate(zip(actual,expected)):
        # Axial coordinates are configured integers and remain exact. A zero-radius pole/cap
        # is not a trig result, so its transverse coordinates must also remain exact.
        if seen[2] != want[2]: raise AssertionError('z mismatch at %d' % index)
        pole_or_cap = want[0] == 0.0 and want[1] == 0.0
        for axis in (0,1):
            delta=abs(seen[axis]-want[axis]); largest=max(largest,delta)
            if pole_or_cap:
                if seen[axis] != want[axis]: raise AssertionError('exact center mismatch at %d' % index)
            elif delta > 1e-12: raise AssertionError('trig/waist coordinate tolerance at %d' % index)
    return largest


def check_case(oracle, identifier, positions, faces):
    if identifier not in EXPECTED: raise AssertionError('unexpected mesh id '+identifier)
    (vertices, reference_faces, rings, centers), slices = expected_mesh(oracle, identifier)
    expected_vertices, expected_faces, expected_loops = EXPECTED[identifier]
    if len(positions)!=expected_vertices or len(faces)!=expected_faces: raise AssertionError('declared counts '+identifier)
    largest=coordinate_check(positions,vertices,vertices)
    expected_face_tuples=[(face.indices,face.kind,face.band,face.cell) for face in reference_faces]
    if faces != expected_face_tuples: raise AssertionError('face order/index/provenance '+identifier)
    converted=[oracle.Face(indices,kind,band,cell) for indices,kind,band,cell in faces]
    oracle.topology(positions,converted,expected_loops==0,expected_loops)
    oracle.validate_metadata(profile(identifier),converted,rings,centers,slices)
    return {'id':identifier,'vertices':len(positions),'faces':len(faces),'boundary_loops':expected_loops,'largest_coordinate_abs':largest}


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--dump',type=Path,default=DEFAULT_DUMP); parser.add_argument('--output',type=Path,default=REPORT); args=parser.parse_args()
    if not args.dump.is_file(): raise RuntimeError('mesh dump is not available: '+str(args.dump))
    oracle=load_oracle(); raw=json.loads(args.dump.read_text())
    records=raw.get('meshes') if isinstance(raw,dict) else None
    if not isinstance(records,list) or len(records)!=5: raise AssertionError('expected five distinct mesh records')
    seen=set(); results=[]
    for item in records:
        identifier,positions,faces=parse_mesh(item)
        if identifier in seen: raise AssertionError('duplicate id')
        seen.add(identifier)
        results.append(check_case(oracle,identifier,positions,faces))
    if seen != set(EXPECTED): raise AssertionError('missing expected mesh')
    bindings={str(JAVA.relative_to(ROOT)):digest(JAVA),str(PYTHON.relative_to(ROOT)):digest(PYTHON),str(Path(__file__).relative_to(ROOT)):digest(Path(__file__)),str(args.dump.relative_to(ROOT)):digest(args.dump)}
    report={'status':'passed','scope':'Private Java dump checked against the private Python CP7 topology diagnostic; no renderer or portable-target claim.','source_bindings':bindings,'cases':results,'largest_coordinate_abs':max(item['largest_coordinate_abs'] for item in results)}
    args.output.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n'); print(json.dumps({'passed':True,'cases':len(results),'report':str(args.output)}))
if __name__=='__main__': main()
