#!/usr/bin/env python3
"""Prepare or run the single registered py5 PathMarks native validation attempt."""
from __future__ import annotations

import argparse
import ast
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_grid_conformance import java_home


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")
    temporary.replace(path)


def sources(environment: Path) -> list[Path]:
    site = next((environment / "lib").glob("python*/site-packages"), None)
    if site is None:
        raise RuntimeError("pinned py5 site-packages is unavailable")
    required = [
        ROOT / "tools/run_py5_path_marks.py",
        ROOT / "tests/native/py5_path_marks.py",
        ROOT / "evidence/reproductions/cp2-py5/plan.json",
        ROOT / "evidence/reproductions/cp2-java2d/pde-plan.json",
        ROOT / "design/capabilities/cp2-public-example.md",
        ROOT / "catalog/operations/gradient-path.json",
        ROOT / "fixtures/operations/gradient-path.json",
        ROOT / "packages/python/examples/path_marks/sketch.py",
        ROOT / "packages/python/examples/path_marks/path_marks.py",
        *sorted((ROOT / "packages/python/procedurals").glob("*.py")),
        *[site / "py5" / part for part in ("__init__.py", "graphics.py", "sketch.py", "base.py", "mixins/pixels.py", "jars/core.jar", "jars/py5.jar")],
        environment / "pyvenv.cfg",
    ]
    for path in required:
        if not path.is_file():
            raise RuntimeError(f"required input missing: {path}")
    return required


def validate_plan(plan: dict[str, object]) -> None:
    states = plan.get("states")
    if (plan.get("attempt_budget"), plan.get("composition_budget")) != (1, 7) or not isinstance(states, list) or len(states) != 7:
        raise RuntimeError("unexpected PathMarks attempt registration")
    expected = [("marks", "setup", 12000, 7002), ("trace", "m", 48000, 27784), ("marks-replay", "m", 12000, 7002),
                ("long-marks", "l", 12000, 7057), ("palette", "c", 12000, 7057), ("count", "n", 12024, 7066), ("distance", "d", 12024, 5500)]
    actual = [(row.get("id"), row.get("trigger"), row.get("raw_commands"), row.get("submitted_commands")) for row in states]
    if actual != expected:
        raise RuntimeError("PathMarks states no longer match the reviewed desktop sequence")
    if plan.get("visual_images") != ["marks.png", "trace.png", "long-marks.png"]:
        raise RuntimeError("unexpected visual artifact registration")
    desktop = json.loads((ROOT / "evidence/reproductions/cp2-java2d/pde-plan.json").read_text())
    desktop_states = desktop.get("states")
    if not isinstance(desktop_states, list) or len(desktop_states) != 7:
        raise RuntimeError("desktop PathMarks plan has no seven-state sequence")
    shared_keys = ("id", "trigger", "trace", "length", "alternate", "steps", "distance")
    for py5_state, desktop_state in zip(states, desktop_states):
        if any(py5_state.get(key) != desktop_state.get(key) for key in shared_keys):
            raise RuntimeError("py5 PathMarks plan diverges from the registered desktop state sequence")


def terminate(process: subprocess.Popen[str]) -> None:
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def _intersects_example_canvas(command: dict[str, object]) -> bool:
    start, end = command["from"], command["to"]
    return not (max(start[0], end[0]) < -1.0 or min(start[0], end[0]) > 641.0 or
                max(start[1], end[1]) < -1.0 or min(start[1], end[1]) > 641.0)


def pure_preflight(plan: dict[str, object]) -> list[dict[str, object]]:
    """Validate every submitted example command without starting py5 or a renderer."""
    example = ROOT / "packages/python/examples/path_marks"
    library = ROOT / "packages/python"
    sys.path[:0] = [str(example), str(library)]
    from path_marks import (ALTERNATE_PALETTE, BASE_PALETTE, create_path_marks,
                            path_mark_commands, visible_path_mark_commands)
    from procedurals._drawing import normalize_command, validate_environment

    environment = validate_environment({"width": 640, "height": 640, "density": 1, "background": 0xECE7DA})
    models: dict[tuple[int, float], object] = {}
    records: list[dict[str, object]] = []
    for state in plan["states"]:
        key = (state["steps"], state["distance"])
        if key not in models:
            models[key] = create_path_marks(steps=state["steps"], distance=state["distance"])
        model = models[key]
        colors = ALTERNATE_PALETTE if state["alternate"] else BASE_PALETTE
        raw = path_mark_commands(model, trace=state["trace"], mark_length=state["length"], colors=colors)
        submitted = iter(visible_path_mark_commands(model, trace=state["trace"], mark_length=state["length"], colors=colors))
        next_submitted = next(submitted, None)
        raw_count = submitted_count = omitted = 0
        first_index = last_index = None
        minimum_x = minimum_y = float("inf")
        maximum_x = maximum_y = float("-inf")
        for raw_index, command in enumerate(raw):
            raw_count += 1
            visible = _intersects_example_canvas(command)
            if not visible:
                omitted += 1
                continue
            if command != next_submitted:
                raise AssertionError(f"{state['id']}: visible command order/content diverged at raw index {raw_index}")
            normalized = normalize_command(next_submitted, environment)
            if normalized["outcome"] != "emit":
                raise AssertionError(f"{state['id']}: retained command is not emitted")
            for point in normalized["points"]:
                if not (-25.0 <= point[0] <= 665.0 and -25.0 <= point[1] <= 665.0):
                    raise AssertionError(f"{state['id']}: retained endpoint exceeds registered bounded proof")
                minimum_x, minimum_y = min(minimum_x, point[0]), min(minimum_y, point[1])
                maximum_x, maximum_y = max(maximum_x, point[0]), max(maximum_y, point[1])
            if last_index is not None and raw_index <= last_index:
                raise AssertionError(f"{state['id']}: retained raw indices are not strictly ordered")
            if first_index is None:
                first_index = raw_index
            last_index = raw_index
            submitted_count += 1
            next_submitted = next(submitted, None)
        if next_submitted is not None:
            raise AssertionError(f"{state['id']}: culler emitted a command not found in raw order")
        if raw_count != state["raw_commands"] or submitted_count != state["submitted_commands"]:
            raise AssertionError(f"{state['id']}: raw/submitted command count does not match registration")
        if omitted != raw_count - submitted_count:
            raise AssertionError(f"{state['id']}: omitted command accounting failed")
        records.append({"id": state["id"], "raw_commands": raw_count, "submitted_commands": submitted_count,
                        "omitted_commands": omitted, "first_submitted_raw_index": first_index,
                        "last_submitted_raw_index": last_index, "normalizer": "all submitted commands emitted",
                        "omitted_bbox_disjoint": True, "ordered_raw_subsequence": True,
                        "submitted_endpoint_bounds": [minimum_x, minimum_y, maximum_x, maximum_y]})
    return records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true", help="reserve and execute the one native attempt")
    parser.add_argument("--java-home")
    args = parser.parse_args()
    environment = ROOT / ".work/environments/py5"
    plan_path = ROOT / "evidence/reproductions/cp2-py5/plan.json"
    plan = json.loads(plan_path.read_text())
    validate_plan(plan)
    inputs = {str(path.relative_to(ROOT)): digest(path) for path in sources(environment)}
    for path in (ROOT / "tools/run_py5_path_marks.py", ROOT / "tests/native/py5_path_marks.py", ROOT / "packages/python/examples/path_marks/sketch.py", ROOT / "packages/python/examples/path_marks/path_marks.py"):
        ast.parse(path.read_text())
    pure = pure_preflight(plan)
    if {str(path.relative_to(ROOT)): digest(path) for path in sources(environment)} != inputs:
        raise RuntimeError("inputs changed during pure PathMarks preflight")
    if not args.render:
        print(json.dumps({"prepared": True, "scope": "syntax and pure drawing preflight only; no py5 launch or rendering", "input_sha256": inputs,
                          "pure_preflight": pure}, sort_keys=True))
        return 0

    output = ROOT / str(plan["output"])
    output.mkdir(parents=True, exist_ok=True)
    attempt = output / "attempt.json"
    if attempt.exists():
        raise RuntimeError("attempt already reserved; inspect its terminal evidence before any new run")
    if list(output.glob("*.png")):
        raise RuntimeError("stale image outputs exist before attempt; preserve and inspect them")
    lock_path = ROOT / ".work/processing-render.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with attempt.open("x") as stream:
            json.dump({"status": "reserved", "composition_budget": 7, "input_sha256": inputs}, stream, indent=2, sort_keys=True)
        report: dict[str, object] = {"status": "failed", "scope": plan["scope"], "input_sha256": inputs, "visual_review": "pending"}
        process: subprocess.Popen[str] | None = None
        try:
            home = java_home(args.java_home)
            jvm_home = output / "jvm-home"
            jvm_home.mkdir(exist_ok=True)
            environment_values = dict(os.environ, JAVA_HOME=str(home), JAVA_TOOL_OPTIONS=f"-Dsun.java2d.uiScale=2 -Duser.home={jvm_home}")
            stdout_path, stderr_path = output / "stdout.log", output / "stderr.log"
            with stdout_path.open("w") as stdout, stderr_path.open("w") as stderr:
                process = subprocess.Popen(
                    ["xvfb-run", "-a", str(environment / "bin/python"), str(ROOT / "tests/native/py5_path_marks.py")],
                    cwd=ROOT, env=environment_values, stdout=stdout, stderr=stderr, text=True, start_new_session=True,
                )
                try:
                    code = process.wait(timeout=int(plan["timeout_seconds"]))
                except subprocess.TimeoutExpired as error:
                    terminate(process)
                    raise RuntimeError("py5 PathMarks attempt timed out") from error
            stdout_text, stderr_text = stdout_path.read_text(), stderr_path.read_text()
            report.update(exit_code=code, stdout=stdout_text, stderr=stderr_text)
            records = [line.removeprefix("PROCEDURALS_RESULT=") for line in stdout_text.splitlines() if line.startswith("PROCEDURALS_RESULT=")]
            if len(records) != 1:
                raise AssertionError("expected exactly one native py5 result")
            native = json.loads(records[0])
            report["native"] = native
            if code != 0 or native.get("passed") is not True:
                raise AssertionError("py5 PathMarks native assertions failed")
            if native.get("py5") != plan["runtime"]["py5"] or native.get("java") != plan["runtime"]["java"]:
                raise AssertionError("unexpected pinned py5/JDK runtime")
            states = native.get("native", {}).get("states")
            if not isinstance(states, list) or [(row.get("id"), row.get("raw_commands"), row.get("submitted_commands")) for row in states] != [
                (row["id"], row["raw_commands"], row["submitted_commands"]) for row in plan["states"]
            ]:
                raise AssertionError("native state or command registration is incomplete")
            checks = ("retained_style_edits", "movement_rebuilt", "count_prefix", "distance_feedback", "marks_replay_pixels")
            native_details = native["native"]
            if native_details.get("compositions") != 7 or any(native_details.get(check) is not True for check in checks):
                raise AssertionError("native retained-movement checks are incomplete")
            saved = native_details.get("save")
            quiet_ms = saved.get("quiet_ms") if isinstance(saved, dict) else None
            if not isinstance(saved, dict) or saved.get("path") != "path-marks.png" or saved.get("pixels_equal_displayed") is not True or type(quiet_ms) not in (int, float) or not math.isfinite(quiet_ms) or quiet_ms < 300:
                raise AssertionError("native cached-save/quiet checks are incomplete")
            images = native_details.get("images")
            if not isinstance(images, dict) or set(images) != set(plan["visual_images"]):
                raise AssertionError("native visual artifact set is incomplete")
            for relative, metadata in images.items():
                artifact = output / relative
                if not artifact.is_file() or digest(artifact) != metadata.get("png_sha256"):
                    raise AssertionError(f"visual artifact binding failed: {relative}")
            if {str(path.relative_to(ROOT)): digest(path) for path in sources(environment)} != inputs:
                raise RuntimeError("inputs changed during native attempt")
            report["status"] = "passed"
        except BaseException as error:
            report["error"] = str(error)
        finally:
            if process is not None:
                terminate(process)
            write_json(ROOT / "evidence/reproductions/cp2-py5/result.json", report)
            write_json(attempt, {"status": report["status"], "composition_budget": 7, "input_sha256": inputs})
    print(json.dumps({"status": report["status"], "error": report.get("error"), "visual_review": report["visual_review"]}, sort_keys=True))
    return 0 if report["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
