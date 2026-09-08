#!/usr/bin/env python3
"""Independent CP11 draft-fixture oracle; it imports no public-core implementation."""

from __future__ import annotations

import json
from typing import Final

MASK32: Final = (1 << 32) - 1
MASK64: Final = (1 << 64) - 1
GAMMA: Final = 0x9E3779B97F4A7C15
MIX_A: Final = 0xBF58476D1CE4E5B9
MIX_B: Final = 0x94D049BB133111EB


def rotl32(value: int, count: int) -> int:
    value &= MASK32
    return ((value << count) | (value >> (32 - count))) & MASK32


def splitmix64_next(state: int) -> tuple[int, int]:
    state = (state + GAMMA) & MASK64
    value = state
    value = ((value ^ (value >> 30)) * MIX_A) & MASK64
    value = ((value ^ (value >> 27)) * MIX_B) & MASK64
    return state, (value ^ (value >> 31)) & MASK64


def expand_seed(seed: int) -> list[int]:
    state, first = splitmix64_next(seed & MASK32)
    state, second = splitmix64_next(state)
    result = [first & MASK32, first >> 32, second & MASK32, second >> 32]
    assert any(result)
    return result


class Stream:
    def __init__(self, random: dict[str, object]) -> None:
        self.words = (expand_seed(int(random["seed"])) if "seed" in random
                      else [int(word) for word in random["state"]])

    def next_u32(self) -> int:
        s0, s1, s2, s3 = self.words
        result = (rotl32((s1 * 5) & MASK32, 7) * 9) & MASK32
        transient = (s1 << 9) & MASK32
        s2 ^= s0
        s3 ^= s1
        s1 ^= s2
        s0 ^= s3
        s2 ^= transient
        s3 = rotl32(s3, 11)
        self.words = [s0 & MASK32, s1 & MASK32, s2 & MASK32, s3 & MASK32]
        return result


def walk(config: dict[str, object]) -> dict[str, object]:
    """Straightforward frozen transition for valid, admitted fixture inputs only."""
    columns, rows = config["dimensions"]
    starts = config["starts"]
    max_steps = config["maxSteps"]
    assert len(starts) * (max_steps + 1) <= config["maxCells"]
    stream = Stream(config["random"])
    occupied: set[tuple[int, int]] = set()
    paths: list[list[list[int]]] = []
    reasons: list[str] = []
    for start in starts:
        x, y = start
        cell = (x, y)
        if cell in occupied:
            paths.append([])
            reasons.append("occupied-start")
            continue
        occupied.add(cell)
        path = [[x, y]]
        paths.append(path)
        if max_steps == 0:
            reasons.append("step-limit")
            continue
        for _ in range(max_steps):
            candidates = []
            for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
                candidate = (x + dx, y + dy)
                if 0 <= candidate[0] < columns and 0 <= candidate[1] < rows and candidate not in occupied:
                    candidates.append(candidate)
            if not candidates:
                reasons.append("blocked")
                break
            selected = (stream.next_u32() * len(candidates)) // (1 << 32)
            x, y = candidates[selected]
            occupied.add((x, y))
            path.append([x, y])
        else:
            reasons.append("step-limit")
    return {"paths": paths, "completionReasons": reasons, "randomState": stream.words}


CASES: Final = {
    "empty-zero-capacity": {"dimensions": [2, 2], "starts": [], "maxSteps": 0, "maxCells": 0, "random": {"seed": 0}},
    "zero-step-reserves-start": {"dimensions": [3, 3], "starts": [[1, 1]], "maxSteps": 0, "maxCells": 1, "random": {"seed": 42}},
    "boundary-blocked-no-word": {"dimensions": [1, 1], "starts": [[0, 0]], "maxSteps": 4, "maxCells": 5, "random": {"seed": 1}},
    "one-option-consumes-word": {"dimensions": [2, 1], "starts": [[0, 0]], "maxSteps": 1, "maxCells": 2, "random": {"seed": 1}},
    "nesw-four-option-choice": {"dimensions": [3, 3], "starts": [[1, 1]], "maxSteps": 1, "maxCells": 2, "random": {"seed": 42}},
    "nesw-three-option-edge-choice": {"dimensions": [3, 2], "starts": [[1, 0]], "maxSteps": 1, "maxCells": 2, "random": {"seed": 42}},
    "duplicate-start-no-extra-word": {"dimensions": [2, 1], "starts": [[0, 0], [0, 0]], "maxSteps": 1, "maxCells": 4, "random": {"seed": 1}},
    "shared-occupancy-ordered-batch": {"dimensions": [3, 2], "starts": [[0, 0], [2, 0], [1, 0]], "maxSteps": 2, "maxCells": 9, "random": {"seed": 42}},
    "returned-state-continuation": {"dimensions": [2, 2], "starts": [[0, 0]], "maxSteps": 2, "maxCells": 3, "random": {"state": [1701425161, 3372249897, 2716073615, 1081377227]}},
    "maximum-dimensions-sparse": {"dimensions": [2147483647, 2147483647], "starts": [[2147483646, 2147483646]], "maxSteps": 0, "maxCells": 1, "random": {"seed": 2147483648}}
}


def main() -> None:
    print(json.dumps({name: {"input": config, "output": walk(config)} for name, config in CASES.items()}, indent=2))


if __name__ == "__main__":
    main()
