#!/usr/bin/env python3
"""Build draft nearest closed-segment contact vectors from an independent rational oracle."""

from __future__ import annotations

from fractions import Fraction
import copy
import hashlib
import json
from pathlib import Path

from closed_contact_study import contact, nearest


ROOT = Path(__file__).resolve().parents[3]
CATALOG = ROOT / "catalog/operations/nearest-segment-contact-2d.json"
OUTPUT = ROOT / "fixtures/operations/nearest-segment-contact-2d.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def exact_point(query: list[object], t: Fraction) -> list[Fraction]:
    start_x, start_y = Fraction(query[0]), Fraction(query[1])
    return [start_x + t * (Fraction(query[2]) - start_x),
            start_y + t * (Fraction(query[3]) - start_y)]


def rounded(value: Fraction) -> float:
    result = float(value)
    return 0.0 if result == 0.0 else result


def expected(queries: list[list[object]], obstacles: list[list[object]]) -> dict[str, object]:
    hits: list[object] = []
    for query in queries:
        hit = nearest(query, obstacles)
        if hit is None:
            hits.append(None)
            continue
        t, obstacle_index, _ = hit
        point = exact_point(query, t)
        hits.append({"obstacleIndex": obstacle_index, "t": rounded(t),
                     "point": [rounded(point[0]), rounded(point[1])]})
    return {"hits": hits}


def input_value(queries: list[list[object]], obstacles: list[list[object]], max_work: int | None = None) -> dict[str, object]:
    return {"queries": queries, "obstacles": obstacles,
            "maxWork": len(queries) * len(obstacles) if max_work is None else max_work}


def build() -> dict[str, object]:
    if not CATALOG.is_file():
        raise FileNotFoundError("Root must create the nearest-contact catalog before vectors are generated")
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    cases: list[dict[str, object]] = []

    def success(case_id: str, queries: list[list[object]], obstacles: list[list[object]]) -> None:
        cases.append({"id": case_id, "input": input_value(queries, obstacles),
                      "output": expected(queries, obstacles)})

    def error(case_id: str, value: dict[str, object], code: str,
              details: dict[str, object] | None = None) -> None:
        row: dict[str, object] = {"id": case_id, "input": value, "error": code}
        if details is not None:
            row["error_details"] = details
        cases.append(row)

    horizontal = [0, 0, 10, 0]
    success("crossing", [horizontal], [[3, -2, 3, 2]])
    success("query-start-endpoint", [horizontal], [[0, -2, 0, 2]])
    success("query-endpoint", [horizontal], [[10, -2, 10, 2]])
    success("obstacle-endpoint", [horizontal], [[3, 0, 3, 4]])
    success("origin-contact", [horizontal], [[0, 0, 5, 0], [3, -2, 3, 2]])
    success("collinear-overlap-onset", [horizontal], [[3, 0, 7, 0]])
    success("reverse-collinear-overlap", [[10, 0, 0, 0]], [[3, 0, 7, 0]])
    success("point-obstacle", [horizontal], [[3, 0, 3, 0]])
    success("point-query-on-segment", [[3, 0, 3, 0]], [[0, 0, 10, 0]])
    success("point-query-miss", [[3, 1, 3, 1]], [[0, 0, 10, 0]])
    success("empty-queries", [], [[0, 0, 1, 1]])
    success("empty-obstacles", [horizontal], [])
    success("ordinary-miss", [horizontal], [[3, 1, 7, 1]])
    success("stable-exact-tie", [horizontal], [[3, -2, 3, 2], [3, -4, 3, 4]])

    success("mixed-hit-miss-order", [horizontal, [0,4,10,4], [3,0,3,0]], [[3,-2,3,2]])
    success("signed-zero-origin", [[-0.0,0.0,1,0]], [[0,-1,0,1]])
    success("collinear-touch-at-end", [horizontal], [[10,0,12,0]])
    success("identical-point-segments", [[2,3,2,3]], [[2,3,2,3]])

    shifted = [0, -1, 1, 1 - 2 ** -53]
    centered = [0, -1, 1, 1]
    shifted_contact = contact([0, 0, 1, 0], shifted)
    centered_contact = contact([0, 0, 1, 0], centered)
    assert shifted_contact is not None and centered_contact is not None
    assert centered_contact[0] < shifted_contact[0]
    assert rounded(centered_contact[0]) == rounded(shifted_contact[0])
    success("rounded-collision-uses-exact-order", [[0, 0, 1, 0]], [shifted, centered])
    success("reverse-directed-crossing", [[10, 0, 0, 0]], [[3, -2, 3, 2]])

    tiny = float.fromhex("0x0.0000000000001p-1022")
    parameter_collapse = input_value([[0, 0, 1e308, 0]], [[tiny, -1, tiny, 1]])
    exact_parameter = nearest(parameter_collapse["queries"][0], parameter_collapse["obstacles"])
    assert exact_parameter is not None and exact_parameter[0] > 0
    assert rounded(exact_parameter[0]) == 0.0
    error("interior-parameter-collapse", parameter_collapse, "REPRESENTATION_COLLAPSE",
          {"queryIndex": 0, "stage": "parameter"})

    origin = 1e16
    adjacent = origin + 2.0
    point_collapse = input_value([[origin, 0.0, adjacent, 0.0]], [[origin, -1.0, adjacent, 1.0]])
    exact_point_hit = nearest(point_collapse["queries"][0], point_collapse["obstacles"])
    assert exact_point_hit is not None and exact_point_hit[0] == Fraction(1, 2)
    point_value = exact_point(point_collapse["queries"][0], exact_point_hit[0])[0]
    assert rounded(point_value) == origin
    error("interior-point-collapse", point_collapse, "REPRESENTATION_COLLAPSE",
          {"queryIndex": 0, "stage": "point"})

    base = input_value([horizontal], [[3, -2, 3, 2]])
    invalid_query = copy.deepcopy(base)
    invalid_query["queries"].append([0, 0, True, 1])
    invalid_query["maxWork"] = 0
    error("late-invalid-query-before-work", invalid_query, "INVALID_INPUT")
    invalid_obstacle = copy.deepcopy(base)
    invalid_obstacle["obstacles"].append([0, 0, "bad", 1])
    invalid_obstacle["maxWork"] = 0
    error("late-invalid-obstacle-before-work", invalid_obstacle, "INVALID_INPUT")
    invalid_limit = copy.deepcopy(base)
    invalid_limit["maxWork"] = -1
    error("invalid-work-limit-before-work", invalid_limit, "INVALID_INPUT")
    work_limit = input_value([horizontal, [0, 0, 0, 10]], [[3, -2, 3, 2], [7, -2, 7, 2]], 3)
    error("work-limit-before-contact", work_limit, "WORK_LIMIT_EXCEEDED")

    return {
        "operation": catalog["id"],
        "version": catalog["version"],
        "fixture_status": "reviewed",
        "fixture_format": "exact-json-output",
        "comparison": "exact",
        "catalog_sha256": digest(CATALOG),
        "source_bindings": {
            "tools/diagnostics/clipping/nearest_hit_study.py": digest(Path(__file__).with_name("nearest_hit_study.py")),
            str(Path(__file__).resolve().relative_to(ROOT)): digest(Path(__file__).resolve()),
            "tools/diagnostics/clipping/closed_contact_study.py": digest(
                Path(__file__).with_name("closed_contact_study.py")),
        },
        "cases": cases,
    }


def main() -> None:
    value = build()
    OUTPUT.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print("Wrote {} reviewed nearest-contact fixtures".format(len(value["cases"])))


if __name__ == "__main__":
    main()
