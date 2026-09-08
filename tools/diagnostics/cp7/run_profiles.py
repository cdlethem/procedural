#!/usr/bin/env python3
"""Compile and inspect the private CP7 profile-mesh comparison.

The default path is pure Java inspection.  ``--render`` is deliberately unavailable
until the root-authored experiment record is marked ready and binds this executor,
the private source, its palette dependency, and the expected numerical profiles.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import time

ROOT = Path(__file__).resolve().parents[3]
EXPERIMENT = ROOT / "evidence/parameter-experiments/cp7-profiles/experiment.json"
SOURCE = ROOT / "tools/diagnostics/cp7/ProfileChoices.java"
PALETTE = ROOT / "packages/java/src/main/java/org/procedurals/color/CyclicPalette.java"
SELF = Path(__file__).resolve()
ARCHIVE = ROOT / ".work/toolchains/processing-4.5.6/processing-4.5.6-linux-x64-portable.zip"
ARCHIVE_SHA256 = "ddb816ca2c02e862a5dcf22b96bb4f81f412c4878673752b36837a7770970a6c"
RUNTIME = ROOT / ".work/toolchains/cp7-processing-4.5.6/resources/core/library"
JDK = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
BUILD = ROOT / ".work/build/cp7-profiles"
OUTPUT = ROOT / ".work/experiments/cp7-profiles"
DEFAULT_RESULT = ROOT / "evidence/parameter-experiments/cp7-profiles/result.json"
CASES = ("baseline", "waist", "pointed", "coarse", "open", "recolour", "transfer")
JARS = {
    "core-4.5.6.jar": "88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4",
    "jogl-all-2.6.0.jar": "34c919bc6073c2d9e73cbe7558c4e9de6b5c58146f3658e2bcc5f23ec3fccc9f",
    "gluegen-rt-2.6.0.jar": "465bbc8d410b872a76b5b901cdb9c2c07905edd5e61a7120dc6a4d007880ec2f",
    "jogl-all-2.6.0-natives-linux-amd64.jar": "3d0ed2674059fc207166ce1351de8d30e0b6102af12ca8b84fbf1bc3f246038a",
    "gluegen-rt-2.6.0-natives-linux-amd64.jar": "d500a38dedcbd6dfa89c5ae943a22d1051b1dbf1502f8544337bbe57d118f2c5",
}

# The CP7 root review registered only this complete seven-line diagnostic sequence.
# X display numbers and native pointer values vary; all other text is a terminal failure.
KNOWN_STDERR = re.compile(
    r"\AlibEGL warning: DRI3 error: Could not get DRI3 device\n"
    r"libEGL warning: Ensure your X server supports DRI3 to get accelerated rendering\n"
    r"X11Util\.Display: Shutdown \(JVM shutdown: true, open \(no close attempt\): 3/3, "
    r"reusable \(open, marked uncloseable\): 0, pending \(open in creation order\): 3\)\n"
    r"X11Util: Open X11 Display Connections: 3\n"
    r"X11Util: Open\[0\]: NamedX11Display\[:\d+, 0x[0-9a-fA-F]+, refCount 1, unCloseable false\]\n"
    r"X11Util: Open\[1\]: NamedX11Display\[:\d+, 0x[0-9a-fA-F]+, refCount 1, unCloseable false\]\n"
    r"X11Util: Open\[2\]: NamedX11Display\[:\d+, 0x[0-9a-fA-F]+, refCount 1, unCloseable false\]\n\Z"
)


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as handle:
        for part in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(part)
    return result.hexdigest()


def relative(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT))


def json_write(path: Path, value: object, replace: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if replace:
        temporary = path.with_name(path.name + ".pending")
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")
        temporary.replace(path)
    else:
        with path.open("x", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, sort_keys=True)
            handle.write("\n")


def runtime_bindings() -> dict[str, str]:
    if not ARCHIVE.is_file() or digest(ARCHIVE) != ARCHIVE_SHA256:
        raise RuntimeError("pinned Processing desktop archive is absent or changed")
    paths = [ARCHIVE, SOURCE, PALETTE, SELF, JDK / "bin/java", JDK / "bin/javac"]
    for name, expected in JARS.items():
        path = RUNTIME / name
        if not path.is_file() or digest(path) != expected:
            raise RuntimeError("required CP7 P3D jar is absent or changed: " + relative(path))
        paths.append(path)
    return {relative(path): digest(path) for path in sorted(paths)}


def class_bindings(classes: Path) -> dict[str, str]:
    values = {relative(path): digest(path) for path in sorted(classes.rglob("*.class")) if path.is_file()}
    if not values:
        raise RuntimeError("ProfileChoices compilation produced no class files")
    return values


def run(command: list[str], timeout: int) -> dict:
    process = subprocess.Popen(command, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, start_new_session=True)
    try:
        stdout, stderr = process.communicate(timeout=timeout)
        return {"exit_code": process.returncode, "stdout": stdout, "stderr": stderr, "timed_out": False}
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        stdout, stderr = process.communicate()
        return {"exit_code": process.returncode, "stdout": stdout, "stderr": stderr, "timed_out": True}


def checked(command: list[str], timeout: int, label: str) -> dict:
    observed = run(command, timeout)
    if observed["timed_out"] or observed["exit_code"] != 0 or observed["stderr"].strip():
        raise RuntimeError(label + " failed: " + json.dumps(observed))
    return observed


def compile_sources(before: dict[str, str]) -> tuple[Path, dict, dict[str, str]]:
    java = JDK / "bin/java"
    javac = JDK / "bin/javac"
    if not java.is_file() or not javac.is_file():
        raise RuntimeError("pinned JDK 17 is unavailable")
    classes = BUILD / "classes"
    classes.mkdir(parents=True, exist_ok=True)
    jars = [RUNTIME / name for name in JARS]
    command = [str(javac), "--release", "8", "-cp", os.pathsep.join(map(str, jars)), "-d", str(classes),
               str(PALETTE), str(SOURCE)]
    observed = run(command, 30)
    after = runtime_bindings()
    report = {"command": command, **observed, "input_sha256_before": before, "input_sha256_after": after,
              "scope": "private CP7 source and CyclicPalette compilation only; no P3D renderer started"}
    json_write(BUILD / "compile.json", report)
    if observed["timed_out"] or observed["exit_code"] != 0:
        raise RuntimeError("ProfileChoices compilation failed; see " + relative(BUILD / "compile.json"))
    if before != after:
        raise RuntimeError("ProfileChoices compilation input changed")
    return classes, report, class_bindings(classes)


def parse_json(stdout: str, label: str) -> dict:
    try:
        value = json.loads(stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(label + " did not write one JSON object: " + str(error))
    if not isinstance(value, dict):
        raise RuntimeError(label + " JSON must be an object")
    return value


def validate_cases(value: dict, label: str) -> list[dict]:
    cases = value.get("cases")
    if not isinstance(cases, list) or [case.get("id") if isinstance(case, dict) else None for case in cases] != list(CASES):
        raise RuntimeError(label + " has wrong case IDs")
    for case in cases:
        meshes = case.get("meshes")
        if not isinstance(meshes, list) or not meshes:
            raise RuntimeError(label + " has no retained mesh records: " + str(case.get("id")))
        for mesh in meshes:
            if not isinstance(mesh, dict) or any(not isinstance(mesh.get(key), int)
                                                  or isinstance(mesh.get(key), bool) or mesh[key] <= 0
                                                  for key in ("vertices", "faces")):
                raise RuntimeError(label + " has invalid mesh counts: " + case["id"])
            if not isinstance(mesh.get("geometry_sha256"), str) or len(mesh["geometry_sha256"]) != 64:
                raise RuntimeError(label + " has invalid geometry hash: " + case["id"])
        if not isinstance(case.get("drawn_faces"), int) or isinstance(case["drawn_faces"], bool) or case["drawn_faces"] <= 0:
            raise RuntimeError(label + " has invalid drawn face count: " + case["id"])
        if not isinstance(case.get("reuses_retained_geometry"), bool):
            raise RuntimeError(label + " has no retained-geometry identity fact: " + case["id"])
    return cases


def inspect(classes: Path) -> tuple[dict, dict]:
    jars = [RUNTIME / name for name in JARS]
    command = [str(JDK / "bin/java"), "-cp", os.pathsep.join([str(classes), *map(str, jars)]),
               "ProfileChoices", "--inspect"]
    observed = checked(command, 30, "ProfileChoices pure inspection")
    value = parse_json(observed["stdout"], "ProfileChoices pure inspection")
    if value.get("status") != "passed":
        raise RuntimeError("ProfileChoices inspection did not return passed")
    validate_cases(value, "ProfileChoices pure inspection")
    for key in ("generated_faces", "expected_drawn_faces"):
        if not isinstance(value.get(key), int) or isinstance(value[key], bool) or value[key] <= 0:
            raise RuntimeError("ProfileChoices inspection has invalid " + key)
    if sum(case["drawn_faces"] for case in value["cases"]) != value["expected_drawn_faces"]:
        raise RuntimeError("ProfileChoices inspection drawn face total is inconsistent")
    return value, {"command": command, **observed}


def read_ready_plan(inspected: dict) -> tuple[dict, Path, Path, dict[str, str]]:
    plan = json.loads(EXPERIMENT.read_text(encoding="utf-8"))
    if plan.get("status") != "ready":
        raise RuntimeError("--render requires root to change the CP7 experiment status to ready")
    if plan.get("attempt_budget") != 1 or plan.get("attempt_timeout_seconds") != 180 or plan.get("render_budget") != 7:
        raise RuntimeError("ready CP7 plan must freeze one seven-image, 180-second attempt")
    hashes = plan.get("source_sha256")
    required = {relative(SOURCE), relative(PALETTE), relative(SELF)}
    if not isinstance(hashes, dict) or not required.issubset(hashes):
        raise RuntimeError("ready CP7 plan must bind ProfileChoices, CyclicPalette, and executor source")
    for item, expected in hashes.items():
        path = (ROOT / item).resolve()
        try:
            path.relative_to(ROOT)
        except ValueError:
            raise RuntimeError("CP7 plan source binding escapes repository: " + item)
        if not isinstance(expected, str) or len(expected) != 64 or not path.is_file() or digest(path) != expected:
            raise RuntimeError("CP7 plan source binding changed: " + item)
    expected_profiles = plan.get("expected_profiles")
    if expected_profiles != inspected["cases"]:
        raise RuntimeError("ready CP7 expected numerical profiles do not exactly match pure inspection")
    if plan.get("expected_generated_faces") != inspected["generated_faces"]:
        raise RuntimeError("ready CP7 generated face count does not match pure inspection")
    expected_drawn = plan.get("expected_drawn_faces")
    if not isinstance(expected_drawn, dict) or list(expected_drawn) != list(CASES):
        raise RuntimeError("ready CP7 plan must freeze per-case drawn face counts")
    if expected_drawn != {case["id"]: case["drawn_faces"] for case in inspected["cases"]}:
        raise RuntimeError("ready CP7 drawn face map does not match pure inspection")
    if plan.get("expected_total_drawn_faces") != inspected["expected_drawn_faces"]:
        raise RuntimeError("ready CP7 total drawn face count does not match pure inspection")
    if plan.get("expected_normal_evaluations") != plan["expected_total_drawn_faces"]:
        raise RuntimeError("ready CP7 normal evaluation count must equal total drawn faces")
    if plan.get("stderr_policy", {}).get("id") != "cp7-observed-software-context-warnings-v1":
        raise RuntimeError("ready CP7 plan must register the exact scoped P3D stderr policy")
    output = plan.get("output", ".work/experiments/cp7-profiles")
    result = plan.get("result", "evidence/parameter-experiments/cp7-profiles/result.json")
    output_path, result_path = (ROOT / output).resolve(), (ROOT / result).resolve()
    try:
        output_path.relative_to(ROOT / ".work")
        result_path.relative_to(ROOT)
    except ValueError:
        raise RuntimeError("CP7 plan output/result escape their allowed locations")
    if result_path.exists() or (output_path.exists() and any(output_path.iterdir())):
        raise RuntimeError("existing CP7 profile result or output must be preserved; no retry")
    return plan, output_path, result_path, {item: digest((ROOT / item).resolve()) for item in hashes}


def assert_absent(output: Path, result: Path) -> None:
    if result.exists() or (output.exists() and any(output.iterdir())):
        raise RuntimeError("existing CP7 profile evidence must be preserved; no overwrite")


def recognize_stderr(stderr: str) -> list[str]:
    if stderr and not KNOWN_STDERR.fullmatch(stderr):
        raise RuntimeError("P3D emitted stderr outside the root-preregistered seven-line CP7 warning block")
    return stderr.splitlines()


def png_and_metrics(output: Path, expected: list[dict]) -> list[dict]:
    from PIL import Image, ImageChops, ImageStat
    baseline_path = output / "baseline.png"
    results: list[dict] = []
    with Image.open(baseline_path) as image:
        baseline = image.convert("RGB").copy()
    for profile in expected:
        case = profile["id"]
        path = output / (case + ".png")
        if not path.is_file():
            raise RuntimeError("missing P3D image: " + case)
        with Image.open(path) as image:
            rgba = image.convert("RGBA")
            if rgba.size != (640, 640) or rgba.getchannel("A").getextrema() != (255, 255):
                raise RuntimeError("P3D image dimensions/alpha are wrong: " + case)
            rgb = rgba.convert("RGB")
            colors = rgb.getcolors(640 * 640)
            if colors is None or len(colors) < 2:
                raise RuntimeError("P3D image is blank: " + case)
            metrics = None
            if case != "baseline":
                difference = ImageChops.difference(baseline, rgb)
                changed = sum(count for count, color in (difference.getcolors(640 * 640) or []) if color != (0, 0, 0))
                metrics = {"mean_rgb_normalized": sum(ImageStat.Stat(difference).mean) / (3.0 * 255.0),
                           "changed_fraction": changed / (640.0 * 640.0)}
                if changed == 0:
                    raise RuntimeError("P3D variant did not differ from baseline: " + case)
        results.append({"id": case, "image": {"path": relative(path), "sha256": digest(path),
                                                   "width": 640, "height": 640, "alpha_opaque": True},
                        "diff_from_baseline": metrics})
    return results


def render(plan: dict, output: Path, result_path: Path, classes: Path, inspected: dict,
           compilation: dict, runtime_before: dict[str, str], plan_before: dict[str, str],
           classes_before: dict[str, str]) -> None:
    source_before = dict(runtime_before)
    source_before.update(plan_before)
    source_before[relative(EXPERIMENT)] = digest(EXPERIMENT)
    source_before.update(classes_before)
    lock_path = ROOT / ".work/processing-render.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if runtime_bindings() != runtime_before:
            raise RuntimeError("CP7 profile runtime source/JAR inputs changed before reservation")
        if (class_bindings(classes) != classes_before or digest(EXPERIMENT) != source_before[relative(EXPERIMENT)]
                or {path: digest(ROOT / path) for path in plan_before} != plan_before):
            raise RuntimeError("CP7 profile plan/classes changed before reservation")
        assert_absent(output, result_path)
        output.mkdir(parents=True, exist_ok=True)
        for directory in (BUILD / "home", output / "tmp"):
            directory.mkdir(parents=True, exist_ok=True)
        json_write(output / "attempt.json", {"status": "reserved", "attempt": 1, "image_budget": 7,
                                               "timeout_seconds": 180, "input_sha256": source_before}, replace=False)
        report: dict = {"status": "failed", "scope": "private CP7 P3D retained-profile comparison; no source-pixel reproduction or public mesh support claim",
                        "input_sha256_before": source_before, "pure_inspection": inspected, "compilation": compilation,
                        "visual_review": "pending", "cases": []}
        process = None
        stdout_path = None
        stderr_path = None
        try:
            jars = [RUNTIME / name for name in JARS]
            command = ["xvfb-run", "-a", str(JDK / "bin/java"), f"-Duser.home={BUILD / 'home'}",
                       f"-Djava.io.tmpdir={output / 'tmp'}", "-cp", os.pathsep.join([str(classes), *map(str, jars)]),
                       "ProfileChoices", "--render", str(output)]
            report["command"] = command
            stdout_path, stderr_path = output / "stdout.log", output / "stderr.log"
            with stdout_path.open("x", encoding="utf-8") as stdout, stderr_path.open("x", encoding="utf-8") as stderr:
                process = subprocess.Popen(command, cwd=ROOT, stdout=stdout, stderr=stderr, start_new_session=True)
                json_write(output / "attempt.json", {"status": "running", "attempt": 1, "pid": process.pid,
                                                       "image_budget": 7, "timeout_seconds": 180,
                                                       "input_sha256": source_before})
                try:
                    exit_code = process.wait(timeout=180)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                    raise RuntimeError("CP7 profile attempt exceeded its 180-second timeout")
            observed = {"exit_code": exit_code, "stdout": stdout_path.read_text(encoding="utf-8"),
                        "stderr": stderr_path.read_text(encoding="utf-8")}
            report["process"] = observed
            if exit_code != 0:
                raise RuntimeError("CP7 P3D profile process failed")
            report["recognized_stderr"] = recognize_stderr(observed["stderr"])
            native_path = output / "native.json"
            if not native_path.is_file():
                raise RuntimeError("CP7 P3D process exited without native.json")
            native = parse_json(native_path.read_text(encoding="utf-8"), "CP7 P3D native render")
            if (native.get("status") != "passed" or native.get("cases") != inspected["cases"]
                    or native.get("generated_faces") != plan["expected_generated_faces"]
                    or native.get("expected_drawn_faces") != inspected["expected_drawn_faces"]):
                raise RuntimeError("CP7 native profiles differ from pure inspection")
            if native.get("frames") != 7 or native.get("drawn_faces") != plan["expected_total_drawn_faces"]:
                raise RuntimeError("CP7 native frames or drawn face counts differ from ready plan")
            if native.get("normal_evaluations") != plan["expected_normal_evaluations"]:
                raise RuntimeError("CP7 native did not evaluate one flat normal per drawn face")
            context = native.get("context")
            if not isinstance(context, dict) or context.get("renderer_class") != "processing.opengl.PGraphics3D":
                raise RuntimeError("CP7 native renderer was not exact PGraphics3D")
            if any(not isinstance(context.get(key), str) or not context[key].strip()
                   for key in ("vendor", "renderer", "version")):
                raise RuntimeError("CP7 native PGL facts are missing")
            if [native.get(key) for key in ("width", "height", "pixel_density")] != [640, 640, 1]:
                raise RuntimeError("CP7 native dimensions or density differ")
            report["native"] = native
            report["cases"] = png_and_metrics(output, inspected["cases"])
            after = runtime_bindings()
            after.update({path: digest(ROOT / path) for path in plan_before})
            after[relative(EXPERIMENT)] = digest(EXPERIMENT)
            after.update(class_bindings(classes))
            report["input_sha256_after"] = after
            if after != source_before:
                raise RuntimeError("CP7 profile inputs/classes changed during attempt")
            report["status"] = "passed"
        except Exception as error:
            report["error"] = str(error)
        finally:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            if stdout_path is not None and stderr_path is not None:
                report.setdefault("process", {
                    "exit_code": None if process is None else process.returncode,
                    "stdout": stdout_path.read_text(encoding="utf-8") if stdout_path.exists() else "",
                    "stderr": stderr_path.read_text(encoding="utf-8") if stderr_path.exists() else "",
                })
            try:
                after = runtime_bindings()
                after.update({path: digest(ROOT / path) for path in plan_before})
                after[relative(EXPERIMENT)] = digest(EXPERIMENT)
                after.update(class_bindings(classes))
                report.setdefault("input_sha256_after", after)
                if after != source_before and report["status"] == "passed":
                    report.update(status="failed", error="CP7 profile inputs/classes changed during attempt")
            except Exception as error:
                if report["status"] == "passed":
                    report.update(status="failed", error=str(error))
            json_write(output / "attempt.json", {"status": report["status"], "attempt": 1, "image_budget": 7,
                                                   "timeout_seconds": 180, "result": relative(result_path),
                                                   "input_sha256": source_before})
            json_write(result_path, report, replace=False)
        print(json.dumps({"status": report["status"], "error": report.get("error"), "cases": len(report["cases"])}))
        if report["status"] != "passed":
            raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true", help="requires a root-authored ready CP7 experiment record")
    arguments = parser.parse_args()
    before = runtime_bindings()
    classes, compilation, classes_before = compile_sources(before)
    inspected, inspection_process = inspect(classes)
    if not arguments.render:
        print(json.dumps({"status": "preflight-passed", "scope": "private ProfileChoices pure inspection and compilation only; no renderer started",
                          "inspection": inspected, "inspection_process": inspection_process,
                          "compilation": compilation}, sort_keys=True))
        return
    plan, output, result, plan_before = read_ready_plan(inspected)
    render(plan, output, result, classes, inspected, compilation, before, plan_before, classes_before)


if __name__ == "__main__":
    main()
