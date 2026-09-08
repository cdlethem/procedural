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
