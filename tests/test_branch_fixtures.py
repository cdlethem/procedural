from __future__ import annotations

import copy
import json
from pathlib import Path
import unittest

from tools.check_branch_fixtures import validate

ROOT = Path(__file__).resolve().parents[1]
OP_PATH = ROOT / "catalog/operations/seeded-endpoint-branches.json"
FIXTURE_PATH = ROOT / "fixtures/operations/seeded-endpoint-branches.json"


class BranchFixtureValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.operation = json.loads(OP_PATH.read_text())
        self.fixture = json.loads(FIXTURE_PATH.read_text())

    def checked(self, fixture: dict) -> list[str]:
        return validate(ROOT, "branch", self.operation, fixture)

    def case(self, fixture: dict, identifier: str) -> dict:
        return next(item for item in fixture["cases"] if item["id"] == identifier)

    def test_canonical_draft_fixture_is_structurally_valid(self) -> None:
        self.assertEqual([], self.checked(self.fixture))

    def test_rejects_non_ancestral_child_endpoint(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "branch-seed-42")
        case["output"]["segments"][1][0] += 1.0
        self.assertTrue(any("start must exactly equal parent endpoint" in item for item in self.checked(fixture)))

    def test_rejects_incorrect_child_count(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "branch-seed-42")
        case["output"]["childCounts"][0] += 1
        self.assertTrue(any("childCounts must equal" in item for item in self.checked(fixture)))

    def test_rejects_negative_or_misaligned_trig_tolerance(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "branch-seed-42")
        case["comparison"]["segments_abs"][0][0] = -1.0
        self.assertTrue(any("segments_abs[0]" in item for item in self.checked(fixture)))

    def test_rejects_stale_source_binding(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        binding = next(iter(fixture["source_bindings"]))
        fixture["source_bindings"][binding] = "0" * 64
        self.assertTrue(any("source binding" in item and "stale" in item for item in self.checked(fixture)))

    def test_requires_dynamic_trace_and_paired_root_indexes(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        error = self.case(fixture, "child-length-overflow")
        del error["rng_trace"]
        error["error_detail"]["parentIndex"] = -1
        errors = self.checked(fixture)
        self.assertTrue(any("pre-failure RNG trace" in item for item in errors))
        self.assertTrue(any("both indexes -1" in item for item in errors))

    def test_requires_tolerance_rationale_and_complete_bindings(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        del self.case(fixture, "branch-seed-42")["comparison"]["rationale"]
        del fixture["source_bindings"]["tools/generate_branch_tree_fixtures.py"]
        errors = self.checked(fixture)
        self.assertTrue(any("tolerance rationale" in item for item in errors))
        self.assertTrue(any("must include generator" in item for item in errors))

    def test_rejects_stale_catalog_hash_and_nonfinite_success_input(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        fixture["catalog_sha256"] = "0" * 64
        self.assertTrue(any("catalog_sha256" in item for item in self.checked(fixture)))
        fixture = copy.deepcopy(self.fixture)
        self.case(fixture, "root-only")["input"]["root"]["heading"] = float("inf")
        self.assertTrue(any("nonfinite" in item for item in self.checked(fixture)))

    def test_rejects_reversed_success_interval_and_wrong_dynamic_classification(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        success = self.case(fixture, "root-only")
        success["input"]["rules"] = [{"lengthScale": [0.9, 0.1], "slots": []}]
        errors = self.checked(fixture)
        self.assertTrue(any("lengthScale lower exceeds upper" in item for item in errors))
        fixture = copy.deepcopy(self.fixture)
        invalid = self.case(fixture, "invalid-unreachable-rule")
        invalid["error"] = "BRANCH_ARITHMETIC_INVALID"
        invalid["error_detail"] = {"parentIndex": 0, "slotIndex": 0, "stage": "length"}
        self.assertTrue(any("requires statically valid input" in item for item in self.checked(fixture)))


if __name__ == "__main__":
    unittest.main()
