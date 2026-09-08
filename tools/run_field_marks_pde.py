#!/usr/bin/env python3
"""Execute the registered one-frame PDE lifecycle/save check after official preprocessing."""
from pathlib import Path
import hashlib
import json
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home, run


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    home=java_home(None)
    plan_path=ROOT/'evidence/reproductions/cp1-java2d/pde-plan.json'
    plan=json.loads(plan_path.read_text());assert plan['render_budget']==1
    output=ROOT/plan['output'];output.mkdir(parents=True,exist_ok=True)
    attempt=output/'attempt.json'
    if attempt.exists():raise RuntimeError('PDE render budget already reserved; inspect the existing result')
    run([sys.executable,ROOT/'tools/check_field_marks_pde.py','--java-home',home])
    build=ROOT/'.work/build/field-marks-pde'
    core=ROOT/'.work/toolchains/processing-4.5.6/core-4.5.6.jar'
    pde_build=ROOT/'evidence/reproductions/cp1-java2d/pde-build.json'
    build_record=json.loads(pde_build.read_text())
    jar=ROOT/build_record['core_build']['jar_path']
    if digest(jar)!=build_record['core_build']['jar_sha256']:
        raise RuntimeError('PDE core JAR changed after its recorded build')
    source=ROOT/'tests/native/FieldMarksPdeSmoke.java'
    classpath=f'{build}:{core}:{jar}'
    run([home/'bin/javac','-cp',classpath,'-d',build,source])
    attempt.write_text(json.dumps({'status':'started','reserved_renders':1})+'\n')
    result=run(['xvfb-run','-a',home/'bin/java',f'-Duser.home={build/"home"}',
                '-cp',classpath,'FieldMarksPdeSmoke',output],timeout=45)
    paths=list(output.glob('field-marks-*.png'));assert len(paths)==1
    from PIL import Image
    with Image.open(paths[0]) as image:assert image.size==(640,640)
    assert (output/'lifecycle.txt').is_file()
    report={'scope':plan['scope'],'plan_sha256':digest(plan_path),'build':build_record,
            'source_sha256':{str(p.relative_to(ROOT)):digest(p) for p in (source,Path(__file__).resolve())},
            'image':str(paths[0].relative_to(ROOT)),'image_sha256':digest(paths[0]),
            'lifecycle':(output/'lifecycle.txt').read_text(),'stdout':result.stdout,'stderr':result.stderr,
            'visual_inspection':'pending; record in decision.md'}
    destination=ROOT/'evidence/reproductions/cp1-java2d/pde-result.json'
    destination.write_text(json.dumps(report,indent=2)+'\n')
    attempt.write_text(json.dumps({'status':'complete','reserved_renders':1})+'\n')
    print(json.dumps({'pde_lifecycle':True,'save_handler':True,'image':str(paths[0]),'result':str(destination)}))


if __name__=='__main__':main()
