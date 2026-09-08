#!/usr/bin/env python3
"""Generate private CP10 target-spring fixture candidates from the selected recurrence."""
import argparse
import copy
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OUTPUT = ROOT / ".work/investigations/cp10-fixture-draft.json"
MAX_BODIES = 357_913_941
STAGES = ("delta", "force", "advanced", "position", "velocity")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return 0.0 if value == 0.0 else value


def number(value):
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def exact_keys(value, keys):
    return type(value) is dict and set(value) == set(keys)


def pair(value):
    return type(value) is list and len(value) == 2 and all(number(item) for item in value)


def invalid_input(config):
    """Validate every state body, then every target, before numeric recurrence."""
    if not exact_keys(config, ("state", "targets")):
        return True
    state = config["state"]
    if not exact_keys(state, ("bodies",)) or type(state["bodies"]) is not list:
        return True
    bodies = state["bodies"]
    if len(bodies) > MAX_BODIES:
        return True
    for body in bodies:
        if not exact_keys(body, ("position", "velocity", "strength", "retention")):
            return True
        if not pair(body["position"]) or not pair(body["velocity"]):
            return True
        if not number(body["strength"]) or body["strength"] < 0.0:
            return True
        if not number(body["retention"]) or not 0.0 <= body["retention"] <= 1.0:
            return True
    targets = config["targets"]
    if type(targets) is not list or len(targets) != len(bodies):
        return True
    return any(not pair(target) for target in targets)


def axis(position, target, velocity, strength, retention):
    """One explicitly separated binary64 axis evaluation."""
    delta = target - position
    if not math.isfinite(delta):
        return None, "delta"
    force = delta * strength
    if not math.isfinite(force):
        return None, "force"
    advanced = velocity + force
    if not math.isfinite(advanced):
        return None, "advanced"
    next_position = position + advanced
    if not math.isfinite(next_position):
        return None, "position"
    next_velocity = advanced * retention
    if not math.isfinite(next_velocity):
        return None, "velocity"
    return (canonical(next_position), canonical(next_velocity)), None


def transition(config):
    if invalid_input(config):
        return {"error": "INVALID_INPUT"}
    output = []
    for body_index, (body, target) in enumerate(zip(config["state"]["bodies"], config["targets"])):
        position = [canonical(float(value)) for value in body["position"]]
        velocity = [canonical(float(value)) for value in body["velocity"]]
        strength = canonical(float(body["strength"]))
        retention = canonical(float(body["retention"]))
        next_position, next_velocity = [], []
        for axis_index, axis_name in enumerate(("x", "y")):
            result, stage = axis(position[axis_index], canonical(float(target[axis_index])), velocity[axis_index], strength, retention)
            if stage is not None:
                return {
                    "error": "SPRING_ARITHMETIC_INVALID",
                    "error_details": {"bodyIndex": body_index, "axis": axis_name, "stage": stage},
                }
            next_position.append(result[0])
            next_velocity.append(result[1])
        output.append({
            "position": next_position,
            "velocity": next_velocity,
            "strength": strength,
            "retention": retention,
        })
    return {"output": {"bodies": output}}


def body(position, velocity, strength, retention):
    return {"position": list(position), "velocity": list(velocity), "strength": strength, "retention": retention}


def config(bodies, targets):
    return {"state": {"bodies": list(bodies)}, "targets": [list(target) for target in targets]}


def success(case_id, input_value, **metadata):
    result = transition(input_value)
    assert "output" in result, (case_id, result)
    return {"id": case_id, "input": input_value, "output": result["output"], **metadata}


def failure(case_id, input_value, error, details=None):
    result = transition(input_value)
    assert result.get("error") == error, (case_id, result)
    if details is None:
        assert "error_details" not in result, (case_id, result)
        return {"id": case_id, "input": input_value, "error": error}
    assert result.get("error_details") == details, (case_id, result)
    return {"id": case_id, "input": input_value, "error": error, "error_details": details}


def bits(value):
    return struct.pack(">d", value).hex()


def success_cases():
    minimum = float.fromhex("0x0.0000000000001p-1022")
    cases = [
        success("empty", config([], [])),
        success("equilibrium", config([body([0.0, 0.0], [0.0, 0.0], 0.025, 0.7)], [[0.0, 0.0]])),
        success("source-shaped-first-step", config([body([0.0, 0.0], [0.0, 0.0], 0.025, 0.7)], [[100.0, -100.0]])),
        success("source-shaped-second-step", config([body([2.5, -2.5], [1.75, -1.75], 0.025, 0.7)], [[100.0, -100.0]])),
        success("zero-strength-carries-velocity", config([body([5.0, -5.0], [3.0, -3.0], 0.0, 0.5)], [[-10.0, 10.0]])),
        success("zero-retention", config([body([0.0, 0.0], [0.0, 0.0], 1.0, 0.0)], [[1.0, -1.0]])),
        success("subnormal-preserved", config([body([0.0, 0.0], [0.0, 0.0], 1.0, 1.0)], [[minimum, -minimum]])),
        success("subnormal-underflow", config([body([0.0, 0.0], [0.0, 0.0], 0.5, 1.0)], [[minimum, -minimum]])),
        success("no-fma", config([body([0.0, 0.0], [-1e16, 1e16], 1.0000000000000002, 1.0)], [[1e16, -1e16]])),
        success("heterogeneous-independent-bodies", config([
            body([3.0, -2.0], [1.0, -0.5], 0.125, 0.75),
            body([-4.0, 6.0], [0.0, 2.0], 0.0, 1.0),
        ], [[10.0, -4.0], [5.0, -7.0]])),
    ]
    maximum = float.fromhex("0x1.fffffffffffffp+1023")
    cases.extend([
        success("canonical-all-input-zeros", config([body([-0.0, 0.0], [-0.0, -0.0], -0.0, -0.0)], [[-0.0, -0.0]])),
        success("canonical-negative-output-zero", config([body([1.0, -1.0], [-1.0, 1.0], 0.0, 0.0)], [[0.0, 0.0]])),
        success("coincident-independent-responses", config([body([2.0, 3.0], [0.0, 0.0], 0.125, 0.5), body([2.0, 3.0], [0.0, 0.0], 0.5, 1.0)], [[10.0, -4.0], [10.0, -4.0]])),
        success("maximum-finite-equilibrium", config([body([maximum, -maximum], [0.0, 0.0], maximum, 1.0)], [[maximum, -maximum]])),
    ])
    sequence_id = "changing-target-12"
    state = {"bodies": [body([3.0, -2.0], [1.0, -0.5], 0.125, 0.75)]}
    changing_targets = ([10.0, -4.0], [-8.0, 6.0], [2.0, 12.0], [7.0, -9.0])
    for index in range(12):
        current = {"state": state, "targets": [list(changing_targets[index % len(changing_targets)])]}
        record = success("%s-%02d" % (sequence_id, index), current, sequence_id=sequence_id, sequence_index=index)
        cases.append(record)
        state = record["output"]
    for index in range(1, 12):
        previous = cases[-12 + index - 1]
        current = cases[-12 + index]
        assert current["input"]["state"] == previous["output"]
    assert cases[-12]["input"]["state"]["bodies"][0]["position"] != [0.0, 0.0]
    restored = copy.deepcopy(cases[-6])
    restored_id = restored['id']
    restored.pop('sequence_id'); restored.pop('sequence_index')
    restored['id'] = 'restore-mid-sequence'
    restored['restores_case'] = restored_id
    cases.append(restored)
    return cases


def failure_cases():
    maximum = float.fromhex("0x1.fffffffffffffp+1023")
    normal = body([0.0, 0.0], [0.0, 0.0], 1.0, 0.5)
    cases = [
        failure("delta-overflow", config([body([-maximum, 0.0], [0.0, 0.0], 0.0, 0.0)], [[maximum, 0.0]]),
                "SPRING_ARITHMETIC_INVALID", {"bodyIndex": 0, "axis": "x", "stage": "delta"}),
        failure("force-overflow", config([body([0.0, 0.0], [0.0, 0.0], 2.0, 0.0)], [[maximum, 0.0]]),
                "SPRING_ARITHMETIC_INVALID", {"bodyIndex": 0, "axis": "x", "stage": "force"}),
        failure("advanced-overflow", config([body([0.0, 0.0], [maximum, 0.0], 1.0, 0.0)], [[maximum, 0.0]]),
                "SPRING_ARITHMETIC_INVALID", {"bodyIndex": 0, "axis": "x", "stage": "advanced"}),
        failure("position-overflow", config([body([maximum, 0.0], [maximum, 0.0], 0.0, 0.0)], [[maximum, 0.0]]),
                "SPRING_ARITHMETIC_INVALID", {"bodyIndex": 0, "axis": "x", "stage": "position"}),
        failure("late-body-y-advanced-overflow", config([
            body([0.0, 0.0], [0.0, 0.0], 1.0, 0.5),
            body([0.0, 0.0], [0.0, maximum], 1.0, 0.0),
        ], [[1.0, 1.0], [1.0, maximum]]),
                "SPRING_ARITHMETIC_INVALID", {"bodyIndex": 1, "axis": "y", "stage": "advanced"}),
        failure("x-position-before-y-delta", config([body([maximum, -maximum], [maximum, 0.0], 0.0, 0.0)], [[maximum, maximum]]),
                "SPRING_ARITHMETIC_INVALID", {"bodyIndex": 0, "axis": "x", "stage": "position"}),
        failure("body-zero-y-before-body-one-x", config([body([0.0, maximum], [0.0, maximum], 0.0, 0.0), body([-maximum, 0.0], [0.0, 0.0], 0.0, 0.0)], [[0.0, maximum], [maximum, 0.0]]),
                "SPRING_ARITHMETIC_INVALID", {"bodyIndex": 0, "axis": "y", "stage": "position"}),
        failure("late-invalid-target-beats-body-zero-overflow", {
            "state": {"bodies": [body([-maximum, 0.0], [0.0, 0.0], 0.0, 0.0), normal]},
            "targets": [[maximum, 0.0], [0.0, "not-a-number"]],
        }, "INVALID_INPUT"),
        failure("missing-outer-key", {"state": {"bodies": []}}, "INVALID_INPUT"),
        failure("extra-outer-key", {"state": {"bodies": []}, "targets": [], "extra": 1}, "INVALID_INPUT"),
        failure("missing-body-key", {"state": {"bodies": [{"position": [0.0, 0.0], "velocity": [0.0, 0.0], "strength": 0.1}]}, "targets": [[0.0, 0.0]]}, "INVALID_INPUT"),
        failure("boolean-strength", config([body([0.0, 0.0], [0.0, 0.0], True, 0.5)], [[0.0, 0.0]]), "INVALID_INPUT"),
        failure("string-coordinate", config([body(["0", 0.0], [0.0, 0.0], 0.1, 0.5)], [[0.0, 0.0]]), "INVALID_INPUT"),
        failure("negative-strength", config([body([0.0, 0.0], [0.0, 0.0], -0.1, 0.5)], [[0.0, 0.0]]), "INVALID_INPUT"),
        failure("negative-retention", config([body([0.0, 0.0], [0.0, 0.0], 0.1, -0.1)], [[0.0, 0.0]]), "INVALID_INPUT"),
        failure("retention-above-one", config([body([0.0, 0.0], [0.0, 0.0], 0.1, 1.1)], [[0.0, 0.0]]), "INVALID_INPUT"),
        failure("body-target-length-mismatch", config([normal], []), "INVALID_INPUT"),
    ]
    return cases


def source_bindings():
    paths = (
        "tools/diagnostics/cp10/build_fixture_draft.py",
        "tools/diagnostics/cp10/numeric_policy_probe.py",
        "design/operations/cp10-contract-decisions.md",
        "design/operations/cp10-numeric-fixture-candidates.md",
    )
    return {path: sha256(ROOT / path) for path in paths}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    output = args.output.resolve()
    output.relative_to(ROOT / ".work")
    if output.exists():
        raise RuntimeError("Refusing to overwrite fixture draft: %s" % output)
    cases = success_cases() + failure_cases()
    assert len(cases) >= 14
    assert len({case["id"] for case in cases}) == len(cases)
    for case in cases:
        assert ("output" in case) != ("error" in case)
        if "output" in case:
            assert set(case["output"]) == {"bodies"}
        else:
            assert "error_details" not in case or case["error"] == "SPRING_ARITHMETIC_INVALID"
    result = {
        "operation": "motion.target-springs-2d",
        "version": "0.1.0",
        "status": "draft",
        "scope": "Private fixture draft for the selected binary64 recurrence; no catalog or implementation claim.",
        "source_bindings": source_bindings(),
        "cases": cases,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"status": "draft-generated", "cases": len(cases), "successes": sum("output" in case for case in cases), "errors": sum("error" in case for case in cases), "output": str(output)}))


if __name__ == "__main__":
    main()
