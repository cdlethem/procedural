import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { drawEffects, effectsDefinitions } from "../lib/adapters/effects";
import type { Layer } from "../lib/studio-types";

type Id = "warp-marks" | "blur-marks";
const sourcePalette = [0x173f5f, 0xe9c46a, 0xe76f51];
function raster(id: Id, edit: Record<string, number | boolean> = {}, colors = sourcePalette, oldShape = false) {
  const definition = effectsDefinitions.find(item => item.id === id)!;
  const pixels = new Uint8ClampedArray(640 * 640 * 4);
  const p = { pixels, loadPixels() {}, updatePixels() {} };
  const params = { ...definition.defaults, ...edit } as Record<string, number | boolean>;
  if (oldShape) delete params.sourceCoverage;
  const layer: Layer = {
    id: "coverage-test", technique: id, visible: true, opacity: 1, seed: 42,
    palette: colors, cutEdits: [], transform: { x: 320, y: 320, scale: 1, rotation: 0 },
    params,
  };
  drawEffects(p, layer);
  return pixels;
}
const digest = (pixels: Uint8ClampedArray) => createHash("sha256").update(pixels).digest("hex");
const alphas = (pixels: Uint8ClampedArray) => pixels.filter((_, index) => index % 4 === 3);

test("full coverage retains pre-revision opaque pixels through the real effects dispatcher", () => {
  assert.equal(digest(raster("warp-marks")), "223687689b27dfcaa5d2d34900ce5ae33a55ec811a978a163f941d9d9a195cf0");
  assert.equal(digest(raster("warp-marks", { strength: 24, stripe: 19 })), "c3f6f0c0e2ea2d04719c7229e017c25e306ab0169a4f3f4cf28b7125d58d54c1");
  assert.equal(digest(raster("blur-marks")), "61af1634c4066061268815c866d94cb0c363e5fcdc6332056a7a8a7d77346b59");
  for (const id of ["warp-marks", "blur-marks"] as const) {
    assert.equal(digest(raster(id, {}, sourcePalette, true)), digest(raster(id)),
      "direct old-key calls keep their opaque result");
    assert.ok(alphas(raster(id)).every(alpha => alpha === 255));
  }
});

test("source coverage makes transparent gutters and remaps or blurs their alpha", () => {
  for (const id of ["warp-marks", "blur-marks"] as const) {
    const empty = raster(id, { sourceCoverage: 0 });
    assert.ok(empty.every(channel => channel === 0), `${id}: zero coverage clears all channels`);
    const masked = raster(id, { sourceCoverage: 0.45 });
    const alpha = alphas(masked);
    assert.ok(alpha.some(value => value === 0), `${id}: clear source gutters remain`);
    assert.ok(alpha.some(value => value > 0 && value < 255), `${id}: operation softens mask edges`);
    assert.ok(alpha.some(value => value === 255), `${id}: covered ink remains opaque`);
    for (let i = 0; i < masked.length; i += 4)
      if (masked[i + 3] === 0)
        assert.deepEqual([...masked.slice(i, i + 3)], [0, 0, 0], `${id}: no hidden RGB in transparent pixels`);
  }
  assert.notDeepEqual(alphas(raster("warp-marks", { sourceCoverage: 0.45, strength: 0 })),
    alphas(raster("warp-marks", { sourceCoverage: 0.45, strength: 14 })),
    "warped gutters follow the source remap, rather than a fixed output mask");
  assert.notDeepEqual(alphas(raster("blur-marks", { sourceCoverage: 0.45, radius: 2 })),
    alphas(raster("blur-marks", { sourceCoverage: 0.45, radius: 9 })),
    "blur radius changes the alpha transition");
});

test("premultiplied masked paths avoid dark fringes for a single source color", () => {
  const ink = [240, 128, 32];
  for (const id of ["warp-marks", "blur-marks"] as const) {
    const pixels = raster(id, { sourceCoverage: 0.45 }, [0xf08020]);
    let checked = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3];
      if (alpha < 64 || alpha === 255) continue;
      for (let channel = 0; channel < 3; channel += 1)
        assert.ok(Math.abs(pixels[i + channel] - ink[channel]) <= 5,
          `${id}: translucent edge ${[...pixels.slice(i, i + 4)]} retains source color`);
      checked += 1;
    }
    assert.ok(checked > 100, `${id}: tested translucent edge pixels`);
  }
});

test("horizontal-only blur has a valid one-tap vertical work budget", () => {
  const result = raster("blur-marks", { horizontal: true, radius: 9, sourceCoverage: 0.45 });
  assert.ok(alphas(result).some(alpha => alpha > 0 && alpha < 255));
  assert.throws(() => raster("warp-marks", { sourceCoverage: -0.1 }), /Source coverage/);
  assert.throws(() => raster("blur-marks", { sourceCoverage: 1.1 }), /Source coverage/);
});
