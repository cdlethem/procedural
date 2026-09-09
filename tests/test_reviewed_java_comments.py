import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from tools.reviewed_java_comments import (PATHS, REVIEW, SNAPSHOT, _java_tokens,
                                          matches_reviewed_java_comments)


class ReviewedJavaCommentsTests(unittest.TestCase):
    def setUp(self):
        self.repository = Path(__file__).resolve().parents[1]
        self.hashes = json.loads((self.repository / REVIEW).read_text())
        self.by_path = {entry["source"]: entry for entry in self.hashes["files"]}

    def test_current_reviewed_sources_match_historical_snapshots(self):
        for path in PATHS:
            self.assertTrue(matches_reviewed_java_comments(self.repository, path, self.by_path[path]["old_sha256"]))

    def test_lexer_preserves_literals_and_plus_boundaries(self):
        self.assertEqual(_java_tokens('String s="//"; char c=\'/\'; // omit\n'),
                         ['String', 's', '=', '"//"', ';', 'char', 'c', '=', "'/'", ';'])
        self.assertNotEqual(_java_tokens('a + + b'), _java_tokens('a ++ b'))
        self.assertEqual(_java_tokens('a >>= 1; b >>>= 2; c++;'),
                         ['a', '>>=', '1', ';', 'b', '>>>=', '2', ';', 'c', '++', ';'])
        self.assertIsNone(_java_tokens('// \\u000a int executable;'))
        self.assertIsNone(_java_tokens('/* unterminated'))
        self.assertIsNone(_java_tokens('String s="unterminated'))

    def test_fail_closed_for_source_review_snapshot_and_path_mutations(self):
        with tempfile.TemporaryDirectory(dir=self.repository / '.work') as temporary:
            root = Path(temporary)
            for relative in (*PATHS, REVIEW, SNAPSHOT):
                destination = root / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(self.repository / relative, destination)
            path = sorted(PATHS)[0]
            old = self.by_path[path]["old_sha256"]
            self.assertTrue(matches_reviewed_java_comments(root, path, old))
            source = root / path
            source.write_text(source.read_text() + "\nint executableChange;\n")
            self.assertFalse(matches_reviewed_java_comments(root, path, old))
            shutil.copyfile(self.repository / path, source)
            source.write_bytes(source.read_bytes().replace(b"\n", b"\r\n"))
            self.assertFalse(matches_reviewed_java_comments(root, path, old))
            shutil.copyfile(self.repository / path, source)
            snapshot = json.loads((root / SNAPSHOT).read_text())
            snapshot["sources"][path]["historical_source_utf8_base64"] += "forged"
            (root / SNAPSHOT).write_text(json.dumps(snapshot))
            self.assertFalse(matches_reviewed_java_comments(root, path, old))
            shutil.copyfile(self.repository / SNAPSHOT, root / SNAPSHOT)
            review = json.loads((root / REVIEW).read_text())
            review["owner"] = "not-root"
            (root / REVIEW).write_text(json.dumps(review))
            snapshot = json.loads((root / SNAPSHOT).read_text())
            snapshot["review_sha256"] = hashlib.sha256((root / REVIEW).read_bytes()).hexdigest()
            (root / SNAPSHOT).write_text(json.dumps(snapshot))
            self.assertFalse(matches_reviewed_java_comments(root, path, old))
            shutil.copyfile(self.repository / REVIEW, root / REVIEW)
            snapshot = json.loads((root / SNAPSHOT).read_text())
            snapshot["review_sha256"] = hashlib.sha256((root / REVIEW).read_bytes()).hexdigest()
            snapshot["sources"].pop(path)
            (root / SNAPSHOT).write_text(json.dumps(snapshot))
            self.assertFalse(matches_reviewed_java_comments(root, path, old))
            self.assertFalse(matches_reviewed_java_comments(root, "tools/reviewed_java_comments.py", old))
            self.assertFalse(matches_reviewed_java_comments(root, path, "0" * 64))
