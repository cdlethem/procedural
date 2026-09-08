#!/usr/bin/env python3
"""Prepare or serially execute the bounded CP10 source-motion parameter investigation."""
import argparse,fcntl,hashlib,json,os,signal,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from tools.check_field_marks_pde import NAMES
from tools.diagnostics.cp10.source_motion_probe import REV,REPO,SOURCE,JDK,CORE
BUILD=ROOT/'.work/parameter-experiments/cp10-spring-response-build'
OUTPUT=ROOT/'.work/parameter-experiments/cp10-spring-response'
BRIEF=ROOT/'evidence/parameter-experiments/cp10-spring-response/experiment.json'
PROBE=ROOT/'tools/diagnostics/cp10/SpringResponseProbe.java'

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return str(p.relative_to(ROOT))
def write(p,v):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(v,indent=2)+'\n')
def command(output,case):return ['xvfb-run','-a',str(JDK/'bin/java'),'-Xmx256m','-Duser.home='+str(output/'home'),'-cp',str(BUILD)+os.pathsep+str(CORE),'SpringResponseProbe',str(output),case['id'],str(case['spring']),str(case['velocity_retention'])]

def prepare():
 if BUILD.exists():raise RuntimeError('Preserve existing build')
 brief=json.loads(BRIEF.read_text());assert brief['status']=='planned' and not brief['attempts']
 original=subprocess.check_output(['git','-C',str(REPO),'show',REV+':'+SOURCE])
 license=subprocess.check_output(['git','-C',str(REPO),'show',REV+':LICENSE'])
 text=original.decode();old='acc.mult(.025);';new='acc.mult(probeSpring);'
 assert text.count(old)==1
 BUILD.mkdir(parents=True);(BUILD/'home').mkdir()
 (BUILD/'UPSTREAM-MIT-LICENSE').write_bytes(license);(BUILD/'Point-original.pde').write_bytes(original)
 pde=BUILD/'SourcePoint.pde';pde.write_text('float probeSpring;\n'+text.replace(old,new)+'\nvoid setup() {}\n')
 libs=[CORE.parent/'preprocessor'/n for n in NAMES];bridge=ROOT/'tests/native/PreprocessSketch.java'
 inputs=[Path(__file__).resolve(),PROBE,BRIEF,CORE,bridge,*libs,JDK/'release',JDK/'bin/java',JDK/'bin/javac',JDK/'lib/modules',JDK/'lib/server/libjvm.so',ROOT/'tools/diagnostics/cp10/source_motion_probe.py']
 before={rel(p):sha(p) for p in inputs};pre=os.pathsep.join(map(str,[CORE,*libs]));commands=[]
 for cmd in [[JDK/'bin/javac','-cp',pre,'-d',BUILD,bridge], [JDK/'bin/java','-Duser.home='+str(BUILD/'home'),'-cp',str(BUILD)+os.pathsep+pre,'PreprocessSketch',pde,BUILD/'SourcePoint.java','SourcePoint'], [JDK/'bin/javac','-cp',CORE,'-d',BUILD,BUILD/'SourcePoint.java',PROBE]]:
  r=subprocess.run(list(map(str,cmd)),cwd=ROOT,text=True,capture_output=True,timeout=60)
  commands.append(dict(argv=list(map(str,cmd)),exit_code=r.returncode,stdout=r.stdout,stderr=r.stderr))
  if r.returncode or r.stderr:
   write(BUILD/'compile-failure.json',dict(status='failed',commands=commands));raise RuntimeError('Compilation failed')
 assert before=={rel(p):sha(p) for p in inputs}
 cases=[dict(id='baseline',spring=brief['baseline']['spring'],velocity_retention=brief['baseline']['velocity_retention']),*brief['values']]
 bound={**before,**{rel(p):sha(p) for p in BUILD.rglob('*') if p.is_file()}}
 write(BUILD/'plan.json',dict(status='ready',owner='root',scope='Source-extracted JAVA2D parameter investigation; no public operation or source-web reproduction.',source_revision=REV,source_path=SOURCE,source_sha256=hashlib.sha256(original).hexdigest(),substitution=[old,new],decay_override='After construction, set each Point.decay to case velocity_retention; random initialization does not affect another retained value.',drawing='640x640 density1; warm background, gray spawn rings14px, ochre2px trails, black2px velocity vector scaled4, blue10px current marks; same every variant.',input_sha256=bound,compile_commands=commands,cases=[dict(**c,output=rel(OUTPUT/c['id']),command=command(OUTPUT/c['id'],c)) for c in cases],ticks=brief['comparison']['ticks'],attempt_budget=7))
 print('Prepared '+rel(BUILD/'plan.json'))

def render():
 plan_path=BUILD/'plan.json';plan=json.loads(plan_path.read_text())
 assert plan['status']=='ready' and plan['owner']=='root' and plan['attempt_budget']==7 and len(plan['cases'])==7
 brief=json.loads(BRIEF.read_text())
 expected=[dict(id='baseline',spring=brief['baseline']['spring'],velocity_retention=brief['baseline']['velocity_retention']),*brief['values']]
 assert [{k:c[k] for k in ('id','spring','velocity_retention')} for c in plan['cases']]==expected
 assert plan['ticks']==[0,1,10,30,60,120]
 bound=plan['input_sha256'];assert all(sha(ROOT/n)==h for n,h in bound.items())
 # The whole batch is reserved once. A failed case remains a consumed attempt.
 if OUTPUT.exists():raise RuntimeError('Preserve prior batch; do not restart')
 with (ROOT/'.work/processing-render.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  lines=subprocess.check_output(['ps','-eo','pid=,comm='],text=True).splitlines()
  if any(l.split()[-1] in ('java','Xvfb') for l in lines if l.split()):raise RuntimeError('Inspect active Java/Xvfb before rendering')
  OUTPUT.mkdir(parents=True)
  batch=dict(status='running',plan_sha256=sha(plan_path),input_sha256=bound,attempts=[])
  write(OUTPUT/'batch.json',batch)
  for case in plan['cases']:
   out=ROOT/case['output'];assert out.parent==OUTPUT and case['command']==command(out,case)
   out.mkdir();(out/'home').mkdir();process=None
   attempt=dict(id=case['id'],status='reserved',command=case['command']);batch['attempts'].append(attempt);write(OUTPUT/'batch.json',batch)
   try:
    assert all(sha(ROOT/n)==h for n,h in bound.items())
    with (out/'stdout.log').open('x') as stdout,(out/'stderr.log').open('x') as stderr:
     process=subprocess.Popen(case['command'],cwd=ROOT,stdout=stdout,stderr=stderr,start_new_session=True)
     attempt.update(status='running',pid=process.pid);write(OUTPUT/'batch.json',batch)
     code=process.wait(timeout=60)
    attempt.update(exit_code=code,stderr=(out/'stderr.log').read_text())
    assert code==0 and not attempt['stderr']
    native=json.loads((out/'native.json').read_text());assert native['status']=='passed' and native['frames']==6 and native['ticks']==120
    assert len(native['records'])==121 and all(r['tick']==i and len(r['sites'])==9 for i,r in enumerate(native['records']))
    assert set(p.name for p in out.glob('*.png'))=={'frame_%05d.png'%t for t in plan['ticks']}
    assert all(sha(ROOT/n)==h for n,h in bound.items())
    attempt.update(status='passed',native_sha256=sha(out/'native.json'),frames={p.name:sha(p) for p in out.glob('*.png')})
   except Exception as e:
    attempt.update(status='failed',error=repr(e))
   finally:
    if process is not None and process.poll() is None:os.killpg(process.pid,signal.SIGKILL);process.wait()
    write(out/'attempt.json',attempt);write(OUTPUT/'batch.json',batch)
   if attempt['status']!='passed':break
  batch['status']='passed' if len(batch['attempts'])==7 and all(a['status']=='passed' for a in batch['attempts']) else 'failed'
  write(OUTPUT/'batch.json',batch)
  print(json.dumps(dict(status=batch['status'],attempts=len(batch['attempts']))))
  if batch['status']!='passed':raise SystemExit(1)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--prepare',action='store_true');p.add_argument('--render',action='store_true');a=p.parse_args()
 if a.prepare==a.render:raise RuntimeError('Choose exactly one of prepare/render')
 if a.prepare:prepare()
 else:render()
if __name__=='__main__':main()
