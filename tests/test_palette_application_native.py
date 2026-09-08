import hashlib
import json
import os
import shutil
from pathlib import Path
import unittest

from tools import extract_palette, render_java


ROOT = Path(__file__).resolve().parents[1]
CONSUMER = ROOT / ".work/cp21-source-consumer-root2/extract/procedurals"
BASELINE = ROOT / ".work/cp21-cut-native2/native/baseline.png"
HOOK = """

void configureRender(long seed, java.util.Map<String, Double> params) {
  if (params.size() != 1 || !params.containsKey("extracted0"))
    throw new IllegalArgumentException("expected extracted0 only");
  double selected = params.get("extracted0");
  if (selected != 0.0 && selected != 1.0)
    throw new IllegalArgumentException("extracted0 must be 0 or 1");
  SEED = seed;
  if (selected == 1.0)
    COLORS = new int[]{EXTRACTED_COLOR_0, EXTRACTED_COLOR_1, EXTRACTED_COLOR_2,
      EXTRACTED_COLOR_3, EXTRACTED_COLOR_4};
}
"""


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class PaletteApplicationNativeTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("RUN_PALETTE_APPLICATION_NATIVE") == "1",
                         "set RUN_PALETTE_APPLICATION_NATIVE=1 for the opt-in native demo")
    def test_extracted_palette_recolors_fixed_seed_field(self):
        source_dir = CONSUMER / "examples/FieldMarks"
        library = CONSUMER / "library/procedurals.jar"
        self.assertTrue(BASELINE.is_file(), "missing accepted native baseline")
        self.assertTrue(library.is_file(), "missing extracted Java0.24 library")
        self.assertTrue(source_dir.is_dir(), "missing extracted FieldMarks example")

        output = Path(os.environ.get("PALETTE_APPLICATION_OUTPUT",
                                    str(ROOT / ".work/palette-application-root1"))).resolve()
        self.assertIn((ROOT / ".work").resolve(), output.parents)
        self.assertFalse(output.exists(), "refusing to overwrite palette application output")
        output.mkdir(parents=True)
        staged = output / "FieldMarks"
        staged.mkdir()
        original_files = {path.name: sha(path) for path in source_dir.iterdir() if path.is_file()}
        for name in ("FieldMarks.pde", "MarkCommands.java", "MarkField.java"):
            shutil.copyfile(source_dir / name, staged / name)
        # The accepted FieldMarks consumer keeps this Processing adapter beside its
        # example sources; the extracted core JAR intentionally contains no adapter.
        adapter = CONSUMER / "adapter-src/main/java/org/procedurals/processing/internal/Java2DFrame.java"
        shutil.copyfile(adapter, staged / "Java2DFrame.java")

        before_image = sha(BASELINE)
        extracted = extract_palette.extract(BASELINE, 5, None)
        self.assertEqual(extracted["source_sha256"], before_image)
        palette_path = output / "palette.json"
        extract_palette.publish(extracted, palette_path)
        self.assertEqual(json.loads(palette_path.read_text())["source_sha256"], before_image)
        colors = extracted["colors"]
        self.assertEqual(len(colors), 5)
        staged_pde = staged / "FieldMarks.pde"
        original_pde = staged_pde.read_text()
        replacement = HOOK.replace("EXTRACTED_COLOR_0", "0x%06X" % colors[0])
        replacement = replacement.replace("EXTRACTED_COLOR_1", "0x%06X" % colors[1])
        replacement = replacement.replace("EXTRACTED_COLOR_2", "0x%06X" % colors[2])
        replacement = replacement.replace("EXTRACTED_COLOR_3", "0x%06X" % colors[3])
        replacement = replacement.replace("EXTRACTED_COLOR_4", "0x%06X" % colors[4])
        staged_pde.write_text(original_pde + replacement)
        self.assertEqual(staged_pde.read_text()[:-len(replacement)], original_pde)
        self.assertEqual({path.name: sha(path) for path in source_dir.iterdir() if path.is_file()}, original_files)

        render_output = output / "render"
        render_java.main([str(staged_pde), "--library", str(library), "--seed", "42",
                          "--sweep", "extracted0=0,1",
                          "--output", str(render_output)])
        report = json.loads((render_output / "report.json").read_text())
        self.assertEqual(report["status"], "passed")
        self.assertEqual(len(report["variants"]), 2)
        self.assertEqual([v["native"]["width"] for v in report["variants"]], [640, 640])
        self.assertEqual([v["native"]["height"] for v in report["variants"]], [640, 640])
        self.assertNotEqual(report["variants"][0]["image_sha256"], report["variants"][1]["image_sha256"])
        self.assertEqual(sha(BASELINE), before_image)
        self.assertEqual({path.name: sha(path) for path in source_dir.iterdir() if path.is_file()}, original_files)


if __name__ == "__main__":
    unittest.main()
