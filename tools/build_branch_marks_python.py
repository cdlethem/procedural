#!/usr/bin/env python3
"""Build the local CP6 Python 0.6.0 wheel and BranchMarks starter; never run a sketch."""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import zipfile

from build_region_marks_python import (archive_entries, copy, digest, isolated_python,
                                       run, run_with_xvfb, source_files, uv_executable)

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "packages/python"
CORE = PACKAGE / "procedurals"
EXAMPLE = PACKAGE / "examples/branch_marks"
VERSION = "0.6.0"
OUTPUT_ROOT = ROOT / ".work/dist/cp6"
NOTICES = (ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md")
REVIEWS = (
    ROOT / "evidence/conformance/branch-tree-python-root-review.json",
    ROOT / "evidence/conformance/branch-marks-python-root-review.json",
    ROOT / "evidence/conformance/branch-py5-native-root-review.json",
    ROOT / "evidence/conformance/py5-branch-marks.json",
    ROOT / "evidence/conformance/branch-export-compatibility-review.json",
)
OPS = ("regular_grid", "gradient_noise_2d_01", "cyclic_palette", "gradient_path_2d",
       "ordered_circle_filter_2d", "seeded_circle_placement_2d",
       "seeded_quadrant_partition_2d", "seeded_triangle_points_2d",
       "map_triangle_coordinates_2d", "seeded_endpoint_branches_2d")


def rel(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT)).replace(os.sep, "/")


def required(path: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError("required CP6 Python input is missing: " + rel(path))
    return path


def accepted_records() -> dict[str, object]:
    """Bind this build to the root-accepted CP6 evidence without accepting it anew."""
    result = {}
    expected_statuses = {
        "branch-tree-python-root-review.json": "accepted",
        "branch-marks-python-root-review.json": "accepted",
        "branch-py5-native-root-review.json": "accepted",
        "py5-branch-marks.json": "passed",
        "branch-export-compatibility-review.json": "accepted",
    }
    for path in REVIEWS:
        record = json.loads(required(path).read_text())
        if record.get("status") != expected_statuses[path.name]:
            raise RuntimeError("unexpected CP6 evidence status: " + rel(path))
        if record.get("status") == "accepted" and (record.get("owner"), record.get("reviewer")) != ("root", "root"):
            raise RuntimeError("CP6 review lacks root ownership: " + rel(path))
        for group in ("implementation_sha256", "evidence_sha256"):
            for name, expected in record.get(group, {}).items():
                target = required(ROOT / name)
                if digest(target) != expected:
                    raise RuntimeError("accepted CP6 binding drifted: " + name)
        result[rel(path)] = digest(path)
    return result


def stage_sketch(source: str) -> tuple[str, dict[str, object]]:
    block = "sys.path.insert(0, str(Path(__file__).resolve().parents[2]))\n"
    if source.count(block) != 1:
        raise RuntimeError("expected exact checkout sys.path block")
    staged = source.replace(block, "", 1)
    classes = lambda value: [node for node in ast.parse(value).body
                             if isinstance(node, ast.ClassDef) and node.name == "BranchMarksSketch"]
    if len(classes(source)) != 1 or ast.dump(classes(source)[0]) != ast.dump(classes(staged)[0]):
        raise RuntimeError("BranchMarksSketch changed while staging")
    return staged, {"kind": "remove_checkout_sys_path_block", "removed": block.rstrip(),
                    "class_ast_unchanged": True}


def geometry_program() -> str:
    return '''import hashlib,json,struct
from branch_composition import create_branch_composition
CASES=(("baseline",42,False,False,False,False,False),("more",42,True,False,False,False,False),("narrowing",42,False,True,False,False,False),("wider",42,False,False,False,True,False),("binary",42,False,False,True,False,False),("forest",42,False,False,False,False,True),("forestextended",42,True,False,False,False,True),("forestseed",43,False,False,False,False,True))
def g(case):
 name,*args=case;c=create_branch_composition(*args);h=hashlib.sha256();segment=[0.0]*4
 h.update(struct.pack('>Q',c.size));h.update(struct.pack('>Q',c.total_segments))
 for root in range(c.size):
  tree=c.tree_at(root);h.update(struct.pack('>Q',tree.size))
  for index in range(tree.size):
   tree.segment_into(index,segment);h.update(struct.pack('>dddd',*segment));h.update(struct.pack('>dd',tree.heading_at(index),tree.length_at(index)));h.update(struct.pack('>qQQ',tree.parent_at(index),tree.generation_at(index),tree.child_count_at(index)))
 return {'id':name,'trees':c.size,'segments':c.total_segments,'raw_binary64_sha256':h.hexdigest()}
print(json.dumps({'cases':[g(case) for case in CASES]}))
'''


def starter_readme(wheel: str) -> str:
    return f'''# BranchMarks Python starter

Tested with Python 3.13, JDK 17, and the pinned py5 dependency. Set `JAVA_HOME` to JDK 17, then:

```sh
python -m pip install "../{wheel}[py5]"
python sketch.py
```

Edit `branch_composition.py` to change root poses and the fixed rule schedule. R changes seed;
N adds a generation; G narrows; W widens; B uses two slots; X places a forest; M changes taper
and terminal dots; C changes palette; 0 resets; S saves under `output/`. M/C retain the same
geometry; growth controls rebuild it. The rule schedule, roots, colours, and marks are editable
example choices, never library defaults. Forest placement reserves root space; it does not
separate canopies. Motivation: `survey/out/2018/Generativos/arbolito3/notes.md` and
`survey/out/2018/Generativos/arbolito4/notes.md`.
'''


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT_ROOT / "python-branch1")
    parser.add_argument("--java-home", type=Path, default=ROOT / ".work/toolchains/jdk-17.0.20.1+1")
    args = parser.parse_args()
    output = args.output.resolve()
    if output != OUTPUT_ROOT and OUTPUT_ROOT not in output.parents:
        raise ValueError("output must stay under .work/dist/cp6")
    if output.exists():
        raise RuntimeError("refusing occupied output destination: " + rel(output))

    metadata = (PACKAGE / "pyproject.toml").read_text()
    marker = 'version = "0.1.0"'
    if metadata.count(marker) != 1:
        raise RuntimeError("unexpected Python package version metadata")
    evidence = accepted_records()
    inputs = [PACKAGE / "pyproject.toml", *NOTICES, *REVIEWS, *source_files(CORE),
              *source_files(EXAMPLE), Path(__file__).resolve(),
              ROOT / "tools/build_grain_marks_python.py", ROOT / "tools/build_region_marks_python.py",
              ROOT / "tools/build_path_marks_python.py", ROOT / "tools/with_native_render_lock.py"]
    for path in inputs:
        required(path)
    before = {rel(path): digest(path) for path in inputs}

    output.mkdir(parents=True)
    env = dict(os.environ, PYTHONNOUSERSITE="1", PYTHONPATH="", UV_CACHE_DIR=str(output / "uv-cache"),
               PIP_CACHE_DIR=str(output / "pip-cache"), PYTHONPYCACHEPREFIX=str(output / "pycache"),
               XDG_CACHE_HOME=str(output / "xdg-cache"))
    for key in ("UV_CACHE_DIR", "PIP_CACHE_DIR", "PYTHONPYCACHEPREFIX", "XDG_CACHE_HOME"):
        Path(env[key]).mkdir(parents=True, exist_ok=True)
    build = output / "build"; stage = build / "source"; stage.mkdir(parents=True)
    shutil.copytree(CORE, stage / "procedurals", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (stage / "pyproject.toml").write_text(metadata.replace(marker, f'version = "{VERSION}"', 1))
    for notice in NOTICES:
        copy(notice, stage / notice.name)
    wheelhouse = build / "wheelhouse"; wheelhouse.mkdir()
    run([uv_executable(), "build", "--wheel", "--clear", "--out-dir", wheelhouse, stage], cwd=build, environment=env)
    wheels = sorted(wheelhouse.glob("procedurals_python-*.whl"))
    if len(wheels) != 1:
        raise RuntimeError("expected one staged wheel")
    wheel = wheels[0]; entries = archive_entries(wheel); names = [entry["path"] for entry in entries]
    with zipfile.ZipFile(wheel) as zipped:
        for path in source_files(CORE):
            member = "procedurals/" + str(path.relative_to(CORE)).replace(os.sep, "/")
            if member not in names:
                raise RuntimeError("wheel omitted portable source: " + member)
            if zipped.read(member) != path.read_bytes():
                raise RuntimeError("wheel portable source differs: " + member)
    if not all(any(name.endswith("licenses/" + notice.name) for name in names) for notice in NOTICES):
        raise RuntimeError("wheel lacks notices")

    starter = build / "starter/branch-marks"; starter.mkdir(parents=True)
    staged, transform = stage_sketch((EXAMPLE / "sketch.py").read_text())
    (starter / "sketch.py").write_text(staged)
    copy(EXAMPLE / "branch_composition.py", starter / "branch_composition.py")
    (starter / "output/.gitignore").parent.mkdir(parents=True)
    (starter / "output/.gitignore").write_text("*\n!.gitignore\n")
    (starter / "README.md").write_text(starter_readme(wheel.name))
    for notice in NOTICES:
        copy(notice, starter / notice.name)
    archive = output / f"procedurals-branch-marks-python-starter-{VERSION}.zip"
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED) as zipped:
        zipped.write(wheel, wheel.name)
        for path in source_files(starter):
            zipped.write(path, "branch-marks/" + str(path.relative_to(starter)))
    extracted = build / "extracted"; extracted.mkdir()
    with zipfile.ZipFile(archive) as zipped:
        zipped.extractall(extracted)
    bundled_wheel, bundled = extracted / wheel.name, extracted / "branch-marks"
    if digest(bundled_wheel) != digest(wheel):
        raise RuntimeError("bundled wheel differs")
    for path in source_files(starter):
        if digest(bundled / path.relative_to(starter)) != digest(path):
            raise RuntimeError("starter archive differs")

    expected_env = dict(env, PYTHONPATH=str(PACKAGE) + os.pathsep + str(EXAMPLE))
    expected = json.loads(run([sys.executable, "-c", geometry_program()], cwd=ROOT, environment=expected_env).stdout)
    consumer = build / "consumer"; consumer.mkdir()
    python = isolated_python(uv_executable(), build / "consumer-venv", env)
    run([python, "-m", "pip", "install", str(bundled_wheel) + "[py5]"], cwd=consumer, environment=env, timeout=600)
    body = geometry_program().replace("print(json.dumps({'cases':[g(case) for case in CASES]}))\n", "")
    smoke = "import json,site,sys\nfrom pathlib import Path\nfrom procedurals import *\nfrom procedurals import branch_tree\nsys.path.insert(0,str(Path(__file__).parent))\nrequired=" + repr(OPS) + "\nassert len(required)==10 and all(callable(globals()[item]) for item in required)\nassert BranchTreeError is branch_tree.BranchTreeError\nassert seeded_endpoint_branches_2d is branch_tree.seeded_endpoint_branches_2d\nmodule=Path(branch_tree.__file__).resolve();sites=[Path(value).resolve() for value in site.getsitepackages()]\nassert any(module.is_relative_to(path) for path in sites),module\n" + body + "\nactual={'cases':[g(case) for case in CASES]}\nexpected=json.loads(" + repr(json.dumps(expected)) + ")\nassert actual==expected,(actual,expected)\nprint(json.dumps({'status':'passed','imported_path':str(module),'site_packages':[str(path) for path in sites],'cases':actual['cases'],'operation_count':len(required)}))\n"
    smoke_path = bundled / "smoke.py"; smoke_path.write_text(smoke)
    consumer_result = json.loads(run([python, smoke_path], cwd=bundled, environment=env).stdout)
    smoke_path.unlink()
    imported = Path(consumer_result["imported_path"])
    if not any(imported.is_relative_to(Path(path)) for path in consumer_result["site_packages"]):
        raise RuntimeError("consumer did not import installed wheel")
    py5_env = dict(env, JAVA_HOME=str(args.java_home.resolve()), PY5_JAVA_HOME=str(args.java_home.resolve()), PYTHONPATH=str(imported.parent.parent))
    load = "import json,runpy,py5\nfrom pathlib import Path\nfrom procedurals import branch_tree\nvalue=runpy.run_path('sketch.py',run_name='branch_marks_package_import')\nassert 'BranchMarksSketch' in value and py5.__version__=='0.10.11a0'\nassert str(Path(branch_tree.__file__).resolve())==" + repr(str(imported)) + "\nprint(json.dumps({'status':'passed','py5':py5.__version__,'branch_tree':str(Path(branch_tree.__file__).resolve())}))\n"
    # This is an import-only display process, never a sketch run. Use the common lease.
    py5_result = json.loads(run_with_xvfb([sys.executable, ROOT / "tools/with_native_render_lock.py", "--", python, "-c", load], cwd=bundled, environment=py5_env).stdout)
    if accepted_records() != evidence:
        raise RuntimeError("accepted CP6 evidence changed during build")
    for path, value in before.items():
        if digest(ROOT / path) != value:
            raise RuntimeError("source changed during build: " + path)
    report = {"status": "passed", "scope": "CP6 Python 0.6.0 installed wheel and extracted BranchMarks starter checks; no sketch execution, native render, publication, or support attestation.", "package_version": VERSION, "input_sha256": before, "accepted_evidence_sha256": evidence, "artifacts": {"wheel": {"path": rel(wheel), "sha256": digest(wheel), "entries": entries}, "starter_zip": {"path": rel(archive), "sha256": digest(archive), "entries": archive_entries(archive)},}, "consumer": consumer_result, "starter": {"transform": transform, "bundled_verified": True, "py5_load": py5_result}}
    (output / "build-result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"status": "passed", "wheel": rel(wheel), "starter_zip": rel(archive), "cases": len(consumer_result["cases"])}))


if __name__ == "__main__":
    main()
