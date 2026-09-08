import copy
import json
import tempfile
import unittest
from collections import Counter
from pathlib import Path

from tools.check_phase2_design import build_ledger, load_ledger, validate
from tools.ingest import build_database


class Phase2DesignTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.survey = self.root / "survey"
        self.note = self.survey / "out/sample/notes.md"
        self.note.parent.mkdir(parents=True)
        self.note.write_text('''---
sketch: sample
renderer: P2D
deterministic: true
reusable_candidates:
  - {name: rcol, signature: "rcol(colors) -> color", note: "uniform palette entry"}
  - {name: palettePick, signature: "pick(colors) -> color", note: "uniform palette entry"}
---
## Modularisation notes
Palette entry selection is generic; the palette literals are artwork.
''')
        (self.survey / "snapshot.json").write_text(json.dumps({"survey_revision": "test", "counts": {"notes": 1}}))
        self.database = self.root / "corpus.sqlite"
        build_database(self.survey, self.database)
        self.ledger = build_ledger(self.database, self.survey)

    def check(self, ledger=None, **kwargs):
        return validate(ledger or self.ledger, self.database, self.survey, **kwargs)

    def finalize(self):
        for ordinal, record in enumerate(self.ledger["records"].values()):
            record.update(disposition="keep" if ordinal == 0 else "merge", cluster_id="color.palette-pick",
                          status="reviewed_provisional", review_basis="out/sample/notes.md#modularisation-notes",
                          reason="The note defines selection of a supplied palette entry, separate from artwork.")
        self.ledger["summary"] = {
            "dispositions": dict(sorted(Counter(r["disposition"] for r in self.ledger["records"].values()).items())),
            "statuses": dict(sorted(Counter(r["status"] for r in self.ledger["records"].values()).items())),
        }

    def contract_ledger(self, *, architecture=None, audits=True):
        ledger = copy.deepcopy(self.ledger)
        cluster_id = "contract.test-operation"
        ledger["clusters"].append({
            "id": cluster_id,
            "status": "proposed",
            "reason": "test operation candidate",
            "architecture": architecture if architecture is not None else {
                "level": "operation_candidate",
                "status": "reviewed",
                "inputs": "finite triangle vertices",
                "outputs": "one sampled point",
                "invariants": "point lies inside the triangle",
                "open_questions": [],
            },
        })
        records = list(ledger["records"].values())
        for ordinal, record in enumerate(records):
            record.update(
                disposition="keep" if ordinal == 0 else "merge",
                cluster_id=cluster_id,
                status="reviewed_provisional",
                review_basis="out/sample/notes.md#modularisation-notes",
                reason="The candidate is accounted for in the operation boundary.",
            )
            if audits:
                record["decision_audit"] = {
                    "status": "verified",
                    "scope": "whole_computation" if ordinal == 0 else "component_extraction",
                    "computation": "candidate computation represented by the operation",
                    "remainder": [] if ordinal == 0 else [{
                        "component": "host drawing",
                        "disposition": "adapter",
                        "reason": "host rendering remains outside the operation",
                    }],
                }
        ledger["summary"] = {
            "dispositions": dict(sorted(Counter(r["disposition"] for r in records).items())),
            "statuses": dict(sorted(Counter(r["status"] for r in records).items())),
        }
        return ledger, cluster_id

    def dependency_ledger(self):
        ledger = copy.deepcopy(self.ledger)
        cluster_id = "field.gradient-noise-2d"
        record = ledger["records"]["sample#0"]
        ledger["clusters"].append({
            "id": cluster_id,
            "status": "reviewed_provisional",
            "reason": "An independently specified scalar field is required by the reviewed capability.",
            "admission_kind": "capability_dependency",
            "architecture": {
                "level": "operation_candidate",
                "status": "reviewed",
                "inputs": "finite planar coordinate and explicit seed",
                "outputs": "one deterministic scalar sample",
                "invariants": "no rendering or host state",
                "open_questions": [],
            },
            "dependency_admission": {
                "status": "reviewed",
                "owner": "root",
                "reviewer": "independent architecture reviewer",
                "decision": "design/capabilities/cp1-field-marks.md",
                "rationale": "The capability needs a pure scalar source; source candidates remain composite consumers.",
                "motivating_candidates": [{
                    "candidate_id": "sample#0",
                    "source_sha256": record["source_sha256"],
                    "evidence_sha256": record["evidence_sha256"],
                    "dependency": "scalar noise source used by the composition",
                    "remainder": [{
                        "component": "palette selection and mark drawing",
                        "disposition": "recipe",
                        "reason": "The source candidate's artistic composition remains outside the dependency.",
                    }],
                }],
            },
        })
        return ledger, cluster_id

    def test_triage_is_not_a_final_review_and_complete_review_is_separately_checkable(self):
        self.assertEqual([], self.check())
        self.assertTrue(any("unresolved" in e for e in self.check(require_reviewed=True)))
        self.finalize()
        self.assertEqual([], self.check(require_reviewed=True))

    def test_changed_prose_and_stale_database_invalidate_old_review(self):
        self.finalize()
        self.note.write_text(self.note.read_text() + "\nActually the picker excludes the background.\n")
        self.assertTrue(any("stale database" in e for e in self.check()))
        build_database(self.survey, self.database)
        errors = self.check()
        self.assertTrue(any("source_sha256" in e for e in errors))

    def test_variant_only_change_invalidates_evidence_without_candidate_change(self):
        path = self.note.parent / "variants" / "test" / "result.json"
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps({"status": "ok", "diff": {"label": "none"}}))
        self.assertTrue(any("evidence_sha256" in e for e in self.check()))

    def test_candidate_tampering_missing_identity_and_wrong_cluster_fail(self):
        self.finalize()
        changed = copy.deepcopy(self.ledger)
        changed["records"]["sample#0"]["candidate"]["note"] = "different computation"
        self.assertTrue(any("candidate differs" in e for e in self.check(changed)))
        changed = copy.deepcopy(self.ledger)
        changed["records"].pop("sample#0")
        errors = self.check(changed)
        self.assertTrue(any("identity mismatch" in e for e in errors))
        self.assertTrue(any("merge has no kept" in e for e in errors))
        changed = copy.deepcopy(self.ledger)
        changed["records"]["sample#1"]["cluster_id"] = "invented"
        self.assertTrue(any("unknown decision cluster" in e for e in self.check(changed)))

    def test_reviewed_records_need_reason_provenance_and_consistent_summary(self):
        self.finalize()
        record = self.ledger["records"]["sample#0"]
        record["reason"] = ""
        record["review_basis"] = "out/other/notes.md"
        self.ledger["summary"]["dispositions"]["keep"] = 200
        errors = self.check()
        self.assertTrue(any("requires a reason" in e for e in errors))
        self.assertTrue(any("parent-note provenance" in e for e in errors))
        self.assertTrue(any("summary counts" in e for e in errors))

    def test_duplicate_json_keys_cannot_hide_record_loss(self):
        path = self.root / "ledger.json"
        path.write_text('{"records": {"sample#0": {}, "sample#0": {}}}')
        with self.assertRaisesRegex(ValueError, "duplicate JSON key"):
            load_ledger(path)

    def test_missing_database_is_not_created_by_validation(self):
        missing = self.root / "missing.sqlite"
        self.assertTrue(validate(self.ledger, missing, self.survey))
        self.assertFalse(missing.exists())

    def test_contract_gate_rejects_invalid_architecture_and_unknown_cluster(self):
        bad = {
            "level": "family",
            "status": "draft",
            "inputs": "x",
            "outputs": "y",
            "invariants": "z",
            "open_questions": ["unresolved"],
        }
        ledger, cluster_id = self.contract_ledger(architecture=bad, audits=False)
        errors = self.check(ledger, contract_cluster=cluster_id)
        self.assertTrue(any("operation_candidate" in e for e in errors))
        self.assertTrue(any("architecture status" in e for e in errors))
        self.assertTrue(any("open_questions" in e for e in errors))
        self.assertTrue(any("requires decision_audit" in e for e in errors))
        self.assertTrue(any("unknown" in e for e in self.check(contract_cluster="missing.cluster")))

    def test_contract_gate_requires_remainder_for_component_extraction(self):
        ledger, cluster_id = self.contract_ledger()
        ledger["records"]["sample#1"]["decision_audit"]["remainder"] = []
        errors = self.check(ledger, contract_cluster=cluster_id)
        self.assertTrue(any("component_extraction audit requires remainder accounting" in e for e in errors))

    def test_contract_gate_accepts_verified_whole_and_component_audits(self):
        ledger, cluster_id = self.contract_ledger()
        self.assertEqual([], self.check(ledger, contract_cluster=cluster_id))

    def test_capability_dependency_admission_accepts_evidence_bound_composite_motivator(self):
        ledger, cluster_id = self.dependency_ledger()
        self.assertEqual([], self.check(ledger, contract_cluster=cluster_id))

    def test_capability_dependency_admission_rejects_forged_or_stale_motivator(self):
        ledger, cluster_id = self.dependency_ledger()
        motivator = ledger["clusters"][-1]["dependency_admission"]["motivating_candidates"][0]
        motivator["source_sha256"] = "forged"
        self.assertTrue(any("source_sha256" in error for error in self.check(ledger, contract_cluster=cluster_id)))
        motivator["source_sha256"] = self.ledger["records"]["sample#0"]["source_sha256"]
        motivator["evidence_sha256"] = "stale"
        self.assertTrue(any("evidence_sha256" in error for error in self.check(ledger, contract_cluster=cluster_id)))

    def test_capability_dependency_admission_requires_remainder_and_no_fake_member(self):
        ledger, cluster_id = self.dependency_ledger()
        motivator = ledger["clusters"][-1]["dependency_admission"]["motivating_candidates"][0]
        motivator["remainder"] = []
        self.assertTrue(any("requires remainder accounting" in error
                            for error in self.check(ledger, contract_cluster=cluster_id)))
        motivator["remainder"] = [{
            "component": "palette selection and mark drawing",
            "disposition": "recipe",
            "reason": "The source candidate's artistic composition remains outside the dependency.",
        }]
        record = ledger["records"]["sample#1"]
        record.update(cluster_id=cluster_id, disposition="keep", status="reviewed_provisional",
                      review_basis="out/sample/notes.md#modularisation-notes",
                      reason="This must not become a member of a dependency admission.")
        ledger["summary"] = {
            "dispositions": dict(sorted(Counter(r["disposition"] for r in ledger["records"].values()).items())),
            "statuses": dict(sorted(Counter(r["status"] for r in ledger["records"].values()).items())),
        }
        self.assertTrue(any("cannot assign ordinary candidate members" in error
                            for error in self.check(ledger, contract_cluster=cluster_id)))

    def test_unknown_admission_kind_fails(self):
        ledger, cluster_id = self.dependency_ledger()
        ledger["clusters"][-1]["admission_kind"] = "invented"
        self.assertTrue(any("unknown admission kind" in error
                            for error in self.check(ledger, contract_cluster=cluster_id)))

    def test_audit_fields_are_checked_without_contract_gate(self):
        ledger = copy.deepcopy(self.ledger)
        ledger["records"]["sample#0"]["decision_audit"] = {
            "status": "draft",
            "scope": "component_extraction",
            "computation": "",
            "remainder": [{"component": "", "disposition": "unknown", "reason": ""}],
        }
        errors = self.check(ledger)
        self.assertTrue(any("decision_audit status" in e for e in errors))
        self.assertTrue(any("decision_audit requires a computation" in e for e in errors))
        self.assertTrue(any("remainder[0]" in e for e in errors))

    def test_non_unreviewed_defer_requires_reason_and_parent_provenance(self):
        ledger = copy.deepcopy(self.ledger)
        record = ledger["records"]["sample#0"]
        record["status"] = "reviewed_defer"
        record["reason"] = ""
        record["review_basis"] = "out/other/notes.md#modularisation-notes"
        errors = self.check(ledger)
        self.assertTrue(any("reviewed status requires a reason" in e for e in errors))
        self.assertTrue(any("reviewed status requires parent-note provenance" in e for e in errors))

    def test_unresolved_member_blocks_its_cluster_but_not_other_work(self):
        ledger, cluster_id = self.contract_ledger()
        record = ledger["records"]["sample#1"]
        record.update(disposition="review_required", status="reviewed_defer")
        ledger["summary"] = {
            "dispositions": dict(sorted(Counter(r["disposition"] for r in ledger["records"].values()).items())),
            "statuses": dict(sorted(Counter(r["status"] for r in ledger["records"].values()).items())),
        }
        self.assertEqual([], self.check(ledger))
        self.assertTrue(any("unresolved member of contract cluster" in e
                            for e in self.check(ledger, contract_cluster=cluster_id)))
        record["cluster_id"] = "review.unresolved-computation"
        record["reason"] = "Separate computation, excluded from this operation's scope after review."
        self.assertEqual([], self.check(ledger, contract_cluster=cluster_id))

    def test_data_quality_status_cannot_bypass_provenance_on_valid_candidate(self):
        ledger = copy.deepcopy(self.ledger)
        ledger["records"]["sample#0"]["status"] = "blocked_data_quality"
        errors = self.check(ledger)
        self.assertTrue(any("reviewed status requires parent-note provenance" in e for e in errors))

    def test_rejection_cannot_silently_discard_component_accounting(self):
        self.finalize()
        self.ledger["records"]["sample#1"]["disposition"] = "reject"
        self.assertTrue(any("rejection requires decision_audit" in e for e in self.check()))


if __name__ == "__main__":
    unittest.main()
