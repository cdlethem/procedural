#!/usr/bin/env python3
"""Build CP5 Python 0.5.0 GrainMarks wheel/starter; never run a sketch."""
from __future__ import annotations
import argparse, ast, hashlib, json, os, shutil, subprocess, sys, zipfile
from pathlib import Path
from build_region_marks_python import archive_entries, copy, digest, isolated_python, run, run_with_xvfb, source_files, uv_executable

ROOT=Path(__file__).resolve().parents[1]; PACKAGE=ROOT/"packages/python"; CORE=PACKAGE/"procedurals"
EXAMPLE=PACKAGE/"examples/grain_marks"; VERSION="0.5.0"; OUTPUT_ROOT=ROOT/".work/dist/cp5"
NOTICES=(ROOT/"LICENSE",ROOT/"THIRD_PARTY_NOTICES.md")
OPS=("regular_grid","gradient_noise_2d_01","cyclic_palette","gradient_path_2d","ordered_circle_filter_2d","seeded_circle_placement_2d","seeded_quadrant_partition_2d","seeded_triangle_points_2d","map_triangle_coordinates_2d")

def rel(path): return str(path.resolve().relative_to(ROOT)).replace(os.sep,"/")
def required(path):
    if not path.is_file(): raise FileNotFoundError("required GrainMarks input is missing: "+rel(path))
    return path
def sketch_stage(source):
    block="sys.path.insert(0, str(Path(__file__).resolve().parents[2]))\n"
    if source.count(block)!=1: raise RuntimeError("expected exact checkout sys.path block")
    staged=source.replace(block,"",1)
    find=lambda value:[n for n in ast.parse(value).body if isinstance(n,ast.ClassDef) and n.name=="GrainMarksSketch"]
    if len(find(source))!=1 or ast.dump(find(source)[0])!=ast.dump(find(staged)[0]): raise RuntimeError("GrainMarksSketch changed")
    return staged,{"kind":"remove_checkout_sys_path_block","removed":block.rstrip(),"class_ast_unchanged":True}
def geometry_program():
    return "import hashlib,json,struct\nfrom grain_marks import create_grain_composition\nCASES=((42,.1,0,False),(43,.2,0,False),(42,.1,1,False),(42,.1,2,False),(42,.1,0,True),(43,.1,2,True))\ndef g(x):\n c=create_grain_composition(*x);h=hashlib.sha256();p=[0.,0.]\n for r in range(c.size):\n  q=c.region_at(r);h.update(struct.pack('>Q',q.size))\n  for i in range(q.size):q.point_into(i,p);h.update(struct.pack('>dd',p[0],p[1]))\n return {'config':list(x),'regions':c.size,'total_points':c.total_points,'geometry_sha256':h.hexdigest()}\nprint(json.dumps({'cases':[g(x) for x in CASES]}))\n"
def starter_readme(wheel):
    return "# GrainMarks Python starter\n\n```sh\npython -m pip install \"../"+wheel+"[py5]\"\npython sketch.py\n```\n\nR seed; N density; B distribution; X cells; M motif; C palette; 0 reset; S save.\n"

def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument("--output",type=Path,default=OUTPUT_ROOT/"python-grain1"); parser.add_argument("--java-home",type=Path,default=ROOT/".work/toolchains/jdk-17.0.20.1+1"); args=parser.parse_args()
    output=args.output.resolve()
    if output!=OUTPUT_ROOT and OUTPUT_ROOT not in output.parents: raise ValueError("output must stay under .work/dist/cp5")
    if output.exists(): raise RuntimeError("refusing occupied output destination: "+rel(output))
    marker='version = "0.1.0"'; metadata=(PACKAGE/"pyproject.toml").read_text()
    if metadata.count(marker)!=1: raise RuntimeError("unexpected Python package version metadata")
    inputs=[PACKAGE/"pyproject.toml",*NOTICES,*source_files(CORE),*source_files(EXAMPLE),Path(__file__).resolve(),ROOT/"tools/build_region_marks_python.py",ROOT/"tools/build_path_marks_python.py"]
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
    starter=build/"starter/grain-marks"; starter.mkdir(parents=True); staged,transform=sketch_stage((EXAMPLE/"sketch.py").read_text()); (starter/"sketch.py").write_text(staged); copy(EXAMPLE/"grain_marks.py",starter/"grain_marks.py"); (starter/"output/.gitignore").parent.mkdir(parents=True); (starter/"output/.gitignore").write_text("*\n!.gitignore\n"); (starter/"README.md").write_text(starter_readme(wheel.name))
    for notice in NOTICES: copy(notice,starter/notice.name)
    archive=output/("procedurals-grain-marks-python-starter-"+VERSION+".zip")
    with zipfile.ZipFile(archive,"x",compression=zipfile.ZIP_DEFLATED) as zipped:
        zipped.write(wheel,wheel.name)
        for path in source_files(starter): zipped.write(path,"grain-marks/"+str(path.relative_to(starter)))
    extracted=build/"extracted"; extracted.mkdir()
    with zipfile.ZipFile(archive) as zipped: zipped.extractall(extracted)
    bundled_wheel=extracted/wheel.name; bundled=extracted/"grain-marks"
    if digest(bundled_wheel)!=digest(wheel): raise RuntimeError("bundled wheel differs")
    for path in source_files(starter):
        if digest(bundled/path.relative_to(starter))!=digest(path): raise RuntimeError("starter archive differs")
    source_env=dict(env,PYTHONPATH=str(PACKAGE)+os.pathsep+str(EXAMPLE)); expected=json.loads(run([sys.executable,"-c",geometry_program()],cwd=ROOT,environment=source_env).stdout)
    consumer=build/"consumer"; consumer.mkdir(); python=isolated_python(uv_executable(),build/"consumer-venv",env); run([python,"-m","pip","install",str(bundled_wheel)+"[py5]"],cwd=consumer,environment=env,timeout=600)
    geometry_body=geometry_program().replace("print(json.dumps({'cases':[g(x) for x in CASES]}))\n","")
    smoke="import json,site,sys\nfrom pathlib import Path\nfrom procedurals import *\nsys.path.insert(0,str(Path(__file__).parent))\nfrom grain_marks import create_grain_composition\nrequired="+repr(OPS)+"\nassert len(required)==9 and all(callable(globals()[x]) for x in required)\nmodule=Path(__import__('procedurals.triangle_points',fromlist=['x']).__file__).resolve();sites=[Path(x).resolve() for x in site.getsitepackages()]\nassert any(module.is_relative_to(x) for x in sites),module\n"+geometry_body+"\nactual={'cases':[g(x) for x in CASES]}\nexpected=json.loads("+repr(json.dumps(expected))+")\nassert actual==expected,(actual,expected)\nprint(json.dumps({'status':'passed','imported_path':str(module),'site_packages':[str(x) for x in sites],'cases':actual['cases'],'operation_count':len(required)}))\n"
    smoke_path=bundled/"smoke.py"; smoke_path.write_text(smoke); consumer_result=json.loads(run([python,smoke_path],cwd=bundled,environment=env).stdout); smoke_path.unlink(); imported=Path(consumer_result["imported_path"])
    if not any(imported.is_relative_to(Path(path)) for path in consumer_result["site_packages"]): raise RuntimeError("consumer did not import installed wheel")
    py5_env=dict(env,JAVA_HOME=str(args.java_home.resolve()),PY5_JAVA_HOME=str(args.java_home.resolve()),PYTHONPATH=str(imported.parent.parent)); load="import json,runpy,py5\nfrom pathlib import Path\nfrom procedurals import triangle_points\nvalue=runpy.run_path('sketch.py',run_name='grain_marks_package_import')\nassert 'GrainMarksSketch' in value and py5.__version__=='0.10.11a0'\nassert str(Path(triangle_points.__file__).resolve())=="+repr(str(imported))+"\nprint(json.dumps({'status':'passed','py5':py5.__version__,'triangle':str(Path(triangle_points.__file__).resolve())}))\n"; py5_result=json.loads(run_with_xvfb([python,"-c",load],cwd=bundled,environment=py5_env).stdout)
    for path,value in before.items():
        if digest(ROOT/path)!=value: raise RuntimeError("source changed during build: "+path)
    report={"status":"passed","scope":"CP5 Python 0.5.0 installed wheel and extracted GrainMarks starter checks; no sketch execution, native render, publication, or support attestation.","package_version":VERSION,"input_sha256":before,"artifacts":{"wheel":{"path":rel(wheel),"sha256":digest(wheel),"entries":entries},"starter_zip":{"path":rel(archive),"sha256":digest(archive),"entries":archive_entries(archive)}},"consumer":consumer_result,"starter":{"transform":transform,"bundled_verified":True,"py5_load":py5_result}}
    (output/"build-result.json").write_text(json.dumps(report,indent=2)+"\n"); print(json.dumps({"status":"passed","wheel":rel(wheel),"starter_zip":rel(archive),"cases":len(consumer_result["cases"])}))
if __name__=="__main__": main()
