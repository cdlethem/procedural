#!/usr/bin/env python3
"""Build CP7 Python 0.7.0 ProfileMarks wheel/starter; never run a sketch."""
from __future__ import annotations
import argparse, ast, hashlib, json, os, shutil, subprocess, sys, zipfile
from pathlib import Path
from build_region_marks_python import archive_entries, copy, digest, isolated_python, run, run_with_xvfb, source_files, uv_executable

ROOT=Path(__file__).resolve().parents[1]; PACKAGE=ROOT/"packages/python"; CORE=PACKAGE/"procedurals"
EXAMPLE=PACKAGE/"examples/profile_marks"; VERSION="0.7.0"; OUTPUT_ROOT=ROOT/".work/dist/cp7"
NOTICES=(ROOT/"LICENSE",ROOT/"THIRD_PARTY_NOTICES.md")
REVIEWS=(ROOT/"evidence/conformance/radial-profile-python-root-review.json",ROOT/"evidence/conformance/profile-py5-native-root-review.json",ROOT/"evidence/conformance/py5-profile-marks.json",ROOT/"evidence/conformance/profile-marks-python-parity.json",ROOT/"evidence/conformance/profile-export-compatibility-review.json")
OPS=("regular_grid","gradient_noise_2d_01","cyclic_palette","gradient_path_2d","ordered_circle_filter_2d","seeded_circle_placement_2d","seeded_quadrant_partition_2d","seeded_triangle_points_2d","map_triangle_coordinates_2d","seeded_endpoint_branches_2d","RadialProfile3D")

def rel(path): return str(path.resolve().relative_to(ROOT)).replace(os.sep,"/")
def required(path):
    if not path.is_file(): raise FileNotFoundError("required ProfileMarks input is missing: "+rel(path))
    return path
def accepted_records():
    result={}
    schemas={
        'radial-profile-python-root-review.json': ('accepted', ('implementation_sha256', 'evidence_sha256')),
        'profile-py5-native-root-review.json': ('accepted', ('evidence_sha256',)),
        'py5-profile-marks.json': ('passed', ('input_sha256_before', 'input_sha256_after')),
        'profile-marks-python-parity.json': ('passed', ('source_sha256_before', 'source_sha256_after')),
        'profile-export-compatibility-review.json': ('accepted', ('implementation_sha256', 'evidence_sha256')),
    }
    for path in REVIEWS:
        record=json.loads(required(path).read_text())
        status, groups=schemas[path.name]
        if record.get("status") != status: raise RuntimeError("unexpected ProfileMarks evidence status: "+rel(path))
        for group in groups:
            if not isinstance(record.get(group),dict) or not record[group]:
                raise RuntimeError("missing required "+group+": "+rel(path))
        if record.get("status")=="accepted" and record.get("reviewer")!="root": raise RuntimeError("ProfileMarks review lacks root reviewer: "+rel(path))
        for group in ("implementation_sha256","evidence_sha256"):
            values=record.get(group) or {}
            if not isinstance(values,dict): raise RuntimeError("malformed "+group+": "+rel(path))
            for name,expected in values.items():
                target=required(ROOT/name)
                if digest(target)!=expected: raise RuntimeError("ProfileMarks binding drifted: "+name)
        for stem in ("input_sha256", "source_sha256"):
            before=record.get(stem+"_before")
            after=record.get(stem+"_after")
            if before is None and after is None: continue
            if not isinstance(before,dict) or not isinstance(after,dict) or not before or set(before)!=set(after):
                raise RuntimeError("incomplete "+stem+" before/after map: "+rel(path))
            for name in before:
                target=required(ROOT/name)
                actual=digest(target)
                if actual!=before[name] or actual!=after[name]: raise RuntimeError("ProfileMarks "+stem+" binding drifted: "+name)
        result[rel(path)]=digest(path)
    return result
def sketch_stage(source):
    block="sys.path.insert(0, str(Path(__file__).resolve().parents[2]))\n"
    if source.count(block)!=1: raise RuntimeError("expected exact checkout sys.path block")
    staged=source.replace(block,"",1)
    find=lambda value:[n for n in ast.parse(value).body if isinstance(n,ast.ClassDef) and n.name=="ProfileMarksSketch"]
    if len(find(source))!=1 or ast.dump(find(source)[0])!=ast.dump(find(staged)[0]): raise RuntimeError("ProfileMarksSketch changed")
    return staged,{"kind":"remove_checkout_sys_path_block","removed":block.rstrip(),"class_ast_unchanged":True}
def geometry_program():
    return "import hashlib,json,struct\nfrom profile_composition import create_profile_composition\nCASES=((32,True,True),(8,True,True),(8,False,True),(8,False,False))\ndef g(x):\n c=create_profile_composition(*x);h=hashlib.sha256();p=[0.,0.,0.];n=[0.,0.,0.];t=[0,0,0]\n for r in range(c.size):\n  q=c.mesh_at(r);h.update(struct.pack('>QQ',q.vertex_count(),q.face_count()))\n  for i in range(q.vertex_count()):q.vertex_into(i,p);h.update(struct.pack('>ddd',*p))\n  for i in range(q.face_count()):q.triangle_into(i,t);q.normal_into(i,n);h.update(struct.pack('>iii',*t));h.update(struct.pack('>ddd',*n));h.update(q.face_kind_at(i).encode());h.update(struct.pack('>ii',q.band_at(i),q.cell_at(i)))\n return {'config':list(x),'meshes':c.size,'geometry_sha256':h.hexdigest()}\nprint(json.dumps({'cases':[g(x) for x in CASES]}))\n"
def starter_readme(wheel):
    return "# ProfileMarks Python starter\n\nRequires Python 3.11+, JDK 17, and pinned py5.\n\n```sh\npython -m pip install \"../"+wheel+"[py5]\"\npython sketch.py\n```\n\nP cycles the three editable profiles; D switches 8/32 slices; B and T toggle independent start/end caps; C changes palette; X toggles the three-form view; 0 resets; S saves. Edit `profile_composition.py` to change the profile points, radii, z positions, slices, and cap choices. These are example settings, not library defaults.\n"

def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--output",type=Path,default=OUTPUT_ROOT/"python-profile1"); parser.add_argument("--java-home",type=Path,default=ROOT/".work/toolchains/jdk-17.0.20.1+1"); args=parser.parse_args()
    output=args.output.resolve()
    if output!=OUTPUT_ROOT and OUTPUT_ROOT not in output.parents: raise ValueError("output must stay under .work/dist/cp7")
    if output.exists(): raise RuntimeError("refusing occupied output destination: "+rel(output))
    marker='version = "0.1.0"'; metadata=(PACKAGE/"pyproject.toml").read_text()
    if metadata.count(marker)!=1: raise RuntimeError("unexpected Python package version metadata")
    evidence=accepted_records()
    inputs=[PACKAGE/"pyproject.toml",*NOTICES,*REVIEWS,*source_files(CORE),*source_files(EXAMPLE),Path(__file__).resolve(),ROOT/"tools/build_region_marks_python.py",ROOT/"tools/build_path_marks_python.py"]
    for path in inputs: required(path)
    before={rel(path):digest(path) for path in inputs}
    output.mkdir(parents=True); env=dict(os.environ,PYTHONNOUSERSITE="1",PYTHONPATH="",UV_CACHE_DIR=str(output/"uv-cache"),PIP_CACHE_DIR=str(output/"pip-cache"),PYTHONPYCACHEPREFIX=str(output/"pycache"),XDG_CACHE_HOME=str(output/"xdg-cache"))
    for key in ("UV_CACHE_DIR","PIP_CACHE_DIR","PYTHONPYCACHEPREFIX","XDG_CACHE_HOME"): Path(env[key]).mkdir(parents=True,exist_ok=True)
    build=output/"build"; stage=build/"source"; stage.mkdir(parents=True); shutil.copytree(CORE,stage/"procedurals",ignore=shutil.ignore_patterns("__pycache__","*.pyc")); (stage/"pyproject.toml").write_text(metadata.replace(marker,'version = "'+VERSION+'"',1))
    for notice in NOTICES: copy(notice,stage/notice.name)
    wheelhouse=build/"wheelhouse"; wheelhouse.mkdir(); run([uv_executable(),"build","--wheel","--clear","--out-dir",wheelhouse,stage],cwd=build,environment=env)
    wheels=sorted(wheelhouse.glob("procedurals_python-*.whl"))
    if len(wheels)!=1: raise RuntimeError("expected one staged wheel")
    wheel=wheels[0]; entries=archive_entries(wheel); names=[entry["path"] for entry in entries]
    if not all("procedurals/"+path.name in names for path in source_files(CORE)): raise RuntimeError("wheel omitted portable source")
    if not all(any(name.endswith("licenses/"+notice.name) for name in names) for notice in NOTICES): raise RuntimeError("wheel lacks notices")
    starter=build/"starter/profile-marks"; starter.mkdir(parents=True); staged,transform=sketch_stage((EXAMPLE/"sketch.py").read_text()); (starter/"sketch.py").write_text(staged); copy(EXAMPLE/"profile_composition.py",starter/"profile_composition.py"); (starter/"output/.gitignore").parent.mkdir(parents=True); (starter/"output/.gitignore").write_text("*\n!.gitignore\n"); (starter/"README.md").write_text(starter_readme(wheel.name))
    for notice in NOTICES: copy(notice,starter/notice.name)
    archive=output/("procedurals-profile-marks-python-starter-"+VERSION+".zip")
    with zipfile.ZipFile(archive,"x",compression=zipfile.ZIP_DEFLATED) as zipped:
        zipped.write(wheel,wheel.name)
        for path in source_files(starter): zipped.write(path,"profile-marks/"+str(path.relative_to(starter)))
    extracted=build/"extracted"; extracted.mkdir()
    with zipfile.ZipFile(archive) as zipped: zipped.extractall(extracted)
    bundled_wheel=extracted/wheel.name; bundled=extracted/"profile-marks"
    if digest(bundled_wheel)!=digest(wheel): raise RuntimeError("bundled wheel differs")
    for path in source_files(starter):
        if digest(bundled/path.relative_to(starter))!=digest(path): raise RuntimeError("starter archive differs")
    source_env=dict(env,PYTHONPATH=str(PACKAGE)+os.pathsep+str(EXAMPLE)); expected=json.loads(run([sys.executable,"-c",geometry_program()],cwd=ROOT,environment=source_env).stdout)
    consumer=build/"consumer"; consumer.mkdir(); python=isolated_python(uv_executable(),build/"consumer-venv",env); run([python,"-m","pip","install",str(bundled_wheel)+"[py5]"],cwd=consumer,environment=env,timeout=600)
    geometry_body=geometry_program().replace("print(json.dumps({'cases':[g(x) for x in CASES]}))\n","")
    smoke="import json,site,sys\nfrom pathlib import Path\nimport procedurals\nfrom procedurals import *\nsys.path.insert(0,str(Path(__file__).parent))\nfrom profile_composition import create_profile_composition\nrequired="+repr(OPS)+"\nassert len(required)==11 and all(callable(getattr(procedurals,x)) for x in required)\nmodule=Path(__import__('procedurals.radial_profile',fromlist=['x']).__file__).resolve();sites=[Path(x).resolve() for x in site.getsitepackages()]\nassert any(module.is_relative_to(x) for x in sites),module\nassert RadialProfile3D is __import__('procedurals.radial_profile',fromlist=['RadialProfile3D']).RadialProfile3D and RadialProfileError is __import__('procedurals.radial_profile',fromlist=['RadialProfileError']).RadialProfileError\n"+geometry_body+"\nactual={'cases':[g(x) for x in CASES]}\nexpected=json.loads("+repr(json.dumps(expected))+")\nassert actual==expected,(actual,expected)\nprint(json.dumps({'status':'passed','imported_path':str(module),'site_packages':[str(x) for x in sites],'cases':actual['cases'],'operation_count':len(required)}))\n"
    smoke_path=bundled/"smoke.py"; smoke_path.write_text(smoke); consumer_result=json.loads(run([python,smoke_path],cwd=bundled,environment=env).stdout); smoke_path.unlink(); imported=Path(consumer_result["imported_path"])
    if not any(imported.is_relative_to(Path(path)) for path in consumer_result["site_packages"]): raise RuntimeError("consumer did not import installed wheel")
    py5_result={"status":"skipped","reason":"py5 import requires display/native-render lock; deferred to root"}
    for path,value in before.items():
        if digest(ROOT/path)!=value: raise RuntimeError("source changed during build: "+path)
    if accepted_records()!=evidence: raise RuntimeError("review bindings changed during build")
    report={"status":"passed","scope":"CP7 Python 0.7.0 installed wheel and extracted ProfileMarks starter checks; no sketch execution, native render, publication, or support attestation.","package_version":VERSION,"input_sha256":before,"accepted_evidence_sha256":evidence,"artifacts":{"wheel":{"path":rel(wheel),"sha256":digest(wheel),"entries":entries},"starter_zip":{"path":rel(archive),"sha256":digest(archive),"entries":archive_entries(archive)}},"consumer":consumer_result,"starter":{"transform":transform,"bundled_verified":True,"py5_load":py5_result}}
    (output/"build-result.json").write_text(json.dumps(report,indent=2)+"\n"); print(json.dumps({"status":"passed","wheel":rel(wheel),"starter_zip":rel(archive),"cases":len(consumer_result["cases"])}))
if __name__=="__main__": main()
