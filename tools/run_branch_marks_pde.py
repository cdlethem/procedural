#!/usr/bin/env python3
"""Compile or execute the root-registered installed BranchMarks PDE attempt."""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tools.run_grid_conformance import java_home, run

IDS = ["initial", "extended", "extended-restored", "narrowing", "reset-1", "wide", "reset-2",
       "binary", "reset-3", "recolour", "thin", "forest", "forest-taper", "forest-palette",
       "forest-extended", "forest-seed", "final-reset"]
KEYS = ['n','n','g','0','w','0','b','0','c','m','x','m','c','n','r','0','s']


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def require_plan(plan: dict) -> None:
    if plan.get("attempt_budget") != 1 or plan.get("composition_budget") != 17 or plan.get("key_event_budget") != 17:
        raise RuntimeError("unexpected CP6 BranchMarks attempt registration")
    if plan.get("timeout_seconds") != 180 or plan.get("key_sequence") != KEYS:
        raise RuntimeError("unexpected CP6 BranchMarks timing/key registration")
    states = plan.get("states")
    if not isinstance(states, list) or [state.get("id") for state in states] != IDS:
        raise RuntimeError("unexpected CP6 BranchMarks state sequence")
    if plan.get("captured_images") != [identifier + ".png" for identifier in IDS]:
        raise RuntimeError("unexpected CP6 BranchMarks captured image sequence")
    if plan.get("per_state_segment_limit") != 20000 or plan.get("segment_visit_budget") != 350000:
        raise RuntimeError("unexpected CP6 BranchMarks segment guards")
    if not isinstance(plan.get("reviewed_input_sha256"), dict) or not plan["reviewed_input_sha256"]:
        raise RuntimeError("root-reviewed immutable inputs are required before rendering")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--render", action="store_true", help="consume the root-registered one-attempt budget")
    parser.add_argument("--java-home")
    parser.add_argument("--library-jar", type=Path,
                        default=ROOT / ".work/dist/cp6/java/consumer/procedurals/library/procedurals.jar")
    parser.add_argument("--distribution-report", type=Path,
                        default=ROOT / "evidence/distribution/cp6-java.json")
    parser.add_argument("--plan", type=Path,
                        default=ROOT / "evidence/reproductions/cp6-java2d/pde-plan.json")
    args = parser.parse_args()
    home = java_home(args.java_home)
    library, distribution = args.library_jar.resolve(), args.distribution_report.resolve()
    if not library.is_file() or not distribution.is_file():
        raise RuntimeError("installed CP6 library and its passed distribution report are required")
    plan_path = args.plan.resolve()
    if args.render:
        if not plan_path.is_file(): raise RuntimeError("root has not registered a CP6 BranchMarks render plan")
        plan_path.relative_to(ROOT)
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        require_plan(plan)
    else:
        plan = None

    build_report_path = ROOT / ".work/build/branch-marks-pde-installed/report.json"
    run([sys.executable, ROOT / "tools/check_branch_marks_pde.py", "--java-home", home,
         "--library-jar", library, "--distribution-report", distribution, "--output", build_report_path])
    build_report = json.loads(build_report_path.read_text(encoding="utf-8"))
    if build_report.get("status") != "passed" or build_report.get("installed_library", {}).get("sha256") != digest(library):
        raise RuntimeError("installed BranchMarks PDE build did not bind requested JAR")
    build = ROOT / build_report["build"]
    core = ROOT / ".work/toolchains/processing-4.5.6/core-4.5.6.jar"
    probe = ROOT / "tests/native/BranchMarksPdeProbe.java"
    classpath = os.pathsep.join(map(str, (build, core, library)))
    run([home / "bin/javac", "--release", "17", "-cp", classpath, "-d", build, probe])
    bindings = dict(build_report["input_sha256_before"])
    if bindings != build_report.get("input_sha256_after"):
        raise RuntimeError("installed PDE inputs changed during preprocessing")
    for path in (probe, Path(__file__).resolve(), build_report_path, ROOT / "tools/run_grid_conformance.py"):
        bindings[str(path.relative_to(ROOT))] = digest(path)
    if not args.render:
        print(json.dumps({"status": "built", "scope": "actual extracted installed-JAR BranchMarks PDE and probe compilation only; no native render attempted",
                          "build_report": str(build_report_path.relative_to(ROOT)), "core_sha256": digest(library)}))
        return

    for relative, expected in plan["reviewed_input_sha256"].items():
        if digest(ROOT / relative) != expected: raise RuntimeError("reviewed input changed: " + relative)
    if any(plan["reviewed_input_sha256"].get(relative) != expected for relative, expected in bindings.items()):
        raise RuntimeError("render plan does not bind every current installed build/probe input")
    output = ROOT / plan["output"]
    output.relative_to(ROOT)
    attempt, result = output / "attempt.json", ROOT / plan["result"]
    if attempt.exists(): raise RuntimeError("attempt already reserved; preserve it for review")
    names = [*plan["captured_images"], "displayed-final.png", "native.json", "progress.json"]
    stale = [output / name for name in names if (output / name).exists()]
    stale += list(output.glob("branch-marks-*.png"))
    if stale: raise RuntimeError("pre-existing BranchMarks output; preserve it rather than overwrite")
    output.mkdir(parents=True, exist_ok=True)
    lock_path = ROOT / ".work/processing-render.lock"; lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with attempt.open("x", encoding="utf-8") as handle:
            json.dump({"status": "reserved", "composition_budget": 17, "key_event_budget": 17,
                       "segment_visit_budget": 350000, "input_sha256": bindings}, handle, indent=2)
        report = {"status": "failed", "scope": plan.get("scope"), "input_sha256": bindings, "visual_review": "pending"}
        process = None
        stdout, stderr = output / "stdout.log", output / "stderr.log"
        try:
            with stdout.open("w", encoding="utf-8") as out, stderr.open("w", encoding="utf-8") as err:
                process = subprocess.Popen(["xvfb-run", "-a", str(home / "bin/java"),
                    "-Duser.home=" + str(build / "home"), "-Dprocedurals.expectedCore=" + str(library),
                    "-cp", classpath, "BranchMarksPdeProbe", str(output)], cwd=ROOT, stdout=out, stderr=err,
                    start_new_session=True)
                write(attempt, {"status": "running", "pid": process.pid, "composition_budget": 17,
                                "key_event_budget": 17, "segment_visit_budget": 350000, "input_sha256": bindings})
                try: exit_code = process.wait(timeout=plan["timeout_seconds"])
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL); process.wait()
                    raise RuntimeError("BranchMarks PDE attempt timed out")
            report.update(exit_code=exit_code, stdout=stdout.read_text(encoding="utf-8"), stderr=stderr.read_text(encoding="utf-8"))
            if exit_code != 0 or report["stderr"].strip(): raise RuntimeError("BranchMarks probe failed or emitted stderr")
            native = json.loads((output / "native.json").read_text(encoding="utf-8"))
            expected = {"status": "passed", "compositions": 17, "key_events": 17, "style_reuses_composition": True,
                        "append_rule_prefix": True, "topology_checked": True, "reset_pixel_replay": True}
            for key, value in expected.items():
                if native.get(key) != value: raise RuntimeError("native proof missing: " + key)
            states = native.get("states")
            if not isinstance(states, list) or [state.get("id") for state in states] != IDS:
                raise RuntimeError("native state coverage mismatch")
            for actual, expected_state in zip(states, plan["states"]):
                for field in ("trees", "segments", "generated_segments", "drawn_lines", "terminal_scan_visits", "terminal_dots"):
                    if actual.get(field) != expected_state.get(field):
                        raise RuntimeError("state work accounting differs: " + actual["id"] + "/" + field)
            for field, state_field in (("generated_segments", "generated_segments"), ("drawn_lines", "drawn_lines"),
                                       ("terminal_scan_visits", "terminal_scan_visits"), ("actual_terminal_dots", "terminal_dots")):
                if native.get(field) != sum(state[state_field] for state in states) or native.get(field) != plan["expected_counts"][field]:
                    raise RuntimeError("native total accounting differs: " + field)
            visits = sum(state.get("drawn_lines", -1) for state in states)
            if visits > 350000 or any(not isinstance(state.get("segments"), int) or not 0 <= state["segments"] <= 20000
                                     or state.get("drawn_lines") != state["segments"] for state in states):
                raise RuntimeError("native segment budget exceeded")
            if native.get("save_quiet_ms", 0) < 300: raise RuntimeError("save quiet observation incomplete")
            from PIL import Image
            images = {}
            for name in [*plan["captured_images"], "displayed-final.png"]:
                image = output / name
                with Image.open(image) as loaded:
                    rgba = loaded.convert("RGBA")
                    if rgba.size != (640, 640) or rgba.getchannel("A").getextrema() != (255, 255):
                        raise RuntimeError("invalid image: " + name)
                images[name] = {"path": str(image.relative_to(ROOT)), "sha256": digest(image)}
            saved = list(output.glob("branch-marks-*.png"))
            if len(saved) != 1: raise RuntimeError("expected exactly one S-key save")
            with Image.open(saved[0]) as saved_image, Image.open(output / "displayed-final.png") as displayed:
                if saved_image.size != displayed.size or saved_image.convert("RGBA").tobytes() != displayed.convert("RGBA").tobytes():
                    raise RuntimeError("S-key save does not equal displayed final pixels")
            for relative, expected_hash in bindings.items():
                if digest(ROOT / relative) != expected_hash: raise RuntimeError("input changed during attempt: " + relative)
            report.update(status="passed", native=native, images=images,
                          input_sha256_after={relative: digest(ROOT / relative) for relative in bindings},
                          segment_visits=visits, save={"path": str(saved[0].relative_to(ROOT)), "sha256": digest(saved[0]),
                                                     "matches_displayed_pixels": True})
        except Exception as error:
            report["error"] = str(error)
        finally:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL); process.wait()
            write(result, report)
            write(attempt, {"status": report["status"], "composition_budget": 17, "key_event_budget": 17,
                            "segment_visit_budget": 350000, "input_sha256": bindings})
        print(json.dumps({"status": report["status"], "error": report.get("error"), "visual_review": report["visual_review"]}))
        if report["status"] != "passed": raise SystemExit(1)


if __name__ == "__main__":
    main()
