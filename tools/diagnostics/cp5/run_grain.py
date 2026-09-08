#!/usr/bin/env python3
"""Preflight CP5 privately; --render consumes the registered seven-image attempt."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
PLAN = ROOT / 'evidence/parameter-experiments/cp5-grain/experiment.json'
REPORT = PLAN.with_name('result.json')
SOURCE = ROOT / 'tools/diagnostics/cp5/GrainChoice.java'
PARTITION = ROOT / 'packages/java/src/main/java/org/procedurals/layout/QuadrantPartition2D.java'
BUILD = ROOT / '.work/build/cp5-grain-executor'
OUTPUT = ROOT / '.work/experiments/cp5-grain'
CORE = ROOT / '.work/toolchains/processing-4.5.6/core-4.5.6.jar'
JAVA = ROOT / '.work/toolchains/jdk-17.0.20.1+1/bin'
CASES = ['uniform', 'vertex-biased', 'edge-biased', 'denser', 'recolored', 'strokes', 'region-transfer']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def run(command, timeout):
    process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, start_new_session=True)
    try:
        out, err = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        out, err = process.communicate()
        return {'exit_code': process.returncode, 'stdout': out, 'stderr': err, 'timed_out': True}
    return {'exit_code': process.returncode, 'stdout': out, 'stderr': err, 'timed_out': False}


def checked(command, timeout):
    result = run(command, timeout)
    if result['exit_code'] or result['timed_out']:
        raise RuntimeError(json.dumps(result))
    return result


def validate_numeric(value, status):
    assert value['status'] == status
    assert value['checks'] and all(v is True for v in value['checks'].values())
    profiles = value['profiles']
    assert set(profiles) == set(CASES)
    assert [profiles[c]['count'] for c in CASES[:6]] == [15680,15680,15680,31360,15680,15680]
    assert 40960 <= profiles['region-transfer']['count'] <= 40986
    assert sum(p['count'] for p in profiles.values()) <= 160000
    assert profiles['uniform']['geometry_sha256'] == profiles['recolored']['geometry_sha256'] == profiles['strokes']['geometry_sha256']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render', action='store_true')
    args = parser.parse_args()
    if REPORT.exists() or (OUTPUT.exists() and any(OUTPUT.iterdir())):
        raise RuntimeError('existing CP5 result or attempt must be preserved; no retry or overwrite')
    plan = json.loads(PLAN.read_text())
    assert (plan['id'],plan['render_budget'],plan['attempt_budget']) == ('cp5-grain',7,1)
    assert [v['id'] for v in plan['variants']] == CASES
    assert plan['mark_budget'] == 160000 and plan['attempt_timeout_seconds'] == 180
    assert sha(CORE) == '88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4'
    assert plan['source_sha256'].get(str(SOURCE.relative_to(ROOT))) == sha(SOURCE)
    for relative, expected in plan['source_sha256'].items():
        path = (ROOT / relative).resolve()
        assert path.is_relative_to(ROOT) and sha(path) == expected, relative
    paths = {PLAN,SOURCE,PARTITION,Path(__file__).resolve(),CORE,JAVA/'java',JAVA/'javac'}
    paths.update(ROOT / p for p in plan['source_sha256'])
    before = {str(p.relative_to(ROOT)):sha(p) for p in sorted(paths)}
    BUILD.mkdir(parents=True,exist_ok=True)
    compiled = checked([str(JAVA/'javac'),'--release','8','-cp',str(CORE),'-d',str(BUILD),str(PARTITION),str(SOURCE)],30)
    command = [str(JAVA/'java'),'-cp',str(BUILD)+os.pathsep+str(CORE),'GrainChoice']
    numeric_run = checked(command+['--numeric'],30)
    numeric = json.loads(numeric_run['stdout'])
    validate_numeric(numeric,'passed')
    classes = {str(p.relative_to(ROOT)):sha(p) for p in sorted(BUILD.rglob('*.class'))}
    if not args.render:
        print(json.dumps({'status':'preflight-passed','numeric':numeric,'compilation':compiled}))
        return
    from PIL import Image,ImageChops,ImageStat
    with (ROOT/'.work/processing-render.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        OUTPUT.mkdir(parents=True,exist_ok=True)
        assert not any(OUTPUT.iterdir()) and not REPORT.exists()
        for p,h in {**before,**classes}.items():assert sha(ROOT/p)==h,p
        started=time.monotonic()
        write(OUTPUT/'attempt.json',{'status':'running','executor_pid':os.getpid(),'plan_sha256':sha(PLAN),'attempt':1})
        result={'status':'running','scope':'Private CP5 distribution and retained-content investigation; no public operation conformance or source-pixel reproduction.',
                'input_sha256_before':before,'class_sha256':classes,'numeric':numeric,'compilation':compiled,'cases':[],'visual_review':'pending'}
        write(REPORT,result)
        try:
            observed=run(['xvfb-run','-a']+command+['--render',str(OUTPUT)],180)
            result['process']=observed
            write(OUTPUT/'process.json',observed)
            if observed['exit_code'] or observed['timed_out']:raise RuntimeError('CP5 native attempt failed')
            native=json.loads(observed['stdout'])
            validate_numeric(native,'rendered')
            assert native['profiles']==numeric['profiles'],'render numeric profiles changed'
            result['native']=native
            for case in CASES:
                path=OUTPUT/(case+'.png')
                with Image.open(path) as raw:
                    assert raw.size==(640,640)
                    if 'A' in raw.getbands():assert raw.getchannel('A').getextrema()==(255,255)
                    rgb=raw.convert('RGB')
                    assert any(lo!=hi for lo,hi in rgb.getextrema()),'blank image'
                    metrics=None
                    if case!='uniform':
                        with Image.open(OUTPUT/'uniform.png') as base:diff=ImageChops.difference(rgb,base.convert('RGB'))
                        colors=diff.getcolors(640*640)
                        changed=sum(n for n,color in colors if color!=(0,0,0))
                        metrics={'mean_rgb_normalized':sum(ImageStat.Stat(diff).mean)/(3*255),'changed_fraction':changed/(640*640)}
                result['cases'].append({'id':case,'status':'passed','image':{'path':str(path.relative_to(ROOT)),'sha256':sha(path)},'diff_from_uniform':metrics})
                write(REPORT,result)
            result['input_sha256_after']={p:sha(ROOT/p) for p in before}
            assert result['input_sha256_after']==before
            for p,h in classes.items():assert sha(ROOT/p)==h,p
            result['status']='passed'
        except Exception as error:
            result.update(status='failed',error=str(error))
        finally:
            result['elapsed_seconds']=time.monotonic()-started
            write(REPORT,result)
            write(OUTPUT/'attempt.json',{'status':result['status'],'attempt':1,'result':str(REPORT.relative_to(ROOT))})
        print(json.dumps({'status':result['status'],'cases':len(result['cases']),'error':result.get('error')}))
        if result['status']!='passed':raise SystemExit(1)


if __name__=='__main__':main()
