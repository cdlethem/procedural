#!/usr/bin/env python3
"""Compile FacetMarks and run its pure helper check; never launch Processing."""
from __future__ import annotations
import argparse, hashlib, json, os, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.check_field_marks_pde import NAMES

def sha(p:Path)->str:return hashlib.sha256(p.read_bytes()).hexdigest()
def main()->int:
 p=argparse.ArgumentParser();p.add_argument('--build-dir',type=Path,required=True);a=p.parse_args()
 build=a.build_dir.resolve();build.relative_to(ROOT/'.work')
 if build.exists():raise RuntimeError('refusing to reuse build directory')
 java=ROOT/'.work/toolchains/jdk-17.0.20.1+1/bin'; runtime=ROOT/'.work/toolchains/processing-4.5.6'; core=runtime/'core-4.5.6.jar'
 helper=ROOT/'packages/java/examples/FacetMarks/FacetComposition.java'; pde=ROOT/'packages/java-processing/examples/FacetMarks/FacetMarks.pde'; native=ROOT/'tests/native/FacetCompositionNative.java'; bridge=ROOT/'tests/native/PreprocessSketch.java'
 java_sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'))
 inputs=[Path(__file__).resolve(),core,helper,pde,native,bridge,*java_sources,*[runtime/'preprocessor'/n for n in NAMES]]
 before={str(x.relative_to(ROOT)):sha(x) for x in inputs}; build.mkdir(parents=True);(build/'home').mkdir(); commands=[]
 def run(argv):
  env=os.environ.copy();env.pop('APPDATA',None); env.pop('XDG_CONFIG_HOME',None)
  r=subprocess.run([str(x) for x in argv],cwd=ROOT,text=True,capture_output=True,env=env,timeout=120);commands.append({'argv':[str(x) for x in argv],'exit_code':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
  if r.returncode:raise RuntimeError(r.stdout+r.stderr)
 prelibs=[runtime/'preprocessor'/n for n in NAMES]; pre=os.pathsep.join(map(str,[core,*prelibs])); generated=build/'FacetMarks.java'; report={'status':'failed','scope':'Official PDE compilation and pure retained FacetComposition checks only; no Processing launch, renderer, pixel, or delivery claim.','inputs_before':before,'commands':commands}
 try:
  run([java/'javac','-cp',pre,'-d',build,bridge])
  run([java/'java','-Duser.home='+str(build/'home'),'-cp',str(build)+os.pathsep+pre,'PreprocessSketch',pde,generated,'FacetMarks'])
  cp=os.pathsep.join(map(str,[core,build]));run([java/'javac','--release','17','-cp',cp,'-d',build,*java_sources,helper,native,generated])
  run([java/'java','-Djava.awt.headless=true','-cp',cp,'FacetCompositionNative'])
  after={str(x.relative_to(ROOT)):sha(x) for x in inputs}
  if after!=before:raise RuntimeError('inputs changed during compile')
  report.update(status='passed',inputs_after=after,generated_java_sha256=sha(generated))
 finally:(build/'result.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'status':report['status'],'report':str(build/'result.json')}));return 0
if __name__=='__main__':raise SystemExit(main())
