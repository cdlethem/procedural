#!/usr/bin/env python3
"""Compile and render one Processing Java source layer in a bwrap sandbox."""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
RUNTIME = ROOT / ".work/toolchains/processing-4.5.6"
JDK = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
CORE_SHA256 = "88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4"
ARCHIVE_SHA256 = "ddb816ca2c02e862a5dcf22b96bb4f81f412c4878673752b36837a7770970a6c"
PREPROCESSOR_NAMES = (
    "preprocessor-4.5.6.jar", "utils-4.5.6.jar", "antlr4-runtime-4.13.2.jar",
    "antlr4-4.13.2.jar", "org.eclipse.jdt.core-3.16.0.jar",
)
HOST_FILES = (ROOT / "tools/harness/java/LayerControls.java", ROOT / "tools/harness/java/LayerHost.java")
BRIDGE = ROOT / "tests/native/PreprocessSketch.java"


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".pending")
    temporary.write_text(json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(path)


def bounded_lines(text: str, count: int = 20) -> list[str]:
    lines = []
    for line in text.splitlines():
        line = line.strip()
        if line:
            lines.append(line[:400])
        if len(lines) == count:
            break
    return lines
def source_line_hint(path: Path) -> str:
    stack: list[tuple[str, int]] = []
    pairs = {")": "(", "]": "[", "}": "{"}
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        for character in line:
            if character in "([{":
                stack.append((character, number))
            elif not stack or stack[-1][0] != pairs.get(character):
                if character in pairs:
                    return f"Layer.pde:{stack[-1][1] if stack else number}: preprocessing failed"
            else:
                stack.pop()
    if stack:
        return f"Layer.pde:{stack[-1][1]}: preprocessing failed"
    return "Layer.pde: preprocessing failed"


def fail(code: str, stage: str, message: str, diagnostics: list[str] | None = None) -> dict:
    result = {"status": "failed", "stage": stage, "code": code, "message": message, "deniedRequests": []}
    if diagnostics:
        result["diagnostics"] = diagnostics[:20]
    return result


def check_runtime() -> tuple[Path, list[Path]]:
    archive = RUNTIME / "processing-4.5.6-linux-x64-portable.zip"
    core = RUNTIME / "core-4.5.6.jar"
    if not archive.is_file() or sha(archive) != ARCHIVE_SHA256:
        raise RuntimeError("pinned Processing portable archive is missing or has a checksum mismatch")
    if not core.is_file() or sha(core) != CORE_SHA256:
        raise RuntimeError("pinned Processing core JAR is missing or has a checksum mismatch")
    pre = [RUNTIME / "preprocessor" / name for name in PREPROCESSOR_NAMES]
    with zipfile.ZipFile(archive) as official:
        for path in pre:
            member = "Processing/lib/app/resources/modes/java/mode/" + path.name
            if not path.is_file() or path.read_bytes() != official.read(member):
                raise RuntimeError("pinned preprocessor JAR mismatch: " + path.name)
    if not (JDK / "bin/java").is_file() or not (JDK / "bin/javac").is_file():
        raise RuntimeError("pinned JDK 17 toolchain is missing java or javac")
    if not (JDK / "release").is_file():
        raise RuntimeError("pinned JDK release file is missing")
    return core, [archive, core, *pre]


def validate_sources(spec: dict, source_root: Path, staged: Path) -> list[Path]:
    entry = spec.get("entrypoint")
    if not isinstance(entry, str) or entry != "Layer.pde":
        raise ValueError("entrypoint must be Layer.pde")
    files = spec.get("sourceFiles")
    if not isinstance(files, list) or not files:
        raise ValueError("sourceFiles must be non-empty")
    copied: list[Path] = []
    seen: set[str] = set()
    for record in files:
        relative = record.get("path") if isinstance(record, dict) else None
        expected = record.get("sha256") if isinstance(record, dict) else None
        expected_bytes = record.get("bytes") if isinstance(record, dict) else None
        if (not isinstance(relative, str) or not isinstance(expected, str)
                or not isinstance(expected_bytes, int) or Path(relative).is_absolute()):
            raise ValueError("invalid source file record")
        clean = Path(relative)
        if ".." in clean.parts or clean.as_posix() in seen or clean.suffix not in (".pde", ".java"):
            raise ValueError("source file path is not an adjacent PDE/Java tab: " + relative)
        seen.add(clean.as_posix())
        original = source_root / clean
        if not original.is_file() or original.stat().st_size != expected_bytes or sha(original) != expected:
            raise ValueError("source hash or byte-count mismatch: " + relative)
        destination = staged / clean
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original, destination)
        copied.append(destination)
    if not (staged / entry).is_file():
        raise ValueError("Layer.pde is not present in sourceFiles")
    return copied


def validate_controls(spec: dict, staged: Path) -> None:
    declarations = spec.get("controlDeclarations", [])
    controls = spec.get("controls", {})
    if not isinstance(declarations, list) or not isinstance(controls, dict):
        raise ValueError("controls and controlDeclarations must be objects")
    declared: dict[str, str] = {}
    for declaration in declarations:
        if not isinstance(declaration, dict) or not isinstance(declaration.get("key"), str):
            raise ValueError("invalid control declaration")
        key, kind = declaration["key"], declaration.get("type")
        if kind not in ("number", "flag", "option") or key in declared:
            raise ValueError("invalid or duplicate control declaration: " + key)
        declared[key] = kind
    if set(controls) != set(declared):
        raise ValueError("controls do not exactly match declarations")
    lines: list[str] = []
    for key, kind in declared.items():
        value = controls[key]
        if kind == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError("number control has non-number value: " + key)
            value_text = format(float(value), ".9g")
        elif kind == "flag":
            if not isinstance(value, bool):
                raise ValueError("flag control has non-boolean value: " + key)
            value_text = "true" if value else "false"
        else:
            if not isinstance(value, str) or "\t" in value or "\n" in value or "\r" in value:
                raise ValueError("option control has invalid string: " + key)
            value_text = value
        lines.append(key + "\t" + kind + "\t" + value_text)
    (staged / "controls.txt").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def runtime_hash(core: Path, generated: Path, sources: list[Path]) -> str:
    digest = hashlib.sha256()
    inputs = [("core-4.5.6.jar", core), ("jdk/release", JDK / "release")]
    inputs.extend((path.name, path) for path in HOST_FILES)
    inputs.append(("preprocessed/GeneratedLayer.java", generated))
    for path in sorted(sources, key=lambda item: item.as_posix()):
        inputs.append(("source/" + path.name, path))
    for label, path in inputs:
        digest.update(label.encode("utf-8") + b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()


def compile_command(command: list[str], cwd: Path, timeout: float) -> tuple[int, str, str, bool]:
    try:
        process = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, start_new_session=True)
        stdout, stderr = process.communicate(timeout=max(1.0, timeout))
        return process.returncode, stdout, stderr, False
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.communicate()
        return -signal.SIGKILL, "", "compiler timed out", True


def sandbox_run(command: list[str], cwd: Path, output_dir: Path, limits: dict, jdk: Path,
                core: Path, classes: Path, controls: Path) -> tuple[int, str, str, bool]:
    bwrap = shutil.which("bwrap")
    if not bwrap:
        return 127, "", "bwrap is not installed", False
    heap = int(limits.get("heapMegabytes", 512))
    java_cmd = [bwrap, "--unshare-all", "--die-with-parent", "--new-session",
                "--ro-bind", str(jdk), "/opt/jdk", "--ro-bind", str(core), "/opt/core.jar",
                "--ro-bind", str(classes), "/opt/classes", "--ro-bind", str(controls), "/opt/controls",
                "--dir", "/out", "--bind", str(output_dir), "/out", "--tmpfs", "/tmp", "--dir", "/tmp/home",
                "--proc", "/proc", "--dev", "/dev", "--ro-bind", "/usr", "/usr",
                "--ro-bind", "/lib", "/lib", "--ro-bind", "/lib64", "/lib64",
                "--ro-bind", "/bin", "/bin", "--ro-bind", "/etc", "/etc",
                "--setenv", "PATH", "/opt/jdk/bin:/usr/bin:/bin", "--setenv", "JAVA_HOME", "/opt/jdk",
                "--setenv", "HOME", "/tmp/home", "--chdir", "/tmp", "--",
                "/opt/jdk/bin/java", f"-Xmx{heap}m", "-Djava.awt.headless=true",
                "-cp", "/opt/classes:/opt/core.jar", *command]
    environment = {"PATH": str(jdk / "bin"), "JAVA_HOME": str(jdk), "HOME": str(output_dir)}
    try:
        process = subprocess.Popen(java_cmd, cwd=cwd, env=environment, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, start_new_session=True)
        try:
            stdout, stderr = process.communicate(timeout=max(1.0, float(limits.get("renderSeconds", 30))))
            return process.returncode, stdout, stderr, False
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.communicate()
            return -signal.SIGKILL, "", "render wall-time limit exceeded", True
    except OSError as error:
        return 127, "", str(error), False


def run_job(spec: dict) -> dict:
    result_path = Path(spec["resultPath"])
    progress_path = Path(spec["progressPath"])
    started = now()
    atomic_json(progress_path, {"state": "running", "note": "validating pinned Java runtime"})
    try:
        core, dependencies = check_runtime()
        source_root = Path(spec["sourceDirectory"]).resolve()
        work = Path(spec["workDirectory"]).resolve()
        output = Path(spec["outputPath"]).resolve()
        if output.parent != work or not source_root.is_dir():
            raise ValueError("sourceDirectory/workDirectory/outputPath are not service-owned locations")
        # The service creates the work directory when it writes the job spec.
        work.mkdir(parents=True, exist_ok=True)
        if any(work.iterdir()):
            raise ValueError("workDirectory must be empty before a render")
        sandbox_output = work / "sandbox-output"
        sandbox_output.mkdir()
        staged = work / "source"
        staged.mkdir()
        sources = validate_sources(spec, source_root, staged)
        validate_controls(spec, staged)
        generated = work / "GeneratedLayer.java"
        build = work / "classes"
        build.mkdir()
        pre_cp = os.pathsep.join(str(path) for path in [core, *(RUNTIME / "preprocessor" / n for n in PREPROCESSOR_NAMES)])
        bridge_classes = work / "bridge"
        bridge_classes.mkdir()
        code, _, stderr, timed_out = compile_command(
            [str(JDK / "bin/javac"), "--release", "17", "-proc:none", "-cp", pre_cp,
             "-d", str(bridge_classes), str(BRIDGE)], work, float(spec.get("limits", {}).get("compileSeconds", 60)))
        if timed_out:
            return {**fail("RESOURCE_EXHAUSTED", "compile", "compile wall-time limit exceeded", bounded_lines(stderr)), "startedAt": started, "finishedAt": now()}
        if code != 0:
            return {**fail("COMPILE_FAILURE", "compile", "preprocessor bridge compilation failed", bounded_lines(stderr)), "startedAt": started, "finishedAt": now()}
        code, _, stderr, timed_out = compile_command(
            [str(JDK / "bin/java"), "-cp", bridge_classes.__str__() + os.pathsep + pre_cp,
             "PreprocessSketch", staged / "Layer.pde", generated, "GeneratedLayer"],
            work, float(spec.get("limits", {}).get("compileSeconds", 60)))
        if timed_out:
            return {**fail("RESOURCE_EXHAUSTED", "compile", "preprocessing wall-time limit exceeded", bounded_lines(stderr)), "startedAt": started, "finishedAt": now()}
        if code != 0:
            diagnostics = bounded_lines(stderr)
            diagnostics.insert(0, source_line_hint(staged / "Layer.pde"))
            return {**fail("COMPILE_FAILURE", "compile", "PDE preprocessing failed", diagnostics), "startedAt": started, "finishedAt": now()}
        shutil.copyfile(HOST_FILES[0], build / HOST_FILES[0].name)
        shutil.copyfile(HOST_FILES[1], build / HOST_FILES[1].name)
        java_sources = [generated, *sorted((path for path in sources if path.suffix == ".java"), key=lambda item: item.as_posix()),
                        build / "LayerControls.java", build / "LayerHost.java"]
        code, _, stderr, timed_out = compile_command(
            [str(JDK / "bin/javac"), "--release", "17", "-proc:none", "-cp", str(core), "-d", str(build),
             *map(str, java_sources)], work, float(spec.get("limits", {}).get("compileSeconds", 60)))
        if code != 0:
            diagnostics = bounded_lines(stderr) or ["javac failed while compiling Layer.pde"]
            if not any("Layer.pde" in item for item in diagnostics):
                diagnostics.insert(0, "Layer.pde: compiler reported an error in the generated layer")
            return {**fail("COMPILE_FAILURE", "compile", "Java layer compilation failed", diagnostics), "startedAt": started, "finishedAt": now()}
        r_hash = runtime_hash(core, generated, sources)
        dependency_hashes = [{"path": path.name, "sha256": sha(path), "bytes": path.stat().st_size} for path in dependencies]
        atomic_json(progress_path, {"state": "running", "note": "rendering isolated Java2D frame"})
        limits = spec.get("limits", {})
        return_code, stdout, stderr, timed_out = sandbox_run(
            ["LayerHost", "/out/" + output.name, "/opt/controls", str(spec.get("randomSeed", 0)),
             str(spec.get("noiseSeed", 0)), str(spec.get("tick", 1))],
            work, sandbox_output, limits, JDK, core, build, staged / "controls.txt")
        if timed_out:
            return {**fail("RESOURCE_EXHAUSTED", "render", "render wall-time limit exceeded", ["java process group killed after wall-time limit"]), "startedAt": started, "finishedAt": now()}
        if return_code != 0:
            diagnostics = bounded_lines(stderr) or bounded_lines(stdout) or ["sandboxed Java process failed"]
            return {**fail("RUNTIME_FAILURE", "render", "sandboxed Java layer failed", diagnostics), "startedAt": started, "finishedAt": now()}
        rendered = sandbox_output / output.name
        if not rendered.is_file():
            return {**fail("RUNTIME_FAILURE", "render", "Java host did not publish a PNG", bounded_lines(stderr)), "startedAt": started, "finishedAt": now()}
        if rendered.stat().st_size > int(limits.get("outputBytes", 8388608)):
            return {**fail("RESOURCE_EXHAUSTED", "render", "rendered output exceeds outputBytes", []), "startedAt": started, "finishedAt": now()}
        regular = [path for path in sandbox_output.rglob("*") if path.is_file()]
        if len(regular) > 16 or sum(path.stat().st_size for path in regular) > int(limits.get("outputBytes", 8388608)):
            return {**fail("RESOURCE_EXHAUSTED", "render", "sandbox output area exceeds file limits", []), "startedAt": started, "finishedAt": now()}
        shutil.copyfile(rendered, output)
        record = json.loads(stdout.strip().splitlines()[-1])
        if record.get("status") != "succeeded" or record.get("width") != 640 or record.get("height") != 640:
            return {**fail("RUNTIME_FAILURE", "render", "Java host returned an invalid frame record", bounded_lines(stdout)), "startedAt": started, "finishedAt": now()}
        image_hash = sha(output)
        result = {"status": "succeeded", "stage": "render", "message": "Java layer rendered",
                  "imagePath": str(output), "imageSha256": image_hash, "imageBytes": output.stat().st_size,
                  "minAlpha": int(record["minAlpha"]), "runtimeHash": r_hash,
                  "dependencyHashes": dependency_hashes, "diagnostics": bounded_lines(stderr),
                  "deniedRequests": [], "startedAt": started, "finishedAt": now()}
        return result
    except KeyboardInterrupt:
        return {**fail("JOB_CANCELLED", "render", "Java layer job cancelled", []), "startedAt": started, "finishedAt": now()}
    except (OSError, ValueError, KeyError, json.JSONDecodeError, zipfile.BadZipFile, RuntimeError) as error:
        text = str(error)
        code = "MISSING_ASSET" if ("pinned" in text or "JDK" in text or "mismatch" in text
                                   or "source hash" in text or isinstance(error, zipfile.BadZipFile)) else "UNSUPPORTED_CAPABILITY"
        return {**fail(code, "compile", text, [text]), "startedAt": started, "finishedAt": now()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job", required=True, type=Path)
    args = parser.parse_args(argv)
    spec = json.loads(args.job.read_text(encoding="utf-8"))
    result = run_job(spec)
    atomic_json(Path(spec["resultPath"]), result)
    print(json.dumps(result, sort_keys=True))
    return 0 if result.get("status") == "succeeded" else 1


if __name__ == "__main__":
    raise SystemExit(main())
