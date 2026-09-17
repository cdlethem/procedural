import { captureRegion, compareRegions, integer, plainRecord, regionWork, validateRegion } from "./internal/region-utils.js";

/** Stable error for geometry.region-clearance-2d. */
export class RegionClearance2DError extends Error {
  constructor(code) { super(code); this.name = "RegionClearance2DError"; this.code = code; }
}

/**
 * Classify two strict Region2D values.  Boundary IDs deliberately refer to supplied
 * ring order; this query never normalizes an input ring just to make an answer pretty.
 */
export function regionClearance2D(configuration) {
  const input = plainRecord(configuration, ["a", "b", "maxWork"], RegionClearance2DError);
  const maxWork = integer(input.maxWork, RegionClearance2DError);
  let a, b;
  try { a = captureRegion(input.a, RegionClearance2DError); b = captureRegion(input.b, RegionClearance2DError); }
  catch (error) { if (error instanceof RegionClearance2DError) throw error; throw new RegionClearance2DError(error.message); }
  if (regionWork(a, b) > BigInt(maxWork)) throw new RegionClearance2DError("WORK_LIMIT");
  try { validateRegion(a, RegionClearance2DError); validateRegion(b, RegionClearance2DError); } catch (error) { if (error instanceof RegionClearance2DError) throw error; throw new RegionClearance2DError(error.message); }
  try { return compareRegions(a, b); }
  catch (error) { if (error?.message === "NUMERIC_OVERFLOW") throw new RegionClearance2DError("NUMERIC_OVERFLOW"); throw error; }
}
