/**
 * Triangulation of a polygon with holes (F4 addition for brief 46; the planar-domain foundation deliberately stops at regions).
 *
 * Ear clipping with hole bridging, after the algorithm of the widely used `earcut` (Mapbox, ISC licence) without its z-order hash:
 * holes are joined to the outer ring by a zero-width bridge to a mutually visible vertex, the resulting weakly simple ring is clipped
 * ear by ear, and locally intersecting or stuck configurations are cured by the same three passes (plain, intersection cure,
 * split). Inputs are the exact simple rings of a `PlanarRegion`, for which no pass fails; if one ever did the call throws instead of
 * returning a partial cover. Cost is O(n^2) in the ring size n (a 4,000-vertex region takes a fraction of a second).
 *
 * Output: triangles as three `[x, y]` points, counter-clockwise, whose union is the region: their areas sum to the region area
 * (tested against the shoelace area of random star regions with holes and the analytic annulus). Deterministic.
 */
type Pt = readonly [number, number];
export type Triangle = readonly [Pt, Pt, Pt];

interface Node { x: number; y: number; prev: Node; next: Node; steiner: boolean; id: number }

let nextId = 0;
function makeNode(x: number, y: number): Node {
  const node = { x, y, steiner: false, id: nextId++ } as Node;
  node.prev = node; node.next = node;
  return node;
}
const area = (p: Node, q: Node, r: Node): number => (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
const equals = (a: Node, b: Node): boolean => a.x === b.x && a.y === b.y;
const sign = (n: number): number => (n > 0 ? 1 : n < 0 ? -1 : 0);
function signedArea(points: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) sum += (points[j][0] - points[i][0]) * (points[i][1] + points[j][1]);
  return sum;
}
function insertNode(x: number, y: number, last: Node | null): Node {
  const p = makeNode(x, y);
  if (!last) { p.prev = p; p.next = p; } else { p.next = last.next; p.prev = last; last.next.prev = p; last.next = p; }
  return p;
}
function removeNode(p: Node): void { p.next.prev = p.prev; p.prev.next = p.next; }
/** Circular list of the ring, counter-clockwise when `clockwise` is false (earcut's convention: positive `signedArea` is clockwise). */
function linkedList(points: readonly Pt[], clockwise: boolean): Node | null {
  let last: Node | null = null;
  if (clockwise === signedArea(points) > 0) for (let i = 0; i < points.length; i++) last = insertNode(points[i][0], points[i][1], last);
  else for (let i = points.length - 1; i >= 0; i--) last = insertNode(points[i][0], points[i][1], last);
  if (last && equals(last, last.next)) { removeNode(last); last = last.next; }
  return last;
}
function filterPoints(start: Node | null, end?: Node | null): Node | null {
  if (!start) return start;
  if (!end) end = start;
  let p = start, again: boolean;
  do {
    again = false;
    if (!p.steiner && (equals(p, p.next) || area(p.prev, p, p.next) === 0)) {
      removeNode(p); p = end = p.prev;
      if (p === p.next) break;
      again = true;
    } else p = p.next;
  } while (again || p !== end);
  return end;
}
function pointInTriangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, px: number, py: number): boolean {
  return (cx - px) * (ay - py) >= (ax - px) * (cy - py) && (ax - px) * (by - py) >= (bx - px) * (ay - py) && (bx - px) * (cy - py) >= (cx - px) * (by - py);
}
function pointInTriangleExceptFirst(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, px: number, py: number): boolean {
  return !(ax === px && ay === py) && pointInTriangle(ax, ay, bx, by, cx, cy, px, py);
}
function isEar(ear: Node): boolean {
  const a = ear.prev, b = ear, c = ear.next;
  if (area(a, b, c) >= 0) return false;
  const ax = a.x, bx = b.x, cx = c.x, ay = a.y, by = b.y, cy = c.y;
  const x0 = Math.min(ax, bx, cx), y0 = Math.min(ay, by, cy), x1 = Math.max(ax, bx, cx), y1 = Math.max(ay, by, cy);
  let p = c.next;
  while (p !== a) {
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && pointInTriangleExceptFirst(ax, ay, bx, by, cx, cy, p.x, p.y) && area(p.prev, p, p.next) >= 0) return false;
    p = p.next;
  }
  return true;
}
function onSegment(p: Node, q: Node, r: Node): boolean {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}
function intersects(p1: Node, q1: Node, p2: Node, q2: Node): boolean {
  const o1 = sign(area(p1, q1, p2)), o2 = sign(area(p1, q1, q2)), o3 = sign(area(p2, q2, p1)), o4 = sign(area(p2, q2, q1));
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}
function locallyInside(a: Node, b: Node): boolean {
  return area(a.prev, a, a.next) < 0 ? area(a, b, a.next) >= 0 && area(a, a.prev, b) >= 0 : area(a, b, a.prev) < 0 || area(a, a.next, b) < 0;
}
function middleInside(a: Node, b: Node): boolean {
  let p = a, inside = false;
  const px = (a.x + b.x) / 2, py = (a.y + b.y) / 2;
  do {
    if (p.y > py !== p.next.y > py && p.next.y !== p.y && px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x) inside = !inside;
    p = p.next;
  } while (p !== a);
  return inside;
}
function intersectsPolygon(a: Node, b: Node): boolean {
  let p = a;
  do {
    if (p.id !== a.id && p.next.id !== a.id && p.id !== b.id && p.next.id !== b.id && intersects(p, p.next, a, b)) return true;
    p = p.next;
  } while (p !== a);
  return false;
}
function isValidDiagonal(a: Node, b: Node): boolean {
  return a.next.id !== b.id && a.prev.id !== b.id && !intersectsPolygon(a, b)
    && (locallyInside(a, b) && locallyInside(b, a) && middleInside(a, b) && (area(a.prev, a, b.prev) !== 0 || area(a, b.prev, b) !== 0) || equals(a, b) && area(a.prev, a, a.next) > 0 && area(b.prev, b, b.next) > 0);
}
function splitPolygon(a: Node, b: Node): Node {
  const a2 = makeNode(a.x, a.y), b2 = makeNode(b.x, b.y), an = a.next, bp = b.prev;
  a.next = b; b.prev = a;
  a2.next = an; an.prev = a2;
  b2.next = a2; a2.prev = b2;
  bp.next = b2; b2.prev = bp;
  return b2;
}
function cureLocalIntersections(start: Node, out: Node[][]): Node {
  let p = start;
  do {
    const a = p.prev, b = p.next.next;
    if (!equals(a, b) && intersects(a, p, p.next, b) && locallyInside(a, b) && locallyInside(b, a)) {
      out.push([a, p, b]);
      removeNode(p); removeNode(p.next);
      p = start = b;
    }
    p = p.next;
  } while (p !== start);
  return filterPoints(p) as Node;
}
function splitEarcut(start: Node, out: Node[][]): void {
  let a = start;
  do {
    let b = a.next.next;
    while (b !== a.prev) {
      if (a.id !== b.id && isValidDiagonal(a, b)) {
        let c = splitPolygon(a, b);
        a = filterPoints(a, a.next) as Node; c = filterPoints(c, c.next) as Node;
        earcutLinked(a, out, 0); earcutLinked(c, out, 0);
        return;
      }
      b = b.next;
    }
    a = a.next;
  } while (a !== start);
}
function earcutLinked(ear: Node | null, out: Node[][], pass: number): void {
  if (!ear) return;
  let stop = ear, prev: Node, next: Node;
  while (ear.prev !== ear.next) {
    prev = ear.prev; next = ear.next;
    if (isEar(ear)) {
      out.push([prev, ear, next]);
      removeNode(ear);
      ear = next.next; stop = next.next;
      continue;
    }
    ear = next;
    if (ear === stop) {
      if (pass === 0) earcutLinked(filterPoints(ear), out, 1);
      else if (pass === 1) { ear = cureLocalIntersections(filterPoints(ear) as Node, out); earcutLinked(ear, out, 2); }
      else if (pass === 2) splitEarcut(ear, out);
      break;
    }
  }
}
function sectorContainsSector(m: Node, p: Node): boolean { return area(m.prev, m, p.prev) < 0 && area(p.next, m, m.next) < 0; }
function findHoleBridge(hole: Node, outer: Node): Node | null {
  let p = outer, qx = -Infinity, m: Node | null = null;
  const hx = hole.x, hy = hole.y;
  do {
    if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) {
      const x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
      if (x <= hx && x > qx) {
        qx = x; m = p.x < p.next.x ? p : p.next;
        if (x === hx) return m;
      }
    }
    p = p.next;
  } while (p !== outer);
  if (!m) return null;
  const stop = m, mx = m.x, my = m.y;
  let tanMin = Infinity;
  p = m;
  do {
    if (hx >= p.x && p.x >= mx && hx !== p.x && pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) {
      const tan = Math.abs(hy - p.y) / (hx - p.x);
      if (locallyInside(p, hole) && (tan < tanMin || tan === tanMin && (p.x > m!.x || p.x === m!.x && sectorContainsSector(m!, p)))) { m = p; tanMin = tan; }
    }
    p = p.next;
  } while (p !== stop);
  return m;
}
function leftmost(start: Node): Node {
  let p = start, best = start;
  do { if (p.x < best.x || p.x === best.x && p.y < best.y) best = p; p = p.next; } while (p !== start);
  return best;
}
function eliminateHoles(holes: readonly (readonly Pt[])[], outer: Node): Node {
  const queue: Node[] = [];
  for (const ring of holes) {
    const list = linkedList(ring, false);
    if (!list) continue;
    if (list === list.next) list.steiner = true;
    queue.push(leftmost(list));
  }
  queue.sort((a, b) => a.x - b.x || a.y - b.y);
  for (const hole of queue) outer = eliminateHole(hole, outer);
  return outer;
}
function eliminateHole(hole: Node, outer: Node): Node {
  const bridge = findHoleBridge(hole, outer);
  if (!bridge) return outer;
  const bridgeReverse = splitPolygon(bridge, hole);
  filterPoints(bridgeReverse, bridgeReverse.next);
  return filterPoints(bridge, bridge.next) as Node;
}

/** Triangles covering the region with `outer` ring and `holes` (rings in either orientation). */
export function triangulatePolygon(outer: readonly Pt[], holes: readonly (readonly Pt[])[] = []): Triangle[] {
  if (outer.length < 3) return [];
  let list = linkedList(outer, true);
  if (!list || list.next === list.prev) return [];
  if (holes.length) list = eliminateHoles(holes, list);
  const out: Node[][] = [];
  earcutLinked(filterPoints(list), out, 0);
  const expected = Math.abs(signedArea(outer)) / 2 - holes.reduce((a, h) => a + Math.abs(signedArea(h)) / 2, 0);
  let total = 0;
  const triangles: Triangle[] = out.map(([a, b, c]) => {
    total += Math.abs(area(a, b, c)) / 2;
    return area(a, b, c) < 0 ? [[a.x, a.y], [b.x, b.y], [c.x, c.y]] as const : [[a.x, a.y], [c.x, c.y], [b.x, b.y]] as const;
  });
  if (!(Math.abs(total - expected) <= 1e-9 * Math.max(1, Math.abs(expected))))
    throw new Error(`Polygon triangulation covered ${total} of the region's ${expected}: the ring is not a simple polygon with holes`);
  return triangles;
}
