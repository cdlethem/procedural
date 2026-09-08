import copy
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest

from tools.operation_attestations import load_attestations
from tools.check_catalog import reference


class OperationAttestationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.catalog = self.root / "catalog/operations/example.json"
        self.catalog.parent.mkdir(parents=True)
        self.operation = {
            "id": "example.operation", "version": "0.1.0", "_file": "example.json",
            "targets": {
                "p5js": {"implementation_status": "portable_core_implemented", "native_status": "validated_cp1"},
                "py5": {"implementation_status": "portable_core_implemented", "native_status": "validated_cp1"},
            }, "status": "reviewed",
            "description": "Example contract.", "input_schema": {"type": "object"},
            "parameters": {}, "provenance": [],
        }
        self.catalog.write_text(json.dumps({"id": self.operation["id"], "version": self.operation["version"]}))
        self.write("src/core.py", "core = 1\n")
        self.write("evidence/core.json", json.dumps({"status": "passed", "nested": {"ok": True}}))
        self.write("evidence/review-evidence.json", json.dumps({"status": "passed"}))
        self.write_review()

    def write(self, relative, content):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def sha(self, relative):
        return hashlib.sha256((self.root / relative).read_bytes()).hexdigest()

    def write_review(self, *, reviewer="Sol"):
        review = {
            "status": "accepted", "owner": "root", "reviewer": reviewer,
            "implementation_sha256": {"src/core.py": self.sha("src/core.py")},
            "evidence_sha256": {"evidence/review-evidence.json": self.sha("evidence/review-evidence.json")},
        }
        self.write("evidence/review.json", json.dumps(review))

    def claimed(self):
        return {
            "status": "conformant",
            "implementation_sha256": {"src/core.py": self.sha("src/core.py")},
            "evidence_sha256": {"evidence/core.json": self.sha("evidence/core.json")},
            "evidence_predicates": [{"path": "evidence/core.json", "pointer": "/status", "equals": "passed"}],
            "acceptance_review": {"path": "evidence/review.json", "sha256": self.sha("evidence/review.json")},
            "runtime_profile": {"name": "test-runtime", "scope": "bounded test profile"},
        }

    def record(self, *, reviewer="Sol"):
        return {
            "kind": "operation-implementation-attestation", "schema_version": 1,
            "status": "accepted", "owner": "root", "reviewer": reviewer,
            "operation": {"id": self.operation["id"], "version": self.operation["version"],
                          "catalog_path": "catalog/operations/example.json", "catalog_sha256": self.sha("catalog/operations/example.json")},
            "targets": {target: {"core": self.claimed(), "native": {"status": "unvalidated"},
                                  "technique": {"status": "unvalidated"}}
                        for target in self.operation["targets"]},
        }

    def write_record(self, value=None, name="example.json"):
        path = self.root / "catalog/validation" / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value if value is not None else self.record()))

    def validate(self):
        return load_attestations(self.root, [self.operation])

    def test_absent_is_not_attested_and_legacy_contract_status_is_ignored(self):
        errors, records = self.validate()
        self.assertEqual(errors, [])
        self.assertEqual(records, {})
        rendered = reference([self.operation], records)
        self.assertIn("not attested", rendered)
        self.assertNotIn("portable_core_implemented", rendered)

    def test_valid_record(self):
        self.write_record()
        errors, records = self.validate()
        self.assertEqual(errors, [])
        self.assertEqual(set(records), {"example.json"})
        rendered = reference([self.operation], records)
        self.assertIn("conformant", rendered)
        self.assertIn("../../evidence/review.json", rendered)

    def test_root_direct_review_and_attestation_are_accepted(self):
        self.write_review(reviewer="root")
        self.write_record(self.record(reviewer="root"))
        errors, records = self.validate()
        self.assertEqual(errors, [])
        self.assertEqual(set(records), {"example.json"})

    def test_unknown_or_missing_reviewer_is_rejected(self):
        self.write_review(reviewer="unapproved")
        record = self.record(reviewer="root")
        for target in record["targets"].values():
            target["core"]["acceptance_review"]["sha256"] = self.sha("evidence/review.json")
        self.write_record(record)
        self.assertTrue(any("approved by Sol or root" in error for error in self.validate()[0]))
        self.write_review(reviewer="root")
        self.write_record(self.record(reviewer=""))
        self.assertTrue(any("approved by Sol or root" in error for error in self.validate()[0]))

    def test_unknown_status_and_unproven_technique_are_rejected(self):
        record = self.record()
        record["schema_version"] = True
        self.write_record(record)
        self.assertTrue(self.validate()[0])
        record = self.record()
        record["targets"]["p5js"]["core"]["status"] = "full-corpus-certified"
        self.write_record(record)
        self.assertTrue(any("unknown status" in error for error in self.validate()[0]))
        record = self.record()
        technique = self.claimed()
        technique["status"] = "validated-scoped"
        technique["evidence_predicates"] = []
        record["targets"]["p5js"]["technique"] = technique
        self.write_record(record)
        self.assertTrue(any("nonempty" in error for error in self.validate()[0]))

    def test_stale_contract_source_and_evidence_fail(self):
        self.write_record()
        self.catalog.write_text("changed")
        self.assertTrue(any("contract binding" in error for error in self.validate()[0]))
        self.catalog.write_text(json.dumps({"id": self.operation["id"], "version": self.operation["version"]}))
        self.write("src/core.py", "core = 2\n")
        self.assertTrue(any("stale hash" in error for error in self.validate()[0]))
        self.write("src/core.py", "core = 1\n")
        self.write("evidence/core.json", json.dumps({"status": "changed"}))
        self.assertTrue(any("stale hash" in error for error in self.validate()[0]))

    def test_unaccepted_review_and_review_source_drift_fail(self):
        self.write_record()
        self.write_review(reviewer="not-sol")
        record = self.record()
        record["targets"]["p5js"]["core"]["acceptance_review"]["sha256"] = self.sha("evidence/review.json")
        record["targets"]["py5"]["core"]["acceptance_review"]["sha256"] = self.sha("evidence/review.json")
        self.write_record(record)
        self.assertTrue(any("approved by Sol or root" in error for error in self.validate()[0]))
        self.write_review()
        record = self.record()
        record["targets"]["p5js"]["core"]["acceptance_review"]["sha256"] = self.sha("evidence/review.json")
        self.write_record(record)
        self.write("src/core.py", "review source drift\n")
        self.assertTrue(any("acceptance review implementation" in error for error in self.validate()[0]))

    def test_bad_predicates_unknown_target_and_unknown_file_fail(self):
        record = self.record()
        record["targets"]["p5js"]["core"]["evidence_predicates"][0]["pointer"] = "/missing"
        self.write_record(record)
        self.assertTrue(any("does not resolve" in error for error in self.validate()[0]))
        record = self.record()
        record["targets"]["p5js"]["core"]["evidence_predicates"][0]["equals"] = "wrong"
        self.write_record(record)
        self.assertTrue(any("predicate differs" in error for error in self.validate()[0]))
        record = self.record()
        record["targets"]["other"] = record["targets"].pop("py5")
        self.write_record(record)
        self.assertTrue(any("target set differs" in error for error in self.validate()[0]))
        self.write_record(name="unknown.json")
        self.assertTrue(any("unknown validation file" in error for error in self.validate()[0]))

    def test_unsafe_paths_and_unvalidated_shape_fail(self):
        record = self.record()
        record["targets"]["p5js"]["core"]["implementation_sha256"] = {"../outside.py": "0"}
        self.write_record(record)
        self.assertTrue(any("unsafe" in error for error in self.validate()[0]))
        record = self.record()
        record["targets"]["p5js"]["native"] = {"status": "unvalidated", "runtime_profile": {}}
        self.write_record(record)
        self.assertTrue(any("unvalidated" in error for error in self.validate()[0]))

    def test_predicate_json_types_and_strict_parse_fail_closed(self):
        self.write("evidence/core.json", json.dumps({"status": {"nested": True}}))
        record = self.record()
        record["targets"]["p5js"]["core"]["evidence_predicates"][0]["equals"] = {"nested": 1}
        self.write_record(record)
        self.assertTrue(any("predicate differs" in error for error in self.validate()[0]))

        self.write("evidence/core.json", '{"status":"passed","status":"passed"}')
        self.write_record(self.record())
        self.assertTrue(any("not JSON" in error for error in self.validate()[0]))
        self.write("evidence/core.json", '{"status":NaN}')
        self.write_record(self.record())
        self.assertTrue(any("not JSON" in error for error in self.validate()[0]))
        self.write("evidence/core.json", '{"status":1e999}')
        self.write_record(self.record())
        self.assertTrue(any("not JSON" in error for error in self.validate()[0]))

    def test_malformed_predicate_path_unicode_index_and_external_symlink_fail(self):
        record = self.record()
        record["targets"]["p5js"]["core"]["evidence_predicates"][0]["path"] = []
        self.write_record(record)
        self.assertTrue(any("path must be a string" in error for error in self.validate()[0]))

        record = self.record()
        record["targets"]["p5js"]["core"]["evidence_sha256"] = None
        self.write_record(record)
        self.assertTrue(any("requires a nonempty sha256 map" in error for error in self.validate()[0]))

        self.write("evidence/core.json", json.dumps({"status": "passed", "items": ["zero", "one"]}))
        record = self.record()
        record["targets"]["p5js"]["core"]["evidence_predicates"][0].update(pointer="/items/١", equals="one")
        self.write_record(record)
        self.assertTrue(any("does not resolve" in error for error in self.validate()[0]))

        outside = Path(self.temporary.name).parent / "attestation-outside.json"
        outside.write_text(json.dumps(self.record()))
        record_path = self.root / "catalog/validation/example.json"
        record_path.unlink()
        os.symlink(outside, record_path)
        self.assertTrue(any("resolves outside" in error for error in self.validate()[0]))
        outside.unlink(missing_ok=True)
