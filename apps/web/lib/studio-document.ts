/**
 * harness-v1 envelope: the ordered layer stack may hold immutable artifact layers beside
 * the existing app workflow layers. Pure and isomorphic; no Node or p5 imports. Control
 * declarations live in the artifact manifest, so only structural control shape is checked
 * here. `validateStudioDocument` accepts an app document of any admitted binding and
 * migrates it; the app binding version is read from the app registry, never hardcoded, so
 * this envelope keeps working while that binding evolves.
 */
import { createDocument, definition, MAX_LAYERS, validateDocument } from "./studio";
import type { Layer } from "./studio-types";

export const STUDIO_BINDING = "harness-v1";
export const P5_RUNNER_PROFILE = "p5-static-640-v1";
export const JAVA_RUNNER_PROFILE = "java2d-static-640-v1";
export const MAX_CONTROLS = 24;
export const MAX_TICK = 600;
export type ControlValue = number | string | boolean;
export type SourceLanguage = "p5js" | "processing-java";
export type WorkflowContent = {
  technique: string;
  seed: number;
  palette: number[];
  cutEdits: Layer["cutEdits"];
  transform: Layer["transform"];
  params: Record<string, ControlValue>;
};
export type SourceContent = {
  language: SourceLanguage;
  sourceArtifactHash: string;
  /** Null until a successful render job publishes the layer's preview raster. */
  previewArtifactHash: string | null;
  runnerProfile: string;
  entrypoint: string;
  /** Explicit surface declaration: transparent layers composite, opaque layers must fill. */
  background: "transparent" | "opaque";
  randomSeed: number;
  noiseSeed: number;
  tick: number;
  controls: Record<string, ControlValue>;
};
export type RecipeContent = {
  recipeArtifactHash: string;
  executorProfile: string;
};
export type DocumentLayer =
  | { id: string; kind: "workflow"; visible: boolean; opacity: number; content: WorkflowContent }
  | { id: string; kind: "source"; visible: boolean; opacity: number; content: SourceContent }
  | { id: string; kind: "recipe"; visible: boolean; opacity: number; content: RecipeContent };
export type StudioDocumentV3 = {
  schemaVersion: 2;
  bindingVersion: typeof STUDIO_BINDING;
  catalogSha256: string;
  width: 640;
  height: 640;
  background: string;
  layers: DocumentLayer[];
};
export type CandidateScope = "add-layer" | "edit-layer" | "composition";

const CONTROL_KEY = /^[a-z][A-Za-z0-9]{0,31}$/;
const LAYER_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const HASH = /^[0-9a-f]{64}$/;
const ENTRYPOINT = /^[A-Za-z][A-Za-z0-9_]{0,63}\.(js|pde)$/;
const SAFE_TEXT = /^[\x20-\x7e]{1,64}$/;

/** The app registry owns its own binding identity; the harness envelope quotes it. */
export const catalogDigest = (): string => createDocument().catalogSha256;

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} must be an object`);
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: readonly string[], path: string): void {
  for (const key of Object.keys(value))
    if (!keys.includes(key)) throw new Error(`${path} has an unknown key: ${key}`);
  for (const key of keys) if (!(key in value)) throw new Error(`${path} is missing ${key}`);
}
function finite(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${path} must be a finite number`);
  return value;
}
function uint32(value: unknown, path: string): number {
  const result = finite(value, path);
  if (!Number.isInteger(result) || result < 0 || result > 0xffffffff)
    throw new Error(`${path} must be a uint32`);
  return result;
}
function hash(value: unknown, path: string): string {
  if (typeof value !== "string" || !HASH.test(value))
    throw new Error(`${path} must be a sha256 content hash`);
  return value;
}
function controls(value: unknown, path: string): Record<string, ControlValue> {
  const source = object(value, path),
    keys = Object.keys(source);
  if (keys.length > MAX_CONTROLS)
    throw new Error(`${path} supports at most ${MAX_CONTROLS} controls`);
  const copied: Record<string, ControlValue> = {};
  for (const key of keys.sort()) {
    if (!CONTROL_KEY.test(key)) throw new Error(`${path} has an unusable control name: ${key}`);
    const entry = source[key];
    if (typeof entry === "number") finite(entry, `${path}.${key}`);
    else if (typeof entry === "string") {
      if (!SAFE_TEXT.test(entry))
        throw new Error(`${path}.${key} must be printable ASCII of 1 to 64 characters`);
    } else if (typeof entry !== "boolean")
      throw new Error(`${path}.${key} must be a number, string or boolean`);
    copied[key] = entry as ControlValue;
  }
  return copied;
}
/** Reuses the app registry's own parameter/palette admission for workflow content. */
function workflowContent(value: unknown, path: string): WorkflowContent {
  const source = object(value, path);
  exact(source, ["technique", "seed", "palette", "cutEdits", "transform", "params"], path);
  if (typeof source.technique !== "string")
    throw new Error(`${path}.technique is not supported`);
  const template = createDocument(source.technique);
  const probe = validateDocument({
    ...template,
    layers: [
      {
        ...template.layers[0],
        id: "probe",
        technique: source.technique,
        visible: true,
        opacity: 1,
        seed: source.seed,
        palette: source.palette,
        params: source.params,
        cutEdits: source.cutEdits,
        transform: source.transform,
      },
    ],
  });
  const checked = probe.layers[0];
  return {
    technique: checked.technique,
    seed: checked.seed,
    palette: checked.palette,
    cutEdits: checked.cutEdits.map((edit) => ({ ...edit })),
    transform: { ...checked.transform },
    params: checked.params,
  };
}
function sourceContent(value: unknown, path: string): SourceContent {
  const source = object(value, path);
  exact(
    source,
    [
      "language",
      "sourceArtifactHash",
      "previewArtifactHash",
      "runnerProfile",
      "entrypoint",
      "background",
      "randomSeed",
      "noiseSeed",
      "tick",
      "controls",
    ],
    path,
  );
  const language = source.language;
  if (language !== "p5js" && language !== "processing-java")
    throw new Error(`${path}.language must be p5js or processing-java`);
  const expectedProfile = language === "p5js" ? P5_RUNNER_PROFILE : JAVA_RUNNER_PROFILE;
  if (source.runnerProfile !== expectedProfile)
    throw new Error(`${path}.runnerProfile must be ${expectedProfile}`);
  if (typeof source.entrypoint !== "string" || !ENTRYPOINT.test(source.entrypoint))
    throw new Error(`${path}.entrypoint must be a simple .js or .pde file name`);
  const expectedSuffix = language === "p5js" ? ".js" : ".pde";
  if (!source.entrypoint.endsWith(expectedSuffix))
    throw new Error(`${path}.entrypoint must end with ${expectedSuffix}`);
  const tick = finite(source.tick, `${path}.tick`);
  if (!Number.isInteger(tick) || tick < 1 || tick > MAX_TICK)
    throw new Error(`${path}.tick must be an integer from 1 to ${MAX_TICK}`);
  const surface = source.background;
  if (surface !== "transparent" && surface !== "opaque")
    throw new Error(`${path}.background must be transparent or opaque`);
  return {
    language,
    sourceArtifactHash: hash(source.sourceArtifactHash, `${path}.sourceArtifactHash`),
    previewArtifactHash:
      source.previewArtifactHash === null
        ? null
        : hash(source.previewArtifactHash, `${path}.previewArtifactHash`),
    runnerProfile: expectedProfile,
    entrypoint: source.entrypoint,
    background: surface,
    randomSeed: uint32(source.randomSeed, `${path}.randomSeed`),
    noiseSeed: uint32(source.noiseSeed, `${path}.noiseSeed`),
    tick,
    controls: controls(source.controls, `${path}.controls`),
  };
}
function recipeContent(value: unknown, path: string): RecipeContent {
  const source = object(value, path);
  exact(source, ["recipeArtifactHash", "executorProfile"], path);
  if (typeof source.executorProfile !== "string" || !SAFE_TEXT.test(source.executorProfile))
    throw new Error(`${path}.executorProfile must be a printable profile name`);
  return {
    recipeArtifactHash: hash(source.recipeArtifactHash, `${path}.recipeArtifactHash`),
    executorProfile: source.executorProfile,
  };
}
function documentLayer(value: unknown, path: string): DocumentLayer {
  const source = object(value, path);
  exact(source, ["id", "kind", "visible", "opacity", "content"], path);
  if (typeof source.id !== "string" || !LAYER_ID.test(source.id))
    throw new Error(`${path}.id must contain 1 to 64 letters, digits, _ or -`);
  if (typeof source.visible !== "boolean")
    throw new Error(`${path}.visible must be true or false`);
  const opacity = finite(source.opacity, `${path}.opacity`);
  if (opacity < 0 || opacity > 1) throw new Error(`${path}.opacity must be between 0 and 1`);
  const shared = { id: source.id, visible: source.visible, opacity };
  if (source.kind === "workflow")
    return { ...shared, kind: "workflow", content: workflowContent(source.content, `${path}.content`) };
  if (source.kind === "source")
    return { ...shared, kind: "source", content: sourceContent(source.content, `${path}.content`) };
  if (source.kind === "recipe")
    return { ...shared, kind: "recipe", content: recipeContent(source.content, `${path}.content`) };
  throw new Error(`${path}.kind must be workflow, source or recipe`);
}
/** Strictly admits harness-v1 documents. */
export function validateDocumentV3(input: unknown): StudioDocumentV3 {
  const source = object(input, "Document");
  exact(
    source,
    ["schemaVersion", "bindingVersion", "catalogSha256", "width", "height", "background", "layers"],
    "Document",
  );
  if (source.schemaVersion !== 2) throw new Error("Document schemaVersion must be 2");
  if (source.bindingVersion !== STUDIO_BINDING)
    throw new Error(`Document bindingVersion must be ${STUDIO_BINDING}`);
  if (source.catalogSha256 !== catalogDigest())
    throw new Error("Document catalogSha256 is stale or unsupported");
  if (source.width !== 640 || source.height !== 640)
    throw new Error("Document canvas must be 640 by 640");
  if (typeof source.background !== "string" || !/^#[0-9a-fA-F]{6}$/.test(source.background))
    throw new Error("Document background must be an opaque RGB colour such as #ece7da");
  if (!Array.isArray(source.layers)) throw new Error("Document layers must be an array");
  if (source.layers.length > MAX_LAYERS)
    throw new Error(`Document supports at most ${MAX_LAYERS} layers`);
  const ids = new Set<string>(),
    layers = source.layers.map((entry, index) => {
      const layer = documentLayer(entry, `Document layers[${index}]`);
      if (ids.has(layer.id)) throw new Error(`Document layers[${index}].id must be unique`);
      ids.add(layer.id);
      return layer;
    });
  return {
    schemaVersion: 2,
    bindingVersion: STUDIO_BINDING,
    catalogSha256: catalogDigest(),
    width: 640,
    height: 640,
    background: source.background.toLowerCase(),
    layers,
  };
}
/** Wraps every admitted app workflow layer without changing its settings. */
export function migrateToV3(older: { background: string; layers: Layer[] }): StudioDocumentV3 {
  return {
    schemaVersion: 2,
    bindingVersion: STUDIO_BINDING,
    catalogSha256: catalogDigest(),
    width: 640,
    height: 640,
    background: older.background,
    layers: older.layers.map((layer) => workflowLayer(layer)),
  };
}
export function workflowLayer(layer: Layer): DocumentLayer {
  return {
    id: layer.id,
    kind: "workflow",
    visible: layer.visible,
    opacity: layer.opacity,
    content: {
      technique: layer.technique,
      seed: layer.seed,
      palette: [...layer.palette],
      cutEdits: layer.cutEdits.map((edit) => ({ ...edit })),
      transform: { ...layer.transform },
      params: { ...layer.params },
    },
  };
}
/** Admits harness-v1 directly and migrates earlier app bindings through their validator. */
export function validateStudioDocument(input: unknown): StudioDocumentV3 {
  const probe = object(input, "Document");
  if (probe.bindingVersion === STUDIO_BINDING) return validateDocumentV3(input);
  return migrateToV3(validateDocument(input));
}
export function createDocumentV3(technique = "field-marks"): StudioDocumentV3 {
  return migrateToV3(createDocument(definition(technique).id));
}
/** Stable canonical JSON for revision hashing: object keys sorted, arrays ordered. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}
export const layerTitle = (layer: DocumentLayer): string =>
  layer.kind === "workflow"
    ? layer.content.technique
    : layer.kind === "source"
      ? `${layer.content.language} source`
      : "recipe";
