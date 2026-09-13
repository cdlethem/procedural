import { array, at, computed, finite, record, work } from "./internal/geometry-b-utils.js";
class AssembleSegmentChainsError extends Error { constructor(code) { super(code); this.name = "AssembleSegmentChainsError"; this.code = code; } }
const E = AssembleSegmentChainsError;
const point = (v) => { array(E, v, 2); return [finite(E, at(E, v, 0)), finite(E, at(E, v, 1))]; };
const key = (p) => `${p[0] === 0 ? 0 : p[0]},${p[1] === 0 ? 0 : p[1]}`;
const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
export function assembleSegmentChains2D(input) {
  record(E, input, ["segments", "maxWork"]); const raw = array(E, at(E, input, "segments"));
  const maxWork = finite(E, at(E, input, "maxWork")); if (!Number.isSafeInteger(maxWork) || maxWork < 0) throw new E("INVALID_INPUT");
  const n = raw.length, parsed = new Array(n);
  for (let i = 0; i < n; i += 1) { const edge = array(E, at(E, raw, i), 2); parsed[i] = [point(at(E, edge, 0)), point(at(E, edge, 1))]; }
  const preflight = 8 * n * n + 4 * n; work(E, preflight, maxWork);
  const edges = new Array(n), vertices = new Map(), add = (p) => { const k = key(p); let v = vertices.get(k); if (!v) { v = { p, edges: [] }; vertices.set(k, v); } return v; };
  for (let i = 0; i < n; i += 1) { const [a,b] = parsed[i]; if (key(a) === key(b)) throw new E("INVALID_TOPOLOGY"); const va = add(a), vb = add(b); edges[i] = [va, vb]; va.edges.push(i); vb.edges.push(i); }
  const pairs = new Set(); for (let i = 0; i < n; i += 1) { const [a,b] = edges[i], k = key(a.p) < key(b.p) ? `${key(a.p)}|${key(b.p)}` : `${key(b.p)}|${key(a.p)}`; if (pairs.has(k) || a.edges.length > 2 || b.edges.length > 2) throw new E("INVALID_TOPOLOGY"); pairs.add(k); }
  const seen = new Array(n).fill(false), chains = [];
  const other = (id, v) => edges[id][0] === v ? edges[id][1] : edges[id][0];
  for (let first = 0; first < n; first += 1) if (!seen[first]) {
    const component = [], todo = [first]; seen[first] = true; while (todo.length) { const id = todo.pop(); component.push(id); for (const v of edges[id]) for (const next of v.edges) if (!seen[next]) { seen[next] = true; todo.push(next); } }
    let start; const ends = []; for (const id of component) for (const v of edges[id]) if (v.edges.length === 1 && !ends.includes(v)) ends.push(v);
    const closed = ends.length === 0; if (!closed && ends.length !== 2) throw new E("INVALID_TOPOLOGY");
    if (closed) { for (const id of component) for (const v of edges[id]) if (!start || less(v.p, start.p)) start = v; const ns = start.edges.map((id) => other(id,start)); let choose = 0; if (less(ns[1].p, ns[0].p)) choose = 1; var startEdge = start.edges[choose]; }
    else { start = less(ends[0].p, ends[1].p) ? ends[0] : ends[1]; var startEdge = start.edges[0]; }
    const points = [start.p.slice()], segmentIndices = []; let vertex = start, edge = startEdge;
    while (true) { segmentIndices.push(edge); vertex = other(edge, vertex); if (closed && vertex === start) break; points.push(vertex.p.slice()); if (!closed && vertex.edges.length === 1) break; edge = vertex.edges[0] === edge ? vertex.edges[1] : vertex.edges[0]; }
    chains.push({ points, segmentIndices, closed });
  }
  chains.sort((a,b) => a.segmentIndices.reduce((m,x)=>Math.min(m,x), Infinity) - b.segmentIndices.reduce((m,x)=>Math.min(m,x), Infinity)); return { chains };
}
