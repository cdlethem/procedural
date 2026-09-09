import type {
  Layer,
  StudioDocument,
  Technique,
  TechniqueId,
} from "./studio-types";
import gallery from "./generated-gallery.json";
import legacy from "./legacy-v1.json";
import { basicDefinitions } from "./adapters/basic";
import { geometryDefinitions } from "./adapters/geometry";
import { effectsDefinitions } from "./adapters/effects";
import type { StudioDefinition } from "./adapters/types";

export const MAX_LAYERS = 8;
type Value = number | string | boolean;
const definitions: readonly StudioDefinition[] = [
  ...basicDefinitions,
  ...geometryDefinitions,
  ...effectsDefinitions,
];
const ORIGINAL = [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7];
const NEON = [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd];
const LATTICE_ORIGINAL = [0x173f5f, 0xaf5441, 0xe9c46a, 0x347969];
const LATTICE_NEON = [0x493657, 0xb85065, 0xe6b89c, 0x467c89];

export const techniques: Technique[] = definitions.map(
  ({
    defaults: _defaults,
    validate: _validate,
    renderer: _renderer,
    ...item
  }) => ({
    ...item,
    parameters: item.parameters.map((parameter) => ({
      ...parameter,
      options: parameter.options?.map((option) => ({ ...option })),
    })),
  }),
);
let nextLayer = 1;
const reservedLayerIds = new Set<string>();
export function definition(id: TechniqueId): StudioDefinition {
  const found = definitions.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown studio technique: ${String(id)}`);
  return found;
}
function paletteFor(id: string): number[] {
  return id === "lattice-marks" ? [...LATTICE_ORIGINAL] : [...ORIGINAL];
}
export function createLayer(id: TechniqueId): Layer {
  const item = definition(id);
  let layerId: string;
  do {
    layerId = `layer-${nextLayer++}`;
  } while (reservedLayerIds.has(layerId));
  reservedLayerIds.add(layerId);
  return {
    id: layerId,
    technique: item.id,
    visible: true,
    opacity: 1,
    seed: 42,
    palette: paletteFor(item.id),
    params: { ...item.defaults },
  };
}
export function createDocument(
  id: TechniqueId = "field-marks",
): StudioDocument {
  return {
    schemaVersion: 1,
    bindingVersion: "studio-v2",
    catalogSha256: gallery.studioBinding.catalogSha256,
    width: 640,
    height: 640,
    background: "#ece7da",
    layers: [createLayer(id)],
  };
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}
function exact(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void {
  for (const key of Object.keys(value))
    if (!keys.includes(key))
      throw new Error(`${path} has an unknown key: ${key}`);
  for (const key of keys)
    if (!(key in value)) throw new Error(`${path} is missing ${key}`);
}
function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${path} must be a finite number`);
  return value;
}
function integer(value: unknown, path: string): number {
  const result = finite(value, path);
  if (!Number.isInteger(result)) throw new Error(`${path} must be an integer`);
  return result;
}
function background(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value))
    throw new Error(`${path} must be an opaque RGB colour such as #ece7da`);
  return value.toLowerCase();
}
function checkedPalette(value: unknown, path: string): number[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 12)
    throw new Error(`${path} must contain 2 to 12 RGB colours`);
  return value.map((item, index) => {
    const rgb = integer(item, `${path}[${index}]`);
    if (rgb < 0 || rgb > 0xffffff)
      throw new Error(`${path}[${index}] must be an RGB integer`);
    return rgb;
  });
}
function parameters(
  value: unknown,
  item: StudioDefinition,
  path: string,
): Record<string, Value> {
  const source = object(value, path);
  exact(source, Object.keys(item.defaults), path);
  const copied: Record<string, Value> = {};
  for (const parameter of item.parameters) {
    const entry = source[parameter.key],
      parameterPath = `${path}.${parameter.key}`;
    if (parameter.type === "boolean") {
      if (typeof entry !== "boolean")
        throw new Error(`${parameterPath} must be true or false`);
    } else if (parameter.type === "select") {
      if (
        typeof entry !== "string" ||
        !parameter.options?.some((option) => option.value === entry)
      )
        throw new Error(`${parameterPath} is not an available option`);
    } else {
      const number = finite(entry, parameterPath);
      if (number < parameter.min! || number > parameter.max!)
        throw new Error(
          `${parameterPath} must be between ${parameter.min} and ${parameter.max}`,
        );
      if (
        Math.abs(
          (number - parameter.min!) / parameter.step! -
            Math.round((number - parameter.min!) / parameter.step!),
        ) > 1e-9
      )
        throw new Error(`${parameterPath} must use step ${parameter.step}`);
    }
    copied[parameter.key] = entry as Value;
  }
  item.validate?.(copied);
  return copied;
}
function validateEnvelope(
  input: unknown,
  version: string,
  digest: string,
  legacyMode: boolean,
): { background: string; layers: Record<string, unknown>[] } {
  const document = object(input, "Document");
  exact(
    document,
    [
      "schemaVersion",
      "bindingVersion",
      "catalogSha256",
      "width",
      "height",
      "background",
      "layers",
    ],
    "Document",
  );
  if (document.schemaVersion !== 1)
    throw new Error("Document schemaVersion must be 1");
  if (document.bindingVersion !== version)
    throw new Error(`Document bindingVersion must be ${version}`);
  if (document.catalogSha256 !== digest)
    throw new Error("Document catalogSha256 is stale or unsupported");
  if (document.width !== 640 || document.height !== 640)
    throw new Error("Document canvas must be 640 by 640");
  const ground = background(document.background, "Document background");
  if (!Array.isArray(document.layers))
    throw new Error("Document layers must be an array");
  if (document.layers.length > MAX_LAYERS)
    throw new Error(`Document supports at most ${MAX_LAYERS} layers`);
  const ids = new Set<string>();
  const layers = document.layers.map((entry, index) => {
    const path = `Document layers[${index}]`,
      layer = object(entry, path);
    exact(
      layer,
      legacyMode
        ? ["id", "technique", "visible", "opacity", "seed", "params"]
        : [
            "id",
            "technique",
            "visible",
            "opacity",
            "seed",
            "palette",
            "params",
          ],
      path,
    );
    if (typeof layer.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(layer.id))
      throw new Error(
        `${path}.id must contain 1 to 64 letters, digits, _ or -`,
      );
    if (ids.has(layer.id)) throw new Error(`${path}.id must be unique`);
    ids.add(layer.id);
    if (typeof layer.technique !== "string")
      throw new Error(`${path}.technique is not supported`);
    if (typeof layer.visible !== "boolean")
      throw new Error(`${path}.visible must be true or false`);
    const opacity = finite(layer.opacity, `${path}.opacity`);
    if (opacity < 0 || opacity > 1)
      throw new Error(`${path}.opacity must be between 0 and 1`);
    const seed = integer(layer.seed, `${path}.seed`);
    if (seed < 0 || seed > 0xffffffff)
      throw new Error(`${path}.seed must be a uint32`);
    return layer;
  });
  return { background: ground, layers };
}
function legacyDefinition(id: string): StudioDefinition {
  const found = (legacy.techniques as unknown as StudioDefinition[]).find(
    (item) => item.id === id,
  );
  if (!found) throw new Error("Document layers technique is not supported");
  return found;
}
function migrateV1(input: unknown): StudioDocument {
  const old = validateEnvelope(
    input,
    legacy.bindingVersion,
    legacy.catalogSha256,
    true,
  );
  const ids = new Set<string>();
  const layers = old.layers.map((layer, index): Layer => {
    const path = `Document layers[${index}]`,
      id = layer.id as string,
      technique = layer.technique as string,
      oldDefinition = legacyDefinition(technique),
      oldParams = parameters(layer.params, oldDefinition, `${path}.params`),
      paletteName = oldParams.palette;
    if (paletteName !== "original" && paletteName !== "neon")
      throw new Error(`${path}.params.palette is not an available option`);
    const item = definition(technique),
      params: Record<string, Value> = { ...oldParams };
    delete params.palette;
    if (technique === "lattice-marks") {
      const source = oldParams as Record<string, Value>;
      Object.assign(params, {
        count: source.many ? 36 : 12,
        steps: source.longPaths ? 36 : 12,
        weight: source.wide ? 15.6 : 8.4,
        dotSize: 6,
        dots: source.dots,
        grid: true,
      });
      delete params.many;
      delete params.longPaths;
      delete params.wide;
    }
    const checked = parameters(params, item, `${path}.params`);
    ids.add(id);
    return {
      id,
      technique: item.id,
      visible: layer.visible as boolean,
      opacity: layer.opacity as number,
      seed: layer.seed as number,
      palette:
        technique === "lattice-marks"
          ? paletteName === "neon"
            ? [...LATTICE_NEON]
            : [...LATTICE_ORIGINAL]
          : paletteName === "neon"
            ? [...NEON]
            : [...ORIGINAL],
      params: checked,
    };
  });
  for (const id of ids) reservedLayerIds.add(id);
  return {
    schemaVersion: 1,
    bindingVersion: "studio-v2",
    catalogSha256: gallery.studioBinding.catalogSha256,
    width: 640,
    height: 640,
    background: old.background,
    layers,
  };
}
/** Strictly admits v2 documents and migrates only the frozen exact v1 binding. */
export function validateDocument(input: unknown): StudioDocument {
  const probe = object(input, "Document");
  if (probe.bindingVersion === legacy.bindingVersion) return migrateV1(input);
  const current = validateEnvelope(
    input,
    "studio-v2",
    gallery.studioBinding.catalogSha256,
    false,
  );
  const ids = new Set<string>();
  const layers = current.layers.map((layer, index): Layer => {
    const path = `Document layers[${index}]`,
      item = definition(layer.technique as string),
      checked = parameters(layer.params, item, `${path}.params`),
      id = layer.id as string;
    ids.add(id);
    return {
      id,
      technique: item.id,
      visible: layer.visible as boolean,
      opacity: layer.opacity as number,
      seed: layer.seed as number,
      palette: checkedPalette(layer.palette, `${path}.palette`),
      params: checked,
    };
  });
  for (const id of ids) reservedLayerIds.add(id);
  return {
    schemaVersion: 1,
    bindingVersion: "studio-v2",
    catalogSha256: gallery.studioBinding.catalogSha256,
    width: 640,
    height: 640,
    background: current.background,
    layers,
  };
}
