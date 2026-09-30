import type { FoldedPanels } from "./hinge-fold.js";
import { panelNormal, panelPoint } from "./hinge-fold.js";
import { mesh } from "./mesh.js";
import type { Mesh } from "./mesh.js";
import { memoized } from "./sources.js";

/*
 * Posed panels as a Mesh.
 *
 * Inputs   `FoldedPanels` (rigid poses per panel) and `PosedMeshOptions`: `gap` (each panel is drawn shrunk toward
 *          its own centroid by this fraction, 0 to `MAX_GAP`) and `thickness` (panels become slabs that extend
 *          this far behind their front, in edge units, 0 to `MAX_THICKNESS`).
 * Outputs  A frozen `PosedPanels`: the `Mesh` and the maps between mesh faces and panels. Face attributes `panel`
 *          (panel index) and `role` (0 front, 1 back, 2 side). One panel is one source face on its front; the mesh
 *          lists triangles before quads, so use `frontFace` / `panelOfFace`, not the panel order.
 * Welding  With no gap and no thickness the sheet is ONE welded surface: panel corners that are the same tiling
 *          vertex share a mesh vertex when every hinge between them along the way is closed (tree, realized or
 *          off-angle hinges: their ends meet). An open hinge leaves separate vertices, so the crack is a boundary
 *          in the mesh topology. `meshEdgeAngle` of an edge shared by two panels then reads the true dihedral angle
 *          (the requested angle on tree hinges). With a gap or thickness every panel has its own vertices (a soup of
 *          plates or slabs), because a shrunk panel no longer touches its neighbours.
 * Winding  Panels face up in the flat state (`(b - a) x (c - a)` is +y), so a fold keeps every front outward on its
 *          own side; a slab's sides and back point out of the slab.
 * Work     At most 6 faces per panel plus their corners; `MAX_PANELS` keeps it far below the mesh limits.
 */

export const MAX_GAP = 0.9;
export const MAX_THICKNESS = 4;

export interface PosedMeshOptions {
  readonly gap: number;
  readonly thickness: number;
}
export interface PosedPanels {
  readonly folded: FoldedPanels;
  readonly options: PosedMeshOptions;
  readonly mesh: Mesh;
  /** Source face index of each panel's front. */
  readonly frontFace: Int32Array;
  /** Panel index of every source face. */
  readonly panelOfFace: Int32Array;
  /** 0 front, 1 back, 2 side, per source face. */
  readonly roleOfFace: Uint8Array;
  /** True when the sheet is welded (no gap, no thickness). */
  readonly welded: boolean;
}

const cache = new Map<string, PosedPanels>();
const EPS = 1e-9;

interface Piece { readonly verts: readonly number[]; readonly panel: number; readonly role: number }

function find(parent: Int32Array, x: number): number {
  while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
  return x;
}

/** The mesh of the folded panels (cached by pose and options; camera and appearance never enter). */
export function posedPanels(folded: FoldedPanels, options: PosedMeshOptions): PosedPanels {
  const { gap, thickness } = options;
  if (typeof gap !== "number" || !Number.isFinite(gap) || gap < 0 || gap > MAX_GAP) throw new Error(`Panel gap must be in [0, ${MAX_GAP}] (got ${String(gap)}): lower Gap between panels`);
  if (typeof thickness !== "number" || !Number.isFinite(thickness) || thickness < 0 || thickness > MAX_THICKNESS) throw new Error(`Panel thickness must be in [0, ${MAX_THICKNESS}] (got ${String(thickness)}): lower Thickness`);
  return memoized(cache, `${folded.key}|${gap}|${thickness}`, () => build(folded, options));
}

function build(folded: FoldedPanels, options: PosedMeshOptions): PosedPanels {
  const { gap, thickness } = options, { tiling } = folded, panels = tiling.panels, welded = gap === 0 && thickness === 0;
  const positions: number[] = [], pieces: Piece[] = [];
  // vertex ids of each panel's front corners (and back corners)
  const front: number[][] = [], back: number[][] = [];

  if (welded) {
    const total = panels.reduce((sum, p) => sum + p.corners.length, 0);
    const slot: number[] = [];
    let at = 0;
    for (const p of panels) { slot.push(at); at += p.corners.length; }
    const parent = Int32Array.from({ length: total }, (_, i) => i);
    const cornerAt = (panel: number, point: readonly [number, number]): number => {
      const corners = panels[panel].corners;
      for (let k = 0; k < corners.length; k++) if (Math.abs(corners[k][0] - point[0]) < EPS && Math.abs(corners[k][1] - point[1]) < EPS) return k;
      return -1;
    };
    for (const hinge of tiling.hinges) {
      if (folded.report[hinge.index].kind === "open") continue;
      for (const end of [hinge.a, hinge.b]) {
        const ka = cornerAt(hinge.panels[0], end), kb = cornerAt(hinge.panels[1], end);
        if (ka < 0 || kb < 0) continue;
        const ra = find(parent, slot[hinge.panels[0]] + ka), rb = find(parent, slot[hinge.panels[1]] + kb);
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
      }
    }
    const vertexOf = new Map<number, number>();
    for (const p of panels) {
      const ids: number[] = [];
      for (let k = 0; k < p.corners.length; k++) {
        const root = find(parent, slot[p.index] + k);
        let id = vertexOf.get(root);
        if (id === undefined) {
          id = positions.length / 3;
          vertexOf.set(root, id);
          positions.push(...panelPoint(folded, p.index, p.corners[k][0], p.corners[k][1]));
        }
        ids.push(id);
      }
      front.push(ids);
    }
  } else {
    for (const p of panels) {
      const n = panelNormal(folded, p.index), ids: number[] = [], bids: number[] = [];
      for (const [u, v] of p.corners) {
        const point = panelPoint(folded, p.index, p.centroid[0] + (u - p.centroid[0]) * (1 - gap), p.centroid[1] + (v - p.centroid[1]) * (1 - gap));
        ids.push(positions.length / 3);
        positions.push(...point);
      }
      if (thickness > 0) for (let k = 0; k < p.corners.length; k++) {
        bids.push(positions.length / 3);
        positions.push(positions[ids[k] * 3] - n[0] * thickness, positions[ids[k] * 3 + 1] - n[1] * thickness, positions[ids[k] * 3 + 2] - n[2] * thickness);
      }
      front.push(ids); back.push(bids);
    }
  }

  for (const p of panels) {
    const f = front[p.index];
    pieces.push({ verts: f, panel: p.index, role: 0 });
    if (thickness > 0) {
      const b = back[p.index], m = f.length;
      pieces.push({ verts: [...b].reverse(), panel: p.index, role: 1 });
      // outward sides: (F_i, B_i, B_i+1, F_i+1)
      for (let k = 0; k < m; k++) pieces.push({ verts: [f[k], b[k], b[(k + 1) % m], f[(k + 1) % m]], panel: p.index, role: 2 });
    }
  }
  const triangles = pieces.filter((piece) => piece.verts.length === 3), quads = pieces.filter((piece) => piece.verts.length === 4);
  const ordered = [...triangles, ...quads];
  const panelOfFace = Int32Array.from(ordered.map((piece) => piece.panel)), roleOfFace = Uint8Array.from(ordered.map((piece) => piece.role));
  const frontFace = new Int32Array(panels.length);
  ordered.forEach((piece, face) => { if (piece.role === 0) frontFace[piece.panel] = face; });
  const built = mesh({
    id: "hinged-panels", positions, triangles: triangles.flatMap((piece) => piece.verts), quads: quads.flatMap((piece) => piece.verts),
    attributes: [{ name: "panel", domain: "face", size: 1, values: Array.from(panelOfFace) }, { name: "role", domain: "face", size: 1, values: Array.from(roleOfFace) }],
  });
  return Object.freeze({ folded, options: Object.freeze({ ...options }), mesh: built, frontFace, panelOfFace, roleOfFace, welded });
}
