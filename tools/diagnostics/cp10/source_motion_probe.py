#!/usr/bin/env python3
"""Investigate the pinned upstream Point updater without a window or source edits."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import os
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT))
from tools.check_field_marks_pde import NAMES
REV = '69bdd8513e4482a5e6018e36887d4bc208660eb5'
REPO = ROOT / '.work/investigations/cp3-source/repo'
SOURCE = '2018/Generativos/araniaaas/Point.pde'
JDK = ROOT / '.work/toolchains/jdk-17.0.20.1+1'
CORE = ROOT / '.work/toolchains/processing-4.5.6/core-4.5.6.jar'
WRAPPER = '''import processing.core.*;
public final class SourceMotionProbe extends SourcePoint {
  static void require(boolean value, String why) { if (!value) throw new AssertionError(why); }
  void record(String name, int tick, Point p) {
    System.out.println(name+","+tick+","+p.pos.x+","+p.pos.y+","+p.tgt.x+","+p.tgt.y+","+p.vel.x+","+p.vel.y+","+p.decay);
  }
  void runCase(String name, int mouse, float origin, int impulse) {
    randomSeed(42); mouseX=mouse; mouseY=mouse;
    Point p=new Point(new PVector(origin,origin));
    if(impulse==1) p.tgt.x += 100;
    if(impulse==2) p.vel.x = 10;
    record(name,0,p);
    boolean moved=false;
    for(int tick=1;tick<=600;tick++) {
      p.update();
      require(Float.isFinite(p.pos.x)&&Float.isFinite(p.pos.y),"finite source trajectory");
      moved |= p.pos.x!=origin || p.pos.y!=origin;
      if(name.equals("rest-no-pointer")) require(p.pos.x==origin&&p.pos.y==origin&&p.vel.magSq()==0,"no spontaneous motion");
      if(name.equals("origin-pointer-far")) require(p.pos.x==origin&&p.pos.y==origin,"outside pointer reach");
      if(tick==1||tick==10||tick==30||tick==60||tick==120||tick==600) record(name,tick,p);
    }
    if(impulse!=0 || name.equals("origin-pointer-near")) require(moved,"explicit disturbance produces motion");
    if(impulse!=0) require(Math.abs(p.pos.x-origin)<0.01f&&Math.abs(p.vel.x)<0.001f,"settled after explicit disturbance");
  }
  public static void main(String[] args) {
    SourceMotionProbe p=new SourceMotionProbe();
    p.runCase("rest-no-pointer",10000,200,0);
    p.runCase("target-impulse",10000,200,1);
    p.runCase("velocity-impulse",10000,200,2);
    p.runCase("origin-pointer-near",0,100,0);
    p.runCase("origin-pointer-far",0,1000,0);
  }
}
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve(); output.relative_to(ROOT / '.work')
    if output.exists(): raise RuntimeError('Preserve existing investigation attempts')
    def blob(path):
        return subprocess.check_output(['git','-C',str(REPO),'show',REV+':'+path])
    source, license = blob(SOURCE), blob('LICENSE')
    hashes = {SOURCE: hashlib.sha256(source).hexdigest(), 'LICENSE': hashlib.sha256(license).hexdigest(),
              str(CORE.relative_to(ROOT)): hashlib.sha256(CORE.read_bytes()).hexdigest(),
              str(Path(__file__).resolve().relative_to(ROOT)): hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    output.mkdir(parents=True)
    (output/'UPSTREAM-MIT-LICENSE').write_bytes(license)
    (output/'Point.pde').write_bytes(source)
    java = output/'SourceMotionProbe.java'
    java.write_text(WRAPPER)
    pde=output/'SourcePoint.pde'
    pde.write_text(source.decode()+'\nvoid setup() {}\n')
    prelibs=[CORE.parent/'preprocessor'/n for n in NAMES]
    bridge=ROOT/'tests/native/PreprocessSketch.java'
    for path in [bridge,*prelibs]: hashes[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
    pre=os.pathsep.join(map(str,[CORE,*prelibs]))
    (output/'home').mkdir()
    report = dict(status='failed', scope='Native Processing Point source state investigation only; no rendering, public operation, portable semantics or parameter range claim.', revision=REV, inputs_sha256=hashes, commands=[])
    try:
        for cmd in ([str(JDK/'bin/javac'),'-cp',pre,'-d',str(output),str(bridge)],
                    [str(JDK/'bin/java'),'-Duser.home='+str(output/'home'),'-cp',str(output)+os.pathsep+pre,'PreprocessSketch',str(pde),str(output/'SourcePoint.java'),'SourcePoint'],
                    [str(JDK/'bin/javac'),'-cp',str(CORE),'-d',str(output),str(output/'SourcePoint.java'),str(java)],
                    [str(JDK/'bin/java'),'-Djava.awt.headless=true','-cp',str(output)+':'+str(CORE),'SourceMotionProbe']):
            r=subprocess.run(cmd,text=True,capture_output=True,timeout=60,cwd=ROOT)
            report['commands'].append(dict(argv=cmd,exit_code=r.returncode,stdout=r.stdout,stderr=r.stderr))
            if r.returncode or r.stderr: raise RuntimeError('Source investigation compile/run failed')
        records=[]
        for line in r.stdout.splitlines():
            name,tick,*values=line.split(',')
            records.append(dict(case=name,tick=int(tick),**dict(zip(['x','y','target_x','target_y','velocity_x','velocity_y','decay'],map(float,values)))))
        report.update(status='passed',records=records,cases=5,ticks_per_case=600)
    except Exception as error:
        report['error']=str(error)
    finally:
        (output/'result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(dict(status=report['status'],error=report.get('error'),report=str(output/'result.json'))))
    if report['status']!='passed': raise SystemExit(1)


if __name__=='__main__': main()
