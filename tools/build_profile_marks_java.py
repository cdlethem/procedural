#!/usr/bin/env python3
"""Build local Java 0.7.0 ProfileMarks distribution and compile seven PDE starters; no render."""
from __future__ import annotations
import argparse,hashlib,json,os,shutil,subprocess,sys,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from tools.build_java_artifacts import copy,digest,java_home,relative,write,zip_entries
from tools.check_field_marks_pde import NAMES
from tools.check_processing_runtime import CORE_SHA256
VERSION='0.7.0';OUTPUT=ROOT/'.work/dist/cp7/java';STAGING=ROOT/'.work/cp7-distribution/result.json';RUNTIME=ROOT/'.work/toolchains/processing-4.5.6'

def run(cmd,*,cwd,env=None):
 try:return subprocess.run([str(x) for x in cmd],cwd=cwd,env=env,check=True,capture_output=True,text=True,timeout=120)
 except subprocess.CalledProcessError as e:raise RuntimeError('command failed: '+' '.join(map(str,cmd))+'\n'+e.stdout+e.stderr)
def extract(archive:Path,target:Path)->None:
 with zipfile.ZipFile(archive) as z:
  base=target.resolve()
  for i in z.infolist():
   if not (base/i.filename).resolve().is_relative_to(base):raise RuntimeError('unsafe archive entry: '+i.filename)
  z.extractall(target)
def properties()->str:return '''name=Procedurals
category=Utilities
sentence=Evidence-backed portable generative-art operations.
paragraph=Editable Processing sketches and retained generative geometry operations.
url=https://github.com/cdlethem/procedural
version=7
prettyVersion=0.7.0
minRevision=0
maxRevision=
authors=Colin Lethem
maintainer=Colin Lethem
'''
def passed_native(path:Path,required:list[Path])->dict:
 data=json.loads(path.read_text());
 if data.get('status')!='passed' or data.get('results',{}).get('RadialProfileNative',{}).get('status')!='passed' or data.get('results',{}).get('RadialProfileVectors',{}).get('status')!='passed':raise RuntimeError('passed CP7 Java native/vector report required')
 before,after=data.get('source_sha256_before'),data.get('source_sha256_after')
 if not isinstance(before,dict) or before!=after:raise RuntimeError('native report bindings incomplete')
 for source in required:
  name=relative(source)
  if before.get(name)!=digest(source):raise RuntimeError('native report stale or omits '+name)
 return data
def reusable_jars(output:Path,report_path:Path,core_sources:list[Path],adapter_sources:list[Path])->tuple[Path,Path,dict]|None:
 """Reuse only the byte-bound prior core/adapter when every compiled source is identical."""
 if not output.is_dir() or not report_path.is_file(): return None
 report=json.loads(report_path.read_text())
 if report.get('status')!='passed': return None
 bindings=report.get('input_sha256_before')
 if not isinstance(bindings,dict) or bindings!=report.get('input_sha256_after'): return None
 for source in [*core_sources,*adapter_sources]:
  if bindings.get(relative(source))!=digest(source): return None
 core=output/('procedurals-core-'+VERSION+'.jar');adapter=output/('procedurals-processing-adapter-'+VERSION+'.jar')
 artifacts=report.get('artifacts',{})
 if (not core.is_file() or not adapter.is_file() or artifacts.get('core',{}).get('sha256')!=digest(core)
     or artifacts.get('processing_adapter',{}).get('sha256')!=digest(adapter)): return None
 return core,adapter,{'from_output':relative(output),'from_report':relative(report_path),'core_sha256':digest(core),'adapter_sha256':digest(adapter)}
def smoke_source()->str:return '''import java.io.File;import java.util.*;import org.procedurals.mesh.RadialProfile3D;
public final class InstalledProfileSmoke { static void check(boolean b,String m){if(!b)throw new AssertionError(m);} static Map<String,Object> m(){Map<String,Object>x=new LinkedHashMap<String,Object>();x.put("profile",Arrays.<Object>asList(Arrays.<Object>asList(0.0,1.0),Arrays.<Object>asList(1.0,1.0)));x.put("slices",3);x.put("capStart",false);x.put("capEnd",false);x.put("maxFaces",6);return x;} public static void main(String[] a)throws Exception{String expected=new File(a[0]).getCanonicalFile().toURI().toURL().toString();String actual=RadialProfile3D.class.getProtectionDomain().getCodeSource().getLocation().toString();check(expected.equals(actual),"core did not load from installed JAR");RadialProfile3D v=RadialProfile3D.generate(m());check(v.vertexCount()==6&&v.faceCount()==6,"small mesh");double[] b={7,7,7,7,7};v.vertexInto(0L,b,1);check(b[0]==7&&b[4]==7,"buffer ownership");double[] q=v.vertexAt(0L);q[0]=99;check(v.vertexAt(0L)[0]!=99,"fresh triple");System.out.println("code_source="+actual);}}'''

def main()->None:
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--java-home');p.add_argument('--processing-core',type=Path,default=RUNTIME/'core-4.5.6.jar');p.add_argument('--native-report',type=Path,default=ROOT/'evidence/conformance/radial-profile-surface-processing-java.json');p.add_argument('--output-dir',type=Path,default=OUTPUT);p.add_argument('--staging-report',type=Path,default=STAGING);p.add_argument('--reuse-from',type=Path,default=OUTPUT);p.add_argument('--reuse-report',type=Path,default=STAGING);a=p.parse_args();home=java_home(a.java_home);core_runtime=a.processing_core.resolve();libs=[RUNTIME/'preprocessor'/n for n in NAMES]
 output=a.output_dir.resolve();staging=a.staging_report.resolve()
 for target in (output,staging):
  try:target.relative_to(ROOT/'.work')
  except ValueError:raise RuntimeError('output/staging paths must remain under .work')
 if not core_runtime.is_file() or digest(core_runtime)!=CORE_SHA256 or any(not x.is_file() for x in libs):raise RuntimeError('pinned Processing 4.5.6 runtime/preprocessor unavailable')
 if output.exists() or staging.exists():raise RuntimeError('CP7 output/staging exists; preserve it rather than overwrite')
 core_sources=sorted((ROOT/'packages/java/src/main/java').rglob('*.java'));adapter_sources=sorted((ROOT/'packages/java-processing/src/main/java').rglob('*.java'))
 examples={
 'FieldMarks':[ROOT/'packages/java-processing/examples/FieldMarks/FieldMarks.pde',ROOT/'packages/java-processing/examples/FieldMarks/MarkCommands.java',ROOT/'packages/java/examples/FieldMarks/MarkField.java'],
 'PathMarks':[ROOT/'packages/java-processing/examples/PathMarks/PathMarks.pde',ROOT/'packages/java-processing/examples/PathMarks/PathMarksCanvas.java',ROOT/'packages/java-processing/examples/PathMarks/README.md',ROOT/'packages/java/examples/PathMarks/PathMarkComposition.java'],
 'PlacementMarks':[ROOT/'packages/java-processing/examples/PlacementMarks/PlacementMarks.pde',ROOT/'packages/java/examples/PlacementMarks/PlacementComposition.java'],
 'RegionMarks':[ROOT/'packages/java-processing/examples/RegionMarks/RegionMarks.pde',ROOT/'packages/java/examples/RegionMarks/RegionComposition.java'],
 'GrainMarks':[ROOT/'packages/java-processing/examples/GrainMarks/GrainMarks.pde',ROOT/'packages/java/examples/GrainMarks/GrainComposition.java'],
 'BranchMarks':[ROOT/'packages/java-processing/examples/BranchMarks/BranchMarks.pde',ROOT/'packages/java/examples/BranchMarks/BranchComposition.java'],
 'ProfileMarks':[ROOT/'packages/java-processing/examples/ProfileMarks/ProfileMarks.pde',ROOT/'packages/java/examples/ProfileMarks/ProfileComposition.java']}
 notices=[ROOT/'LICENSE',ROOT/'THIRD_PARTY_NOTICES.md'];docs=[ROOT/'docs/profile-marks.md',ROOT/'docs/installing-profile-marks.md'];mesh=ROOT/'packages/java/src/main/java/org/procedurals/mesh/RadialProfile3D.java';fixture=ROOT/'fixtures/operations/radial-profile-surface.json';catalog=ROOT/'catalog/operations/radial-profile-surface.json';native=a.native_report.resolve();bridge=ROOT/'tests/native/PreprocessSketch.java'
 if any(not x.is_file() for x in [*core_sources,*adapter_sources,*(x for v in examples.values() for x in v),*notices,*docs,mesh,fixture,catalog,native,bridge,core_runtime,*libs]):raise FileNotFoundError('CP7 distribution input missing')
 native_data=passed_native(native,[mesh,fixture,catalog,ROOT/'tests/native/RadialProfileNative.java',ROOT/'tools/run_radial_profile_java.py'])
 if json.loads(fixture.read_text()).get('catalog_sha256')!=digest(catalog):raise RuntimeError('CP7 fixture catalog binding stale')
 inputs=[*core_sources,*adapter_sources,*(x for v in examples.values() for x in v),*notices,*docs,mesh,fixture,catalog,native,bridge,core_runtime,*libs,ROOT/'tools/build_java_artifacts.py',ROOT/'tools/check_field_marks_pde.py',ROOT/'tools/check_processing_runtime.py',ROOT/'tools/build_profile_marks_java.py',ROOT/'tools/check_profile_marks_pde.py'];before={relative(x):digest(x) for x in inputs}
 build=output/'build';classes=build/'core';adapter_classes=build/'adapter';classes.mkdir(parents=True);adapter_classes.mkdir();core=output/('procedurals-core-'+VERSION+'.jar');adapter=output/('procedurals-processing-adapter-'+VERSION+'.jar')
 reused=reusable_jars(a.reuse_from.resolve(),a.reuse_report.resolve(),core_sources,adapter_sources)
 if reused:
  old_core,old_adapter,reuse_info=reused;copy(old_core,core);copy(old_adapter,adapter)
 else:
  reuse_info=None;run([home/'bin/javac','--release','8','-d',classes,*core_sources],cwd=build)
  for n in notices:copy(n,classes/'META-INF'/n.name)
  run([home/'bin/jar','cf',core,'-C',classes,'.'],cwd=build)
  run([home/'bin/javac','--release','8','-cp',os.pathsep.join(map(str,[core,core_runtime])),'-d',adapter_classes,*adapter_sources],cwd=build)
  for n in notices:copy(n,adapter_classes/'META-INF'/n.name)
  run([home/'bin/jar','cf',adapter,'-C',adapter_classes,'.'],cwd=build)
 library=build/'procedurals';copy(core,library/'library/procedurals.jar');copy(adapter,library/'library/procedurals-processing-adapter.jar');write(library/'library.properties',properties())
 for name,files in examples.items():
  for source in files:copy(source,library/'examples'/name/source.name)
 for source in docs:copy(source,library/'docs'/source.name)
 for n in notices:copy(n,library/n.name)
 entries=[{'path':str(x.relative_to(build)),'sha256':digest(x)} for x in sorted(library.rglob('*')) if x.is_file()];starter=output/('procedurals-processing-'+VERSION+'.zip')
 with zipfile.ZipFile(starter,'w',zipfile.ZIP_DEFLATED) as z:
  for item in entries:z.write(build/item['path'],item['path'])
 consumer=output/'consumer';extract(starter,consumer);installed=consumer/'procedurals';installed_core=installed/'library/procedurals.jar';installed_adapter=installed/'library/procedurals-processing-adapter.jar'
 if digest(installed_core)!=digest(core) or digest(installed_adapter)!=digest(adapter):raise RuntimeError('installed JAR byte mismatch')
 for name,files in examples.items():
  for source in files:
   if digest(installed/'examples'/name/source.name)!=digest(source):raise RuntimeError('installed editable tab differs: '+name+'/'+source.name)
 consumer_classes=consumer/'classes';consumer_classes.mkdir();smoke=consumer/'InstalledProfileSmoke.java';write(smoke,smoke_source());run([home/'bin/javac','--release','8','-cp',installed_core,'-d',consumer_classes,smoke],cwd=consumer);smoke_result=run([home/'bin/java','-cp',os.pathsep.join(map(str,[consumer_classes,installed_core])),'InstalledProfileSmoke',installed_core],cwd=consumer)
 pre=os.pathsep.join(map(str,[core_runtime,*libs]));run([home/'bin/javac','-cp',pre,'-d',consumer_classes,bridge],cwd=consumer);env=os.environ.copy();[env.pop(k,None) for k in ('XDG_CONFIG_HOME','SNAP_USER_COMMON','APPDATA')];home_dir=consumer/'home';home_dir.mkdir();cp=os.pathsep.join(map(str,[core_runtime,installed_core,installed_adapter]));generated={}
 for name,files in examples.items():
  example=installed/'examples'/name;pde=next(x for x in files if x.suffix=='.pde');generated_source=consumer/(name+'.java');run([home/'bin/java','-Duser.home='+str(home_dir),'-cp',str(consumer_classes)+os.pathsep+pre,'PreprocessSketch',example/pde.name,generated_source,name],cwd=consumer,env=env);tabs=sorted(example.glob('*.java'));run([home/'bin/javac','--release','17','-cp',cp,'-d',consumer_classes,generated_source,*tabs],cwd=consumer);generated[name]=digest(generated_source)
 after={relative(x):digest(x) for x in inputs}
 if before!=after:raise RuntimeError('CP7 distribution inputs changed during build')
 report={'status':'passed','package_version':VERSION,'scope':'Staged local Java core/Processing library archive, installed-JAR smoke, and official Processing 4.5.6 compilation of seven PDE starters only; no renderer, native installation acceptance, or other-target claim.','input_sha256_before':before,'input_sha256_after':after,'artifacts':{k:{'path':relative(v),'sha256':digest(v),'entries':zip_entries(v)} for k,v in [('core',core),('processing_adapter',adapter),('starter',starter)]},'core_adapter_reuse':reuse_info,'library_layout':{'root':'procedurals','examples':sorted(examples),'documentation':[relative(x) for x in docs],'included_files':entries},'consumer':{'installed_core_origin':smoke_result.stdout.strip(),'small_mesh_fixture':'P=2,S=3,open','ownership_buffer_passed':True,'official_pde_compilation_passed':sorted(generated),'generated_pde_sha256':generated},'native_cp7_report':{'path':relative(native),'sha256':digest(native),'vectors_status':native_data['results']['RadialProfileVectors']['status'],'native_status':native_data['results']['RadialProfileNative']['status']},'runtime':run([home/'bin/java','-version'],cwd=consumer).stderr.strip()}
 staging.parent.mkdir(parents=True,exist_ok=True);write(staging,json.dumps(report,indent=2)+'\n');write(output/'result.json',json.dumps(report,indent=2)+'\n');print(json.dumps({'status':'passed','staging_evidence':relative(staging),'starter':relative(starter),'reused_core_adapter':reuse_info is not None}))
if __name__=='__main__':main()
