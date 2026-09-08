#!/usr/bin/env python3
"""Verify a Java source bundle as a freshly extracted consumer; optional native starter probe."""
from __future__ import annotations
import argparse, hashlib, json, os, subprocess, zipfile, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
ROOT=Path(__file__).resolve().parents[1]
from tools.check_field_marks_pde import NAMES
from tools.run_warp_marks_java import PROFILES
from tools import run_depth_marks_java as DEPTH

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def run(cmd,cwd,timeout=120): return subprocess.run(cmd,cwd=cwd,env={k:v for k,v in os.environ.items() if k not in ('XDG_CONFIG_HOME','SNAP_USER_COMMON','APPDATA')},text=True,capture_output=True,check=True,timeout=timeout)
def fresh(path):
 path=path.resolve()
 if (ROOT/'.work').resolve() not in path.parents or path.exists(): raise RuntimeError('output must be fresh below .work')
 path.mkdir(parents=True);return path
def safe_extract(archive,out):
 with zipfile.ZipFile(archive) as z:
  names=z.namelist()
  if len(names)!=len(set(names)):raise RuntimeError('duplicate ZIP members')
  for n in names:
   p=Path(n)
   if p.is_absolute() or '..' in p.parts or '\\' in n:raise RuntimeError('unsafe ZIP member '+n)
  z.extractall(out)
 return names
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--archive',type=Path,required=True);ap.add_argument('--build-report',type=Path,required=True);ap.add_argument('--java-home',type=Path,required=True);ap.add_argument('--processing-core',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);ap.add_argument('--native',action='store_true');ap.add_argument('--native-sketch',choices=sorted([*PROFILES,'DepthMarks']),default='WarpMarks');a=ap.parse_args()
 out=fresh(a.output);archive=a.archive.resolve();report_path=a.build_report.resolve();jdk=a.java_home.resolve();core=a.processing_core.resolve();tool=Path(__file__).resolve();pre=ROOT/'.work/toolchains/processing-4.5.6/preprocessor';depth=a.native_sketch=='DepthMarks';stem,frame_ids,keys=(DEPTH.IDS[0].replace('baseline','depth-marks'),DEPTH.IDS,DEPTH.KEYS) if depth else PROFILES[a.native_sketch];probe=ROOT/'tests/native'/(a.native_sketch+'Probe.java');inputs=[archive,report_path,tool,ROOT/'packages/java/source-bundle.json',ROOT/'tools/check_field_marks_pde.py',ROOT/'tools/run_warp_marks_java.py',ROOT/'tools/with_native_render_lock.py',core,jdk/'bin/java',jdk/'bin/javac',jdk/'release',jdk/'lib/modules',ROOT/'tests/native/PreprocessSketch.java',probe,*[pre/n for n in NAMES]]
 if depth:
  inputs += [ROOT/'tools/run_depth_marks_java.py',ROOT/'design/capabilities/depth-marks-native-plan.md',ROOT/'packages/java-processing/examples/DepthMarks/DepthMarks.pde',*DEPTH.check_runtime()]
 for p in inputs:
  if not p.is_file():raise RuntimeError('missing input '+str(p))
 before={str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p):sha(p) for p in inputs};members=safe_extract(archive,out/'extract');base=out/'extract/procedurals';manifest=json.loads((ROOT/'packages/java/source-bundle.json').read_text());build=json.loads(report_path.read_text());jar=base/'library/procedurals.jar';adapter=base/'library/procedurals-processing-adapter.jar'
 if build.get('status') != 'built-development-source-bundle' or build.get('input_sha256_before') != build.get('input_sha256_after'):raise RuntimeError('source build is incomplete or unstable')
 if sha(core)!=manifest['processing_core_sha256']:raise RuntimeError('Processing core differs from manifest')
 if build['input_sha256_before'].get('packages/java/source-bundle.json')!=sha(ROOT/'packages/java/source-bundle.json'):raise RuntimeError('manifest differs from source build')
 if build['archive']['sha256']!=sha(archive):raise RuntimeError('build report/archive hash mismatch')
 with zipfile.ZipFile(jar) as z:
  if set(z.namelist())!=set(build['class_sha256']):raise RuntimeError('core JAR member set mismatch')
  for name,expected in build['class_sha256'].items():
   if hashlib.sha256(z.read(name)).hexdigest()!=expected:raise RuntimeError('core class mismatch '+name)
 with zipfile.ZipFile(adapter) as z:
  if set(z.namelist())!=set(build['adapter_class_sha256']):raise RuntimeError('adapter JAR member set mismatch')
  for name,expected in build['adapter_class_sha256'].items():
   if hashlib.sha256(z.read(name)).hexdigest()!=expected:raise RuntimeError('adapter class mismatch '+name)
 reference=build.get('reference',{})
 reference_root=base/'reference'
 actual_reference={p.relative_to(reference_root).as_posix():sha(p) for p in reference_root.rglob('*') if p.is_file()}
 expected_pages=sorted(name.split('/src/main/java/',1)[1].removesuffix('.java')+'.html' for name in [*manifest['core_sources'],*manifest['adapter_sources']])
 if not reference or actual_reference!=reference.get('sha256'):raise RuntimeError('Java reference inventory/hash mismatch')
 if reference.get('class_pages')!=expected_pages or reference.get('declared_class_pages')!=len(expected_pages):raise RuntimeError('Java reference class coverage mismatch')
 if not {'index.html',*expected_pages}.issubset(actual_reference):raise RuntimeError('Java reference pages missing')
 for name,expected in manifest['core_sources'].items():
  installed=base/'src'/name.removeprefix('packages/java/src/')
  if not installed.is_file() or sha(installed)!=expected:raise RuntimeError('installed source mismatch '+name)
 for name,expected in manifest['adapter_sources'].items():
  installed=base/'adapter-src/main/java'/name.removeprefix('packages/java-processing/src/main/java/')
  if sha(installed)!=expected:raise RuntimeError('installed adapter source mismatch '+name)
 for name in ('LICENSE','THIRD_PARTY_NOTICES.md'):
  if sha(base/name)!=build['input_sha256_before'].get(name):raise RuntimeError('license/provenance mismatch '+name)
 for name,key in [('GlyphMarks.ttf','font_sha256'),('FONT-LICENSE.txt','font_license_sha256')]:
  if sha(base/'examples/GlyphMarks/data'/name)!=manifest[key]:raise RuntimeError('font/provenance mismatch '+name)
 for member,record in manifest['examples'].items():
  installed=out/'extract'/member
  if not installed.is_file() or sha(installed)!=record['sha256']:raise RuntimeError('example mismatch '+member)
 classes=out/'classes';classes.mkdir();cp=os.pathsep.join([str(jar),str(adapter),str(core)]);precp=os.pathsep.join(str(pre/n) for n in NAMES)
 (out/'home').mkdir()
 extracted_before={str(p.relative_to(out)):sha(p) for p in (out/'extract').rglob('*') if p.is_file()}
 run([str(jdk/'bin/javac'),'--release','17','-cp',precp,'-d',str(classes),str(ROOT/'tests/native/PreprocessSketch.java')],out)
 compiled={}
 pdes=sorted((out/'extract').glob('procedurals/examples/**/*.pde'))
 for pde in pdes:
  example=pde.parent;name=pde.stem;generated=out/'generated'/(name+'.java');generated.parent.mkdir(exist_ok=True);run([str(jdk/'bin/java'),'-Duser.home='+str(out/'home'),'-cp',str(classes)+os.pathsep+precp,'PreprocessSketch',str(pde),str(generated),name],out);tabs=sorted(example.glob('*.java'));run([str(jdk/'bin/javac'),'--release','17','-cp',cp,'-d',str(classes),str(generated),*[str(x) for x in tabs]],out);compiled[str(pde.relative_to(out/'extract'))]=sha(generated)
 consumer=out/'Consumer.java';consumer.write_text('''import org.procedurals.raster.*;public class Consumer{public static void main(String[]x)throws Exception{int[] in=new int[]{0xffff0000,0x000000ff};double[] xy=new double[]{.5,0};RasterRemap2D r=RasterRemap2D.remap(2,1,in,1,1,xy);in[0]=0;xy[0]=1;if(r.pixelAt(0)!=0x80800080)throw new AssertionError();int[] copy=r.pixels();copy[0]=0;if(r.pixelAt(0)!=0x80800080)throw new AssertionError();if(!new java.io.File(r.getClass().getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalFile().equals(new java.io.File(x[0]).getCanonicalFile()))throw new AssertionError();System.out.println("ok");}}''');run([str(jdk/'bin/javac'),'--release','17','-cp',str(jar),'-d',str(classes),str(consumer)],out);consumer_result=run([str(jdk/'bin/java'),'-cp',str(classes)+os.pathsep+str(jar),'Consumer',str(jar)],out).stdout.strip()
 native_result=None
 if a.native:
  (out/'native').mkdir()
  if depth:
   depth_environment=os.environ.copy();depth_environment['LIBGL_ALWAYS_SOFTWARE']='1'
   for name in ('XDG_CONFIG_HOME','SNAP_USER_COMMON','APPDATA'):depth_environment.pop(name,None)
   p3d=[DEPTH.P3D_RUNTIME/name for name in DEPTH.JARS]
   extracted_cp=os.pathsep.join(map(str,[classes,adapter,jar,*p3d]))
   run([str(jdk/'bin/javac'),'--release','17','-cp',extracted_cp,'-d',str(classes),str(probe)],out)
   native_process=subprocess.run(['python3',str(ROOT/'tools/with_native_render_lock.py'),'--timeout','120','--','xvfb-run','-a',str(jdk/'bin/java'),'-Duser.home='+str(out/'home'),'-cp',extracted_cp,'DepthMarksProbe',str(out/'native'),str(jar)],cwd=out,env=depth_environment,text=True,capture_output=True,check=True,timeout=150)
   if native_process.stderr and not (DEPTH.KNOWN_STDERR.fullmatch(native_process.stderr) or DEPTH.SHUTDOWN_STDERR.fullmatch(native_process.stderr)):raise RuntimeError('unexpected extracted native diagnostics')
   native_result=json.loads((out/'native/native.json').read_text())
   native_result['process']={'stdout':native_process.stdout,'stderr':native_process.stderr,'exit_code':native_process.returncode}
   native_result['images']=DEPTH.validate_native(native_result,out/'native',jar)
  else:
   run([str(jdk/'bin/javac'),'--release','17','-cp',str(classes)+os.pathsep+cp,'-d',str(classes),str(probe)],out);native_args=[str(out/'native'),str(jar)];native_args += [str(adapter)] if a.native_sketch in ('LayerMarks','MaskMarks','PlacementImageMarks') else [];run(['python3',str(ROOT/'tools/with_native_render_lock.py'),'--timeout','120','--','xvfb-run','-a',str(jdk/'bin/java'),'-Duser.home='+str(out/'home'),'-cp',str(classes)+os.pathsep+cp,a.native_sketch+'Probe',*native_args],out,150)
   native_result=json.loads((out/'native/native.json').read_text())
  if native_result.get('status')!='passed' or native_result.get('frames')!=len(frame_ids) or native_result.get('keys')!=keys or native_result.get('core_code_source')!=str(jar):raise RuntimeError('incomplete extracted native proof')
  if [frame['id'] for frame in native_result.get('frame_records',[])]!=frame_ids:raise RuntimeError('unexpected extracted native frame records')
  if a.native_sketch in ('LayerMarks','MaskMarks') and native_result.get('code_sources')!={'compositor':str(jar),'crossfade':str(jar),'adapter':str(adapter)}:raise RuntimeError('wrong extracted composition workflow class code sources')
  if a.native_sketch=='PlacementImageMarks' and native_result.get('code_sources')!={'placement':str(adapter),'layers':str(adapter),'compositor':str(jar)}:raise RuntimeError('wrong extracted placement image workflow class code sources')
 extracted_after={str(p.relative_to(out)):sha(p) for p in (out/'extract').rglob('*') if p.is_file()}
 if extracted_before!=extracted_after:raise RuntimeError('extracted files changed during consumer validation')
 after={str(p.relative_to(ROOT)) if p.is_relative_to(ROOT) else str(p):sha(p) for p in inputs}
 if before!=after:raise RuntimeError('bound input changed')
 result={'status':'passed','archive_sha256':sha(archive),'members':len(members),'inputs_before':before,'inputs_after':after,'examples_compiled':compiled,'consumer':consumer_result,'native':native_result,'extracted_sha256_before':extracted_before,'extracted_sha256_after':extracted_after,'compiled_classes_sha256':{str(p.relative_to(out)):sha(p) for p in classes.rglob('*.class')}};(out/'report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'status':'passed','report':str(out/'report.json')}))
if __name__=='__main__':main()
