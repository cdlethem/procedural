#!/usr/bin/env python3
"""Run frozen CP6 endpoint-branch fixtures against the Python core."""
from array import array
from hashlib import sha256
import argparse, copy, json, math, platform
from pathlib import Path
import struct, sys
ROOT = Path(__file__).resolve().parents[2]; SOURCE = ROOT / "packages/python/procedurals/branch_tree.py"; FIXTURE = ROOT / "fixtures/operations/seeded-endpoint-branches.json"; CATALOG = ROOT / "catalog/operations/seeded-endpoint-branches.json"; MAX_SAFE = 9_007_199_254_740_991
sys.path.insert(0, str(ROOT / "packages/python"))
from procedurals.branch_tree import BranchTreeError, _Stream, seeded_endpoint_branches_2d  # noqa: E402
def digest(path): return sha256(path.read_bytes()).hexdigest()
def bits(value): return struct.pack(">d", float(value)).hex()
def exact(actual, expected, label):
    if isinstance(expected, float):
        if not isinstance(actual, (int, float)) or bits(actual) != bits(expected): raise AssertionError(label)
    elif isinstance(expected, list):
        if type(actual) is not list or len(actual) != len(expected): raise AssertionError(label)
        for i, (a, b) in enumerate(zip(actual, expected)): exact(a, b, f"{label}[{i}]")
    elif isinstance(expected, dict):
        if type(actual) is not dict or set(actual) != set(expected): raise AssertionError(label)
        for key in expected: exact(actual[key], expected[key], f"{label}.{key}")
    elif actual != expected: raise AssertionError(label)
def caught(action):
    try: action()
    except BranchTreeError as error: return error
    except Exception as error: return type("Unexpected", (), {"code": f"UNEXPECTED:{type(error).__name__}"})()
    return None
def valid(): return {"seed":42,"root":{"origin":[0,0],"heading":0,"length":16},"rules":[{"lengthScale":[1,1],"slots":[{"probability":1,"turn":[0,0]}]}],"maxSegments":3}
def check_output(case, result):
    actual = result.to_values(); expected = case["output"]
    for key in ("parents", "generations", "childCounts"): exact(actual[key], expected[key], f"{case['id']} {key}")
    for key in ("headings", "lengths"):
        if [bits(x) for x in actual[key]] != case["exact_attribute_bits"][key]: raise AssertionError(f"{case['id']} {key}")
    assert len(actual["segments"]) == len(expected["segments"]), case["id"]
    assert all(len(row) == 4 and all(math.isfinite(x) for x in row) for row in actual["segments"]), case["id"]
    comparison = case["comparison"]
    if comparison["mode"] == "binary64-exact": exact(actual["segments"], expected["segments"], case["id"])
    elif comparison["mode"] == "bounded-trig":
        for i, row in enumerate(actual["segments"]):
            for j, value in enumerate(row):
                if abs(value - expected["segments"][i][j]) > comparison["segments_abs"][i][j]: raise AssertionError(f"{case['id']} trig {i}/{j}")
    else: raise AssertionError("comparison")
    for i in range(1, result.size):
        parent = actual["parents"][i]
        if bits(actual["segments"][i][0]) != bits(actual["segments"][parent][2]) or bits(actual["segments"][i][1]) != bits(actual["segments"][parent][3]): raise AssertionError(f"{case['id']} ancestry")
def native_checks():
    config = valid(); result = seeded_endpoint_branches_2d(config); baseline = result.to_values(); config["root"]["origin"][0] = 99; config["rules"][0]["slots"][0]["turn"][0] = 2; exact(result.to_values(), baseline, "input detached")
    segment = result.segment_at(0); segment[0] = 99; values = result.to_values(); values["segments"][0][0] = 99; exact(result.to_values(), baseline, "output detached")
    for out in ([9.] * 6, array("d", [9.] * 6)):
        before = list(out); assert result.segment_into(1., out, 1.) is None; exact(list(out)[1:5], baseline["segments"][1], "into"); assert list(out)[0] == before[0] and list(out)[5] == before[5]
    def reject(action, code):
        error = caught(action)
        if error is None or error.code != code: raise AssertionError(f"{code}: {getattr(error, 'code', None)}")
    locked = [9.] * 5; before = locked.copy(); reject(lambda: result.segment_into(0, locked, 2), "INVALID_OUTPUT"); assert locked == before
    accessors = (result.segment_at, result.heading_at, result.length_at, result.parent_at, result.generation_at, result.child_count_at)
    for index in (-1, True, .5, math.nan, math.inf, 10**1000, "0"):
        for accessor in accessors: reject(lambda accessor=accessor, index=index: accessor(index), "INVALID_INDEX")
    for index in (result.size, MAX_SAFE):
        for accessor in accessors: reject(lambda accessor=accessor, index=index: accessor(index), "INDEX_OUT_OF_RANGE")
    reject(lambda: result.segment_into(-1, None, -1), "INVALID_INDEX"); reject(lambda: result.segment_into(result.size, None, -1), "INDEX_OUT_OF_RANGE")
    for out in ((9.,)*4, array("f", [9.]*4), type("L", (list,), {})([9.]*4), [9.]): reject(lambda out=out: result.segment_into(0, out), "INVALID_OUTPUT")
    for offset in (-1, True, .5, math.nan, math.inf, 10**1000, "0", 2): reject(lambda offset=offset: result.segment_into(0, [9.]*4, offset), "INVALID_OUTPUT")
    for scalar in (math.nan, math.inf, -math.inf, True, "0", complex(0)):
        changes = (lambda c: c.__setitem__("seed", scalar), lambda c: c.__setitem__("maxSegments", scalar), lambda c: c["root"]["origin"].__setitem__(0, scalar), lambda c: c["root"]["origin"].__setitem__(1, scalar), lambda c: c["root"].__setitem__("heading", scalar), lambda c: c["root"].__setitem__("length", scalar), lambda c: c["rules"][0]["lengthScale"].__setitem__(0, scalar), lambda c: c["rules"][0]["lengthScale"].__setitem__(1, scalar), lambda c: c["rules"][0]["slots"][0].__setitem__("probability", scalar), lambda c: c["rules"][0]["slots"][0]["turn"].__setitem__(0, scalar), lambda c: c["rules"][0]["slots"][0]["turn"].__setitem__(1, scalar))
        for change in changes:
            bad = valid(); change(bad); reject(lambda bad=bad: seeded_endpoint_branches_2d(bad), "INVALID_INPUT")
    class D(dict): pass
    class L(list): pass
    for bad in (D(valid()), {**valid(), "root": D(valid()["root"])}, {**valid(), "rules": L()}, {**valid(), "root": {**valid()["root"], "origin": array("d", [0,0])}}, {**valid(), "rules": [D()]}, {**valid(), "rules": [{"lengthScale":L([1,1]),"slots":[]}]}, {**valid(), "rules": [{"lengthScale":[1,1],"slots":L()}]}): reject(lambda bad=bad: seeded_endpoint_branches_2d(bad), "INVALID_INPUT")
    zero = seeded_endpoint_branches_2d({"seed":0,"root":{"origin":[-0.,-0.],"heading":-0.,"length":-0.},"rules":[{"lengthScale":[-0.,-0.],"slots":[{"probability":-0.,"turn":[-0.,-0.]}]}],"maxSegments":2})
    assert not any(math.copysign(1., x) < 0 for x in zero.to_values()["segments"][0] + zero.to_values()["headings"] + zero.to_values()["lengths"])
    assert seeded_endpoint_branches_2d({"seed":0,"root":{"origin":[0,0],"heading":0,"length":0},"rules":[],"maxSegments":357913941}).size == 1
    rules = [{"lengthScale":[1,1],"slots":[{"probability":1,"turn":[0,0]}]} for _ in range(512)]
    assert seeded_endpoint_branches_2d({"seed":0,"root":{"origin":[0,0],"heading":0,"length":1},"rules":rules,"maxSegments":513}).size == 513

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--output",type=Path,required=True); args=parser.parse_args(); output=args.output.resolve(); work=(ROOT/".work").resolve()
    if not output.is_relative_to(work) or output.exists(): raise ValueError("output must be fresh under .work")
    fixture=json.loads(FIXTURE.read_text()); assert fixture["catalog_sha256"] == digest(CATALOG); inputs=(SOURCE,Path(__file__).resolve(),FIXTURE,CATALOG); before={str(x.relative_to(ROOT)):digest(x) for x in inputs}; results={}
    for case in fixture["cases"]:
        if "error" in case:
            error=caught(lambda case=case: seeded_endpoint_branches_2d(case["input"])); assert error.code == case["error"], case["id"]
            if "error_detail" in case:
                detail={"parentIndex":error.parent_index,"slotIndex":error.slot_index};
                if hasattr(error,"stage"): detail["stage"]=error.stage
                assert detail == case["error_detail"], case["id"]
        else: results[case["id"]]=seeded_endpoint_branches_2d(case["input"]); check_output(case,results[case["id"]])
    for vector in fixture["seed_vectors"]:
        stream=_Stream(vector["seed"]); assert stream.state()==vector["initial_state"]
        for expected in vector["first_10"]: assert stream.output()==expected["output_u32"] and stream.state()==expected["post_state"]
    original=_Stream.output
    for case in fixture["cases"]:
        trace=[]
        def record(stream, original=original):
            word=original(stream); trace.append({"word":word,"state":stream.state()}); return word
        _Stream.output=record
        try: caught(lambda case=case: seeded_endpoint_branches_2d(case["input"]))
        finally: _Stream.output=original
        assert trace == [{"word":x["word"],"state":x["state"]} for x in case.get("rng_trace",[])], case["id"]
    for key in ("segments","headings","lengths","parents","generations"):
        exact(results["prefix-rules-7"].to_values()[key][:results["prefix-rules-5"].size],results["prefix-rules-5"].to_values()[key],key); exact(results["prefix-rules-8"].to_values()[key][:results["prefix-rules-7"].size],results["prefix-rules-7"].to_values()[key],key)
    native_checks(); after={str(x.relative_to(ROOT)):digest(x) for x in inputs}; assert before==after; output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({"status":"passed","runtime":{"python":sys.version,"implementation":platform.python_implementation()},"operation":fixture["operation"],"fixture_cases":len(fixture["cases"]),"seed_vectors":len(fixture["seed_vectors"]),"executed_native_only_requirements":[x["id"] for x in fixture["native_only_cases"]],"source_reviewed_limitations":["Host allocation failure not injected; static validation precedes packed arrays and RNG."],"fixture_sha256":digest(FIXTURE),"catalog_sha256":digest(CATALOG),"input_sha256_before":before,"input_sha256_after":after},indent=2)+"\n"); print(json.dumps({"status":"passed","output":str(output),"fixture_cases":len(fixture["cases"])}))
if __name__ == "__main__": main()
