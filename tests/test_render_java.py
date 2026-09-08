import tempfile
import unittest
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


if __name__ == "__main__":
    unittest.main()
