"""Real Python frame state with simulated adapter events, not native rendering."""
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'packages/python'))
from procedurals._drawing_state import FrameState,FrameError

suite=json.loads((ROOT/'fixtures/drawing/fresh-raster-lifecycle.json').read_text())
profile=json.loads((ROOT/'catalog/drawing/fresh-raster-2d.json').read_text())
assert (suite['profile'],suite['version'])==(profile['id'],profile['version'])

for case in suite['cases']:
    frame=FrameState();acquired=released=transferred=attempts=0;owns=False
    if 'test_hook_initial_active_count' in case:
        frame.activate(frame.prepare_begin(suite['environment']))
        frame._count=case['test_hook_initial_active_count'] # Harness-only boundary injection.
        acquired=1;owns=True
    for step in case['steps']:
        action=step['action'];fault=step.get('fault');error=None
        try:
            if action=='begin':
                plan=frame.prepare_begin(step.get('environment',suite['environment']))
                if fault=='capability':frame.fail_begin(plan,'UNSUPPORTED_CAPABILITY')
                if fault=='acquisition':frame.fail_begin(plan,'RESOURCE_FAILURE')
                acquired+=1;owns=True
                if fault=='readiness':frame.fail_begin(plan,'RESOURCE_FAILURE')
                if fault=='initialization':frame.fail_begin(plan,'RENDER_FAILURE')
                frame.activate(plan)
            elif action=='batch':
                commands=step.get('commands')
                if 'repeat' in step:commands=[step['repeat']['command']]*step['repeat']['count']
                plan=frame.prepare_batch(commands)
                for offset,slot in enumerate(plan.slots):
                    if slot['outcome']=='noop':continue
                    attempts+=1
                    if isinstance(fault,dict) and fault.get('native_command_offset')==offset:
                        frame.fail_batch(plan,offset)
                frame.commit_batch(plan)
            elif action=='end':
                plan=frame.prepare_end()
                if fault=='finalization':frame.fail_end(plan)
                frame.complete_end(plan);owns=False;transferred+=1
            elif action=='abort':frame.abort()
            else:raise AssertionError(action)
        except FrameError as e:error={'code':e.code,'commandIndex':e.command_index}
        finally:
            if frame.state=='aborted' and owns:released+=1;owns=False
        assert {'state':frame.state,'error':error}==step['expected'],(case['id'],step,frame.state,error)
        assert acquired==released+transferred+int(owns)
    assert not owns
    assert {'acquired':acquired,'released':released,'transferred':transferred,'native_command_attempts':attempts}==case['expected_final_events'],case['id']

env={'width':640,'height':320,'density':1,'background':0}
command={'kind':'segment2','from':[0,0],'to':[1,1],'width':1,'cap':'round','rgb':0,'opacity8':180}
def active():
    f=FrameState();f.activate(f.prepare_begin(env));return f
def error(action):
    try:action()
    except FrameError as e:return e.code,e.command_index
    raise AssertionError('expected error')

f=FrameState();source=dict(env);begin=f.prepare_begin(source);source['width']=1
assert begin.environment['width']==640
try:begin.environment['width']=1
except TypeError:pass
else:raise AssertionError('mutable begin environment')
f.activate(begin);batch=f.prepare_batch([command]);command['from'][0]=123
assert batch.slots[0]['points'][0][0]==0 and f.count==0
try:batch.slots[0]['points'][0][0]=99
except TypeError:pass
else:raise AssertionError('mutable prepared points')
try:batch.base_index=99
except AttributeError:pass
else:raise AssertionError('mutable plan')
f.commit_batch(batch);assert f.count==1
assert error(lambda:f.commit_batch(batch))==('INVALID_STATE',None) and f.state=='aborted'

f=active();other=active();foreign=other.prepare_batch([])
assert error(lambda:f.commit_batch(foreign))==('INVALID_STATE',None)
assert f.state=='aborted' and other.state=='active';other.abort()
f=active();pending=f.prepare_batch([])
assert error(f.prepare_end)==('INVALID_STATE',None)
assert error(lambda:f.commit_batch(pending))==('INVALID_STATE',None)
f=active();pending=f.prepare_batch([]);f.abort()
assert error(lambda:f.commit_batch(pending))==('INVALID_STATE',None)
f=active();end=f.prepare_end();f.complete_end(end)
assert error(lambda:f.complete_end(end))==('INVALID_STATE',None) and f.state=='completed'
f=active();batch=f.prepare_batch([command])
assert error(lambda:f.fail_batch(batch,None))==('RENDER_FAILURE',None) and f.count==0

class BadLength(list):
    def __len__(self):raise AssertionError('must not call custom length')
class BadIterator(list):
    def __iter__(self):raise AssertionError('must not call custom iterator')
for commands in (BadLength(),BadIterator()):
    f=active();assert error(lambda:f.prepare_batch(commands))==('INVALID_BATCH',None)
    assert f.state=='aborted' and f._pending is None
f=active()
class Reentrant(dict):
    def get(self,key,default=None):
        f.prepare_end()
        return super().get(key,default)
assert error(lambda:f.prepare_batch([Reentrant(command)]))==('INVALID_STATE',None)
assert f.state=='aborted' and f._pending is None
f=active();noop=dict(command,**{'from':[1,1],'to':[1+2**-25,1]})
batch=f.prepare_batch([noop])
assert error(lambda:f.fail_batch(batch,0))==('INVALID_STATE',None)
f=active();commands=[]
class Mutating(dict):
    def get(self,key,default=None):
        commands.clear()
        return super().get(key,default)
commands.append(Mutating(command));batch=f.prepare_batch(commands)
assert len(batch.slots)==batch.input_count==1
f.commit_batch(batch);assert f.count==1;f.abort()

print(json.dumps({'language':'python','lifecycle_cases':len(suite['cases']),
                  'token_immutability_and_deferred_commit':True,
                  'scope':'production pure state with simulated adapter events; no native surface/render evidence'}))
