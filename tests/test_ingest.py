import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from tools.ingest import build_database, normalize_frontmatter, parse_frontmatter


class FrontmatterParserTests(unittest.TestCase):
    def test_parses_nested_palette_and_inline_records(self):
        parsed = parse_frontmatter(
            """---
sketch: 2020/example
palette:
  colors: [\"#FFFFFF\", \"#000000\"]
  selection: random-from-list
parameters:
  - {name: detail, default: 0.1, tried: [0.2, 0.4], change: large, effect: \"x: denser\"}
---

## What it draws
"""
        )
        self.assertEqual([], parsed.warnings)
        self.assertEqual(["#FFFFFF", "#000000"], parsed.data["palette"]["colors"])
        self.assertEqual("x: denser", parsed.data["parameters"][0]["effect"])

    def test_recovers_missing_parameters_key(self):
        parsed = parse_frontmatter(
            """---
sketch: 2015/example
composition: centered
  - {name: count, default: 10, tried: [20], change: moderate, effect: \"denser\"}
reusable_candidates: []
---
"""
        )
        self.assertEqual("count", parsed.data["parameters"][0]["name"])
        self.assertIn("recovered parameter list", parsed.warnings[0])

    def test_selects_later_valid_block_after_corrupt_block(self):
        parsed = parse_frontmatter(
            """---
sketch: broken
palette:
  colors: [\"unterminated
---
sketch: valid
renderer: P2D
size: [100, 100]
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
        self.assertEqual("valid", parsed.data["sketch"])
        self.assertIn("selected later valid", parsed.warnings[-1])

    def test_normalizes_known_vocabulary_leaks(self):
        normalized, changes = normalize_frontmatter(
            {
                "techniques": ["grid", "scattered"],
                "primitives": ["arc", "box", "line"],
                "composition": "grid",
                "palette": {"selection": "random-hsb", "colors": ["#123456"]},
            }
        )
        self.assertEqual(["grid"], normalized["techniques"])
        self.assertEqual(["shape", "line"], normalized["primitives"])
        self.assertEqual("tiled", normalized["composition"])
        self.assertIsNone(normalized["palette"]["selection"])
        self.assertGreaterEqual(len(changes), 5)


class DatabaseTests(unittest.TestCase):
    def test_atomic_rerun_replaces_rows_and_preserves_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "survey"
            sketch_dir = root / "out" / "2020" / "example"
            baseline_dir = sketch_dir / "baseline"
            variant_dir = sketch_dir / "variants" / "count_20"
            baseline_dir.mkdir(parents=True)
            variant_dir.mkdir(parents=True)
            (sketch_dir / "notes.md").write_text(
                """---
sketch: 2020/example
year: 2020
renderer: P2D
size: [100, 120]
libraries: []
deterministic: true
ms_first_frame: 15
animated: false
techniques: [grid]
primitives: [rect]
palette:
  colors: [\"#FFFFFF\"]
  selection: fixed
composition: tiled
parameters:
  - {name: count, default: 10, tried: [20], change: large, effect: \"denser\"}
reusable_candidates:
  - {name: tile, signature: \"tile(count) -> void\", note: \"grid tiles\"}
---
"""
            )
            (baseline_dir / "result.json").write_text(
                json.dumps({"status": "ok", "display": "xvfb", "uses_shader": False})
            )
            (variant_dir / "result.json").write_text(
                json.dumps(
                    {
                        "status": "ok",
                        "diff_vs_baseline": {"label": "large", "mean": 0.2, "changed_fraction": 0.5},
                        "subs_applied": [{"old": "10", "new": "20", "count": 1}],
                    }
                )
            )
            database = Path(directory) / "corpus.sqlite"
            first = build_database(root, database)
            second = build_database(root, database)
            self.assertEqual(first, second)
            self.assertEqual(1, first["sketches"])
            connection = sqlite3.connect(database)
            try:
                provenance = connection.execute(
                    "SELECT sketch, notes_path, name, change_score FROM parameter_provenance"
                ).fetchone()
                self.assertEqual(("2020/example", "out/2020/example/notes.md", "count", "large"), provenance)
                self.assertEqual("ok", connection.execute("PRAGMA integrity_check").fetchone()[0])
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
