import { drawMaterials, materialsDefinitions } from "./adapters/materials";
import { drawSystems, systemsDefinitions } from "./adapters/systems";
import { drawPaths, pathsDefinitions } from "./adapters/paths";
import type { Layer, StudioDocument } from "./studio-types";
import { definition, validateDocument } from "./studio";
import { basicDefinitions, drawBasic } from "./adapters/basic";
import { drawGeometry, geometryDefinitions } from "./adapters/geometry";
import { drawEffects, effectsDefinitions } from "./adapters/effects";
import { drawExpansion, expansionDefinitions } from "./adapters/expansion";
import {
  drawExternalExpansion,
  externalExpansionDefinitions,
} from "./adapters/external-expansion";

const basicIds = new Set(basicDefinitions.map((definition) => definition.id));
const geometryIds = new Set(
  geometryDefinitions.map((definition) => definition.id),
);
const effectsIds = new Set(
  effectsDefinitions.map((definition) => definition.id),
);
const pathsIds = new Set(pathsDefinitions.map(item => item.id));
const systemsIds = new Set(systemsDefinitions.map(item => item.id));
const materialsIds = new Set(materialsDefinitions.map(item => item.id));
const expansionIds = new Set(expansionDefinitions.map((definition) => definition.id));
const externalExpansionIds = new Set(
  externalExpansionDefinitions.map((definition) => definition.id),
);
const drawingConstants = ["CLOSE", "CORNER", "CENTER", "ROUND", "TRIANGLES"] as const;

/** Draws a whole document to a candidate graphics buffer, publishing it only after success. */
export function renderStudio(p: any, document: StudioDocument): void {
  const validated = validateDocument(document);
  const candidate = p.createGraphics(640, 640, p.P2D);
  try {
    prepare(candidate, "2d");
    candidate.background(validated.background);
    for (const layer of validated.layers) {
      if (!layer.visible || layer.opacity === 0) continue;
      const renderer = definition(layer.technique).renderer ?? "2d";
      const layerBuffer = p.createGraphics(
        640,
        640,
        renderer === "webgl" ? p.WEBGL : p.P2D,
      );
      try {
        forwardDrawingConstants(p, layerBuffer);
        prepare(layerBuffer, renderer);
        layerBuffer.clear();
        drawLayer(layerBuffer, layer);
        candidate.push();
        candidate.drawingContext.globalCompositeOperation = "source-over";
        candidate.tint(255, Math.round(layer.opacity * 255));
        if (
          layer.transform.x === 320 &&
          layer.transform.y === 320 &&
          layer.transform.scale === 1 &&
          layer.transform.rotation === 0
        ) {
          // Preserve the established identity composite exactly, pixel for pixel.
          candidate.image(layerBuffer, 0, 0, 640, 640);
        } else {
          candidate.translate(layer.transform.x, layer.transform.y);
          candidate.rotate((layer.transform.rotation * Math.PI) / 180);
          candidate.scale(layer.transform.scale);
          candidate.image(layerBuffer, -320, -320, 640, 640);
        }
        candidate.noTint();
        candidate.pop();
      } finally {
        if (renderer === "webgl") releaseWebglContext(layerBuffer);
        layerBuffer.remove();
      }
    }
    p.clear();
    p.image(candidate, 0, 0, 640, 640);
  } finally {
    candidate.remove();
  }
}
/** Graphics installs p5 drawing methods but not the shape constants they consume. */
function forwardDrawingConstants(main: any, graphics: any): void {
  for (const key of drawingConstants) {
    if (!(key in main)) throw new Error(`Main p5 instance is missing ${key}`);
    graphics[key] = main[key];
    if (graphics[key] !== main[key])
      throw new Error(`p5.Graphics did not retain forwarded ${key}`);
  }
}
/** p5.Graphics.remove() detaches its canvas but does not request GL context loss. */
function releaseWebglContext(graphics: any): void {
  const gl = graphics?._renderer?.GL ?? graphics?.drawingContext;
  if (!gl || typeof gl.getExtension !== "function") return;
  gl.getExtension("WEBGL_lose_context")?.loseContext();
}
function prepare(graphics: any, renderer: "2d" | "webgl"): void {
  graphics.pixelDensity(1);
  if (
    graphics.width !== 640 ||
    graphics.height !== 640 ||
    graphics.pixelDensity() !== 1
  )
    throw new Error("p5 did not create a 640px density-1 graphics buffer");
  if (renderer === "webgl" && typeof graphics.noLights === "function")
    graphics.noLights();
}
function drawLayer(p: any, layer: Layer): void {
  if (basicIds.has(layer.technique)) return drawBasic(p, layer);
  if (geometryIds.has(layer.technique)) return drawGeometry(p, layer);
  if (effectsIds.has(layer.technique)) return drawEffects(p, layer);
  if (pathsIds.has(layer.technique)) return drawPaths(p, layer);
  if (systemsIds.has(layer.technique)) return drawSystems(p, layer);
  if (materialsIds.has(layer.technique)) return drawMaterials(p, layer);
  if (expansionIds.has(layer.technique)) return drawExpansion(p, layer);
  if (externalExpansionIds.has(layer.technique)) return drawExternalExpansion(p, layer);
  throw new Error(`Unknown studio technique: ${String(layer.technique)}`);
}
