import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class RecipeExportAdmissionTests(unittest.TestCase):
    def export(self, target, output):
        return subprocess.run([
            sys.executable, str(ROOT / 'tools/export_recipe_java_prototype.py'),
            '--recipe', str(ROOT / 'design/recipes/examples/field-marks.draft.json'),
            '--output', str(output), '--target', target,
        ], capture_output=True, text=True)

    def test_java_export_records_only_requested_support(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.work') as directory:
            output = Path(directory) / 'export'
            result = self.export('processing-java', output)
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((output / 'manifest.json').read_text())
            admission = manifest['target_admission']
            self.assertEqual(admission['target'], 'processing-java')
            self.assertEqual(len(admission['operations']), 3)
            self.assertEqual(len(admission['validated_recipe_sha256']), 64)
            for record in admission['operations']:
                self.assertEqual(record['target'], 'processing-java')
                self.assertNotIn('targets', record)
                self.assertEqual(record['dimensions']['core']['status'], 'conformant')
            self.assertEqual(manifest['status'], 'prototype-unaccepted')

    def test_unsupported_target_creates_no_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.work') as directory:
            output = Path(directory) / 'export'
            result = self.export('p5js', output)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('supports only processing-java', result.stderr)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
