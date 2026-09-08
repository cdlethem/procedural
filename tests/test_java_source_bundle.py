import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from tools.build_java_source_bundle import fresh_output, require_hash, sha, source_inputs, write_zip

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

    def test_current_release_admission_and_exact_tabs(self):
        manifest, inputs = source_inputs(ROOT)
        self.assertEqual(len(manifest['operation_files']), 15)
        self.assertEqual(len(manifest['core_sources']), 15)
        self.assertEqual(len(manifest['examples']), 33)
        self.assertIn('procedurals/examples/FieldMarks/MarkCommands.java', manifest['examples'])
        self.assertIn('procedurals/examples/PathMarks/PathMarksCanvas.java', manifest['examples'])
        self.assertTrue(inputs)
