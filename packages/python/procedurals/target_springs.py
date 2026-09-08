"""Ordered independent target-spring one-step transition independently specified
by the shared motion.target-springs-2d contract.

Motivating note: survey/out/2018/Generativos/araniaaas/notes.md (target force,
velocity and position update). No artistic strength/retention range is
established; see the catalog contract for evidence. Each call is a pure
one-step transition; feed a returned state back in as the next call's state
for animation.
"""
from array import array
import math

__all__ = ["SpringError", "target_springs_2d"]
_MAX_BODIES = 357913941
_MAX_SAFE = 9007199254740991


class SpringError(ValueError):
    """Stable catalog code, with body_index/axis/stage for SPRING_ARITHMETIC_INVALID."""
    def __init__(self, code, body_index=None, axis=None, stage=None):
        super().__init__(code)
        self.code = code
        if code == "SPRING_ARITHMETIC_INVALID":
            self.body_index = body_index
            self.axis = axis
            self.stage = stage


def _fail(code):
    raise SpringError(code)


def _zero(value):
    return 0.0 if value == 0 else value


def _number(value, code):
    if type(value) not in (int, float) or type(value) is bool:
        _fail(code)
    try:
        value = float(value)
    except OverflowError:
        raise SpringError(code) from None
    if not math.isfinite(value):
        _fail(code)
    return _zero(value)


def _strength_of(value):
    n = _number(value, "INVALID_INPUT")
    if n < 0:
        _fail("INVALID_INPUT")
    return n


def _retention_of(value):
    n = _number(value, "INVALID_INPUT")
    if n < 0 or n > 1:
        _fail("INVALID_INPUT")
    return n


def _pair(value, code):
    if type(value) is not list or len(value) != 2:
        _fail(code)
    return value


def _validate_body(supplied):
    if type(supplied) is not dict or set(supplied) != {"position", "velocity", "strength", "retention"}:
        _fail("INVALID_INPUT")
    position = _pair(supplied["position"], "INVALID_INPUT")
    _number(position[0], "INVALID_INPUT")
    _number(position[1], "INVALID_INPUT")
    velocity = _pair(supplied["velocity"], "INVALID_INPUT")
    _number(velocity[0], "INVALID_INPUT")
    _number(velocity[1], "INVALID_INPUT")
    _strength_of(supplied["strength"])
    _retention_of(supplied["retention"])


def _validate_target_pair(supplied):
    target = _pair(supplied, "INVALID_INPUT")
    _number(target[0], "INVALID_INPUT")
    _number(target[1], "INVALID_INPUT")


def _arithmetic(value, body_index, axis, stage):
    if not math.isfinite(value):
        raise SpringError("SPRING_ARITHMETIC_INVALID", body_index, axis, stage)
    return value


class _TargetSprings:
    """Immutable one-step result; see module docstring for the animation pattern."""
    __slots__ = ("_current", "_count")

    def __init__(self, current, count):
        self._current = current
        self._count = count

    @property
    def size(self):
        return self._count

    def _checked_index(self, index):
        if type(index) not in (int, float) or type(index) is bool:
            _fail("INVALID_INDEX")
        if type(index) is float and (not math.isfinite(index) or not index.is_integer()):
            _fail("INVALID_INDEX")
        if index < 0 or index > _MAX_SAFE:
            _fail("INVALID_INDEX")
        index = int(index)
        if index >= self._count:
            raise SpringError("INDEX_OUT_OF_RANGE")
        return index

    @staticmethod
    def _check_output(output, offset):
        if not (type(output) is list or (type(output) is array and output.typecode == "d" and output.itemsize == 8)):
            raise SpringError("INVALID_OUTPUT")
        if type(offset) not in (int, float) or type(offset) is bool:
            raise SpringError("INVALID_OUTPUT")
        if type(offset) is float and (not math.isfinite(offset) or not offset.is_integer()):
            raise SpringError("INVALID_OUTPUT")
        offset = int(offset)
        if offset < 0 or offset > len(output) - 2:
            raise SpringError("INVALID_OUTPUT")
        return offset

    def position_at(self, index):
        """Return a fresh detached [x, y] position."""
        i = self._checked_index(index)
        offset = i * 6
        return [self._current[offset], self._current[offset + 1]]

    def velocity_at(self, index):
        """Return a fresh detached [x, y] velocity."""
        i = self._checked_index(index)
        offset = i * 6
        return [self._current[offset + 2], self._current[offset + 3]]

    def position_into(self, index, output, offset=0):
        """Validate index and destination before writing; return output."""
        i = self._checked_index(index)
        offset = self._check_output(output, offset)
        source = i * 6
        output[offset] = self._current[source]
        output[offset + 1] = self._current[source + 1]
        return output

    def velocity_into(self, index, output, offset=0):
        """Validate index and destination before writing; return output."""
        i = self._checked_index(index)
        offset = self._check_output(output, offset)
        source = i * 6
        output[offset] = self._current[source + 2]
        output[offset + 1] = self._current[source + 3]
        return output

    def strength_at(self, index):
        return self._current[self._checked_index(index) * 6 + 4]

    def retention_at(self, index):
        return self._current[self._checked_index(index) * 6 + 5]

    def to_values(self):
        """Export detached output-schema state; retain no export objects."""
        bodies = []
        offset = 0
        for _ in range(self._count):
            bodies.append({
                "position": [self._current[offset], self._current[offset + 1]],
                "velocity": [self._current[offset + 2], self._current[offset + 3]],
                "strength": self._current[offset + 4],
                "retention": self._current[offset + 5],
            })
            offset += 6
        return {"bodies": bodies}


def _build_state(state):
    if type(state) is not dict or set(state) != {"bodies"}:
        _fail("INVALID_INPUT")
    bodies = state["bodies"]
    if type(bodies) is not list:
        _fail("INVALID_INPUT")
    if len(bodies) > _MAX_BODIES:
        _fail("INVALID_INPUT")
    count = len(bodies)
    for body in bodies:
        _validate_body(body)

    current = array("d", [0.0]) * (count * 6)
    offset = 0
    for body in bodies:
        position = _pair(body["position"], "INVALID_INPUT")
        velocity = _pair(body["velocity"], "INVALID_INPUT")
        current[offset] = _number(position[0], "INVALID_INPUT")
        current[offset + 1] = _number(position[1], "INVALID_INPUT")
        current[offset + 2] = _number(velocity[0], "INVALID_INPUT")
        current[offset + 3] = _number(velocity[1], "INVALID_INPUT")
        current[offset + 4] = _strength_of(body["strength"])
        current[offset + 5] = _retention_of(body["retention"])
        offset += 6
    return current, count


def _build_targets(targets, count):
    if type(targets) is not list or len(targets) != count:
        _fail("INVALID_INPUT")
    for item in targets:
        _validate_target_pair(item)
    captured = array("d", [0.0]) * (count * 2)
    offset = 0
    for item in targets:
        pair = _pair(item, "INVALID_INPUT")
        captured[offset] = _number(pair[0], "INVALID_INPUT")
        captured[offset + 1] = _number(pair[1], "INVALID_INPUT")
        offset += 2
    return captured


def target_springs_2d(config):
    """Advance an ordered independent target-spring state by one explicit logical
    step: target force, position using updated velocity, then velocity retention.

    Implements motion.target-springs-2d 0.1.0 independently of source code.
    """
    if type(config) is not dict or set(config) != {"state", "targets"}:
        _fail("INVALID_INPUT")
    current, count = _build_state(config["state"])
    captured = _build_targets(config["targets"], count)

    next_state = array("d", [0.0]) * (count * 6)
    state_offset = 0
    target_offset = 0
    for body in range(count):
        for axis, axis_offset in (("x", 0), ("y", 1)):
            delta = _arithmetic(captured[target_offset + axis_offset] - current[state_offset + axis_offset], body, axis, "delta")
            force = _arithmetic(delta * current[state_offset + 4], body, axis, "force")
            advanced = _arithmetic(current[state_offset + 2 + axis_offset] + force, body, axis, "advanced")
            position = _arithmetic(current[state_offset + axis_offset] + advanced, body, axis, "position")
            velocity = _arithmetic(advanced * current[state_offset + 5], body, axis, "velocity")
            next_state[state_offset + axis_offset] = _zero(position)
            next_state[state_offset + 2 + axis_offset] = _zero(velocity)
        next_state[state_offset + 4] = current[state_offset + 4]
        next_state[state_offset + 5] = current[state_offset + 5]
        state_offset += 6
        target_offset += 2
    return _TargetSprings(next_state, count)
