import { createImageFieldMarks } from "./image-field-marks.js";

const WIDTH = 720, HEIGHT = 480;

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { dirty: true };
let composition = null;
let displayedFrame = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeImageFieldMarks() {
  return Object.freeze({ composition, revision });
}

/** Converts a p5.Graphics' straight RGBA pixel buffer to a packed-ARGB raster
 * (0xAARRGGBB, matching Processing's PImage.pixels format). */
function toArgbRaster(graphics) {
  graphics.loadPixels();
  const src = graphics.pixels;
  const count = graphics.width * graphics.height;
  const pixels = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const o = i * 4;
    pixels[i] = ((src[o + 3] << 24) | (src[o] << 16) | (src[o + 1] << 8) | src[o + 2]) >>> 0;
  }
  return { width: graphics.width, height: graphics.height, pixels };
}

function channels(argb) {
  return [(argb >>> 16) & 0xff, (argb >>> 8) & 0xff, argb & 0xff];
}

function drawSourceA(g) {
  g.background(235);
  g.noStroke();
  g.fill(40, 65, 85);
  g.ellipse(250, 240, 360, 360);
  g.fill(190, 125, 75);
  g.triangle(420, 400, 580, 70, 690, 400);
  g.fill(125);
  g.rect(0, 220, WIDTH, 40);
}

function drawSourceB(g) {
  g.background(235);
  g.noStroke();
  for (let i = 0; i < 8; i += 1) {
    g.fill(25 + i * 28, 35 + i * 22, 55 + i * 18);
    g.rect(i * 90, 0, 90, HEIGHT);
  }
  g.fill(245);
  g.ellipse(360, 240, 320, 320);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(WIDTH, HEIGHT, p.P2D).parent("art");
    p.pixelDensity(1);

    const a = p.createGraphics(WIDTH, HEIGHT);
    a.pixelDensity(1);
    drawSourceA(a);
    const b = p.createGraphics(WIDTH, HEIGHT);
    b.pixelDensity(1);
    drawSourceB(b);
    composition = createImageFieldMarks([toArgbRaster(a), toArgbRaster(b)]);
  };

  function renderMarks() {
    p.background(246, 240, 225);
    p.noStroke();
    for (const dot of composition.dots) {
      if (composition.sourceColors) p.fill(...channels(dot.argb));
      else p.fill(30, 45, 55);
      p.ellipse(dot.x, dot.y, dot.diameter, dot.diameter);
    }
  }

  p.draw = () => {
    if (!settings.dirty) return;
    renderMarks();
    // Capture only after every drawing layer has completed. Saving never rerenders.
    displayedFrame = p.get();
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `source ${composition.sourceIndex} · ${composition.visibility ? "visibility mode" : "size mode"} · ${composition.sourceColors ? "source colors" : "single color"} · ${composition.dots.length} dots`;
    settings.dirty = false;
  };

  function action(name) {
    if (name === "m") composition.toggleVisibility();
    else if (name === "i") composition.toggleSource();
    else if (name === "c") composition.toggleSourceColors();
    else if (name === "s") {
      // Saving never rerenders; it saves the last captured frame.
      if (displayedFrame) displayedFrame.save("image-field-marks.png");
      return;
    } else return;
    settings.dirty = true;
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => {
    action(String(p.key).toLowerCase());
    if (p.key === " ") return false;
  };
}, art);
