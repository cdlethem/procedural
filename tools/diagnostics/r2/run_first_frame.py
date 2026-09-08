#!/usr/bin/env python3
"""Measure one complete CityMarks frame; preserve source bindings and failed attempts."""
import fcntl, hashlib, json, os, signal, subprocess, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from tools.diagnostics.cp7.run_profiles import JARS,RUNTIME,KNOWN_STDERR
from tools.run_relief_marks_pde import png
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
stage=ROOT/'.work/examples/r2-candidate1'
jdk=ROOT/'.work/toolchains/jdk-17.0.20.1+1'
probe=ROOT/'tools/diagnostics/r2/CityFirstFrame.java'
build=ROOT/'.work/build/r2-first-frame-attempt2'
out=ROOT/'.work/reproductions/r2-first-frame'
report=ROOT/'evidence/reproductions/r2-p3d/first-frame.json'
if build.exists() or out.exists() or report.exists(): raise RuntimeError('Preserve prior attempts')
s=json.loads((stage/'result.json').read_text())
assert s['status']=='passed' and s['inputs_before']==s['inputs_after']
bound={**s['inputs_after'],**s['artifacts_sha256']}
for n,v in bound.items(): assert sha(ROOT/n)==v,n
for n,v in JARS.items():
 p=RUNTIME/n
 assert sha(p)==v,n
 bound[str(p.relative_to(ROOT))]=v
for p in [probe,Path(__file__),stage/'result.json',ROOT/'design/capabilities/ciscis002-recreation-acceptance.md']:
 bound[str(p.relative_to(ROOT))]=sha(p)
build.mkdir(parents=True)
cp=os.pathsep.join(map(str,[stage/'build',stage/'CityMarks/code/procedurals.jar',*[RUNTIME/n for n in JARS]]))
c=subprocess.run([str(jdk/'bin/javac'),'-cp',cp,'-d',str(build),str(probe)],capture_output=True,text=True)
(build/'compile.json').write_text(json.dumps({'exit':c.returncode,'stdout':c.stdout,'stderr':c.stderr},indent=2))
if c.returncode: raise RuntimeError(c.stderr)
for p in build.glob('*.class'): bound[str(p.relative_to(ROOT))]=sha(p)
with (ROOT/'.work/processing-render.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 for name in ['java','Xvfb']:
  if subprocess.run(['pgrep','-x',name],capture_output=True).returncode==0: raise RuntimeError('Live renderer/runtime: '+name)
 out.mkdir(parents=True)
 (out/'home').mkdir();(out/'tmp').mkdir()
 cmd=['xvfb-run','-a',str(jdk/'bin/java'),'-Xmx512m','-Duser.home='+str(out/'home'),'-Djava.io.tmpdir='+str(out/'tmp'),'-cp',str(build)+os.pathsep+cp,'CityFirstFrame',str(out)]
 plan={'owner':'root','scope':'single full source-density frame; not edit or recreation acceptance','timeout_seconds':180,'input_sha256':bound,'command':cmd}
 report.parent.mkdir(parents=True,exist_ok=True)
 (report.parent/'first-frame-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
 result={**plan,'status':'failed'}
 started=time.monotonic()
 try:
  with (out/'stdout.txt').open('w') as stdout,(out/'stderr.txt').open('w') as stderr:
   p=subprocess.Popen(cmd,cwd=ROOT,stdout=stdout,stderr=stderr,start_new_session=True)
   try: code=p.wait(timeout=180)
   except subprocess.TimeoutExpired:
    os.killpg(p.pid,signal.SIGKILL);p.wait();raise RuntimeError('Full-density render timeout')
  result['exit_code']=code
  if code: raise RuntimeError('Native process failed')
  err=(out/'stderr.txt').read_text()
  if err and not KNOWN_STDERR.fullmatch(err): raise RuntimeError('Unexpected native diagnostics')
  native=json.loads((out/'native.json').read_text())
  assert native['status']=='passed' and native['boxes']==624033 and native['faces']==580
  result['image']=png(out/'baseline.png')
  for n,v in bound.items(): assert sha(ROOT/n)==v,n
  result.update(status='passed',native=native)
 except Exception as e: result['error']=str(e)
 finally:
  result['wall_seconds']=time.monotonic()-started
  report.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({k:result[k] for k in ['status','wall_seconds','native','error'] if k in result}))
