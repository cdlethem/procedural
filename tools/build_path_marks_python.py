#!/usr/bin/env python3
"""Build the separate CP2 Python 0.2.0 wheel and PathMarks starter.

This local consumer check installs and imports package code but never runs a py5
sketch or native renderer.  It intentionally cannot overwrite I1 artifacts or
their durable evidence.
"""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "packages/python"
CORE = PACKAGE / "procedurals"
EXAMPLE = PACKAGE / "examples/path_marks"
OUTPUT_ROOT = ROOT / ".work/dist/cp2"
DEFAULT_OUTPUT = OUTPUT_ROOT / "python"
EVIDENCE = ROOT / "evidence/distribution/cp2-python.json"
VERSION = "0.2.0"
DEFAULT_JAVA_HOME = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
FIXTURE = ROOT / "fixtures/operations/gradient-path.json"
GRID_FIXTURE = ROOT / "fixtures/operations/regular-grid.json"
NOISE_FIXTURE = ROOT / "fixtures/operations/gradient-noise-2d-01.json"
CORE_CONFORMANCE = ROOT / "evidence/conformance/gradient-path.json"
NATIVE_REVIEW = ROOT / "evidence/reproductions/cp2-py5/review.json"
NATIVE_REPORT = ROOT / "evidence/reproductions/cp2-py5/result.json"
NOTICES = (ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT)).replace(os.sep, "/")


def required(path: Path) -> Path:
    if not path.is_file():
        raise FileNotFoundError("required CP2 distribution input is missing: " + relative(path))
    return path


def copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def source_files(directory: Path) -> list[Path]:
    return [path for path in sorted(directory.rglob("*"))
            if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc"]


def archive_entries(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        return [{"path": entry.filename, "sha256": hashlib.sha256(archive.read(entry)).hexdigest()}
                for entry in sorted(archive.infolist(), key=lambda value: value.filename)
                if not entry.is_dir()]


def run(command: list[object], *, cwd: Path, environment: dict[str, str], timeout: int = 300) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run([str(value) for value in command], cwd=cwd, env=environment,
                              text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                              check=True, timeout=timeout)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("command timed out: " + " ".join(map(str, command)) + "\n" + (error.stdout or "")) from error
    except subprocess.CalledProcessError as error:
        raise RuntimeError("command failed: " + " ".join(map(str, command)) + "\n" + error.stdout) from error


def uv_executable() -> str:
    result = shutil.which("uv")
    if result is None:
        raise RuntimeError("uv is required for the isolated Python consumer check")
    return result


def isolated_python(uv: str, path: Path, environment: dict[str, str]) -> Path:
    run([uv, "venv", "--seed", "--clear", "--no-project", path], cwd=ROOT, environment=environment)
    python = path / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        raise RuntimeError("uv did not create Python: " + str(python))
    return python


def resolve_java_home(explicit: Path | None, environment: dict[str, str]) -> Path:
    candidates = [value for value in (explicit, Path(environment["JAVA_HOME"]) if environment.get("JAVA_HOME") else None,
                                      DEFAULT_JAVA_HOME) if value is not None]
    for candidate in candidates:
        home = candidate.resolve()
        version = home / "bin/java"
        if not version.is_file():
            continue
        output = run([version, "-version"], cwd=ROOT, environment=environment).stdout
        if re.search(r'(?:openjdk )?version "17(?:[.\"]|$)', output):
            return home
    raise RuntimeError("a JDK 17 is required for the py5 imported-starter check")


def named_vector() -> dict[str, object]:
    document = json.loads(FIXTURE.read_text())
    case = next((item for item in document["cases"] if item.get("id") == "evolving-field"), None)
    if not case or not case.get("input") or not case.get("output") or not case.get("comparison"):
        raise RuntimeError("missing named gradient-path evolving-field fixture")
    return {"fixture": relative(FIXTURE), "catalog_sha256": document["catalog_sha256"],
            "id": case["id"], "input": case["input"], "output": case["output"], "comparison": case["comparison"]}


def existing_vectors() -> tuple[dict[str, object], dict[str, object]]:
    grid_document = json.loads(GRID_FIXTURE.read_text())
    grid = next(item for item in grid_document["cases"] if item["id"] == "row-major-unequal-pitch")
    noise_document = json.loads(NOISE_FIXTURE.read_text())
    noise_case = next(item for item in noise_document["cases"] if item["id"] == "seed-0")
    noise = next(item for item in noise_case["queries"] if item["input"] == [0.25, 0.75])
    return ({"fixture": relative(GRID_FIXTURE), "input": grid["input"], "size": grid["size"], "index": 4,
             "point": grid["points"][4]},
            {"fixture": relative(NOISE_FIXTURE), "seed": 0, "input": noise["input"], "output": noise["output"]})


def accepted_review_binding() -> dict[str, object]:
    review = json.loads(NATIVE_REVIEW.read_text())
    if review.get("status") != "accepted":
        raise RuntimeError("CP2 py5 native review is not accepted")
    for path, expected in review.get("implementation_sha256", {}).items():
        actual = ROOT / path
        required(actual)
        if digest(actual) != expected:
            raise RuntimeError("accepted py5 review source drifted: " + path)
    for path, expected in review.get("evidence_sha256", {}).items():
        actual = ROOT / path
        required(actual)
        if digest(actual) != expected:
            raise RuntimeError("accepted py5 review evidence drifted: " + path)
    return {"review": {"path": relative(NATIVE_REVIEW), "sha256": digest(NATIVE_REVIEW), "status": review["status"]},
            "bound_implementation_sha256": review["implementation_sha256"],
            "bound_evidence_sha256": review["evidence_sha256"]}


def staged_metadata() -> tuple[str, dict[str, object]]:
    original = (PACKAGE / "pyproject.toml").read_text()
    expected = 'version = "0.1.0"'
    if original.count(expected) != 1:
        raise RuntimeError("unexpected Python source package version metadata")
    staged = original.replace(expected, f'version = "{VERSION}"')
    return staged, {"kind": "staged_package_metadata_version", "path": "packages/python/pyproject.toml",
                    "from": "0.1.0", "to": VERSION}


def class_ast(source: str) -> str:
    classes = [node for node in ast.parse(source).body if isinstance(node, ast.ClassDef) and node.name == "PathMarksSketch"]
    if len(classes) != 1:
        raise RuntimeError("expected exactly one PathMarksSketch class")
    return ast.dump(classes[0], annotate_fields=True, include_attributes=False)


def staged_sketch_source(original: str) -> tuple[str, list[dict[str, str]]]:
    block = "# Run directly from this repository checkout; packaged starters may omit this path.\n" \
            "sys.path.insert(0, str(Path(__file__).resolve().parents[2]))\n"
    if original.count(block) != 1:
        raise RuntimeError("expected one exact PathMarks checkout sys.path block")
    staged = original.replace(block, "", 1)
    if class_ast(original) != class_ast(staged):
        raise RuntimeError("PathMarksSketch AST changed while removing checkout path")
    if "OUTPUT = Path(__file__).resolve().parent / \"output\"" not in staged:
        raise RuntimeError("PathMarks starter local output assignment changed unexpectedly")
    return staged, [{"kind": "remove_checkout_sys_path_block", "removed": block.rstrip("\n")}]


def starter_readme(wheel_name: str) -> str:
    return f"""# PathMarks Python starter

Set `JAVA_HOME` to JDK 17, install the adjacent local wheel with the pinned py5 extra,
then run the editable sketch:

```sh
python -m pip install "../{wheel_name}[py5]"
python sketch.py
```

This starter imports `procedurals` from the installed wheel. Edit `path_marks.py` to
change movement or mark construction. `M`, `L`, and `C` reuse retained paths; `N` and
`D` rebuild movement. `S` writes the displayed image under this starter's local
`output/` directory.
"""


def smoke_source(grid: dict[str, object], noise: dict[str, object], path: dict[str, object]) -> str:
    return f'''import json
import math
import site
from pathlib import Path
import procedurals
from procedurals import cyclic_palette, gradient_noise_2d_01, gradient_path_2d, regular_grid

site_paths=[Path(value).resolve() for value in site.getsitepackages()]
module_path=Path(procedurals.__file__).resolve()
assert any(module_path.is_relative_to(value) for value in site_paths), module_path
grid=regular_grid({json.dumps(grid['input'])})
assert grid.size=={grid['size']} and grid.point_at({grid['index']})=={json.dumps(grid['point'])}
noise=gradient_noise_2d_01({{'seed':{noise['seed']}}}).sample(*{json.dumps(noise['input'])})
assert noise=={noise['output']!r}, noise
assert cyclic_palette({{'colors':[0xff0000,0x0000ff]}}).sample(0.25)==0x800080
vector={json.dumps(path)}
trace=gradient_path_2d(vector['input']); values=trace.to_values()
assert trace.steps==vector['input']['steps']
for actual,expected in zip(values['positions'],vector['output']['positions']):
    assert math.isclose(actual[0],expected[0],abs_tol=vector['comparison']['positions_abs'],rel_tol=0.0)
    assert math.isclose(actual[1],expected[1],abs_tol=vector['comparison']['positions_abs'],rel_tol=0.0)
for actual,expected in zip(values['headings'],vector['output']['headings']):
    assert math.isclose(actual,expected,abs_tol=vector['comparison']['headings_abs'],rel_tol=0.0)
assert gradient_path_2d(trace.serialize()).to_values()==values
print(json.dumps({{'imported_path':str(module_path),'site_packages':[str(item) for item in site_paths],
                  'public':sorted(procedurals.__all__),'gradient_path_fixture':vector['id'],'steps':trace.steps}}))
'''


def run_with_xvfb(command: list[object], *, cwd: Path, environment: dict[str, str]) -> subprocess.CompletedProcess[str]:
    xvfb = shutil.which("xvfb-run")
    if xvfb is None:
        raise RuntimeError("py5 starter import needs a display but xvfb-run is unavailable")
    authority = cwd.parent / "xvfb-authority"
    error_log = cwd.parent / "xvfb-error.log"
    authority.unlink(missing_ok=True)
    error_log.unlink(missing_ok=True)
    try:
        return run([xvfb, "-a", "-f", authority, "-e", error_log, "-s", "-screen 0 1024x768x24", *command],
                   cwd=cwd, environment=environment)
    finally:
        authority.unlink(missing_ok=True)


def py5_starter_load(uv: str, build: Path, wheel: Path, starter: Path, environment: dict[str, str], java_home: Path) -> dict[str, object]:
    runtime = dict(environment, JAVA_HOME=str(java_home), PY5_JAVA_HOME=str(java_home))
    python = isolated_python(uv, build / "py5-consumer-venv", runtime)
    run([python, "-m", "pip", "install", str(wheel) + "[py5]"], cwd=build, environment=runtime, timeout=600)
    check = starter / ".load_starter.py"
    check.write_text('''import importlib.util
import json
import site
from pathlib import Path
import py5
import procedurals
import procedurals._py5_frame as drawing

assert py5.__version__ == "0.10.11a0", py5.__version__
paths=[Path(value).resolve() for value in site.getsitepackages()]
for module in (procedurals,drawing):
    assert any(Path(module.__file__).resolve().is_relative_to(value) for value in paths), module.__file__
path=Path("sketch.py").resolve()
spec=importlib.util.spec_from_file_location("path_marks_starter",path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.OUTPUT == path.parent / "output"
assert Path(module.__file__).resolve() == path
print(json.dumps({"py5_version":py5.__version__,"py5_path":str(Path(py5.__file__).resolve()),
                  "procedurals_path":str(Path(procedurals.__file__).resolve()),"drawing_path":str(Path(drawing.__file__).resolve()),
                  "starter_path":str(path),"output":str(module.OUTPUT)}))
''')
    command = [python, check]
    try:
        result = run(command, cwd=starter, environment=runtime)
        display = "not-needed"
    except RuntimeError as direct_error:
        try:
            result = run_with_xvfb(command, cwd=starter, environment=runtime)
            display = "Xvfb retry after direct import failure"
        except RuntimeError as xvfb_error:
            raise RuntimeError("real py5 starter module load failed directly and under Xvfb\n" + str(direct_error) + "\n" + str(xvfb_error)) from xvfb_error
    finally:
        check.unlink(missing_ok=True)
    dependencies = json.loads(run([python, "-m", "pip", "list", "--format=json"], cwd=build, environment=runtime).stdout)
    return {"status": "passed", "python": str(python), "java_home": str(java_home),
            "java_version": run([java_home / "bin/java", "-version"], cwd=build, environment=runtime).stdout.strip(),
            "display": display, "dependencies": dependencies, "module_load": json.loads(result.stdout)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--java-home", type=Path, help="JDK 17 for the real py5 import check")
    args = parser.parse_args()
    output = args.output.resolve()
    if output != OUTPUT_ROOT and OUTPUT_ROOT not in output.parents:
        raise ValueError("output must stay under .work/dist/cp2")
    if output.exists():
        raise RuntimeError("refusing occupied CP2 output destination: " + relative(output))
    if EVIDENCE.exists():
        raise RuntimeError("refusing occupied CP2 evidence destination: " + relative(EVIDENCE))

    staged_pyproject, metadata_transformation = staged_metadata()
    vector = named_vector()
    grid, noise = existing_vectors()
    review = accepted_review_binding()
    inputs = [PACKAGE / "pyproject.toml", *NOTICES, FIXTURE, GRID_FIXTURE, NOISE_FIXTURE, CORE_CONFORMANCE,
              NATIVE_REVIEW, NATIVE_REPORT, *source_files(CORE), *source_files(EXAMPLE), Path(__file__).resolve()]
    for path in inputs:
        required(path)
    input_hashes = {relative(path): digest(path) for path in inputs}

    output.mkdir(parents=True)
    environment = dict(os.environ, PYTHONNOUSERSITE="1", PYTHONPATH="", HOME=str(output / "home"),
                       UV_CACHE_DIR=str(output / "uv-cache"), PIP_CACHE_DIR=str(output / "pip-cache"),
                       PYTHONPYCACHEPREFIX=str(output / "pycache"), XDG_CACHE_HOME=str(output / "xdg-cache"),
                       XDG_CONFIG_HOME=str(output / "xdg-config"), XDG_DATA_HOME=str(output / "xdg-data"))
    for name in ("HOME", "UV_CACHE_DIR", "PIP_CACHE_DIR", "PYTHONPYCACHEPREFIX", "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME"):
        Path(environment[name]).mkdir(parents=True, exist_ok=True)
    uv = uv_executable()
    java_home = resolve_java_home(args.java_home, environment)
    build = output / "build"; build.mkdir()
    stage = build / "source"; stage.mkdir()
    shutil.copytree(CORE, stage / "procedurals", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    (stage / "pyproject.toml").write_text(staged_pyproject)
    for notice in NOTICES:
        copy(notice, stage / notice.name)

    wheelhouse = output / "wheelhouse"; wheelhouse.mkdir()
    run([uv, "build", "--wheel", "--clear", "--out-dir", wheelhouse, stage], cwd=build, environment=environment)
    wheels = sorted(wheelhouse.glob("procedurals_python-*.whl"))
    if len(wheels) != 1:
        raise RuntimeError("expected one staged 0.2 wheel, found " + repr(wheels))
    wheel = wheels[0]
    entries = archive_entries(wheel)
    names = [entry["path"] for entry in entries]
    if not any(name.endswith("procedurals/paths.py") for name in names) or any("examples/" in name or "tests/" in name for name in names):
        raise RuntimeError("wheel did not contain only its full public core")
    if not any(name.endswith("licenses/LICENSE") for name in names) or not any(name.endswith("licenses/THIRD_PARTY_NOTICES.md") for name in names):
        raise RuntimeError("wheel lacks required notices")

    consumer = build / "consumer"; consumer.mkdir()
    consumer_python = isolated_python(uv, build / "consumer-venv", environment)
    run([consumer_python, "-m", "pip", "install", "--no-deps", wheel], cwd=consumer, environment=environment)
    smoke = consumer / "smoke.py"; smoke.write_text(smoke_source(grid, noise, vector))
    smoke_result = json.loads(run([consumer_python, smoke], cwd=consumer, environment=environment).stdout)
    imported = Path(smoke_result["imported_path"])
    if not any(imported.is_relative_to(Path(item)) for item in smoke_result["site_packages"]):
        raise RuntimeError("wheel consumer imported procedurals outside installed site-packages")

    original_sketch = (EXAMPLE / "sketch.py").read_text()
    staged_sketch, transformations = staged_sketch_source(original_sketch)
    model = EXAMPLE / "path_marks.py"
    starter_dir = build / "starter/path-marks"; starter_dir.mkdir(parents=True)
    (starter_dir / "sketch.py").write_text(staged_sketch)
    copy(model, starter_dir / "path_marks.py")
    (starter_dir / "output").mkdir()
    (starter_dir / ".gitignore").write_text("output/*\n!output/.gitignore\n")
    (starter_dir / "output/.gitignore").write_text("*\n!.gitignore\n")
    (starter_dir / "README.md").write_text(starter_readme(wheel.name))
    for notice in NOTICES:
        copy(notice, starter_dir / notice.name)
    if digest(model) != digest(starter_dir / "path_marks.py") or class_ast(original_sketch) != class_ast((starter_dir / "sketch.py").read_text()):
        raise RuntimeError("PathMarks staging changed protected example source")
    starter_zip = output / f"procedurals-path-marks-python-starter-{VERSION}.zip"
    with zipfile.ZipFile(starter_zip, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(wheel, wheel.name)
        for path in source_files(starter_dir):
            archive.write(path, "path-marks/" + str(path.relative_to(starter_dir)))
    extracted = build / "extracted"; extracted.mkdir()
    with zipfile.ZipFile(starter_zip) as archive:
        archive.extractall(extracted)
    bundled_wheel = extracted / wheel.name
    bundled_starter = extracted / "path-marks"
    if digest(bundled_wheel) != digest(wheel):
        raise RuntimeError("starter wheel differs from generated staged wheel")
    for path in source_files(starter_dir):
        copied = bundled_starter / path.relative_to(starter_dir)
        if not copied.is_file() or digest(copied) != digest(path):
            raise RuntimeError("starter archive differs from staged source: " + str(path))
    py5_load = py5_starter_load(uv, build, bundled_wheel, bundled_starter, environment, java_home)
    for path, expected in input_hashes.items():
        if digest(ROOT / path) != expected:
            raise RuntimeError("source changed during build: " + path)

    report = {
        "status": "passed",
        "scope": "CP2 Python 0.2.0 installed-wheel and real py5 PathMarks module-load checks only; no run_sketch, native render, registry publication, or expanded runtime claim.",
        "package_version": VERSION,
        "source_metadata_transformation": metadata_transformation,
        "input_sha256": input_hashes,
        "artifacts": {"wheel": {"path": relative(wheel), "sha256": digest(wheel), "entries": entries},
                      "starter_zip": {"path": relative(starter_zip), "sha256": digest(starter_zip), "entries": archive_entries(starter_zip)}},
        "installed_consumer": {"python": run([consumer_python, "--version"], cwd=consumer, environment=environment).stdout.strip(),
                               "existing_core_values": {"grid": grid, "noise": noise, "palette_rgb24": 0x800080},
                               "public_gradient_path_fixture": vector, "smoke": smoke_result},
        "starter": {"source_sketch_sha256": hashlib.sha256(original_sketch.encode()).hexdigest(),
                    "staged_sketch_sha256": digest(starter_dir / "sketch.py"), "path_marks_source_sha256": digest(model),
                    "path_marks_staged_sha256": digest(starter_dir / "path_marks.py"), "class_ast_unchanged": True,
                    "transformations": transformations, "output_directory": "path-marks/output/ (local and ignored except placeholder .gitignore)",
                    "bundled_wheel_sha256": digest(bundled_wheel), "bundled_starter_verified": True, "py5_module_load": py5_load},
        "accepted_native_binding": review,
        "core_conformance": {"path": relative(CORE_CONFORMANCE), "sha256": digest(CORE_CONFORMANCE)},
        "environment": {"uv": uv, "java_home": str(java_home), "home": relative(Path(environment["HOME"])),
                        "cache_roots": {name: relative(Path(environment[name])) for name in ("UV_CACHE_DIR", "PIP_CACHE_DIR", "PYTHONPYCACHEPREFIX", "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME")}},
    }
    serialized = json.dumps(report, indent=2) + "\n"
    (output / "build-result.json").write_text(serialized)
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(serialized)
    print(json.dumps({"wheel": relative(wheel), "starter_zip": relative(starter_zip), "evidence": relative(EVIDENCE), "scope": report["scope"]}))


if __name__ == "__main__":
    main()
