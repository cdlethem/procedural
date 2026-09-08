#!/usr/bin/env python3
"""Run the one-frame 30 by 90,000 retained LinePool2D workload after root staging."""
import fcntl
import hashlib
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from tools.diagnostics.cp7.run_profiles import JARS, RUNTIME, KNOWN_STDERR

sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
WORKLOAD = ROOT / "tools/diagnostics/linepool/LinePoolWorkload.java"
ACCEPTANCE = ROOT / "design/capabilities/line-pool-workflow-acceptance.md"
SOURCE_NOTES = ROOT / "survey/out/2019/generativos/brotes/notes.md"
CATALOG = ROOT / "catalog/operations/seeded-line-pool-2d.json"
STAGE = ROOT / ".work/examples/line-pool-candidate1"
CORE = STAGE / "CutBranchMarks/code/procedurals.jar"
STAGE_RESULT = STAGE / "result.json"
JDK = ROOT / ".work/toolchains/jdk-17.0.20.1+1"
BUILD = ROOT / ".work/build/line-pool-workload"
OUT = ROOT / ".work/reproductions/line-pool-workload"
TIMEOUT_SECONDS = 180
HEAP_LIMIT_BYTES = 512 * 1024 * 1024
POOL_COUNT = 30
ATTEMPTS_PER_POOL = 90000


def bindings():
    accepted = staged_bindings()
    paths = [WORKLOAD, Path(__file__), ACCEPTANCE, SOURCE_NOTES, CATALOG, CORE,
             STAGE_RESULT, JDK / "bin/java", JDK / "bin/javac", JDK / "lib/modules"]
    for name, expected in JARS.items():
        path = RUNTIME / name
        if sha(path) != expected:
            raise RuntimeError("pinned runtime jar changed: " + str(path.relative_to(ROOT)))
        paths.append(path)
    for path in paths:
        if not path.is_file():
            raise RuntimeError("required workload input is missing: " + str(path.relative_to(ROOT)))
    return {**accepted, **{str(path.relative_to(ROOT)): sha(path) for path in paths}}


def staged_bindings():
    if not STAGE_RESULT.is_file():
        raise RuntimeError("accepted candidate staging record is missing")
    stage = json.loads(STAGE_RESULT.read_text())
    before = stage.get("inputs_before")
    after = stage.get("inputs_after")
    artifacts = stage.get("artifacts_sha256")
    if stage.get("status") != "passed" or not isinstance(before, dict) or before != after or not isinstance(artifacts, dict):
        raise RuntimeError("candidate staging record is not an accepted unchanged build")
    accepted = {**after, **artifacts}
    core_key = str(CORE.relative_to(ROOT))
    if accepted.get(core_key) is None:
        raise RuntimeError("candidate staging record does not bind its core JAR")
    for relative, expected in accepted.items():
        path = ROOT / relative
        if not isinstance(expected, str) or len(expected) != 64 or not path.is_file() or sha(path) != expected:
            raise RuntimeError("accepted candidate binding changed: " + relative)
    return accepted


def classes():
    values = {str(path.relative_to(ROOT)): sha(path) for path in sorted(BUILD.rglob("*.class"))}
    if not values:
        raise RuntimeError("LinePoolWorkload compilation produced no classes")
    return values


def validate(native):
    if native.get("status") != "passed":
        raise RuntimeError("workload did not report passed")
    expected = {
        "width": 1920, "height": 1920, "renderer": "P2D", "density": 1,
        "pool_count": POOL_COUNT, "attempts_per_pool": ATTEMPTS_PER_POOL,
        "total_attempts": POOL_COUNT * ATTEMPTS_PER_POOL,
    }
    if {key: native.get(key) for key in expected} != expected:
        raise RuntimeError("workload environment or full-count contract changed")
    pools = native.get("pools")
    if not isinstance(pools, list) or len(pools) != POOL_COUNT:
        raise RuntimeError("workload did not retain all thirty pools")
    segments = cuts = skips = 0
    for index, pool in enumerate(pools):
        if not isinstance(pool, dict) or pool.get("index") != index or pool.get("seed") != 42 + index:
            raise RuntimeError("pool ordering or seed changed")
        if any(not isinstance(pool.get(key), int) or isinstance(pool[key], bool) or pool[key] < 0
               for key in ("segments", "successfulCuts", "skips")):
            raise RuntimeError("pool counts are invalid")
        if pool["successfulCuts"] + pool["skips"] != ATTEMPTS_PER_POOL:
            raise RuntimeError("pool attempt accounting changed")
        segments += pool["segments"]
        cuts += pool["successfulCuts"]
        skips += pool["skips"]
    if (native.get("total_segments"), native.get("total_successful_cuts"), native.get("total_skips")) != (segments, cuts, skips):
        raise RuntimeError("aggregate workload accounting changed")
    if native.get("payload_estimate_bytes") != segments * 33:
        raise RuntimeError("payload estimate changed")
    if not isinstance(native.get("geometry_sha256"), str) or len(native["geometry_sha256"]) != 64:
        raise RuntimeError("missing geometry checksum")
    for key in ("generation_checksum_config_accounting_nanos", "render_readback_png_save_nanos",
                "heap_max_bytes", "heap_used_after_build_bytes",
                "heap_used_after_render_bytes", "heap_peak_sum_pools_bytes"):
        if not isinstance(native.get(key), int) or isinstance(native[key], bool) or native[key] <= 0:
            raise RuntimeError("invalid workload metric: " + key)
    if native["heap_max_bytes"] > HEAP_LIMIT_BYTES:
        raise RuntimeError("JVM heap maximum exceeded the 512MiB workload limit")
    if native.get("heap_peak_sum_pools_limitation") != "sum of independently peaking heap pools; not a simultaneous JVM maximum":
        raise RuntimeError("heap observation limitation changed")
    if not isinstance(native.get("renderer_class"), str) or not native["renderer_class"].endswith("PGraphics2D"):
        raise RuntimeError("workload did not use the asserted P2D renderer")
    if Path(native.get("core_code_source", "")).resolve() != CORE.resolve():
        raise RuntimeError("workload loaded LinePool2D from the wrong core")


if BUILD.exists() or OUT.exists():
    raise RuntimeError("Preserve prior workload attempt; choose a fresh registered output path")
before = bindings()
BUILD.mkdir(parents=True)
classpath = os.pathsep.join(map(str, [CORE, *[RUNTIME / name for name in JARS]]))
compile_command = [str(JDK / "bin/javac"), "--release", "8", "-cp", classpath, "-d", str(BUILD), str(WORKLOAD)]
compile_started = time.monotonic()
try:
    compile = subprocess.run(compile_command, cwd=ROOT, capture_output=True, text=True, timeout=120)
    compile_result = {"exit_code": compile.returncode, "stdout": compile.stdout, "stderr": compile.stderr, "timed_out": False}
except subprocess.TimeoutExpired as error:
    compile_result = {"exit_code": None, "stdout": error.stdout or "", "stderr": error.stderr or "", "timed_out": True}
compile_seconds = time.monotonic() - compile_started
after_compile = bindings()
(BUILD / "compile.json").write_text(json.dumps({
    "command": compile_command, **compile_result, "wall_seconds": compile_seconds,
    "input_sha256_before": before, "input_sha256_after": after_compile,
    "scope": "LinePoolWorkload compilation only; no Processing renderer started",
}, indent=2) + "\n")
if compile_result["timed_out"] or compile_result["exit_code"]:
    raise RuntimeError("LinePoolWorkload compilation failed; see " + str((BUILD / "compile.json").relative_to(ROOT)))
if before != after_compile:
    raise RuntimeError("workload input changed during compilation")
class_hashes = classes()
bound = {**before, **class_hashes}

with (ROOT / ".work/processing-render.lock").open("a") as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    for name in ("java", "Xvfb"):
        if subprocess.run(["pgrep", "-x", name], capture_output=True).returncode == 0:
            raise RuntimeError("native runtime busy: " + name)
    OUT.mkdir(parents=True)
    (OUT / "home").mkdir()
    (OUT / "tmp").mkdir()
    run_classpath = os.pathsep.join(map(str, [BUILD, CORE, *[RUNTIME / name for name in JARS]]))
    command = ["xvfb-run", "-a", str(JDK / "bin/java"), "-Xmx512m", "-Duser.home=" + str(OUT / "home"),
               "-Djava.io.tmpdir=" + str(OUT / "tmp"), "-cp", run_classpath, "LinePoolWorkload", str(OUT), str(CORE)]
    plan = {
        "owner": "root", "scope": "one 1920 P2D density-1 frame; thirty independent retained pools at 90,000 attempts",
        "timeout_seconds": TIMEOUT_SECONDS, "heap_limit_bytes": HEAP_LIMIT_BYTES, "input_sha256": bound,
        "compile_wall_seconds": compile_seconds, "command": command,
    }
    (OUT / "plan.json").write_text(json.dumps(plan, indent=2) + "\n")
    result = {**plan, "status": "failed"}
    render_started = time.monotonic()
    try:
        with (OUT / "stdout.txt").open("w") as stdout, (OUT / "stderr.txt").open("w") as stderr:
            process = subprocess.Popen(command, cwd=ROOT, stdout=stdout, stderr=stderr, start_new_session=True)
            try:
                exit_code = process.wait(timeout=TIMEOUT_SECONDS)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
                raise RuntimeError("full 30 by 90,000 workload timed out; counts remain unchanged")
        result["exit_code"] = exit_code
        if exit_code:
            raise RuntimeError("native workload process failed")
        stderr = (OUT / "stderr.txt").read_text()
        if stderr and not KNOWN_STDERR.fullmatch(stderr):
            raise RuntimeError("unexpected native diagnostics")
        native = json.loads((OUT / "native.json").read_text())
        validate(native)
        image = OUT / "line-pool-workload.png"
        if not image.is_file() or image.stat().st_size == 0:
            raise RuntimeError("workload did not save its frame")
        from PIL import Image
        with Image.open(image) as decoded:
            rgba = decoded.convert("RGBA")
            if rgba.size != (1920, 1920) or rgba.getchannel("A").getextrema() != (255, 255):
                raise RuntimeError("workload PNG dimensions or alpha are wrong")
            if not any(pixel[:3] != (10, 10, 21) for pixel in rgba.getdata()):
                raise RuntimeError("workload PNG is blank")
        if bindings() != before:
            raise RuntimeError("workload input changed during native render")
        if classes() != class_hashes:
            raise RuntimeError("workload class output changed during native render")
        result.update(status="passed", native=native, image_sha256=sha(image), image_bytes=image.stat().st_size)
    except Exception as error:
        result["error"] = str(error)
    finally:
        result["render_wall_seconds"] = time.monotonic() - render_started
        (OUT / "result.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({key: result[key] for key in ("status", "compile_wall_seconds", "render_wall_seconds", "error") if key in result}))
