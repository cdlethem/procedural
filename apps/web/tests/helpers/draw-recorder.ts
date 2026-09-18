import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { drawExternalDynamics } from "../../lib/adapters/external-dynamics";
import type { Layer } from "../../lib/studio-types";

const sha = (value: Uint8Array | Uint8ClampedArray) =>
  createHash("sha256").update(value).digest("hex");

export type DynamicsDrawing = {
  styled: string;
  geometry: string;
  marks: number;
  backgrounds: number;
  imageAlpha: { transparent: number; partial: number; opaque: number } | null;
};

/** Records every drawing call a dynamics layer makes into styled/geometry hashes,
 *  so two renders of the same model compare exactly. */
export function drawDynamics(layer: Layer): DynamicsDrawing {
  const styled = createHash("sha256"), geometry = createHash("sha256");
  let marks = 0, backgrounds = 0;
  let imageAlpha: { transparent: number; partial: number; opaque: number } | null = null;
  const record = (name: string, args: unknown[]) => {
    for (const x of args) if (typeof x === "number") assert.ok(Number.isFinite(x), `${name} finite`);
    const encoded = JSON.stringify([name, ...args]);
    styled.update(encoded);
    if (["line", "vertex", "circle", "rect", "point", "ellipse", "imageGeometry"].includes(name)) {
      geometry.update(encoded);
      marks++;
    }
  };
  const context = new Proxy(
    { setLineDash: (value: number[]) => record("setLineDash", value) } as Record<string, any>,
    { get(target, key: string) { if (key in target) return target[key]; return (...args: unknown[]) => record(`context.${key}`, args); } },
  );
  const p = new Proxy({
    CLOSE: "close", ROUND: "round", drawingContext: context,
    background: (...args: unknown[]) => { backgrounds++; record("background", args); },
    createImage: (width: number, height: number) => ({ width, height, pixels: new Uint8ClampedArray(width * height * 4), loadPixels() {}, updatePixels() {} }),
    image: (image: { width: number; height: number; pixels: Uint8ClampedArray }, ...args: number[]) => {
      record("imageGeometry", [image.width, image.height, ...args]);
      record("imagePixels", [sha(image.pixels)]);
      imageAlpha = { transparent: 0, partial: 0, opaque: 0 };
      for (let i = 3; i < image.pixels.length; i += 4) {
        const alpha = image.pixels[i];
        if (alpha === 0) imageAlpha.transparent++;
        else if (alpha === 255) imageAlpha.opaque++;
        else imageAlpha.partial++;
      }
    },
  } as Record<string, any>,
    { get(target, key: string) { if (key in target) return target[key]; return (...args: unknown[]) => record(key, args); } },
  );
  drawExternalDynamics(p, layer);
  return { styled: styled.digest("hex"), geometry: geometry.digest("hex"), marks, backgrounds, imageAlpha };
}
