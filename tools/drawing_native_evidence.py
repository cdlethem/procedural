"""Validate source-bound, independently reviewed scoped native drawing claims."""
import hashlib
import json
if __package__:
    from .reviewed_export_extension import historical_export_bytes
else:
    from reviewed_export_extension import historical_export_bytes

ADDITIVE_EXPORT_REVIEW='evidence/reproductions/cp2-export-extension-review.json'
I1_REVIEW='evidence/distribution/i1-review.json'
PURE_PATH_REPORT='evidence/conformance/gradient-path.json'
ADDITIVE_EXPORTS={
    'p5js':{
        'path':'packages/javascript/src/index.js',
        'distribution_report':'evidence/distribution/javascript.json',
        'native_report':'evidence/conformance/p5js-path-marks.json',
        'native_review':'evidence/reproductions/cp2-p5js/review.json',
        'deletions':['export { gradientPath2D, GradientPathError } from "./gradient-path.js";\n'],
        'pure_dependencies':[
            'packages/javascript/src/index.js','packages/javascript/src/gradient-path.js',
            'packages/javascript/src/gradient-noise-2d-01.js','packages/javascript/src/internal/noise-hash.js'],
        'native_dependencies':[
            'packages/javascript/src/index.js','packages/javascript/src/gradient-path.js',
            'packages/javascript/src/gradient-noise-2d-01.js','packages/javascript/src/internal/noise-hash.js',
            'packages/javascript/src/internal/p5-frame.js','packages/javascript/src/internal/drawing.js',
            'packages/javascript/src/internal/drawing-state.js'],
    },
    'py5':{
        'path':'packages/python/procedurals/__init__.py',
        'distribution_report':'evidence/distribution/python.json',
        'native_report':'evidence/reproductions/cp2-py5/result.json',
        'native_review':'evidence/reproductions/cp2-py5/review.json',
        'deletions':['from .paths import GradientPathError, gradient_path_2d\n',
                     '    "GradientPathError",\n','    "gradient_path_2d",\n'],
        'pure_dependencies':[
            'packages/python/procedurals/__init__.py','packages/python/procedurals/paths.py',
            'packages/python/procedurals/fields.py'],
        'native_dependencies':[
            'packages/python/procedurals/__init__.py','packages/python/procedurals/paths.py',
            'packages/python/procedurals/fields.py','packages/python/procedurals/_py5_frame.py',
            'packages/python/procedurals/_drawing.py','packages/python/procedurals/_drawing_state.py'],
    },
}

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def semantics(profile):
    # Support metadata and verification links can change without changing the profile.
    value={k:v for k,v in profile.items() if k not in ('targets','verification','review')}
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def _source_map_matches(root, source_map, required):
    if not isinstance(source_map,dict): return False
    for relative in required:
        if (source_map.get(relative)!=digest(root/relative)
                and historical_export_bytes(root,relative,source_map.get(relative)) is None): return False
    return True

def _accepted_review(value):
    return isinstance(value,dict) and (value.get('status'),value.get('owner'),value.get('reviewer'))==('accepted','root','Sol')

def _remove_exact_lines(value, lines):
    """Remove each authorized addition once; reject duplicate or edited additions."""
    for line in lines:
        if value.count(line)!=1: return None
        value=value.replace(line,'',1)
    return value

def additive_path_export_extension(root,target_name,native_review,relative,expected_historical):
    """Permit only an independently reviewed, byte-reconstructible path export delta."""
    extension=ADDITIVE_EXPORTS.get(target_name)
    if extension is None or relative!=extension['path']:
        return ['native implementation changed: '+relative]
    try:
        supplemental=json.loads((root/ADDITIVE_EXPORT_REVIEW).read_text())
        if not _accepted_review(supplemental):
            return ['additive path export lacks accepted supplemental review']
        required_evidence={I1_REVIEW,PURE_PATH_REPORT}
        for value in ADDITIVE_EXPORTS.values():
            required_evidence.update((value['distribution_report'],value['native_report'],value['native_review']))
        evidence=supplemental.get('evidence_sha256')
        if not isinstance(evidence,dict) or set(evidence)!=required_evidence:
            return ['additive path export supplemental evidence set differs']
        for path,expected in evidence.items():
            if not isinstance(expected,str) or digest(root/path)!=expected:
                return ['additive path export supplemental evidence changed: '+path]
        entries=supplemental.get('extensions')
        if not isinstance(entries,dict) or set(entries)!=set(ADDITIVE_EXPORTS):
            return ['additive path export supplemental extension set differs']
        entry=entries.get(target_name)
        expected_keys={'path','historical_sha256','current_sha256','deletions',
                       'distribution_report','pure_report','native_report','native_review'}
        if not isinstance(entry,dict) or set(entry)!=expected_keys:
            return ['additive path export supplemental extension schema differs']
        if (entry['path']!=relative or entry['historical_sha256']!=expected_historical
                or entry['distribution_report']!=extension['distribution_report']
                or entry['pure_report']!=PURE_PATH_REPORT
                or entry['native_report']!=extension['native_report']
                or entry['native_review']!=extension['native_review']
                or entry['deletions']!=extension['deletions']):
            return ['additive path export supplemental extension binding differs']
        current_bytes=(root/relative).read_bytes()
        current=digest(root/relative)
        if entry['current_sha256']!=current:
            prior=historical_export_bytes(root,relative,entry['current_sha256'])
            if prior is not None:
                current_bytes=prior
                current=hashlib.sha256(prior).hexdigest()
        if entry['current_sha256']!=current:
            return ['additive path export current hash differs: '+relative]
        historical=_remove_exact_lines(current_bytes.decode('utf-8'),extension['deletions'])
        if historical is None or hashlib.sha256(historical.encode()).hexdigest()!=expected_historical:
            return ['additive path export deletion reconstruction differs: '+relative]

        i1=json.loads((root/I1_REVIEW).read_text())
        if not _accepted_review(i1): return ['additive path export I1 review is not accepted']
        distribution=json.loads((root/extension['distribution_report']).read_text())
        if distribution.get('input_sha256',{}).get(relative)!=expected_historical:
            return ['additive path export I1 distribution binding differs: '+relative]
        if i1.get('evidence_sha256',{}).get(extension['distribution_report'])!=digest(root/extension['distribution_report']):
            return ['additive path export I1 review does not bind distribution report']

        pure=json.loads((root/PURE_PATH_REPORT).read_text())
        if pure.get('operation')!='path.gradient-trace-2d':
            return ['additive path export pure operation identity differs']
        pure_sources=pure.get('source_sha256')
        if not _source_map_matches(root,pure_sources,extension['pure_dependencies']):
            return ['additive path export pure source binding differs: '+relative]
        if target_name=='p5js':
            target_sources=pure.get('results',{}).get('javascript',{}).get('sourceSha256')
            if pure.get('results',{}).get('javascript',{}).get('failures')!=0 or not _source_map_matches(root,target_sources,extension['pure_dependencies']):
                return ['additive path export JavaScript pure binding differs']
        elif pure.get('results',{}).get('python',{}).get('failures') not in (0,[]):
            return ['additive path export Python pure binding differs']

        native=json.loads((root/extension['native_report']).read_text())
        if native.get('status')!='passed' or not _source_map_matches(root,native.get('input_sha256'),extension['native_dependencies']):
            return ['additive path export CP2 native binding differs: '+relative]
        authored=json.loads((root/extension['native_review']).read_text())
        if not _accepted_review(authored): return ['additive path export CP2 authored review is not accepted']
        if authored.get('evidence_sha256',{}).get(extension['native_report'])!=digest(root/extension['native_report']):
            return ['additive path export CP2 authored evidence differs: '+relative]
        if not _source_map_matches(root,authored.get('implementation_sha256'),extension['native_dependencies']):
            return ['additive path export CP2 authored source binding differs: '+relative]
        return []
    except (KeyError,TypeError,ValueError,OSError):
        return ['invalid additive path export supplemental evidence']

def check_native(root,profile,name,target):
    if name=='p5js': return check_p5_native(root,profile,target)
    if name=='py5': return check_py5_native(root,profile,target)
    if name=='processing-android': return check_android_native(root,profile,target)
    try:
        if (name!='processing-java' or target['native_status']!='validated-scoped'
                or target.get('backend')!='JAVA2D'
                or target.get('implementation_status')!='native_adapter_implemented'):
            return ['native claims require a supported reviewed evidence validator']
        review=json.loads((root/target['native_review']).read_text())
        if (review['status'],review['owner'],review['reviewer'])!=('accepted','root','Sol'):
            return ['native claim lacks accepted independent review']
        if review['profile_semantics_sha256']!=semantics(profile):
            return ['native profile semantics changed since review']
        if set(target['evidence'])!=set(review['evidence_sha256']):
            return ['native evidence list differs from review']
        for path,expected in review['evidence_sha256'].items():
            if digest(root/path)!=expected: return ['native evidence changed: '+path]
        for path,expected in review['implementation_sha256'].items():
            if digest(root/path)!=expected: return ['native implementation changed: '+path]
        for part in ('pixels','failures'):
            report=json.loads((root/f'evidence/conformance/java2d-adapter-{part}.json').read_text())
            if report['status']!='passed' or report['part']!=part or len(report['runs'])!=1:
                return ['native suite part did not pass: '+part]
            if report['processing_version']!='4.5.6': return ['unexpected Processing runtime']
            if report['input_sha256'].get('catalog/drawing/fresh-raster-2d.json')!=review['tested_profile_sha256']:
                return ['native tested-profile binding mismatch']
            run=report['runs'][0]
            if run['exit_code']!=0: return ['native execution failed']
            for path,expected in review['implementation_sha256'].items():
                if report['input_sha256'].get(path)!=expected: return ['native source binding mismatch: '+path]
            if part=='pixels':
                groups=run['native']['groups']
                required=['1-background-sizes','2-bounds-clipping-widths','3-alpha-winding-order','4-style-caps-parent-isolation']
                if [g['id'] for g in groups]!=required or not all(g['passed'] for g in groups):
                    return ['native pixel groups incomplete']
            elif run['native']['passed'] is not True or run['native']['cases']!=11:
                return ['native lifecycle cases incomplete']
        cp1=json.loads((root/'evidence/reproductions/cp1-java2d-adapter/result.json').read_text())
        if cp1['status']!='passed' or [c['id'] for c in cp1['native']]!=['base','length','palette','bar']:
            return ['CP1 adapter evidence incomplete']
        return []
    except (KeyError,TypeError,ValueError,OSError) as error:
        return ['invalid native evidence: '+str(error)]


def check_android_native(root,profile,target):
    """Check the registered API33 Android2D slice without requiring local SDKs/images."""
    try:
        if (target.get('native_status')!='validated-scoped' or target.get('backend')!='ANDROID2D'
                or target.get('processing_renderer_token')!='JAVA2D'
                or target.get('renderer_class')!='processing.a2d.PGraphicsAndroid2D'
                or target.get('implementation_status')!='native_adapter_implemented'):
            return ['native claims require a supported reviewed evidence validator']
        review=json.loads((root/target['native_review']).read_text())
        replacements={}
        if target['native_review']=='evidence/conformance/android-snapshot-restoration-root-review.json':
            if __package__:
                from .android_restoration_review import validated_legacy_context
            else:
                from android_restoration_review import validated_legacy_context
            review,target,replacements=validated_legacy_context(root,profile,target)

        required_sources={
            'packages/java/src/main/java/org/procedurals/'+name+'.java' for name in
            ('color/CyclicPalette','fields/GradientNoise2D01','internal/DrawingFrameState',
             'internal/DrawingValues','layout/RegularGrid')}
        required_sources.update('packages/java-android/src/main/java/org/procedurals/android/internal/'+name+'.java'
            for name in ('Android2DFragment','Android2DFrame','AndroidFrameHost','AndroidSurface'))
        required_sources.update('packages/java-android/examples/FieldMarks/'+name+'.java'
            for name in ('FieldMarksActivity','FieldMarksRenderer','GalleryWriter'))
        required_sources.add('packages/java/examples/FieldMarks/MarkField.java')
        if not required_sources <= set(review['implementation_sha256']):
            return ['Android review omits required implementation bindings']
        required_runtime={'.work/toolchains/android/mode-412/AndroidMode/processing-core.zip',
            '.work/toolchains/android/sdk/platforms/android-33/android.jar',
            'evidence/conformance/android-environment.json'}
        if not required_runtime <= set(review['runtime_sha256']):
            return ['Android review omits required runtime bindings']
        if (review['status'],review['owner'],review['reviewer'])!=('accepted','root','Sol'):
            return ['native claim lacks accepted independent review']
        if review['profile_semantics_sha256']!=semantics(profile):
            return ['native profile semantics changed since review']
        if set(target['evidence'])!=set(review['evidence_sha256']):
            return ['native evidence list differs from review']
        for relative,expected in review['evidence_sha256'].items():
            if digest(root/relative)!=expected:return ['native evidence changed: '+relative]
        for relative,expected in review['implementation_sha256'].items():
            if digest(root/relative)!=expected and replacements.get(relative)!=digest(root/relative):return ['native implementation changed: '+relative]
        paths={
            'pixels':'evidence/conformance/android-adapter-pixels.json',
            'failures':'evidence/conformance/android-adapter-failures.json',
            'lifecycle-v2':'evidence/conformance/android-adapter-lifecycle-v2.json',
            'cp1':'evidence/reproductions/cp1-android/result.json',
            'android-editable-field-marks-ui':'evidence/reproductions/android-field-marks-ui/result.json',
        }
        if not set(paths.values()) <= set(target['evidence']):
            return ['Android native suite evidence incomplete']
        reports={part:json.loads((root/path).read_text()) for part,path in paths.items()}
        for part,report in reports.items():
            if (report['status']!='passed' or report['part']!=part
                    or report['fingerprint']!=review['fingerprint'] or not report['apk_sha256']):
                return ['Android native suite part did not pass on reviewed runtime: '+part]
            inputs=report['input_sha256']
            if inputs.get('catalog/drawing/fresh-raster-2d.json')!=review['tested_profile_sha256']:
                return ['native tested-profile binding mismatch']
            for relative,expected in review['runtime_sha256'].items():
                if inputs.get(relative)!=expected:return ['Android runtime binding mismatch']
            for relative,expected in review['implementation_sha256'].items():
                if '/examples/' in relative and part not in ('cp1','android-editable-field-marks-ui'):continue
                if '/java-android/examples/' in relative and part!='android-editable-field-marks-ui':continue
                if relative.endswith('/Android2DFragment.java') and part in ('pixels','failures'):continue
                if inputs.get(relative)!=expected:return ['native source binding mismatch: '+relative]
            native=report['native']
            if native['passed'] is not True:return ['Android native assertions failed: '+part]
            if part!='android-editable-field-marks-ui' and (
                    native['api']!=33 or native['renderer']!='processing.a2d.PGraphicsAndroid2D'):
                return ['Android native renderer/API mismatch']
        expected_groups={
            'pixels':['1-background-sizes','2-bounds-clipping-widths','3-alpha-winding-order','4-style-caps-parent-isolation'],
            'failures':['5-invalid-environment-before-static-capability','5-allocation-resource',
                '5-allocation-misleading-frame-error','5-supplied-readiness-no-repair','5-readiness-resource',
                '5-readiness-misleading-frame-error','5-initialization-render','5-initialization-misleading-frame-error',
                '5-draw-render','5-draw-misleading-frame-error','5-end-render','5-end-misleading-frame-error',
                '5-batch-atomicity-and-absolute-index','5-wrong-thread','5-frame-reentry','5-cleanup-primary',
                '5-abort-completed-idempotent-release','5-consume-release-reentry-consumer-failure',
                '5-host-transfer-transaction-rollback'],
        }
        for part,expected in expected_groups.items():
            groups=reports[part]['native']['native']['groups']
            if [g['id'] for g in groups]!=expected or not all(g['passed'] for g in groups):
                return ['Android native group coverage incomplete: '+part]
        lifecycle=reports['lifecycle-v2']; native=lifecycle['native']
        phases=['active-ready','pause-1','resume-1','restore-idle-1','idle-polls-1','completed-ready',
            'pause-2','resume-2','restore-idle-2','idle-polls-2','consumer-entered','pause-3','resume-3',
            'restore-idle-3','idle-polls-3','destroy-ready','pause-4','onDestroy','result']
        if ([m['phase'] for m in lifecycle['markers']]!=phases or native['failures']
                or native['verified_input_dispatches']!=3
                or any(native['counts'][key]!=value for key,value in
                    {'pause':4,'resume':3,'pre':4,'draw':4,'input':3,'completed_stages':3}.items())
                or any(m['value']['nonce']!=native['nonce'] for m in lifecycle['markers'])):
            return ['Android activity lifecycle coverage incomplete']
        cp1=reports['cp1']; cases=cp1['native']['native']['cases']
        if ([c['id'] for c in cases]!=['base','length','palette','bar']
                or cp1['native']['native']['model_records']!=25600
                or not all(v['changed_pixels']>0 for v in cp1['edit_changed_pixels'].values())):
            return ['Android CP1 coverage incomplete']
        ui=reports['android-editable-field-marks-ui']; frames=ui['frames']
        expected_states=[(False,False,False),(True,False,False),(False,False,False),(False,True,False),
            (False,False,False),(False,False,True),(True,False,True),(True,True,True)]
        if (ui['api']!=33 or len(frames)!=8 or ui['native']['frames']!=frames
                or ui['native']['composition_count']!=8 or ui['native']['completed_frame_count']!=9
                or ui['native']['sequence']!=9):
            return ['Android editable example coverage incomplete']
        for number,(frame,state) in enumerate(zip(frames,expected_states),1):
            if ((frame['longer'],frame['neon'],frame['bars'])!=state or frame['state_version']!=number-1
                    or frame['composition_count']!=number or frame['completed_frame_count']!=number+1
                    or frame['sequence']!=number or frame['nonce']!=ui['native']['nonce']
                    or frame['commands']!=25600 or frame['model_sha256']!=cases[0]['model_sha256']
                    or frame['png_sha256']!=ui['images']['frame-'+str(number)]['png_sha256']):
                return ['Android editable state/identity mismatch']
        for frame,case in zip(frames,[cases[0],cases[1],cases[0],cases[2],cases[0],cases[3]]):
            if any(frame[key]!=case[key] for key in ('model_sha256','geometry_sha256','color_sha256','commands')):
                return ['Android editable CP1 command mismatch']
            if ui['images']['frame-'+str(frame['composition_count'])]['rgba_sha256']!=cp1['images'][case['id']]['rgba_sha256']:
                return ['Android editable CP1 image mismatch']
        if (frames[6]['color_sha256']!=frames[5]['color_sha256']
                or frames[7]['geometry_sha256']!=frames[6]['geometry_sha256']
                or frames[7]['color_sha256']!=cases[2]['color_sha256']
                or set(ui['combined_edit_changed_pixels'])!={'7','8'}
                or not all(v>0 for v in ui['combined_edit_changed_pixels'].values())):
            return ['Android independent combined edits incomplete']
        if ([c['control'] for c in ui['clicks']]!=['length','length','palette','palette','marks','length','palette','save']
                or len(ui['focus_checks'])!=9):
            return ['Android actual UI dispatch coverage incomplete']
        saved=ui['saved']; row=saved['native']
        if (saved['bytes_equal_frame_8'] is not True or saved['png_sha256']!=frames[-1]['png_sha256']
                or row['byte_sha256']!=saved['png_sha256'] or row['is_pending']!=0
                or row['mime_type']!='image/png' or row['relative_path'] not in ('Pictures/Procedurals','Pictures/Procedurals/')
                or (row['png_width'],row['png_height'])!=(640,640)):
            return ['Android cached-image export incomplete']
        return []
    except (KeyError,TypeError,ValueError,OSError,IndexError) as error:
        return ['invalid native evidence: '+str(error)]

def check_p5_native(root,profile,target):
    try:
        if (target.get('native_status')!='validated-scoped' or target.get('backend')!='Canvas2D'
                or target.get('implementation_status')!='native_adapter_implemented'):
            return ['native claims require a supported reviewed evidence validator']
        review=json.loads((root/target['native_review']).read_text())
        if (review['status'],review['owner'],review['reviewer'])!=('accepted','root','Sol'):
            return ['native claim lacks accepted independent review']
        if review['profile_semantics_sha256']!=semantics(profile):
            return ['native profile semantics changed since review']
        if set(target['evidence'])!=set(review['evidence_sha256']):
            return ['native evidence list differs from review']
        for relative,expected in review['evidence_sha256'].items():
            if digest(root/relative)!=expected:return ['native evidence changed: '+relative]
        for relative,expected in review['implementation_sha256'].items():
            if digest(root/relative)!=expected:
                errors=additive_path_export_extension(root,'p5js',review,relative,expected)
                if errors:return errors
        for part in ('pixels','failures','transfer','cp1'):
            report=json.loads((root/f'evidence/conformance/p5js-adapter-{part}.json').read_text())
            if (report['status']!='passed' or report['part']!=part or report['native']['passed'] is not True
                    or report['browser']!='153.0.8010.12' or report['platform']!='linux' or report['errors']):
                return ['p5 native suite part did not pass on reviewed runtime: '+part]
            if report['input_sha256'].get('catalog/drawing/fresh-raster-2d.json')!=review['tested_profile_sha256']:
                return ['native tested-profile binding mismatch']
            for relative,expected in review['report_implementation_sha256'][part].items():
                if report['input_sha256'].get(relative)!=expected:return ['native source binding mismatch: '+relative]
                if part!='pixels' and expected!=review['implementation_sha256'][relative]:
                    return ['p5 current-source part differs from accepted implementation']
            native=report['native']
            if part=='pixels' and ([g['id'] for g in native['groups']]!=[
                '1-background-sizes','2-bounds-clipping-widths','3-alpha-winding-order','4-style-caps-parent-isolation']
                or not all(g['passed'] for g in native['groups'])):return ['p5 pixel coverage incomplete']
            if part=='failures' and (native['counts']['checks']!=18 or len(native['checks'])!=18
                    or not all(c['passed'] for c in native['checks'])):return ['p5 lifecycle coverage incomplete']
            if part=='transfer' and native['checks']!=1:return ['p5 transfer supplement missing']
            if part=='cp1' and [c['id'] for c in native['cases']]!=['base','length','palette','bar']:
                return ['p5 CP1 coverage incomplete']
        return []
    except (KeyError,TypeError,ValueError,OSError) as error:
        return ['invalid native evidence: '+str(error)]


def check_py5_native(root,profile,target):
    try:
        if (target.get('native_status')!='validated-scoped' or target.get('backend')!='JAVA2D'
                or target.get('implementation_status')!='native_adapter_implemented'):
            return ['native claims require a supported reviewed evidence validator']
        review=json.loads((root/target['native_review']).read_text())
        if (review['status'],review['owner'],review['reviewer'])!=('accepted','root','Sol'):
            return ['native claim lacks accepted independent review']
        if review['profile_semantics_sha256']!=semantics(profile):
            return ['native profile semantics changed since review']
        if set(target['evidence'])!=set(review['evidence_sha256']):
            return ['native evidence list differs from review']
        for relative,expected in review['evidence_sha256'].items():
            if digest(root/relative)!=expected:return ['native evidence changed: '+relative]
        for relative,expected in review['implementation_sha256'].items():
            if digest(root/relative)!=expected:
                errors=additive_path_export_extension(root,'py5',review,relative,expected)
                if errors:return errors
        for part in ('pixels','failures','cp1','ui','interruption'):
            report=json.loads((root/f'evidence/conformance/py5-adapter-{part}.json').read_text())
            run=report['native']
            if (report['status']!='passed' or report['part']!=part or report['exit_code']!=0
                    or report['platform']!='linux' or run['passed'] is not True
                    or run['py5']!='0.10.11a0' or run['java']!='17.0.20.1'):
                return ['py5 native suite part did not pass on reviewed runtime: '+part]
            if report['input_sha256'].get('catalog/drawing/fresh-raster-2d.json')!=review['tested_profile_sha256']:
                return ['native tested-profile binding mismatch']
            for relative,expected in review['runtime_sha256'].items():
                if report['input_sha256'].get(relative)!=expected:return ['py5 runtime binding mismatch']
            for relative,expected in review['implementation_sha256'].items():
                if '/examples/' in relative and part not in ('cp1','ui'):continue
                if relative.endswith('/sketch.py') and part!='ui':continue
                if report['input_sha256'].get(relative)!=expected:return ['native source binding mismatch: '+relative]
            native=run['native']
            if native['passed'] is not True:return ['py5 native assertions failed: '+part]
            if part in ('pixels','failures'):
                expected=(['1-background-sizes','2-bounds-clipping-widths','3-alpha-winding-order',
                           '4-style-caps-parent-isolation'] if part=='pixels' else [
                    'invalid-environment-before-capability','allocation-phase','allocation-misleading-frame-error',
                    'readiness-phase','readiness-misleading-frame-error','supplied-density-and-parent-mismatch',
                    'initialization-phase','initialization-misleading-frame-error',
                    'draw-phase-prior-batch-noop-index','draw-misleading-frame-error',
                    'end-phase','end-misleading-frame-error','batch-atomicity-and-abort',
                    'reentry-and-cleanup-primary','completed-transfer-and-idempotent-release'])
                if ([g['id'] for g in native['groups']]!=expected or not all(g['passed'] for g in native['groups'])):
                    return ['py5 native group coverage incomplete: '+part]
                if part=='pixels' and native['observations']['parent_density']!=2:
                    return ['py5 density-two parent evidence missing']
            if part=='cp1' and [c['id'] for c in native['cases']]!=['base','length','palette','bar']:
                return ['py5 CP1 coverage incomplete']
            if part=='ui' and [c['id'] for c in native['checks']]!=['base','length','palette','bar']:
                return ['py5 editable example coverage incomplete']
            if part=='interruption' and native['checks']!=1:return ['py5 interruption evidence missing']
        return []
    except (KeyError,TypeError,ValueError,OSError) as error:
        return ['invalid native evidence: '+str(error)]
