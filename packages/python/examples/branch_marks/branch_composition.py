"""Example-owned BranchMarks composition matching Java BranchComposition.

Motivation: survey/out/2018/Generativos/arbolito3/notes.md and
survey/out/2018/Generativos/arbolito4/notes.md. Rule schedules and root poses
are example choices, not measured encouraged ranges or operation defaults.
Circle placement reserves root space; it does not separate tree canopies.
"""
from dataclasses import dataclass
from procedurals.branch_tree import seeded_endpoint_branches_2d
from procedurals.placements import seeded_circle_placement_2d


@dataclass(frozen=True, slots=True)
class _BranchComposition:
    _trees: tuple
    _total: int
    @property
    def size(self): return len(self._trees)
    @property
    def total_segments(self): return self._total
    def tree_at(self, index): return self._trees[index]


def _rules(transitions, narrowing, binary, wider):
    rules = []
    for generation in range(transitions):
        spread = (0.18 if wider else 0.09) if binary else (0.9 if wider else 0.5)
        if narrowing: spread *= 1.0 - 0.08 * generation
        chance = 0.8 if binary else 0.7
        slots = [{"probability": chance, "turn": [-spread, -0.5 * spread]}, {"probability": chance, "turn": [0.5 * spread, spread]}]
        if not binary: slots.append({"probability": .4, "turn": [-.2 * spread, .2 * spread]})
        rules.append({"lengthScale": [.65, .85], "slots": slots})
    return rules


def _tree(seed, x, y, length, rules, maximum):
    return seeded_endpoint_branches_2d({"seed": seed, "root": {"origin": [x, y], "heading": -1.5707963267948966, "length": length}, "rules": rules, "maxSegments": maximum})


def create_branch_composition(seed, more_generations, narrowing, binary, wider, forest):
    """Build editable retained endpoint trees; choices are not operation defaults."""
    if type(seed) is not int or seed < 0 or seed > 0xffffffff or any(type(value) is not bool for value in (more_generations, narrowing, binary, wider, forest)):
        raise ValueError("example seed and flags are invalid")
    transitions = (5 if forest else 7) + (1 if more_generations else 0); slots = 2 if binary else 3; bound = 1; generation_bound = 1
    for _ in range(transitions): generation_bound *= slots; bound += generation_bound
    maximum_roots = 10 if forest else 1
    if bound * maximum_roots > 20_000: raise ValueError("example exceeds 20000-segment work budget")
    rules = _rules(transitions, narrowing, binary, wider); trees = []
    if forest:
        roots = seeded_circle_placement_2d({"seed": seed, "attempts": maximum_roots, "origin": [70.,220.], "extent": [500.,320.], "radiusRange": [30.,50.], "separationScale": 1.})
        origin = [0., 0.]
        for index in range(roots.size):
            roots.point_into(index, origin); trees.append(_tree((seed + index) & 0xffffffff, origin[0], origin[1], roots.radius_at(index), rules, bound))
    else: trees.append(_tree(seed, 320., 590., 100., rules, bound))
    return _BranchComposition(tuple(trees), sum(tree.size for tree in trees))
