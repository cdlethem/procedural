import { resamplePolyline2D } from "../../src/resample-polyline-2d.js";

export const ORBITAL_WORK_BUDGET = 64_000;
const cache = new Map();

export function orbitalSourceVertices(q) {
  return q.source === "wave" ? Math.max(128, Number(q.lobes) * 24) : 128;
}

export function validateOrbitalRecordInput(q) {
  const paths = Number(q.paths), samples = Number(q.samples), vertices = orbitalSourceVertices(q);
  if (!Number.isSafeInteger(paths * (vertices + samples)) ||
      paths * (vertices + samples) > ORBITAL_WORK_BUDGET)
    throw new Error(`Orbital brush has a ${ORBITAL_WORK_BUDGET}-point generation budget`);
  const last = (paths - 1) * Number(q.radialSpacing);
  if (Number(q.radiusX) + last < 0 || Number(q.radiusY) + last < 0)
    throw new Error("Radius step would make a later path radius negative");
}

/**
 * Example-private source record; mark controls and palette are deliberately absent.
 * @returns {ReadonlyArray<{points: ReadonlyArray<ReadonlyArray<number>>, distances: ReadonlyArray<number>, colorIndex: number}>}
 */
export function orbitalBrushRecords({ params: q }) {
  validateOrbitalRecordInput(q);
  const key = JSON.stringify([q.source, q.centerX, q.centerY, q.centerStepX, q.centerStepY,
    q.radiusX, q.radiusY, q.paths, q.radialSpacing, q.angle, q.angleStep,
    q.lobes, q.depth, q.samples]);
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const count = Number(q.paths), vertices = orbitalSourceVertices(q), sampleCount = Number(q.samples);
  const paths = [];
  for (let index = 0; index < count; index += 1) {
    const cx = Number(q.centerX) + index * Number(q.centerStepX);
    const cy = Number(q.centerY) + index * Number(q.centerStepY);
    const rx = Number(q.radiusX) + index * Number(q.radialSpacing);
    const ry = Number(q.radiusY) + index * Number(q.radialSpacing);
    const angle = (Number(q.angle) + index * Number(q.angleStep)) * Math.PI / 180;
    const cosAngle = Math.cos(angle), sinAngle = Math.sin(angle);
    const source = new Array(vertices);
    for (let vertex = 0; vertex < vertices; vertex += 1) {
      const theta = vertex * Math.PI * 2 / vertices;
      const wave = q.source === "wave" ? 1 + Number(q.depth) * Math.sin(Number(q.lobes) * theta) : 1;
      const x = Math.cos(theta) * rx * wave, y = Math.sin(theta) * ry * wave;
      source[vertex] = [cx + x * cosAngle - y * sinAngle, cy + x * sinAngle + y * cosAngle];
    }
    const sampled = resamplePolyline2D({ points: source, closed: true, count: sampleCount,
      maxWork: vertices + sampleCount });
    paths.push(Object.freeze({
      points: Object.freeze(sampled.points.map(point => Object.freeze(point.slice()))),
      distances: Object.freeze(sampled.distances.slice()), colorIndex: index,
    }));
  }
  const retained = Object.freeze(paths);
  cache.set(key, retained);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  return retained;
}

export function spacedSampleIndices(path, spacing) {
  if (spacing === 0) return path.points.map((_, index) => index);
  const selected = [0];
  let nextDistance = spacing;
  for (let index = 1; index < path.points.length; index += 1) {
    if (path.distances[index] < nextDistance) continue;
    selected.push(index);
    nextDistance = (Math.floor(path.distances[index] / spacing) + 1) * spacing;
  }
  return selected;
}
