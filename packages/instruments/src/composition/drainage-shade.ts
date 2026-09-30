import { cachedBy } from "./core.js";
import { IsoField, fillableRings } from "./iso-rings.js";
import { MAX_PATCH_VERTICES, PATCH_ALPHA, SHADE_LEVELS, shadeSlope, type Light, type ShadeBand, type ShadedPatch } from "./relief.js";
import { maskDomain } from "./domains-raster.js";
import type { PlanarDomain } from "./domains.js";
import type { GridFrame } from "./drainage-network.js";
import type { Point } from "./types.js";

/**
 * Treatments of a terrain that read only its height (and depression depth): hillshade polygon bands, lake
 * regions and adjacency colouring of basins. Each is a frozen value cached on the height array of the snapshot
 * (an edit of the light, or of a lake depth, recomputes only that value).
 *
 * HILLSHADE. Slopes are central differences of the height in domain units (`(z[i+1] - z[i-1]) / (2 h)`, one-sided
 * at the grid border) so a slope is dimensionless and independent of the resolution; `y` grows down the canvas as
 * in `relief.ts`. The signed shading of a cell is the existing Blinn-Phong `shadeSlope(sx, sy, light, {contrast:
 * depth, gloss: 0, shininess: 1})`: zero on flat ground, positive on slopes facing the light, negative on those
 * facing away. `|shading|` is cut into `SHADE_LEVELS` nested regions per side by the same linear-time level-set
 * rings (`IsoField`) and hole merging (`fillableRings`) that Stroke Relief uses, and returned as its `ShadedPatch`,
 * so its consumer paints it. Nested bands compound to `level / SHADE_LEVELS × PATCH_ALPHA`. The patch covers
 * the grid to half a cell beyond its outermost cell centres, i.e. the footprint. Failure: more than
 * `MAX_PATCH_VERTICES` polygon vertices throws, naming the resolution and the shading depth.
 *
 * LAKES. The regions where a depression holds at least `minDepth` of water (a share of the largest
 * height): the contour of `depth / maxHeight` at that level, as planar regions with holes on the cell-centre grid
 * (`maskDomain` "contour" mode: linear crossings between cell centres, closed beyond the grid border).
 *
 * BASIN COLOURS. A greedy colouring in label order with `colors` colours in which two basins that share a cell
 * edge differ whenever a free colour exists (four colours suffice for most drainage maps; more basins than
 * colours around one basin fall back to the least used neighbour colour).
 */
const patchCache = new WeakMap<object, Map<string, ShadedPatch>>();

/** Hillshade of a height grid (see the header). */
export function hillshadePatch(height: Float64Array, columns: number, rows: number, frame: GridFrame, light: Light, depth: number, spacing: number): ShadedPatch {
  if (!Number.isFinite(depth) || depth < 0 || depth > 50) throw new Error(`Shading depth must be from 0 to 50 (got ${String(depth)})`);
  const key = JSON.stringify([columns, rows, frame.left, frame.top, frame.cell, light.azimuth, light.elevation, depth, spacing]);
  return cachedBy(patchCache, height, key, () => {
    const material = { contrast: depth, gloss: 0, shininess: 1 }, shadow = new Float64Array(columns * rows), lit = new Float64Array(columns * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
      const c = j * columns + i, i0 = Math.max(0, i - 1), i1 = Math.min(columns - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(rows - 1, j + 1);
      const sx = (height[j * columns + i1] - height[j * columns + i0]) / ((i1 - i0) * spacing);
      const sy = (height[j1 * columns + i] - height[j0 * columns + i]) / ((j1 - j0) * spacing);
      const s = shadeSlope(sx, sy, light, material);
      if (s < 0) shadow[c] = -s; else lit[c] = s;
    }
    const bands: ShadeBand[] = [];
    let polygonCount = 0, vertexCount = 0;
    for (const [side, values] of [["shadow", shadow], ["light", lit]] as const) {
      const field = new IsoField({ values, columns, rows, x0: frame.left + frame.cell / 2, y0: frame.top + frame.cell / 2, dx: frame.cell, dy: frame.cell, outside: 0 });
      let previous = 0;
      for (let level = 1; level <= SHADE_LEVELS; level++) {
        let rings: Point[][];
        try { rings = field.rings((level - 0.5) / SHADE_LEVELS, MAX_PATCH_VERTICES - vertexCount); }
        catch { throw new Error(`Shading would draw more than ${MAX_PATCH_VERTICES} polygon vertices; lower the resolution or the shading depth`); }
        if (rings.length === 0) break;
        const total = level / SHADE_LEVELS * PATCH_ALPHA;
        const polygons = fillableRings(rings).map((ring) => Object.freeze(ring.flatMap(([x, y]) => [x, y])));
        for (const polygon of polygons) vertexCount += polygon.length / 2;
        polygonCount += polygons.length;
        if (vertexCount > MAX_PATCH_VERTICES) throw new Error(`Shading would draw more than ${MAX_PATCH_VERTICES} polygon vertices; lower the resolution or the shading depth`);
        bands.push(Object.freeze({ side, level, alpha: 1 - (1 - total) / (1 - previous), total, polygons: Object.freeze(polygons) }));
        previous = total;
      }
    }
    return Object.freeze({ grid: Object.freeze({ left: frame.left, top: frame.top, cell: frame.cell, columns, rows }), light: Object.freeze({ ...light }),
      material: Object.freeze(material), bands: Object.freeze(bands), polygonCount, vertexCount });
  });
}

const lakeCache = new WeakMap<object, Map<string, PlanarDomain>>();
/** Lake regions: where a depression holds at least `minDepth × max(height)` of water. `depth` is `filled - height` per cell. */
export function lakeDomain(owner: Float64Array, depth: Float64Array, columns: number, rows: number, maxHeight: number, minDepth: number, frame: GridFrame): PlanarDomain {
  if (!Number.isFinite(minDepth) || minDepth <= 0 || minDepth > 1) throw new Error(`Lake depth must be a share in (0, 1] of the largest height (got ${String(minDepth)})`);
  return cachedBy(lakeCache, owner, JSON.stringify([columns, rows, frame.left, frame.top, frame.cell, minDepth]), () => {
    const scale = maxHeight > 0 ? 1 / maxHeight : 0, data = new Float64Array(depth.length);
    for (let c = 0; c < depth.length; c++) data[c] = depth[c] * scale;
    return maskDomain({ width: columns, height: rows, data }, { threshold: minDepth, mode: "contour", cell: frame.cell, origin: [frame.left, frame.top], id: "lakes" });
  });
}

/** Colour index of every basin label 1..`count`, entry `label - 1` (see the header). */
export function basinColors(labels: Int32Array, columns: number, rows: number, count: number, colors: number): Int32Array {
  const neighbours: Set<number>[] = Array.from({ length: count }, () => new Set<number>());
  const link = (a: number, b: number) => { if (a > 0 && b > 0 && a !== b) { neighbours[a - 1].add(b - 1); neighbours[b - 1].add(a - 1); } };
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const c = j * columns + i;
    if (i + 1 < columns) link(labels[c], labels[c + 1]);
    if (j + 1 < rows) link(labels[c], labels[c + columns]);
  }
  const result = new Int32Array(count).fill(-1), used = new Int32Array(colors);
  for (let b = 0; b < count; b++) {
    const taken = new Set<number>();
    for (const other of [...neighbours[b]].sort((x, y) => x - y)) if (result[other] >= 0) taken.add(result[other]);
    let pick = -1;
    for (let k = 0; k < colors; k++) if (!taken.has(k) && (pick < 0 || used[k] < used[pick])) pick = k;
    if (pick < 0) {
      const counts = new Int32Array(colors);
      for (const other of neighbours[b]) if (result[other] >= 0) counts[result[other]]++;
      pick = 0;
      for (let k = 1; k < colors; k++) if (counts[k] < counts[pick]) pick = k;
    }
    result[b] = pick; used[pick]++;
  }
  return result;
}
