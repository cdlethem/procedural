import type {
  Layer,
  Parameter,
  StudioDocument,
  Technique,
  TechniqueId,
} from "./studio-types";
import gallery from "./generated-gallery.json";

export const MAX_LAYERS = 8;

type Value = number | string | boolean;
type Definition = Technique & { defaults: Record<string, Value> };

const paletteOptions = [
  { value: "original", label: "Original" },
  { value: "neon", label: "Neon" },
];

const definitions: readonly Definition[] = [
  {
    id: "field-marks",
    title: "Field marks",
    description: "A sampled noise field drawn as short lines or bars.",
    parameters: [
      number("columns", "Columns", "Number of field columns.", 80, 16, 160, 1),
      number("rows", "Rows", "Number of field rows.", 80, 16, 160, 1),
      number("pitch", "Pitch", "Distance between field samples.", 8, 4, 16, 1),
      number(
        "maxLength",
        "Maximum length",
        "Longest mark in pixels.",
        14,
        1,
        32,
        1,
      ),
      select(
        "palette",
        "Palette",
        "Colour sequence for marks.",
        "original",
        paletteOptions,
      ),
      boolean("bars", "Bars", "Draw filled bars instead of line marks.", false),
    ],
    defaults: {
      columns: 80,
      rows: 80,
      pitch: 8,
      maxLength: 14,
      palette: "original",
      bars: false,
    },
  },
  {
    id: "path-marks",
    title: "Path marks",
    description: "Marks or traces sampled along seeded gradient paths.",
    parameters: [
      number("steps", "Steps", "Steps per retained path.", 600, 50, 2000, 1),
      number(
        "distance",
        "Step distance",
        "Distance travelled at each path step.",
        0.4,
        0.1,
        1,
        0.1,
      ),
      number(
        "markLength",
        "Mark length",
        "Length of each perpendicular mark.",
        12,
        1,
        32,
        1,
      ),
      boolean(
        "trace",
        "Trace",
        "Draw movement segments instead of endpoint marks.",
        false,
      ),
      select(
        "palette",
        "Palette",
        "Colour sequence for paths.",
        "original",
        paletteOptions,
      ),
    ],
    defaults: {
      steps: 600,
      distance: 0.4,
      markLength: 12,
      trace: false,
      palette: "original",
    },
  },
  {
    id: "placement-marks",
    title: "Placement marks",
    description: "Separated circles drawn as rings or diamonds.",
    parameters: [
      number(
        "attempts",
        "Proposals",
        "Seeded circle proposals to consider.",
        3000,
        100,
        5000,
        1,
      ),
      number(
        "minimum",
        "Minimum radius",
        "Smallest seeded circle radius.",
        4,
        2,
        32,
        1,
      ),
      number(
        "maximum",
        "Maximum radius",
        "Largest seeded circle radius.",
        48,
        4,
        64,
        1,
      ),
      number(
        "separation",
        "Separation",
        "Extra space between accepted circles.",
        1,
        0.5,
        2,
        0.1,
      ),
      boolean(
        "radial",
        "Radial source",
        "Use the authored radial proposal source.",
        false,
      ),
      boolean("diamonds", "Diamonds", "Draw four-cornered forms.", false),
      select(
        "palette",
        "Palette",
        "Colour sequence for forms.",
        "original",
        paletteOptions,
      ),
    ],
    defaults: {
      attempts: 3000,
      minimum: 4,
      maximum: 48,
      separation: 1,
      radial: false,
      diamonds: false,
      palette: "original",
    },
  },
  {
    id: "lattice-marks",
    title: "Lattice marks",
    description: "Ordered occupied paths across a square lattice.",
    parameters: [
      boolean("many", "Many paths", "Grow 36 paths instead of 12.", false),
      boolean(
        "longPaths",
        "Long paths",
        "Allow 36 cells per path instead of 12.",
        false,
      ),
      boolean(
        "dots",
        "Dots",
        "Draw cells as dots instead of connected paths.",
        false,
      ),
      boolean("wide", "Wide strokes", "Use a wider path stroke.", false),
      select(
        "palette",
        "Palette",
        "Colour sequence for paths.",
        "original",
        paletteOptions,
      ),
    ],
    defaults: {
      many: false,
      longPaths: false,
      dots: false,
      wide: false,
      palette: "original",
    },
  },
];

function number(
  key: string,
  label: string,
  description: string,
  _default: number,
  min: number,
  max: number,
  step: number,
): Parameter {
  return { key, label, description, type: "number", min, max, step };
}
function boolean(
  key: string,
  label: string,
  description: string,
  _default: boolean,
): Parameter {
  return { key, label, description, type: "boolean" };
}
function select(
  key: string,
  label: string,
  description: string,
  _default: string,
  options: { value: string; label: string }[],
): Parameter {
  return { key, label, description, type: "select", options };
}

export const techniques: Technique[] = definitions.map(
  ({ defaults: _defaults, ...technique }) => ({
    ...technique,
    parameters: technique.parameters.map((parameter) => ({
      ...parameter,
      options: parameter.options?.map((option) => ({ ...option })),
    })),
  }),
);

let nextLayer = 1;
const reservedLayerIds = new Set<string>();
function definition(id: TechniqueId): Definition {
  const found = definitions.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown studio technique: ${String(id)}`);
  return found;
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
    technique: id,
    visible: true,
    opacity: 1,
    seed: 42,
    params: { ...item.defaults },
  };
}

export function createDocument(
  id: TechniqueId = "field-marks",
): StudioDocument {
  return {
    schemaVersion: 1,
    bindingVersion: "studio-v1",
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
  const number = finite(value, path);
  if (!Number.isInteger(number)) throw new Error(`${path} must be an integer`);
  return number;
}

/** Strictly admits the data-only v1 studio envelope and returns a detached copy. */
export function validateDocument(input: unknown): StudioDocument {
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
  if (document.bindingVersion !== gallery.studioBinding.version)
    throw new Error(
      `Document bindingVersion must be ${gallery.studioBinding.version}`,
    );
  if (document.catalogSha256 !== gallery.studioBinding.catalogSha256)
    throw new Error("Document catalogSha256 is stale or unsupported");
  if (document.width !== 640 || document.height !== 640)
    throw new Error("Document canvas must be 640 by 640");
  if (
    typeof document.background !== "string" ||
    !/^#[0-9a-fA-F]{6}$/.test(document.background)
  )
    throw new Error(
      "Document background must be an opaque RGB colour such as #ece7da",
    );
  if (!Array.isArray(document.layers))
    throw new Error("Document layers must be an array");
  if (document.layers.length > MAX_LAYERS)
    throw new Error(`Document supports at most ${MAX_LAYERS} layers`);
  const ids = new Set<string>();
  const layers = document.layers.map((value, index): Layer => {
    const path = `Document layers[${index}]`;
    const layer = object(value, path);
    exact(
      layer,
      ["id", "technique", "visible", "opacity", "seed", "params"],
      path,
    );
    if (typeof layer.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(layer.id))
      throw new Error(
        `${path}.id must contain 1 to 64 letters, digits, _ or -`,
      );
    if (ids.has(layer.id)) throw new Error(`${path}.id must be unique`);
    ids.add(layer.id);
    if (
      typeof layer.technique !== "string" ||
      !definitions.some((item) => item.id === layer.technique)
    )
      throw new Error(`${path}.technique is not supported`);
    if (typeof layer.visible !== "boolean")
      throw new Error(`${path}.visible must be true or false`);
    const opacity = finite(layer.opacity, `${path}.opacity`);
    if (opacity < 0 || opacity > 1)
      throw new Error(`${path}.opacity must be between 0 and 1`);
    const seed = integer(layer.seed, `${path}.seed`);
    if (seed < 0 || seed > 0xffffffff)
      throw new Error(`${path}.seed must be a uint32`);
    const item = definition(layer.technique as TechniqueId);
    const params = object(layer.params, `${path}.params`);
    exact(params, Object.keys(item.defaults), `${path}.params`);
    const copied: Record<string, Value> = {};
    for (const parameter of item.parameters) {
      const value = params[parameter.key];
      const parameterPath = `${path}.params.${parameter.key}`;
      if (parameter.type === "boolean") {
        if (typeof value !== "boolean")
          throw new Error(`${parameterPath} must be true or false`);
      } else if (parameter.type === "select") {
        if (
          typeof value !== "string" ||
          !parameter.options?.some((option) => option.value === value)
        )
          throw new Error(`${parameterPath} is not an available option`);
      } else {
        const numeric = finite(value, parameterPath);
        if (numeric < parameter.min! || numeric > parameter.max!)
          throw new Error(
            `${parameterPath} must be between ${parameter.min} and ${parameter.max}`,
          );
        if (
          Math.abs(
            (numeric - parameter.min!) / parameter.step! -
              Math.round((numeric - parameter.min!) / parameter.step!),
          ) > 1e-9
        )
          throw new Error(`${parameterPath} must use step ${parameter.step}`);
      }
      copied[parameter.key] = value as Value;
    }
    if (
      item.id === "placement-marks" &&
      (copied.minimum as number) > (copied.maximum as number)
    )
      throw new Error(`${path}.params.minimum cannot exceed maximum`);
    return {
      id: layer.id,
      technique: item.id,
      visible: layer.visible,
      opacity,
      seed,
      params: copied,
    };
  });
  for (const id of ids) reservedLayerIds.add(id);
  return {
    schemaVersion: 1,
    bindingVersion: "studio-v1",
    catalogSha256: gallery.studioBinding.catalogSha256,
    width: 640,
    height: 640,
    background: document.background.toLowerCase(),
    layers,
  };
}
