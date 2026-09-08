import { BACKGROUND_RGB, SIDE, createWarpMarks, dotColorAt, remapSource, stripeColorAt } from "./warp-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { strength: 32, alternateField: false, stripes: false };
let model = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeWarpMarks() {
  return Object.freeze({ revision, settings: Object.freeze({ ...settings }) });
}

new window.p5((p) => {
  let sourceGraphics = null;
  let sourcePixels = null;

  function rgbColor(rgb) {
    return [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255];
  }

  // Source-pattern drawing (dots via cyclic-palette or stripes) is renderer-owned
  // content generation, matching the Java example's own approach (an offscreen
  // PGraphics filled with ellipse()/rect(), then captured to pixels): it is not part
  // of the portable raster-remap operation, only its input.
  function captureSource() {
    if (sourceGraphics === null) sourceGraphics = p.createGraphics(SIDE, SIDE, p.P2D);
    sourceGraphics.pixelDensity(1);
    sourceGraphics.push();
    sourceGraphics.background(...rgbColor(BACKGROUND_RGB));
    sourceGraphics.noStroke();
    if (settings.stripes) {
      for (let row = 0; row < SIDE; row += 32) {
        sourceGraphics.fill(...rgbColor(stripeColorAt(row)));
        sourceGraphics.rect(0, row, SIDE, 16);
      }
    } else {
      for (let y = 12; y < SIDE; y += 24) {
        for (let x = 12; x < SIDE; x += 24) {
          sourceGraphics.fill(...rgbColor(dotColorAt(model, x, y)));
          sourceGraphics.circle(x, y, 12);
        }
      }
    }
    sourceGraphics.pop();
    sourceGraphics.loadPixels();
    // Canvas pixels are RGBA bytes; the shared contract wants packed unsigned32 ARGB8.
    const rgba = sourceGraphics.pixels;
    const packed = new Array(SIDE * SIDE);
    for (let i = 0; i < packed.length; i += 1) {
      const base = i * 4;
      packed[i] = (((rgba[base + 3] << 24) | (rgba[base] << 16) | (rgba[base + 1] << 8) | rgba[base + 2]) >>> 0);
    }
    sourcePixels = packed;
  }

  let displayedImage = null;

  function remapAndDisplay() {
    const result = remapSource(sourcePixels, model, settings.strength, settings.alternateField);
    displayedImage = p.createImage(SIDE, SIDE);
    displayedImage.loadPixels();
    const out = displayedImage.pixels;
    for (let i = 0; i < SIDE * SIDE; i += 1) {
      const argb = result.pixelAt(i);
      const base = i * 4;
      out[base] = (argb >>> 16) & 255;
      out[base + 1] = (argb >>> 8) & 255;
      out[base + 2] = argb & 255;
      out[base + 3] = (argb >>> 24) & 255;
    }
    displayedImage.updatePixels();
  }

  function paint() {
    p.background(...rgbColor(BACKGROUND_RGB));
    p.image(displayedImage, 0, 0);
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `strength ${settings.strength} · ${settings.alternateField ? "paired-sine" : "gradient-noise"} field · ${settings.stripes ? "stripes" : "dots"} source`;
  }

  p.setup = () => {
    p.createCanvas(SIDE, SIDE, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    model = createWarpMarks();
    captureSource();
    remapAndDisplay();
    paint();
  };

  function action(name) {
    if (name === "s") { p.saveCanvas("warp-marks", "png"); return; }
    if (name === "w") {
      settings.strength = settings.strength === 0 ? 32 : settings.strength === 32 ? 64 : 0;
      remapAndDisplay();
    } else if (name === "f") {
      settings.alternateField = !settings.alternateField;
      remapAndDisplay();
    } else if (name === "p") {
      settings.stripes = !settings.stripes;
      captureSource();
      remapAndDisplay();
    } else if (name === "0") {
      settings.strength = 32; settings.alternateField = false; settings.stripes = false;
      captureSource();
      remapAndDisplay();
    } else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
