import type { Layer } from "./studio-types";
import { definition } from "./studio";
import {
  validateStudioDocument,
  type CandidateScope,
  type DocumentLayer,
  type StudioDocumentV3,
} from "./studio-document";
import { basicDefinitions, drawBasic } from "./adapters/basic";
import { drawGeometry, geometryDefinitions } from "./adapters/geometry";
import { drawEffects, effectsDefinitions } from "./adapters/effects";

const basicIds = new Set(basicDefinitions.map((item) => item.id));
const geometryIds = new Set(geometryDefinitions.map((item) => item.id));
const effectsIds = new Set(effectsDefinitions.map((item) => item.id));
const constants = ["CLOSE", "CORNER", "ROUND", "TRIANGLES"] as const;

/** Isolated harness compositor. Generated source is represented only by its trusted raster. */
export function renderHarness(
  p: any,
  input: unknown,
  images: Record<string, unknown> = {},
): void {
  const document = validateStudioDocument(input);
  const candidate = p.createGraphics(640, 640, p.P2D);
  try {
    prepare(candidate, "2d");
    candidate.background(document.background);
    for (const layer of document.layers) {
      if (layer.kind === "recipe")
        throw new Error(`Unsupported capability: recipe layer ${layer.id} cannot be rendered in the studio`);
      if (layer.kind === "source") {
        const hash = layer.content.previewArtifactHash;
        if (hash === null) throw new Error(`Source layer ${layer.id} has no preview artifact`);
        if (!(hash in images)) throw new Error(`Source layer ${layer.id} preview artifact ${hash} is missing`);
      }
      if (!layer.visible || layer.opacity === 0) continue;
      const renderer = layer.kind === "workflow" ? definition(layer.content.technique).renderer ?? "2d" : "2d";
      const buffer = p.createGraphics(640, 640, renderer === "webgl" ? p.WEBGL : p.P2D);
      try {
        forwardConstants(p, buffer);
        prepare(buffer, renderer);
        buffer.clear();
        if (layer.kind === "workflow") drawWorkflow(buffer, layer);
        else drawSource(buffer, layer, images);
        candidate.push();
        candidate.drawingContext.globalCompositeOperation = "source-over";
        candidate.tint(255, Math.round(layer.opacity * 255));
        const transform = layer.kind === "workflow" ? layer.content.transform : null;
        if (
          transform === null ||
          (transform.x === 320 &&
            transform.y === 320 &&
            transform.scale === 1 &&
            transform.rotation === 0)
        ) {
          candidate.image(buffer, 0, 0, 640, 640);
        } else {
          candidate.translate(transform.x, transform.y);
          candidate.rotate((transform.rotation * Math.PI) / 180);
          candidate.scale(transform.scale);
          candidate.image(buffer, -320, -320, 640, 640);
        }
        candidate.noTint();
        candidate.pop();
      } finally {
        if (renderer === "webgl") releaseWebgl(buffer);
        buffer.remove();
      }
    }
    p.clear();
    p.image(candidate, 0, 0, 640, 640);
  } finally {
    candidate.remove();
  }
}

function drawWorkflow(p: any, layer: Extract<DocumentLayer, { kind: "workflow" }>): void {
  const workflow: Layer = {
    id: layer.id,
    technique: layer.content.technique,
    visible: layer.visible,
    opacity: layer.opacity,
    seed: layer.content.seed,
    palette: [...layer.content.palette],
    cutEdits: layer.content.cutEdits.map((edit) => ({ ...edit })),
    transform: { ...layer.content.transform },
    params: { ...layer.content.params },
  };
  if (basicIds.has(workflow.technique)) return drawBasic(p, workflow);
  if (geometryIds.has(workflow.technique)) return drawGeometry(p, workflow);
  if (effectsIds.has(workflow.technique)) return drawEffects(p, workflow);
  throw new Error(`Unknown studio technique: ${String(workflow.technique)}`);
}
function drawSource(p: any, layer: Extract<DocumentLayer, { kind: "source" }>, images: Record<string, unknown>): void {
  const hash = layer.content.previewArtifactHash;
  if (hash === null) throw new Error(`Source layer ${layer.id} has no preview artifact`);
  const image = images[hash];
  if (image === undefined || image === null) throw new Error(`Source layer ${layer.id} preview artifact ${hash} is missing`);
  if (!p.drawingContext || typeof p.drawingContext.drawImage !== "function")
    throw new Error("p5 source preview requires a 2D canvas drawing context");
  p.drawingContext.imageSmoothingEnabled = false;
  p.drawingContext.drawImage(image, 0, 0, 640, 640);
}
function forwardConstants(main: any, graphics: any): void {
  for (const key of constants) {
    if (!(key in main)) throw new Error(`Main p5 instance is missing ${key}`);
    graphics[key] = main[key];
  }
}
function prepare(graphics: any, renderer: "2d" | "webgl"): void {
  graphics.pixelDensity(1);
  if (graphics.width !== 640 || graphics.height !== 640 || graphics.pixelDensity() !== 1)
    throw new Error("p5 did not create a 640px density-1 graphics buffer");
  if (renderer === "webgl" && typeof graphics.noLights === "function") graphics.noLights();
}
function releaseWebgl(graphics: any): void {
  const gl = graphics?._renderer?.GL ?? graphics?.drawingContext;
  if (gl && typeof gl.getExtension === "function") gl.getExtension("WEBGL_lose_context")?.loseContext();
}

/** Computes the exact structural delta used when rebasing a candidate. */
export function computeRebaseDelta(
  published: StudioDocumentV3,
  current: StudioDocumentV3,
  scope: CandidateScope,
  selectedLayerId?: string | null,
): StudioDocumentV3["layers"] {
  const base = validateStudioDocument(published);
  const next = validateStudioDocument(current);
  if (scope === "composition") return next.layers;
  if (scope === "edit-layer") {
    if (!selectedLayerId) throw new Error("An edit-layer rebase requires selectedLayerId");
    const edited = next.layers.find((layer) => layer.id === selectedLayerId);
    if (!edited) throw new Error(`Selected layer ${selectedLayerId} is not in the current document`);
    return [edited];
  }
  const baseIds = new Set(base.layers.map((layer) => layer.id));
  return next.layers.filter((layer) => !baseIds.has(layer.id));
}
export { renderHarness as renderStudio };
