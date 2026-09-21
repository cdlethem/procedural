import { cyclicPalette } from "../../src/cyclic-palette.js";
/**
 * Example-only java.util.Random emulation (nextDouble + the bound-based
 * nextInt, including its overflow-rejection loop), matching CityComposition's
 * authored building-policy source. This does not expose or alter the
 * library's private xoshiro sampling stream. Verified bit-exact against real
 * java.util.Random before this module was written: 20 nextDouble() and 20
 * nextInt(7) values from seed 42, an interleaved call sequence matching this
 * module's own usage, and a 700,000-draw nextInt(7) distribution from a
 * second seed (exercising the rejection path).
 */
declare class JavaRandom {
    #private;
    constructor(seed: any);
    nextDouble(): number;
    nextInt(bound: any): number;
}
/**
 * Retained editable policies for the ciscis002 city composition. Partitioning
 * (layout.seeded-quadrant-partition-2d), triangulation (topology.delaunay-2d),
 * and window coordinates (layout.regular-grid) remain library operations;
 * this module owns only the per-face policy derivation (height, palette
 * phase, ground visibility/tone, window counts/lit state, wall proportions),
 * matching CityComposition.java's authored java.util.Random-driven building
 * policy exactly (not the library's xoshiro stream). Independently composed
 * from survey/out/2019/generativos/ciscis002/notes.md; the seed, partition
 * settings, and policy formulas here are authored piece settings. See
 * catalog/validation/seeded-quadrant-partition-2d.json and
 * catalog/validation/delaunay-2d.json.
 */
declare class CityComposition {
    #private;
    constructor(mesh: any, leafCount: any, heights: any, phases: any, groundVisible: any, groundGrays: any, verticalCounts: any, horizontalCounts: any, windowGrids: any, wallWidths: any, wallHeights: any, wallOffsets: any, litWindows: any);
    static create(seed: any): CityComposition;
    get mesh(): any;
    get leafCount(): any;
    get windowCount(): any;
    heightUnit(face: any): any;
    palettePhase(face: any): any;
    groundVisible(face: any): any;
    groundGray(face: any): any;
    verticalCount(face: any): any;
    horizontalCount(face: any): any;
    wallWidthFraction(face: any, wall: any): any;
    wallHeightFraction(face: any, wall: any): any;
    windowLit(face: any, wall: any, index: any): any;
    windowGrid(face: any): any;
}
export declare function createCityComposition(seed: any): CityComposition;
export { JavaRandom, cyclicPalette };
