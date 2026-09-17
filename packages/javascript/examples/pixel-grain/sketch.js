import { seededPixelGrain } from "../../src/index.js";

// Independent structural study of cuadraditos by the surveyed source author.
// Source: 2014/Generativos/cuadraditos, revision 69bdd8513e4482a5e6018e36887d4bc208660eb5.
// Original source RNG/float color conversion differ; no source code is imported.
const art = document.querySelector("#art"), status = document.querySelector("#status");
const strength = document.querySelector("#strength"), exponent = document.querySelector("#exponent");
let alpha = false, revision = 0;

// Private native adapter: straight RGBA bytes, density one, no premultiplication.
function grain(layer, input) {
  if (layer.pixelDensity() !== 1) throw new Error("Pixel grain requires density one");
  layer.loadPixels(); // A tainted/unreadable canvas remains a visible host error.
  if (layer.pixels.length !== layer.width * layer.height * 4) throw new Error("Unexpected RGBA byte length");
  const pixels = new Array(layer.width * layer.height);
  for (let i = 0; i < pixels.length; i++) {
    const j = i * 4;
    pixels[i] = ((layer.pixels[j + 3] << 24) | (layer.pixels[j] << 16) | (layer.pixels[j + 1] << 8) | layer.pixels[j + 2]) >>> 0;
  }
  const result = seededPixelGrain({ source: { width: layer.width, height: layer.height, pixels }, ...input, rngState: 42, maxWork: pixels.length });
  for (let i = 0; i < pixels.length; i++) {
    const j = i * 4, packed = result.raster.pixels[i];
    layer.pixels[j] = (packed >>> 16) & 255; layer.pixels[j + 1] = (packed >>> 8) & 255;
    layer.pixels[j + 2] = packed & 255; layer.pixels[j + 3] = packed >>> 24;
  }
  layer.updatePixels();
  return result.rngState;
}

const sketch = new window.p5((p) => {
  p.setup = () => { p.createCanvas(600, 800, p.P2D).parent(art); p.pixelDensity(1); p.noLoop(); };
  p.draw = () => {
    try {
      p.background(24);
      let finalState;
      if (!alpha) {
        let layoutState = 42, count = 0;
        p.noStroke(); p.fill(200, 180);
        for (let row = 0; row < 24; row++) for (let col = 0; col < 7; col++) {
          for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
            layoutState = (Math.imul(1664525, layoutState) + 1013904223) >>> 0;
            if (layoutState / 4294967296 < .3) continue;
            p.rect(30 + col * 80 + x * 9, 40 + row * 30 + y * 9, 5, 5); count++;
          }
        }
        art.dataset.geometry = `blocks:${count}:${layoutState}`;
        finalState = grain(p, { mode: "RGB_ADD", range: [0, Number(strength.value)], exponent: Number(exponent.value) });
      } else {
        const layer = p.createGraphics(600, 800, p.P2D); layer.pixelDensity(1);
        try {
          layer.clear(); layer.noStroke();
          for (let i = 0; i < 6; i++) { layer.fill(235 - i * 14, 180 + i * 7, 95 + i * 15, 200); layer.rect(70 + i * 22, 75 + i * 100, 340, 160); }
          finalState = grain(layer, { mode: "ALPHA_MULTIPLY", range: [.001, 1.001], exponent: Number(exponent.value) });
          p.image(layer, 0, 0);
        } finally { layer.remove(); }
        art.dataset.geometry = "six-overlapping-rectangles-in-one-layer";
      }
      art.dataset.rngState = String(finalState);
      art.dataset.revision = String(++revision); art.dataset.renderStatus = "ready";
      status.textContent = `${alpha ? "Alpha layer" : "Brightness grid"} · grain seed 42 · exponent ${exponent.value}`;
    } catch (error) { art.dataset.renderStatus = "error"; status.textContent = `Could not draw: ${error.message}`; }
  };
});
function action(key) {
  if (key === "s") { sketch.saveCanvas("pixel-grain", "png"); return; }
  if (key === "t") strength.value = Number(strength.value) === 10 ? "40" : "10";
  else if (key === "m") { alpha = !alpha; exponent.value = alpha ? ".4" : "1"; }
  else if (key === "0") { alpha = false; strength.value = "10"; exponent.value = "1"; }
  else return;
  sketch.redraw();
}
document.querySelector("#controls").addEventListener("click", (event) => { const button = event.target.closest("button[data-action]"); if (button) action(button.dataset.action); });
for (const input of [strength, exponent]) input.addEventListener("change", () => sketch.redraw());
window.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target.closest?.("input,textarea,select")) return;
  if (["t", "m", "0", "s"].includes(event.key.toLowerCase())) { event.preventDefault(); action(event.key.toLowerCase()); }
});
