"""Validate the scoped Android snapshot successor without rewriting legacy attestations."""
import hashlib
import json
if __package__:
    from .reviewed_java_comments import matches_reviewed_java_comments
else:
    from reviewed_java_comments import matches_reviewed_java_comments

REVIEW='evidence/documentation/android-grid-path-restoration-successor.json'
BASE='evidence/conformance/android-native-review.json'
FIELD='packages/java-android/examples/FieldMarks/FieldMarksActivity.java'
HELPER='packages/java-android/src/main/java/org/procedurals/android/internal/AndroidSnapshotPresentation.java'
FIELD_RESULT='evidence/conformance/android-field-restore-attempt7.json'

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def validated_legacy_context(root,profile,target):
    """Return the intact legacy evidence plus its one explicitly superseded source hash.

    Only the Field Activity changed among the legacy adapter implementation. The new
    helper and current Activity must have current native evidence; every other old
    implementation hash remains required. This does not waive any legacy suite check.
    """
    review=json.loads((root/REVIEW).read_text())
    base=json.loads((root/BASE).read_text())
    if (review.get('status'),review.get('owner'),review.get('reviewer'))!=('accepted','root','root'):
        raise ValueError('snapshot successor is not root accepted')
    if {'path':BASE,'sha256':digest(root/BASE)} not in review['supersedes']:
        raise ValueError('legacy review identity missing')
    if set(target['evidence'])!=set(review['evidence_sha256']):
        raise ValueError('native evidence list differs from snapshot root review')
    for group in ('implementation_sha256','evidence_sha256'):
        for name,expected in review[group].items():
            if digest(root/name)!=expected and not (group=='implementation_sha256'
                    and matches_reviewed_java_comments(root,name,expected)):
                label='native implementation changed: ' if group=='implementation_sha256' else 'native evidence changed: '
                raise ValueError(label+name)
    semantic={k:v for k,v in profile.items() if k not in ('targets','verification','review')}
    semantic_hash=hashlib.sha256(json.dumps(semantic,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    if semantic_hash!=base['profile_semantics_sha256']:
        raise ValueError('snapshot successor changes drawing semantics')
    current=review['implementation_sha256']
    for name,expected in base['implementation_sha256'].items():
        if name not in current:raise ValueError('Android review omits required implementation bindings: '+name)
        if name!=FIELD and current.get(name)!=expected:
            raise ValueError('unreviewed legacy implementation replacement: '+name)
    if FIELD not in current or HELPER not in current or FIELD_RESULT not in review['evidence_sha256']:
        raise ValueError('snapshot successor omits Field implementation or native result')
    result=json.loads((root/FIELD_RESULT).read_text())
    if result.get('status')!='passed' or result['display_restore']['equal'] is not True:
        raise ValueError('Field displayed restoration did not pass')
    native=result['native']
    expected={'passed':True,'composition_count':8,'completed_frame_count':9,
              'missing_surface_callback_checked':True,'paused':True,'resumed':True,'resume_acknowledgments':1}
    if any(native.get(k)!=v for k,v in expected.items()):
        raise ValueError('Field native restoration workflow incomplete')
    for name in (FIELD,HELPER,'tests/native/android-field-marks/FieldMarksProbeActivity.java','tools/run_android_field_marks_ui.py'):
        if result['input_sha256'].get(name)!=current.get(name) or name not in current:
            raise ValueError('Field native result does not bind current source: '+name)
    legacy_target=dict(target,native_review=BASE,evidence=list(base['evidence_sha256']))
    return base,legacy_target,{FIELD:current[FIELD]}
