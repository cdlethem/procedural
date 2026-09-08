import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools.ingest import build_database
from tools.phase2_inventory import build_inventory, is_target_record


def write_note(path: Path, candidates: list[dict], parameters: list[dict] | None = None) -> None:
    parameters = parameters or []
    path.parent.mkdir(parents=True, exist_ok=True)
    out_index = path.parent.parts.index("out")
    sketch_identity = "/".join(path.parent.parts[out_index + 1 :])
    path.write_text(
        "---\n"
        f"sketch: {sketch_identity}\n"
        "year: 2020\nrenderer: P2D\nsize: [100, 100]\n"
        "deterministic: true\nanimated: false\ntechniques: [grid]\n"
        "primitives: [rect]\npalette:\n  colors: [\"#FFFFFF\"]\n  selection: fixed\n"
        "composition: tiled\n"
        + "parameters:\n"
        + "\n".join(f"  - {json.dumps(parameter)}" for parameter in parameters)
        + "\nreusable_candidates:\n"
        + "\n".join(f"  - {json.dumps(candidate)}" for candidate in candidates)
        + "\n---\n\n## What it draws\nA test.\n",
        encoding="utf-8",
    )


class Phase2InventoryTests(unittest.TestCase):
    def fixture(self, *, candidates=None):
        directory = tempfile.TemporaryDirectory()
        root = Path(directory.name) / "survey"
        sketch = root / "out" / "2020" / "generative" / "kept"
        write_note(
            sketch / "notes.md",
            candidates or [{"name": "tile", "signature": "tile(n) -> void", "note": "grid"}],
            [{"name": "n", "default": 10, "tried": [20], "change": "large", "effect": "denser"}],
        )
        extra = root / "out" / "2020" / "generative" / "extra" / "notes.md"
        write_note(extra, [])
        (root / "out" / "index.jsonl").parent.mkdir(parents=True, exist_ok=True)
        (root / "out" / "index.jsonl").write_text(
            json.dumps({"sketch": "2020/generative/kept", "status": "ok", "generative": True}) + "\n"
            + json.dumps({"sketch": "2020/generative/kept", "status": "ok", "generative": True}) + "\n"
            + json.dumps({"sketch": "2020/generative/missing", "status": "ok", "generative": True}) + "\n",
            encoding="utf-8",
        )
        (root / "snapshot.json").write_text(json.dumps({"survey_revision": "test-rev", "counts": {"notes": 1}}), encoding="utf-8")
        database = Path(directory.name) / "corpus.sqlite"
        build_database(root, database)
        return directory, root, database, sketch / "notes.md"

    def test_target_missing_extra_and_provenance(self):
        directory, root, database, _ = self.fixture()
        try:
            inventory = build_inventory(root, database)
            self.assertEqual(2, inventory["coverage"]["index_targets"])
            self.assertEqual(1, inventory["coverage"]["index_duplicate_lines"])
            self.assertEqual(1, inventory["coverage"]["missing_reports"])
            self.assertEqual(1, inventory["coverage"]["extra_report_files"])
            self.assertIn("duplicate_target_identities", inventory["validation_errors"])
            self.assertIn("unexpected_report_identities", inventory["validation_errors"])
            self.assertEqual(1, inventory["candidate_count"])
            dossier = inventory["candidates"][0]
            self.assertEqual("2020/generative/kept#0", dossier["identity"])
            self.assertEqual("test-rev", dossier["snapshot_revision"])
            self.assertFalse(inventory["generated_from"]["survey_root"].startswith("/"))
            self.assertFalse(inventory["generated_from"]["database"].startswith("/"))
            self.assertEqual("out/2020/generative/kept/notes.md", dossier["notes_path"])
            self.assertEqual(64, len(dossier["notes_sha256"]))
            self.assertIn("no direct candidate-to-parameter link", dossier["parameter_association"])
            self.assertEqual("large", inventory["sketch_contexts"][dossier["context_ref"]]["parameters"][0]["change"])
        finally:
            directory.cleanup()

    def test_stale_database_hash_is_reported(self):
        directory, root, database, notes_path = self.fixture()
        try:
            notes_path.write_text(notes_path.read_text(encoding="utf-8") + "\nchanged prose\n", encoding="utf-8")
            inventory = build_inventory(root, database)
            self.assertEqual(1, inventory["coverage"]["stale_database_hashes"])
            self.assertIn("stale_database_note_hashes", inventory["validation_errors"])
            self.assertTrue(any("stale_database_hash" in warning for warning in inventory["candidates"][0]["warnings"]))
        finally:
            directory.cleanup()

    def test_target_selection_uses_published_flags_not_path_guessing(self):
        self.assertTrue(is_target_record({"sketch": "unusual/place", "generative": True, "status": "ok"}))
        for row in ({"sketch": "2020/generative/x", "status": "ok", "generative": False},
                    {"sketch": "2020/generative/x"},
                    {"sketch": "2020/generative/x", "status": "runtime_error", "generative": True}):
            self.assertFalse(is_target_record(row))

    def test_empty_trials_do_not_establish_inert_parameter_evidence(self):
        directory, root, database, notes_path = self.fixture()
        try:
            write_note(notes_path, [{"name": "branch", "signature": "branch(n)", "note": "line pool"}],
                       [{"name": "n", "default": 90000, "tried": [], "change": "none", "effect": ""}])
            build_database(root, database)
            inventory = build_inventory(root, database)
            warnings = inventory["candidates"][0]["warnings"]
            self.assertTrue(any("no trials" in warning for warning in warnings))
        finally:
            directory.cleanup()

    def test_missing_previous_inventory_does_not_pretend_reconciliation_succeeded(self):
        directory, root, database, _ = self.fixture()
        try:
            inventory = build_inventory(root, database, root / "missing.json")
            self.assertIn("previous_inventory_invalid", inventory["validation_errors"])
        finally:
            directory.cleanup()

    def test_previous_reconciliation_uses_hashes_and_flags_ordinal_drift(self):
        directory, root, database, notes_path = self.fixture(
            candidates=[
                {"name": "first", "signature": "a()", "note": "a"},
                {"name": "second", "signature": "b()", "note": "b"},
            ]
        )
        try:
            before = build_inventory(root, database)
            previous = Path(directory.name) / "previous.json"
            previous.write_text(json.dumps(before), encoding="utf-8")
            write_note(
                notes_path,
                [
                    {"name": "second", "signature": "b()", "note": "b"},
                    {"name": "first", "signature": "a()", "note": "a"},
                ],
            )
            build_database(root, database)
            after = build_inventory(root, database, previous)
            self.assertEqual(["2020/generative/kept#0", "2020/generative/kept#1"], after["delta"]["changed"])
            self.assertEqual(2, len(after["delta"]["ordinal_drift"]))
        finally:
            directory.cleanup()

    def test_variant_only_change_invalidates_candidate_and_note_context(self):
        directory, root, database, notes_path = self.fixture()
        try:
            variant_dir = notes_path.parent / "variants" / "size_20"
            variant_dir.mkdir(parents=True)
            variant_path = variant_dir / "result.json"
            variant_path.write_text(json.dumps({"status": "ok", "diff_vs_baseline": {"label": "subtle", "mean": 0.1}}), encoding="utf-8")
            build_database(root, database)
            before = build_inventory(root, database)
            previous = Path(directory.name) / "previous.json"
            previous.write_text(json.dumps(before), encoding="utf-8")
            variant_path.write_text(json.dumps({"status": "ok", "diff_vs_baseline": {"label": "large", "mean": 0.9}}), encoding="utf-8")
            build_database(root, database)
            after = build_inventory(root, database, previous)
            self.assertIn("2020/generative/kept#0", after["delta"]["changed"])
            self.assertIn("2020/generative/kept", after["delta"]["notes"]["changed"])
            self.assertEqual("large", after["sketch_contexts"]["2020/generative/kept"]["variants"][0]["diff_label"])
        finally:
            directory.cleanup()

    def test_snapshot_revision_and_unrelated_note_do_not_change_candidate_hash(self):
        directory, root, database, _ = self.fixture()
        try:
            before = build_inventory(root, database)
            previous = Path(directory.name) / "previous.json"
            previous.write_text(json.dumps(before), encoding="utf-8")
            unrelated = root / "out" / "2020" / "generative" / "new-report" / "notes.md"
            write_note(unrelated, [])
            (root / "snapshot.json").write_text(json.dumps({"survey_revision": "new-revision", "counts": {"notes": 3}}), encoding="utf-8")
            build_database(root, database)
            after = build_inventory(root, database, previous)
            self.assertTrue(after["delta"]["snapshot_changed"])
            self.assertEqual([], after["delta"]["changed"])
            self.assertEqual(["2020/generative/new-report"], after["delta"]["notes"]["added"])
        finally:
            directory.cleanup()

    def test_malformed_published_variant_is_retained_as_diagnostic(self):
        directory, root, database, notes_path = self.fixture()
        try:
            variant_dir = notes_path.parent / "variants" / "broken"
            variant_dir.mkdir(parents=True)
            (variant_dir / "result.json").write_text("{not-json", encoding="utf-8")
            inventory = build_inventory(root, database)
            context = inventory["sketch_contexts"]["2020/generative/kept"]
            self.assertEqual(1, inventory["published_results"]["variant_malformed_files"])
            self.assertEqual("invalid_json", context["variants"][0]["status"])
            self.assertTrue(any("malformed" in warning for warning in context["warnings"]))
        finally:
            directory.cleanup()

    def test_snapshot_mismatch_is_validation_error(self):
        directory, root, database, _ = self.fixture()
        try:
            (root / "snapshot.json").write_text(json.dumps({"survey_revision": "test-rev", "counts": {"notes": 1, "baseline_results": 9}}), encoding="utf-8")
            inventory = build_inventory(root, database)
            self.assertIn("snapshot_count_mismatch", inventory["validation_errors"])
        finally:
            directory.cleanup()

    def test_cli_returns_nonzero_for_snapshot_mismatch(self):
        directory, root, database, _ = self.fixture()
        try:
            (root / "snapshot.json").write_text(json.dumps({"survey_revision": "test-rev", "counts": {"notes": 999}}), encoding="utf-8")
            output_json = Path(directory.name) / "out.json"
            output_md = Path(directory.name) / "out.md"
            completed = subprocess.run(
                [sys.executable, "tools/phase2_inventory.py", "--survey-root", str(root), "--database", str(database), "--output-json", str(output_json), "--output-markdown", str(output_md)],
                cwd=Path(__file__).parents[1], capture_output=True, text=True, check=False,
            )
            self.assertEqual(2, completed.returncode)
            self.assertIn("snapshot_count_mismatch", completed.stderr)
            self.assertTrue(output_json.is_file())
        finally:
            directory.cleanup()


if __name__ == "__main__":
    unittest.main()
