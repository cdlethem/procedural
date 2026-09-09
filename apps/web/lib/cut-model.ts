import { gradientNoise2D01 } from "../../../packages/javascript/src/gradient-noise-2d-01.js";
import { retainedRectangleCuts2D } from "../../../packages/javascript/src/retained-rectangle-cuts.js";
import type { CutEdit, Layer } from "./studio-types";
export type { CutEdit } from "./studio-types";

export const MAX_CUT_EDITS = 64;

export type CutRegion = {
  id: number;
  bounds: [number, number, number, number];
};

function editsOf(layer: Layer): unknown {
  return layer.cutEdits;
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => typeof key === "string" && keys.includes(key)) &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function validId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validateEdit(value: unknown, index: number): asserts value is CutEdit {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`cutEdits[${index}] must be an object`);
  const edit = value as Record<string, unknown>;
  if (edit.kind === "cut") {
    if (!exactKeys(edit, ["kind", "id", "axis", "coordinate"]))
      throw new Error(`cutEdits[${index}] has invalid keys`);
    if (!validId(edit.id))
      throw new Error(
        `cutEdits[${index}].id must be a nonnegative safe integer`,
      );
    if (edit.axis !== "X" && edit.axis !== "Y")
      throw new Error(`cutEdits[${index}].axis must be X or Y`);
    if (
      typeof edit.coordinate !== "number" ||
      !Number.isFinite(edit.coordinate)
    )
      throw new Error(`cutEdits[${index}].coordinate must be finite`);
    return;
  }
  if (edit.kind === "remove") {
    if (!exactKeys(edit, ["kind", "id"]))
      throw new Error(`cutEdits[${index}] has invalid keys`);
    if (!validId(edit.id))
      throw new Error(
        `cutEdits[${index}].id must be a nonnegative safe integer`,
      );
    return;
  }
  throw new Error(`cutEdits[${index}].kind must be cut or remove`);
}

function validatedEdits(layer: Layer): CutEdit[] {
  const value = editsOf(layer);
  if (!Array.isArray(value)) throw new Error("cutEdits must be an array");
  if (value.length > MAX_CUT_EDITS)
    throw new Error(`cutEdits exceeds the ${MAX_CUT_EDITS} edit limit`);
  if (layer.technique !== "cut-marks" && value.length !== 0)
    throw new Error("cutEdits are only supported by cut-marks layers");
  for (let index = 0; index < value.length; index++)
    validateEdit(value[index], index);
  return value as CutEdit[];
}

/** Validate edit shape and replayability without publishing a partially replayed model. */
export function validateCutEdits(layer: Layer): void {
  validatedEdits(layer);
  if (layer.technique === "cut-marks") createCutModel(layer);
}

/**
 * Rebuild the authored seeded CutMarks layout, then replay persisted direct edits in
 * their recorded order. With no edits this preserves the original renderer geometry.
 */
export function createCutModel(layer: Layer) {
  if (layer.technique !== "cut-marks")
    throw new Error("CutMarks model requires a cut-marks layer");
  const edits = validatedEdits(layer);
  const q = layer.params as Record<string, unknown>;
  const model = retainedRectangleCuts2D({ bounds: [24, 24, 616, 616] });
  const field = gradientNoise2D01({ seed: layer.seed });
  const cuts = q.cuts as number;
  const spread = q.spread as number;
  const staggered = q.staggered as boolean;
  for (let i = 0; i < cuts; i++) {
    const leaf = model.leaves()[i % model.size];
    const b = leaf.bounds;
    const axis = i % 2 ? "Y" : "X";
    const ratio = 0.5 + (field.sample(i, 0) - 0.5) * 2 * spread;
    const coordinate =
      axis === "X"
        ? b[0] + (b[2] - b[0]) * ratio
        : b[1] + (b[3] - b[1]) * ratio;
    model.cut(leaf.id, axis, coordinate);
    if (staggered && i % 3 === 0) {
      const child = model.leaves()[model.size - 1];
      const d = child.bounds;
      model.cut(
        child.id,
        axis === "X" ? "Y" : "X",
        axis === "X"
          ? d[1] + (d[3] - d[1]) * (0.3 + 0.4 * field.sample(i, 1))
          : d[0] + (d[2] - d[0]) * (0.3 + 0.4 * field.sample(i, 1)),
      );
    }
  }
  for (const edit of edits) {
    if (edit.kind === "cut") model.cut(edit.id, edit.axis, edit.coordinate);
    else model.remove(edit.id);
  }
  return model;
}

/** Detached stable-id regions for the click interaction and the drawing adapter. */
export function cutRegions(layer: Layer): CutRegion[] {
  return createCutModel(layer)
    .leaves()
    .map((leaf: { id: number; bounds: number[] }) => ({
      id: leaf.id,
      bounds: [leaf.bounds[0], leaf.bounds[1], leaf.bounds[2], leaf.bounds[3]],
    }));
}
