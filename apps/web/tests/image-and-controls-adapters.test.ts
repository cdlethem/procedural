import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Layer } from "../lib/studio-types";
import {
  drawImageAndControls,
  imageAndControlsDefinitions,
  imageAndControlsPalette,
  weightedImageModel,
  wordEchoContours,
  wordEchoControlsAt,
} from "../lib/adapters/image-and-controls";
import { imageAndControlsStudies } from "../content/image-and-controls-studies.mjs";
import suppliedContours from "../assets/word-echo-contours.json";
import { controlsAt, nonAudioFeatures, synthesizedFeatures } from "@procedurals/javascript/examples/word-echo/study.js"

const sha = (bytes: Uint8Array | Uint8ClampedArray | string) => createHash("sha256").update(typeof bytes === "string" ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest("hex");
function layerFor(id: string): Layer {
  const definition = imageAndControlsDefinitions.find((item) => item.id === id)!;
  return {
    id: `layer-${id}`, technique: id, visible: true, opacity: 1, seed: 42,
    palette: imageAndControlsPalette(id)!, cutEdits: [],
    transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params: { ...definition.defaults },
  };
}
function draw(layer: Layer) {
  const styled = createHash("sha256"), geometry = createHash("sha256");
  let marks = 0;
  const record = (name: string, args: unknown[]) => {
    assert.notEqual(name, "background", "Studio layers leave the document background in charge of paper");
    if (layer.technique === "weighted-image-atlas" && name === "rect")
      assert.notDeepEqual(args, [345, 118, 257, 333], "the result panel is transparent between marks");
    for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value), `${name} finite`);
    const command = JSON.stringify([name, ...args]); styled.update(command);
    if (["line", "circle", "rect", "vertex", "image"].includes(name)) { geometry.update(command); marks += 1; }
  };
  const p = new Proxy({
    CLOSE: "close",
    createImage: (width: number, height: number) => ({ width, height, pixels: new Uint8ClampedArray(width * height * 4), loadPixels() {}, updatePixels() {} }),
    image: (image: { width: number; height: number; pixels: Uint8ClampedArray }, ...args: number[]) => {
      assert.deepEqual(args, [40, 118, 257, 333], "the source image stays in the source panel");
      for (let i = 3; i < image.pixels.length; i += 4) assert.equal(image.pixels[i], 255, "source raster pixels stay opaque");
      record("image", [image.width, image.height, sha(image.pixels), ...args]);
    },
  } as Record<string, any>, { get(target, key: string) { return key in target ? target[key] : (...args: unknown[]) => record(key, args); } });
  drawImageAndControls(p, layer);
  return { styled: styled.digest("hex"), geometry: geometry.digest("hex"), marks };
}

test("two study records expose bounded independent controls and guides", () => {
  assert.deepEqual(imageAndControlsDefinitions.map((item) => item.id), imageAndControlsStudies.map((item) => item.slug));
  for (const definition of imageAndControlsDefinitions) {
    assert.deepEqual(Object.keys(definition.defaults).sort(), definition.parameters.map((item) => item.key).sort());
    assert.match(readFileSync(new URL(`../content/${definition.id}.md`, import.meta.url), "utf8"), /\| Control \| Canvas effect \|/);
    const palette = imageAndControlsPalette(definition.id)!;
    palette[0] ^= 0xffffff;
    assert.notDeepEqual(palette, imageAndControlsPalette(definition.id));
  }
});

test("weighted image sources and actual core calls retain deterministic, independent geometry", () => {
  const layer = layerFor("weighted-image-atlas"), initial = structuredClone(layer);
  const base = weightedImageModel(layer.params as any);
  assert.equal(base.tones.length, 8000);
  assert.equal(base.weights.length, 8000);
  assert.equal(base.points.length, 420);
  assert.equal(base.pixelIndices.length, 420);
  assert.ok(base.weights.some((weight) => weight === 0));
  assert.ok(base.weights.some((weight) => weight > 0));
  for (const [x, y] of base.points) assert.ok(x >= 0 && x <= 80 && y >= 0 && y <= 100);
  assert.strictEqual(weightedImageModel(layer.params as any), base, "unchanged structure retains the model");
  const changedSource = weightedImageModel({ ...layer.params, source: "thermal" } as any);
  const inverted = weightedImageModel({ ...layer.params, invert: true } as any);
  assert.notDeepEqual(changedSource.weights, base.weights);
  assert.notDeepEqual(inverted.pixelIndices, base.pixelIndices);
  const small = { source: "relief" as const, invert: false, count: 140, relax: false };
  const sampled = weightedImageModel(small), relaxed = weightedImageModel({ ...small, relax: true });
  assert.equal(relaxed.masses?.length, 140);
  assert.notDeepEqual(relaxed.points, sampled.points);
  assert.deepEqual(layer, initial, "source layer stays untouched");
  const baseline = draw(layer);
  assert.ok(baseline.marks > 420);
  assert.deepEqual(draw(layer), baseline);
  assert.notEqual(draw({ ...layer, params: { ...layer.params, marks: "stitches" } }).styled, baseline.styled);
  assert.equal(draw({ ...layer, params: { ...layer.params, marks: "stitches" } }).geometry === baseline.geometry, false, "mark shape changes geometry");
  const recolored = draw({ ...layer, palette: [0x081d24, 0x225567, 0x4499aa, 0xffaa55, 0xddd8bb, 0xf7efe0] });
  assert.equal(recolored.geometry, baseline.geometry);
  assert.notEqual(recolored.styled, baseline.styled);
});

test("supplied contours are font-bound actual ECHO and OPEN shapes, with detached access", () => {
  const root = new URL("../../../", import.meta.url);
  const fileHash = (path: string) => sha(readFileSync(new URL(path, root)));
  assert.equal(fileHash(suppliedContours.font.path), suppliedContours.font.sha256);
  assert.equal(fileHash(suppliedContours.font.licensePath), suppliedContours.font.licenseSha256);
  assert.equal(fileHash(suppliedContours.sourceStudy.path), suppliedContours.sourceStudy.sha256);
  assert.equal(suppliedContours.p5.version, "2.3.2");
  const echo = wordEchoContours("ECHO"), open = wordEchoContours("OPEN");
  assert.equal(echo.length, 5); assert.equal(open.length, 6);
  assert.equal(echo.flat().length, 403); assert.equal(open.flat().length, 420);
  assert.notDeepEqual(echo, open);
  echo[0][0][0] += 100;
  assert.notDeepEqual(echo, wordEchoContours("ECHO"));
  assert.throws(() => wordEchoContours("MISSING" as any), /WORD_OUTLINE_UNAVAILABLE/);
});

test("word marks use ordered recorded controls and transfer without invented glyphs", () => {
  const atZero = wordEchoControlsAt("synth", 0, 1);
  assert.deepEqual(atZero, controlsAt(synthesizedFeatures(), 0, 1).values);
  assert.notDeepEqual(wordEchoControlsAt("synth", 0.125, 1), atZero);
  assert.deepEqual(wordEchoControlsAt("non-audio", 0, 1), controlsAt(nonAudioFeatures(), 0, 1).values);
  const enlarged = wordEchoControlsAt("synth", 0, 1.5);
  assert.notEqual(enlarged[0], atZero[0]);
  assert.deepEqual(enlarged.slice(1), atZero.slice(1));
  const layer = layerFor("word-echo"), baseline = draw(layer);
  assert.ok(baseline.marks > 1000);
  assert.deepEqual(draw(layer), baseline);
  for (const [key, value] of Object.entries({ time: 2, word: "OPEN", signal: "non-audio", transfer: "path", spacing: 7, radiusScale: 1.5 })) {
    assert.notEqual(draw({ ...layer, params: { ...layer.params, [key]: value } }).geometry, baseline.geometry, `${key} changes drawn marks`);
  }
  const recolored = draw({ ...layer, palette: [0x081d24, 0x225567, 0x4499aa, 0xffaa55, 0xddd8bb, 0xf7efe0] });
  assert.equal(recolored.geometry, baseline.geometry);
  assert.notEqual(recolored.styled, baseline.styled);
});
