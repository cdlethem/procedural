import type { ErosionParams } from "./drainage-erosion.js";
import type { BedrockKind, RainMode, TerrainShape } from "./terrain.js";
import type { OutletMode } from "./drainage-flow.js";

/**
 * How the stored controls of Drainage and Erosion become a construction and a view. Shared by the
 * instrument definition (validation) and the composition (drawing), and free of both.
 *
 * CONSTRUCTION (`ErosionParams` with `steps`) is what the simulation computes: terrain, water, bedrock and erosion
 * settings and the grid. It is the cache key of the retained run. Controls that are hidden by another choice are
 * normalised to fixed values here (a uniform rain has no variation, a shape of pure noise has no roughness, ...), so
 * changing a hidden control neither recomputes the simulation nor changes the drawing.
 *
 * FOOTPRINT. `cell = max(width, height) / resolution` canvas units; the grid is `round(width / cell)` by
 * `round(height / cell)` cells (at least 4 each) and the footprint is exactly `columns × cell` by `rows × cell`,
 * centred on `(centerX, centerY)`: the longer side is the requested length, the shorter is snapped to whole cells. Cells
 * are square. Width, height and centre never enter the construction except through `columns` and `rows`, so
 * scaling the footprint at a fixed aspect redraws the same simulation.
 */
export type Values = Readonly<Record<string, number | string | boolean>>;

export interface Footprint { columns: number; rows: number; cell: number; left: number; top: number }
export function footprintFor(q: Values): Footprint {
  const width = Number(q.width), height = Number(q.height), resolution = Number(q.resolution);
  const cell = Math.max(width, height) / resolution;
  const columns = Math.max(4, Math.round(width / cell)), rows = Math.max(4, Math.round(height / cell));
  return { columns, rows, cell, left: Number(q.centerX) - columns * cell / 2, top: Number(q.centerY) - rows * cell / 2 };
}

export function erosionParamsFor(q: Values): ErosionParams {
  const { columns, rows } = footprintFor(q);
  const shape = q.shape as TerrainShape, rainMode = q.rainMode as RainMode, bedrock = q.bedrock as BedrockKind;
  return {
    columns, rows, shape, relief: Number(q.relief), roughness: shape === "noise" ? 1 : Number(q.roughness),
    frequency: Number(q.frequency), octaves: Number(q.octaves), outlets: q.outlets as OutletMode,
    rainMode, rainVariation: rainMode === "uniform" ? 0 : Number(q.rainVariation), rainAngle: rainMode === "gradient" ? Number(q.rainAngle) : 0,
    storms: rainMode === "storms" ? Number(q.storms) : 1,
    bedrock, bedrockContrast: bedrock === "uniform" ? 0 : Number(q.bedrockContrast), bedrockScale: bedrock === "uniform" ? 1 : Number(q.bedrockScale),
    bedrockAngle: bedrock === "layers" ? Number(q.bedrockAngle) : 0,
    erodibility: Number(q.erodibility), areaExponent: Number(q.areaExponent), slopeExponent: Number(q.slopeExponent),
    deposition: Number(q.deposition), carrying: Number(q.deposition) === 0 ? 1 : Number(q.carrying), uplift: Number(q.uplift), creep: Number(q.creep),
  };
}

export type StreamStyle = "none" | "ribbon" | "ink" | "stitch" | "beads";
export type BasinStyle = "none" | "wash" | "hatch" | "divides" | "wash-divides";
export type MarkSet = "none" | "sources" | "confluences" | "both";
export type MarkKind = "dot" | "rings" | "arrow";

/** Everything that selects or styles what the simulation computed. None of it reaches the retained run. */
export interface DrainageView {
  contours: boolean; contourInterval: number; indexEvery: number; contourWeight: number; ghost: boolean;
  shading: boolean; azimuth: number; elevation: number; shadeDepth: number;
  streams: StreamStyle; streamThreshold: number; streamSmooth: number; streamWidth: number; streamWeight: number; streamSpacing: number;
  basins: BasinStyle; basinDepth: number; washAlpha: number; hatchSpacing: number; dividesWeight: number;
  lakes: boolean; lakeDepth: number;
  marks: MarkSet; markKind: MarkKind; markSize: number;
}

export function viewFor(q: Values): DrainageView {
  return {
    contours: q.contours === true, contourInterval: Number(q.contourInterval), indexEvery: Number(q.indexEvery), contourWeight: Number(q.contourWeight), ghost: q.ghost === true,
    shading: q.shading === true, azimuth: Number(q.azimuth), elevation: Number(q.elevation), shadeDepth: Number(q.shadeDepth),
    streams: q.streams as StreamStyle, streamThreshold: Number(q.streamThreshold) / 100, streamSmooth: Number(q.streamSmooth),
    streamWidth: Number(q.streamWidth), streamWeight: Number(q.streamWeight), streamSpacing: Number(q.streamSpacing),
    basins: q.basins as BasinStyle, basinDepth: Number(q.basinDepth), washAlpha: Number(q.washAlpha), hatchSpacing: Number(q.hatchSpacing), dividesWeight: Number(q.dividesWeight),
    lakes: q.lakes === true, lakeDepth: Number(q.lakeDepth),
    marks: q.marks as MarkSet, markKind: q.markKind as MarkKind, markSize: Number(q.markSize),
  };
}

/** Whether the seed can change this construction (terrain noise, storms or bedrock draw from it). */
export function drainageUsesSeed(q: Values): boolean {
  return q.shape === "noise" || Number(q.roughness) > 0 || q.rainMode === "storms" || q.bedrock !== "uniform";
}
