"""Caller-directed retained rectangular regions with stable never-reused identities.

Implements layout.retained-rectangle-cuts-2d 0.1.0. Independently specified from
survey/out/2019/generativos/griton/notes.md. The motivating work supplies retained
unequal regions; its source-specific selection, ratios, omission, drawing, and random
behavior are outside this operation.
"""
import math
from types import MappingProxyType

__all__ = ["RectangleCutError", "RetainedRectangleCuts2D", "retained_rectangle_cuts_2d"]

_MAX_LEAF_ID = 9007199254740990
_EXHAUSTED_NEXT_ID = 9007199254740991


class RectangleCutError(ValueError):
    """Stable catalog code for retained-rectangle-cuts-2d."""
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _invalid_input():
    raise RectangleCutError("INVALID_INPUT")


def _unknown_id():
    raise RectangleCutError("UNKNOWN_ID")


def _invalid_cut():
    raise RectangleCutError("INVALID_CUT")


def _limit_exceeded():
    raise RectangleCutError("LIMIT_EXCEEDED")


def _zero(value):
    return 0.0 if value == 0.0 else value


def _coordinate(value):
    if type(value) not in (int, float):
        _invalid_input()
    value = float(value)
    if not math.isfinite(value):
        _invalid_input()
    return _zero(value)


def _checked_id(identity):
    if type(identity) is not int or isinstance(identity, bool) or not 0 <= identity <= _MAX_LEAF_ID:
        raise RectangleCutError("INVALID_ID")
    return identity


def _leaf_value(identity, left, top, right, bottom):
    return MappingProxyType({"id": identity, "bounds": (left, top, right, bottom)})


class RetainedRectangleCuts2D:
    """Mutable retained rectangle-cut model. Not thread-safe; single-writer only."""
    __slots__ = ("_leaves", "_next_id")

    def __init__(self, left, top, right, bottom):
        self._leaves = {0: _leaf_value(0, left, top, right, bottom)}
        self._next_id = 1

    def cut(self, identity, axis, coord):
        """Replace a live leaf with low-coordinate then high-coordinate children."""
        _checked_id(identity)
        parent = self._leaves.get(identity)
        if parent is None:
            _unknown_id()
        if axis not in ("X", "Y"):
            _invalid_input()
        if type(coord) not in (int, float):
            _invalid_input()
        coord = float(coord)
        if not math.isfinite(coord):
            _invalid_input()
        coord = _zero(coord)
        cut_x = axis == "X"
        pl, pt, pr, pb = parent["bounds"]
        low = pl if cut_x else pt
        high = pr if cut_x else pb
        if not (coord > low and coord < high):
            _invalid_cut()
        if len(self._leaves) >= 2147483647 or self._next_id > _EXHAUSTED_NEXT_ID - 2:
            _limit_exceeded()

        low_id, high_id = self._next_id, self._next_id + 1
        if cut_x:
            low_leaf = _leaf_value(low_id, pl, pt, coord, pb)
            high_leaf = _leaf_value(high_id, coord, pt, pr, pb)
        else:
            low_leaf = _leaf_value(low_id, pl, pt, pr, coord)
            high_leaf = _leaf_value(high_id, pl, coord, pr, pb)
        del self._leaves[identity]
        self._leaves[low_id] = low_leaf
        self._leaves[high_id] = high_leaf
        self._next_id += 2
        return [low_id, high_id]

    def remove(self, identity):
        """Remove a live leaf without replacing it or changing later identity allocation."""
        _checked_id(identity)
        if self._leaves.pop(identity, None) is None:
            _unknown_id()

    def leaf(self, identity):
        """Return the immutable value for a live leaf."""
        _checked_id(identity)
        leaf = self._leaves.get(identity)
        if leaf is None:
            _unknown_id()
        return leaf

    def leaves(self):
        """Return a detached list in current live-leaf order."""
        return list(self._leaves.values())

    @property
    def size(self):
        return len(self._leaves)

    def to_values(self):
        """Materialize a fully detached mutable {nextId,leaves:[{id,bounds}]} snapshot."""
        leaves = [{"id": leaf["id"], "bounds": list(leaf["bounds"])} for leaf in self._leaves.values()]
        return {"nextId": self._next_id, "leaves": leaves}


def _create_validated(left, top, right, bottom):
    if not (left < right) or not (top < bottom):
        _invalid_input()
    width, height = right - left, bottom - top
    if not math.isfinite(width) or not math.isfinite(height):
        _invalid_input()
    return RetainedRectangleCuts2D(left, top, right, bottom)


def retained_rectangle_cuts_2d(config):
    """Create a root from exactly {"bounds": [left, top, right, bottom]}."""
    if type(config) is not dict or len(config) != 1 or "bounds" not in config:
        _invalid_input()
    raw_bounds = config["bounds"]
    if type(raw_bounds) is not list or len(raw_bounds) != 4:
        _invalid_input()
    left = _coordinate(raw_bounds[0])
    top = _coordinate(raw_bounds[1])
    right = _coordinate(raw_bounds[2])
    bottom = _coordinate(raw_bounds[3])
    return _create_validated(left, top, right, bottom)
