#!/usr/bin/env python3
"""Check drawing-profile schemas and provenance, not semantic/native conformance."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from tools.drawing_native_evidence import check_native


def check(root=ROOT):
    errors=[]
    profiles=sorted((root/'catalog/drawing').glob('*.json'))
    if not profiles:
        return ['No drawing profiles found']
    identities=set()
    for path in profiles:
        profile=json.loads(path.read_text())
        prefix=path.name
        required={'id','version','status','kind','admission','decisions','provenance',
                  'environment_schema','command_schema','batch_schema','limits','numerics',
                  'rendering','lifecycle','validation_order','errors','error_result',
                  'targets','verification','review'}
        if missing:=required-profile.keys():
            errors.append(f'{prefix}: missing fields {sorted(missing)}')
            continue
        if profile['id'] in identities:
            errors.append(f'{prefix}: duplicate identity')
        identities.add(profile['id'])
        if profile['kind']!='drawing-profile' or profile['status'] not in ('draft','reviewed'):
            errors.append(f'{prefix}: invalid kind/status')
        if profile['status']=='reviewed' and profile['review'].get('status')!='accepted':
            errors.append(f'{prefix}: reviewed contract lacks accepted review record')
        for relative in profile['decisions']:
            if not (root/relative).is_file():errors.append(f'{prefix}: missing decision {relative}')
        for evidence in profile['provenance']:
            source=root/evidence['notes_path']
            if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest()!=evidence['sha256']:
                errors.append(f'{prefix}: stale provenance {evidence["notes_path"]}')
        schemas={}
        for name in ('environment','command','batch'):
            schema=profile[name+'_schema']
            try:
                Draft202012Validator.check_schema(schema)
                schemas[name]=Draft202012Validator(schema)
            except Exception as exc:
                errors.append(f'{prefix}: invalid {name} schema: {exc}')
        if profile['batch_schema'].get('items')!=profile['command_schema']:
            errors.append(f'{prefix}: batch command schema drift')
        if profile['batch_schema'].get('maxItems')!=profile['limits']['max_batch_commands']:
            errors.append(f'{prefix}: batch limit drift')
        for name in ('width','height'):
            if profile['environment_schema']['properties'][name].get('maximum')!=profile['limits']['max_surface_axis']:
                errors.append(f'{prefix}: surface limit drift')
        if profile['environment_schema']['properties']['density'].get('const')!=profile['limits']['density']:
            errors.append(f'{prefix}: density drift')
        targets=profile['targets']
        if set(targets)!={'processing-java','p5js','py5','processing-android'}:
            errors.append(f'{prefix}: missing or unexpected target')
        for name,target in targets.items():
            if not target.get('backend'):errors.append(f'{prefix}: missing backend for {name}')
            if target.get('native_status')=='unvalidated' and target.get('evidence')==[]:
                continue
            errors.extend(f'{prefix}: {error}' for error in check_native(root,profile,name,target))
        for key,relative in profile['verification'].items():
            if key!='scope' and not (root/relative).is_file():
                errors.append(f'{prefix}: missing verification artifact {relative}')
        fixture_path=root/profile['verification']['schema_fixtures']
        if not fixture_path.is_file():continue
        fixture=json.loads(fixture_path.read_text())
        if (fixture.get('profile'),fixture.get('version'))!=(profile['id'],profile['version']):
            errors.append(f'{prefix}: fixture identity/version mismatch')
        seen=set()
        for case in fixture.get('cases',[]):
            if case['id'] in seen:errors.append(f'{prefix}: duplicate fixture ID {case["id"]}')
            seen.add(case['id'])
            validator=schemas.get(case['surface'])
            if validator is None or validator.is_valid(case['value'])!=case['valid']:
                errors.append(f'{prefix}: schema fixture mismatch {case["id"]}')
        if not seen:errors.append(f'{prefix}: empty schema fixtures')
        semantic_path=root/profile['verification'].get('semantic_fixtures','missing')
        if semantic_path.is_file():
            semantic=json.loads(semantic_path.read_text())
            if (semantic.get('profile'),semantic.get('version'))!=(profile['id'],profile['version']):
                errors.append(f'{prefix}: semantic fixture identity/version mismatch')
            ids=[c['id'] for c in semantic.get('cases',[])]
            if not ids or len(ids)!=len(set(ids)):
                errors.append(f'{prefix}: empty or duplicate semantic cases')
            for case in semantic.get('cases',[]):
                if case.get('expected') not in ('emit','noop','INVALID_COMMAND'):
                    errors.append(f'{prefix}: unknown semantic expectation {case["id"]}')
            # These are metadata checks only. Executing the semantic suite requires
            # the future portable validator; never count this as conformance.
        normalized_path=root/profile['verification'].get('normalized_fixtures','missing')
        if normalized_path.is_file():
            normalized=json.loads(normalized_path.read_text())
            if (normalized.get('profile'),normalized.get('version'))!=(profile['id'],profile['version']):
                errors.append(f'{prefix}: normalized fixture identity/version mismatch')
            hashes=normalized.get('input_sha256',{})
            if not hashes:errors.append(f'{prefix}: normalized fixture lacks source bindings')
            for relative,expected in hashes.items():
                source=root/relative
                if not source.is_file() or hashlib.sha256(source.read_bytes()).hexdigest()!=expected:
                    errors.append(f'{prefix}: stale normalized fixture input {relative}')
    return errors


if __name__=='__main__':
    failures=check()
    if failures:
        raise SystemExit('\n'.join(failures))
    print('Drawing schemas, provenance and schema fixtures valid; draft/review status does not establish semantic or native conformance.')
