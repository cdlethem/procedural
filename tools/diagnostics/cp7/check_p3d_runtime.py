#!/usr/bin/env python3
"""Materialize the pinned Processing P3D runtime and compile its private probe.

Without --render this tool only verifies the archived desktop runtime and compiles the
probe.  A P3D attempt needs a separately reviewed ready plan; it is intentionally never
created or approved here.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / ".work/toolchains/processing-4.5.6/processing-4.5.6-linux-x64-portable.zip"
ARCHIVE_SHA256 = "ddb816ca2c02e862a5dcf22b96bb4f81f412c4878673752b36837a7770970a6c"
TOOLCHAIN = ROOT / ".work/toolchains/cp7-processing-4.5.6"
BUILD = ROOT / ".work/build/cp7-p3d-capability"
PLAN = ROOT / "evidence/investigations/cp7-p3d-plan.json"
PROBE = ROOT / "tools/diagnostics/cp7/P3DCapabilityProbe.java"
SELF = Path(__file__).resolve()
JDK_DEFAULT = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
MEMBER_PREFIX = "Processing/lib/app/"
JARS = {
    "Processing/lib/app/resources/core/library/core-4.5.6.jar": "88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4",
    "Processing/lib/app/resources/core/library/jogl-all-2.6.0.jar": "34c919bc6073c2d9e73cbe7558c4e9de6b5c58146f3658e2bcc5f23ec3fccc9f",
    "Processing/lib/app/resources/core/library/gluegen-rt-2.6.0.jar": "465bbc8d410b872a76b5b901cdb9c2c07905edd5e61a7120dc6a4d007880ec2f",
    "Processing/lib/app/resources/core/library/jogl-all-2.6.0-natives-linux-amd64.jar": "3d0ed2674059fc207166ce1351de8d30e0b6102af12ca8b84fbf1bc3f246038a",
    "Processing/lib/app/resources/core/library/gluegen-rt-2.6.0-natives-linux-amd64.jar": "d500a38dedcbd6dfa89c5ae943a22d1051b1dbf1502f8544337bbe57d118f2c5",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repo_path(path: Path) -> str:
    return str(path.resolve().relative_to(ROOT))


def write_json_new(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")


def write_json_replace(path: Path, value: object) -> None:
    pending = path.with_name(path.name + ".pending")
    with pending.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")
    pending.replace(path)


def selected_target(member: str) -> Path:
    if not member.startswith(MEMBER_PREFIX):
        raise ValueError("unexpected archive member prefix: " + member)
    return TOOLCHAIN / member[len(MEMBER_PREFIX):]


def materialize() -> dict[str, str]:
    if not ARCHIVE.is_file() or sha256(ARCHIVE) != ARCHIVE_SHA256:
        raise RuntimeError("pinned Processing desktop archive is missing or changed")
    targets: dict[str, str] = {}
    with zipfile.ZipFile(ARCHIVE) as archive:
        entries = set(archive.namelist())
        missing = sorted(set(JARS) - entries)
        if missing:
            raise RuntimeError("pinned archive lacks required P3D jars: " + ", ".join(missing))
        for member, expected in JARS.items():
            payload = archive.read(member)
            observed = hashlib.sha256(payload).hexdigest()
            if observed != expected:
                raise RuntimeError("archive member hash differs: " + member)
            target = selected_target(member)
            if target.exists():
                if not target.is_file() or sha256(target) != expected:
                    raise RuntimeError("refusing to replace changed materialized jar: " + repo_path(target))
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                pending = target.with_name(target.name + ".pending")
                with pending.open("xb") as handle:
                    handle.write(payload)
                pending.replace(target)
            if sha256(target) != expected:
                raise RuntimeError("materialized jar hash differs: " + repo_path(target))
            targets[repo_path(target)] = expected
    return targets


def source_bindings(java_home: Path, jars: dict[str, str]) -> dict[str, str]:
    paths = [ARCHIVE, PROBE, SELF, java_home / "bin/java", java_home / "bin/javac"]
    values = {repo_path(path): sha256(path) for path in paths}
    values.update(jars)
    return dict(sorted(values.items()))


def compiled_bindings(classes: Path) -> dict[str, str]:
    class_files = sorted(path for path in classes.rglob("*.class") if path.is_file())
    if not class_files:
        raise RuntimeError("P3D probe compilation produced no class files")
    return {repo_path(path): sha256(path) for path in class_files}


def compile_probe(java_home: Path, jars: dict[str, str]) -> tuple[Path, dict[str, str], dict[str, str]]:
    if not PROBE.is_file():
        raise RuntimeError("probe source is missing")
    javac = java_home / "bin/javac"
    java = java_home / "bin/java"
    if not javac.is_file() or not java.is_file():
        raise RuntimeError("pinned Java 17 javac/java is unavailable")
    BUILD.mkdir(parents=True, exist_ok=True)
    classes = BUILD / "classes"
    classes.mkdir(parents=True, exist_ok=True)
    classpath = os.pathsep.join(str(ROOT / relative) for relative in jars)
    command = [str(javac), "--release", "8", "-cp", classpath, "-d", str(classes), str(PROBE)]
    bindings_before = source_bindings(java_home, jars)
    try:
        completed = subprocess.run(command, cwd=ROOT, text=True, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, check=False, timeout=30)
        compile_error = None
    except subprocess.TimeoutExpired:
        completed = None
        compile_error = "P3D probe compilation exceeded its 30-second timeout"
    report = {
        "status": "passed" if completed is not None and completed.returncode == 0 else "failed",
        "scope": "pinned desktop Processing P3D jar materialization and Java compilation only; no P3D runtime was started",
        "archive_sha256": ARCHIVE_SHA256,
        "command": command,
        "stdout": "" if completed is None else completed.stdout,
        "stderr": "" if completed is None else completed.stderr,
        "error": compile_error,
        "input_sha256_before": bindings_before,
        "input_sha256_after": source_bindings(java_home, jars),
        "classes": repo_path(classes),
    }
    if completed is None or completed.returncode != 0:
        write_json_replace(BUILD / "compile.json", report)
        raise RuntimeError("P3D probe compilation failed; see " + repo_path(BUILD / "compile.json"))
    if report["input_sha256_before"] != report["input_sha256_after"]:
        write_json_replace(BUILD / "compile.json", report)
        raise RuntimeError("P3D compilation input changed while compiling")
    class_hashes = compiled_bindings(classes)
    report["compiled_class_sha256"] = class_hashes
    write_json_replace(BUILD / "compile.json", report)
    return classes, bindings_before, class_hashes


def read_ready_plan() -> dict:
    if not PLAN.is_file():
        raise RuntimeError("--render requires root-authored " + repo_path(PLAN))
    try:
        plan = json.loads(PLAN.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError("P3D plan is not valid JSON: " + str(error))
    if not isinstance(plan, dict) or plan.get("status") != "ready":
        raise RuntimeError("--render requires a root-authored P3D plan with status ready")
    if plan.get("attempt_budget") != 1 or plan.get("timeout_seconds") != 90:
        raise RuntimeError("ready P3D plan must declare one attempt and a 90-second timeout")
    hashes = plan.get("source_sha256")
    required = {repo_path(PROBE), repo_path(SELF)}
    if not isinstance(hashes, dict) or not required.issubset(hashes):
        raise RuntimeError("ready P3D plan must bind probe and runner source hashes")
    for relative, expected in hashes.items():
        if not isinstance(relative, str) or not isinstance(expected, str) or len(expected) != 64:
            raise RuntimeError("ready P3D plan has an invalid source hash binding")
        path = (ROOT / relative).resolve()
        try:
            path.relative_to(ROOT)
        except ValueError:
            raise RuntimeError("ready P3D plan source binding escapes the repository: " + relative)
        if not path.is_file() or sha256(path) != expected:
            raise RuntimeError("ready P3D plan source binding changed: " + relative)
    output = plan.get("output")
    result = plan.get("result")
    if not isinstance(output, str) or not output or not isinstance(result, str) or not result:
        raise RuntimeError("ready P3D plan must declare output and result paths")
    output_path = (ROOT / output).resolve()
    result_path = (ROOT / result).resolve()
    try:
        output_path.relative_to(ROOT / ".work")
        result_path.relative_to(ROOT)
    except ValueError:
        raise RuntimeError("P3D output must be under .work and result must remain in the repository")
    if result_path.exists():
        raise RuntimeError("refusing to overwrite existing P3D terminal result")
    return plan


def require_absent_attempt_output(output: Path) -> None:
    prohibited = [output / "attempt.json", output / "native.json", output / "p3d-depth.png",
                  output / "stdout.log", output / "stderr.log"]
    existing = [repo_path(path) for path in prohibited if path.exists()]
    if existing:
        raise RuntimeError("P3D output already contains attempted evidence; preserve it: " + ", ".join(existing))


def check_image(output: Path, native: dict) -> dict:
    from PIL import Image
    if native.get("status") != "passed" or native.get("draws") != 1:
        raise RuntimeError("native P3D report does not describe one passed draw")
    if native.get("renderer_is_pgraphics3d") is not True:
        raise RuntimeError("native P3D report did not prove PGraphics3D")
    if native.get("renderer_class") != "processing.opengl.PGraphics3D":
        raise RuntimeError("unexpected renderer class: " + str(native.get("renderer_class")))
    if [native.get(key) for key in ("width", "height", "pixel_width", "pixel_height", "pixel_density")] != [320, 320, 320, 320, 1]:
        raise RuntimeError("unexpected native P3D dimensions or density")
    gl = native.get("gl")
    if not isinstance(gl, dict) or any(not isinstance(gl.get(key), str) or not gl[key].strip()
                                       for key in ("vendor", "renderer", "version")):
        raise RuntimeError("native P3D report is missing actual GL context strings")
    runtime = native.get("runtime")
    if not isinstance(runtime, dict) or any(not isinstance(runtime.get(key), str) or not runtime[key].strip()
                                            for key in ("display", "java_version", "os_name", "os_arch")):
        raise RuntimeError("native P3D report is missing actual display/JVM/OS facts")
    image = output / "p3d-depth.png"
    if native.get("image") != image.name or not image.is_file():
        raise RuntimeError("native P3D report/image binding is missing")
    with Image.open(image) as loaded:
        rgba = loaded.convert("RGBA")
        if rgba.size != (320, 320) or rgba.getchannel("A").getextrema() != (255, 255):
            raise RuntimeError("P3D PNG dimensions or opacity are wrong")
        front, back, background = rgba.getpixel((160, 160)), rgba.getpixel((100, 160)), rgba.getpixel((20, 20))
    if not (front[0] > 220 and front[1] < 30 and front[2] < 30):
        raise RuntimeError("front P3D depth sample is not red")
    if not (back[2] > 220 and back[0] < 30 and back[1] < 30):
        raise RuntimeError("back P3D depth sample is not blue")
    if background[:3] != (17, 23, 31):
        raise RuntimeError("P3D background sample differs")
    samples = native.get("samples")
    if not isinstance(samples, dict):
        raise RuntimeError("native P3D pixel sample report is missing")
    for name, rgba_value in (("front_red", front), ("back_blue", back), ("background", background)):
        sample = samples.get(name)
        if not isinstance(sample, dict) or sample.get("argb") != int.from_bytes(bytes((rgba_value[3], *rgba_value[:3])), "big"):
            raise RuntimeError("native P3D sample does not match saved PNG: " + name)
    return {"path": repo_path(image), "sha256": sha256(image), "width": 320, "height": 320,
            "alpha_opaque": True, "samples": {"front_red": list(front), "back_blue": list(back),
                                                   "background": list(background)}}


def run_render(java_home: Path, classes: Path, source_before: dict[str, str], class_before: dict[str, str], plan: dict) -> None:
    output = (ROOT / plan["output"]).resolve()
    result_path = (ROOT / plan["result"]).resolve()
    plan_path = PLAN.resolve()
    bindings = dict(source_before)
    bindings[repo_path(plan_path)] = sha256(plan_path)
    bindings.update(class_before)
    require_absent_attempt_output(output)
    output.mkdir(parents=True, exist_ok=True)
    for folder in (BUILD / "home", output / "tmp"):
        folder.mkdir(parents=True, exist_ok=True)
    lock_path = ROOT / ".work/processing-render.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if source_bindings(java_home, {relative: source_before[relative] for relative in source_before if relative.endswith(".jar")}) != source_before:
            raise RuntimeError("P3D source/JAR binding changed before attempt reservation")
        if compiled_bindings(classes) != class_before:
            raise RuntimeError("compiled P3D probe classes changed before attempt reservation")
        if sha256(plan_path) != bindings[repo_path(plan_path)]:
            raise RuntimeError("ready P3D plan changed before attempt reservation")
        require_absent_attempt_output(output)
        write_json_new(output / "attempt.json", {
            "status": "reserved", "attempt_budget": 1, "timeout_seconds": 90,
            "input_sha256": bindings, "plan": repo_path(plan_path), "plan_sha256": sha256(plan_path),
        })
        report: dict = {"status": "failed", "scope": "one private P3D runtime capability probe only; no mesh, shader, or broader renderer support claim",
                        "input_sha256": bindings, "plan": repo_path(plan_path), "plan_sha256": sha256(plan_path)}
        process = None
        jar_bindings = {relative: source_before[relative] for relative in source_before if relative.endswith(".jar")}
        try:
            jar_paths = [ROOT / relative for relative in sorted(jar_bindings)]
            classpath = os.pathsep.join([str(classes), *map(str, jar_paths)])
            command = ["xvfb-run", "-a", str(java_home / "bin/java"), f"-Duser.home={BUILD / 'home'}",
                       f"-Djava.io.tmpdir={output / 'tmp'}", "-cp", classpath, "P3DCapabilityProbe", str(output)]
            report["command"] = command
            stdout_path, stderr_path = output / "stdout.log", output / "stderr.log"
            with stdout_path.open("x", encoding="utf-8") as stdout, stderr_path.open("x", encoding="utf-8") as stderr:
                process = subprocess.Popen(command, cwd=ROOT, stdout=stdout, stderr=stderr, start_new_session=True)
                write_json_replace(output / "attempt.json", {
                    "status": "running", "pid": process.pid, "attempt_budget": 1, "timeout_seconds": 90,
                    "input_sha256": bindings, "plan": repo_path(plan_path), "plan_sha256": sha256(plan_path),
                })
                try:
                    exit_code = process.wait(timeout=90)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                    raise RuntimeError("P3D probe exceeded its 90-second timeout")
            report.update(command=command, exit_code=exit_code, stdout=stdout_path.read_text(encoding="utf-8"),
                          stderr=stderr_path.read_text(encoding="utf-8"))
            if exit_code != 0:
                raise RuntimeError("P3D probe failed; captured stderr is preserved")
            if report["stderr"].strip():
                raise RuntimeError("P3D probe emitted unexpected stderr")
            native_path = output / "native.json"
            if not native_path.is_file():
                raise RuntimeError("P3D probe exited without native report")
            image = check_image(output, json.loads(native_path.read_text(encoding="utf-8")))
            if source_bindings(java_home, jar_bindings) != source_before:
                raise RuntimeError("P3D runtime input changed during attempt")
            if compiled_bindings(classes) != class_before:
                raise RuntimeError("compiled P3D probe classes changed during attempt")
            if sha256(plan_path) != bindings[repo_path(plan_path)]:
                raise RuntimeError("ready P3D plan changed during attempt")
            report.update(status="passed", native=json.loads(native_path.read_text(encoding="utf-8")), image=image,
                          input_sha256_after={**source_bindings(java_home, jar_bindings),
                                              repo_path(plan_path): sha256(plan_path), **compiled_bindings(classes)})
        except Exception as error:
            report["error"] = str(error)
        finally:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            if process is not None:
                report["exit_code"] = process.returncode
            for name in ("stdout", "stderr"):
                log = output / (name + ".log")
                if log.exists():
                    report[name] = log.read_text(encoding="utf-8", errors="replace")
            try:
                input_after = {**source_bindings(java_home, jar_bindings),
                               repo_path(plan_path): sha256(plan_path), **compiled_bindings(classes)}
                report.setdefault("input_sha256_after", input_after)
                if input_after != bindings:
                    report["input_binding_error"] = "P3D input changed during attempt"
                    if report["status"] == "passed":
                        report["status"] = "failed"
                        report["error"] = report["input_binding_error"]
            except Exception as binding_error:
                report["input_binding_error"] = str(binding_error)
                if report["status"] == "passed":
                    report["status"] = "failed"
                    report["error"] = report["input_binding_error"]
            write_json_replace(output / "attempt.json", {"status": report["status"], "attempt_budget": 1,
                "timeout_seconds": 90, "input_sha256": bindings, "plan": repo_path(plan_path), "plan_sha256": sha256(plan_path)})
            write_json_new(result_path, report)
        print(json.dumps({"status": report["status"], "error": report.get("error"), "attempt": repo_path(output / "attempt.json")}))
        if report["status"] != "passed":
            raise SystemExit(1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--java-home", type=Path, default=JDK_DEFAULT)
    parser.add_argument("--render", action="store_true", help="requires a reviewed root-authored ready plan")
    args = parser.parse_args()
    java_home = args.java_home.resolve()
    jars = materialize()
    classes, bindings, class_hashes = compile_probe(java_home, jars)
    if not args.render:
        print(json.dumps({"status": "built", "scope": "pinned five-JAR P3D runtime materialized and probe compiled; no P3D runtime was started",
                          "archive_sha256": ARCHIVE_SHA256, "jars": jars, "classes": repo_path(classes)}, sort_keys=True))
        return
    run_render(java_home, classes, bindings, class_hashes, read_ready_plan())


if __name__ == "__main__":
    main()
