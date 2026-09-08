#!/usr/bin/env python3
"""Compare Python CP1 retained values/commands to accepted Java fixtures, without rendering."""
import hashlib
import json
from pathlib import Path
import struct
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'packages/python'),str(ROOT/'packages/python/examples/field_marks')]
from mark_field import create_mark_field,mark_commands

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    plan_path=ROOT/'evidence/reproductions/cp1-java2d/plan.json'
    prior_path=ROOT/'evidence/reproductions/cp1-java2d/result.json'
    plan=json.loads(plan_path.read_text())
    prior={c['id']:c for c in json.loads(prior_path.read_text())['native']['cases']}
    sources=[Path(__file__).resolve(),plan_path,prior_path,
             ROOT/'packages/python/examples/field_marks/mark_field.py',
             *sorted((ROOT/'packages/python/procedurals').glob('*.py'))]
    inputs={str(p.relative_to(ROOT)):digest(p) for p in sources}
    marks=create_mark_field()
    model=hashlib.sha256()
    for row in zip(*(marks[k] for k in ('x','y','heading','length_factor','colour_cycles'))):
        model.update(struct.pack('>5d',*row))
    model_hash=model.hexdigest();results=[]
    for case in plan['cases']:
        geometry=hashlib.sha256();color=hashlib.sha256();count=0
        for command in mark_commands(marks,case['maxLength'],[int(c,16) for c in case['colors']],case['mark']=='bar'):
            points=command['vertices'] if command['kind']=='quad2' else [command['from'],command['to']]
            for point in points:geometry.update(struct.pack('>2f',*point))
            color.update(struct.pack('>I',(180<<24)|command['rgb']));count+=1
        result={'id':case['id'],'model_sha256':model_hash,'geometry_sha256':geometry.hexdigest(),
                'color_sha256':color.hexdigest(),'commands':count}
        for key in ('model_sha256','geometry_sha256','color_sha256','commands'):
            if result[key]!=prior[case['id']][key]:raise AssertionError(f'{case["id"]}: {key} mismatch')
        results.append(result)
    if inputs!={str(p.relative_to(ROOT)):digest(p) for p in sources}:raise RuntimeError('Inputs changed')
    report={'scope':'Python CP1 value and converted-command checks only; no py5 rendering',
            'status':'passed','python':sys.version,'input_sha256':inputs,'cases':results}
    destination=ROOT/'evidence/conformance/cp1-python-values.json'
    destination.write_text(json.dumps(report,indent=2)+'\n')
    print(str(destination.relative_to(ROOT)))

if __name__=='__main__':main()
