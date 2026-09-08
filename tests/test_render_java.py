import tempfile
import unittest
import hashlib
import os
from unittest import mock
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path

from tools import render_java


ROOT = Path(__file__).resolve().parents[1]


class RenderJavaTests(unittest.TestCase):
    def setUp(self):
        parent = ROOT / ".work" / "tmp"
        parent.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=parent)
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)

    def test_single_and_sweep_variants(self):
        self.assertEqual(render_java.variants(["radius=110"], None), [{"radius": 110.0}])
        self.assertEqual(render_java.variants(["radius=110"], "spacing=4,18,80"), [
            {"radius": 110.0, "spacing": 4.0},
            {"radius": 110.0, "spacing": 18.0},
            {"radius": 110.0, "spacing": 80.0},
        ])

    def test_finite_values_are_required(self):
        for text in ("radius=nan", "radius=inf", "radius=-inf"):
            with self.assertRaisesRegex(ValueError, "finite"):
                render_java.parameter(text)

    def test_duplicate_parameters_and_sweep_collision(self):
        with self.assertRaisesRegex(ValueError, "duplicate"):
            render_java.variants(["radius=1", "radius=2"], None)
        with self.assertRaisesRegex(ValueError, "new parameter"):
            render_java.variants(["radius=1"], "radius=2,3")

    def test_sweep_has_maximum_sixteen_values(self):
        values = ",".join(str(i) for i in range(16))
        self.assertEqual(len(render_java.variants([], "spacing=" + values)), 16)
        with self.assertRaisesRegex(ValueError, "1 through 16"):
            render_java.variants([], "spacing=" + ",".join(str(i) for i in range(17)))

    def test_invalid_names_are_rejected(self):
        for text in ("bad-name=1", "1bad=1", "=1", "bad"):
            with self.assertRaises(ValueError):
                render_java.parameter(text)

    def test_asset_inventory_is_sorted_and_allows_empty_root(self):
        assets = self.base / "assets"
        (assets / "z").mkdir(parents=True)
        (assets / "a").mkdir()
        (assets / "z" / "last.bin").write_bytes(b"last")
        (assets / "a" / "first.bin").write_bytes(b"first")
        (assets / "a.txt").write_bytes(b"flat")
        inventory = render_java.asset_inventory(assets)
        self.assertEqual([item["path"] for item in inventory["files"]],
                         ["a.txt", "a/first.bin", "z/last.bin"])
        self.assertEqual(inventory["bytes"], 13)
        self.assertEqual(inventory["files"][0]["sha256"],
                         hashlib.sha256(b"flat").hexdigest())
        (self.base / "empty").mkdir()
        self.assertEqual(render_java.asset_inventory(self.base / "empty")["files"], [])

    def test_asset_root_and_entries_reject_symlinks_and_non_directories(self):
        with self.assertRaisesRegex(ValueError, "directory"):
            render_java.asset_inventory(self.base / "missing")
        regular = self.base / "regular"
        regular.write_bytes(b"x")
        with self.assertRaisesRegex(ValueError, "directory"):
            render_java.asset_inventory(regular)
        target = self.base / "target"
        target.write_bytes(b"x")
        link = self.base / "link"
        os.symlink(target, link)
        with self.assertRaisesRegex(ValueError, "symlink"):
            render_java.asset_inventory(link)
        assets = self.base / "nested"
        assets.mkdir()
        os.symlink(target, assets / "asset")
        with self.assertRaisesRegex(ValueError, "symlink"):
            render_java.asset_inventory(assets)

    def test_asset_budgets_are_checked_during_preflight(self):
        assets = self.base / "assets"
        assets.mkdir()
        (assets / "one").write_bytes(b"1")
        (assets / "two").write_bytes(b"2")
        with mock.patch.object(render_java, "ASSET_MAX_FILES", 1):
            with self.assertRaisesRegex(ValueError, "file budget"):
                render_java.asset_inventory(assets)
        with mock.patch.object(render_java, "ASSET_MAX_BYTES", 1):
            with self.assertRaisesRegex(ValueError, "byte budget"):
                render_java.asset_inventory(assets)

    def test_staged_assets_detect_source_and_staged_mutation(self):
        assets = self.base / "assets"
        (assets / "nested").mkdir(parents=True)
        (assets / "nested" / "marker.txt").write_text("original")
        inventory = render_java.asset_inventory(assets)
        staged = self.base / "variant" / "data"
        render_java.stage_assets(assets, staged, inventory)
        self.assertEqual((staged / "nested" / "marker.txt").read_text(), "original")
        (staged / "nested" / "marker.txt").write_text("changed")
        with self.assertRaisesRegex(RuntimeError, "changed"):
            render_java.verify_asset_inventory(staged, inventory)
        (staged / "nested" / "marker.txt").write_text("original")
        (assets / "nested" / "marker.txt").write_text("source changed")
        with self.assertRaisesRegex(RuntimeError, "changed"):
            render_java.verify_asset_inventory(assets, inventory)
        (assets / "nested" / "marker.txt").write_text("original")
        (assets / "added.txt").write_text("new")
        with self.assertRaisesRegex(RuntimeError, "changed"):
            render_java.verify_asset_inventory(assets, inventory)
        (assets / "added.txt").unlink()
        (assets / "nested" / "marker.txt").unlink()
        with self.assertRaisesRegex(RuntimeError, "changed"):
            render_java.verify_asset_inventory(assets, inventory)

    def test_existing_output_is_preserved_before_runtime_work(self):
        sketch_dir = self.base / "Sketch"
        sketch_dir.mkdir()
        sketch = sketch_dir / "Sketch.pde"
        sketch.write_text("void settings(){}")
        library = self.base / "library.jar"
        library.write_bytes(b"placeholder")
        output = self.base / "existing"
        output.mkdir(parents=True)
        marker = output / "marker"
        marker.write_text("keep")
        with self.assertRaises(SystemExit):
            render_java.main([
                str(sketch), "--library", str(library), "--seed", "42",
                "--output", str(output),
            ])
        self.assertEqual(marker.read_text(), "keep")

    def test_invalid_seed_fails_before_sketch_or_runtime(self):
        with self.assertRaises(SystemExit):
            render_java.main([
                str(self.base / "missing.pde"), "--library", str(self.base / "missing.jar"),
                "--seed", "4294967296", "--output", str(ROOT / ".work" / "tmp" / "seed-invalid"),
            ])

    def test_frame_defaults_to_first_draw(self):
        error = self._frame_cli_error([])
        self.assertNotIn("frame", error.lower())

    def test_frame_accepts_one_through_ten_thousand(self):
        for frame in ("1", "10000"):
            error = self._frame_cli_error(["--frame", frame])
            self.assertNotIn("frame", error.lower())

    def test_frame_rejects_out_of_range_and_noninteger_before_runtime(self):
        for frame in ("0", "-1", "10001", "not-an-integer"):
            error = self._frame_cli_error(["--frame", frame])
            self.assertIn("frame", error.lower())

    def _frame_cli_error(self, frame_args):
        arguments = [
            str(self.base / "missing.pde"), "--library", str(self.base / "missing.jar"),
            "--seed", "42", "--output", str(self.base / "frame-output"),
            *frame_args,
        ]
        stderr = StringIO()
        with redirect_stderr(stderr), self.assertRaises(SystemExit):
            render_java.main(arguments)
        return stderr.getvalue().splitlines()[-1]


if __name__ == "__main__":
    unittest.main()
