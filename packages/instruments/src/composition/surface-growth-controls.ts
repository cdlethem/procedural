/**
 * The construction half of the Surface Growth instrument: which scalar controls decide what the model computes.
 * Kept apart from the drawing so that the definition (`adapters/surface-growth-instrument.ts`) can validate
 * against the same bounds the drawing uses, and so that the split between construction and appearance is one
 * reviewable list. Nothing here reads the camera, the palette or any treatment control.
 *
 * Controls that reach the construction (and so recompute a growth run when edited): `surface`, `resolution`,
 * `perturb`, `field`, `fieldWidth`, `fieldRadius`, `fieldX`, `fieldY`, `stripeCount`, `stripeAngle`, `stripeSharp`,
 * `noiseScale`, `noiseContrast`, `baseline`, `spot`, `spotX`, `spotY`, `spotWidth`, `rate`, `limit`, `steps`,
 * `bending`, `pin`, `sweeps`, `thickness`, `refine`, `edgeLimit`, `maxVertices` and the seed. Controls a choice
 * makes irrelevant are normalized here, so a hidden control never changes the drawing: the field's own numbers
 * are read only for its kind, `pin` is ignored on a closed surface, and the refinement numbers are ignored when
 * refinement is off.
 */
import { growthField, type GrowthFieldSpec, type GrowthRegion } from "./growth-field.js";
import { GROWTH_SEED_KINDS, bundledGrowthSeed, type GrowthSeedKind } from "./growth-seeds.js";
import { checkGrowth, type GrowthControls, type GrowthPin } from "./surface-growth.js";

type Scalar = number | string | boolean;
export type GrowthFieldKind = "edge" | "radial" | "stripes" | "noise" | "uniform";
export const GROWTH_FIELD_KINDS: readonly GrowthFieldKind[] = Object.freeze(["edge", "radial", "stripes", "noise", "uniform"]);

export interface SurfaceGrowthConstruction {
  readonly surface: { readonly kind: GrowthSeedKind; readonly resolution: number };
  readonly field: GrowthFieldSpec;
  readonly growth: GrowthControls;
  readonly steps: number;
}

const num = (q: Record<string, Scalar>, key: string): number => q[key] as number;

/** Resolve stored scalar controls into the construction (see the header for what is normalized). */
export function growthConstruction(q: Record<string, Scalar>): SurfaceGrowthConstruction {
  const kind = q.surface as GrowthSeedKind, resolution = num(q, "resolution");
  if (!GROWTH_SEED_KINDS.includes(kind)) throw new Error(`Seed surface must be one of ${GROWTH_SEED_KINDS.join(", ")} (got ${String(kind)})`);
  const seed = bundledGrowthSeed(kind, resolution);
  const field = q.field as GrowthFieldKind;
  if (!GROWTH_FIELD_KINDS.includes(field)) throw new Error(`Growth field must be one of ${GROWTH_FIELD_KINDS.join(", ")} (got ${String(field)})`);
  if (field === "edge" && seed.closed) throw new Error("Growth field \"edge\" needs an open seed surface (the sphere has no edge); choose another field or a sheet, disc or strip");
  let primary: GrowthRegion;
  switch (field) {
    case "edge": primary = { kind: "edge", width: num(q, "fieldWidth") }; break;
    case "radial": primary = { kind: "radial", centerX: num(q, "fieldX"), centerY: num(q, "fieldY"), radius: num(q, "fieldRadius"), width: num(q, "fieldWidth") }; break;
    case "stripes": primary = { kind: "stripes", count: num(q, "stripeCount"), angle: num(q, "stripeAngle"), sharpness: num(q, "stripeSharp") }; break;
    case "noise": primary = { kind: "noise", scale: num(q, "noiseScale"), contrast: num(q, "noiseContrast") }; break;
    default: primary = { kind: "uniform" };
  }
  const regions: GrowthRegion[] = [primary];
  if (q.spot === true) regions.push({ kind: "radial", centerX: num(q, "spotX"), centerY: num(q, "spotY"), radius: 0, width: num(q, "spotWidth") });
  const refine = q.refine === true;
  return {
    surface: { kind, resolution },
    field: { regions, combine: "max", baseline: num(q, "baseline") },
    growth: {
      rate: num(q, "rate"), limit: num(q, "limit"), bending: num(q, "bending"), sweeps: num(q, "sweeps"),
      pin: (seed.closed ? "none" : q.pin) as GrowthPin, perturb: num(q, "perturb"), refine,
      edgeLimit: refine ? num(q, "edgeLimit") : 1.6, maxVertices: refine ? num(q, "maxVertices") : seed.mesh.vertexCount,
      thickness: num(q, "thickness"),
    },
    steps: num(q, "steps"),
  };
}

/** The definition's `validate`: the construction's own bounds, before anything runs. */
export function checkSurfaceGrowthControls(q: Record<string, Scalar>): void {
  const built = growthConstruction(q);
  const seed = bundledGrowthSeed(built.surface.kind, built.surface.resolution);
  if (built.growth.refine && built.growth.maxVertices < seed.mesh.vertexCount)
    throw new Error(`Vertex limit ${built.growth.maxVertices} is below the ${seed.mesh.vertexCount} vertices of the seed surface; raise Vertex limit or lower Resolution`);
  growthField(built.field, seed, 0);
  checkGrowth(seed, built.growth, built.steps);
}
