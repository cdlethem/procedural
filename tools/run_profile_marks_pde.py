#!/usr/bin/env python3
"""Validate or run the one root-registered installed ProfileMarks P3D attempt."""
from __future__ import annotations
import argparse, fcntl, hashlib, json, os, signal, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from tools.build_java_artifacts import java_home
from tools.diagnostics.cp7.run_profiles import ARCHIVE, ARCHIVE_SHA256, JARS, KNOWN_STDERR, RUNTIME

IDS=['baseline','waist','pointed','reset','coarse','reset-after-coarse','end-open','both-open','reset-after-open','recolour','trio','selected-while-trio','final-reset']
KEYS='pp0d0tb0cxp0s'
PROBE=ROOT/'tools/diagnostics/cp7/ProfileMarksProbe.java'
PROBE_BUILD=ROOT/'.work/build/cp7-profile-probe'
PDE_BUILD=ROOT/'.work/build/profile-marks-pde-installed'
INSTALLED=ROOT/'.work/dist/cp7/java/consumer/procedurals/library/procedurals.jar'
ADAPTER=ROOT/'.work/dist/cp7/java/consumer/procedurals/library/procedurals-processing-adapter.jar'
DIST_REPORT=ROOT/'.work/cp7-distribution/result.json'
PDE_REPORT=ROOT/'.work/cp7-distribution/profile-marks-pde.json'
DEFAULT_PLAN=ROOT/'evidence/reproductions/cp7-p3d/plan.json'


def sha(path:Path)->str:
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def rel(path:Path)->str:return str(path.resolve().relative_to(ROOT))
def write(path:Path,value:dict)->None:
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.pending');tmp.write_text(json.dumps(value,indent=2)+'\n');tmp.replace(path)
def safe(root:Path,name:object)->Path|None:
 if not isinstance(name,str) or not name or Path(name).is_absolute():return None
 p=(root/name).resolve()
 try:p.relative_to(root.resolve())
 except ValueError:return None
 return p

def classes(path:Path)->dict[str,str]:
 values={rel(x):sha(x) for x in sorted(path.rglob('*.class')) if x.is_file()}
 if not values:raise RuntimeError('compiled class directory is missing or empty: '+str(path))
 return values
def runtime_bindings()->dict[str,str]:
 if not ARCHIVE.is_file() or sha(ARCHIVE)!=ARCHIVE_SHA256:raise RuntimeError('pinned Processing archive changed or missing')
 paths=[ARCHIVE,PROBE,Path(__file__).resolve(),INSTALLED,ADAPTER,DIST_REPORT,PDE_REPORT]
 for name,expected in JARS.items():
  jar=RUNTIME/name
  if not jar.is_file() or sha(jar)!=expected:raise RuntimeError('coherent CP7 runtime JAR missing or changed: '+str(jar))
  paths.append(jar)
 if any(not p.is_file() for p in paths):raise RuntimeError('installed PDE/probe/runtime prerequisite missing')
 return {rel(p):sha(p) for p in sorted(paths)}
def require_reports()->None:
 dist=json.loads(DIST_REPORT.read_text());pde=json.loads(PDE_REPORT.read_text())
 if dist.get('status')!='passed' or pde.get('status')!='passed':raise RuntimeError('installed CP7 distribution/PDE reports must pass')
 if dist.get('artifacts',{}).get('core',{}).get('sha256')!=sha(INSTALLED):raise RuntimeError('distribution report does not bind installed core')
 installed=pde.get('installed_library')
 if not isinstance(installed,dict) or installed.get('sha256')!=sha(INSTALLED):raise RuntimeError('PDE report does not bind installed core')
 before,after=pde.get('input_sha256_before'),pde.get('input_sha256_after')
 if not isinstance(before,dict) or before!=after:raise RuntimeError('PDE report lacks stable source bindings')
 for name,value in before.items():
  p=safe(ROOT,name)
  if p is None or not p.is_file() or sha(p)!=value:raise RuntimeError('stale PDE compile input: '+str(name))
def all_bindings()->dict[str,str]:
 require_reports();bound=runtime_bindings();bound.update(classes(PROBE_BUILD));bound.update(classes(PDE_BUILD));return bound

def require_plan(path:Path,bound:dict[str,str],home:Path)->tuple[dict,Path,Path]:
 if not path.is_file():raise RuntimeError('root-reviewed ready CP7 ProfileMarks plan is required')
 plan=json.loads(path.read_text());
 if plan.get('status')!='ready':raise RuntimeError('ProfileMarks plan is not ready')
 if plan.get('timeout_seconds')!=180 or plan.get('expected_frames')!=13 or plan.get('expected_normal_calls')!=17392 or plan.get('expected_vertex_calls')!=52176:raise RuntimeError('ProfileMarks plan has unexpected runtime limits')
 if plan.get('keys')!=KEYS or plan.get('frame_ids')!=IDS:raise RuntimeError('ProfileMarks plan state registration differs')
 sources=plan.get('source_sha256')
 if not isinstance(sources,dict) or not sources:raise RuntimeError('ProfileMarks plan needs source_sha256')
 for name,value in sources.items():
  p=safe(ROOT,name)
  if not isinstance(value,str) or len(value)!=64 or p is None or not p.is_file() or sha(p)!=value:raise RuntimeError('plan source binding changed or malformed: '+str(name))
 for name,value in bound.items():
  if sources.get(name)!=value:raise RuntimeError('plan does not bind current required input: '+name)
 output=safe(ROOT,plan.get('output'));result=safe(ROOT,plan.get('result'))
 if output is None or result is None or not output.is_relative_to(ROOT/'.work'):raise RuntimeError('plan output must be a relative .work path and result must remain in repository')
 classpath=os.pathsep.join(map(str,[PROBE_BUILD,PDE_BUILD,*[RUNTIME/n for n in JARS],INSTALLED,ADAPTER]))
 actual=['xvfb-run','-a',str(home/'bin/java'),'-Duser.home='+str(PROBE_BUILD/'home'),'-Djava.io.tmpdir='+str(output/'tmp'),'-cp',classpath,'ProfileMarksProbe',str(output),str(INSTALLED)]
 if plan.get('command')!=actual:raise RuntimeError('plan command differs from actual command')
 return plan,output,result

def png(path:Path)->dict:
 from PIL import Image
 with Image.open(path) as source:
  rgba=source.convert('RGBA')
  if rgba.size!=(640,640) or rgba.getchannel('A').getextrema()!=(255,255):raise RuntimeError('invalid PNG dimensions/alpha: '+path.name)
  if len(rgba.convert('RGB').getcolors(640*640) or [])<2:raise RuntimeError('blank PNG: '+path.name)
 return {'path':rel(path),'sha256':sha(path),'width':640,'height':640,'alpha_opaque':True}
def equal(left:Path,right:Path)->bool:
 from PIL import Image,ImageChops
 with Image.open(left) as a,Image.open(right) as b:return a.size==b.size and ImageChops.difference(a.convert('RGB'),b.convert('RGB')).getbbox() is None

def validate_native(plan:dict,output:Path,bound:dict[str,str])->dict:
 native=json.loads((output/'native.json').read_text())
 expected={'status':'passed','frames':13,'keys':KEYS,'normal_calls':plan['expected_normal_calls'],'vertex_calls':plan['expected_vertex_calls'],'triangle_calls':plan['expected_normal_calls']}
 for key,value in expected.items():
  if native.get(key)!=value:raise RuntimeError('native proof differs: '+key)
 records=native.get('frame_records')
 if not isinstance(records,list) or [x.get('id') if isinstance(x,dict) else None for x in records]!=IDS:raise RuntimeError('native frame IDs differ')
 context=native.get('context')
 if not isinstance(context,dict) or context.get('renderer_class')!='processing.opengl.PGraphics3D' or not all(isinstance(context.get(k),str) and context[k] for k in ('vendor','renderer','version')):raise RuntimeError('native P3D context proof incomplete')
 if Path(native.get('core_code_source','')).resolve()!=INSTALLED.resolve() or Path(native.get('expected_jar','')).resolve()!=INSTALLED.resolve():raise RuntimeError('native core source is not installed JAR')
 if Path(native.get('helper_code_source','')).resolve()!=PDE_BUILD.resolve():raise RuntimeError('helper source differs from installed-tab compilation')
 if native.get('quiet_ms',0)<300:raise RuntimeError('native save quiet observation incomplete')
 images={name:png(output/(name+'.png')) for name in IDS}
 for reset in ('reset','reset-after-coarse','reset-after-open','final-reset'):
  if not equal(output/'baseline.png',output/(reset+'.png')):raise RuntimeError('reset differs from baseline: '+reset)
 if not equal(output/'trio.png',output/'selected-while-trio.png'):raise RuntimeError('trio selection changed rendered pixels')
 saved=sorted(output.glob('profile-marks-*.png'))
 if len(saved)!=1 or not equal(saved[0],output/'final-reset.png'):raise RuntimeError('S-key save missing or differs from final reset')
 if set(output.glob('*.png'))!={output/(name+'.png') for name in IDS}|set(saved):raise RuntimeError('unexpected extra PNG files')
 for name,value in bound.items():
  if sha(ROOT/name)!=value:raise RuntimeError('bound input changed during attempt: '+name)
 return {'native':native,'images':images,'save':{'path':rel(saved[0]),'sha256':sha(saved[0]),'pixels_equal_final_reset':True},'input_sha256_after':{name:sha(ROOT/name) for name in bound}}

def configure_paths(plan_path:Path)->None:
 global PROBE_BUILD,PDE_BUILD,INSTALLED,ADAPTER,DIST_REPORT,PDE_REPORT
 data=json.loads(plan_path.read_text())
 paths=data.get('artifact_paths')
 if paths is None:return
 names={'probe_build','pde_build','installed_core','installed_adapter','distribution_report','pde_report'}
 if not isinstance(paths,dict) or set(paths)!=names:raise RuntimeError('plan artifact_paths incomplete')
 parsed={k:safe(ROOT,v) for k,v in paths.items()}
 if any(v is None or not v.is_relative_to(ROOT/'.work') for v in parsed.values()):raise RuntimeError('artifact paths must remain under .work')
 PROBE_BUILD=parsed['probe_build'];PDE_BUILD=parsed['pde_build'];INSTALLED=parsed['installed_core'];ADAPTER=parsed['installed_adapter'];DIST_REPORT=parsed['distribution_report'];PDE_REPORT=parsed['pde_report']

def main()->None:
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--render',action='store_true');p.add_argument('--java-home');p.add_argument('--plan',type=Path,default=DEFAULT_PLAN);a=p.parse_args();home=java_home(a.java_home);plan_path=a.plan.resolve();plan_path.relative_to(ROOT);configure_paths(plan_path);bound=all_bindings();plan,output,result=require_plan(plan_path,bound,home)
 required_bound=dict(bound);bound=dict(plan['source_sha256']);bound[rel(plan_path)]=sha(plan_path)
 if not a.render:
  print(json.dumps({'status':'validated','scope':'installed ProfileMarks PDE/probe/runtime/plan binding validation only; no render attempted','plan':rel(plan_path),'bound_inputs':len(bound)}));return
 if result.exists() or (output.exists() and any(output.iterdir())):raise RuntimeError('existing ProfileMarks output/result must be preserved; no rerender')
 lock_path=ROOT/'.work/processing-render.lock';lock_path.parent.mkdir(parents=True,exist_ok=True)
 with lock_path.open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if all_bindings()!=required_bound:raise RuntimeError('installed PDE/probe/runtime changed before attempt reservation')
  require_plan(plan_path,required_bound,home);output.mkdir(parents=True,exist_ok=True);attempt=output/'attempt.json'
  with attempt.open('x') as reserved:json.dump({'status':'reserved','attempt_budget':1,'frames':13,'keys':KEYS,'input_sha256':bound},reserved)
  report={'status':'failed','scope':plan.get('scope'),'input_sha256':bound,'visual_review':'pending'};process=None;stdout=output/'stdout.log';stderr=output/'stderr.log'
  try:
   classpath=os.pathsep.join(map(str,[PROBE_BUILD,PDE_BUILD,*[RUNTIME/n for n in JARS],INSTALLED,ADAPTER]));command=['xvfb-run','-a',str(home/'bin/java'),'-Duser.home='+str(PROBE_BUILD/'home'),'-Djava.io.tmpdir='+str(output/'tmp'),'-cp',classpath,'ProfileMarksProbe',str(output.resolve()),str(INSTALLED.resolve())]
   report['command']=command
   (output/'tmp').mkdir()
   with stdout.open('x') as out,stderr.open('x') as err:
    process=subprocess.Popen(command,cwd=ROOT,stdout=out,stderr=err,start_new_session=True);write(attempt,{'status':'running','pid':process.pid,'attempt_budget':1,'frames':13,'keys':KEYS,'input_sha256':bound})
    try:exit_code=process.wait(timeout=180)
    except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait();raise RuntimeError('ProfileMarks PDE attempt timed out')
   observed_stderr=stderr.read_text();report.update(exit_code=exit_code,stdout=stdout.read_text(),stderr=observed_stderr,recognized_stderr=observed_stderr.splitlines())
   if exit_code!=0:raise RuntimeError('ProfileMarks probe exit code '+str(exit_code))
   if observed_stderr and not KNOWN_STDERR.fullmatch(observed_stderr):raise RuntimeError('unexpected ProfileMarks P3D stderr')
   report.update(status='passed',**validate_native(plan,output,bound))
  except Exception as error:report['error']=str(error)
  finally:
   if process is not None and process.poll() is None:os.killpg(process.pid,signal.SIGKILL);process.wait()
   if stdout.exists():report.setdefault('stdout',stdout.read_text())
   if stderr.exists():report.setdefault('stderr',stderr.read_text())
   write(result,report);write(attempt,{'status':report['status'],'attempt_budget':1,'frames':13,'keys':KEYS,'input_sha256':bound})
  print(json.dumps({'status':report['status'],'error':report.get('error'),'visual_review':report['visual_review']}))
  if report['status']!='passed':raise SystemExit(1)
if __name__=='__main__':main()
