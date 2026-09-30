/**
 * The block Mesh of a stratigraphic model (brief 46): one closed, consistently oriented solid per (stratum, fault
 * compartment), merged into ONE `Mesh` with a face attribute per layer, plus the erosion surface as its own open Mesh.
 *
 * CONSTRUCTION. Compartment i is a strip across the fault strike, bounded by two fault planes or block walls: at height y its
 * extent is `p in [left_i(y), right_i(y)]`, each bound linear in y (`p0 + kappa (y - H/2)`). It is parametrised by `(zeta, q)`
 * with `zeta` in [0, 1] across the strip and `q` along the strike, so the sheet of horizon w is the set of points
 *
 *     y = G_w(p(y, zeta), q),   p(y, zeta) = left(y) + zeta (right(y) - left(y)),
 *
 * one height per `(zeta, q)`. The equation is solved by bisection on y (the map `y - G(p(y))` is increasing because the steepest
 * horizon slope times |kappa| is below 1, which `strataModel` checks), to machine precision, for the `n - 1` horizons and the erosion
 * surface. Sheets are clamped to `[previous sheet, erosion surface]` and the base: the effective sheet of horizon w is
 * `E_w = min(max(y_w, E_{w-1} + floor), ground - (n - w) floor)` with `floor = FLOOR * H`; because two graphs with `G_a <= G_b` have
 * fixed points ordered the same way at the same `(zeta, q)`, the clamp keeps every point on its own horizon or on the ground (to at
 * most `n * floor`), and EVERY stratum keeps at least `floor` thickness at every vertex. So a stratum that is eroded away or pinched
 * out thins to a sliver of `floor` (about 1e-5 of the block, far below a pixel) instead of vanishing: bricks are always closed
 * manifolds with no welded vertices or dropped faces, and a plane section of a wedge tapers to that sliver.
 *
 * A brick k of compartment i is: the top sheet E_{k+1} (normal up), the bottom sheet E_k (normal down) and four walls along its border
 * rows (two along the strike at the block faces, two across it at the block face or fault plane). Adjacent compartments share
 * the fault plane geometrically but not vertices. Face roles (`ROLE`): horizon sheet up/down, ground (all corners on the
 * erosion surface), base (all corners on y = 0), outer wall, fault wall. Every brick is a closed manifold (tested), so plane
 * sections by `sectionMesh` give closed loops and holes by containment.
 *
 * WORK. Vertices and triangles are counted before anything is solved; over `BLOCK_LIMITS` the call throws naming Grid resolution,
 * Strata and Faults. Bisection is 60 iterations per sheet vertex.
 */
import { mesh, type Mesh, type Vec3 } from "./mesh.js";
import type { StrataModel } from "./strata.js";

export const BLOCK_LIMITS = Object.freeze({ maxVertices: 160_000, maxTriangles: 190_000, minResolution: 8, maxResolution: 120 });
export const ROLE = Object.freeze({ horizonUp: 0, horizonDown: 1, ground: 2, base: 3, wall: 4, fault: 5 });
/** Least thickness of any stratum at any vertex (fraction of the block height): eroded and pinched-out strata thin to it. */
export const FLOOR = 1e-5;

export interface Brick {
  readonly id: string;
  readonly stratum: number;
  readonly compartment: number;
  /** Triangles of the block mesh: `[firstFace, endFace)`. Empty when the stratum is absent from the compartment. */
  readonly faces: readonly [number, number];
}
export interface BlockSheet {
  /** Effective (clamped) height and world position per grid vertex, `(nz + 1) * (nq + 1)` each, row-major in q. */
  readonly y: Float64Array;
  readonly x: Float64Array;
  readonly z: Float64Array;
}
export interface CompartmentGrid {
  readonly compartment: number;
  readonly nz: number;
  readonly nq: number;
  /** Effective sheets 0..n (0 the base, n the ground). */
  readonly sheets: readonly BlockSheet[];
  /** Unclamped horizon heights for w = 1..n-1 (index w - 1), per vertex. */
  readonly raw: readonly Float64Array[];
  /** World position of height `y` at grid column `a` (0..nz) and row `b` (0..nq) of this compartment: the point of the strip at that height. */
  readonly place: (y: number, a: number, b: number) => Vec3;
}
export interface GroundSurface {
  readonly mesh: Mesh;
  /** Compartment of every ground triangle, and per vertex: grid ids. */
  readonly triangleCompartment: Uint16Array;
  /** `raw horizon - ground` for w = 1..n-1 per vertex is NEGATIVE where the ground lies below horizon w. */
  readonly gap: readonly Float64Array[];
  /** Stratigraphic coordinate: stratum + fraction through it, per vertex. */
  readonly coordinate: Float64Array;
  readonly elevation: Float64Array;
}
export interface GeologicalBlock {
  readonly key: string;
  readonly model: StrataModel;
  readonly resolution: number;
  readonly mesh: Mesh;
  readonly faceStratum: Uint8Array;
  readonly faceCompartment: Uint8Array;
  readonly faceRole: Uint8Array;
  readonly bricks: readonly Brick[];
  readonly grids: readonly CompartmentGrid[];
  readonly ground: GroundSurface;
  readonly stats: { readonly vertices: number; readonly triangles: number; readonly solves: number; readonly sheetVertices: number };
}

const cache = new Map<string, GeologicalBlock>();

/** Cell counts and vertex/triangle estimates, checked against `BLOCK_LIMITS` before any solve. */
export function blockGrid(model: StrataModel, resolution: number): { nq: number; nz: number[]; vertices: number; triangles: number } {
  if (!Number.isInteger(resolution) || resolution < BLOCK_LIMITS.minResolution || resolution > BLOCK_LIMITS.maxResolution)
    throw new Error(`Grid resolution must be a whole number from ${BLOCK_LIMITS.minResolution} to ${BLOCK_LIMITS.maxResolution} (got ${String(resolution)})`);
  const cell = Math.max(model.width, model.depth) / resolution, H = model.height;
  const nq = Math.max(4, Math.round(model.extentQ / cell));
  const nz = model.compartments.map((c) => {
    const left = c.left ? c.left.p0 : -model.extentP / 2, right = c.right ? c.right.p0 : model.extentP / 2;
    return Math.max(2, Math.round((right - left) / cell));
  });
  void H;
  let vertices = 0, triangles = 0;
  for (const cells of nz) {
    vertices += (cells + 1) * (nq + 1) * 2 * model.strata;
    triangles += (cells * nq * 4 + (cells + nq) * 4) * model.strata;
  }
  if (vertices > BLOCK_LIMITS.maxVertices || triangles > BLOCK_LIMITS.maxTriangles)
    throw new Error(`The block needs up to ${vertices} vertices and ${triangles} triangles (${model.strata} strata, ${model.compartments.length} compartments, ${nq + 1} rows); the limits are ${BLOCK_LIMITS.maxVertices} and ${BLOCK_LIMITS.maxTriangles}. Lower Grid resolution, Strata or Faults`);
  return { nq, nz, vertices, triangles };
}

/** The block of a model at a grid resolution (cells along the longer horizontal side); cached by both. */
export function geologicalBlock(model: StrataModel, resolution: number): GeologicalBlock {
  const key = `${model.key}|${resolution}`;
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  const block = buildBlock(model, resolution, key);
  cache.set(key, block);
  if (cache.size > 4) cache.delete(cache.keys().next().value!);
  return block;
}

function buildBlock(model: StrataModel, resolution: number, key: string): GeologicalBlock {
  const { nq, nz: cells } = blockGrid(model, resolution);
  const { strata: n, height: H, extentP: P, extentQ: Q, kappa } = model;
  const floor = FLOOR * H;
  const qAt = (b: number) => -Q / 2 + (Q * b) / nq;
  let solves = 0, sheetVertices = 0;

  // ---- Sheets per compartment.
  const grids: CompartmentGrid[] = model.compartments.map((c) => {
    const nzc = cells[c.index], count = (nzc + 1) * (nq + 1);
    const left = (y: number) => (c.left ? c.left.p0 + c.left.kappa * (y - H / 2) : -P / 2);
    const right = (y: number) => (c.right ? c.right.p0 + c.right.kappa * (y - H / 2) : P / 2);
    const position = (y: number, zeta: number, q: number): readonly [number, number] => {
      const l = left(y);
      return model.toWorld(l + zeta * (right(y) - l), q);
    };
    const solve = (fn: (p: number, q: number) => number, low: number, high: number, zeta: number, q: number): number => {
      let lo = low, hi = high;
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2, l = left(mid);
        if (mid - fn(l + zeta * (right(mid) - l), q) < 0) lo = mid; else hi = mid;
      }
      solves++;
      return (lo + hi) / 2;
    };
    const rawHorizons: Float64Array[] = [];
    // The fold and tilt are evaluated at p + kappa*shift, up to |kappa*shift| outside the block: widen the bracket by the slope over that.
    const margin = Math.abs(c.shift) + model.slopeBound.horizon * Math.abs(kappa * c.shift) + 1e-6;
    const [hLow, hHigh] = model.horizonRange;
    for (let w = 1; w <= n - 1; w++) {
      const arr = new Float64Array(count);
      for (let b = 0; b <= nq; b++) for (let a = 0; a <= nzc; a++)
        arr[b * (nzc + 1) + a] = solve((p, q) => model.finalHorizon(w, c.index, p, q), hLow - margin, hHigh + margin, a / nzc, qAt(b));
      rawHorizons.push(arr);
    }
    const rawGround = new Float64Array(count);
    const [gLow, gHigh] = model.groundRange;
    for (let b = 0; b <= nq; b++) for (let a = 0; a <= nzc; a++)
      rawGround[b * (nzc + 1) + a] = solve((p, q) => { const [x, z] = model.toWorld(p, q); return model.ground(x, z); }, gLow - 1e-6, gHigh + 1e-6, a / nzc, qAt(b));

    // Effective heights: sheet w is `min(max(raw, previous + floor), ground - (n - w) floor)`, so every stratum keeps at least `floor`.
    const effective: Float64Array[] = [new Float64Array(count)];
    for (let w = 1; w <= n - 1; w++) {
      const arr = new Float64Array(count), prev = effective[w - 1];
      for (let v = 0; v < count; v++) arr[v] = Math.min(Math.max(rawHorizons[w - 1][v], prev[v] + floor), rawGround[v] - (n - w) * floor);
      effective.push(arr);
    }
    effective.push(rawGround);
    const sheets: BlockSheet[] = effective.map((yArr) => {
      const x = new Float64Array(count), z = new Float64Array(count);
      for (let b = 0; b <= nq; b++) for (let a = 0; a <= nzc; a++) {
        const v = b * (nzc + 1) + a, [px, pz] = position(yArr[v], a / nzc, qAt(b));
        x[v] = px; z[v] = pz;
      }
      sheetVertices += count;
      return { y: yArr, x, z };
    });
    const place = (y: number, a: number, b: number): Vec3 => {
      const [x, z] = position(y, a / nzc, qAt(b));
      return [x, y, z];
    };
    return Object.freeze({ compartment: c.index, nz: nzc, nq, sheets: Object.freeze(sheets), raw: Object.freeze(rawHorizons), place });
  });

  // ---- Bricks.
  const positions: number[] = [], triangles: number[] = [], faceStratum: number[] = [], faceCompartment: number[] = [], faceRole: number[] = [];
  const bricks: Brick[] = [];
  const eP = model.toWorld(1, 0), e0 = model.toWorld(0, 0), eQ = model.toWorld(0, 1);
  const dirP: Vec3 = [eP[0] - e0[0], 0, eP[1] - e0[1]], dirQ: Vec3 = [eQ[0] - e0[0], 0, eQ[1] - e0[1]];

  for (const grid of grids) {
    const c = model.compartments[grid.compartment], nzc = grid.nz, stride = nzc + 1;
    for (let k = 0; k < n; k++) {
      const lo = grid.sheets[k], hi = grid.sheets[k + 1], first = faceStratum.length;
      const idLo = new Int32Array((nzc + 1) * (nq + 1)).fill(-1), idHi = new Int32Array((nzc + 1) * (nq + 1)).fill(-1);
      let vertexCount = positions.length / 3;
      const vertex = (sheetHi: boolean, v: number): number => {
        const ids = sheetHi ? idHi : idLo, sheet = sheetHi ? hi : lo;
        if (ids[v] < 0) { ids[v] = vertexCount++; positions.push(sheet.x[v], sheet.y[v], sheet.z[v]); }
        return ids[v];
      };
      const push = (a: number, b: number, d: number, role: number, hint: "up" | "down" | Vec3): void => {
        if (a === b || b === d || a === d) return;
        const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
        const ux = positions[b * 3] - ax, uy = positions[b * 3 + 1] - ay, uz = positions[b * 3 + 2] - az;
        const vx = positions[d * 3] - ax, vy = positions[d * 3 + 1] - ay, vz = positions[d * 3 + 2] - az;
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nzz = ux * vy - uy * vx;
        const dot = hint === "up" ? ny : hint === "down" ? -ny : nx * hint[0] + ny * hint[1] + nzz * hint[2];
        if (dot === 0) return;
        if (dot > 0) triangles.push(a, b, d); else triangles.push(a, d, b);
        faceStratum.push(k); faceCompartment.push(c.index); faceRole.push(role);
      };
      const cellVertices = (sheetHi: boolean, a: number, b: number) => [
        vertex(sheetHi, b * stride + a), vertex(sheetHi, b * stride + a + 1), vertex(sheetHi, (b + 1) * stride + a + 1), vertex(sheetHi, (b + 1) * stride + a)];
      // Sheets. Both sheets of a cell use the same diagonal.
      for (let b = 0; b < nq; b++) for (let a = 0; a < nzc; a++) {
        const corners = [b * stride + a, b * stride + a + 1, (b + 1) * stride + a + 1, (b + 1) * stride + a];
        const flip = ((a + b) & 1) === 1;
        const tris = flip ? [[0, 1, 3], [1, 2, 3]] : [[0, 1, 2], [0, 2, 3]];
        const topV = cellVertices(true, a, b), botV = cellVertices(false, a, b);
        for (const [i, j, l] of tris) {
          const onGround = [i, j, l].every((t) => hi.y[corners[t]] === grids[grid.compartment].sheets[n].y[corners[t]]);
          const onBase = [i, j, l].every((t) => lo.y[corners[t]] === 0);
          // (an eroded or pinched-out stratum is a sliver of thickness `FLOOR * H`, never a weld)
          push(topV[i], topV[j], topV[l], onGround ? ROLE.ground : ROLE.horizonUp, "up");
          push(botV[i], botV[j], botV[l], onBase ? ROLE.base : ROLE.horizonDown, "down");
        }
      }
      // Walls: left/right across the strike, front/back along it.
      const wall = (indices: number[], hint: Vec3, role: number): void => {
        for (let s = 0; s + 1 < indices.length; s++) {
          const v0 = indices[s], v1 = indices[s + 1];
          const l0 = vertex(false, v0), l1 = vertex(false, v1), h0 = vertex(true, v0), h1 = vertex(true, v1);
          push(l0, l1, h1, role, hint); push(l0, h1, h0, role, hint);
        }
      };
      const column = (a: number) => Array.from({ length: nq + 1 }, (_, b) => b * stride + a);
      const row = (b: number) => Array.from({ length: nzc + 1 }, (_, a) => b * stride + a);
      const leftHint: Vec3 = c.left ? [-dirP[0], kappa, -dirP[2]] : [-dirP[0], 0, -dirP[2]];
      const rightHint: Vec3 = c.right ? [dirP[0], -kappa, dirP[2]] : [dirP[0], 0, dirP[2]];
      wall(column(0), leftHint, c.left ? ROLE.fault : ROLE.wall);
      wall(column(nzc), rightHint, c.right ? ROLE.fault : ROLE.wall);
      wall(row(0), [-dirQ[0], 0, -dirQ[2]], ROLE.wall);
      wall(row(nq), [dirQ[0], 0, dirQ[2]], ROLE.wall);
      bricks.push(Object.freeze({ id: `s${k}/c${c.index}`, stratum: k, compartment: c.index, faces: Object.freeze([first, faceStratum.length]) as readonly [number, number] }));
    }
  }
  const attributes = [
    { name: "stratum", domain: "face" as const, size: 1 as const, values: faceStratum },
    { name: "compartment", domain: "face" as const, size: 1 as const, values: faceCompartment },
    { name: "role", domain: "face" as const, size: 1 as const, values: faceRole },
  ];
  const blockMesh = mesh({ id: "geological-block", positions, triangles, attributes });

  // ---- The erosion surface as its own open mesh, with the scalars that place horizons on it.
  const gPositions: number[] = [], gTriangles: number[] = [], gCompartment: number[] = [], gElevation: number[] = [];
  const gGap: number[][] = Array.from({ length: n - 1 }, () => []);
  const gCoordinate: number[] = [];
  const meanThickness = model.options.stack * H / Math.max(1, n - 2);
  for (const grid of grids) {
    const stride = grid.nz + 1, base = gPositions.length / 3, ground = grid.sheets[n];
    for (let v = 0; v < stride * (nq + 1); v++) {
      gPositions.push(ground.x[v], ground.y[v], ground.z[v]); gElevation.push(ground.y[v]);
      let s = 0;
      for (let w = 1; w <= n - 1; w++) { gGap[w - 1].push(grid.raw[w - 1][v] - ground.y[v]); if (grid.raw[w - 1][v] <= ground.y[v]) s = w; }
      const lowerRaw = s >= 1 ? grid.raw[s - 1][v] : ground.y[v] - meanThickness;
      const upperRaw = s <= n - 2 ? grid.raw[s][v] : ground.y[v] + meanThickness;
      const fraction = s === 0 ? 1 - Math.min(1, (upperRaw - ground.y[v]) / meanThickness)
        : s === n - 1 ? Math.min(0.999999, (ground.y[v] - lowerRaw) / meanThickness) : (ground.y[v] - lowerRaw) / (upperRaw - lowerRaw);
      gCoordinate.push(s + Math.min(0.999999, Math.max(0, fraction)));
    }
    for (let b = 0; b < nq; b++) for (let a = 0; a < grid.nz; a++) {
      const v = [b * stride + a, b * stride + a + 1, (b + 1) * stride + a + 1, (b + 1) * stride + a].map((i) => base + i);
      const tris = ((a + b) & 1) === 1 ? [[0, 1, 3], [1, 2, 3]] : [[0, 1, 2], [0, 2, 3]];
      for (const [i, j, l] of tris) {
        const [A, B, C] = [v[i], v[j], v[l]];
        const nyz = (gPositions[B * 3 + 2] - gPositions[A * 3 + 2]) * (gPositions[C * 3] - gPositions[A * 3]) - (gPositions[B * 3] - gPositions[A * 3]) * (gPositions[C * 3 + 2] - gPositions[A * 3 + 2]);
        if (nyz > 0) gTriangles.push(A, B, C); else gTriangles.push(A, C, B);
        gCompartment.push(grid.compartment);
      }
    }
  }
  const groundMesh = mesh({ id: "erosion-surface", positions: gPositions, triangles: gTriangles,
    attributes: [{ name: "elevation", domain: "vertex", size: 1, values: gElevation }, { name: "stratigraphy", domain: "vertex", size: 1, values: gCoordinate }] });

  return Object.freeze({
    key, model, resolution, mesh: blockMesh,
    faceStratum: Uint8Array.from(faceStratum), faceCompartment: Uint8Array.from(faceCompartment), faceRole: Uint8Array.from(faceRole),
    bricks: Object.freeze(bricks), grids: Object.freeze(grids),
    ground: Object.freeze({ mesh: groundMesh, triangleCompartment: Uint16Array.from(gCompartment), gap: Object.freeze(gGap.map((g) => Float64Array.from(g))),
      coordinate: Float64Array.from(gCoordinate), elevation: Float64Array.from(gElevation) }),
    stats: Object.freeze({ vertices: blockMesh.vertexCount, triangles: blockMesh.triangleCount, solves, sheetVertices }),
  });
}
