#!/usr/bin/env python3
"""Build local Python artifacts and verify an installed-wheel consumer.

This produces no registry publication and does not run py5 or native rendering.
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
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_ROOT = ROOT / "packages/python"
PACKAGE_SOURCE = PACKAGE_ROOT / "procedurals"
STARTER_SOURCE = PACKAGE_ROOT / "examples/field_marks"
NOISE_FIXTURE = ROOT / "fixtures/operations/gradient-noise-2d-01.json"
GRID_FIXTURE = ROOT / "fixtures/operations/regular-grid.json"
NOTICES = (ROOT / "LICENSE", ROOT / "THIRD_PARTY_NOTICES.md")
VERSION = "0.1.0"
DEFAULT_OUTPUT = ROOT / ".work/dist/python"
DEFAULT_JAVA_HOME = ROOT / ".work/toolchains/jdk-17.0.20.1+1"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bytes_digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def relative(path: Path) -> str:
    return str(path.relative_to(ROOT))


def run(command: list[str | Path], *, cwd: Path, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run([str(item) for item in command], cwd=cwd, env=env,
                              text=True, capture_output=True, check=True)
    except subprocess.CalledProcessError as error:
        raise RuntimeError("command failed: " + " ".join(map(str, command)) + "\n" +
                           error.stdout + error.stderr) from error


def safe_output(path: Path) -> Path:
    output = path.resolve()
    if not output.is_relative_to(DEFAULT_OUTPUT):
        raise ValueError("output must stay under .work/dist/python")
    return output


def copy(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)


def source_files(directory: Path) -> list[Path]:
    return [path for path in sorted(directory.rglob("*"))
            if path.is_file() and "__pycache__" not in path.parts]


def archive_entries(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        return [{"path": item.filename, "sha256": hashlib.sha256(archive.read(item)).hexdigest()}
                for item in sorted(archive.infolist(), key=lambda entry: entry.filename) if not item.is_dir()]


def noise_vector() -> dict[str, object]:
    fixture = json.loads(NOISE_FIXTURE.read_text())
    for case in fixture["cases"]:
        if case.get("id") == "seed-0":
            for query in case["queries"]:
                if query.get("input") == [0.25, 0.75]:
                    return {"seed": 0, "query": [0.25, 0.75], "expected": query["output"]}
    raise RuntimeError("expected noise fixture vector is missing")


def grid_vector() -> dict[str, object]:
    fixture = json.loads(GRID_FIXTURE.read_text())
    case = next(item for item in fixture["cases"] if item["id"] == "row-major-unequal-pitch")
    return {"input": case["input"], "expected_size": case["size"], "index": 4, "expected_point": [1, 4.5]}


def uv_executable() -> str:
    executable = shutil.which("uv")
    if executable is None:
        raise RuntimeError("uv is required to create the isolated build and consumer environments")
    return executable


def isolated_python(uv: str, path: Path, environment: dict[str, str]) -> Path:
    run([uv, "venv", "--seed", "--clear", "--no-project", path], cwd=ROOT, env=environment)
    python = path / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        raise RuntimeError("uv did not create the expected Python executable: " + str(python))
    return python


def java_version(java: Path, environment: dict[str, str]) -> str:
    completed = run([java, "-version"], cwd=ROOT, env=environment)
    return (completed.stdout + completed.stderr).strip()


def resolve_java_home(explicit: Path | None, environment: dict[str, str]) -> Path:
    """Prefer a caller selection, then environment/discovery, before the local convenience JDK."""
    candidates: list[Path] = []
    if explicit is not None:
        candidates.append(explicit)
    if environment.get("JAVA_HOME"):
        candidates.append(Path(environment["JAVA_HOME"]))
    discovered = shutil.which("java")
    if discovered:
        resolved_java = Path(discovered).resolve()
        if resolved_java.parent.name == "bin":
            candidates.append(resolved_java.parent.parent)
    candidates.append(DEFAULT_JAVA_HOME)
    tried: list[str] = []
    for candidate in candidates:
        home = candidate.resolve()
        java = home / "bin/java"
        if not java.is_file():
            tried.append(str(home) + " (no bin/java)")
            continue
        version = java_version(java, environment)
        if re.search(r'(?:openjdk )?version "17(?:[.\"]|$)', version):
            return home
        tried.append(str(home) + " (not Java 17: " + version.splitlines()[0] + ")")
    raise RuntimeError("a JDK 17 is required for the py5 consumer check; tried " + "; ".join(tried))


def class_ast(source: str) -> str:
    module = ast.parse(source)
    classes = [node for node in module.body if isinstance(node, ast.ClassDef) and node.name == "FieldMarks"]
    if len(classes) != 1:
        raise RuntimeError("expected exactly one FieldMarks class in sketch.py")
    return ast.dump(classes[0], annotate_fields=True, include_attributes=False)


def installed_starter_source(original: str) -> tuple[str, list[dict[str, str]]]:
    checkout_block = "# Run this development example directly from a repository checkout.\n" \
                     "sys.path.insert(0,str(Path(__file__).resolve().parents[2]))\n"
    if original.count(checkout_block) != 1:
        raise RuntimeError("expected one exact checkout sys.path block in sketch.py")
    staged = original.replace(checkout_block, "", 1)
    original_output = "OUTPUT=Path(__file__).resolve().parents[4]/'.work/examples/py5-field-marks'"
    installed_output = "OUTPUT=Path(__file__).resolve().parent/'output'"
    if staged.count(original_output) != 1:
        raise RuntimeError("expected one exact checkout output assignment in sketch.py")
    staged = staged.replace(original_output, installed_output, 1)
    if class_ast(original) != class_ast(staged):
        raise RuntimeError("the FieldMarks AST changed while staging the installed starter")
    return staged, [
        {"kind": "remove_checkout_sys_path_block", "removed": checkout_block.rstrip("\n")},
        {"kind": "replace_output_assignment", "from": original_output, "to": installed_output},
    ]


def starter_readme(wheel_name: str) -> str:
    return f"""# FieldMarks Python starter

Install Java 17 and point `JAVA_HOME` at its JDK directory. Then install the adjacent
wheel with the optional py5 runtime and run the editable sketch:

```sh
export JAVA_HOME=/path/to/jdk-17
export PATH="$JAVA_HOME/bin:$PATH"
python -m pip install \"../{wheel_name}[py5]\"
python sketch.py
```

`sketch.py` imports `procedurals` from the installed wheel. It writes `field-marks.png`
to this starter's local `output/` directory. That directory is ignored so it remains a
user-controlled project output location.

The FieldMarks class is copied unchanged from the project example. The staged sketch only
removes its repository `sys.path` injection and redirects its output assignment.
"""


def smoke_source(noise: dict[str, object], grid: dict[str, object]) -> str:
    return f'''import json
import site
from pathlib import Path
import procedurals
from procedurals import cyclic_palette, gradient_noise_2d_01, regular_grid

module_path = Path(procedurals.__file__).resolve()
site_paths = [Path(value).resolve() for value in site.getsitepackages()]
if not any(module_path.is_relative_to(path) for path in site_paths):
    raise AssertionError(f"procedurals was not imported from installed site-packages: {{module_path}}")
grid = regular_grid({json.dumps(grid['input'])})
if grid.size != {grid['expected_size']} or grid.point_at({grid['index']}) != {grid['expected_point']}:
    raise AssertionError("regular_grid fixture value")
noise = gradient_noise_2d_01({{"seed": {noise['seed']}}}).sample(*{noise['query']})
if noise != {noise['expected']!r}:
    raise AssertionError(f"gradient_noise_2d_01 fixture value: {{noise!r}}")
palette = cyclic_palette({{"colors": [0xff0000, 0x0000ff]}})
if palette.sample(0.25) != 0x800080:
    raise AssertionError("cyclic_palette known value")
print(json.dumps({{"imported_path": str(module_path), "site_packages": [str(path) for path in site_paths],
                  "public": sorted(procedurals.__all__), "noise": noise}}))
'''


def run_with_xvfb(command: list[str | Path], *, cwd: Path, environment: dict[str, str]) -> subprocess.CompletedProcess[str]:
    """Use a real X server only when a first actual import needs one."""
    xvfb_run = shutil.which("xvfb-run")
    if xvfb_run is None:
        raise RuntimeError("py5 module load needs a display, but xvfb-run is unavailable")
    authority = cwd.parent / "xvfb-authority"
    error_log = cwd.parent / "xvfb-error.log"
    authority.unlink(missing_ok=True)
    error_log.unlink(missing_ok=True)
    try:
        return run([xvfb_run, "-a", "-f", authority, "-e", error_log, "-s", "-screen 0 1024x768x24", *command],
                   cwd=cwd, env=environment)
    finally:
        authority.unlink(missing_ok=True)


def real_py5_load_check(uv: str, build: Path, wheel: Path, starter_directory: Path,
                        environment: dict[str, str], java_home: Path) -> dict[str, object]:
    """Install the declared extra and load the staged module without running its sketch."""
    java = java_home / "bin/java"
    if not java.is_file():
        raise FileNotFoundError("JDK 17 java executable is missing: " + str(java))
    runtime_environment = dict(environment, JAVA_HOME=str(java_home), PY5_JAVA_HOME=str(java_home))
    python = isolated_python(uv, build / "py5-consumer-venv", runtime_environment)
    run([python, "-m", "pip", "install", str(wheel) + "[py5]"], cwd=build, env=runtime_environment)
    check = starter_directory / "load_starter.py"
    check.write_text("""import importlib.util
import json
import site
from pathlib import Path
import py5
import procedurals
import procedurals._py5_frame as drawing

assert py5.__version__ == '0.10.11a0', py5.__version__
site_paths = [Path(value).resolve() for value in site.getsitepackages()]
for module in (procedurals, drawing):
    module_path = Path(module.__file__).resolve()
    assert any(module_path.is_relative_to(path) for path in site_paths), module_path
path = Path('sketch.py').resolve()
spec = importlib.util.spec_from_file_location('field_marks_starter', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.OUTPUT == path.parent / 'output'
assert Path(module.__file__).resolve() == path
print(json.dumps({'py5_version': getattr(py5, '__version__', None),
                  'py5_path': str(Path(py5.__file__).resolve()),
                  'procedurals_path': str(Path(procedurals.__file__).resolve()),
                  'drawing_path': str(Path(drawing.__file__).resolve()),
                  'starter_path': str(path), 'output': str(module.OUTPUT)}))
""")
    command = [python, check]
    try:
        loaded = run(command, cwd=starter_directory, env=runtime_environment)
        display = "not-needed"
    except RuntimeError as direct_error:
        try:
            loaded = run_with_xvfb(command, cwd=starter_directory, environment=runtime_environment)
            display = "Xvfb retry after direct import failure"
        except RuntimeError as xvfb_error:
            raise RuntimeError("actual py5 starter module load failed directly and under Xvfb\n"
                               "direct:\n" + str(direct_error) + "\nXvfb:\n" + str(xvfb_error)) from xvfb_error
    dependencies = json.loads(run([python, "-m", "pip", "list", "--format=json"], cwd=build,
                                  env=runtime_environment).stdout)
    version = java_version(java, runtime_environment)
    return {"status": "passed", "python": str(python), "display": display,
            "java_home": str(java_home), "java_version": version,
            "dependencies": dependencies, "module_load": json.loads(loaded.stdout)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--java-home", type=Path,
                        help="JDK 17 home used for the real py5 consumer check")
    args = parser.parse_args()
    output = safe_output(args.output)
    required = [PACKAGE_ROOT / "pyproject.toml", *NOTICES, NOISE_FIXTURE, GRID_FIXTURE,
                *source_files(PACKAGE_SOURCE), *source_files(STARTER_SOURCE), Path(__file__).resolve()]
    for path in required:
        if not path.is_file():
            raise FileNotFoundError("required distribution input is missing: " + str(path))
    input_hashes = {relative(path): digest(path) for path in required}
    uv = uv_executable()
    environment = dict(os.environ, PYTHONNOUSERSITE="1", PYTHONPATH="",
                       UV_CACHE_DIR=str(output / "uv-cache"), PIP_CACHE_DIR=str(output / "pip-cache"),
                       PYTHONPYCACHEPREFIX=str(output / "pycache"),
                       XDG_CACHE_HOME=str(output / "xdg-cache"),
                       XDG_CONFIG_HOME=str(output / "xdg-config"),
                       XDG_DATA_HOME=str(output / "xdg-data"))
    java_home = resolve_java_home(args.java_home, environment)

    build = output / "build"
    if build.exists():
        shutil.rmtree(build)
    stage = build / "source"
    shutil.copytree(PACKAGE_SOURCE, stage / "procedurals", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    copy(PACKAGE_ROOT / "pyproject.toml", stage / "pyproject.toml")
    for notice in NOTICES:
        copy(notice, stage / notice.name)

    wheelhouse = output / "wheelhouse"
    wheelhouse.mkdir(parents=True, exist_ok=True)
    run([uv, "build", "--wheel", "--clear", "--out-dir", wheelhouse, stage], cwd=build, env=environment)
    wheels = sorted(wheelhouse.glob("procedurals_python-*.whl"))
    if len(wheels) != 1:
        raise RuntimeError("expected exactly one procedurals-python wheel, found " + repr(wheels))
    wheel = wheels[0]
    entries = archive_entries(wheel)
    names = [entry["path"] for entry in entries]
    if not any(name.startswith("procedurals/") and name.endswith(".py") for name in names):
        raise RuntimeError("wheel does not contain procedurals implementation")
    if any(name.startswith(("examples/", "tests/")) or "/examples/" in name or "/tests/" in name for name in names):
        raise RuntimeError("wheel contains an accidental examples/tests namespace package")
    if not any(name.endswith("licenses/LICENSE") for name in names) or not any(name.endswith("licenses/THIRD_PARTY_NOTICES.md") for name in names):
        raise RuntimeError("wheel is missing required license/notices metadata")

    consumer_root = build / "consumer"
    consumer_root.mkdir(parents=True)
    consumer_python = isolated_python(uv, build / "consumer-venv", environment)
    run([consumer_python, "-m", "pip", "install", "--no-deps", wheel], cwd=consumer_root, env=environment)
    vector_noise, vector_grid = noise_vector(), grid_vector()
    smoke = consumer_root / "smoke.py"
    smoke.write_text(smoke_source(vector_noise, vector_grid))
    smoke_run = run([consumer_python, smoke], cwd=consumer_root, env=environment)
    smoke_result = json.loads(smoke_run.stdout)
    imported = Path(smoke_result["imported_path"])
    if not any(imported.is_relative_to(Path(value)) for value in smoke_result["site_packages"]):
        raise RuntimeError("consumer did not import procedurals from installed site-packages")

    original_sketch = (STARTER_SOURCE / "sketch.py").read_text()
    staged_sketch, transformations = installed_starter_source(original_sketch)
    original_mark_field = STARTER_SOURCE / "mark_field.py"
    starter = output / ("procedurals-field-marks-starter-" + VERSION + ".zip")
    starter_directory = build / "starter/field-marks"
    starter_directory.mkdir(parents=True)
    staged_path = starter_directory / "sketch.py"
    staged_path.write_text(staged_sketch)
    copy(original_mark_field, starter_directory / "mark_field.py")
    output_directory = starter_directory / "output"
    output_directory.mkdir()
    (starter_directory / ".gitignore").write_text("output/*\n!output/.gitignore\n")
    (output_directory / ".gitignore").write_text("*\n!.gitignore\n")
    (starter_directory / "README.md").write_text(starter_readme(wheel.name))
    for notice in NOTICES:
        copy(notice, starter_directory / notice.name)
    if digest(original_mark_field) != digest(starter_directory / "mark_field.py"):
        raise RuntimeError("staged mark_field.py differs from the source example")
    if class_ast(original_sketch) != class_ast(staged_path.read_text()):
        raise RuntimeError("staged FieldMarks AST differs from the source example")
    with zipfile.ZipFile(starter, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(wheel, wheel.name)
        for source in source_files(starter_directory):
            archive.write(source, "field-marks/" + str(source.relative_to(starter_directory)))
    extracted_starter = build / "installed-starter"
    with zipfile.ZipFile(starter) as archive:
        archive.extractall(extracted_starter)
    bundled_wheel = extracted_starter / wheel.name
    bundled_directory = extracted_starter / "field-marks"
    if digest(bundled_wheel) != digest(wheel):
        raise RuntimeError("starter ZIP wheel bytes differ from the generated wheel")
    for source in source_files(starter_directory):
        bundled = bundled_directory / source.relative_to(starter_directory)
        if not bundled.is_file() or digest(bundled) != digest(source):
            raise RuntimeError("starter ZIP entry differs from staged source: " + str(source))
    py5_load = real_py5_load_check(uv, build, bundled_wheel, bundled_directory, environment, java_home)
    if input_hashes != {relative(path): digest(path) for path in required}:
        raise RuntimeError("distribution inputs changed during build")
    result = {
        "status": "passed",
        "scope": "installed-wheel smoke and real py5 staged-starter module load; no sketch run, native render, or registry publication",
        "commands": {"build": [uv, "build", "--wheel", "--clear", "--out-dir", str(wheelhouse), str(stage)],
                     "consumer_install": [str(consumer_python), "-m", "pip", "install", "--no-deps", str(wheel)],
                     "py5_consumer_install": ["<isolated py5 venv>", "-m", "pip", "install", str(wheel) + "[py5]"]},
        "input_sha256": input_hashes,
        "artifacts": {
            "wheel": {"path": relative(wheel), "sha256": digest(wheel), "entries": entries},
            "starter_zip": {"path": relative(starter), "sha256": digest(starter), "entries": archive_entries(starter)},
        },
        "metadata": {"name": "procedurals-python", "version": VERSION, "optional_dependencies": {"py5": ["py5==0.10.11a0"]}},
        "consumer_smoke": {"python": run([consumer_python, "--version"], cwd=consumer_root).stdout.strip(),
                           "known_values": {"grid": vector_grid, "noise": vector_noise, "palette_rgb24": 0x800080},
                           "imported_path": smoke_result["imported_path"], "runtime_stdout": smoke_run.stdout},
        "starter": {
            "source_sketch_sha256": bytes_digest(original_sketch.encode()),
            "staged_sketch_sha256": digest(staged_path),
            "field_marks_ast_unchanged": True,
            "mark_field_source_sha256": digest(original_mark_field),
            "mark_field_staged_sha256": digest(starter_directory / "mark_field.py"),
            "transformations": transformations,
            "output_directory": "field-marks/output/ (local and ignored except its placeholder .gitignore)",
            "bundled_wheel_sha256": digest(bundled_wheel),
            "bundled_starter_verified": True,
            "py5_module_load": py5_load,
        },
    }
    result_path = output / "build-result.json"
    serialized_result = json.dumps(result, indent=2) + "\n"
    result_path.write_text(serialized_result)
    durable_result = ROOT / "evidence/distribution/python.json"
    durable_result.parent.mkdir(parents=True, exist_ok=True)
    durable_result.write_text(serialized_result)
    print(json.dumps({"wheel": relative(wheel), "starter_zip": relative(starter),
                      "result": relative(result_path), "evidence": relative(durable_result)}))


if __name__ == "__main__":
    main()
