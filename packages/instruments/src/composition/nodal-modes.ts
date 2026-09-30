/*
 * Ideal standing-wave modes of a plate, as scalar functions.
 *
 * MODEL. Each mode is an eigenfunction of the Laplacian on the plate, ∇²ψ = −k²ψ, with ONE boundary
 * condition for the whole plate:
 *   free   ∂ψ/∂n = 0 on the edge (a free membrane / Neumann problem). Rectangle: cos(a·u)·cos(b·v).
 *   fixed  ψ = 0 on the edge (a clamped membrane / Dirichlet problem). Rectangle: sin(a·u)·sin(b·v).
 * The two are never mixed within one plate. This is the *scalar wave equation*; a real vibrating plate
 * obeys the fourth-order Kirchhoff equation, whose free-edge modes are not these cosines, and no claim
 * of physical accuracy, of a matching resonance frequency or of sand behaviour is made. It is a
 * mathematical figure generator in the family of the classical Chladni figures.
 *
 * INDEXING. The two indices `n`, `m` are counts of interior nodal curves, so they mean the same under
 * both edges and never make a mode vanish:
 *   rectangle  `n` lines across the width, `m` lines across the height (free: n, m ≥ 0, (0, 0) is the
 *              uniform mode with no nodes; fixed: the mode is sin((n+1)πu/W)·sin((m+1)πv/H)).
 *   circle     `n` nodal diameters, `m` nodal circles strictly inside the edge. ψ = J_n(κ r/R)·cos(n(θ−orient)),
 *              κ the (m+1)-th positive zero of J_n (fixed) or of J_n′ (free; for n = 0 the m-th, because the
 *              trivial zero at 0 is the uniform mode).
 *   u, v are coordinates from a corner of the rectangle; r, θ are polar about the circle's center.
 * `k` is the wavenumber (radians per canvas unit): π·√(n′²/W² + m′²/H²) with n′ = n (free) or n + 1
 * (fixed), or κ/R. Dispersion is ω = c·k (a membrane), so frequency ratios are wavenumber ratios.
 *
 * ACCURACY. `besselJ` is Bessel's integral by the trapezoid rule, which converges geometrically for a
 * periodic analytic integrand: absolute error below 1e-13 for |x| ≤ 100 (tested against 80-digit series).
 * Circle modes evaluate the radial function from a cubic Hermite table (3,072 intervals over r/R ∈ [0, 1.75],
 * values and exact derivatives): absolute error below 1e-8 for κ ≤ 80; outside the table the exact integral is used.
 * Every mode is scaled so that its maximum magnitude inside the plate is 1.
 */

const TAU = 2 * Math.PI;
export const NODAL_MAX_INDEX = 24;
const TABLE_INTERVALS = 3072;
const TABLE_REACH = 1.75;

/** Bessel function of the first kind J_n(x) and its derivative, integer order n ≥ 0, |x| ≤ 1000. */
export function besselPair(n: number, x: number): { value: number; derivative: number } {
  if (!Number.isInteger(n) || n < 0 || n > 200) throw new Error("Bessel order must be an integer in [0, 200]");
  if (!Number.isFinite(x) || Math.abs(x) > 1000) throw new Error("Bessel argument must be finite with |x| ≤ 1000");
  const ax = Math.abs(x);
  const steps = Math.ceil(1.25 * ax) + n + 48;
  let sum = 0, slope = 0;
  for (let j = 0; j < steps; j++) {
    const tau = TAU * j / steps, sine = Math.sin(tau), angle = n * tau - ax * sine;
    sum += Math.cos(angle);
    slope += sine * Math.sin(angle);
  }
  // J_n(−x) = (−1)^n J_n(x); the derivative has the opposite parity.
  const odd = n % 2 === 1;
  return { value: (x < 0 && odd ? -sum : sum) / steps, derivative: (x < 0 && !odd ? -slope : slope) / steps };
}
export const besselJ = (n: number, x: number): number => besselPair(n, x).value;
export const besselJPrime = (n: number, x: number): number => besselPair(n, x).derivative;

const zeroCache = new Map<string, number>();
/**
 * The k-th positive zero (k ≥ 1) of J_n, or of J_n′ when `derivative`. Found by a sign scan from where the
 * first zero cannot lie before (x = n; J_n′ and J_n are positive there) with step 0.1, then bisection to
 * machine precision. For n = 0 with `derivative` the zero at 0 is skipped.
 */
export function besselZero(n: number, k: number, derivative = false): number {
  if (!Number.isInteger(k) || k < 1 || k > 60) throw new Error("Bessel zero index must be an integer in [1, 60]");
  const key = `${n}:${k}:${derivative}`;
  const hit = zeroCache.get(key);
  if (hit !== undefined) return hit;
  const f = (x: number) => { const p = besselPair(n, x); return derivative ? p.derivative : p.value; };
  let x = n === 0 ? 0.01 : n, previous = f(x), found = 0;
  for (;;) {
    const next = x + 0.1, value = f(next);
    if (previous * value < 0 || value === 0) {
      if (++found === k) {
        let lo = x, hi = next, flo = previous;
        for (let i = 0; i < 100; i++) {
          const mid = (lo + hi) / 2, fm = f(mid);
          if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
        }
        const zero = (lo + hi) / 2;
        zeroCache.set(key, zero);
        return zero;
      }
    }
    x = next; previous = value;
    if (x > 1000) throw new Error(`Bessel zero ${k} of order ${n} lies beyond x = 1000`);
  }
}

export type NodalShape = "square" | "rectangle" | "circle";
export type NodalEdge = "free" | "fixed";

/** A mode function on the plate's local frame (origin at the center, +x right, +y down) with its wavenumber. */
export interface ModeFunction {
  /** Wavenumber in radians per canvas unit; 0 only for the uniform free mode. */
  readonly k: number;
  readonly at: (x: number, y: number) => number;
}

interface RadialTable { readonly kappa: number; readonly order: number; readonly values: Float64Array; readonly slopes: Float64Array; readonly peak: number }
const tables = new Map<string, RadialTable>();
function radialTable(order: number, kappa: number): RadialTable {
  const key = `${order}:${kappa}`;
  let table = tables.get(key);
  if (table) return table;
  const values = new Float64Array(TABLE_INTERVALS + 1), slopes = new Float64Array(TABLE_INTERVALS + 1);
  let peak = 0;
  for (let i = 0; i <= TABLE_INTERVALS; i++) {
    const s = TABLE_REACH * i / TABLE_INTERVALS, p = besselPair(order, kappa * s);
    values[i] = p.value; slopes[i] = kappa * p.derivative;
    if (s <= 1) peak = Math.max(peak, Math.abs(p.value));
  }
  table = { kappa, order, values, slopes, peak };
  tables.set(key, table);
  if (tables.size > 48) tables.delete(tables.keys().next().value!);
  return table;
}
function radial(table: RadialTable, s: number): number {
  if (s >= TABLE_REACH) return besselJ(table.order, table.kappa * s) / table.peak;
  const h = TABLE_REACH / TABLE_INTERVALS, position = s / h, i = Math.min(TABLE_INTERVALS - 1, Math.floor(position)), t = position - i;
  const t2 = t * t, t3 = t2 * t, v = table.values, d = table.slopes;
  return ((2 * t3 - 3 * t2 + 1) * v[i] + (t3 - 2 * t2 + t) * h * d[i] + (-2 * t3 + 3 * t2) * v[i + 1] + (t3 - t2) * h * d[i + 1]) / table.peak;
}

/** The (n, m) mode of a rectangle of width `width` and height `height`. */
export function rectangleMode(edge: NodalEdge, n: number, m: number, width: number, height: number): ModeFunction {
  const shift = edge === "fixed" ? 1 : 0;
  const a = (n + shift) * Math.PI / width, b = (m + shift) * Math.PI / height;
  const k = Math.hypot(a, b);
  if (edge === "free") return { k, at: (x, y) => Math.cos(a * (x + width / 2)) * Math.cos(b * (y + height / 2)) };
  return { k, at: (x, y) => Math.sin(a * (x + width / 2)) * Math.sin(b * (y + height / 2)) };
}

/** The (n, m) mode of a disc of radius `radius`, its angular pattern turned by `orient` radians (clockwise on screen). */
export function circleMode(edge: NodalEdge, n: number, m: number, radius: number, orient: number): ModeFunction {
  if (edge === "free" && n === 0 && m === 0) return { k: 0, at: () => 1 };
  const kappa = edge === "fixed" ? besselZero(n, m + 1) : besselZero(n, n === 0 ? m : m + 1, true);
  const table = radialTable(n, kappa);
  return {
    k: kappa / radius,
    at: (x, y) => {
      const r = Math.hypot(x, y);
      return radial(table, r / radius) * (n === 0 ? 1 : Math.cos(n * (Math.atan2(y, x) - orient)));
    },
  };
}
