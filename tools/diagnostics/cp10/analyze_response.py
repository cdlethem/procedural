#!/usr/bin/env python3
"""Measure every registered frame and complete native trajectory without rerendering."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[3]
RAW=ROOT/'.work/parameter-experiments/cp10-spring-response'
DEST=ROOT/'evidence/parameter-experiments/cp10-spring-response/results.json'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def reversals(values):
 prior=0;out=[]
 for tick,value in enumerate(values):
  sign=(value>0)-(value<0)
  if sign and prior and sign!=prior:out.append(tick)
  if sign:prior=sign
 return out

def main():
 if DEST.exists():raise RuntimeError('Preserve existing analysis')
 batch=json.loads((RAW/'batch.json').read_text());assert batch['status']=='passed' and len(batch['attempts'])==7
 cases=[]
 for a in batch['attempts']:
  d=RAW/a['id'];assert sha(d/'native.json')==a['native_sha256']
  native=json.loads((d/'native.json').read_text());records=native['records'];assert len(records)==121
  x=[r['sites'][0][0] for r in records];vel=[r['sites'][0][4] for r in records]
  perframe=[]
  for file,h in sorted(a['frames'].items()):
   assert sha(d/file)==h
   with Image.open(d/file) as im,Image.open(RAW/'baseline'/file) as base:
    assert im.size==base.size==(640,640)
    diff=ImageChops.difference(im.convert('RGB'),base.convert('RGB'))
    hist=diff.histogram();mae=sum((i%256)*n for i,n in enumerate(hist))/(640*640*3*255)
    r,g,b=diff.split();anydiff=ImageChops.lighter(ImageChops.lighter(r,g),b)
    changed=1-anydiff.histogram()[0]/(640*640)
   perframe.append(dict(tick=int(file[6:11]),path=str((d/file).relative_to(ROOT)),sha256=h,mae_rgb_normalized=mae,changed_pixel_fraction=changed))
  cases.append(dict(id=a['id'],spring=native['spring'],velocity_retention=native['retention'],max_x_displacement=max(v-x[0] for v in x),peak_tick=max(range(len(x)),key=lambda i:x[i]),velocity_sign_reversals=reversals(vel),step_direction_reversals=reversals([0]+[x[i]-x[i-1] for i in range(1,len(x))]),samples=[dict(tick=t,x=x[t],velocity=vel[t],target_x=records[t]['sites'][0][2]) for t in [0,1,10,30,60,120]],frames=perframe,native_sha256=sha(d/'native.json')))
 result=dict(status='measured',scope='All seven registered source-motion cases; state metrics for first site, full nine-site native records retained. Pixel metrics against authored investigation baseline, not survey imagery.',batch_path=str((RAW/'batch.json').relative_to(ROOT)),batch_sha256=sha(RAW/'batch.json'),analysis_sha256=sha(Path(__file__)),cases=cases,visual_review='pending')
 DEST.write_text(json.dumps(result,indent=2)+'\n')
 for c in cases:print(c['id'],'peak',c['max_x_displacement'],'tick',c['peak_tick'],'reversals',c['step_direction_reversals'],'x120',c['samples'][-1]['x'])
if __name__=='__main__':main()
