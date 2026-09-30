import { roadRings, validateRoadGrowth } from "./road-growth.js";
import type { DeadEndPolicy, ReserveShape, RoadGrowthParams, RoadJunction } from "./road-growth.js";
import type { RoadFieldKind } from "./road-field.js";

type Scalar = number | string | boolean;

/**
 * The construction parameters of the Roads and Parcels instrument: exactly the controls that change what
 * the growth computes. A control that a selection hides is replaced by a constant, so two settings that
 * differ only in hidden controls share one cached network (and, by the same rule, draw identically).
 * Placement (centre, rotation), hierarchy, widths, lots and every appearance control are not here.
 */
export function roadGrowthParams(q: Record<string, Scalar>): RoadGrowthParams {
  const field = q.field as RoadFieldKind;
  const zone = q.reserve !== "none";
  const anchored = (q.anchors as number) > 0;
  return {
    field, gridAngle: field === "grid" ? q.gridAngle as number : 0, spin: field === "spiral" ? q.spin as number : 0,
    warp: field === "organic" ? 0 : q.warp as number, fieldScale: q.fieldScale as number,
    blockSize: q.blockSize as number, width: q.width as number, height: q.height as number,
    focusX: q.focusX as number, focusY: q.focusY as number, focusScale: q.focusScale as number, focusReach: q.focusReach as number,
    anchors: q.anchors as number, anchorSpread: anchored ? q.anchorSpread as number : 0, anchorAngle: anchored ? q.anchorAngle as number : 0,
    wobble: q.wobble as number, junction: q.junction as RoadJunction, snap: q.snap as number, minAngle: q.minAngle as number,
    deadEnds: q.deadEnds as DeadEndPolicy, frame: q.boundaryRoad as boolean,
    hubRadius: field === "radial" || field === "spiral" ? q.hubRadius as number : 0,
    reserve: q.reserve as ReserveShape, reserveX: zone ? q.reserveX as number : 0, reserveY: zone ? q.reserveY as number : 0,
    reserveWidth: zone ? q.reserveWidth as number : 0, reserveHeight: zone ? q.reserveHeight as number : 0, reserveAngle: zone ? q.reserveAngle as number : 0,
  };
}

/** Admission check: throws an Error naming the control when the growth or the rings cannot be built. */
export function validateRoadsParcels(q: Record<string, Scalar>): void {
  const growth = roadGrowthParams(q);
  validateRoadGrowth(growth);
  roadRings(growth, 0);
  const lots = Number(q.width) * Number(q.height) / (Number(q.lotWidth) * Number(q.lotDepth));
  if (lots > 24_000)
    throw new Error(`Lot width: a site this size with lots this small would need about ${Math.ceil(lots)} lots; raise Lot width or Lot depth, or reduce Width and Height`);
}

/** Whether a new seed can change what these controls draw. */
export function roadsParcelsUsesSeed(q: Record<string, Scalar>): boolean {
  if (Number(q.steps) > 0) return true;
  return Number(q.lotVariety) > 0 || q.typeBy === "random" || (Number(q.unbuiltShare) > 0 && q.unbuiltRule === "random");
}
