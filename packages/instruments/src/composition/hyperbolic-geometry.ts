/**
 * Hyperbolic plane geometry for regular {p,q} tilings, in the hyperboloid (Lorentz) model.
 *
 * Model. A point is X = (x0, x1, x2) with x0 > 0 and <X,X> = -x0^2 + x1^2 + x2^2 = -1. Every isometry
 * (rotations, reflections, translations) is a real linear map, a row-major 3x3 matrix, so composition is
 * matrix multiplication, a reflection is X - 2<X,n>n for a unit spacelike normal n, and orientation
 * reversal is det < 0. The Poincare disk point is z = (x1 + i x2)/(1 + x0), the inverse is
 * X = (1 + |z|^2, 2 Re z, 2 Im z)/(1 - |z|^2); the map is conformal, so angles and local frames read off
 * the disk exactly. The conformal factor of the disk at z is 1 - |z|^2 (hyperbolic length ds = 2|dz|/(1 - |z|^2)).
 *
 * Numeric policy. Binary64 throughout. An isometry that moves the origin a hyperbolic distance d has entries of
 * size e^d, so a point far out is stored as huge coordinates whose relative error was measured near 1e-10 after
 * forty compositions (<X,X> = -1 then holds only to that relative error, so it is never used to renormalise a
 * far point: `along` does not, and the disk image only needs the relative error). Nothing here compares
 * positions with a tolerance to decide identity. Identity is decided by the mirror descent below, whose sign
 * tests compare a point with the three fixed mirrors of the base triangle. The test value <X,n> is exactly
 * sinh of the signed hyperbolic distance to the mirror, so a point is either on a mirror or at least 0.24 away
 * from a mirror it is not on (measured over every corner of every {p,q} up to 24), against a tolerance of
 * 2e-9 x0 (4e-3 at the limit) and a rounding error near 1e-10 x0. That margin holds while x0 stays below
 * `MAX_HYPERBOLIC_X0`; larger requests are refused by the callers (the disk radius is limited so that they
 * cannot arise).
 *
 * The reflection group. The base triangle O, V, M has angle pi/p at O (the cell centre), pi/q at V (a cell
 * vertex) and a right angle at M (the midpoint of a cell edge). Its three sides are the mirrors
 *   0: the cell edge V M     (reflecting across it steps to the neighbouring cell),
 *   1: the axis O M          (through the centre and an edge midpoint),
 *   2: the axis O V          (through the centre and a vertex).
 * They generate the full symmetry group of the {p,q} tiling with (s1 s2)^p = (s0 s2)^q = (s0 s1)^2 = 1.
 * The triangles are the group's chambers: each cell holds 2p of them, each vertex 2q, each edge 4.
 *
 * Mirror descent (canonical address). For a point X, repeatedly reflect it across the smallest-numbered
 * base mirror that strictly separates it from the closed base triangle, until none does. Each reflection
 * moves X into the chamber one step nearer the base chamber, so the number of steps is the chamber's word
 * length (the number of mirror lines between it and the base chamber). The letters chosen are the address:
 * X is the image of the point where the descent ends by the reflections in reverse, so different points
 * have different addresses and equal points the same one. For a point on a mirror the tests treat "on the
 * mirror" as inside, so all chambers sharing that point give it one address: this is the exact
 * deduplication of coincident copies. Addresses depend on {p,q} alone, never on crop, depth or view.
 */

export type Vec3 = readonly [number, number, number];
/** Row-major 3x3 matrix acting on hyperboloid vectors. */
export type Mat3 = readonly number[];

/** Above this x0 (= cosh of the hyperbolic distance from the origin) the descent's tolerance is no longer safe. */
export const MAX_HYPERBOLIC_X0 = 2e6;

export const lorentz = (a: Vec3, b: Vec3): number => -a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function normalizeVec(a: readonly number[]): Vec3 {
  const norm = Math.sqrt(-(-a[0] * a[0] + a[1] * a[1] + a[2] * a[2]));
  return [a[0] / norm, a[1] / norm, a[2] / norm];
}

export function mul(a: Mat3, b: Mat3): number[] {
  const out = new Array<number>(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    out[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return out;
}
export function apply(a: Mat3, x: Vec3): Vec3 {
  return [a[0] * x[0] + a[1] * x[1] + a[2] * x[2], a[3] * x[0] + a[4] * x[1] + a[5] * x[2], a[6] * x[0] + a[7] * x[1] + a[8] * x[2]];
}
export function det(a: Mat3): number {
  return a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
}
/** Inverse of a hyperboloid isometry: J M^T J. */
export function inverse(a: Mat3): number[] {
  return [a[0], -a[3], -a[6], -a[1], a[4], a[7], -a[2], a[5], a[8]];
}
export const IDENTITY: Mat3 = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** Reflection across the line with unit spacelike normal n: I - 2 n n^T J. */
export function reflection(n: Vec3): number[] {
  const j = [-1, 1, 1];
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = (r === c ? 1 : 0) - 2 * n[r] * n[c] * j[c];
  return out;
}
/** Rotation about the origin by `phi` radians (counterclockwise on the disk). */
export function rotation(phi: number): number[] {
  const c = Math.cos(phi), s = Math.sin(phi);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
/** The isometry (a rotation followed by a boost along x) that takes hyperboloid point `p` to the origin. */
export function toOrigin(p: Vec3): number[] {
  const turn = Math.atan2(p[2], p[1]);
  const along = Math.acosh(Math.max(1, p[0]));
  const boost = [Math.cosh(along), -Math.sinh(along), 0, -Math.sinh(along), Math.cosh(along), 0, 0, 0, 1];
  return mul(boost, rotation(-turn));
}

export const ORIGIN: Vec3 = Object.freeze([1, 0, 0]) as unknown as Vec3;
/** Disk coordinates of a hyperboloid point. */
export function toDisk(x: Vec3): [number, number] {
  const d = 1 + x[0];
  return [x[1] / d, x[2] / d];
}
export function fromDisk(re: number, im: number): Vec3 {
  const r2 = re * re + im * im, d = 1 - r2;
  return [(1 + r2) / d, 2 * re / d, 2 * im / d];
}
/** 1 - |z|^2 for the disk image of x, without cancellation: 2/(1 + x0). */
export const conformal = (x: Vec3): number => 2 / (1 + x[0]);
/**
 * Point at fraction t of the geodesic from a to b. The combination of two hyperboloid points with these weights
 * is on the hyperboloid analytically; it is not renormalised, because near the boundary <X,X> = -1 is a
 * difference of huge numbers and dividing by its computed square root would amplify the noise.
 */
export function along(a: Vec3, b: Vec3, t: number): Vec3 {
  const cosh = Math.max(1, -lorentz(a, b));
  const d = Math.acosh(cosh);
  if (d < 1e-12) return a;
  const sa = Math.sinh((1 - t) * d) / Math.sinh(d), sb = Math.sinh(t * d) / Math.sinh(d);
  return [sa * a[0] + sb * b[0], sa * a[1] + sb * b[1], sa * a[2] + sb * b[2]];
}
export function distance(a: Vec3, b: Vec3): number {
  return Math.acosh(Math.max(1, -lorentz(a, b)));
}

/** Unit spacelike normal of the line through hyperboloid points a and b. */
function lineNormal(a: Vec3, b: Vec3): Vec3 {
  const e = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const n = [-e[0], e[1], e[2]];
  const length = Math.sqrt(-e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
  return [n[0] / length, n[1] / length, n[2] / length];
}

/** Least {p,q} for the hyperbolic condition: (p-2)(q-2) > 4. Throws naming the two controls. */
export function validateSchlafli(p: number, q: number): void {
  if (!Number.isInteger(p) || p < 3) throw new Error(`Polygon sides must be an integer of at least 3, got ${p}`);
  if (!Number.isInteger(q) || q < 3) throw new Error(`Cells at a vertex must be an integer of at least 3, got ${q}`);
  if ((p - 2) * (q - 2) <= 4)
    throw new Error(`{${p},${q}} is not a hyperbolic tiling: (p-2)(q-2) = ${(p - 2) * (q - 2)} must exceed 4. Raise Polygon sides or Cells at a vertex`);
}

/** Everything fixed by {p,q}: the base triangle, its three mirrors and the cell's own symmetries. */
export interface TriangleGroup {
  readonly p: number;
  readonly q: number;
  /** Hyperbolic circumradius O-V, inradius O-M and edge length V-V'. */
  readonly circumradius: number;
  readonly inradius: number;
  readonly edgeLength: number;
  /** Area of one cell: (p-2)pi - p * 2pi/q. */
  readonly cellArea: number;
  readonly O: Vec3;
  readonly V: Vec3;
  readonly M: Vec3;
  /** A generic point of the open base triangle. */
  readonly interior: Vec3;
  readonly normals: readonly [Vec3, Vec3, Vec3];
  /** Reflections in the mirrors 0 (cell edge), 1 (axis through M) and 2 (axis through V). */
  readonly mirrors: readonly [Mat3, Mat3, Mat3];
  /** Rotation of the cell about its centre by 2 pi / p, and its powers 0..p-1. */
  readonly turns: readonly Mat3[];
  /** The cell's vertices V_j = turns[j] V and edge midpoints M_j. */
  readonly cellVertices: readonly Vec3[];
  readonly cellMidpoints: readonly Vec3[];
}

const groups = new Map<string, TriangleGroup>();
export function triangleGroup(p: number, q: number): TriangleGroup {
  validateSchlafli(p, q);
  const key = `${p},${q}`;
  const hit = groups.get(key);
  if (hit) return hit;
  const alpha = Math.PI / p, beta = Math.PI / q;
  const R = Math.acosh(1 / (Math.tan(alpha) * Math.tan(beta)));
  const r = Math.acosh(Math.cos(beta) / Math.sin(alpha));
  const half = Math.acosh(Math.cos(alpha) / Math.sin(beta));
  const O = ORIGIN;
  const V: Vec3 = [Math.cosh(R), Math.sinh(R), 0];
  const M: Vec3 = [Math.cosh(r), Math.sinh(r) * Math.cos(alpha), Math.sinh(r) * Math.sin(alpha)];
  let n0 = lineNormal(V, M);
  if (lorentz(n0, O) < 0) n0 = [-n0[0], -n0[1], -n0[2]];
  const n1: Vec3 = [0, Math.sin(alpha), -Math.cos(alpha)];
  const n2: Vec3 = [0, 0, 1];
  const rot = rotation(2 * alpha);
  const turns: Mat3[] = [Object.freeze([...IDENTITY]) as Mat3];
  for (let j = 1; j < p; j++) turns.push(Object.freeze(mul(turns[j - 1], rot)));
  const result: TriangleGroup = Object.freeze({
    p, q, circumradius: R, inradius: r, edgeLength: 2 * half, cellArea: (p - 2) * Math.PI - p * 2 * Math.PI / q,
    O, V, M, interior: normalizeVec([O[0] + V[0] + M[0], O[1] + V[1] + M[1], O[2] + V[2] + M[2]]),
    normals: Object.freeze([n0, n1, n2]) as unknown as TriangleGroup["normals"],
    mirrors: Object.freeze([Object.freeze(reflection(n0)), Object.freeze(reflection(n1)), Object.freeze(reflection(n2))]) as unknown as TriangleGroup["mirrors"],
    turns: Object.freeze(turns),
    cellVertices: Object.freeze(turns.map((t) => apply(t, V))),
    cellMidpoints: Object.freeze(turns.map((t) => apply(t, M))),
  });
  groups.set(key, result);
  return result;
}

export interface MirrorAddress {
  /** Letters "0", "1", "2": the mirrors reflected across, in order, from the point toward the base triangle. */
  readonly word: string;
  /** Where the descent ends: a point of the closed base triangle. */
  readonly base: Vec3;
}

/** See the module header. Throws when the point is too far from the origin for the tolerance to be safe. */
export function mirrorAddress(group: TriangleGroup, point: Vec3): MirrorAddress {
  if (!(point[0] <= MAX_HYPERBOLIC_X0) || !Number.isFinite(point[0]))
    throw new Error(`Point is too close to the disk boundary for exact addressing (x0 = ${point[0]}, limit ${MAX_HYPERBOLIC_X0})`);
  const tolerance = 2e-9 * Math.max(1, point[0]);
  const { normals } = group;
  let x0 = point[0], x1 = point[1], x2 = point[2];
  let word = "";
  for (let guard = 0; guard < 4096; guard++) {
    let moved = false;
    for (let i = 0; i < 3; i++) {
      const n = normals[i];
      const s = -x0 * n[0] + x1 * n[1] + x2 * n[2];
      if (s < -tolerance) {
        const k = 2 * s;
        x0 -= k * n[0]; x1 -= k * n[1]; x2 -= k * n[2];
        word += i;
        moved = true;
        break;
      }
    }
    if (!moved) return { word, base: [x0, x1, x2] };
  }
  throw new Error("Mirror descent did not terminate; the point is outside the supported disk");
}

/** The group element g with g(base) = the addressed point: the product of the address's reflections, first letter leftmost. */
export function addressMatrix(group: TriangleGroup, word: string): number[] {
  let m: number[] = [...IDENTITY];
  for (const letter of word) m = mul(m, group.mirrors[Number(letter) as 0 | 1 | 2]);
  return m;
}

/** A chamber-frame image read off the disk: where a canonical point goes and how its local axes turn. */
export interface DiskFrame {
  /** Disk coordinates of the image point. */
  readonly z: readonly [number, number];
  /** Radians, in disk coordinates: direction the canonical +x axis (disk direction at `x`) is sent to. */
  readonly angle: number;
  /** The disk's conformal factor 1 - |z|^2 at the image point; 1 at the disk centre. */
  readonly kappa: number;
  /** True when the isometry reverses orientation, so the local +y axis is sent to the left of the image of +x. */
  readonly mirrored: boolean;
}

/**
 * The differential of isometry `m` at canonical point `x`, in disk coordinates. The disk is conformal, so
 * the image of a small disk-aligned square is a square turned by `angle`, scaled by kappa/(1 - |x|^2) and
 * reflected when `mirrored`. Only the turn and the reflection are returned; the marks' size rule is kappa.
 */
export function frameOf(m: Mat3, x: Vec3): DiskFrame {
  const [a, b] = toDisk(x);
  const d0 = 1 - a * a - b * b, d2 = d0 * d0;
  const ta: Vec3 = [4 * a / d2, (2 * d0 + 4 * a * a) / d2, 4 * a * b / d2];
  const tb: Vec3 = [4 * b / d2, 4 * a * b / d2, (2 * d0 + 4 * b * b) / d2];
  const w = apply(m, x), ia = apply(m, ta), ib = apply(m, tb);
  const d = 1 + w[0];
  const ax = ia[1] / d - w[1] * ia[0] / (d * d), ay = ia[2] / d - w[2] * ia[0] / (d * d);
  const bx = ib[1] / d - w[1] * ib[0] / (d * d), by = ib[2] / d - w[2] * ib[0] / (d * d);
  return { z: toDisk(w), angle: Math.atan2(ay, ax), kappa: 2 / d, mirrored: ax * by - ay * bx < 0 };
}
