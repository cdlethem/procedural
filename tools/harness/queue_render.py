#!/usr/bin/env python3
"""Queue an isolated layer render behind the shared native-render lease."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
JOBS = (ROOT / ".work" / "harness" / "jobs").resolve()
MAX_DIAGNOSTICS = 20
MAX_DIAGNOSTIC_CHARS = 400


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temp.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(temp, path)


def bounded_lines(text: str) -> list[str]:
    lines = []
    for line in text.splitlines()[-MAX_DIAGNOSTICS:]:
        line = line.strip()
        if line:
            lines.append(line[:MAX_DIAGNOSTIC_CHARS])
    return lines[-MAX_DIAGNOSTICS:]


def fail_result(spec: dict[str, Any], code: str, message: str, diagnostics: list[str] | None = None) -> None:
    result = {
        "status": "failed",
        "stage": "render",
        "code": code,
        "message": message[:400],
        "diagnostics": (diagnostics or [])[-MAX_DIAGNOSTICS:],
        "startedAt": now(),
        "finishedAt": now(),
    }
    result_path = Path(spec["resultPath"])
    if not result_path.exists():
        atomic_json(result_path, result)


def path_in(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def validate(spec: dict[str, Any], job_path: Path) -> None:
    if spec.get("jobSpecVersion") != 1:
        raise ValueError("unsupported jobSpecVersion")
    for key in ("jobId", "kind", "candidateId", "layerId", "language", "entrypoint", "sourceDirectory",
                "sourceFiles", "controls", "controlDeclarations", "randomSeed", "noiseSeed", "tick",
                "canvas", "limits", "workDirectory", "outputPath", "resultPath", "progressPath"):
        if key not in spec:
            raise ValueError(f"missing spec field: {key}")
    canvas = spec["canvas"]
    if not isinstance(canvas, dict) or (canvas.get("width"), canvas.get("height"), canvas.get("pixelDensity")) != (640, 640, 1):
        raise ValueError("canvas must be 640x640 at pixel density 1")
    if not isinstance(spec["tick"], int) or not 1 <= spec["tick"] <= 600:
        raise ValueError("tick must be in 1..600")
    limits = spec["limits"]
    if not isinstance(limits, dict):
        raise ValueError("limits must be an object")
    for key in ("renderSeconds", "compileSeconds", "heapMegabytes", "outputBytes", "queueSeconds"):
        if key not in limits or not isinstance(limits[key], (int, float)) or limits[key] <= 0:
            raise ValueError(f"invalid limit: {key}")
    for key in ("sourceDirectory", "workDirectory", "outputPath", "resultPath", "progressPath"):
        value = spec[key]
        if not isinstance(value, str) or not value:
            raise ValueError(f"missing path: {key}")
        if not Path(value).is_absolute():
            raise ValueError(f"path must be absolute: {key}")
    if not path_in(job_path, JOBS) or job_path.parent != JOBS:
        raise ValueError("job spec must be directly inside the jobs directory")
    if not path_in(Path(spec["sourceDirectory"]), ROOT / ".work" / "harness" / "artifacts"):
        raise ValueError("sourceDirectory outside harness artifacts")
    if not path_in(Path(spec["workDirectory"]), ROOT / ".work" / "harness" / "jobs"):
        raise ValueError("workDirectory outside harness jobs")
    for key in ("outputPath", "resultPath", "progressPath"):
        if not path_in(Path(spec[key]), ROOT / ".work" / "harness" / "jobs"):
            raise ValueError(f"{key} outside harness jobs")
    if not isinstance(spec["sourceFiles"], list) or not spec["sourceFiles"]:
        raise ValueError("sourceFiles must be non-empty")
    for record in spec["sourceFiles"]:
        if not isinstance(record, dict) or not isinstance(record.get("path"), str) or not isinstance(record.get("sha256"), str):
            raise ValueError("invalid sourceFiles entry")
        rel = Path(record["path"])
        if rel.is_absolute() or ".." in rel.parts:
            raise ValueError("source file path escapes sourceDirectory")
    if not isinstance(spec["entrypoint"], str) or not any(r["path"] == spec["entrypoint"] for r in spec["sourceFiles"]):
        raise ValueError("entrypoint is not in sourceFiles")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--job", required=True)
    parser.add_argument("--runner", required=True)
    args = parser.parse_args(argv)
    try:
        job_path = Path(args.job).resolve()
        if not path_in(job_path, JOBS) or job_path.parent != JOBS:
            raise ValueError("job spec must be directly inside the jobs directory")
        spec = json.loads(job_path.read_text(encoding="utf-8"))
        if not isinstance(spec, dict):
            raise ValueError("job spec must be an object")
        validate(spec, job_path)
        runner = Path(args.runner)
        if runner.is_absolute() or not path_in(ROOT / runner, ROOT) or not (ROOT / runner).is_file():
            raise ValueError("runner must be a relative repository path")
        runner = (ROOT / runner).resolve()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"queue_render: {exc}", file=sys.stderr)
        return 2

    progress = Path(spec["progressPath"])
    result = Path(spec["resultPath"])
    atomic_json(progress, {"state": "queued", "note": "waiting for native render lease"})
    deadline = time.monotonic() + float(spec["limits"]["queueSeconds"])
    command_name = "node" if runner.suffix == ".mjs" else "python3" if runner.suffix == ".py" else None
    if command_name is None:
        fail_result(spec, "UNSUPPORTED_CAPABILITY", "unsupported runner type")
        return 1
    wrapper = ROOT / "tools" / "with_native_render_lock.py"
    child: subprocess.Popen[bytes] | None = None
    interrupted: int | None = None

    def interrupted_handler(signum: int, _frame: Any) -> None:
        nonlocal interrupted
        interrupted = signum
        if child is not None and child.poll() is None:
            try:
                os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

    old_term = signal.signal(signal.SIGTERM, interrupted_handler)
    old_int = signal.signal(signal.SIGINT, interrupted_handler)
    try:
        while True:
            remaining = deadline - time.monotonic()
            if interrupted is not None:
                fail_result(spec, "JOB_CANCELLED", "render cancelled by signal")
                return 128 + interrupted
            if remaining <= 0:
                fail_result(spec, "RESOURCE_EXHAUSTED", "native render queue time exceeded")
                return 1
            # The wrapper's timeout is a safety net; the runner enforces renderSeconds itself.
            wrapper_timeout = min(3600.0, max(30.0, float(spec["limits"]["renderSeconds"]) + 15.0))
            cmd = [sys.executable, str(wrapper), "--timeout", str(wrapper_timeout), "--", command_name, str(runner), "--job", str(job_path)]
            child = subprocess.Popen(cmd, cwd=ROOT, start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            try:
                stdout, stderr = child.communicate(timeout=min(0.30, max(0.05, remaining)))
                text = (stdout + stderr).decode("utf-8", "replace")
                if "Native renderer busy" in text and time.monotonic() < deadline and interrupted is None:
                    time.sleep(min(2.0, max(0.0, deadline - time.monotonic())))
                    continue
                if interrupted is not None:
                    break
                atomic_json(progress, {"state": "running", "note": "native render lease acquired"})
                if not result.exists():
                    fail_result(spec, "RUNTIME_FAILURE", "runner exited without a result", bounded_lines(text))
                return child.returncode or (0 if result.exists() else 1)
            except subprocess.TimeoutExpired:
                atomic_json(progress, {"state": "running", "note": "native render lease acquired"})
                while child.poll() is None:
                    if interrupted is not None:
                        break
                    time.sleep(0.05)
                if child.poll() is None:
                    try:
                        os.killpg(child.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                stdout, stderr = child.communicate()
                if interrupted is not None:
                    if not result.exists():
                        fail_result(spec, "JOB_CANCELLED", "render cancelled by signal", bounded_lines((stdout + stderr).decode("utf-8", "replace")))
                    return 128 + interrupted
                if not result.exists():
                    fail_result(spec, "RUNTIME_FAILURE", "runner exited without a result", bounded_lines((stdout + stderr).decode("utf-8", "replace")))
                return child.returncode or 0
    finally:
        signal.signal(signal.SIGTERM, old_term)
        signal.signal(signal.SIGINT, old_int)
        if not result.exists() and interrupted is not None:
            fail_result(spec, "JOB_CANCELLED", "render cancelled by signal")


if __name__ == "__main__":
    raise SystemExit(main())
