#!/usr/bin/env python3
"""Preprocess and compile ProfileMarks against pinned Processing 4.5.6; never render."""
from __future__ import annotations
import argparse, hashlib, json, os, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT))
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256
from tools.run_grid_conformance import java_home, run

def sha(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()
def bound_jar(jar:Path|None,report:Path|None)->Path|None:
 if (jar is None)!=(report is None):raise RuntimeError('supply --library-jar and --distribution-report together')
 if jar is None:return None
 jar=jar.resolve();report=report.resolve();jar.relative_to(ROOT);report.relative_to(ROOT)
 data=json.loads(report.read_text())
 if data.get('status')!='passed' or data.get('artifacts',{}).get('core',{}).get('sha256')!=sha(jar):raise RuntimeError('installed JAR is not bound by passed staging report')
 before,after=data.get('input_sha256_before'),data.get('input_sha256_after')
 if not isinstance(before,dict) or before!=after:raise RuntimeError('distribution bindings incomplete')
 for name,value in before.items():
  source=(ROOT/name).resolve();source.relative_to(ROOT)
  if not source.is_file() or sha(source)!=value:raise RuntimeError('stale distribution input: '+name)
 return jar

def main()->None:
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--java-home');p.add_argument('--library-jar',type=Path);p.add_argument('--distribution-report',type=Path);p.add_argument('--output',type=Path,default=ROOT/'.work/cp7-distribution/profile-marks-pde.json');p.add_argument('--build-dir',type=Path);a=p.parse_args()
 home=java_home(a.java_home);jar=bound_jar(a.library_jar,a.distribution_report)
 runtime=ROOT/'.work/toolchains/processing-4.5.6';core=runtime/'core-4.5.6.jar';libs=[runtime/'preprocessor'/n for n in NAMES]
 if not core.is_file() or sha(core)!=CORE_SHA256 or any(not x.is_file() for x in libs):raise RuntimeError('pinned Processing 4.5.6 preprocessor/runtime unavailable')
 root_pde=ROOT/'packages/java-processing/examples/ProfileMarks/ProfileMarks.pde';root_tab=ROOT/'packages/java/examples/ProfileMarks/ProfileComposition.java'
 if jar:
  example=jar.parent.parent/'examples/ProfileMarks';pde,tab=example/'ProfileMarks.pde',example/'ProfileComposition.java'
  if not pde.is_file() or not tab.is_file() or sha(pde)!=sha(root_pde) or sha(tab)!=sha(root_tab):raise RuntimeError('installed ProfileMarks tabs differ from checkout')
 else:pde,tab=root_pde,root_tab
 bridge=ROOT/'tests/native/PreprocessSketch.java';build=(a.build_dir.resolve() if a.build_dir else ROOT/('.work/build/profile-marks-pde'+('-installed' if jar else '')))
 try:build.relative_to(ROOT/'.work')
 except ValueError:raise RuntimeError('--build-dir must remain under .work')
 if build.exists():raise RuntimeError('refusing to overwrite existing CP7 PDE build')
 build.mkdir(parents=True);(build/'home').mkdir()
 sources=[tab] if jar else [*sorted((ROOT/'packages/java/src/main/java').rglob('*.java')),tab]
 inputs=[*sources,pde,root_pde,root_tab,bridge,core,*libs,Path(__file__).resolve()]+([jar,a.distribution_report.resolve()] if jar else [])
 if any(not x.is_file() for x in inputs):raise FileNotFoundError('missing ProfileMarks compile input')
 before={str(x.relative_to(ROOT)):sha(x) for x in inputs}
 pre=os.pathsep.join(map(str,[core,*libs]));run([home/'bin/javac','-cp',pre,'-d',build,bridge])
 env=os.environ.copy();[env.pop(k,None) for k in ('XDG_CONFIG_HOME','SNAP_USER_COMMON','APPDATA')]
 generated=build/'ProfileMarks.java';run([home/'bin/java','-Duser.home='+str(build/'home'),'-cp',str(build)+os.pathsep+pre,'PreprocessSketch',pde,generated,'ProfileMarks'],env=env)
 cp=os.pathsep.join(map(str,[core,jar] if jar else [core]));run([home/'bin/javac','--release','17','-cp',cp,'-d',build,*sources,generated])
 after={str(x.relative_to(ROOT)):sha(x) for x in inputs}
 if before!=after:raise RuntimeError('sources changed during ProfileMarks compilation')
 report={'status':'passed','scope':'Official Processing 4.5.6 ProfileMarks preprocessing and Java compilation only; no renderer, image, P3D context, lifecycle, or native install claim.','input_sha256_before':before,'input_sha256_after':after,'generated_java_sha256':sha(generated),'class_sha256':sha(build/'ProfileMarks.class'),'runtime':run([home/'bin/java','-version']).stderr.strip(),'installed_library':None if not jar else {'path':str(jar.relative_to(ROOT)),'sha256':sha(jar),'distribution_report':str(a.distribution_report.resolve().relative_to(ROOT))}}
 out=a.output.resolve();out.relative_to(ROOT);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'passed','report':str(out.relative_to(ROOT))}))
if __name__=='__main__':main()
