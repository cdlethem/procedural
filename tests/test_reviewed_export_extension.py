import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from tools.reviewed_export_extension import historical_export_bytes, PATHS, REVIEW


class ReviewedExportTests(unittest.TestCase):
    def test_exact_review_and_fail_closed_mutations(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            relative = sorted(PATHS)[0]
            path = root / relative
            path.parent.mkdir(parents=True)
            path.write_text('after')
            for other in PATHS - {relative}:
                (root / other).parent.mkdir(parents=True, exist_ok=True)
                (root / other).write_text('after')
            dependency = root / 'dependency'
            dependency.write_text('verified')
            digest = lambda value: hashlib.sha256(value.encode()).hexdigest()
            review = {'status': 'accepted', 'owner': 'root', 'reviewer': 'root',
                      'implementation_sha256': {relative: digest('after')},
                      'evidence_sha256': {'dependency': digest('verified')},
                      'extensions': {p: {'before': 'before', 'after': 'after'} for p in PATHS}}
            record = root / REVIEW
            record.parent.mkdir(parents=True)
            record.write_text(json.dumps(review))
            self.assertEqual(historical_export_bytes(root, relative, digest('before')), b'before')
            self.assertIsNone(historical_export_bytes(root, 'dependency', digest('before')))
            self.assertIsNone(historical_export_bytes(root, relative, digest('wrong')))
            path.write_text('after plus unrelated edit')
            self.assertIsNone(historical_export_bytes(root, relative, digest('before')))
            path.write_text('after')
            dependency.write_text('changed')
            self.assertIsNone(historical_export_bytes(root, relative, digest('before')))
            dependency.write_text('verified')
            review['status'] = 'draft'
            record.write_text(json.dumps(review))
            self.assertIsNone(historical_export_bytes(root, relative, digest('before')))

    def test_successor_preserves_both_historical_exports_and_rejects_mutation(self):
        from tools.reviewed_export_extension import SUCCESSOR, HELPER
        import shutil
        repository = Path(__file__).resolve().parents[1]
        previous = json.loads((repository / REVIEW).read_text())
        successor = json.loads((repository / SUCCESSOR).read_text())
        files = {REVIEW, SUCCESSOR, *PATHS}
        for review in (previous, successor):
            files.update(review['implementation_sha256'])
            files.update(review['evidence_sha256'])
        with tempfile.TemporaryDirectory(dir=repository / '.work') as temporary:
            root = Path(temporary)
            for name in files:
                (root / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(repository / name, root / name)
            relative = 'packages/javascript/src/index.js'
            digest = lambda value: hashlib.sha256(value.encode()).hexdigest()
            old = previous['extensions'][relative]['before']
            middle = successor['extensions'][relative]['before']
            self.assertEqual(historical_export_bytes(root, relative, digest(old)), old.encode())
            self.assertEqual(historical_export_bytes(root, relative, digest(middle)), middle.encode())
            python = 'packages/python/procedurals/__init__.py'
            python_old = previous['extensions'][python]['before']
            self.assertEqual(historical_export_bytes(root, python, digest(python_old)), python_old.encode())
            self.assertIsNone(historical_export_bytes(root, HELPER, digest(successor['previous_bytes'][HELPER])))
            for name in (relative, HELPER, 'packages/javascript/src/quadrant-partition.js',
                         'packages/javascript/src/circle-placements.js',
                         'evidence/conformance/p5js-region-marks.json', REVIEW):
                original = (root / name).read_bytes()
                (root / name).write_bytes(original + b'\nchanged')
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)), name)
                self.assertIsNone(historical_export_bytes(root, relative, digest(middle)), name)
                (root / name).write_bytes(original)
            for mutate in (
                lambda r: r.update(status='draft'),
                lambda r: r['implementation_sha256'].pop(HELPER),
                lambda r: r['previous_bytes'].update({HELPER: 'wrong historical helper'}),
                lambda r: r['previous_bytes'].update({'unrelated.py': 'forbidden snapshot'}),
                lambda r: r.update(previous_review_sha256='0' * 64),
                lambda r: r['extensions'][relative].update(before='wrong historical entrypoint'),
            ):
                record = json.loads(json.dumps(successor))
                mutate(record)
                (root / SUCCESSOR).write_text(json.dumps(record))
                self.assertIsNone(historical_export_bytes(root, relative, digest(old)))
                self.assertIsNone(historical_export_bytes(root, relative, digest(middle)))
