#!/usr/bin/env python3
"""Run the single registered public PathMarks PDE edit/render attempt."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.run_grid_conformance import java_home,run

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(value,indent=2)+'\n');temp.replace(path)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--render',action='store_true');parser.add_argument('--java-home');parser.add_argument('--plan',type=Path,default=ROOT/'evidence/reproductions/cp2-java2d/pde-plan.json')
    args=parser.parse_args();home=java_home(args.java_home)
    plan_path=args.plan.resolve();plan_path.relative_to(ROOT);plan=json.loads(plan_path.read_text())
    if plan['attempt_budget']!=1 or plan['composition_budget']!=7:raise RuntimeError('unexpected attempt registration')
    output=ROOT/plan['output'];output.mkdir(parents=True,exist_ok=True)
    attempt=output/'attempt.json'
    if attempt.exists():raise RuntimeError('attempt already reserved; inspect terminal/live state')
    if args.render:
        stale=[output/name for name in ['native.json','progress.json','displayed-final.png',*plan['visual_images']] if (output/name).exists()]
        stale+=list(output.glob('path-marks-*.png'))
        if stale:raise RuntimeError('pre-existing native outputs; preserve and inspect before any attempt')
    build_report_path=ROOT/plan.get('build_report','evidence/reproductions/cp2-java2d/pde-build.json')
    run([sys.executable,ROOT/'tools/check_path_marks_pde.py','--java-home',home,'--output',build_report_path])
    build=ROOT/'.work/build/path-marks-pde';core=ROOT/'.work/toolchains/processing-4.5.6/core-4.5.6.jar'
    source=ROOT/'tests/native/PathMarksPdeProbe.java'
    run([home/'bin/javac','--release','17','-cp',f'{build}:{core}','-d',build,source])
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    build_report=json.loads(build_report_path.read_text())
    pure_path=ROOT/'evidence/conformance/path-marks-commands-java.json'
    pure=json.loads(pure_path.read_text())
    if pure.get('status')!='passed' or any(pure.get('result',{}).get(k) is not True for k in ['prefix_passed','distance_feedback_passed','unchanged_movement_passed']):raise RuntimeError('public command proof did not pass required checks')
    for relative,expected in pure['source_sha256'].items():
        if sha(ROOT/relative)!=expected:raise RuntimeError('stale public command proof: '+relative)
    submitted=pure['result']['submitted_commands_by_state']
    if len(submitted)!=7 or any(type(n) is not int or n<=0 for n in submitted):raise RuntimeError('missing visible command counts')
    bindings=dict(build_report['input_sha256'])
    for p in [pure_path,plan_path,source,Path(__file__).resolve(),build_report_path,ROOT/'tools/run_grid_conformance.py']:
        bindings[str(p.relative_to(ROOT))]=sha(p)
    if not args.render:
        print('Actual public PDE and edit harness compiled; no render attempted.');return
    lock_path=ROOT/'.work/processing-render.lock';lock_path.parent.mkdir(parents=True,exist_ok=True)
    with lock_path.open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        with attempt.open('x') as f:json.dump({'status':'reserved','composition_budget':7,'input_sha256':bindings},f)
        report={'status':'failed','scope':plan['scope'],'input_sha256':bindings,'visual_review':'pending'}
        stdout=output/'stdout.log';stderr=output/'stderr.log'
        process=None
        try:
            with stdout.open('w') as out,stderr.open('w') as err:
                process=subprocess.Popen(['xvfb-run','-a',str(home/'bin/java'),f'-Duser.home={build/"home"}',
                    '-cp',f'{build}:{core}','PathMarksPdeProbe',str(output),*[str(n) for n in submitted]],cwd=ROOT,stdout=out,stderr=err,start_new_session=True)
                write(attempt,{'status':'running','pid':process.pid,'composition_budget':7,'input_sha256':bindings})
                try:code=process.wait(timeout=plan['timeout_seconds'])
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid,signal.SIGKILL);process.wait();raise RuntimeError('PDE attempt timed out')
            report.update(exit_code=code,stdout=stdout.read_text(),stderr=stderr.read_text())
            if code!=0:raise RuntimeError('PDE attempt failed')
            native=json.loads((output/'native.json').read_text())
            if native.get('status')!='passed' or native.get('compositions')!=7 or native.get('key_events')!=7 or native.get('save_quiet_ms',0)<300:raise RuntimeError('native checks incomplete')
            from PIL import Image,ImageChops
            images={}
            for name in plan['visual_images']+['displayed-final.png']:
                path=output/name
                with Image.open(path) as im:
                    if im.size!=(640,640) or im.convert('RGBA').getchannel('A').getextrema()!=(255,255):raise RuntimeError('invalid image '+name)
                    if len(im.convert('RGB').getcolors(409600) or [])<2:raise RuntimeError('blank image '+name)
                images[name]={'path':str(path.relative_to(ROOT)),'sha256':sha(path)}
            for changed in ['trace.png','long-marks.png']:
                with Image.open(output/'marks.png') as a,Image.open(output/changed) as b:
                    if ImageChops.difference(a.convert('RGB'),b.convert('RGB')).getbbox() is None:raise RuntimeError('visual edit did not change pixels: '+changed)
            saved=list(output.glob('path-marks-*.png'))
            if len(saved)!=1:raise RuntimeError('expected exactly one actual S-key save')
            with Image.open(saved[0]) as a,Image.open(output/'displayed-final.png') as b:
                if a.size!=b.size or ImageChops.difference(a.convert('RGB'),b.convert('RGB')).getbbox() is not None:raise RuntimeError('saved canvas differs')
            for path,digest in bindings.items():
                if sha(ROOT/path)!=digest:raise RuntimeError('input changed during native attempt: '+path)
            report.update(status='passed',native=native,submitted_commands_by_state=submitted,images=images,save={'path':str(saved[0].relative_to(ROOT)),'sha256':sha(saved[0]),'pixels_equal_displayed':True})
        except Exception as error:
            report['error']=str(error)
        finally:
            if process is not None and process.poll() is None:
                os.killpg(process.pid,signal.SIGKILL);process.wait()
            write(ROOT/plan.get('result','evidence/reproductions/cp2-java2d/pde-result.json'),report)
            write(attempt,{'status':report['status'],'composition_budget':7,'input_sha256':bindings})
        print(json.dumps({'status':report['status'],'error':report.get('error'),'visual_review':report['visual_review']}))
        if report['status']!='passed':raise SystemExit(1)

if __name__=='__main__':main()
