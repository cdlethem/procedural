"""Retained CP7 radial-profile surfaces; no renderer or drawing state."""
from array import array
from dataclasses import dataclass
import math
__all__ = ['RadialProfileError', 'RadialProfile3D']
MAX = 715827881
SAFE = 9007199254740991
TAU = 6.283185307179586

class RadialProfileError(ValueError):

    def __init__(self, code, face_index=None, stage=None):
        super().__init__(code)
        self.code = code
        if face_index is not None:
            self.face_index = face_index
        if stage is not None:
            self.stage = stage

def bad(code='INVALID_INPUT'):
    raise RadialProfileError(code)

def dyn(face, stage):
    raise RadialProfileError('MESH_ARITHMETIC_INVALID', face, stage)

def zero(x):
    return 0.0 if x == 0 else x

def number(x):
    if type(x) not in (int, float):
        bad()
    try:
        x = float(x)
    except OverflowError:
        bad()
    if not math.isfinite(x):
        bad()
    return zero(x)

def integer(x, low, high, code='INVALID_INPUT'):
    if type(x) is int and low <= x <= high:
        return x
    if type(x) is float and math.isfinite(x) and x.is_integer() and (low <= x <= high):
        return int(x)
    bad(code)

def record(x, keys):
    if type(x) is not dict or len(x) != len(keys) or any((k not in x for k in keys)):
        bad()
    return x

def profile(rows):
    if type(rows) is not list or not 2 <= len(rows) <= 2147483647:
        bad()
    z = array('d')
    r = array('d')
    for i, row in enumerate(rows):
        if type(row) is not list or len(row) != 2:
            bad()
        a, b = (number(row[0]), number(row[1]))
        if i and (not z[-1] < a):
            bad()
        if b < 0 or (0 < i < len(rows) - 1 and b <= 0):
            bad()
        z.append(a)
        r.append(b)
    if len(rows) == 2 and r[0] == 0 and (r[-1] == 0):
        bad()
    return (z, r)

@dataclass(frozen=True, slots=True, repr=False, eq=False)
class _Result:
    __p: array
    __t: array
    __n: array
    __k: tuple
    __b: array
    __c: array

    def vertex_count(self):
        return len(self.__p) // 3

    def face_count(self):
        return len(self.__t) // 3

    def _index(self, x, size):
        x = integer(x, 0, SAFE, 'INVALID_INDEX')
        if x >= size:
            bad('INDEX_OUT_OF_RANGE')
        return x

    def vertex_at(self, x):
        x = self._index(x, self.vertex_count()) * 3
        return [zero(self.__p[x]), zero(self.__p[x + 1]), zero(self.__p[x + 2])]

    def triangle_at(self, x):
        x = self._index(x, self.face_count()) * 3
        return [self.__t[x], self.__t[x + 1], self.__t[x + 2]]

    def normal_at(self, x):
        x = self._index(x, self.face_count()) * 3
        return [zero(self.__n[x]), zero(self.__n[x + 1]), zero(self.__n[x + 2])]

    def face_kind_at(self, x):
        return self.__k[self._index(x, self.face_count())]

    def band_at(self, x):
        return self.__b[self._index(x, self.face_count())]

    def cell_at(self, x):
        return self.__c[self._index(x, self.face_count())]

    def _into(self, data, x, out, offset):
        x = self._index(x, len(data) // 3) * 3
        offset = integer(offset, 0, SAFE, 'INVALID_OUTPUT')
        if not (type(out) is list or (type(out) is array and out.typecode == 'd')) or offset > len(out) - 3:
            bad('INVALID_OUTPUT')
        out[offset] = data[x]
        out[offset + 1] = data[x + 1]
        out[offset + 2] = data[x + 2]

    def vertex_into(self, x, out, offset=0):
        self._into(self.__p, x, out, offset)

    def normal_into(self, x, out, offset=0):
        self._into(self.__n, x, out, offset)

    def triangle_into(self, x, out, offset=0):
        x = self._index(x, self.face_count()) * 3
        offset = integer(offset, 0, SAFE, 'INVALID_OUTPUT')
        if type(out) is not list or offset > len(out) - 3:
            bad('INVALID_OUTPUT')
        out[offset] = self.__t[x]
        out[offset + 1] = self.__t[x + 1]
        out[offset + 2] = self.__t[x + 2]

    def to_values(self):
        return {'positions': [self.vertex_at(i) for i in range(self.vertex_count())], 'triangles': [self.triangle_at(i) for i in range(self.face_count())], 'normals': [self.normal_at(i) for i in range(self.face_count())], 'faceKinds': [self.face_kind_at(i) for i in range(self.face_count())], 'bands': [self.band_at(i) for i in range(self.face_count())], 'cells': [self.cell_at(i) for i in range(self.face_count())]}

class RadialProfile3D:
    """Owned radial mesh for mesh.radial-profile-surface-3d 0.1.0.

 Motivated by survey/out/2017/Generativos/cilindros/notes.md and
 survey/out/2017/Generativos/fieeee/notes.md. Source subdivisions and the
 private 8/32-slice comparison are discrete observations, not defaults,
 recommended ranges or capacity advice. All five inputs are explicit.
 """

    @staticmethod
    def generate(config):
        q = record(config, ('profile', 'slices', 'capStart', 'capEnd', 'maxFaces'))
        z, r = profile(q['profile'])
        s = integer(q['slices'], 3, MAX)
        if type(q['capStart']) is not bool or type(q['capEnd']) is not bool:
            bad()
        cs, ce = (q['capStart'], q['capEnd'])
        maximum = integer(q['maxFaces'], 1, MAX)
        p = len(z)
        poles = (r[0] == 0) + (r[-1] == 0)
        caps = (cs and r[0] > 0) + (ce and r[-1] > 0)
        faces = s * (2 * (p - 1) - poles + caps)
        verts = (p - poles) * s + poles + caps
        if faces > maximum:
            bad('FACE_LIMIT_EXCEEDED')
        pos = array('d', [0.0]) * (verts * 3)
        tri = array('i', [0]) * (faces * 3)
        nor = array('d', [0.0]) * (faces * 3)
        bands = array('i', [0]) * faces
        cells = array('i', [0]) * faces
        kinds = [None] * faces
        starts = array('i', [0]) * p
        rings = [False] * p
        v = 0

        def put(i, x, y, w):
            offset = i * 3
            pos[offset] = zero(x)
            pos[offset + 1] = zero(y)
            pos[offset + 2] = zero(w)
        for i in range(p):
            starts[i] = v
            if r[i] == 0:
                put(v, 0, 0, z[i])
                v += 1
            else:
                rings[i] = True
                for cell in range(s):
                    theta = TAU * cell / s
                    put(v, r[i] * math.cos(theta), r[i] * math.sin(theta), z[i])
                    v += 1
        sc = ec = -1
        if cs and rings[0]:
            sc = v
            put(v, 0, 0, z[0])
            v += 1
        if ce and rings[-1]:
            ec = v
            put(v, 0, 0, z[-1])
            v += 1
        f = 0

        def face(a, b, c, kind, band, cell):
            nonlocal f
            offset = f * 3
            tri[offset] = a
            tri[offset + 1] = b
            tri[offset + 2] = c
            kinds[f] = kind
            bands[f] = band
            cells[f] = cell
            f += 1
        for band in range(p - 1):
            for cell in range(s):
                nx = (cell + 1) % s
                if rings[band] and rings[band + 1]:
                    a, b, c, d = (starts[band] + cell, starts[band] + nx, starts[band + 1] + nx, starts[band + 1] + cell)
                    face(a, b, c, 'side', band, cell)
                    face(a, c, d, 'side', band, cell)
                elif not rings[band]:
                    face(starts[band], starts[band + 1] + nx, starts[band + 1] + cell, 'side', band, cell)
                else:
                    face(starts[band] + cell, starts[band] + nx, starts[band + 1], 'side', band, cell)
        if sc >= 0:
            for cell in range(s):
                face(sc, starts[0] + (cell + 1) % s, starts[0] + cell, 'start-cap', -1, cell)
        if ec >= 0:
            for cell in range(s):
                face(ec, starts[-1] + cell, starts[-1] + (cell + 1) % s, 'end-cap', -1, cell)
        for i in range(faces):
            offset = i * 3
            a = tri[offset] * 3
            b = tri[offset + 1] * 3
            c = tri[offset + 2] * 3
            ux = pos[b] - pos[a]
            uy = pos[b + 1] - pos[a + 1]
            uz = pos[b + 2] - pos[a + 2]
            if not math.isfinite(ux) or not math.isfinite(uy) or (not math.isfinite(uz)):
                dyn(i, 'edge')
            vx = pos[c] - pos[a]
            vy = pos[c + 1] - pos[a + 1]
            vz = pos[c + 2] - pos[a + 2]
            if not math.isfinite(vx) or not math.isfinite(vy) or (not math.isfinite(vz)):
                dyn(i, 'edge')
            su = max(abs(ux), abs(uy), abs(uz))
            sv = max(abs(vx), abs(vy), abs(vz))
            if su == 0 or sv == 0:
                dyn(i, 'edge_scale')
            ux /= su
            uy /= su
            uz /= su
            vx /= sv
            vy /= sv
            vz /= sv
            nx = uy * vz - uz * vy
            ny = uz * vx - ux * vz
            nz = ux * vy - uy * vx
            sn = max(abs(nx), abs(ny), abs(nz))
            if sn == 0:
                dyn(i, 'cross_scale')
            qx = nx / sn
            qy = ny / sn
            qz = nz / sn
            length = math.sqrt(qx * qx + qy * qy + qz * qz)
            nor[offset] = zero(qx / length)
            nor[offset + 1] = zero(qy / length)
            nor[offset + 2] = zero(qz / length)
        return _Result(pos, tri, nor, tuple(kinds), bands, cells)
