#!/usr/bin/env python3
"""Check CP3's two registered private controls, or render one ordered control image.

This executor never changes the frozen CP3 prototype or its first experiment. Each
control is one verified textual substitution in a distinct ignored source/build tree.
"""
from __future__ import annotations

import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[3]


def load_module(name: str, path: Path) -> Any:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot import required local helper: " + str(path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


BASE_EXECUTOR = load_module("cp3_base_executor", ROOT / "tools/diagnostics/cp3/run-spacing-choice.py")
STREAM = load_module("cp3_controls_stream", ROOT / "tools/diagnostics/cp3/stream_oracle.py")
ACCEPTANCE = load_module("cp3_controls_acceptance", ROOT / "tools/diagnostics/cp3/check-acceptance.py")

PLAN_PATH = ROOT / "evidence/parameter-experiments/cp3-placement-controls/experiment.json"
ORIGINAL_PLAN = ROOT / "evidence/parameter-experiments/cp3-placement/experiment.json"
ORIGINAL_RESULT = ROOT / "evidence/parameter-experiments/cp3-placement/result.json"
ORIGINAL_IMAGE = ROOT / ".work/experiments/cp3-placement/base-rings.png"
SOURCE = ROOT / "tools/diagnostics/cp3/SpacingChoice.java"
ORACLE_SCRIPT = ROOT / "tools/diagnostics/cp3/stream_oracle.py"
ORACLE_REPORT = ROOT / "evidence/investigations/cp3-stream-oracle.json"
ACCEPTANCE_SCRIPT = ROOT / "tools/diagnostics/cp3/check-acceptance.py"
ACCEPTANCE_REPORT = ROOT / "evidence/investigations/cp3-acceptance.json"
REPORT_PATH = ROOT / "evidence/parameter-experiments/cp3-placement-controls/result.json"
BUILD = ROOT / ".work/build/cp3-placement-controls"
OUTPUT = ROOT / ".work/experiments/cp3-placement-controls"
CASES = ["larger-minimum", "more-attempts"]


def sha(path: Path) -> str:
    return BASE_EXECUTOR.sha(path)


def write(path: Path, value: Any) -> None:
    BASE_EXECUTOR.write(path, value)


def root_path(value: str, label: str) -> Path:
    return BASE_EXECUTOR.root_path(value, label)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def verify_baseline(plan: dict[str, Any]) -> dict[str, Any]:
    baseline = plan.get("baseline")
    require(isinstance(baseline, dict), "controls plan lacks baseline")
    exact = {
        "image": ORIGINAL_IMAGE,
        "result": ORIGINAL_RESULT,
        "configuration": ORIGINAL_PLAN,
    }
    for key, path in exact.items():
        digest = baseline.get(key + "_sha256")
        require(path.exists() and isinstance(digest, str) and sha(path) == digest, "preserved baseline binding is stale: " + key)
    require(sha(SOURCE) == plan.get("prototype", {}).get("source_sha256"), "frozen prototype source binding differs")
    result = json.loads(ORIGINAL_RESULT.read_text(encoding="utf-8"))
    require(result.get("status") == "rendering_complete", "original CP3 experiment is not complete")
    original_inputs = result.get("input_sha256")
    require(isinstance(original_inputs, dict) and original_inputs, "original CP3 result lacks its input closure")
    for relative, digest in original_inputs.items():
        path = root_path(relative, "original result input")
        require(path.exists() and isinstance(digest, str) and sha(path) == digest, "original CP3 input closure is stale: " + relative)
    attempts = result.get("attempts")
    require(isinstance(attempts, list) and len(attempts) == 5 and all(item.get("status") == "rendered" for item in attempts), "original CP3 attempts are incomplete")
    require([item.get("case") for item in attempts] == BASE_EXECUTOR.EXPECTED_CASES, "original CP3 journal order differs")
    for item in attempts:
        image = item.get("image")
        require(isinstance(image, dict) and isinstance(image.get("path"), str), "original CP3 image journal is incomplete")
        path = root_path(image["path"], "original CP3 image")
        require(path.exists() and isinstance(image.get("sha256"), str) and sha(path) == image["sha256"], "original CP3 image changed: " + item["case"])
    original_profile = result.get("numeric", {}).get("profiles", {}).get("base-rings")
    require(isinstance(original_profile, dict), "original base-rings numeric profile is missing")
    require(any(item.get("case") == "base-rings" and item.get("image", {}).get("sha256") == baseline["image_sha256"] for item in attempts), "original baseline image journal differs")
    return original_profile


def verify_reference_reports() -> None:
    # Reuse the frozen executor's strict nested report/binding validation, without relying
    # on its mutable module globals for paths, builds, or output journals.
    BASE_EXECUTOR.read_and_verify_oracles()
    BASE_EXECUTOR.read_and_verify_acceptance()


def source_inputs(plan: dict[str, Any], processing: Path) -> dict[str, str]:
    original = json.loads(ORIGINAL_RESULT.read_text(encoding="utf-8"))
    closure = original.get("input_sha256")
    require(isinstance(closure, dict) and closure, "original CP3 result lacks input closure")
    closure_paths = [root_path(relative, "original result input") for relative in sorted(closure)]
    image_paths = [root_path(item["image"]["path"], "original CP3 image") for item in original.get("attempts", [])]
    paths = [PLAN_PATH, ORIGINAL_PLAN, ORIGINAL_RESULT, ORIGINAL_IMAGE, SOURCE, Path(__file__).resolve(),
             ROOT / "tools/diagnostics/cp3/run-spacing-choice.py", ORACLE_SCRIPT, ORACLE_REPORT,
             ACCEPTANCE_SCRIPT, ACCEPTANCE_REPORT, processing, *closure_paths, *image_paths]
    return {path.relative_to(ROOT).as_posix(): sha(path) for path in paths}


def substitute(case: dict[str, Any], bound: dict[str, str]) -> tuple[Path, str]:
    case_id = case["id"]
    substitution = case.get("substitution")
    require(isinstance(substitution, dict), "case substitution is missing")
    old, new, count = substitution.get("from"), substitution.get("to"), substitution.get("occurrences")
    require(isinstance(old, str) and isinstance(new, str) and count == 1, "only one exact source substitution is permitted")
    original = SOURCE.read_text(encoding="utf-8")
    require(original.count(old) == count, f"source substitution occurrence count differs for {case_id}")
    changed = original.replace(old, new, count)
    require(changed.count(old) == 0 and changed.count(new) >= 1 and changed != original, "source substitution did not change source")
    case_dir = BUILD / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    temporary = case_dir / "SpacingChoice.java"
    if temporary.exists():
        require(temporary.read_text(encoding="utf-8") == changed, "existing generated source differs from the frozen one-occurrence substitution")
    else:
        temporary.write_text(changed, encoding="utf-8")
    return temporary, sha(temporary)


def classes(case_id: str) -> dict[str, str]:
    case_dir = BUILD / case_id
    return {path.relative_to(case_dir).as_posix(): sha(path) for path in sorted(case_dir.glob("SpacingChoice*.class"))}


def profile_reference(config: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], list[tuple[Any, ...]]]:
    required = {"seed", "attempts", "centre_rectangle", "radius_min", "radius_max", "separation_scale"}
    require(set(config) == required, "control configuration schema differs")
    proposal_config = {
        "seed": config["seed"], "attempts": config["attempts"], "centre_rectangle": config["centre_rectangle"],
        "radius_min": config["radius_min"], "radius_max": config["radius_max"],
    }
    proposal = STREAM.proposal_reference(proposal_config)
    kept, accepted = ACCEPTANCE.accepted(proposal_config, config["separation_scale"])
    return proposal, accepted, kept


def validate_native_profile(profile: Any, config: dict[str, Any], baseline: dict[str, Any], case_id: str) -> dict[str, Any]:
    require(isinstance(profile, dict) and profile.get("id") == "base-rings", case_id + " native base profile missing")
    require(profile.get("attempts") == config["attempts"], case_id + " native attempt count differs")
    proposal, accepted, kept = profile_reference(config)
    expected = {
        "candidate_sha256": proposal["candidates_sha256_struct_be_f64_xyz"],
        "centres_sha256": proposal["centres_sha256_struct_be_f64_xy"],
        "final_rng_state": proposal["final_state"],
        "accepted_count": accepted["accepted_count"],
        "comparisons": accepted["comparisons"],
        "accepted_sha256": accepted["accepted_sha256"],
    }
    for key, value in expected.items():
        require(profile.get(key) == value, f"{case_id} differs from independent Python reference: {key}")
    for key in ("candidate_sha256", "centres_sha256", "accepted_sha256", "colour_sha256", "model_vertex_sha256"):
        require(isinstance(profile.get(key), str) and len(profile[key]) == 64, f"{case_id} has malformed {key}")
    require(profile.get("palette_assignment") == "source_index_modulo_5", case_id + " no longer assigns colours by original proposal index")
    require(profile.get("render_vertex_conversion") == "binary64 model expressions cast to Java float at vertex submission", case_id + " vertex conversion differs")
    candidate_prefix_matches_original = None
    accepted_prefix_and_source_index_colours_preserved = None
    if case_id == "larger-minimum":
        require(profile["centres_sha256"] == baseline["centres_sha256"], "minimum-radius edit changed centre proposals")
    elif case_id == "more-attempts":
        baseline_config = {"seed": 42, "attempts": 5000, "centre_rectangle": {"origin": [64, 64], "size": [512, 512]}, "radius_min": 4, "radius_max": 64, "separation_scale": 1}
        prefix_proposal, baseline_accepted, baseline_kept = profile_reference(baseline_config)
        candidate_prefix_matches_original = (prefix_proposal["candidates_sha256_struct_be_f64_xyz"] == baseline["candidate_sha256"] and prefix_proposal["centres_sha256_struct_be_f64_xy"] == baseline["centres_sha256"] and prefix_proposal["final_state"] == baseline["final_rng_state"])
        require(candidate_prefix_matches_original, "independent 10000 candidate prefix differs from original 5000 candidate digest/state")
        require(baseline_accepted["accepted_sha256"] == baseline["accepted_sha256"], "existing 5000 baseline acceptance no longer matches Python")
        require(kept[:len(baseline_kept)] == baseline_kept, "10000 accepted records do not retain the exact 5000 prefix")
        require(len(kept) >= len(baseline_kept), "10000 accepted count cannot be shorter than preserved prefix")
        accepted_prefix_and_source_index_colours_preserved = (len(kept) >= len(baseline_kept) and all(new == old and (new[0] % 5) == (old[0] % 5) for new, old in zip(kept, baseline_kept)))
        require(accepted_prefix_and_source_index_colours_preserved, "10000 prefix changed original source-index colour assignments")
    else:
        raise RuntimeError("unregistered controls case")
    return {"proposal": proposal, "accepted": accepted, "accepted_records": len(kept), "candidate_prefix_5000_matches_original": candidate_prefix_matches_original, "accepted_prefix_and_source_index_colours_preserved": accepted_prefix_and_source_index_colours_preserved}


def prepare_case(case: dict[str, Any], plan: dict[str, Any], processing: Path, bound: dict[str, str], baseline: dict[str, Any], home: Path) -> dict[str, Any]:
    case_id = case["id"]
    temporary_source, generated_sha = substitute(case, bound)
    case_dir = BUILD / case_id
    cache_path = case_dir / "numeric.json"
    local_inputs = {**bound, temporary_source.relative_to(ROOT).as_posix(): generated_sha}
    cached = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    current_classes = classes(case_id)
    recorded = [item for _, item in attempts() if item.get("case") == case_id]
    if recorded:
        require(len(recorded) == 1, "duplicate control attempt")
        journal = recorded[0]
        require(cached.get("input_sha256") == local_inputs and current_classes
                and cached.get("class_sha256") == current_classes
                and journal.get("class_sha256") == current_classes
                and journal.get("generated_input_sha256") == local_inputs,
                "attempted control source/cache/classes changed; refusing repair")
    if cached.get("input_sha256") == local_inputs and current_classes and cached.get("class_sha256") == current_classes:
        numeric = cached.get("native")
        require(isinstance(numeric, dict), case_id + " cache lacks numeric JSON")
        cache_hit = True
        compiler_stderr, numeric_stderr = cached.get("compiler_stderr", ""), cached.get("numeric_stderr", "")
    else:
        for path in case_dir.glob("SpacingChoice*.class"):
            path.unlink()
        cache_path.unlink(missing_ok=True)
        compiler = subprocess.run([str(home / "bin/javac"), "--release", "8", "-cp", str(processing), "-d", str(case_dir), str(temporary_source)], text=True, capture_output=True, timeout=60)
        if compiler.returncode:
            raise RuntimeError(f"{case_id} compile failed\nstdout:\n{compiler.stdout}\nstderr:\n{compiler.stderr}")
        command = [str(home / "bin/java"), "-Duser.home=" + str(OUTPUT / "home"), "-Djava.io.tmpdir=" + str(OUTPUT / "tmp"), "-cp", os.pathsep.join([str(case_dir), str(processing)]), "SpacingChoice", "--numeric"]
        stdout, numeric_stderr = BASE_EXECUTOR.run_group(command, timeout=int(plan["numeric_timeout_seconds"]), environment={**os.environ, "TMPDIR": str(OUTPUT / "tmp")})
        try:
            numeric = json.loads(stdout)
        except json.JSONDecodeError as error:
            raise RuntimeError(f"{case_id} numeric run did not emit one JSON object: {error}\nstdout:\n{stdout}\nstderr:\n{numeric_stderr}") from error
        current_classes = classes(case_id)
        require(current_classes, case_id + " compile yielded no class files")
        cache_hit = False
        compiler_stderr = compiler.stderr
        write(cache_path, {"input_sha256": local_inputs, "class_sha256": current_classes, "native": numeric, "compiler_stderr": compiler_stderr, "numeric_stderr": numeric_stderr})
    require(numeric.get("status") == "passed" and numeric.get("experiment") == "cp3-placement", case_id + " numeric identity differs")
    reference = validate_native_profile(numeric.get("profiles", {}).get("base-rings"), case["config"], baseline, case_id)
    return {"case": case_id, "generated_source": temporary_source.relative_to(ROOT).as_posix(), "generated_source_sha256": generated_sha, "input_sha256": local_inputs, "class_sha256": current_classes, "numeric": numeric, "reference": reference, "numeric_cached": cache_hit, "compiler_stderr": compiler_stderr, "numeric_stderr": numeric_stderr}


def attempts() -> list[tuple[Path, dict[str, Any]]]:
    all_attempts = [(path, json.loads(path.read_text(encoding="utf-8"))) for path in sorted(OUTPUT.glob("attempt-*.json"))]
    for index, (path, attempt) in enumerate(all_attempts):
        require(path.name == f"attempt-{index:02d}.json", "controls attempt journal numbering is not contiguous")
        require(attempt.get("case") == CASES[index], "controls attempt journal violates registered order")
    return all_attempts


def image_record(path: Path) -> dict[str, Any]:
    return BASE_EXECUTOR.image_record(path, "ECE7DA")


def render(case: dict[str, Any], prepared: dict[str, Any], plan: dict[str, Any], processing: Path, bound: dict[str, str], home: Path) -> None:
    lock_path = ROOT / ".work/processing-render.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        require(source_inputs(plan, processing) == bound, "controls inputs changed before reservation")
        generated = root_path(prepared["generated_source"], "generated controls source")
        require(generated.exists() and sha(generated) == prepared["generated_source_sha256"] and classes(case["id"]) == prepared["class_sha256"], "generated source/classes changed before reservation")
        prior = attempts()
        require(len(prior) < plan["render_budget"], "all controls attempts have been consumed")
        require(case["id"] == CASES[len(prior)], "case is not the next registered controls attempt")
        for _, item in prior:
            require(item.get("status") == "rendered" and item.get("input_sha256") == bound, "prior controls attempt is failed, unresolved, or differently bound")
            generated_prior = root_path(item.get("generated_source"), "prior generated controls source")
            require(generated_prior.exists() and sha(generated_prior) == item.get("generated_source_sha256") and classes(item["case"]) == item.get("class_sha256"), "prior generated source/classes changed")
            prior_image = root_path(item.get("image", {}).get("path"), "prior controls image")
            require(prior_image.exists() and sha(prior_image) == item.get("image", {}).get("sha256"), "prior controls image changed")
        destination = (OUTPUT / (case["id"] + ".png")).resolve()
        require(not destination.exists(), "refusing occupied controls image destination")
        attempt_path = OUTPUT / f"attempt-{len(prior):02d}.json"
        attempt: dict[str, Any] = {"case": case["id"], "status": "reserved", "input_sha256": bound, "generated_input_sha256": prepared["input_sha256"], "class_sha256": prepared["class_sha256"], "generated_source": prepared["generated_source"], "generated_source_sha256": prepared["generated_source_sha256"], "destination": destination.relative_to(ROOT).as_posix(), "executor_pid": os.getpid()}
        with attempt_path.open("x", encoding="utf-8") as stream:
            json.dump(attempt, stream, indent=2, sort_keys=True)
        process: subprocess.Popen[str] | None = None
        try:
            case_dir = BUILD / case["id"]
            command = ["xvfb-run", "-a", str(home / "bin/java"), "-Duser.home=" + str(OUTPUT / "home"), "-Djava.io.tmpdir=" + str(OUTPUT / "tmp"), "-cp", os.pathsep.join([str(case_dir), str(processing)]), "SpacingChoice", "base-rings", str(destination)]
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True, env={**os.environ, "TMPDIR": str(OUTPUT / "tmp")})
            attempt.update(status="running", process_pid=process.pid)
            write(attempt_path, attempt)
            try:
                stdout, stderr = process.communicate(timeout=int(plan["attempt_timeout_seconds"]))
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                stdout, stderr = process.communicate()
                attempt.update(stdout=stdout, stderr=stderr)
                raise RuntimeError("controls render timed out; attempt is consumed")
            attempt.update(stdout=stdout, stderr=stderr)
            if process.returncode:
                raise RuntimeError("controls render exited " + str(process.returncode))
            native = json.loads(stdout)
            profile = prepared["numeric"]["profiles"]["base-rings"]
            require(native.get("status") == "rendered" and native.get("case") == "base-rings" and native.get("output") == str(destination), "controls native render identity differs")
            require(native.get("profile") == profile, "controls native render profile differs from pure profile")
            require(native.get("before_accepted_sha256") == profile["accepted_sha256"] == native.get("after_accepted_sha256"), "controls native draw mutated accepted geometry")
            require(source_inputs(plan, processing) == bound and classes(case["id"]) == prepared["class_sha256"] and sha(BUILD / case["id"] / "SpacingChoice.java") == prepared["generated_source_sha256"], "controls source/classes changed during render")
            attempt.update(status="rendered", native=native, image=image_record(destination))
        except BaseException as error:
            if process is not None and process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                stdout, stderr = process.communicate()
                attempt.setdefault("stdout", stdout)
                attempt.setdefault("stderr", stderr)
            attempt.update(status="failed", error=str(error))
            raise
        finally:
            write(attempt_path, attempt)


def build_report(plan: dict[str, Any], bound: dict[str, str], prepared: list[dict[str, Any]], java: str) -> dict[str, Any]:
    recorded = [item for _, item in attempts()]
    state = "numeric_checked" if not recorded else ("failed" if any(item.get("status") == "failed" for item in recorded) else "rendering_incomplete")
    result: dict[str, Any] = {"scope": "private two-image CP3 controls experiment; no public operation or target-support claim", "status": state, "render_budget": 2, "input_sha256": bound, "runtime": {"java": java, "processing_version": BASE_EXECUTOR.VERSION, "processing_core_sha256": BASE_EXECUTOR.CORE_SHA256}, "baseline": plan["baseline"], "numeric_cases": prepared, "attempts": recorded, "visual_review": "not run" if not recorded else ("not applicable: a render attempt failed" if state == "failed" else "pending root and Sol inspection")}
    if len(recorded) == 2 and all(item.get("status") == "rendered" for item in recorded):
        baseline = ORIGINAL_IMAGE
        require(sha(baseline) == plan["baseline"]["image_sha256"], "preserved baseline image changed before metrics")
        result["status"] = "rendering_complete"
        result["comparisons"] = [BASE_EXECUTOR.comparison(baseline, ROOT / item["image"]["path"], "base-rings", item["case"]) for item in recorded]
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=CASES, help="render exactly the next registered controls case")
    parser.add_argument("--java-home")
    args = parser.parse_args()
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    require(plan.get("id") == "cp3-placement-controls" and [item.get("id") for item in plan.get("variants", [])] == CASES and plan.get("render_budget") == 2, "unexpected controls plan registration")
    require(plan.get("output") == OUTPUT.relative_to(ROOT).as_posix(), "controls output boundary differs")
    processing = ROOT / f".work/toolchains/processing-{BASE_EXECUTOR.VERSION}/core-{BASE_EXECUTOR.VERSION}.jar"
    require(processing.exists() and sha(processing) == BASE_EXECUTOR.CORE_SHA256, "pinned Processing 4.5.6 runtime differs")
    home = BASE_EXECUTOR.java_home(args.java_home)
    java = BASE_EXECUTOR.verify_java17(home)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "tmp").mkdir(exist_ok=True)
    (OUTPUT / "home").mkdir(exist_ok=True)
    baseline = verify_baseline(plan)
    verify_reference_reports()
    bound = source_inputs(plan, processing)
    prepared = [prepare_case(case, plan, processing, bound, baseline, home) for case in plan["variants"]]
    if args.case is not None:
        selected = next(case for case in plan["variants"] if case["id"] == args.case)
        selected_prepared = next(item for item in prepared if item["case"] == args.case)
        try:
            render(selected, selected_prepared, plan, processing, bound, home)
        finally:
            write(REPORT_PATH, build_report(plan, bound, prepared, java))
    else:
        write(REPORT_PATH, build_report(plan, bound, prepared, java))
    print(json.dumps({"status": build_report(plan, bound, prepared, java)["status"], "numeric_cached": {item["case"]: item["numeric_cached"] for item in prepared}, "report": REPORT_PATH.relative_to(ROOT).as_posix()}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
