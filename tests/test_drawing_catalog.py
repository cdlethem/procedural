import json
import hashlib
from pathlib import Path
import shutil
import tempfile
import unittest

from tools.check_drawing_catalog import ROOT, check


class DrawingCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root=Path(self.temporary.name)
        self.relative='catalog/drawing/fresh-raster-2d.json'
        self.profile=json.loads((ROOT/self.relative).read_text())
        paths=[self.relative,*self.profile['decisions'],
               'evidence/documentation/java-grid-path-comments-review.json',
               'evidence/documentation/java-grid-path-comment-snapshots.json']
        paths += [v['notes_path'] for v in self.profile['provenance']]
        paths += [v for k,v in self.profile['verification'].items() if k!='scope']
        normalized=json.loads((ROOT/self.profile['verification']['normalized_fixtures']).read_text())
        paths += list(normalized['input_sha256'])
        for target in self.profile['targets'].values():
            if 'native_review' in target:
                paths.append(target['native_review'])
                review=json.loads((ROOT/target['native_review']).read_text())
                paths += list(review['evidence_sha256']) + list(review['implementation_sha256'])
        for relative in paths:
            destination=self.root/relative
            destination.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(ROOT/relative,destination)
        self.extension_review='evidence/reproductions/cp2-export-extension-review.json'
        self.extension_evidence=[
            'evidence/distribution/i1-review.json',
            'evidence/distribution/javascript.json',
            'evidence/distribution/python.json',
            'evidence/conformance/gradient-path.json',
            'evidence/conformance/p5js-path-marks.json',
            'evidence/reproductions/cp2-p5js/review.json',
            'evidence/reproductions/cp2-py5/result.json',
            'evidence/reproductions/cp2-py5/review.json',
        ]
        extension_sources=[
            'packages/javascript/src/gradient-path.js',
            'packages/javascript/src/gradient-noise-2d-01.js',
            'packages/javascript/src/internal/noise-hash.js',
            'packages/python/procedurals/paths.py',
            'packages/python/procedurals/fields.py',
        ]
        for relative in [*self.extension_evidence,*extension_sources]:
            destination=self.root/relative
            destination.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(ROOT/relative,destination)
        # These mutation fixtures exercise the historical CP2 extension in isolation.
        placement_review=json.loads((ROOT/'evidence/conformance/placement-export-compatibility-review.json').read_text())
        for relative,entry in placement_review['extensions'].items():
            (self.root/relative).write_text(entry['before'])
        self.write_extension_review()

    def write(self):
        (self.root/self.relative).write_text(json.dumps(self.profile))

    def sha(self, relative):
        return hashlib.sha256((self.root/relative).read_bytes()).hexdigest()

    def write_extension_review(self, status='accepted'):
        value={
            'status':status,
            'owner':'root',
            'reviewer':'Sol',
            'scope':'test-only exact additive gradient-path public export review',
            'evidence_sha256':{relative:self.sha(relative) for relative in self.extension_evidence},
            'extensions':{
                'p5js':{
                    'path':'packages/javascript/src/index.js',
                    'historical_sha256':'7f368cde1aae6299dd73bee5334342b8ee6574ae2e59dc5982aca643b7f52644',
                    'current_sha256':self.sha('packages/javascript/src/index.js'),
                    'deletions':['export { gradientPath2D, GradientPathError } from "./gradient-path.js";\n'],
                    'distribution_report':'evidence/distribution/javascript.json',
                    'pure_report':'evidence/conformance/gradient-path.json',
                    'native_report':'evidence/conformance/p5js-path-marks.json',
                    'native_review':'evidence/reproductions/cp2-p5js/review.json',
                },
                'py5':{
                    'path':'packages/python/procedurals/__init__.py',
                    'historical_sha256':'3d53798ebcd479266ec0d793ed0eb68d42abc0acf1f35f0b2febc7c74ec5a3f2',
                    'current_sha256':self.sha('packages/python/procedurals/__init__.py'),
                    'deletions':['from .paths import GradientPathError, gradient_path_2d\n',
                                 '    "GradientPathError",\n','    "gradient_path_2d",\n'],
                    'distribution_report':'evidence/distribution/python.json',
                    'pure_report':'evidence/conformance/gradient-path.json',
                    'native_report':'evidence/reproductions/cp2-py5/result.json',
                    'native_review':'evidence/reproductions/cp2-py5/review.json',
                },
            },
        }
        destination=self.root/self.extension_review
        destination.parent.mkdir(parents=True,exist_ok=True)
        destination.write_text(json.dumps(value))

    def test_current_repository_profile(self):
        self.assertEqual(check(ROOT),[])

    def test_current_profile(self):
        self.assertEqual(check(self.root),[])

    def test_schema_drift_is_rejected(self):
        self.profile['batch_schema']['items']={}
        self.write()
        self.assertTrue(any('schema drift' in e for e in check(self.root)))

    def test_stale_source_is_rejected(self):
        (self.root/self.profile['provenance'][0]['notes_path']).write_text('changed evidence')
        self.assertTrue(any('stale provenance' in e for e in check(self.root)))

    def test_native_status_cannot_self_certify(self):
        self.profile['targets']['p5js']['native_status']='validated'
        self.write()
        self.assertTrue(any('native claims' in e for e in check(self.root)))

    def test_surface_policy_schema_drift(self):
        self.profile['environment_schema']['properties']['width']['maximum']=4096
        self.write()
        self.assertTrue(any('surface limit drift' in e for e in check(self.root)))

    def test_native_implementation_drift(self):
        path=self.root/'packages/java-processing/src/main/java/org/procedurals/processing/internal/Java2DFrame.java'
        path.write_text(path.read_text()+'\n// changed implementation\n')
        self.assertTrue(any('native implementation changed' in e for e in check(self.root)))

    def test_native_semantics_drift(self):
        self.profile['rendering']['compositing']='different behavior'
        self.write()
        self.assertTrue(any('native profile semantics changed' in e for e in check(self.root)))

    def test_native_report_drift(self):
        path=self.root/'evidence/conformance/java2d-adapter-failures.json'
        value=json.loads(path.read_text());value['status']='failed'
        path.write_text(json.dumps(value))
        self.assertTrue(any('native evidence changed' in e for e in check(self.root)))

    def test_p5_implementation_drift(self):
        path=self.root/'packages/javascript/src/internal/p5-frame.js'
        path.write_text(path.read_text()+'\n// changed adapter\n')
        self.assertTrue(any('native implementation changed' in e for e in check(self.root)))

    def test_additive_export_requires_accepted_review(self):
        self.write_extension_review(status='pending')
        self.assertTrue(any('additive path export lacks accepted supplemental review' in e for e in check(self.root)))

    def test_additive_export_rejects_nonexport_source_edit(self):
        path=self.root/'packages/javascript/src/index.js'
        path.write_text(path.read_text()+'// unrelated\n')
        self.write_extension_review()
        self.assertTrue(any('deletion reconstruction differs' in e for e in check(self.root)))

    def test_additive_export_rejects_stale_current_hash(self):
        path=self.root/self.extension_review
        review=json.loads(path.read_text())
        review['extensions']['py5']['current_sha256']='0'*64
        path.write_text(json.dumps(review))
        self.assertTrue(any('current hash differs' in e for e in check(self.root)))

    def test_additive_export_rejects_stale_pure_binding(self):
        path=self.root/'evidence/conformance/gradient-path.json'
        value=json.loads(path.read_text())
        value['source_sha256']['packages/javascript/src/index.js']='0'*64
        path.write_text(json.dumps(value))
        self.assertTrue(any('supplemental evidence changed' in e for e in check(self.root)))

    def test_additive_export_rejects_python_duplicate_deletion(self):
        path=self.root/'packages/python/procedurals/__init__.py'
        path.write_text(path.read_text()+'from .paths import GradientPathError, gradient_path_2d\n')
        self.write_extension_review()
        self.assertTrue(any('deletion reconstruction differs' in e for e in check(self.root)))

    def test_p5_evidence_cannot_omit_transfer(self):
        target=self.profile['targets']['p5js']
        target['evidence'].remove('evidence/conformance/p5js-adapter-transfer.json')
        self.write()
        self.assertTrue(any('native evidence list differs' in e for e in check(self.root)))

    def test_py5_implementation_drift(self):
        path=self.root/'packages/python/procedurals/_py5_frame.py'
        path.write_text(path.read_text()+'\n# changed adapter\n')
        self.assertTrue(any('CP2 native binding differs' in e or 'native implementation changed' in e
                            for e in check(self.root)))

    def test_py5_evidence_cannot_omit_interruption(self):
        target=self.profile['targets']['py5']
        target['evidence'].remove('evidence/conformance/py5-adapter-interruption.json')
        self.write()
        self.assertTrue(any('native evidence list differs' in e for e in check(self.root)))

    def test_android_implementation_drift(self):
        path=self.root/'packages/java-android/src/main/java/org/procedurals/android/internal/Android2DFragment.java'
        path.write_text(path.read_text()+'\n// changed carrier\n')
        self.assertTrue(any('native implementation changed' in e for e in check(self.root)))

    def test_android_evidence_cannot_omit_actual_ui(self):
        target=self.profile['targets']['processing-android']
        target['evidence'].remove('evidence/reproductions/android-field-marks-ui/result.json')
        self.write()
        self.assertTrue(any('native evidence list differs' in e for e in check(self.root)))

    def test_android_review_cannot_omit_fragment_binding(self):
        path=self.root/self.profile['targets']['processing-android']['native_review']
        review=json.loads(path.read_text())
        del review['implementation_sha256']['packages/java-android/src/main/java/org/procedurals/android/internal/Android2DFragment.java']
        path.write_text(json.dumps(review))
        self.assertTrue(any('omits required implementation bindings' in e for e in check(self.root)))

    def test_false_schema_fixture_cannot_pass(self):
        path=self.root/self.profile['verification']['schema_fixtures']
        fixture=json.loads(path.read_text())
        fixture['cases'][0]['value']['rgb']=True
        path.write_text(json.dumps(fixture))
        self.assertTrue(any('schema fixture mismatch' in e for e in check(self.root)))
