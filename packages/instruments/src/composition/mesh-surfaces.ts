/**
 * Open bundled surfaces beyond `mesh-samples.ts` (foundation F8): parametric sheets and a spherical patch. Same rules as
 * the other bundled meshes: pure functions of their options, frozen and cached by construction, right-handed +Y up, faces
 * counter-clockwise seen from the side the normal points to (stated per sheet below), closed forms checked by the tests.
 *
 * - `parametricSheetMesh({kind, columns, rows, seed})`: a `columns x rows` grid of quads over the parameter square, four
 *   kinds, all open (boundary `2 (columns + rows)` edges, Euler characteristic 1, vertex attribute `height` = y):
 *   - `saddle`: the height field `y = (x^2 - z^2) / 4` over `[-2, 2]^2`, normals up. Not developable, so a thread family
 *     that is straight in the plane cannot stay parallel on it.
 *   - `waves`: a seeded sum of three travelling sinusoids of `x`, `z` (amplitudes 0.34, 0.24, 0.16, wavelengths about
 *     2.4, 1.6, 1.1) over `[-2, 2]^2`, normals up.
 *   - `twist`: the helicoid strip `(u cos(k v), h v, u sin(k v))`, `u in [-1.6, 1.6]`, `v in [-1, 1]`, `k = 1.5 pi`,
 *     `h = 1.1`: a ribbon turned through three quarter turns about the Y axis, which is NOT a height field (it overhangs
 *     itself, so it hides its own threads). Area `2 (w sqrt(h^2 + k^2 w^2) + h^2 / k asinh(k w / h))` for `w = 1.6`.
 *   - `scroll`: a strip `2.4` high rolled into an Archimedean spiral `r = 0.35 + 0.16 * theta / (2 pi)` over two and a half
 *     turns: successive layers lie `0.16` apart, so the sheet is seen through its own opening and hides itself.
 * - `icospherePatchMesh(levels, halfAngle)`: the triangles of the level-`levels` icosphere (radius 1) whose centroid lies
 *   within `halfAngle` degrees of +Y, with the vertices renumbered densely. At 180 degrees it is the whole icosphere (closed);
 *   below that it is an open patch whose rim follows triangle edges, so it is jagged by up to one edge length.
 */
import { componentSeed } from "./core.js";
import { icosphereMesh } from "./mesh-samples.js";
import { mesh, meshStorage, MESH_LIMITS, type Mesh } from "./mesh.js";
import { memoized } from "./sources.js";

const cache = new Map<string, Mesh>();
const cached = (key: unknown[], make: () => Mesh): Mesh => memoized(cache, JSON.stringify(key), make);

export const sheetKinds = ["saddle", "waves", "twist", "scroll"] as const;
export type SheetKind = (typeof sheetKinds)[number];
export interface SheetOptions {
  readonly kind: SheetKind;
  /** Quads along the first parameter, 1..600. */
  readonly columns?: number;
  /** Quads along the second parameter, 1..600. */
  readonly rows?: number;
  /** Uint32; only `waves` reads it. */
  readonly seed?: number;
}

function integerIn(name: string, value: number, low: number, high: number): number {
  if (!Number.isInteger(value) || value < low || value > high) throw new Error(`${name} must be an integer in ${low}..${high} (got ${String(value)})`);
  return value;
}

/** The three sinusoids of the `waves` sheet, as `[amplitude, kx, kz, phase]`, from the seed only. */
export function sheetWaves(seed: number): readonly (readonly [number, number, number, number])[] {
  const unit = (id: string): number => componentSeed(seed, id, "sheet-waves") / 0x1_0000_0000;
  return [[0.34, 2.6, 0], [0.24, 1.0, 3.6], [0.16, -3.2, 2.9]].map(([a, kx, kz], i) => {
    const turn = unit(`w${i}-turn`) * Math.PI * 2, c = Math.cos(turn), s = Math.sin(turn);
    return [a, kx * c - kz * s, kx * s + kz * c, unit(`w${i}-phase`) * Math.PI * 2] as const;
  });
}

export const HELICOID = Object.freeze({ halfWidth: 1.6, height: 1.1, turns: 1.5 * Math.PI });
export const SCROLL = Object.freeze({ inner: 0.35, gap: 0.16, turns: 2.5, height: 2.4 });

export function parametricSheetMesh(options: SheetOptions): Mesh {
  if (!sheetKinds.includes(options.kind)) throw new Error(`sheet kind must be one of ${sheetKinds.join(", ")} (got ${String(options.kind)})`);
  const columns = integerIn("sheet columns", options.columns ?? 24, 1, 600), rows = integerIn("sheet rows", options.rows ?? 24, 1, 600);
  const seed = options.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("sheet seed must be a uint32 integer");
  if ((columns + 1) * (rows + 1) > MESH_LIMITS.maxVertices || 2 * columns * rows > MESH_LIMITS.maxTriangles)
    throw new Error(`sheet ${columns} x ${rows} needs ${(columns + 1) * (rows + 1)} vertices and ${2 * columns * rows} triangles; the limits are ${MESH_LIMITS.maxVertices} and ${MESH_LIMITS.maxTriangles}; reduce columns or rows`);
  return cached(["sheet", options.kind, columns, rows, options.kind === "waves" ? seed : 0], () => {
    const positions: number[] = [], heights: number[] = [], quads: number[] = [];
    const waves = options.kind === "waves" ? sheetWaves(seed) : [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
      const a = i / columns, b = j / rows;
      let x: number, y: number, z: number;
      switch (options.kind) {
        case "saddle": x = -2 + 4 * a; z = -2 + 4 * b; y = (x * x - z * z) / 4; break;
        case "waves": {
          x = -2 + 4 * a; z = -2 + 4 * b; y = 0;
          for (const [amp, kx, kz, phase] of waves) y += amp * Math.sin(kx * x + kz * z + phase);
          break;
        }
        case "twist": {
          const u = HELICOID.halfWidth * (2 * a - 1), v = 2 * b - 1, angle = HELICOID.turns * v;
          x = u * Math.cos(angle); z = u * Math.sin(angle); y = HELICOID.height * v;
          break;
        }
        case "scroll": {
          const theta = 2 * Math.PI * SCROLL.turns * a, r = SCROLL.inner + SCROLL.gap * theta / (2 * Math.PI);
          x = r * Math.cos(theta); z = -r * Math.sin(theta); y = SCROLL.height * (b - 0.5);
          break;
        }
      }
      positions.push(x, y, z); heights.push(y);
    }
    const at = (i: number, j: number): number => j * (columns + 1) + i;
    // Orientation follows from the corner order: `saddle` and `waves` face up (as the terrain does), `twist` has its normal
    // along -z at the middle of the strip and `scroll` faces the axis, i.e. the inside of the roll (pinned by the tests).
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) quads.push(at(i, j), at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
    return mesh({ id: `sheet-${options.kind}-${columns}x${rows}`, positions, quads, attributes: [{ name: "height", domain: "vertex", size: 1, values: heights }] });
  });
}

export const MAX_PATCH_LEVELS = 6;

export function icospherePatchMesh(levels: number, halfAngle: number): Mesh {
  integerIn("patch levels", levels, 0, MAX_PATCH_LEVELS);
  if (typeof halfAngle !== "number" || !Number.isFinite(halfAngle) || halfAngle <= 0 || halfAngle > 180) throw new Error(`patch half angle must be in (0, 180] degrees (got ${String(halfAngle)})`);
  if (halfAngle === 180) return icosphereMesh(levels);
  return cached(["patch", levels, halfAngle], () => {
    const whole = icosphereMesh(levels), s = meshStorage(whole), limit = Math.cos(halfAngle * Math.PI / 180);
    const renumber = new Map<number, number>(), positions: number[] = [], triangles: number[] = [];
    for (let t = 0; t < whole.triangleCount; t++) {
      const a = s.triangles[t * 3], b = s.triangles[t * 3 + 1], c = s.triangles[t * 3 + 2];
      // The centroid direction's y over its length: the cosine of the polar angle.
      const cx = s.positions[a * 3] + s.positions[b * 3] + s.positions[c * 3], cy = s.positions[a * 3 + 1] + s.positions[b * 3 + 1] + s.positions[c * 3 + 1];
      const cz = s.positions[a * 3 + 2] + s.positions[b * 3 + 2] + s.positions[c * 3 + 2];
      if (cy / Math.hypot(cx, cy, cz) < limit) continue;
      for (const v of [a, b, c]) {
        let index = renumber.get(v);
        if (index === undefined) { index = renumber.size; renumber.set(v, index); positions.push(s.positions[v * 3], s.positions[v * 3 + 1], s.positions[v * 3 + 2]); }
        triangles.push(index);
      }
    }
    if (triangles.length === 0) throw new Error(`patch half angle ${halfAngle} degrees selects no triangle at ${levels} levels; raise it or the levels`);
    return mesh({ id: `patch-${levels}-${halfAngle}`, positions, triangles });
  });
}
