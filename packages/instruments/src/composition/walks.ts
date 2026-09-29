/**
 * Bounded deterministic random-walk steppers for stateful systems. Each takes the caller's per-element
 * `SeededStream` (from `SimulationContext.stream`) and consumes a FIXED number of draws per call, so an
 * element's walk never depends on what blocked it or on any other element.
 */
import type { SeededStream } from "./snapshot-values.js";

/** Lattice directions in their fixed tie/selection order: E, S, W, N, then SE, SW, NW, NE (y grows down). */
export const LATTICE_DIRECTIONS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([1, 0] as const), Object.freeze([0, 1] as const), Object.freeze([-1, 0] as const), Object.freeze([0, -1] as const),
  Object.freeze([1, 1] as const), Object.freeze([-1, 1] as const), Object.freeze([-1, -1] as const), Object.freeze([1, -1] as const),
]);

export interface LatticeWalkOptions {
  /** Cells are `0 ≤ x < columns`, `0 ≤ y < rows`; a step never leaves them. */
  readonly columns: number;
  readonly rows: number;
  /** 4 (E, S, W, N) or 8 (adding the diagonals). */
  readonly neighbourhood: 4 | 8;
  /** Probability of keeping `previous` when it is free; 0 is a memoryless walk. */
  readonly persistence: number;
  /** Direction index (into `LATTICE_DIRECTIONS`) taken last, or -1 / omitted. */
  readonly previous?: number;
  /** Cells that may not be entered. */
  readonly blocked?: (x: number, y: number) => boolean;
}

export interface LatticeStep {
  readonly x: number;
  readonly y: number;
  /** Chosen direction index, or -1 when every neighbour is blocked or off the lattice. */
  readonly direction: number;
  /** True when no move was possible; the walker stays put (an honest, explicit stop). */
  readonly stuck: boolean;
}

/**
 * One lattice step. Free neighbours are taken in `LATTICE_DIRECTIONS` order; with probability
 * `persistence` a free `previous` direction is kept, otherwise one free direction is chosen uniformly.
 * Always consumes exactly two draws (persistence, then choice), including when stuck.
 */
export function latticeWalkStep(x: number, y: number, stream: SeededStream, options: LatticeWalkOptions): LatticeStep {
  const { columns, rows, neighbourhood, persistence, previous = -1, blocked } = options;
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1) throw new Error("columns and rows must be positive integers");
  if (neighbourhood !== 4 && neighbourhood !== 8) throw new Error("neighbourhood must be 4 or 8");
  if (!(persistence >= 0 && persistence <= 1)) throw new Error("persistence must be from 0 to 1");
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= columns || y >= rows) throw new Error(`Walker at (${x}, ${y}) is outside the ${columns} × ${rows} lattice`);
  if (!Number.isInteger(previous) || previous < -1 || previous >= neighbourhood) throw new Error(`previous must be -1 or a direction index below ${neighbourhood}`);
  const keep = stream.next(), pick = stream.next();
  const free: number[] = [];
  for (let d = 0; d < neighbourhood; d++) {
    const nx = x + LATTICE_DIRECTIONS[d][0], ny = y + LATTICE_DIRECTIONS[d][1];
    if (nx < 0 || ny < 0 || nx >= columns || ny >= rows || blocked?.(nx, ny)) continue;
    free.push(d);
  }
  if (free.length === 0) return { x, y, direction: -1, stuck: true };
  const direction = previous >= 0 && keep < persistence && free.includes(previous) ? previous : free[Math.min(free.length - 1, Math.floor(pick * free.length))];
  return { x: x + LATTICE_DIRECTIONS[direction][0], y: y + LATTICE_DIRECTIONS[direction][1], direction, stuck: false };
}

export interface AngleWalkOptions {
  /** Distance moved per step, in (0, 1e6]. */
  readonly length: number;
  /** Largest heading change per step in radians, from 0 to π; π is a fully random direction each step. */
  readonly turn: number;
}

export interface AngleStep { readonly x: number; readonly y: number; readonly heading: number }

/** One continuous step: heading changes by a uniform amount within ±`turn`, then the walker moves `length`. One draw. */
export function angleWalkStep(x: number, y: number, heading: number, stream: SeededStream, options: AngleWalkOptions): AngleStep {
  const { length, turn } = options;
  if (![x, y, heading].every(Number.isFinite)) throw new Error("Walker position and heading must be finite");
  if (!(length > 0 && length <= 1e6)) throw new Error("length must be greater than 0 and at most 1e6");
  if (!(turn >= 0 && turn <= Math.PI)) throw new Error("turn must be from 0 to π");
  const next = heading + (stream.next() * 2 - 1) * turn;
  return { x: x + Math.cos(next) * length, y: y + Math.sin(next) * length, heading: next };
}
