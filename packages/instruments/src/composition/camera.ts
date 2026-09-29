/**
 * Cameras (F8): orthographic and perspective projection with exact, documented conventions.
 *
 * World space is right-handed with +Y up (see `mesh.ts`); canvas space has x to the right and y DOWN.
 *
 * Pose. The camera looks at `target` from `distance` along a direction set by `yaw` and `pitch` (degrees):
 * with yaw 0 and pitch 0 the eye is on the +Z axis looking toward -Z; positive yaw swings the eye toward +X
 * (counter-clockwise seen from above); positive pitch raises the eye above the horizon. The camera basis is
 * built by rotation (not a look-at), so pitch +-90 is not singular. `roll` then turns the picture about the
 * viewing axis: positive roll rotates the image CLOCKWISE on the canvas (a world point on the screen's right
 * moves down). With basis `right`, `up`, `forward` (unit, world coordinates) and `eye = target - forward *
 * distance`, a point `p` has camera-space coordinates `xc = (p - eye) . right`, `yc = (p - eye) . up`,
 * `zc = (p - eye) . forward`; `zc` is the DEPTH: distance along the viewing axis, larger is farther.
 * Angles at multiples of 90 degrees use exact sines and cosines (0, +-1), so axis-aligned views are exact.
 *
 * Projection to canvas: `x = center.x + s * xc`, `y = center.y - s * yc`, with `s = zoom` (orthographic;
 * `distance` then only fixes where depth starts) or `s = zoom * distance / zc` (perspective). In both, `zoom` is
 * canvas units per world unit at the target's depth, and the target lands on `center`. Straight lines project
 * to straight lines (a 3D segment is a 2D segment in both modes), and parameters along the segment are
 * preserved by the affine camera-space map, which the hidden-line solver relies on.
 *
 * Near plane. A perspective camera cannot see `zc < near` (default `distance / 50`): `project` returns null
 * there. Orthographic cameras have no near plane; depth may be negative.
 *
 * A camera is a small frozen value; equal options give equal cameras (`key` is a string of the resolved
 * options). Palette, material and camera edits never touch meshes or their derived values.
 */
import type { Vec3 } from "./mesh.js";

export type Projection = "orthographic" | "perspective";
export interface CameraOptions {
  readonly projection: Projection;
  /** Degrees. */
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  /** World point that lands on `center`. */
  readonly target: Vec3;
  /** Canvas units per world unit at the target depth; positive. */
  readonly zoom: number;
  /** Eye-to-target distance in world units; positive. Fixes perspective strength and the origin of depth. */
  readonly distance: number;
  /** Perspective near plane distance from the eye, positive. Default `distance / 50`. */
  readonly near: number;
  /** Canvas position of the target. */
  readonly center: readonly [number, number];
}
export interface ProjectedVertex {
  readonly x: number;
  readonly y: number;
  /** Camera-space depth `zc` (larger is farther). */
  readonly depth: number;
}
export interface Camera {
  readonly options: CameraOptions;
  readonly eye: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
  readonly forward: Vec3;
  /** Canvas units per camera-space unit at depth `zc`. */
  scaleAt(depth: number): number;
  /** Write camera-space `(xc, yc, zc)` of a world point into `out[offset..offset+2]`. */
  toView(x: number, y: number, z: number, out: Float64Array, offset: number): void;
  /** The world point with the given camera-space coordinates. */
  fromView(xc: number, yc: number, zc: number): Vec3;
  /** Canvas position and depth of a world point, or null when it is nearer than a perspective near plane. */
  project(point: Vec3): ProjectedVertex | null;
  /** The world point seen at canvas `(x, y)` at camera depth `depth`. */
  unproject(x: number, y: number, depth: number): Vec3;
  /** Unit vector from a world point toward the eye (constant for orthographic cameras). */
  viewDirection(point: Vec3): Vec3;
  /** Resolved options as a string; equal for cameras with equal options. */
  readonly key: string;
}

export const DEFAULT_CAMERA: CameraOptions = Object.freeze({
  projection: "orthographic", yaw: 30, pitch: 20, roll: 0, target: Object.freeze([0, 0, 0]) as Vec3,
  zoom: 100, distance: 10, near: 0.2, center: Object.freeze([0, 0]) as readonly [number, number],
});

function sincos(degrees: number): [number, number] {
  const d = ((degrees % 360) + 360) % 360;
  if (d === 0) return [0, 1]; if (d === 90) return [1, 0]; if (d === 180) return [0, -1]; if (d === 270) return [-1, 0];
  const r = degrees * Math.PI / 180;
  return [Math.sin(r), Math.cos(r)];
}

export function camera(input: Partial<CameraOptions> = {}): Camera {
  const o = { ...DEFAULT_CAMERA, ...input };
  if (input.near === undefined && input.distance !== undefined) o.near = o.distance / 50;
  if (o.projection !== "orthographic" && o.projection !== "perspective") throw new Error(`Camera projection must be "orthographic" or "perspective" (got ${String(o.projection)})`);
  for (const key of ["yaw", "pitch", "roll"] as const)
    if (typeof o[key] !== "number" || !Number.isFinite(o[key]) || Math.abs(o[key]) > 1e6) throw new Error(`Camera ${key} must be a finite number of degrees (got ${String(o[key])})`);
  for (const key of ["zoom", "distance", "near"] as const)
    if (typeof o[key] !== "number" || !Number.isFinite(o[key]) || o[key] <= 0) throw new Error(`Camera ${key} must be a positive finite number (got ${String(o[key])})`);
  if (!Array.isArray(o.target) || o.target.length !== 3 || o.target.some((v) => typeof v !== "number" || !Number.isFinite(v))) throw new Error("Camera target must be three finite numbers");
  if (!Array.isArray(o.center) || o.center.length !== 2 || o.center.some((v) => typeof v !== "number" || !Number.isFinite(v))) throw new Error("Camera center must be two finite numbers");
  const resolved: CameraOptions = Object.freeze({ ...o, target: Object.freeze([...o.target]) as Vec3, center: Object.freeze([...o.center]) as readonly [number, number] });

  const [sy, cy] = sincos(o.yaw), [sp, cp] = sincos(o.pitch), [sr, cr] = sincos(o.roll);
  const right0: Vec3 = [cy, 0, -sy], up0: Vec3 = [-sp * sy, cp, -sp * cy], back: Vec3 = [cp * sy, sp, cp * cy];
  // `+ 0` turns -0 into 0 so axis-aligned bases compare equal to their exact values.
  const right = Object.freeze(right0.map((v, i) => cr * v + sr * up0[i] + 0)) as unknown as Vec3;
  const up = Object.freeze(up0.map((v, i) => -sr * right0[i] + cr * v + 0)) as unknown as Vec3;
  const forward = Object.freeze([0 - back[0], 0 - back[1], 0 - back[2]]) as unknown as Vec3;
  const eye = Object.freeze([o.target[0] + back[0] * o.distance + 0, o.target[1] + back[1] * o.distance + 0, o.target[2] + back[2] * o.distance + 0]) as unknown as Vec3;
  const perspective = o.projection === "perspective";
  const [cx, cyc] = o.center;

  const scaleAt = (depth: number): number => (perspective ? o.zoom * o.distance / depth : o.zoom);
  const toView = (x: number, y: number, z: number, out: Float64Array, offset: number): void => {
    const dx = x - eye[0], dy = y - eye[1], dz = z - eye[2];
    out[offset] = dx * right[0] + dy * right[1] + dz * right[2];
    out[offset + 1] = dx * up[0] + dy * up[1] + dz * up[2];
    out[offset + 2] = dx * forward[0] + dy * forward[1] + dz * forward[2];
  };
  const fromView = (xc: number, yc: number, zc: number): Vec3 => [
    eye[0] + xc * right[0] + yc * up[0] + zc * forward[0],
    eye[1] + xc * right[1] + yc * up[1] + zc * forward[1],
    eye[2] + xc * right[2] + yc * up[2] + zc * forward[2]];
  const scratch = new Float64Array(3);
  return Object.freeze({
    options: resolved, eye, right, up, forward, scaleAt, toView, fromView,
    project(point: Vec3): ProjectedVertex | null {
      toView(point[0], point[1], point[2], scratch, 0);
      if (perspective && scratch[2] < o.near) return null;
      const s = scaleAt(scratch[2]);
      return { x: cx + s * scratch[0], y: cyc - s * scratch[1], depth: scratch[2] };
    },
    unproject(x: number, y: number, depth: number): Vec3 {
      const s = scaleAt(depth);
      return fromView((x - cx) / s, -(y - cyc) / s, depth);
    },
    viewDirection(point: Vec3): Vec3 {
      if (!perspective) return [-forward[0], -forward[1], -forward[2]];
      const dx = eye[0] - point[0], dy = eye[1] - point[1], dz = eye[2] - point[2], length = Math.hypot(dx, dy, dz);
      return [dx / length, dy / length, dz / length];
    },
    key: JSON.stringify([o.projection, o.yaw, o.pitch, o.roll, o.target, o.zoom, o.distance, o.near, o.center]),
  });
}
