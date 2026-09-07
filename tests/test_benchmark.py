import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from tools.benchmark import compare_images, evaluate_gates, run_benchmark, sha256
from tools.build_benchmarks import build_manifest
from tools.ingest import build_database


class ImageMetricTests(unittest.TestCase):
    def test_identical_images_receive_perfect_metrics(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "image.png"
            Image.new("RGB", (32, 24), (20, 80, 140)).save(path)
            metrics = compare_images(path, path)
            self.assertTrue(metrics["dimensions_match"])
            self.assertTrue(metrics["exact_sha256"])
            self.assertEqual(0.0, metrics["rgb_mae"])
            self.assertEqual(0.0, metrics["changed_fraction_10pct"])
            self.assertEqual(1.0, metrics["ssim"])
            self.assertEqual(1.0, metrics["histogram_intersection"])
            self.assertEqual(1.0, metrics["edge_similarity"])
            self.assertEqual(0, metrics["dhash_distance"])
            self.assertEqual(100.0, metrics["score"])

    def test_opposite_images_fail_portable_gates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            black = root / "black.png"
            white = root / "white.png"
            Image.new("RGB", (32, 32), (0, 0, 0)).save(black)
            Image.new("RGB", (32, 32), (255, 255, 255)).save(white)
            metrics = compare_images(black, white)
            failures = evaluate_gates(
                metrics,
                {"dimensions_match": True, "score_min": 75.0, "histogram_intersection_min": 0.7},
            )
            self.assertEqual(1.0, metrics["rgb_mae"])
            self.assertLess(metrics["score"], 75.0)
            self.assertGreaterEqual(len(failures), 2)

    def test_dimension_mismatch_is_reported_even_when_metrics_are_computed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            small = root / "small.png"
            large = root / "large.png"
            Image.new("RGB", (16, 16), (40, 50, 60)).save(small)
            Image.new("RGB", (32, 32), (40, 50, 60)).save(large)
            metrics = compare_images(small, large)
            self.assertFalse(metrics["dimensions_match"])
            self.assertIn("dimensions_match", evaluate_gates(metrics, {"dimensions_match": True})[0])


class BenchmarkSuiteTests(unittest.TestCase):
    def test_required_missing_case_fails_coverage(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference = root / "references" / "out" / "sample" / "frame_00001.png"
            reference.parent.mkdir(parents=True)
            Image.new("RGB", (20, 20), (10, 20, 30)).save(reference)
            manifest = {
                "metric_version": 1,
                "targets": {"p5js": {"label": "p5.js"}},
                "profiles": {"exact": {"gates": {"dimensions_match": True, "exact_sha256": True}}},
                "summary": {"cases": 1},
                "cases": [
                    {
                        "id": "sample::frame_00001",
                        "sketch": "sample",
                        "frame": 1,
                        "reference": "out/sample/frame_00001.png",
                        "candidate": "sample/frame_00001.png",
                        "reference_sha256": sha256(reference),
                        "profile": "exact",
                        "required": True,
                        "metadata": {"renderer": "P2D", "techniques": ["grid"]},
                    }
                ],
            }
            candidate_root = root / "candidates"
            report = run_benchmark(manifest, root / "references", candidate_root, "p5js")
            self.assertFalse(report["summary"]["passed"])
            self.assertEqual(0.0, report["summary"]["coverage"])
            self.assertEqual("missing", report["cases"][0]["status"])

            candidate = candidate_root / "sample" / "frame_00001.png"
            candidate.parent.mkdir(parents=True)
            candidate.write_bytes(reference.read_bytes())
            report = run_benchmark(manifest, root / "references", candidate_root, "p5js")
            self.assertTrue(report["summary"]["passed"])
            self.assertEqual(1.0, report["summary"]["coverage"])
            self.assertEqual("passed", report["cases"][0]["status"])

    def test_manifest_includes_all_frames_targets_and_stub_exclusion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "survey"
            live = root / "out" / "2020" / "live"
            baseline = live / "baseline"
            baseline.mkdir(parents=True)
            (live / "notes.md").write_text(
                """---
sketch: 2020/live
year: 2020
renderer: P2D
size: [40, 30]
libraries: []
deterministic: true
ms_first_frame: 10
animated: true
techniques: [grid]
primitives: [rect]
palette:
  colors: [\"#FFFFFF\"]
  selection: fixed
composition: tiled
parameters: []
reusable_candidates: []
---
"""
            )
            (baseline / "result.json").write_text(json.dumps({"status": "ok", "seed": 42, "display": ":2", "uses_shader": False}))
            Image.new("RGB", (40, 30), (0, 0, 0)).save(baseline / "frame_00001.png")
            Image.new("RGB", (40, 30), (255, 255, 255)).save(baseline / "frame_00010.png")

            stub = root / "out" / "2020" / "stub"
            stub.mkdir(parents=True)
            (stub / "notes.md").write_text("---\nsketch: 2020/stub\nskipped: blank_baseline\n---\n")

            database = Path(directory) / "corpus.sqlite"
            build_database(root, database)
            manifest = build_manifest(database, root, "data/corpus.sqlite")
            self.assertEqual({"processing-java", "p5js", "py5", "processing-android"}, set(manifest["targets"]))
            self.assertEqual(2, manifest["summary"]["cases"])
            self.assertEqual([1, 10], [case["frame"] for case in manifest["cases"]])
            self.assertEqual("2020/live/frame_00010.png", manifest["cases"][1]["candidate"])
            self.assertEqual([{"sketch": "2020/stub", "reason": "survey stub: blank_baseline"}], manifest["excluded"])


if __name__ == "__main__":
    unittest.main()
