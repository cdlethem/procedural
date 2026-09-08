"""Delaunay triangulation independently specified by the shared delaunay-2d contract.

Motivating notes: survey/out/2018/Generativos/datata/notes.md (triangulator sites
as faces for fill and shading) and survey/out/2019/generativos/lightcity/notes.md.
The upstream float circumcircle/EPSILON behavior is deliberately replaced by the
contract's exact binary64 predicate, the defining difference of this operation.
No site sampling, palette, renderer or artistic range is established; see the
catalog contract for evidence.
"""
from array import array
from dataclasses import dataclass
import heapq
import math
import struct

__all__ = ["DelaunayError", "delaunay_2d"]
_MAX_POINTS = 357913943
_MAX_SAFE = 9007199254740991
_MIN_SUBNORMAL = 5e-324
_SIGNIFICAND_BIT = 1 << 52
_MANTISSA_MASK = (1 << 52) - 1


class DelaunayError(ValueError):
    """Stable catalog code, with stage/work_used for WORK_LIMIT_EXCEEDED."""
    def __init__(self, code, stage=None, work_used=None):
        super().__init__(code)
        self.code = code
        if code == "WORK_LIMIT_EXCEEDED":
            self.stage = stage
            self.work_used = work_used


def _number(value):
    if type(value) not in (int, float):
        raise DelaunayError("INVALID_INPUT")
    try:
        value = float(value)
    except OverflowError:
        raise DelaunayError("INVALID_INPUT") from None
    if not math.isfinite(value):
        raise DelaunayError("INVALID_INPUT")
    return 0.0 if value == 0 else value


def _integer(value, maximum, code):
    # Compare arbitrary-size integers before any float conversion or narrowing.
    if type(value) not in (int, float):
        raise DelaunayError(code)
    if type(value) is float and (not math.isfinite(value) or not value.is_integer()):
        raise DelaunayError(code)
    if not 0 <= value <= maximum:
        raise DelaunayError(code)
    return int(value)


def _pair(value):
    if type(value) is not list or len(value) != 2:
        raise DelaunayError("INVALID_INPUT")
    return _number(value[0]), _number(value[1])


def _double_bits(value):
    return struct.unpack("<q", struct.pack("<d", value))[0]


def _bits_to_double(bits):
    return struct.unpack("<d", struct.pack("<q", bits & ((1 << 64) - 1)))[0]


class _Budget:
    """Strict work counter: a charge exceeding the remaining limit fails first."""
    def __init__(self, maximum):
        self.maximum = maximum
        self.used = 0

    def charge(self, stage, cost):
        if cost > self.maximum - self.used:
            raise DelaunayError("WORK_LIMIT_EXCEEDED", stage=stage, work_used=self.used)
        self.used += cost


def next_up(value):
    if value == 0:
        return 0.0 if math.copysign(1.0, value) < 0 else _MIN_SUBNORMAL
    bits = _double_bits(value)
    return _bits_to_double(bits + 1 if value > 0 else bits - 1)


def _bits_to_double(bits):
    return struct.unpack("<d", struct.pack("<Q", bits & ((1 << 64) - 1)))[0]


def next_down(value):
    if value == 0:
        return -_MIN_SUBNORMAL
    bits = _double_bits(value)
    return _bits_to_double(bits - 1 if value > 0 else bits + 1)


class _D:
    """Exact finite binary64 dyadic n * 2^e; discarded before return."""
    __slots__ = ("n", "e")

    def __init__(self, n, e):
        self.n = n
        self.e = e

    @classmethod
    def of(cls, value):
        bits = _double_bits(value)
        negative = bits < 0
        exponent = (bits >> 52) & 0x7FF
        mantissa = bits & _MANTISSA_MASK
        if exponent == 0 and mantissa == 0:
            return cls(0, 0)
        if exponent == 0:
            return cls(-mantissa if negative else mantissa, -1074)
        significand = _SIGNIFICAND_BIT | mantissa
        return cls(-significand if negative else significand, exponent - 1075)

    def add(self, other):
        if self.n == 0:
            return other
        if other.n == 0:
            return self
        base = min(self.e, other.e)
        return _D((self.n << (self.e - base)) + (other.n << (other.e - base)), base)

    def subtract(self, other):
        if other.n == 0:
            return self
        base = min(self.e, other.e)
        return _D((self.n << (self.e - base)) - (other.n << (other.e - base)), base)

    def multiply(self, other):
        return _D(self.n * other.n, self.e + other.e)

    def sign(self):
        return -1 if self.n < 0 else 1 if self.n > 0 else 0


def product_lower(al, ah, bl, bh):
    return next_down(min(al * bl, al * bh, ah * bl, ah * bh))


def product_upper(al, ah, bl, bh):
    return next_up(max(al * bl, al * bh, ah * bl, ah * bh))


def orientation_filter(ax, ay, bx, by, cx, cy):
    """Returns 0 for an uncertified sign; the exact dyadic fallback must decide."""
    x1 = bx - ax
    y1 = by - ay
    x2 = cx - ax
    y2 = cy - ay
    if not (math.isfinite(x1) and math.isfinite(y1) and math.isfinite(x2) and math.isfinite(y2)):
        return 0
    xl1 = next_down(x1)
    xh1 = next_up(x1)
    yl1 = next_down(y1)
    yh1 = next_up(y1)
    xl2 = next_down(x2)
    xh2 = next_up(x2)
    yl2 = next_down(y2)
    yh2 = next_up(y2)
    if not (math.isfinite(xl1) and math.isfinite(xh1) and math.isfinite(yl1) and math.isfinite(yh1)
            and math.isfinite(xl2) and math.isfinite(xh2) and math.isfinite(yl2) and math.isfinite(yh2)):
        return 0
    left_low = product_lower(xl1, xh1, yl2, yh2)
    left_high = product_upper(xl1, xh1, yl2, yh2)
    right_low = product_lower(yl1, yh1, xl2, xh2)
    right_high = product_upper(yl1, yh1, xl2, xh2)
    if not (math.isfinite(left_low) and math.isfinite(left_high)
            and math.isfinite(right_low) and math.isfinite(right_high)):
        return 0
    lower = next_down(left_low - right_high)
    upper = next_up(left_high - right_low)
    if not (math.isfinite(lower) and math.isfinite(upper)):
        return 0
    return 1 if lower > 0 else -1 if upper < 0 else 0


def make_point(x, y):
    return (x, y, _D.of(x), _D.of(y))


def orient(points, a, b, c):
    pa, pb, pc = points[a], points[b], points[c]
    filtered = orientation_filter(pa[0], pa[1], pb[0], pb[1], pc[0], pc[1])
    if filtered != 0:
        return filtered
    left = pb[2].subtract(pa[2]).multiply(pc[3].subtract(pa[3]))
    right = pb[3].subtract(pa[3]).multiply(pc[2].subtract(pa[2]))
    return left.subtract(right).sign()


def incircle(pa, pb, pc, pd):
    ax = pa[2].subtract(pd[2])
    ay = pa[3].subtract(pd[3])
    bx = pb[2].subtract(pd[2])
    by = pb[3].subtract(pd[3])
    cx = pc[2].subtract(pd[2])
    cy = pc[3].subtract(pd[3])
    aa = ax.multiply(ax).add(ay.multiply(ay))
    bb = bx.multiply(bx).add(by.multiply(by))
    cc = cx.multiply(cx).add(cy.multiply(cy))
    left = aa.multiply(bx.multiply(cy).subtract(by.multiply(cx)))
    right = bb.multiply(ax.multiply(cy).subtract(ay.multiply(cx)))
    third = cc.multiply(ax.multiply(by).subtract(ay.multiply(bx)))
    return left.subtract(right).add(third).sign()


def face_third(face, x, y):
    for value in face:
        if value != x and value != y:
            return value
    raise AssertionError("missing opposite vertex")


def canonical_face(points, a, b, c):
    direction = orient(points, a, b, c)
    if direction == 0:
        raise AssertionError("zero-area face")
    b2, c2 = (c, b) if direction < 0 else (b, c)
    if a <= b2 and a <= c2:
        return (a, b2, c2)
    if b2 <= a and b2 <= c2:
        return (b2, c2, a)
    return (c2, a, b2)


def edge_key(a, b):
    low, high = (a, b) if a < b else (b, a)
    return (low << 32) | high


def edge_a(edge):
    return edge >> 32


def edge_b(edge):
    return edge & 0xFFFFFFFF


class _MinQueue:
    """Set with lexicographic minimum extraction; an endpoint pair occurs at most once while queued."""
    def __init__(self):
        self._heap = []
        self._present = set()
        self._sequence = 0

    def add(self, key):
        if key in self._present:
            return
        self._present.add(key)
        heapq.heappush(self._heap, (key, self._sequence))
        self._sequence += 1

    def poll(self):
        key, _ = heapq.heappop(self._heap)
        self._present.discard(key)
        return key

    def __len__(self):
        return len(self._heap)


class _ActiveFaces:
    """Creation-ordered active face sequence plus local undirected-edge incidence.

    Node identities grow monotonically even though every live topology index is
    within the public int limit; owners of one edge are always ascending ids.
    Nodes are [face, id, previous, next].
    """
    def __init__(self):
        self.nodes = {}
        self.incidence = {}
        self.head = None
        self.tail = None
        self.next_id = 0

    def node(self, id):
        result = self.nodes.get(id)
        if result is None:
            raise AssertionError("dead face reference")
        return result

    def append_sorted(self, faces):
        ids = []
        for face in sorted(faces):
            id = self.next_id
            self.next_id += 1
            node = [face, id, self.tail, None]
            self.nodes[id] = node
            if self.tail is None:
                self.head = id
            else:
                self.nodes[self.tail][3] = id
            self.tail = id
            self._add_edges(id, face)
            ids.append(id)
        return ids

    def _add_edges(self, id, face):
        for i in range(3):
            key = edge_key(face[i], face[(i + 1) % 3])
            owners = self.incidence.get(key)
            if owners is None:
                owners = []
                self.incidence[key] = owners
            owners.append(id)
            if len(owners) > 2:
                raise AssertionError("nonmanifold edge")

    def remove(self, id):
        node = self.nodes.get(id)
        if node is None:
            raise AssertionError("dead face")
        del self.nodes[id]
        face = node[0]
        for i in range(3):
            key = edge_key(face[i], face[(i + 1) % 3])
            owners = self.incidence[key]
            owners.remove(id)
            if not owners:
                del self.incidence[key]
        previous, next_id = node[2], node[3]
        if previous is None:
            self.head = next_id
        else:
            self.nodes[previous][3] = next_id
        if next_id is None:
            self.tail = previous
        else:
            self.nodes[next_id][2] = previous

    def replace(self, removed, fresh):
        for id in sorted(removed):
            self.remove(id)
        return self.append_sorted(fresh)

    def sorted_faces(self):
        faces = []
        id = self.head
        while id is not None:
            faces.append(self.nodes[id][0])
            id = self.nodes[id][3]
        return sorted(faces)


def canonicalize(originals):
    order = sorted(range(len(originals)), key=lambda i: (originals[i][0], originals[i][1]))
    points = []
    source_indices = []
    input_to_vertex = [0] * len(originals)
    previous_bits_x = None
    previous_bits_y = None
    for source in order:
        point = originals[source]
        bits_x = _double_bits(point[0])
        bits_y = _double_bits(point[1])
        if previous_bits_x is None or bits_x != previous_bits_x or bits_y != previous_bits_y:
            points.append(point)
            source_indices.append(source)
            previous_bits_x = bits_x
            previous_bits_y = bits_y
        input_to_vertex[source] = len(points) - 1
    return {"points": points, "inputToVertex": input_to_vertex, "sourceIndices": source_indices}


def hull_chain(points, reverse, budget, stage):
    chain = []
    step = -1 if reverse else 1
    index = len(points) - 1 if reverse else 0
    stop = -1 if reverse else len(points)
    while index != stop:
        while len(chain) >= 2:
            budget.charge(stage, 1)
            if orient(points, chain[-2], chain[-1], index) <= 0:
                chain.pop()
            else:
                break
        chain.append(index)
        index += step
    return chain


def strict_hull(points, budget):
    lower = hull_chain(points, False, budget, "hull_lower")
    upper = hull_chain(points, True, budget, "hull_upper")
    lower.pop()
    upper.pop()
    lower.extend(upper)
    return lower


def insert(points, active, site, budget):
    found = -1
    sign0 = sign1 = sign2 = 0
    id = active.head
    while id is not None:
        budget.charge("locate", 1)
        face = active.node(id)[0]
        candidate0 = orient(points, face[0], face[1], site)
        candidate1 = orient(points, face[1], face[2], site)
        candidate2 = orient(points, face[2], face[0], site)
        if candidate0 >= 0 and candidate1 >= 0 and candidate2 >= 0:
            found = id
            sign0, sign1, sign2 = candidate0, candidate1, candidate2
            break
        id = active.nodes[id][3]
    if found < 0:
        raise AssertionError("no containing active face")
    found_face = active.node(found)[0]
    zeros = 0
    zero_index = -1
    if sign0 == 0:
        zeros += 1
        zero_index = 0
    if sign1 == 0:
        zeros += 1
        zero_index = 1
    if sign2 == 0:
        zeros += 1
        zero_index = 2
    replacement = []
    removed = []
    if zeros == 0:
        replacement.append(canonical_face(points, found_face[0], found_face[1], site))
        replacement.append(canonical_face(points, found_face[1], found_face[2], site))
        replacement.append(canonical_face(points, found_face[2], found_face[0], site))
        removed.append(found)
    else:
        if zeros != 1:
            raise AssertionError("distinct site touches more than one face edge")
        edge_start = found_face[zero_index]
        edge_end = found_face[(zero_index + 1) % 3]
        owners = active.incidence.get(edge_key(edge_start, edge_end))
        if owners is None or len(owners) < 1 or len(owners) > 2:
            raise AssertionError("invalid edge incidence")
        for owner in owners:
            old = active.node(owner)[0]
            other = face_third(old, edge_start, edge_end)
            replacement.append(canonical_face(points, edge_start, site, other))
            replacement.append(canonical_face(points, site, edge_end, other))
            removed.append(owner)
    active.replace(removed, replacement)


def legalize(points, active, budget):
    queue = _MinQueue()
    for key, owners in active.incidence.items():
        if len(owners) == 2:
            queue.add(key)
    while len(queue) > 0:
        budget.charge("legalize", 1)
        item = queue.poll()
        owners = active.incidence.get(item)
        if owners is None or len(owners) != 2:
            continue
        first = active.node(owners[0])[0]
        second = active.node(owners[1])[0]
        u = edge_a(item)
        v = edge_b(item)
        first_opposite = face_third(first, u, v)
        second_opposite = face_third(second, u, v)
        left = first_opposite if orient(points, u, v, first_opposite) > 0 else second_opposite
        right = second_opposite if left == first_opposite else first_opposite
        if orient(points, u, v, left) <= 0 or orient(points, u, v, right) >= 0:
            raise AssertionError("inconsistent edge sides")
        if orient(points, left, right, u) * orient(points, left, right, v) >= 0:
            continue
        determinant = incircle(points[u], points[v], points[left], points[right])
        replacement = edge_key(left, right)
        if determinant < 0 or (determinant == 0 and replacement >= item):
            continue
        faces = [canonical_face(points, left, right, u), canonical_face(points, right, left, v)]
        appended = active.replace([owners[0], owners[1]], faces)
        for id in appended:
            face = active.node(id)[0]
            for edge in range(3):
                key = edge_key(face[edge], face[(edge + 1) % 3])
                current = active.incidence.get(key)
                if current is not None and len(current) == 2:
                    queue.add(key)


def _add_output_edge(incidence, key, face_index):
    values = incidence.get(key)
    if values is None:
        incidence[key] = [face_index, -1]
        return
    if values[1] != -1:
        raise AssertionError("nonmanifold final edge")
    values[1] = face_index


@dataclass(frozen=True, slots=True)
class _Delaunay2D:
    _points: list
    _input_to_vertex: list
    _source_indices: list
    _triangles: list
    _edges: list
    _edge_faces: list
    _work_used: int

    @property
    def input_count(self):
        return len(self._input_to_vertex)

    @property
    def vertex_count(self):
        return len(self._points) // 2

    @property
    def face_count(self):
        return len(self._triangles) // 3

    @property
    def edge_count(self):
        return len(self._edges) // 2

    @property
    def work_used(self):
        return self._work_used

    def _index(self, index, count):
        index = _integer(index, _MAX_SAFE, "INVALID_INDEX")
        if index >= count:
            raise DelaunayError("INDEX_OUT_OF_RANGE")
        return index

    def _check_destination(self, out, offset, width):
        offset = _integer(offset, _MAX_SAFE, "INVALID_OUTPUT")
        # Exact lists and array('d') have writable fixed binary64 slots.  Both
        # checks precede either assignment, so a failure cannot partly mutate out.
        if not (type(out) is list or (type(out) is array and out.typecode == "d" and out.itemsize == 8)):
            raise DelaunayError("INVALID_OUTPUT")
        if offset > len(out) - width:
            raise DelaunayError("INVALID_OUTPUT")
        return offset

    def point_at(self, index):
        """Return detached [x, y] binary64 coordinates."""
        i = self._index(index, self.vertex_count) * 2
        return [self._points[i], self._points[i + 1]]

    def triangle_at(self, index):
        """Return a fresh detached canonical (a, b, c) vertex triple."""
        i = self._index(index, self.face_count) * 3
        return [self._triangles[i], self._triangles[i + 1], self._triangles[i + 2]]

    def edge_at(self, index):
        """Return a fresh detached canonical [lowVertex, highVertex] edge."""
        i = self._index(index, self.edge_count) * 2
        return [self._edges[i], self._edges[i + 1]]

    def edge_faces_at(self, index):
        """Return a fresh detached pair of final incident-face indices."""
        i = self._index(index, self.edge_count) * 2
        return [self._edge_faces[i], self._edge_faces[i + 1]]

    def point_into(self, index, out, offset=0):
        """Validate access and both destination slots before writing; return out."""
        i = self._index(index, self.vertex_count) * 2
        offset = self._check_destination(out, offset, 2)
        out[offset] = self._points[i]
        out[offset + 1] = self._points[i + 1]
        return out

    def triangle_into(self, index, out, offset=0):
        """Validate access and all three destination slots before writing; return out."""
        i = self._index(index, self.face_count) * 3
        offset = self._check_destination(out, offset, 3)
        out[offset] = self._triangles[i]
        out[offset + 1] = self._triangles[i + 1]
        out[offset + 2] = self._triangles[i + 2]
        return out

    def edge_into(self, index, out, offset=0):
        """Validate access and both destination slots before writing; return out."""
        i = self._index(index, self.edge_count) * 2
        offset = self._check_destination(out, offset, 2)
        out[offset] = self._edges[i]
        out[offset + 1] = self._edges[i + 1]
        return out

    def edge_faces_into(self, index, out, offset=0):
        """Validate access and both destination slots before writing; return out."""
        i = self._index(index, self.edge_count) * 2
        offset = self._check_destination(out, offset, 2)
        out[offset] = self._edge_faces[i]
        out[offset + 1] = self._edge_faces[i + 1]
        return out

    def input_vertex_at(self, index):
        """Return the canonical vertex index for a source input position."""
        return self._input_to_vertex[self._index(index, self.input_count)]

    def source_index_at(self, index):
        """Return the source input position for a canonical vertex."""
        return self._source_indices[self._index(index, self.vertex_count)]

    def to_values(self):
        """Export detached points, maps, triangles, edges, faces and work; retain none."""
        return {
            "points": [self.point_at(i) for i in range(self.vertex_count)],
            "inputToVertex": list(self._input_to_vertex),
            "sourceIndices": list(self._source_indices),
            "triangles": [self.triangle_at(i) for i in range(self.face_count)],
            "edges": [self.edge_at(i) for i in range(self.edge_count)],
            "edgeFaces": [self.edge_faces_at(i) for i in range(self.edge_count)],
            "workUsed": self._work_used,
        }


def _empty_result(canonical, work_used):
    points = []
    for point in canonical["points"]:
        points.append(point[0])
        points.append(point[1])
    return _Delaunay2D(points, canonical["inputToVertex"], canonical["sourceIndices"],
                       [], [], [], work_used)


def finish(canonical, active, work_used):
    faces = active.sorted_faces()
    triangles = []
    incidence = {}
    for i, face in enumerate(faces):
        triangles.extend(face)
        _add_output_edge(incidence, edge_key(face[0], face[1]), i)
        _add_output_edge(incidence, edge_key(face[1], face[2]), i)
        _add_output_edge(incidence, edge_key(face[2], face[0]), i)
    edges = []
    edge_faces = []
    for key in sorted(incidence):
        face_indexes = incidence[key]
        edges.append(edge_a(key))
        edges.append(edge_b(key))
        edge_faces.append(face_indexes[0])
        edge_faces.append(face_indexes[1])
    points = []
    for point in canonical["points"]:
        points.append(point[0])
        points.append(point[1])
    return _Delaunay2D(points, canonical["inputToVertex"], canonical["sourceIndices"],
                       triangles, edges, edge_faces, work_used)


def delaunay_2d(config):
    """Build retained exact planar Delaunay topology from an ordered finite binary64
    site list and explicit deterministic work budget.

    Implements topology.delaunay-2d 0.1.0 independently of source code.
    No drawing or clipping occurs; the catalog contract is the specification.
    """
    if type(config) is not dict or set(config) != {"points", "maxWork"}:
        raise DelaunayError("INVALID_INPUT")
    supplied_points = config["points"]
    if type(supplied_points) is not list:
        raise DelaunayError("INVALID_INPUT")
    count = len(supplied_points)
    if count > _MAX_POINTS:
        raise DelaunayError("INVALID_INPUT")
    max_work = _integer(config["maxWork"], _MAX_SAFE, "INVALID_INPUT")

    # Complete static validation before the canonicalize atomic charge.
    packed = [0.0] * (2 * count)
    for i in range(count):
        packed[2 * i], packed[2 * i + 1] = _pair(supplied_points[i])

    budget = _Budget(max_work)
    budget.charge("canonicalize", count)
    originals = [make_point(packed[2 * i], packed[2 * i + 1]) for i in range(count)]
    canonical = canonicalize(originals)
    if len(canonical["points"]) < 3:
        return _empty_result(canonical, budget.used)

    hull = strict_hull(canonical["points"], budget)
    if len(hull) < 3:
        return _empty_result(canonical, budget.used)

    active = _ActiveFaces()
    root = hull[0]
    fan = [canonical_face(canonical["points"], root, hull[i], hull[i + 1])
           for i in range(1, len(hull) - 1)]
    active.append_sorted(fan)

    corner = [False] * len(canonical["points"])
    for value in hull:
        corner[value] = True
    for site in range(len(canonical["points"])):
        if not corner[site]:
            insert(canonical["points"], active, site, budget)
    legalize(canonical["points"], active, budget)
    return finish(canonical, active, budget.used)
