import copy
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tools.benchmark import markdown_report, run_benchmark
from tools.benchmark_evidence import frame_ids, load_evidence, validate_manifest_evidence
from tools.build_benchmarks import build_manifest
from tools.ingest import build_database


class ReleaseCompletenessTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.evidence = self.root / "survey"
        self.reference = self.root / "references"
        self.candidate = self.root / "candidate"
        self.database = self.root / "corpus.sqlite"
        self.notes = self.evidence / "out" / "sample" / "notes.md"
        self.notes.parent.mkdir(parents=True)
        self.notes.write_text("""---
sketch: sample
renderer: P2D
size: [24, 24]
deterministic: true
animated: true
techniques: [grid]
parameters: []
reusable_candidates: []
---
""")
        baseline = self.notes.parent / "baseline" / "result.json"
        baseline.parent.mkdir()
        baseline.write_text(json.dumps({"status": "ok", "seed": 42, "frames": [{"frame": 1}, {"frame": 10}]}))
        self.index = self.evidence / "out" / "index.jsonl"
        self.index.write_text(json.dumps({"sketch": "sample", "status": "ok", "generative": True,
                                          "frames": [{"frame": 1}, {"frame": 10}]}) + "\n")
        self.snapshot = self.evidence / "snapshot.json"
        self.snapshot.write_text(json.dumps({"survey_revision": "test-revision", "counts": {"notes": 1}}))
        for frame in (1, 10):
            for parent in (self.reference / "out" / "sample" / "baseline", self.candidate / "sample"):
                parent.mkdir(parents=True, exist_ok=True)
                Image.new("RGB", (24, 24), (10 * frame, 50, 80)).save(parent / f"frame_{frame:05d}.png")
        build_database(self.evidence, self.database)
        self.manifest = self.build()

    def build(self):
        return build_manifest(self.database, self.reference, evidence_root=self.evidence)

    def run_release(self, manifest=None, **kwargs):
        return run_benchmark(manifest or self.manifest, self.reference, self.candidate, "p5js",
                             mode="release", evidence_root=self.evidence, **kwargs)

    def test_complete_bound_manifest_can_certify_and_development_cannot(self):
        report = self.run_release()
        self.assertTrue(report["summary"]["release_certified"])
        self.assertEqual(1.0, report["summary"]["full_manifest_coverage"])
        development = run_benchmark(self.manifest, self.reference, self.candidate, "p5js")
        self.assertTrue(development["summary"]["passed"])
        self.assertFalse(development["summary"]["release_certified"])

    def test_subset_reports_both_denominators_and_empty_selection_fails(self):
        report = run_benchmark(self.manifest, self.reference, self.candidate, "p5js", "00001$")
        self.assertEqual(1.0, report["summary"]["coverage"])
        self.assertEqual(0.5, report["summary"]["full_manifest_coverage"])
        self.assertFalse(report["summary"]["release_certified"])
        self.assertIn("development", markdown_report(report))
        empty = run_benchmark(self.manifest, self.reference, self.candidate, "p5js", "no-match")
        self.assertFalse(empty["summary"]["passed"])
        self.assertEqual(0.0, empty["summary"]["coverage"])
        self.assertIn("no required cases selected", markdown_report(empty))
        with self.assertRaisesRegex(ValueError, "forbids"):
            self.run_release(match=".*")

    def test_legacy_manifest_is_development_only(self):
        old = copy.deepcopy(self.manifest)
        old["source"].pop("evidence")
        self.assertTrue(run_benchmark(old, self.reference, self.candidate, "p5js")["summary"]["passed"])
        with self.assertRaisesRegex(ValueError, "missing or stale"):
            self.run_release(old)

    def test_changed_note_invalidates_release_and_stale_database_publication(self):
        self.notes.write_text(self.notes.read_text() + "\nNew evidence.\n")
        with self.assertRaisesRegex(ValueError, "stale"):
            self.run_release()
        with self.assertRaisesRegex(ValueError, "hashes differ"):
            self.build()

    def test_changed_baseline_invalidates_database_even_with_same_notes(self):
        baseline = self.notes.parent / "baseline" / "result.json"
        data = json.loads(baseline.read_text())
        data["seed"] = 123
        baseline.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "baseline metadata is stale"):
            self.build()

    def test_new_target_is_tracked_and_blocks_release_only(self):
        with self.index.open("a") as handle:
            handle.write(json.dumps({"sketch": "new-target", "generative": True, "status": "ok"}) + "\n")
        manifest = self.build()
        self.assertEqual(["new-target"], manifest["source"]["evidence"]["missing_reports"])
        with self.assertRaisesRegex(ValueError, "full target report set"):
            self.run_release(manifest)
        self.assertTrue(run_benchmark(manifest, self.reference, self.candidate, "p5js")["summary"]["passed"])

    def test_missing_animation_frame_prevents_manifest_publication(self):
        (self.reference / "out/sample/baseline/frame_00010.png").unlink()
        with self.assertRaisesRegex(ValueError, "missing=\\[10\\]"):
            self.build()
        report = self.run_release()
        self.assertFalse(report["summary"]["release_certified"])
        self.assertEqual("invalid-reference", report["cases"][1]["status"])

    def test_absent_baseline_and_corrupt_header_only_png_are_not_excluded(self):
        baseline = self.reference / "out/sample/baseline"
        path = baseline / "frame_00001.png"
        path.write_bytes(path.read_bytes()[:24])
        with self.assertRaisesRegex(ValueError, "invalid PNG"):
            self.build()
        for path in baseline.iterdir():
            path.unlink()
        with self.assertRaisesRegex(ValueError, "missing reference frames"):
            self.build()

    def test_release_cannot_shrink_manifest_or_demote_required_frames(self):
        for mutate in (lambda m: m["cases"].pop(),
                       lambda m: m["cases"][0].update(required=False),
                       lambda m: m["cases"][0].update(candidate="sample/frame_00010.png")):
            manifest = copy.deepcopy(self.manifest)
            mutate(manifest)
            with self.assertRaises(ValueError):
                self.run_release(manifest)

    def test_missing_candidate_and_changed_reference_do_not_certify(self):
        (self.candidate / "sample/frame_00010.png").unlink()
        report = self.run_release()
        self.assertFalse(report["summary"]["release_certified"])
        self.assertEqual(0.5, report["summary"]["full_manifest_coverage"])
        Image.new("RGB", (24, 24), "white").save(self.reference / "out/sample/baseline/frame_00001.png")
        report = self.run_release()
        self.assertEqual("invalid-reference", report["cases"][0]["status"])
        self.assertFalse(report["summary"]["passed"])

    def test_snapshot_count_and_duplicate_index_are_invalid_evidence(self):
        self.snapshot.write_text(json.dumps({"counts": {"notes": 2}}))
        with self.assertRaisesRegex(ValueError, "snapshot notes count"):
            load_evidence(self.evidence)
        self.snapshot.write_text(json.dumps({"counts": {"notes": 1}}))
        self.index.write_text(self.index.read_text() * 2)
        with self.assertRaisesRegex(ValueError, "duplicate sketch"):
            load_evidence(self.evidence)

    def test_snapshot_result_counts_are_checked(self):
        self.snapshot.write_text(json.dumps({"counts": {"notes": 1, "baseline_results": 99, "variant_results": 88}}))
        with self.assertRaisesRegex(ValueError, "baseline_results count"):
            load_evidence(self.evidence)
        self.snapshot.write_text(json.dumps({"counts": {"notes": 1, "baseline_results": 1, "variant_results": 88}}))
        with self.assertRaisesRegex(ValueError, "variant_results count"):
            load_evidence(self.evidence)

    def test_self_exports_are_not_numbered_frames_and_invalid_ids_still_fail(self):
        self.assertEqual({1}, frame_ids({"frames": [{"frame": 1}, {"frame": -1}, {"frame": -1}]}, "self export"))
        for value in (-2, True, "1", None):
            with self.assertRaises(ValueError):
                frame_ids({"frames": [{"frame": value}]}, "bad record")


if __name__ == "__main__":
    unittest.main()
