"""Retained endpoint branch geometry for frozen CP6 contracts."""
from array import array
from dataclasses import dataclass
import math

__all__ = ["BranchTreeError", "seeded_endpoint_branches_2d"]
_MAX_SEGMENTS = 357_913_941
_MAX_SAFE = 9_007_199_254_740_991
_MASK32 = (1 << 32) - 1
_MASK64 = (1 << 64) - 1


class BranchTreeError(ValueError):
    def __init__(self, code, parent_index=None, slot_index=None, stage=None):
        super().__init__(code); self.code = code
        if parent_index is not None: self.parent_index = parent_index
        if slot_index is not None: self.slot_index = slot_index
        if stage is not None: self.stage = stage


def _fail(code="INVALID_INPUT"): raise BranchTreeError(code)
def _dynamic(parent, slot, stage): raise BranchTreeError("BRANCH_ARITHMETIC_INVALID", parent, slot, stage)
def _limit(parent, slot): raise BranchTreeError("SEGMENT_LIMIT_EXCEEDED", parent, slot)
def _zero(value): return 0.0 if value == 0.0 else value
def _number(value):
    if type(value) not in (int, float): _fail()
    try: value = float(value)
    except OverflowError: _fail()
    if not math.isfinite(value): _fail()
    return _zero(value)
def _integer(value, maximum, code="INVALID_INPUT", minimum=0):
    if type(value) is int:
        if value < minimum or value > maximum: _fail(code)
        return value
    if type(value) is float and math.isfinite(value) and value.is_integer() and minimum <= value <= maximum: return int(value)
    _fail(code)
def _record(value, keys):
    if type(value) is not dict or len(value) != len(keys) or any(key not in value for key in keys): _fail()
    return value
def _pair(value):
    if type(value) is not list or len(value) != 2: _fail()
    return value
def _root(value):
    record = _record(value, ("origin", "heading", "length")); origin = _pair(record["origin"])
    x, y, heading, length = _number(origin[0]), _number(origin[1]), _number(record["heading"]), _number(record["length"])
    if length < 0: _fail()
    return x, y, heading, length
def _rules(value):
    if type(value) is not list: _fail()
    output = []
    for raw_rule in value:
        record = _record(raw_rule, ("lengthScale", "slots")); scale = _pair(record["lengthScale"])
        low, high = _number(scale[0]), _number(scale[1])
        if low < 0 or high < 0 or low > high: _fail()
        if type(record["slots"]) is not list: _fail()
        slots = []
        for raw_slot in record["slots"]:
            slot = _record(raw_slot, ("probability", "turn")); probability = _number(slot["probability"])
            if probability < 0 or probability > 1: _fail()
            turn = _pair(slot["turn"])
            turn_low, turn_high = _number(turn[0]), _number(turn[1])
            if turn_low > turn_high: _fail()
            slots.append((probability, turn_low, turn_high))
        output.append((low, high, tuple(slots)))
    return tuple(output)
def _lerp(low, high, unit):
    if unit == 0: return _zero(low)
    if unit == 1: return _zero(high)
    raw = low * (1.0 - unit) + high * unit if (low < 0 < high or high < 0 < low) else low + (high - low) * unit
    if raw < low: raw = low
    elif raw > high: raw = high
    return _zero(raw)


class _Stream:
    def __init__(self, seed):
        state = seed + 0x9E3779B97F4A7C15; first = self._split(state); second = self._split(state + 0x9E3779B97F4A7C15)
        self._state = [first & _MASK32, first >> 32, second & _MASK32, second >> 32]
    @staticmethod
    def _split(value):
        value &= _MASK64; value = ((value ^ (value >> 30)) * 0xBF58476D1CE4E5B9) & _MASK64; value = ((value ^ (value >> 27)) * 0x94D049BB133111EB) & _MASK64
        return (value ^ (value >> 31)) & _MASK64
    def output(self):
        s = self._state; value = (s[1] * 5) & _MASK32; result = ((((value << 7) | (value >> 25)) & _MASK32) * 9) & _MASK32; temporary = (s[1] << 9) & _MASK32
        s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= temporary; s[3] = ((s[3] << 11) | (s[3] >> 21)) & _MASK32
        return result
    def unit(self): return self.output() / 4294967296.0
    def state(self): return self._state.copy()


@dataclass(frozen=True, slots=True)
class _Result:
    _x0: array; _y0: array; _x1: array; _y1: array; _headings: array; _lengths: array; _parents: array; _generations: array; _children: array
    @property
    def size(self): return len(self._parents)
    def _index(self, index):
        index = _integer(index, _MAX_SAFE, "INVALID_INDEX")
        if index >= self.size: _fail("INDEX_OUT_OF_RANGE")
        return index
    def segment_at(self, index):
        index = self._index(index); return [_zero(self._x0[index]), _zero(self._y0[index]), _zero(self._x1[index]), _zero(self._y1[index])]
    def heading_at(self, index): return _zero(self._headings[self._index(index)])
    def length_at(self, index): return _zero(self._lengths[self._index(index)])
    def parent_at(self, index): return self._parents[self._index(index)]
    def generation_at(self, index): return self._generations[self._index(index)]
    def child_count_at(self, index): return self._children[self._index(index)]
    def segment_into(self, index, out, offset=0):
        index = self._index(index); offset = _integer(offset, _MAX_SAFE, "INVALID_OUTPUT")
        if not (type(out) is list or (type(out) is array and out.typecode == "d" and out.itemsize == 8)) or offset > len(out) - 4: _fail("INVALID_OUTPUT")
        out[offset], out[offset + 1], out[offset + 2], out[offset + 3] = _zero(self._x0[index]), _zero(self._y0[index]), _zero(self._x1[index]), _zero(self._y1[index])
    def to_values(self):
        return {"segments": [self.segment_at(i) for i in range(self.size)], "headings": [self.heading_at(i) for i in range(self.size)], "lengths": [self.length_at(i) for i in range(self.size)], "parents": [self.parent_at(i) for i in range(self.size)], "generations": [self.generation_at(i) for i in range(self.size)], "childCounts": [self.child_count_at(i) for i in range(self.size)]}


def seeded_endpoint_branches_2d(config):
    """Generate retained endpoint branches in breadth-first order.

    Motivation: survey/out/2018/Generativos/arbolito3/notes.md and
    survey/out/2018/Generativos/arbolito4/notes.md. Supply explicit generation
    rules; this operation defines no default or recommended artistic ranges.
    See catalog/operations/seeded-endpoint-branches.json for the frozen contract.
    """
    record = _record(config, ("seed", "root", "rules", "maxSegments")); seed = _integer(record["seed"], _MASK32); x, y, heading, length = _root(record["root"]); rules = _rules(record["rules"]); maximum = _integer(record["maxSegments"], _MAX_SEGMENTS, minimum=1)
    dx = _zero(math.cos(heading) * length)
    if not math.isfinite(dx): _dynamic(-1, -1, "delta_x")
    dy = _zero(math.sin(heading) * length)
    if not math.isfinite(dy): _dynamic(-1, -1, "delta_y")
    end_x = _zero(x + dx)
    if not math.isfinite(end_x): _dynamic(-1, -1, "position_x")
    end_y = _zero(y + dy)
    if not math.isfinite(end_y): _dynamic(-1, -1, "position_y")
    x0, y0, x1, y1, headings, lengths = (array("d") for _ in range(6)); parents, generations, children = (array("i") for _ in range(3))
    def append(a, b, c, d, h, l, parent, generation):
        x0.append(a); y0.append(b); x1.append(c); y1.append(d); headings.append(h); lengths.append(l); parents.append(parent); generations.append(generation); children.append(0)
    append(x, y, end_x, end_y, heading, length, -1, 0)
    if rules:
        stream = _Stream(seed); parent = 0
        while parent < len(parents):
            generation = generations[parent]
            if generation < len(rules):
                low, high, slots = rules[generation]; scale = _lerp(low, high, stream.unit())
                for slot_index, (probability, turn_low, turn_high) in enumerate(slots):
                    if not stream.unit() < probability: continue
                    if len(parents) >= maximum: _limit(parent, slot_index)
                    turn = _lerp(turn_low, turn_high, stream.unit()); child_length = _zero(lengths[parent] * scale)
                    if not math.isfinite(child_length): _dynamic(parent, slot_index, "length")
                    child_heading = _zero(headings[parent] + turn)
                    if not math.isfinite(child_heading): _dynamic(parent, slot_index, "heading")
                    child_dx = _zero(math.cos(child_heading) * child_length)
                    if not math.isfinite(child_dx): _dynamic(parent, slot_index, "delta_x")
                    child_dy = _zero(math.sin(child_heading) * child_length)
                    if not math.isfinite(child_dy): _dynamic(parent, slot_index, "delta_y")
                    child_x = _zero(x1[parent] + child_dx)
                    if not math.isfinite(child_x): _dynamic(parent, slot_index, "position_x")
                    child_y = _zero(y1[parent] + child_dy)
                    if not math.isfinite(child_y): _dynamic(parent, slot_index, "position_y")
                    append(x1[parent], y1[parent], child_x, child_y, child_heading, child_length, parent, generation + 1); children[parent] += 1
            parent += 1
    return _Result(x0, y0, x1, y1, headings, lengths, parents, generations, children)
