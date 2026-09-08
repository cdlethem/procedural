#!/usr/bin/env python3
"""Build the local CP4 Python 0.4.0 RegionMarks starter and wheel.

The package and extracted-starter checks are deliberately bounded: no sketch
execution or native rendering is performed here.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

from build_path_marks_python import (ROOT, archive_entries, copy, digest,
                                     isolated_python, run, run_with_xvfb,
                                     source_files, uv_executable)

PACKAGE = ROOT / "packages/python"
CORE = PACKAGE / "procedurals"
EXAMPLE = PACKAGE / "examples/region_marks"
VERSION = "0.4.0"
OUTPUT_ROOT = ROOT / ".work/dist/cp4"
DEFAULT_OUTPUT = OUTPUT_ROOT / "python-region1"
NOTICES = (ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md")


def relative(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT)).replace(os.sep, "/")


def required(path: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError("required RegionMarks input is missing: " + relative(path))
    return path


def class_ast(source: str) -> str:
    classes = [node for node in ast.parse(source).body
               if isinstance(node, ast.ClassDef) and node.name == "RegionMarksSketch"]
    if len(classes) != 1:
        raise RuntimeError("expected exactly one RegionMarksSketch class")
    return ast.dump(classes[0], annotate_fields=True, include_attributes=False)


def stage_sketch(source: str) -> tuple[str, dict[str, object]]:
    block = "sys.path.insert(0, str(Path(__file__).resolve().parents[2]))\n"
    if source.count(block) != 1:
        raise RuntimeError("expected one exact RegionMarks checkout sys.path block")
    transformed = source.replace(block, "", 1)
    if class_ast(source) != class_ast(transformed):
        raise RuntimeError("RegionMarksSketch AST changed while staging")
    return transformed, {"kind": "remove_checkout_sys_path_block", "removed": block.rstrip("\n"),
                         "class_ast_unchanged": True}


def starter_readme(wheel_name: str) -> str:
    return f"""# RegionMarks Python starter

Set `JAVA_HOME` to JDK 17, install the adjacent local wheel with the pinned py5
extra, then run `sketch.py` from this directory:

```sh
python -m pip install \"../{wheel_name}[py5]\"
python sketch.py
```

R changes the seed, N the split budget, G the selection fraction, X switches to
the authored cells, M changes the mark motif, C changes the palette, and S saves
the displayed frame under `output/`.
"""


def smoke_source() -> str:
    return '''import json
import site
import sys
from pathlib import Path
from procedurals import quadrant_partition
sys.path.insert(0, str(Path(__file__).parent))
from region_marks import create_authored_regions, create_seeded_regions

module_path = Path(quadrant_partition.__file__).resolve()
site_paths = [Path(value).resolve() for value in site.getsitepackages()]
assert any(module_path.is_relative_to(value) for value in site_paths), module_path
assert callable(quadrant_partition.seeded_quadrant_partition_2d)

seeded301 = create_seeded_regions(42, 100, 0.5)
seeded601 = create_seeded_regions(42, 200, 0.5)
authored11 = create_authored_regions()
assert seeded301.size == 301 and seeded601.size == 601 and authored11.size == 11

def inspect(composition, expected):
    bounds = [0.0] * 4
    point = [0.0] * 2
    ids = []
    for index in range(composition.size):
        composition.bounds_into(index, bounds)
        assert bounds[2] > bounds[0] and bounds[3] > bounds[1]
        ids.append(composition.id_at(index))
        for mark in range(9):
            composition.mark_into(mark, bounds, point)
            assert bounds[0] <= point[0] <= bounds[2]
            assert bounds[1] <= point[1] <= bounds[3]
    assert all(isinstance(identity, int) for identity in ids)
    assert expected == composition.size

inspect(seeded301, 301)
inspect(seeded601, 601)
inspect(authored11, 11)
try:
    seeded301.bounds_into(301, [0.0] * 4)
except Exception as error:
    assert getattr(error, "code", None) == "INDEX_OUT_OF_RANGE"
else:
    raise AssertionError("out-of-range partition access was accepted")

print(json.dumps({"status":"passed", "imported_path":str(module_path),
                  "site_packages":[str(value) for value in site_paths],
                  "sizes":{"seeded301":seeded301.size,"seeded601":seeded601.size,
                           "authored11":authored11.size}}))
'''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--java-home", type=Path,
                        default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    args = parser.parse_args()
    output = args.output.resolve()
    if output != OUTPUT_ROOT and OUTPUT_ROOT not in output.parents:
        raise ValueError("output must stay under .work/dist/cp4")
    if output.exists():
        raise RuntimeError("refusing occupied output destination: " + relative(output))

    metadata = (PACKAGE / "pyproject.toml").read_text()
    marker = 'version = "0.1.0"'
    if metadata.count(marker) != 1:
        raise RuntimeError("unexpected Python source package version metadata")
    staged_metadata = metadata.replace(marker, f'version = "{VERSION}"', 1)
    inputs = [PACKAGE / "pyproject.toml", *NOTICES, *source_files(CORE),
              *source_files(EXAMPLE), Path(__file__).resolve(),
              ROOT / "tools/build_path_marks_python.py"]
    for path in inputs:
        required(path)
    before = {relative(path): digest(path) for path in inputs}

    output.mkdir(parents=True)
    environment = dict(os.environ, PYTHONNOUSERSITE="1", PYTHONPATH="",
                       UV_CACHE_DIR=str(output / "uv-cache"),
                       PIP_CACHE_DIR=str(output / "pip-cache"),
                       PYTHONPYCACHEPREFIX=str(output / "pycache"),
                       XDG_CACHE_HOME=str(output / "xdg-cache"))
    for key in ("UV_CACHE_DIR", "PIP_CACHE_DIR", "PYTHONPYCACHEPREFIX", "XDG_CACHE_HOME"):
        Path(environment[key]).mkdir(parents=True, exist_ok=True)
    uv = uv_executable()
    build = output / "build"
    stage = build / "source"
    stage.mkdir(parents=True)
    shutil.copytree(CORE, stage / "procedurals",
                    ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (stage / "pyproject.toml").write_text(staged_metadata)
    for notice in NOTICES:
        copy(notice, stage / notice.name)
    wheelhouse = build / "wheelhouse"
    wheelhouse.mkdir()
    run([uv, "build", "--wheel", "--clear", "--out-dir", wheelhouse, stage],
        cwd=build, environment=environment)
    wheels = sorted(wheelhouse.glob("procedurals_python-*.whl"))
    if len(wheels) != 1:
        raise RuntimeError("expected one staged 0.4 wheel, found " + repr(wheels))
    wheel = wheels[0]
    entries = archive_entries(wheel)
    names = [entry["path"] for entry in entries]
    if not any(name.endswith("procedurals/quadrant_partition.py") for name in names):
        raise RuntimeError("wheel omitted public quadrant_partition module")
    if not all(any(name.endswith("licenses/" + notice.name) for name in names) for notice in NOTICES):
        raise RuntimeError("wheel lacks required notices")

    starter_dir = build / "starter/region-marks"
    starter_dir.mkdir(parents=True)
    original = (EXAMPLE / "sketch.py").read_text()
    staged, transform = stage_sketch(original)
    (starter_dir / "sketch.py").write_text(staged)
    copy(EXAMPLE / "region_marks.py", starter_dir / "region_marks.py")
    (starter_dir / "output/.gitignore").parent.mkdir(parents=True)
    (starter_dir / "output/.gitignore").write_text("*\n!.gitignore\n")
    (starter_dir / "README.md").write_text(starter_readme(wheel.name))
    for notice in NOTICES:
        copy(notice, starter_dir / notice.name)

    starter_zip = output / f"procedurals-region-marks-python-starter-{VERSION}.zip"
    with zipfile.ZipFile(starter_zip, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(wheel, wheel.name)
        for path in source_files(starter_dir):
            archive.write(path, "region-marks/" + str(path.relative_to(starter_dir)))
    extracted = build / "extracted"
    extracted.mkdir()
    with zipfile.ZipFile(starter_zip) as archive:
        archive.extractall(extracted)
    bundled_wheel = extracted / wheel.name
    bundled_starter = extracted / "region-marks"
    if digest(bundled_wheel) != digest(wheel):
        raise RuntimeError("bundled wheel differs from generated wheel")
    for path in source_files(starter_dir):
        copied = bundled_starter / path.relative_to(starter_dir)
        if digest(copied) != digest(path):
            raise RuntimeError("starter archive differs from staged source: " + str(path))

    consumer = build / "consumer"
    consumer.mkdir()
    consumer_python = isolated_python(uv, build / "consumer-venv", environment)
    run([consumer_python, "-m", "pip", "install", str(bundled_wheel) + "[py5]"],
        cwd=consumer, environment=environment, timeout=600)
    smoke = bundled_starter / "smoke.py"
    smoke.write_text(smoke_source())
    smoke_result = json.loads(run([consumer_python, smoke], cwd=bundled_starter,
                                  environment=environment).stdout)
    smoke.unlink()
    imported = Path(smoke_result["imported_path"])
    if not any(imported.is_relative_to(Path(value)) for value in smoke_result["site_packages"]):
        raise RuntimeError("consumer imported procedurals outside installed site-packages")

    # Verify the extracted starter itself against the installed wheel, including a real py5 import.
    py5_env = dict(environment, JAVA_HOME=str(args.java_home.resolve()),
                   PY5_JAVA_HOME=str(args.java_home.resolve()),
                   PYTHONPATH=str(imported.parent.parent))
    load = """import json, runpy, py5
from procedurals import quadrant_partition
from pathlib import Path
module = runpy.run_path('sketch.py', run_name='region_marks_package_import')
assert 'RegionMarksSketch' in module
assert py5.__version__ == '0.10.11a0'
assert str(Path(quadrant_partition.__file__).resolve()) == %r
print(json.dumps({'status':'passed','py5':py5.__version__,'quadrant':str(Path(quadrant_partition.__file__).resolve())}))
""" % str(imported)
    load_result = json.loads(run_with_xvfb([consumer_python, "-c", load], cwd=bundled_starter,
                                           environment=py5_env).stdout)

    for path, expected in before.items():
        if digest(ROOT / path) != expected:
            raise RuntimeError("source changed during build: " + path)
    report = {"status": "passed",
              "scope": "CP4 Python 0.4.0 installed wheel and extracted RegionMarks starter checks; no sketch execution, native render, publication, or support attestation.",
              "package_version": VERSION, "input_sha256": before,
              "artifacts": {"wheel": {"path": relative(wheel), "sha256": digest(wheel), "entries": entries},
                            "starter_zip": {"path": relative(starter_zip), "sha256": digest(starter_zip),
                                            "entries": archive_entries(starter_zip)}},
              "consumer": smoke_result, "starter": {"transform": transform,
                  "bundled_verified": True, "py5_load": load_result}}
    (output / "build-result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "wheel": relative(wheel),
                      "starter_zip": relative(starter_zip), "sizes": smoke_result["sizes"]}))


if __name__ == "__main__":
    main()
