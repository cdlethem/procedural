"""Example-owned composition: an editable seed-stroke policy for the retained
topology.seeded-line-pool-2d operation.

Motivated by 2019/generativos/brotes; independently drawn here (see catalog/validation/
seeded-line-pool-2d.json, targets.processing-java.technique). All mutable cutting is
performed by the public operation; rendering and interactive controls belong to a
target starter. These constants (seed stroke endpoints, attempt budgets, angle scales,
palette) describe one bounded piece, never public operation defaults or encouraged
ranges.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterator

from procedurals import seeded_line_pool_2d

COLORS = (0xEBEBEB, 0xE9CA54, 0x749AB2, 0xEB4313)
BACKGROUND_RGB = 0x0A0A15
DEFAULT_SEED = 42


@dataclass(frozen=True, slots=True)
class CutBranchMarks:
    """Retained line pool for style-only colour edits; A/W/T/R/0 all rebuild."""
    seed: int
    narrow: bool
    sparse: bool
    alternate: bool
    pool: object


def create_cut_branch_marks(seed: int = DEFAULT_SEED, narrow: bool = False,
                            sparse: bool = False, alternate: bool = False) -> CutBranchMarks:
    segment = [180.0, 760.0, 760.0, 240.0] if alternate else [480.0, 850.0, 480.0, 200.0]
    pool = seeded_line_pool_2d({
        "seed": seed,
        "segment": segment,
        "attempts": 9000 if sparse else 90000,
        "firstCutAngleScale": 0.7 if narrow else 1.4,
        "minCutLength": 4.0,
        "maxSegments": 180001,
    })
    return CutBranchMarks(seed, narrow, sparse, alternate, pool)


def cut_branch_commands(model: CutBranchMarks, color_index: int) -> Iterator[dict]:
    """Yield one capped line segment per retained pool segment, in pool order."""
    rgb = COLORS[color_index % len(COLORS)]
    scratch = [0.0, 0.0, 0.0, 0.0]
    for i in range(model.pool.size):
        model.pool.segment_into(i, scratch)
        if scratch[0] == scratch[2] and scratch[1] == scratch[3]:
            continue
        yield {"kind": "segment2", "from": [scratch[0], scratch[1]], "to": [scratch[2], scratch[3]],
               "rgb": rgb, "opacity8": 100, "width": 1, "cap": "round"}
