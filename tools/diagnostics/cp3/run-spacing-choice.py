#!/usr/bin/env python3
"""Compile/check the private CP3 placement probe, or reserve and run one image case.

The default command is numeric only. Rendering needs an explicit ordered --case and
consumes one of the five pre-registered attempts; it is intentionally not retried.
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
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from tools.check_processing_runtime import CORE_SHA256, VERSION
from tools.run_grid_conformance import java_home

PLAN_PATH = ROOT / "evidence/parameter-experiments/cp3-placement/experiment.json"
SOURCE = ROOT / "tools/diagnostics/cp3/SpacingChoice.java"
ORACLE_SCRIPT = ROOT / "tools/diagnostics/cp3/stream_oracle.py"
ORACLE_REPORT = ROOT / "evidence/investigations/cp3-stream-oracle.json"
JS_SCRIPT = ROOT / "tools/diagnostics/cp3/stream-javascript.mjs"
JS_REPORT = ROOT / "evidence/investigations/cp3-stream-javascript.json"
ACCEPTANCE_SCRIPT = ROOT / "tools/diagnostics/cp3/check-acceptance.py"
ACCEPTANCE_REPORT = ROOT / "evidence/investigations/cp3-acceptance.json"
WORKER_NUMERIC = ROOT / ".work/diagnostics/cp3/spacing-choice-numeric.json"
REPORT_PATH = ROOT / "evidence/parameter-experiments/cp3-placement/result.json"
BUILD = ROOT / ".work/build/cp3-spacing-choice"
OUTPUT = ROOT / ".work/experiments/cp3-placement"
HEX64 = re.compile(r"[0-9a-f]{64}\Z")
EXPECTED_CASES = ["base-rings", "more-separation", "smaller-forms", "diamonds", "authored-radial"]
EXPECTED_SEEDS = [0, 1, 42, 2_147_483_648, 4_294_967_295]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary.replace(path)


def root_path(value: str, label: str) -> Path:
    if not isinstance(value, str) or not value:
        raise RuntimeError(f"{label} path is missing")
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT):
        raise RuntimeError(f"{label} path escapes repository: {value}")
    return path


def verify_bindings(bindings: Any, required: set[str], label: str) -> dict[str, str]:
    if not isinstance(bindings, dict) or set(bindings) != required:
        raise RuntimeError(f"{label} has unexpected source bindings")
    verified: dict[str, str] = {}
    for name, item in bindings.items():
        if not isinstance(item, dict):
            raise RuntimeError(f"{label} binding {name} is not an object")
        path = root_path(item.get("path"), f"{label} binding {name}")
        actual = sha(path)
        if actual != item.get("sha256"):
            raise RuntimeError(f"{label} binding is stale: {item.get('path')}")
        verified[name] = actual
    return verified


def read_and_verify_oracles() -> tuple[dict[str, Any], dict[str, Any]]:
    oracle = json.loads(ORACLE_REPORT.read_text(encoding="utf-8"))
    if oracle.get("schema") != "cp3-stream-oracle/v1" or oracle.get("status") != "completed-private-numeric-oracle":
        raise RuntimeError("unexpected CP3 Python oracle identity")
    verify_bindings(oracle.get("source_bindings"), {"script", "rng_options", "prototype_experiment"}, "Python oracle report")
    if oracle["source_bindings"]["script"]["path"] != ORACLE_SCRIPT.relative_to(ROOT).as_posix():
        raise RuntimeError("Python oracle report binds an unexpected script")

    javascript = json.loads(JS_REPORT.read_text(encoding="utf-8"))
    if javascript.get("schema") != "cp3-stream-javascript/v1" or javascript.get("status") != "passed-private-feasibility":
        raise RuntimeError("unexpected CP3 JavaScript feasibility identity")
    source_bindings = javascript.get("source_bindings")
    if not isinstance(source_bindings, dict) or set(source_bindings) != {"script", "oracle", "oracle_inputs_verified"}:
        raise RuntimeError("JavaScript report has unexpected source bindings")
    verify_bindings({key: source_bindings[key] for key in ("script", "oracle")}, {"script", "oracle"}, "JavaScript report")
    bindings = javascript["source_bindings"]
    if bindings["script"].get("path") != JS_SCRIPT.relative_to(ROOT).as_posix():
        raise RuntimeError("JavaScript report binds an unexpected script")
    if bindings["oracle"].get("path") != ORACLE_REPORT.relative_to(ROOT).as_posix():
        raise RuntimeError("JavaScript report binds an unexpected oracle report")
    verify_bindings(bindings["oracle_inputs_verified"], {"script", "rng_options", "prototype_experiment"}, "JavaScript oracle-input report")
    return oracle, javascript


def read_and_verify_acceptance() -> dict[str, Any]:
    acceptance = json.loads(ACCEPTANCE_REPORT.read_text(encoding="utf-8"))
    if acceptance.get("status") != "passed" or acceptance.get("owner") != "root":
        raise RuntimeError("unexpected CP3 independent acceptance identity")
    bindings = acceptance.get("input_sha256")
    expected_paths = {ACCEPTANCE_SCRIPT, ORACLE_SCRIPT, WORKER_NUMERIC, SOURCE, PLAN_PATH}
    if not isinstance(bindings, dict) or set(bindings) != {path.relative_to(ROOT).as_posix() for path in expected_paths}:
        raise RuntimeError("CP3 acceptance report has unexpected input bindings")
    for path in expected_paths:
        key = path.relative_to(ROOT).as_posix()
        if not path.exists() or bindings.get(key) != sha(path):
            raise RuntimeError("CP3 acceptance report binding is stale: " + key)
    return acceptance


def verify_java17(home: Path) -> str:
    javac = subprocess.run([str(home / "bin/javac"), "-version"], capture_output=True, text=True, timeout=30)
    version = (javac.stdout + javac.stderr).strip()
    if javac.returncode or re.search(r"(?:^|\s)17(?:[.\s]|$)", version) is None:
        raise RuntimeError(f"CP3 probe requires JDK 17, got: {version}")
    return version


def class_hashes() -> dict[str, str]:
    return {p.relative_to(BUILD).as_posix(): sha(p) for p in sorted(BUILD.glob("SpacingChoice*.class"))}


def inputs(processing: Path) -> dict[str, str]:
    paths = [PLAN_PATH, SOURCE, Path(__file__).resolve(), ORACLE_SCRIPT, ORACLE_REPORT, JS_SCRIPT, JS_REPORT,
             ACCEPTANCE_SCRIPT, ACCEPTANCE_REPORT, WORKER_NUMERIC, processing]
    return {path.relative_to(ROOT).as_posix(): sha(path) for path in paths}


def require_hash(value: Any, label: str) -> None:
    if not isinstance(value, str) or HEX64.fullmatch(value) is None:
        raise RuntimeError(f"missing or malformed SHA-256: {label}")


def same_array(actual: Any, expected: Any, label: str) -> None:
    if actual != expected:
        raise RuntimeError(f"mismatch: {label}")


def validate_seed_vectors(native: dict[str, Any], oracle: dict[str, Any]) -> None:
    streams = native.get("streams", {})
    if streams.get("algorithm") != "xoshiro128** 1.1":
        raise RuntimeError("wrong Java stream algorithm")
    native_vectors = streams.get("seed_vectors")
    oracle_vectors = oracle.get("seed_vectors")
    if not isinstance(native_vectors, list) or not isinstance(oracle_vectors, list):
        raise RuntimeError("seed vectors missing")
    if [x.get("seed") for x in native_vectors] != EXPECTED_SEEDS or [x.get("seed") for x in oracle_vectors] != EXPECTED_SEEDS:
        raise RuntimeError("seed vector identities/order differ")
    if len(native_vectors) != 5 or len(oracle_vectors) != 5:
        raise RuntimeError("expected five seed vectors")
    for observed, expected in zip(native_vectors, oracle_vectors):
        same_array(observed.get("initial_state"), expected.get("initial_state"), f"seed {expected['seed']} initial state")
        outputs, reference = observed.get("outputs"), expected.get("first_10")
        if not isinstance(outputs, list) or not isinstance(reference, list) or len(outputs) != 10 or len(reference) != 10:
            raise RuntimeError(f"seed {expected['seed']} needs ten outputs")
        for index, (output, sample) in enumerate(zip(outputs, reference)):
            if output.get("u32") != sample.get("output_u32"):
                raise RuntimeError(f"seed {expected['seed']} u32 output {index}")
            same_array(output.get("state"), sample.get("post_state"), f"seed {expected['seed']} post-state {index}")


def validate_profile(profile: Any, expected: dict[str, Any], label: str) -> None:
    if not isinstance(profile, dict) or profile.get("attempts") != 5000:
        raise RuntimeError(f"wrong profile identity/attempts: {label}")
    keys = {
        "candidate_sha256": "candidates_sha256_struct_be_f64_xyz",
        "centres_sha256": "centres_sha256_struct_be_f64_xy",
        "final_rng_state": "final_state",
    }
    for actual_key, oracle_key in keys.items():
        if profile.get(actual_key) != expected.get(oracle_key):
            raise RuntimeError(f"{label} differs from independent oracle: {actual_key}")
    for key in ("candidate_sha256", "centres_sha256", "accepted_sha256", "colour_sha256", "model_vertex_sha256"):
        require_hash(profile.get(key), f"{label}.{key}")
    if profile.get("render_vertex_conversion") != "binary64 model expressions cast to Java float at vertex submission":
        raise RuntimeError(f"unexpected vertex conversion boundary: {label}")
    if not isinstance(profile.get("accepted_count"), int) or profile["accepted_count"] < 0:
        raise RuntimeError(f"invalid accepted count: {label}")
    if not isinstance(profile.get("comparisons"), int) or profile["comparisons"] < 0:
        raise RuntimeError(f"invalid comparisons: {label}")


def validate_numeric(native: dict[str, Any], oracle: dict[str, Any], acceptance: dict[str, Any], plan: dict[str, Any]) -> None:
    if native.get("status") != "passed" or native.get("experiment") != plan.get("id") or native.get("private_only") is not True:
        raise RuntimeError("unexpected Java numeric identity")
    validate_seed_vectors(native, oracle)
    profiles = native.get("profiles")
    if not isinstance(profiles, dict) or set(profiles) != set(EXPECTED_CASES):
        raise RuntimeError("Java profiles differ from registered cases")
    candidates = oracle.get("prototype_candidates", {})
    baseline = candidates.get("baseline_5000")
    smaller = candidates.get("rmax_32_5000")
    if not isinstance(baseline, dict) or not isinstance(smaller, dict):
        raise RuntimeError("oracle lacks 5000-proposal references")
    for case in ("base-rings", "more-separation", "diamonds"):
        validate_profile(profiles[case], baseline, case)
    validate_profile(profiles["smaller-forms"], smaller, "smaller-forms")
    accepted_profiles = acceptance.get("profiles")
    if not isinstance(accepted_profiles, dict) or set(accepted_profiles) != {"base-rings", "more-separation", "smaller-forms"}:
        raise RuntimeError("independent acceptance evidence lacks three seeded profiles")
    for case, accepted in accepted_profiles.items():
        for key in ("accepted_count", "comparisons", "accepted_sha256"):
            if profiles[case].get(key) != accepted.get(key):
                raise RuntimeError(f"{case} differs from independent acceptance evidence: {key}")
    radial = profiles["authored-radial"]
    if radial.get("attempts") != 160 or radial.get("final_rng_state") is not None:
        raise RuntimeError("unexpected authored radial stream accounting")
    for key in ("candidate_sha256", "centres_sha256", "accepted_sha256", "colour_sha256", "model_vertex_sha256"):
        require_hash(radial.get(key), "authored-radial." + key)
    if radial.get("render_vertex_conversion") != "binary64 model expressions cast to Java float at vertex submission":
        raise RuntimeError("unexpected authored radial vertex conversion boundary")
    relationships = native.get("relationships")
    expected_relationships = {
        "same_candidate_hash_base_separation", "same_candidate_hash_base_diamond",
        "same_centres_base_smaller", "same_centres_base_diamond",
        "motif_shared_object_numeric_only", "same_geometry_base_diamond", "same_colours_base_diamond",
    }
    if not isinstance(relationships, dict) or set(relationships) != expected_relationships or not all(relationships.values()):
        raise RuntimeError("missing or failed Java numeric relationships")
    analytic = native.get("analytic")
    if not isinstance(analytic, dict) or set(analytic) != {"tangent_equality_accepted", "strict_overlap_rejected", "order_changes_retained_source"} or not all(analytic.values()):
        raise RuntimeError("missing or failed Java analytic checks")
    prefix = native.get("numeric_prefix")
    if not isinstance(prefix, dict) or prefix.get("prefix_5000_of_10000") is not True:
        raise RuntimeError("missing Java prefix check")
    # SpacingChoice deliberately does not expose a 10k candidate digest; its 10k check is
    # limited to retained-prefix semantics. The independent reports bind the 10k stream digest.
    if not all(isinstance(prefix.get(key), int) and prefix[key] >= 0 for key in ("accepted_5000", "accepted_10000")):
        raise RuntimeError("invalid Java prefix counts")
    extended = acceptance.get("extended_baseline")
    if not isinstance(extended, dict) or prefix["accepted_10000"] != extended.get("accepted_count") or acceptance.get("accepted_prefix_matches") is not True:
        raise RuntimeError("Java 10000 accepted-prefix count differs from independent acceptance evidence")
    timings = native.get("timing_observations")
    if not isinstance(timings, list) or [item.get("attempts") for item in timings] != [5000, 200000]:
        raise RuntimeError("unexpected numeric timing workloads")
    for item in timings:
        if item.get("workload") != "seeded proposal generation, ordered acceptance, and SHA-256 proposal/centre/accepted summaries":
            raise RuntimeError("timing workload label is incomplete")
        for key in ("last_accepted_count", "last_comparisons", "last_retained_raw_bytes", "last_retained_capacity_payload_bytes"):
            if not isinstance(item.get(key), int) or item[key] < 0:
                raise RuntimeError("invalid timing observation: " + key)


def run_group(command: list[str], *, timeout: int, environment: dict[str, str] | None = None) -> tuple[str, str]:
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True, env=environment)
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        stdout, stderr = process.communicate()
        raise RuntimeError(f"command timed out after {timeout}s\nstdout:\n{stdout}\nstderr:\n{stderr}")
    if process.returncode:
        raise RuntimeError(f"command exited {process.returncode}\nstdout:\n{stdout}\nstderr:\n{stderr}")
    return stdout, stderr


def prepare_numeric(home: Path, processing: Path, plan: dict[str, Any], bound_inputs: dict[str, str]) -> tuple[dict[str, Any], dict[str, str], dict[str, Any]]:
    BUILD.mkdir(parents=True, exist_ok=True)
    cache_path = BUILD / "numeric.json"
    cached: dict[str, Any] = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    existing_classes = class_hashes()
    if cached.get("input_sha256") == bound_inputs and existing_classes and cached.get("class_sha256") == existing_classes:
        native = cached.get("native")
        if not isinstance(native, dict):
            raise RuntimeError("numeric cache has no JSON native result")
        return native, existing_classes, {"cached": True, "compiler_stderr": cached.get("compiler_stderr", ""), "native_stderr": cached.get("native_stderr", "")}
    # The build directory belongs to this executor. Remove only stale class/cache members;
    # preserving other repository files is not relevant because it must contain none.
    for path in BUILD.glob("SpacingChoice*.class"):
        path.unlink()
    cache_path.unlink(missing_ok=True)
    compiler = subprocess.run([str(home / "bin/javac"), "--release", "8", "-cp", str(processing), "-d", str(BUILD), str(SOURCE)], text=True, capture_output=True, timeout=60)
    if compiler.returncode:
        raise RuntimeError(f"compile failed\nstdout:\n{compiler.stdout}\nstderr:\n{compiler.stderr}")
    command = [str(home / "bin/java"), "-Duser.home=" + str(OUTPUT / "home"), "-Djava.io.tmpdir=" + str(OUTPUT / "tmp"), "-cp", os.pathsep.join([str(BUILD), str(processing)]), "SpacingChoice", "--numeric"]
    stdout, stderr = run_group(command, timeout=int(plan["numeric_timeout_seconds"]), environment={**os.environ, "TMPDIR": str(OUTPUT / "tmp")})
    try:
        native = json.loads(stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"numeric probe did not write one JSON object: {error}\nstdout:\n{stdout}\nstderr:\n{stderr}") from error
    hashes = class_hashes()
    if not hashes:
        raise RuntimeError("compile produced no SpacingChoice class files")
    write(cache_path, {"input_sha256": bound_inputs, "class_sha256": hashes, "native": native, "compiler_stderr": compiler.stderr, "native_stderr": stderr})
    return native, hashes, {"cached": False, "compiler_stderr": compiler.stderr, "native_stderr": stderr}


def validate_native(native: Any, pure: dict[str, Any], case: str, destination: Path) -> None:
    if not isinstance(native, dict) or native.get("status") != "rendered" or native.get("case") != case:
        raise RuntimeError("unexpected native render identity")
    if native.get("output") != str(destination):
        raise RuntimeError("native reported a different output path")
    if native.get("profile") != pure["profiles"][case]:
        raise RuntimeError("actual native profile differs from pure profile")
    accepted = native["profile"].get("accepted_sha256")
    if native.get("before_accepted_sha256") != accepted or native.get("after_accepted_sha256") != accepted:
        raise RuntimeError("native drawing mutated or misreported accepted geometry")


def image_record(path: Path, background_hex: str) -> dict[str, Any]:
    from PIL import Image
    with Image.open(path) as image:
        if image.size != (640, 640):
            raise RuntimeError("unexpected PNG dimensions")
        rgba = image.convert("RGBA").tobytes()
    if len(rgba) != 640 * 640 * 4 or any(rgba[index] != 255 for index in range(3, len(rgba), 4)):
        raise RuntimeError("PNG is not opaque RGBA")
    background = tuple(bytes.fromhex(background_hex))
    rgb = rgba[0::4], rgba[1::4], rgba[2::4]
    if (rgb[0][0], rgb[1][0], rgb[2][0]) != background:
        raise RuntimeError("top-left pixel does not retain expected background")
    changed = sum((rgb[0][index], rgb[1][index], rgb[2][index]) != background for index in range(640 * 640))
    if changed == 0:
        raise RuntimeError("PNG is background-only")
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": sha(path), "rgba_sha256": hashlib.sha256(rgba).hexdigest(), "dimensions": [640, 640], "opaque": True, "background_rgb": background_hex, "non_background_pixels": changed}


def comparison(first: Path, second: Path, first_id: str, second_id: str) -> dict[str, Any]:
    from PIL import Image, ImageChops
    with Image.open(first) as a, Image.open(second) as b:
        diff = ImageChops.difference(a.convert("RGB"), b.convert("RGB")).tobytes()
    changed = sum(any(diff[index:index + 3]) for index in range(0, len(diff), 3))
    return {"first": first_id, "second": second_id, "normalized_rgb_mae": sum(diff) / (255 * len(diff)), "changed_pixels": changed, "changed_fraction": changed / (len(diff) / 3)}


def current_attempts() -> list[tuple[Path, dict[str, Any]]]:
    attempts: list[tuple[Path, dict[str, Any]]] = []
    for path in sorted(OUTPUT.glob("attempt-*.json")):
        attempts.append((path, json.loads(path.read_text(encoding="utf-8"))))
    for index, (path, attempt) in enumerate(attempts):
        if path.name != f"attempt-{index:02d}.json":
            raise RuntimeError("attempt journal numbering is not contiguous")
        if attempt.get("case") != EXPECTED_CASES[index]:
            raise RuntimeError("attempt journal case order differs from registered plan")
    return attempts


def report(plan: dict[str, Any], bound_inputs: dict[str, str], pure: dict[str, Any], *, java: str, oracle: dict[str, Any], javascript: dict[str, Any], acceptance: dict[str, Any]) -> dict[str, Any]:
    attempts = [item for _, item in current_attempts()]
    state = "numeric_checked" if not attempts else ("failed" if any(item.get("status") == "failed" for item in attempts) else "rendering_incomplete")
    result: dict[str, Any] = {
        "scope": "private CP3 placement diagnostic; no public operation or catalog admission",
        "status": state,
        "render_budget": plan["render_budget"],
        "input_sha256": bound_inputs,
        "runtime": {"java": java, "processing_version": VERSION, "processing_core_sha256": CORE_SHA256},
        "independent_oracles": {"python_report_sha256": sha(ORACLE_REPORT), "javascript_report_sha256": sha(JS_REPORT), "acceptance_report_sha256": sha(ACCEPTANCE_REPORT), "python_status": oracle["status"], "javascript_status": javascript["status"], "acceptance_status": acceptance["status"]},
        "numeric": pure,
        "attempts": attempts,
        "visual_review": "not run" if not attempts else ("not applicable: a render attempt failed" if state == "failed" else "pending root and Sol inspection"),
    }
    if len(attempts) == len(EXPECTED_CASES) and all(item.get("status") == "rendered" for item in attempts):
        expected_images = {item["case"]: ROOT / item["image"]["path"] for item in attempts}
        for item in attempts:
            if item["image"].get("sha256") != sha(expected_images[item["case"]]):
                raise RuntimeError("previously rendered image changed before metric calculation")
        result["status"] = "rendering_complete"
        result["pairwise_rgb_differences"] = [
            comparison(expected_images["base-rings"], expected_images[case], "base-rings", case)
            for case in ("more-separation", "smaller-forms", "diamonds")
        ]
    return result


def render_case(home: Path, processing: Path, plan: dict[str, Any], bound_inputs: dict[str, str], pure: dict[str, Any], classes: dict[str, str], case: str) -> dict[str, Any]:
    lock_path = ROOT / ".work/processing-render.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if inputs(processing) != bound_inputs or class_hashes() != classes:
            raise RuntimeError("source or compiled class changed before attempt reservation")
        attempts = current_attempts()
        if len(attempts) >= plan["render_budget"]:
            raise RuntimeError("all registered CP3 attempts have been consumed")
        expected = EXPECTED_CASES[len(attempts)]
        if case != expected:
            raise RuntimeError(f"case {case!r} is not next; expected {expected!r}")
        for _, attempt in attempts:
            if attempt.get("status") != "rendered" or attempt.get("input_sha256") != bound_inputs:
                raise RuntimeError("a prior attempt failed, is unresolved, or used different bound inputs")
            if attempt.get("class_sha256") != classes:
                raise RuntimeError("a prior attempt used different compiled classes")
            image = attempt.get("image")
            if not isinstance(image, dict) or not isinstance(image.get("path"), str):
                raise RuntimeError("a prior rendered attempt lacks image evidence")
            prior_image = root_path(image["path"], "prior image")
            if not prior_image.exists() or image.get("sha256") != sha(prior_image):
                raise RuntimeError("a prior rendered image is missing or changed")
        destination = (OUTPUT / f"{case}.png").resolve()
        if destination.exists():
            raise RuntimeError(f"refusing occupied image destination: {destination}")
        attempt_path = OUTPUT / f"attempt-{len(attempts):02d}.json"
        attempt = {"case": case, "status": "reserved", "input_sha256": bound_inputs, "class_sha256": classes, "executor_pid": os.getpid(), "destination": destination.relative_to(ROOT).as_posix()}
        try:
            with attempt_path.open("x", encoding="utf-8") as stream:
                json.dump(attempt, stream, indent=2, sort_keys=True)
        except FileExistsError as error:
            raise RuntimeError("attempt reservation already exists") from error
        process: subprocess.Popen[str] | None = None
        try:
            command = ["xvfb-run", "-a", str(home / "bin/java"), "-Duser.home=" + str(OUTPUT / "home"), "-Djava.io.tmpdir=" + str(OUTPUT / "tmp"), "-cp", os.pathsep.join([str(BUILD), str(processing)]), "SpacingChoice", case, str(destination)]
            environment = {**os.environ, "TMPDIR": str(OUTPUT / "tmp")}
            process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True, env=environment)
            attempt.update(status="running", process_pid=process.pid)
            write(attempt_path, attempt)
            try:
                stdout, stderr = process.communicate(timeout=int(plan["attempt_timeout_seconds"]))
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                stdout, stderr = process.communicate()
                attempt.update(stdout=stdout, stderr=stderr)
                raise RuntimeError("registered render timed out; attempt is consumed")
            attempt.update(stdout=stdout, stderr=stderr)
            if process.returncode:
                raise RuntimeError(f"render exited {process.returncode}")
            native = json.loads(stdout)
            validate_native(native, pure, case, destination)
            if inputs(processing) != bound_inputs or class_hashes() != classes:
                raise RuntimeError("source or compiled class changed during render")
            attempt.update(status="rendered", native=native, image=image_record(destination, plan["baseline"]["background_rgb"]))
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
    return attempt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=EXPECTED_CASES, help="run exactly the next ordered, registered render case")
    parser.add_argument("--java-home", help="JDK 17 home; otherwise JAVA_HOME or the single repository-local JDK")
    args = parser.parse_args()
    plan = json.loads(PLAN_PATH.read_text(encoding="utf-8"))
    if plan.get("id") != "cp3-placement" or [item.get("id") for item in plan.get("variants", [])] != EXPECTED_CASES or plan.get("render_budget") != len(EXPECTED_CASES):
        raise RuntimeError("unexpected CP3 experiment registration")
    if plan.get("output") != OUTPUT.relative_to(ROOT).as_posix():
        raise RuntimeError("CP3 output path differs from executor boundary")
    processing = ROOT / f".work/toolchains/processing-{VERSION}/core-{VERSION}.jar"
    if not processing.exists() or sha(processing) != CORE_SHA256:
        raise RuntimeError("Processing 4.5.6 core checksum does not match pinned runtime")
    home = java_home(args.java_home)
    java = verify_java17(home)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "tmp").mkdir(exist_ok=True)
    (OUTPUT / "home").mkdir(exist_ok=True)
    oracle, javascript = read_and_verify_oracles()
    acceptance = read_and_verify_acceptance()
    bound_inputs = inputs(processing)
    pure, classes, cache = prepare_numeric(home, processing, plan, bound_inputs)
    validate_numeric(pure, oracle, acceptance, plan)
    if args.case is not None:
        try:
            render_case(home, processing, plan, bound_inputs, pure, classes, args.case)
        finally:
            generated = report(plan, bound_inputs, pure, java=java, oracle=oracle, javascript=javascript, acceptance=acceptance)
            write(REPORT_PATH, generated)
    else:
        generated = report(plan, bound_inputs, pure, java=java, oracle=oracle, javascript=javascript, acceptance=acceptance)
        write(REPORT_PATH, generated)
    print(json.dumps({"status": generated["status"], "numeric_cached": cache["cached"], "report": REPORT_PATH.relative_to(ROOT).as_posix()}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
