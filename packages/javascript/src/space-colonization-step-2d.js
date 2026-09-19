import { fdlibmHypot } from "./internal/fdlibm-hypot.js";
import { array, at, calc, integer, num, point, record, z } from "./internal/graph-growth-utils.js";

const MAX_TIPS = 2048;

/** Error with one of the stable growth.space-colonization-step-2d contract codes. */
export class SpaceColonizationStep2DError extends Error {
  constructor(code) {
    super(code);
    this.name = "SpaceColonizationStep2DError";
    this.code = code;
  }
}

/**
 * One bounded space-colonization growth step.
 * Implements growth.space-colonization-step-2d 0.1.0.
 */
export function spaceColonizationStep2D(input) {
  const E = SpaceColonizationStep2DError;
  const source = record(input,
    ["tips", "sources", "consumed", "step", "reach", "branches", "branchAngle", "maxWork"], E);

  const rawTips = array(at(source, "tips"), E);
  if (rawTips.length < 1) throw new E("INVALID_INPUT");
  const tips = [];
  for (let i = 0; i < rawTips.length; i++) tips.push(point(at(rawTips, i), E));

  const rawSources = array(at(source, "sources"), E);
  if (rawSources.length < 1) throw new E("INVALID_INPUT");
  const sources = [];
  for (let i = 0; i < rawSources.length; i++) sources.push(point(at(rawSources, i), E));

  const rawConsumed = array(at(source, "consumed"), E);
  if (rawConsumed.length !== sources.length) throw new E("INVALID_INPUT");
  const consumed = [];
  for (let i = 0; i < rawConsumed.length; i++) {
    const value = at(rawConsumed, i);
    if (typeof value !== "boolean") throw new E("INVALID_INPUT");
    consumed.push(value);
  }

  const step = num(at(source, "step"), E);
  const reach = num(at(source, "reach"), E);
  if (!(step > 0) || !(reach > 0)) throw new E("INVALID_INPUT");
  const branches = integer(at(source, "branches"), E, 1);
  const branchAngle = num(at(source, "branchAngle"), E);
  const maxWork = integer(at(source, "maxWork"), E);

  const work = tips.length * sources.length;
  if (work > maxWork) throw new E("WORK_LIMIT");

  const newTips = [];
  const segments = [];
  let dropped = 0;
  const addTip = (x, y) => {
    if (newTips.length >= MAX_TIPS) { dropped += 1; return; }
    newTips.push([z(x), z(y)]);
  };

  for (const tip of tips) {
    // Nearest unconsumed source by squared distance; ties by lower source index.
    let nearest = -1;
    let nearestSq = Infinity;
    for (let s = 0; s < sources.length; s++) {
      if (consumed[s]) continue;
      const dx = sources[s][0] - tip[0];
      const dy = sources[s][1] - tip[1];
      const sq = dx * dx + dy * dy;
      if (sq < nearestSq) { nearestSq = sq; nearest = s; }
    }
    if (nearest < 0) continue; // no unconsumed source: the tip is removed.

    const sx = sources[nearest][0];
    const sy = sources[nearest][1];
    const dx = sx - tip[0];
    const dy = sy - tip[1];
    const d = calc(fdlibmHypot(dx, dy), E);
    const ux = calc(dx / d, E);
    const uy = calc(dy / d, E);

    if (d <= reach) {
      // Reached: consume the source, emit the tip->source segment, branch.
      consumed[nearest] = true;
      segments.push([tip[0], tip[1], sx, sy]);
      for (let k = 0; k < branches; k++) {
        const angle = branches === 1 ? 0 : (k - (branches - 1) / 2) * (2 * branchAngle / (branches - 1));
        const c = calc(Math.cos(angle), E);
        const s = calc(Math.sin(angle), E);
        // rotate the unit growth direction by angle.
        const rx = calc(ux * c - uy * s, E);
        const ry = calc(ux * s + uy * c, E);
        addTip(calc(sx + step * rx, E), calc(sy + step * ry, E));
      }
    } else {
      // Beyond reach: grow by step along the direction to the source.
      const nx = calc(tip[0] + step * ux, E);
      const ny = calc(tip[1] + step * uy, E);
      segments.push([tip[0], tip[1], nx, ny]);
      addTip(nx, ny);
    }
  }

  return { tips: newTips, segments, consumed, dropped };
}
