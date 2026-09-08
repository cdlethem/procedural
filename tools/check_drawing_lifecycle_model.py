#!/usr/bin/env python3
"""Execute authored lifecycle scenarios against a reference model, never native drawing."""
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.build_drawing_normalization_fixtures import normalize
from jsonschema import Draft202012Validator


def check():
    profile=json.loads((ROOT/'catalog/drawing/fresh-raster-2d.json').read_text())
    suite=json.loads((ROOT/'fixtures/drawing/fresh-raster-lifecycle.json').read_text())
    assert (suite['profile'],suite['version'])==(profile['id'],profile['version'])
    for case in suite['cases']:
        hooked='test_hook_initial_active_count' in case
        state='active' if hooked else 'new'
        count=case.get('test_hook_initial_active_count',0)
        acquired=1 if hooked else 0
        released=transferred=0
        native_attempts=0
        owns=hooked
        active_environment=suite['environment']
        for step in case['steps']:
            action=step['action'];fault=step.get('fault');error=None
            index=None
            if action=='abort':
                if state=='completed':error='INVALID_STATE'
                else:state='aborted'
            elif (action=='begin' and state!='new') or (action in ('batch','end') and state!='active'):
                error='INVALID_STATE'
            elif action=='begin':
                environment=step.get('environment',suite['environment'])
                if not Draft202012Validator(profile['environment_schema']).is_valid(environment):error='INVALID_ENVIRONMENT'
                elif fault=='capability':error='UNSUPPORTED_CAPABILITY'
                elif fault=='acquisition':error='RESOURCE_FAILURE'
                else:
                    acquired+=1;owns=True
                    if fault=='readiness':error='RESOURCE_FAILURE'
                    elif fault=='initialization':error='RENDER_FAILURE'
                    else:state='active';active_environment=environment
            elif action=='batch':
                commands=step.get('commands')
                if 'repeat' in step:
                    commands=[step['repeat']['command']]*step['repeat']['count']
                if not isinstance(commands,list) or len(commands)>profile['limits']['max_batch_commands'] or count>profile['limits']['max_frame_commands']-len(commands):
                    error='INVALID_BATCH'
                else:
                    validated=[]
                    for offset,command in enumerate(commands):
                        result=normalize(command,active_environment,profile)
                        if result['outcome']=='INVALID_COMMAND':
                            error='INVALID_COMMAND';index=count+offset;break
                        validated.append(result)
                    # Simulated events only. A future adapter must verify these in
                    # its actual runtime; this cannot certify cleanup or rendering.
                    if error is None:
                        for offset,result in enumerate(validated):
                            if result['outcome']=='noop':continue
                            native_attempts+=1
                            if isinstance(fault,dict) and fault.get('native_command_offset')==offset:
                                error='RENDER_FAILURE';index=count+offset;break
                    if error is None:count+=len(commands)
            elif action=='end':
                if fault=='finalization':error='RENDER_FAILURE'
                else:state='completed';owns=False;transferred+=1
            else:raise AssertionError(f'Unknown model action {action}')
            if error and state!='completed':state='aborted'
            if state=='aborted' and owns:
                released+=1;owns=False
            actual={'state':state,'error':None if error is None else {'code':error,'commandIndex':index}}
            assert actual==step['expected'],(case['id'],step,actual)
            assert acquired==released+transferred+int(owns),(case['id'],'ownership accounting')
            assert released<=1 and transferred<=1,(case['id'],'double release/transfer')
        assert not owns,(case['id'],'scenario leaves owned surface')
        events={'acquired':acquired,'released':released,'transferred':transferred,
                'native_command_attempts':native_attempts}
        assert events==case['expected_final_events'],(case['id'],events)
    print(f'{len(suite["cases"])} lifecycle model scenarios pass; simulated events are not native evidence')


if __name__=='__main__':check()
