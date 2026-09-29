import { PlanarError, charge, classify, orient, type Pt, type Seg, type Work } from "./planar-kernel.js";

/**
 * Topology-preserving simplification of a set of closed rings that may share boundary pieces.
 *
 * The rings are cut at ANCHOR vertices (vertices where three or more boundary edges meet, chosen
 * by the caller) into chains. Chains shared by two rings (traversed in opposite directions) are
 * recognised and simplified once, so shared boundaries stay identical. Each chain is simplified
 * with Douglas–Peucker (perpendicular distance to the chord ≤ tolerance) in Saalfeld's
 * topology-preserving form: a chord replaces a run of vertices only if it neither crosses nor
 * touches any other current segment of any ring (exact predicates), otherwise the run is split at
 * its farthest vertex. Only original vertices are kept, so the result of simplifying simple,
 * pairwise non-crossing rings is again simple and non-crossing, and anchors never move.
 * A ring with fewer than two anchors receives deterministic artificial ones (lowest vertex id,
 * then the farthest vertex from it), identically for every ring that traverses the same loop.
 */
export interface RingSet {
  /** Vertex ids of each closed ring (the closing edge is implicit). */
  readonly rings: readonly (readonly number[])[];
  readonly coordinate: (id: number) => Pt;
  readonly anchor: (id: number) => boolean;
}

interface Chain { ids: number[]; simplified: number[] | null }

class SegmentGrid {
  private readonly cells: number[][];
  private readonly gx: number; private readonly gy: number;
  private readonly x0: number; private readonly y0: number; private readonly cw: number; private readonly ch: number;
  readonly ax: number[] = []; readonly ay: number[] = []; readonly bx: number[] = []; readonly by: number[] = [];
  readonly alive: boolean[] = [];
  private stamp: number[] = [];
  private clock = 0;
  constructor(minX: number, minY: number, maxX: number, maxY: number, expected: number) {
    const side = Math.max(1, Math.min(256, Math.ceil(Math.sqrt(expected / 2))));
    this.gx = side; this.gy = side; this.x0 = minX; this.y0 = minY;
    this.cw = (maxX - minX) / side || 1; this.ch = (maxY - minY) / side || 1;
    this.cells = Array.from({ length: side * side }, () => []);
  }
  private cx(x: number): number { return Math.min(this.gx - 1, Math.max(0, Math.floor((x - this.x0) / this.cw))); }
  private cy(y: number): number { return Math.min(this.gy - 1, Math.max(0, Math.floor((y - this.y0) / this.ch))); }
  /** Cells whose column range the segment crosses, by columns: exact supercover of the segment's bounding cells per column. */
  private forCells(ax: number, ay: number, bx: number, by: number, visit: (cell: number) => void): void {
    const lx = Math.min(ax, bx), rx = Math.max(ax, bx);
    const c0 = this.cx(lx), c1 = this.cx(rx);
    for (let c = c0; c <= c1; c++) {
      const xl = Math.max(lx, this.x0 + c * this.cw), xr = Math.min(rx, this.x0 + (c + 1) * this.cw);
      let ya: number, yb: number;
      if (bx === ax) { ya = Math.min(ay, by); yb = Math.max(ay, by); }
      else {
        ya = ay + (by - ay) * (xl - ax) / (bx - ax); yb = ay + (by - ay) * (xr - ax) / (bx - ax);
        if (ya > yb) [ya, yb] = [yb, ya];
        // Guard against rounding at the column edges.
        ya = Math.max(Math.min(ay, by), ya - 1e-9 * (Math.abs(ya) + 1)); yb = Math.min(Math.max(ay, by), yb + 1e-9 * (Math.abs(yb) + 1));
      }
      const r0 = this.cy(ya), r1 = this.cy(yb);
      for (let r = r0; r <= r1; r++) visit(r * this.gx + c);
    }
  }
  add(a: Pt, b: Pt): number {
    const id = this.ax.length;
    this.ax.push(a[0]); this.ay.push(a[1]); this.bx.push(b[0]); this.by.push(b[1]); this.alive.push(true); this.stamp.push(0);
    this.forCells(a[0], a[1], b[0], b[1], (cell) => this.cells[cell].push(id));
    return id;
  }
  remove(id: number): void { this.alive[id] = false; }
  /** True when the chord p→q conflicts with a live segment outside [skipLo, skipHi). */
  conflicts(p: Pt, q: Pt, skipLo: number, skipHi: number, work: Work): boolean {
    const clock = ++this.clock;
    let found = false;
    this.forCells(p[0], p[1], q[0], q[1], (cell) => {
      if (found) return;
      const list = this.cells[cell];
      charge(work, list.length + 1);
      for (const id of list) {
        if (!this.alive[id] || this.stamp[id] === clock || (id >= skipLo && id < skipHi)) continue;
        this.stamp[id] = clock;
        const ax = this.ax[id], ay = this.ay[id], bx = this.bx[id], by = this.by[id];
        const sharesP = (ax === p[0] && ay === p[1]) || (bx === p[0] && by === p[1]);
        const sharesQ = (ax === q[0] && ay === q[1]) || (bx === q[0] && by === q[1]);
        if (Math.max(ax, bx) < Math.min(p[0], q[0]) || Math.min(ax, bx) > Math.max(p[0], q[0]) || Math.max(ay, by) < Math.min(p[1], q[1]) || Math.min(ay, by) > Math.max(p[1], q[1])) continue;
        const kind = classify(lex(p, q), lex([ax, ay], [bx, by]));
        if (kind === 0) continue;
        if (kind === 1 && (sharesP || sharesQ) && !(sharesP && sharesQ)) continue;
        found = true;
        return;
      }
    });
    return found;
  }
}
function lex(a: Pt, b: Pt): Seg {
  const forward = a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  const [p, q] = forward ? [a, b] : [b, a];
  return { ax: p[0], ay: p[1], bx: q[0], by: q[1], miny: Math.min(p[1], q[1]), maxy: Math.max(p[1], q[1]), net: [] };
}

function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Simplified vertex-id rings, in the order of `set.rings`. Rings that collapse below three vertices keep their anchors and remain simple. */
export function simplifyRingSet(set: RingSet, tolerance: number, work: Work): number[][] {
  if (!(tolerance >= 0) || !Number.isFinite(tolerance)) throw new PlanarError("INVALID_INPUT", "simplify tolerance must be a finite number ≥ 0");
  const { rings, coordinate, anchor } = set;
  // 1. Anchor positions per ring, then chains.
  const canonical = new Map<string, Chain>();
  const ringChains: { chain: Chain; forward: boolean }[][] = [];
  for (const ring of rings) {
    const n = ring.length;
    let anchors: number[] = [];
    for (let k = 0; k < n; k++) if (anchor(ring[k])) anchors.push(k);
    if (anchors.length < 2) {
      let low = 0;
      for (let k = 1; k < n; k++) if (ring[k] < ring[low]) low = k;
      if (anchors.length === 0) anchors = [low];
      const base = anchors[0], bp = coordinate(ring[base]);
      let far = -1, best = -1;
      for (let k = 0; k < n; k++) {
        if (k === base) continue;
        const p = coordinate(ring[k]), d = (p[0] - bp[0]) ** 2 + (p[1] - bp[1]) ** 2;
        if (d > best || (d === best && ring[k] < ring[far])) { best = d; far = k; }
      }
      anchors = [base, far].sort((a, b) => a - b);
    }
    const chains: { chain: Chain; forward: boolean }[] = [];
    for (let a = 0; a < anchors.length; a++) {
      const from = anchors[a], to = anchors[(a + 1) % anchors.length];
      const ids: number[] = [];
      for (let k = from; ; k = (k + 1) % n) { ids.push(ring[k]); if (k === to && ids.length > 1) break; }
      const forwardKey = `${ids[0]}:${ids[1]}:${ids[ids.length - 1]}:${ids.length}`;
      const reverseKey = `${ids[ids.length - 1]}:${ids[ids.length - 2]}:${ids[0]}:${ids.length}`;
      const forward = forwardKey <= reverseKey, key = forward ? forwardKey : reverseKey;
      let chain = canonical.get(key);
      if (!chain) { chain = { ids: forward ? ids : ids.slice().reverse(), simplified: null }; canonical.set(key, chain); }
      chains.push({ chain, forward });
    }
    ringChains.push(chains);
  }
  charge(work, canonical.size + 1);
  if (tolerance > 0) {
    // 2. Global segment index over every chain.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, segments = 0;
    const ordered = [...canonical.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([, chain]) => chain);
    for (const chain of ordered) {
      segments += chain.ids.length - 1;
      for (const id of chain.ids) { const p = coordinate(id); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
    }
    const grid = new SegmentGrid(minX, minY, maxX, maxY, segments);
    const base: number[] = [];
    for (const chain of ordered) {
      base.push(grid.ax.length);
      for (let k = 0; k + 1 < chain.ids.length; k++) grid.add(coordinate(chain.ids[k]), coordinate(chain.ids[k + 1]));
    }
    ordered.forEach((chain, c) => {
      const pts = chain.ids.map(coordinate), last = pts.length - 1;
      const keep = new Uint8Array(pts.length);
      keep[0] = 1; keep[last] = 1;
      const stack: [number, number][] = [[0, last]];
      while (stack.length) {
        const [i, j] = stack.pop()!;
        if (j === i + 1) continue;
        let far = -1, worst = -1;
        for (let k = i + 1; k < j; k++) {
          const d = distanceToSegment(pts[k], pts[i], pts[j]);
          if (d > worst) { worst = d; far = k; }
        }
        charge(work, j - i);
        if (worst <= tolerance && !grid.conflicts(pts[i], pts[j], base[c] + i, base[c] + j, work)) {
          for (let s = base[c] + i; s < base[c] + j; s++) grid.remove(s);
          grid.add(pts[i], pts[j]);
          continue;
        }
        keep[far] = 1;
        stack.push([far, j], [i, far]);
      }
      chain.simplified = chain.ids.filter((_, k) => keep[k]);
    });
  }
  // 3. Reassemble each ring from its chains.
  return ringChains.map((chains) => {
    const out: number[] = [];
    for (const { chain, forward } of chains) {
      const ids = chain.simplified ?? chain.ids;
      const run = forward ? ids : ids.slice().reverse();
      for (let k = 0; k + 1 < run.length; k++) out.push(run[k]);
    }
    return out;
  });
}
