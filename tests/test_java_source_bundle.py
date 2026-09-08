import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile
from unittest import mock
from tools.build_java_source_bundle import (build, fresh_output, generate_javadoc,
                                             require_hash, sha, source_inputs, write_zip)

ROOT = Path(__file__).resolve().parents[1]

class SourceBundleTests(unittest.TestCase):
    def setUp(self):
        parent = ROOT / '.work/tmp'
        parent.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=parent)
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)

    def test_zip_is_deterministic_and_preserves_payloads(self):
        one, two = self.base / 'one.zip', self.base / 'two.zip'
        write_zip(one, {'b': b'B', 'a': b'A'})
        write_zip(two, {'a': b'A', 'b': b'B'})
        self.assertEqual(one.read_bytes(), two.read_bytes())
        with zipfile.ZipFile(one) as z:
            self.assertEqual(z.namelist(), ['a', 'b'])
            self.assertEqual(z.read('a'), b'A')
        with self.assertRaises(FileExistsError):
            write_zip(one, {})

    def test_missing_or_wrong_external_input_rejected(self):
        p = self.base / 'font'
        with self.assertRaises(ValueError):
            require_hash(p, '0' * 64)
        p.write_bytes(b'wrong')
        with self.assertRaises(ValueError):
            require_hash(p, '0' * 64)
        require_hash(p, sha(p))

    def test_output_cannot_overwrite_or_escape_root_work(self):
        root = self.base / 'checkout'
        root.mkdir()
        self.assertEqual(fresh_output(root, root / '.work/new'), root / '.work/new')
        for p in (root, root / 'other/.work/new', self.base / '.work/outside'):
            with self.assertRaises(ValueError):
                fresh_output(root, p)

    def test_stale_source_rejected_before_compilation(self):
        root = self.base / 'checkout'
        source = root / 'packages/java/src/main/java/Changed.java'
        source.parent.mkdir(parents=True)
        source.write_text('changed')
        review = root / 'review.json'
        review.write_text(json.dumps({'status': 'accepted', 'reviewer': 'root'}))
        manifest = {'accepted_distribution_review': {'path': 'review.json', 'sha256': sha(review)},
                    'core_sources': {'packages/java/src/main/java/Changed.java': '0' * 64}}
        (root / 'packages/java/source-bundle.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'Accepted input missing or changed'):
            source_inputs(root)

    def test_stale_processing_adapter_rejected_before_compilation(self):
        root = self.base / 'checkout'
        core = root / 'packages/java/src/main/java/Core.java'
        adapter = root / 'packages/java-processing/src/main/java/Adapter.java'
        core.parent.mkdir(parents=True)
        adapter.parent.mkdir(parents=True)
        core.write_text('core')
        adapter.write_text('adapter')
        review = root / 'review.json'
        review.write_text(json.dumps({'status': 'accepted', 'reviewer': 'root'}))
        manifest = {
            'accepted_distribution_review': {'path': 'review.json', 'sha256': sha(review)},
            'core_sources': {'packages/java/src/main/java/Core.java': sha(core)},
            'adapter_sources': {'packages/java-processing/src/main/java/Adapter.java': '0' * 64},
        }
        (root / 'packages/java').mkdir(parents=True, exist_ok=True)
        (root / 'packages/java/source-bundle.json').write_text(json.dumps(manifest))
        with self.assertRaisesRegex(ValueError, 'Accepted input missing or changed'):
            source_inputs(root)

    def test_wrong_processing_core_rejected_before_output_creation(self):
        root = self.base / 'checkout'
        root.mkdir()
        font = self.base / 'font.ttf'
        notice = self.base / 'FONT-LICENSE.txt'
        processing_core = self.base / 'core.jar'
        font.write_bytes(b'font')
        notice.write_bytes(b'license')
        processing_core.write_bytes(b'wrong core')
        manifest = {
            'font_sha256': sha(font),
            'font_license_sha256': sha(notice),
            'processing_core_sha256': '0' * 64,
        }
        output = root / '.work/bundle'
        with mock.patch('tools.build_java_source_bundle.source_inputs', return_value=(manifest, [])):
            with self.assertRaisesRegex(ValueError, 'Accepted input missing or changed'):
                build(root, output, self.base / 'jdk', font, notice, processing_core)
        self.assertFalse(output.exists())

    def test_javadoc_generation_records_command_coverage_and_warnings(self):
        source_a = self.base / 'A.java'
        source_b = self.base / 'B.java'
        source_a.write_text('class A {}')
        source_b.write_text('class B {}')
        output = self.base / 'javadoc'
        output.mkdir()
        (output / 'index.html').write_text('index')
        (output / 'A.html').write_text('A')
        (output / 'B.html').write_text('B')
        completed = subprocess.CompletedProcess(['javadoc'], 0, '', 'warning: incomplete docs')
        with mock.patch('tools.build_java_source_bundle.subprocess.run', return_value=completed) as invoke:
            report = generate_javadoc(self.base / 'javadoc-bin', [source_a, source_b], output)
        command = invoke.call_args.args[0]
        self.assertIn('--release', command)
        self.assertIn('-Xdoclint:all', command)
        self.assertIn('-notimestamp', command)
        self.assertEqual(report['declared_class_pages'], 2)
        self.assertEqual(report['warning_count'], 1)
        self.assertNotIn('LICENSE', report['files'])
        self.assertTrue((output.parent / 'javadoc.json').is_file())

    def test_javadoc_generation_rejects_failure_and_missing_declared_page(self):
        source = self.base / 'A.java'
        source.write_text('class A {}')
        failed = self.base / 'failed'
        with mock.patch('tools.build_java_source_bundle.subprocess.run', return_value=subprocess.CompletedProcess([], 1, '', 'bad')):
            with self.assertRaisesRegex(RuntimeError, 'javadoc failed'):
                generate_javadoc(self.base / 'javadoc-bin', [source], failed)
        source.write_text('package org.example;\npublic class A {}')
        incomplete = self.base / 'incomplete'
        incomplete.mkdir()
        (incomplete / 'index.html').write_text('index')
        (incomplete / 'A.html').write_text('wrong package page must not pass')
        with mock.patch('tools.build_java_source_bundle.subprocess.run', return_value=subprocess.CompletedProcess([], 0, '', '')):
            with self.assertRaisesRegex(RuntimeError, 'incomplete'):
                generate_javadoc(self.base / 'javadoc-bin', [source], incomplete)

    def test_current_release_admission_and_exact_tabs(self):
        manifest, inputs = source_inputs(ROOT)
        self.assertEqual(manifest['version'], '0.26.0')
        self.assertEqual(manifest['processing_version'], 26)
        self.assertEqual(len(manifest['operation_files']), 26)
        self.assertEqual(len(manifest['core_sources']), 26)
        self.assertEqual(len(manifest['adapter_sources']), 2)
        self.assertIn('processing_core_sha256', manifest)
        self.assertEqual(len(manifest['examples']), 45)
        self.assertEqual(sum(name.endswith('.pde') for name in manifest['examples']), 27)
        self.assertIn('procedurals/examples/FieldMarks/MarkCommands.java', manifest['examples'])
        self.assertIn('procedurals/examples/PathMarks/PathMarksCanvas.java', manifest['examples'])
        self.assertIn('procedurals/examples/WarpMarks/WarpMarks.pde', manifest['examples'])
        self.assertIn('procedurals/examples/LoopMarks/LoopMarks.pde', manifest['examples'])
        self.assertIn('procedurals/examples/PanelMarks/PanelMarks.pde', manifest['examples'])
        self.assertIn('procedurals/examples/DepthMarks/DepthMarks.pde', manifest['examples'])
        self.assertIn('procedurals/examples/PullMarks/PullMarks.pde', manifest['examples'])
        self.assertIn('procedurals/examples/PolygonMarks/PolygonMarks.pde', manifest['examples'])
        self.assertIn('packages/java/src/main/java/org/procedurals/sampling/ConvexPolygonPlacements2D.java', manifest['core_sources'])
        self.assertIn('packages/java/src/main/java/org/procedurals/layout/RetainedRectangles2D.java', manifest['core_sources'])
        self.assertIn('procedurals/examples/CutMarks/CutMarks.pde', manifest['examples'])
        self.assertIn('procedurals/examples/PointerMarks/PointerMarks.pde', manifest['examples'])
        self.assertIn('procedurals/examples/BodyMarks/BodyMarks.pde', manifest['examples'])
        self.assertIn('retained-rectangle-cuts-2d.json', manifest['operation_files'])
        self.assertIn('closed-spline-2d.json', manifest['operation_files'])
        self.assertIn('ordered-convex-polygon-filter-2d.json', manifest['operation_files'])
        polygon_contract = json.loads((ROOT / 'catalog/operations/ordered-convex-polygon-filter-2d.json').read_text())['design_review']
        self.assertEqual(polygon_contract, 'design/operations/convex-polygon-placement-contract.md')
        self.assertTrue((ROOT / polygon_contract).is_file())
        retained_contract = json.loads((ROOT / 'catalog/operations/retained-rectangle-cuts-2d.json').read_text())['design_review']
        self.assertEqual(retained_contract, 'design/operations/retained-rectangle-cuts-contract.md')
        self.assertTrue((ROOT / retained_contract).is_file())
        self.assertTrue(inputs)
