import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from tools.operation_attestations import load_attestations, validate_target_attestation


class OperationTargetAttestationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.operation = {
            "id": "example.operation", "version": "0.1.0", "_file": "example.json",
            "targets": {"p5js": {}, "py5": {}}, "status": "reviewed",
        }
        self.write("catalog/operations/example.json",
                   json.dumps({"id": self.operation["id"], "version": self.operation["version"]}))
        self.write("src/core.py", "core = 1\n")
        self.write("evidence/core.json", json.dumps({"status": "passed"}))
        self.write("evidence/review-evidence.json", json.dumps({"status": "passed"}))
        self.write("evidence/review.json", json.dumps({
            "status": "accepted", "owner": "root", "reviewer": "root",
            "implementation_sha256": {"src/core.py": self.sha("src/core.py")},
            "evidence_sha256": {"evidence/review-evidence.json": self.sha("evidence/review-evidence.json")},
        }))
        self.write_record()

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def sha(self, relative):
        return hashlib.sha256((self.root / relative).read_bytes()).hexdigest()

    def claimed(self):
        return {
            "status": "conformant",
            "implementation_sha256": {"src/core.py": self.sha("src/core.py")},
            "evidence_sha256": {"evidence/core.json": self.sha("evidence/core.json")},
            "evidence_predicates": [{"path": "evidence/core.json", "pointer": "/status", "equals": "passed"}],
            "acceptance_review": {"path": "evidence/review.json", "sha256": self.sha("evidence/review.json")},
            "runtime_profile": {"name": "test-runtime", "scope": "bounded test profile"},
        }

    def write_record(self, value=None):
        record = value or {
            "kind": "operation-implementation-attestation", "schema_version": 1,
            "status": "accepted", "owner": "root", "reviewer": "root",
            "operation": {"id": self.operation["id"], "version": self.operation["version"],
                           "catalog_path": "catalog/operations/example.json",
                           "catalog_sha256": self.sha("catalog/operations/example.json")},
            "targets": {target: {"core": self.claimed(), "native": {"status": "unvalidated"},
                                  "technique": {"status": "unvalidated"}}
                        for target in self.operation["targets"]},
        }
        self.write("catalog/validation/example.json", json.dumps(record))

    def validate_target(self, target):
        return validate_target_attestation(self.root, self.operation, target)

    def test_selected_valid_target_returns_scoped_record(self):
        errors, scoped = self.validate_target("p5js")
        self.assertEqual(errors, [])
        record = json.loads((self.root / "catalog/validation/example.json").read_text())
        self.assertEqual(scoped, {
            "target": "p5js",
            "operation": record["operation"],
            "dimensions": record["targets"]["p5js"],
        })

    def test_missing_record_fails_selected_validation(self):
        (self.root / "catalog/validation/example.json").unlink()
        errors, scoped = self.validate_target("p5js")
        self.assertTrue(any("missing target attestation" in error for error in errors))
        self.assertIsNone(scoped)

    def test_selected_stale_source_fails(self):
        self.write("src/core.py", "core = 2\n")
        errors, scoped = self.validate_target("p5js")
        self.assertTrue(any("stale hash" in error for error in errors))
        self.assertIsNone(scoped)

    def test_unrelated_target_staleness_is_scoped_but_full_load_rejects(self):
        record = json.loads((self.root / "catalog/validation/example.json").read_text())
        record["targets"]["py5"]["core"]["evidence_sha256"]["evidence/core.json"] = "0" * 64
        self.write_record(record)
        errors, scoped = self.validate_target("p5js")
        self.assertEqual(errors, [])
        self.assertIsNotNone(scoped)
        self.assertTrue(load_attestations(self.root, [self.operation])[0])

    def test_unknown_target_and_envelope_or_contract_drift_fail(self):
        errors, scoped = self.validate_target("android")
        self.assertTrue(errors)
        self.assertIsNone(scoped)

        record = json.loads((self.root / "catalog/validation/example.json").read_text())
        record["status"] = "draft"
        self.write_record(record)
        errors, scoped = self.validate_target("p5js")
        self.assertTrue(errors)
        self.assertIsNone(scoped)

        self.write_record()
        self.write("catalog/operations/example.json", "changed")
        errors, scoped = self.validate_target("p5js")
        self.assertTrue(any("contract binding" in error for error in errors))
        self.assertIsNone(scoped)


if __name__ == "__main__":
    unittest.main()
