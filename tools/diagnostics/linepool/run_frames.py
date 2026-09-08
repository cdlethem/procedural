#!/usr/bin/env python3
"""Run the registered private line-pool comparison after root source review."""
import fcntl,hashlib,json,os,signal,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from tools.diagnostics.cp7.run_profiles import JARS,RUNTIME,KNOWN_STDERR
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
experiment=ROOT/'evidence/parameter-experiments/line-pool-controls/experiment.json'
review=ROOT/'evidence/parameter-experiments/line-pool-controls/prototype-review.json'
source=ROOT/'tools/diagnostics/linepool/LinePoolPrototype.java'
renderer=ROOT/'tools/diagnostics/linepool/LinePoolFrames.java'
out=ROOT/'.work/experiments/line-pool-controls'
build=ROOT/'.work/build/line-pool-controls'
jdk=ROOT/'.work/toolchains/jdk-17.0.20.1+1'
if out.exists() or build.exists():raise RuntimeError('Preserve existing attempts')
e=json.loads(experiment.read_text());r=json.loads(review.read_text())
assert e['status']=='planned' and r['status']=='accepted_for_experiment' and r['reviewer']=='root'
for n,v in r['sha256'].items():assert sha(ROOT/n)==v,n
bound={str(p.relative_to(ROOT)):sha(p) for p in [source,renderer,Path(__file__),experiment,review,jdk/'bin/java',jdk/'bin/javac',jdk/'lib/modules']}
for n,v in JARS.items():
 p=RUNTIME/n;assert sha(p)==v,n;bound[str(p.relative_to(ROOT))]=v
build.mkdir(parents=True)
cp=os.pathsep.join(str(RUNTIME/n) for n in JARS)
c=subprocess.run([str(jdk/'bin/javac'),'-cp',cp,'-d',str(build),str(source),str(renderer)],capture_output=True,text=True)
(build/'compile.json').write_text(json.dumps({'exit':c.returncode,'stdout':c.stdout,'stderr':c.stderr},indent=2))
if c.returncode:raise RuntimeError(c.stderr)
for p in build.glob('*.class'):bound[str(p.relative_to(ROOT))]=sha(p)
with (ROOT/'.work/processing-render.lock').open('a') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 for name in ['java','Xvfb']:
  if subprocess.run(['pgrep','-x',name],capture_output=True).returncode==0:raise RuntimeError('Native runtime busy: '+name)
 out.mkdir(parents=True);(out/'home').mkdir();(out/'tmp').mkdir()
 cmd=['xvfb-run','-a',str(jdk/'bin/java'),'-Xmx512m','-Duser.home='+str(out/'home'),'-Djava.io.tmpdir='+str(out/'tmp'),'-cp',str(build)+os.pathsep+cp,'LinePoolFrames',str(out)]
 plan={'source_sha256':bound,'command':cmd,'timeout_seconds':180,'scope':'registered five-case implementation experiment'}
 (out/'plan.json').write_text(json.dumps(plan,indent=2)+'\n')
 result={**plan,'status':'failed'};started=time.monotonic()
 try:
  with (out/'stdout.txt').open('w') as stdout,(out/'stderr.txt').open('w') as stderr:
   p=subprocess.Popen(cmd,cwd=ROOT,stdout=stdout,stderr=stderr,start_new_session=True)
   try:code=p.wait(timeout=180)
   except subprocess.TimeoutExpired:
    os.killpg(p.pid,signal.SIGKILL);p.wait();raise RuntimeError('Timeout; all scheduled cases count as attempted')
  assert code==0,'Native process failure'
  err=(out/'stderr.txt').read_text()
  assert not err or KNOWN_STDERR.fullmatch(err),'Unexpected native diagnostics'
  native=json.loads((out/'native.json').read_text());assert native['status']=='passed' and native['frames']==5
  from PIL import Image,ImageChops,ImageStat
  base=Image.open(out/'baseline.png').convert('RGB');assert base.size==(960,960)
  values=[]
  for case in native['cases']:
   name=case['id'];path=out/(name+'.png');im=Image.open(path).convert('RGB');assert im.size==base.size
   assert im.getextrema()!=((10,10),(10,10),(21,21)),'Blank frame'
   diff=ImageChops.difference(base,im);mean=sum(ImageStat.Stat(diff).mean)/3
   changed=sum(any(rgb) for rgb in diff.getdata())/(960*960)
   values.append({**case,'image_sha256':sha(path),'mean_absolute_rgb_0_255':mean,'changed_pixel_fraction':changed})
  for n,v in bound.items():assert sha(ROOT/n)==v,n
  result.update(status='passed',cases=values)
 except Exception as error:result['error']=str(error)
 finally:
  result['wall_seconds']=time.monotonic()-started
  (out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps({k:result[k] for k in ['status','wall_seconds','error'] if k in result}))
