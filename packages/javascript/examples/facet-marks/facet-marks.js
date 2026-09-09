import { delaunay2D } from "../../src/delaunay.js";
import { seededTrianglePoints2D } from "../../src/triangle-points.js";
import { seededQuadrantPartition2D } from "../../src/quadrant-partition.js";

/**
 * Example composition using retained CP9 facets and CP5 triangle grain. Independently
 * drawn from survey/out/2018/Generativos/datata/notes.md and
 * survey/out/2019/generativos/lightcity/notes.md; the disc site source is an authored
 * java.util.Random example, while the cell source transfers CP4 leaf centres. Both
 * differ from the global streams, source-site filters, halo styling, and rendering in
 * those notes. The fixed counts, canvas, density, and budget are this example's
 * choices, not operation defaults or artistic ranges. See
 * catalog/validation/delaunay-2d.json, targets.processing-java.technique.
 */
const MAX_UNSIGNED32 = 4294967295;
const TRIANGULATION_WORK = 50000000;
const GRAIN_LIMIT = 20000;
const GRAIN_DENSITY = 0.06;

// Example-only java.util.Random nextDouble sequence, matching FacetComposition's
// authored disc-site source. This does not expose or alter the library's private
// xoshiro sampling stream. Duplicated per-module per the established convention
// (see grain-marks.js's identical helper).
function javaExampleRandom(seed) {
  const multiplier = 0x5deece66dn, mask = (1n << 48n) - 1n;
  let state = (BigInt(seed) ^ multiplier) & mask;
  function next(bits) {
    state = (state * multiplier + 11n) & mask;
    return Number(state >> BigInt(48 - bits));
  }
  return () => (next(26) * 134217728 + next(27)) / 9007199254740992;
}

function discSites(seed, fine) {
  const count = fine ? 512 : 128;
  const random = javaExampleRandom(seed);
  const sites = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const angle = random() * (2.0 * Math.PI);
    const radius = 240.0 * Math.sqrt(random());
    sites[index] = [320.0 + radius * Math.cos(angle), 320.0 + radius * Math.sin(angle)];
  }
  return sites;
}

function cellSites(seed, fine) {
  const replacements = fine ? 170 : 42;
  const layout = seededQuadrantPartition2D({
    seed, replacements, origin: [64.0, 64.0], extent: [512.0, 512.0], selectionFraction: 0.5,
  });
  const sites = new Array(layout.size);
  const bounds = [0, 0, 0, 0];
  for (let index = 0; index < layout.size; index += 1) {
    layout.boundsInto(index, bounds);
    sites[index] = [bounds[0] + (bounds[2] - bounds[0]) * 0.5, bounds[1] + (bounds[3] - bounds[1]) * 0.5];
  }
  return sites;
}

/** Builds one retained facet mesh and a retained uniform grain batch for every face.
 * fine selects 512 rather than 128 disc sites, or 170 rather than 42 CP4 replacements;
 * cells selects CP4 leaf centres rather than the disc source.
 */
export function createFacetMarks(seed = 42, fine = false, cells = false) {
  if (seed < 0 || seed > MAX_UNSIGNED32) throw new RangeError("seed must be uint32");
  const sites = cells ? cellSites(seed, fine) : discSites(seed, fine);
  const mesh = delaunay2D({ points: sites, maxWork: TRIANGULATION_WORK });

  const faces = mesh.faceCount;
  const counts = new Array(faces);
  let total = 0;
  const a = [0, 0], b = [0, 0], c = [0, 0];
  for (let face = 0; face < faces; face += 1) {
    const indices = mesh.triangleAt(face);
    mesh.pointInto(indices[0], a);
    mesh.pointInto(indices[1], b);
    mesh.pointInto(indices[2], c);
    const twiceArea = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const requested = Math.floor(Math.abs(twiceArea) * 0.5 * GRAIN_DENSITY);
    if (!Number.isFinite(requested) || requested < 0 || requested > GRAIN_LIMIT - total) {
      throw new RangeError("example exceeds 20000-point grain budget");
    }
    counts[face] = requested;
    total += counts[face];
  }

  const grain = new Array(faces);
  for (let face = 0; face < faces; face += 1) {
    const indices = mesh.triangleAt(face);
    mesh.pointInto(indices[0], a);
    mesh.pointInto(indices[1], b);
    mesh.pointInto(indices[2], c);
    const faceSeed = (seed + face) >>> 0;
    grain[face] = seededTrianglePoints2D({
      seed: faceSeed, count: counts[face], triangle: [[a[0], a[1]], [b[0], b[1]], [c[0], c[1]]],
    });
  }
  return Object.freeze({ seed, fine, cells, mesh, grain, grainCount: total });
}
