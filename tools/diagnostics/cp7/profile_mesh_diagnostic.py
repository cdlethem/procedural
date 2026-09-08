#!/usr/bin/env python3
"""Private CP7 profile-mesh topology diagnostic; it neither renders nor exposes an API."""
from __future__ import annotations
import hashlib, json, math, sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DIRECTION = ROOT / 'design/capabilities/cp7-profile-mesh-direction.md'
AUDIT = ROOT / 'design/capabilities/profile-mesh-evidence-audit.md'
OUTPUT = ROOT / 'evidence/investigations/cp7-profile-mesh-geometry.json'

@dataclass(frozen=True)
class Face:
    indices: tuple[int, int, int]
    kind: str                 # side, bottom-cap, top-cap
    band: int | None
    cell: int | None


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh(profile: list[tuple[float, float]], slices: int, bottom_cap: bool, top_cap: bool) -> tuple[list[tuple[float, float, float]], list[Face], list[list[int] | int], dict[str, int]]:
    """Independently specified diagnostic geometry in the direction document's order."""
    assert slices >= 3 and len(profile) >= 2
    assert all(profile[index][0] < profile[index + 1][0] for index in range(len(profile) - 1))
    assert all(radius > 0.0 for _, radius in profile[1:-1])
    assert not (profile[0][1] == 0.0 and profile[-1][1] == 0.0 and len(profile) == 2)
    vertices: list[tuple[float, float, float]] = []
    rings: list[list[int] | int] = []
    for z, radius in profile:
        assert math.isfinite(z) and math.isfinite(radius) and radius >= 0.0
        if radius == 0.0:
            rings.append(len(vertices)); vertices.append((0.0, 0.0, z))
        else:
            indices = []
            for cell in range(slices):
                theta = 2.0 * math.pi * cell / slices
                indices.append(len(vertices)); vertices.append((radius * math.cos(theta), radius * math.sin(theta), z))
            rings.append(indices)
    faces: list[Face] = []
    for band in range(len(profile) - 1):
        low, high = rings[band], rings[band + 1]
        if isinstance(low, list) and isinstance(high, list):
            for cell in range(slices):
                nxt = (cell + 1) % slices
                faces.append(Face((low[cell], low[nxt], high[nxt]), 'side', band, cell))
                faces.append(Face((low[cell], high[nxt], high[cell]), 'side', band, cell))
        elif not isinstance(low, list) and isinstance(high, list):
            for cell in range(slices):
                nxt = (cell + 1) % slices
                faces.append(Face((low, high[nxt], high[cell]), 'side', band, cell))
        elif isinstance(low, list) and not isinstance(high, list):
            for cell in range(slices):
                nxt = (cell + 1) % slices
                faces.append(Face((low[cell], low[nxt], high), 'side', band, cell))
        else:
            raise AssertionError('adjacent zero-radius points are outside this diagnostic domain')
    cap_centers: dict[str, int] = {}
    if bottom_cap and isinstance(rings[0], list):
        center = len(vertices); cap_centers['bottom'] = center; vertices.append((0.0, 0.0, profile[0][0]))
        for cell in range(slices):
            nxt = (cell + 1) % slices
            faces.append(Face((center, rings[0][nxt], rings[0][cell]), 'bottom-cap', None, cell))
    if top_cap and isinstance(rings[-1], list):
        center = len(vertices); cap_centers['top'] = center; vertices.append((0.0, 0.0, profile[-1][0]))
        for cell in range(slices):
            nxt = (cell + 1) % slices
            faces.append(Face((center, rings[-1][cell], rings[-1][nxt]), 'top-cap', None, cell))
    return vertices, faces, rings, cap_centers


def sub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def dot(a, b): return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]
def normal(vertices, face):
    a, b, c = (vertices[index] for index in face.indices)
    return cross(sub(b, a), sub(c, a))


def topology(vertices, faces, closed: bool, expected_loops: int) -> dict:
    directed = Counter(); undirected = Counter(); boundary = []
    for index, vertex in enumerate(vertices):
        if not all(math.isfinite(component) for component in vertex): raise AssertionError('nonfinite vertex %d' % index)
    for face in faces:
        if any(index < 0 or index >= len(vertices) for index in face.indices): raise AssertionError('index bounds')
        a, b, c = face.indices
        if len({a, b, c}) != 3: raise AssertionError('repeated triangle index')
        n = normal(vertices, face)
        if not all(math.isfinite(component) for component in n) or not math.isfinite(dot(n, n)) or dot(n, n) == 0.0: raise AssertionError('nonfinite or zero triangle area')
        if face.kind == 'bottom-cap' and not n[2] < 0.0: raise AssertionError('bottom cap winding')
        if face.kind == 'top-cap' and not n[2] > 0.0: raise AssertionError('top cap winding')
        if face.kind == 'side':
            centroid = tuple(sum(vertices[index][axis] for index in face.indices) / 3.0 for axis in range(3))
            if not dot(n, (centroid[0], centroid[1], 0.0)) > 0.0: raise AssertionError('side outward orientation')
        for edge in ((a,b), (b,c), (c,a)):
            directed[edge] += 1; undirected[tuple(sorted(edge))] += 1
    for edge, count in undirected.items():
        if count not in (1, 2): raise AssertionError('edge incidence')
        a, b = edge
        if count == 2:
            if directed[(a,b)] != 1 or directed[(b,a)] != 1: raise AssertionError('interior directed incidence')
        else:
            boundary.append((a,b) if directed[(a,b)] == 1 else (b,a))
    outgoing = Counter(a for a,_ in boundary); incoming = Counter(b for _,b in boundary)
    if set(outgoing) != set(incoming) or any(outgoing[v] != 1 or incoming[v] != 1 for v in outgoing): raise AssertionError('boundary incidence')
    boundary_next = {a:b for a,b in boundary}
    loops = 0; visited = set()
    for first in boundary_next:
        if first in visited: continue
        loops += 1; current = first
        while current not in visited:
            visited.add(current); current = boundary_next[current]
        if current != first: raise AssertionError('open boundary chain')
    if len(visited) != len(boundary): raise AssertionError('boundary traversal lost edge')
    if loops != expected_loops: raise AssertionError('boundary loop count')
    euler = len(vertices) - len(undirected) + len(faces)
    if closed and euler != 2: raise AssertionError('closed genus-zero Euler characteristic')
    return {'vertices':len(vertices), 'edges':len(undirected), 'faces':len(faces), 'euler':euler, 'boundary_loops':loops}

def expected_counts(profile, slices, bottom_cap, top_cap):
    positive = sum(radius > 0.0 for _, radius in profile)
    poles = len(profile) - positive
    vertices = positive*slices + poles + (slices > 0 and bottom_cap and profile[0][1] > 0.0) + (slices > 0 and top_cap and profile[-1][1] > 0.0)
    faces = 0
    for (_, low), (_, high) in zip(profile, profile[1:]): faces += slices * (2 if low > 0.0 and high > 0.0 else 1)
    faces += slices if bottom_cap and profile[0][1] > 0.0 else 0
    faces += slices if top_cap and profile[-1][1] > 0.0 else 0
    return vertices, faces


def validate_metadata(profile, faces, rings, cap_centers, slices):
    expected: dict[tuple[int,int,int], tuple[str,int|None,int|None]] = {}
    for band in range(len(profile)-1):
        low, high = rings[band], rings[band+1]
        for cell in range(slices):
            nxt=(cell+1)%slices
            if isinstance(low,list) and isinstance(high,list):
                expected[(low[cell],low[nxt],high[nxt])] = ('side',band,cell)
                expected[(low[cell],high[nxt],high[cell])] = ('side',band,cell)
            elif not isinstance(low,list) and isinstance(high,list): expected[(low,high[nxt],high[cell])] = ('side',band,cell)
            elif isinstance(low,list) and not isinstance(high,list): expected[(low[cell],low[nxt],high)] = ('side',band,cell)
    if 'bottom' in cap_centers:
        ring=rings[0]; center=cap_centers['bottom']
        for cell in range(slices): expected[(center,ring[(cell+1)%slices],ring[cell])] = ('bottom-cap',None,cell)
    if 'top' in cap_centers:
        ring=rings[-1]; center=cap_centers['top']
        for cell in range(slices): expected[(center,ring[cell],ring[(cell+1)%slices])] = ('top-cap',None,cell)
    if len(expected) != len(faces): raise AssertionError('face count metadata')
    if len({face.indices for face in faces}) != len(faces): raise AssertionError('duplicate face')
    for face in faces:
        if face.indices not in expected: raise AssertionError('face ring vertices')
        if expected[face.indices] != (face.kind,face.band,face.cell): raise AssertionError('face provenance')

def mutation_controls():
    profile = [(0.0, 2.0), (3.0, 2.0)]
    vertices, faces, rings, centers = mesh(profile, 4, True, True)
    def validate(v, f, r=rings, c=centers): topology(v, f, True, 0); validate_metadata(profile, f, r, c, 4)
    def rejected(identifier, action):
        try: action()
        except AssertionError as error: return str(error)
        raise AssertionError(identifier + ' mutation was accepted')
    controls = {}
    broken=list(faces); index=next(i for i,f in enumerate(broken) if f.kind=='bottom-cap'); f=broken[index]; broken[index]=Face((f.indices[0],f.indices[2],f.indices[1]),f.kind,f.band,f.cell)
    controls['reversed-cap'] = rejected('reversed-cap', lambda: validate(vertices, broken))
    broken=[face for face in faces if not(face.kind=='side' and face.band==0 and face.cell==3)]
    controls['omitted-seam-cell'] = rejected('omitted-seam-cell', lambda: validate(vertices, broken))
    duplicate_vertices=[(0.0,0.0,0.0),(0.0,0.0,0.0),(2.0,0.0,3.0)]
    controls['duplicated-pole-ring'] = rejected('duplicated-pole-ring', lambda: topology(duplicate_vertices,[Face((0,1,2),'side',0,0)],False,0))
    broken=list(faces); f=broken[0]; broken[0]=Face(f.indices,f.kind,0,(f.cell+1)%4)
    controls['wrong-in-range-cell-metadata'] = rejected('wrong-in-range-cell-metadata', lambda: validate(vertices,broken))
    waist_profile = [(0.0,2.0),(1.5,0.8),(3.0,2.0)]
    wv, wf, wr, wc = mesh(waist_profile,4,True,True)
    wrong_band = list(wf); f = wrong_band[0]
    wrong_band[0] = Face(f.indices, f.kind, 1, f.cell)
    controls['wrong-in-range-band-metadata'] = rejected('wrong-in-range-band-metadata',
        lambda: validate_metadata(waist_profile,wrong_band,wr,wc,4))
    broken=list(faces); f=next(face for face in broken if face.kind=='top-cap'); broken[broken.index(f)]=Face(f.indices,'bottom-cap',f.band,f.cell)
    controls['wrong-cap-kind'] = rejected('wrong-cap-kind', lambda: validate(vertices,broken))
    cloned=list(vertices); cloned.append(vertices[rings[0][0]]); clone=len(cloned)-1; broken=list(faces); f=broken[0]; broken[0]=Face((clone,f.indices[1],f.indices[2]),f.kind,f.band,f.cell)
    controls['seam-cloned-coordinate'] = rejected('seam-cloned-coordinate', lambda: topology(cloned,broken,True,0))
    return controls

def main():
    fixtures = [
        ('cylinder-closed', [(0.0,2.0),(3.0,2.0)], True, True, 0),
        ('cylinder-open', [(0.0,2.0),(3.0,2.0)], False, False, 2),
        ('cylinder-bottom-cap', [(0.0,2.0),(3.0,2.0)], True, False, 1),
        ('cylinder-top-cap', [(0.0,2.0),(3.0,2.0)], False, True, 1),
        ('waist-closed', [(0.0,2.0),(1.5,0.8),(3.0,2.0)], True, True, 0),
        ('frustum-closed', [(0.0,1.0),(3.0,2.0)], True, True, 0),
        ('bottom-pole-top-cap', [(0.0,0.0),(3.0,2.0)], False, True, 0),
        ('bottom-pole-top-open', [(0.0,0.0),(3.0,2.0)], False, False, 1),
        ('top-pole-bottom-cap', [(0.0,2.0),(3.0,0.0)], True, False, 0),
        ('top-pole-bottom-open', [(0.0,2.0),(3.0,0.0)], False, False, 1),
        ('two-pole', [(0.0,0.0),(1.5,2.0),(3.0,0.0)], False, False, 0),
    ]
    records=[]
    for name, profile, bottom, top, loops in fixtures:
        for slices in (3,4,12):
            vertices, faces, rings, centers = mesh(profile, slices, bottom, top)
            validate_metadata(profile, faces, rings, centers, slices)
            counts = topology(vertices, faces, loops == 0, loops)
            expected_vertices, expected_faces = expected_counts(profile, slices, bottom, top)
            if (counts['vertices'], counts['faces']) != (expected_vertices, expected_faces): raise AssertionError('analytic counts')
            records.append({'id':name, 'slices':slices, 'bottom_cap_requested':bottom, 'top_cap_requested':top, 'counts':counts})
    report={'status':'passed','scope':'Private Python double geometry/topology diagnostic only; no portable numeric, Java, renderer, or public API claim.', 'source_bindings':{str(DIRECTION.relative_to(ROOT)):digest(DIRECTION),str(AUDIT.relative_to(ROOT)):digest(AUDIT),str(Path(__file__).relative_to(ROOT)):digest(Path(__file__))}, 'fixtures':records, 'mutation_controls':mutation_controls(), 'limitations':'Moderate finite profiles only. This checks specified winding, shared seam, poles, caps and topology; it does not establish extreme arithmetic, allocation limits, ownership, target trig equivalence, or rendered appearance.', 'runtime':sys.version}
    OUTPUT.write_text(json.dumps(report,indent=2,sort_keys=True)+'\n')
    print(json.dumps({'passed':True,'fixtures':len(records),'report':str(OUTPUT)}))
if __name__ == '__main__': main()
