from __future__ import annotations

import copy
import json
from pathlib import Path
import unittest

from tools.check_delaunay_fixtures import validate

ROOT = Path(__file__).resolve().parents[1]
OP_PATH = ROOT / "catalog/operations/delaunay-2d.json"
FIXTURE_PATH = ROOT / "fixtures/operations/delaunay-2d.json"


class DelaunayFixtureValidationTests(unittest.TestCase):
    """Regression tests for the independent CP9 fixture checker."""

    def setUp(self) -> None:
        self.operation = json.loads(OP_PATH.read_text(encoding="utf-8"))
        self.operation["_catalog_path"] = str(OP_PATH.relative_to(ROOT))
        self.fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def checked(self, fixture: dict) -> list[str]:
        return validate(ROOT, "delaunay", self.operation, fixture)

    @staticmethod
    def case(fixture: dict, identifier: str) -> dict:
        return next(item for item in fixture["cases"] if item["id"] == identifier)

    def test_current_fixture_is_structurally_and_geometrically_valid(self) -> None:
        self.assertEqual([], self.checked(self.fixture))

    def test_rejects_noncanonical_mapping_and_coordinate_bits(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "duplicates-negative-zero")
        case["output"]["inputToVertex"][0] = 1
        errors = self.checked(fixture)
        self.assertTrue(any("inputToVertex" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "duplicates-negative-zero")
        case["comparison"]["points_bits_hex"][0][0] = "8000000000000000"
        errors = self.checked(fixture)
        self.assertTrue(any("points_bits_hex" in error for error in errors))

    def test_rejects_winding_incidence_and_cocircular_tie_mutations(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "triangle-hand-work-5")
        case["output"]["triangles"][0] = [0, 1, 2]
        errors = self.checked(fixture)
        self.assertTrue(any("positive orientation" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "triangle-hand-work-5")
        case["output"]["edgeFaces"][0] = [0, 0]
        errors = self.checked(fixture)
        self.assertTrue(any("edgeFaces" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "square-hand-work-9")
        case["output"].update({
            "triangles": [[0, 2, 1], [1, 2, 3]],
            "edges": [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3]],
            "edgeFaces": [[0, -1], [0, -1], [0, 1], [1, -1], [1, -1]],
        })
        errors = self.checked(fixture)
        self.assertTrue(any("lexicographic tie" in error for error in errors))

    def test_rejects_face_order_coverage_and_work_witness_mutations(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "boundary-and-internal-edge-insertions-exact-budget")
        # A face ordering mutation retains indices but no longer agrees with final edge incidence.
        case["output"]["triangles"][0], case["output"]["triangles"][1] = case["output"]["triangles"][1], case["output"]["triangles"][0]
        errors = self.checked(fixture)
        self.assertTrue(any("lexicographically sorted" in error or "edgeFaces" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "square-hand-work-9")
        # Both faces are positive and share an incidence, but their boundary
        # wrongly includes diagonal endpoints that are not on one hull side.
        case["output"].update({
            "triangles": [[0, 2, 1], [0, 2, 3]],
            "edges": [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3]],
            "edgeFaces": [[0, -1], [0, 1], [1, -1], [0, -1], [1, -1]],
        })
        errors = self.checked(fixture)
        self.assertTrue(any("supported by a strict hull side" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        failure = self.case(fixture, "one-short-locate")
        failure["error_detail"]["workUsed"] -= 1
        errors = self.checked(fixture)
        self.assertTrue(any("exactly at maxWork" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        case = self.case(fixture, "triangle-hand-work-5")
        case["output"]["workUsed"] = 2
        self.assertTrue(any("canonicalization charge" in error for error in self.checked(fixture)))

    def test_rejects_duplicate_ids_invalid_error_shape_and_stale_binding(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        fixture["cases"].append(copy.deepcopy(fixture["cases"][0]))
        errors = self.checked(fixture)
        self.assertTrue(any("unique" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        failure = self.case(fixture, "one-short-canonicalize")
        failure["error_detail"] = {"workUsed": False, "stage": []}
        errors = self.checked(fixture)
        self.assertTrue(any("workUsed" in error for error in errors))
        self.assertTrue(any("stage" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        binding = next(iter(fixture["source_bindings"]))
        fixture["source_bindings"][binding] = "0" * 64
        self.assertTrue(any("source binding" in error and "stale" in error for error in self.checked(fixture)))

    def test_rejects_malformed_cross_check_without_throwing(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        fixture["cross_case_checks"][0]["kind"] = []
        errors = self.checked(fixture)
        self.assertTrue(any("kind" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        fixture["cross_case_checks"] = fixture["cross_case_checks"][:-1]
        errors = self.checked(fixture)
        self.assertTrue(any("one-short-stage-witnesses" in error for error in errors))

        fixture = copy.deepcopy(self.fixture)
        threshold = next(item for item in fixture["cross_case_checks"] if item["kind"] == "exact-work-threshold")
        self.case(fixture, threshold["success_case"])["input"]["maxWork"] -= 1
        errors = self.checked(fixture)
        self.assertTrue(any("threshold cases" in error for error in errors))

    def test_reviewed_fixture_cannot_use_a_draft_or_missing_canonical_catalog(self) -> None:
        fixture = copy.deepcopy(self.fixture)
        fixture["fixture_status"] = "draft"
        self.assertTrue(any("reviewed operation requires" in error for error in self.checked(fixture)))

        fixture = copy.deepcopy(self.fixture)
        fixture["fixture_status"] = "reviewed"
        fixture["catalog_sha256"] = "0" * 64
        errors = self.checked(fixture)
        self.assertTrue(any("reviewed fixture" in error or "reviewed catalog_sha256" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
