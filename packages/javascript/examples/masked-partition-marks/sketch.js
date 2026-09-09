import { createMaskedPartitionMarks, PATH_COLORS } from "./masked-partition-marks.js";

const WIDTH = 720, HEIGHT = 480;

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let sourceImage = null;
let globalImage = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeMaskedPartitionMarks() {
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

/** Writes a packed-ARGB raster back into a p5.Image's straight RGBA pixel buffer. */
function fromArgbRaster(image, raster) {
  image.loadPixels();
  const dst = image.pixels;
  const pixels = raster.pixels;
  for (let i = 0; i < pixels.length; i += 1) {
    const value = pixels[i] >>> 0;
    const o = i * 4;
    dst[o] = (value >>> 16) & 0xff;
    dst[o + 1] = (value >>> 8) & 0xff;
    dst[o + 2] = value & 0xff;
    dst[o + 3] = (value >>> 24) & 0xff;
  }
  image.updatePixels();
}

/** Java2DLayers.alphaMask: alpha/255 coverage, one value per pixel. */
function alphaCoverage(raster) {
  const coverage = new Array(raster.pixels.length);
  for (let i = 0; i < raster.pixels.length; i += 1) coverage[i] = (raster.pixels[i] >>> 24) / 255.0;
  return coverage;
}

function drawGround(g) {
  g.background(245, 239, 225);
  g.noFill();
  g.stroke(72, 78, 83, 32);
  g.strokeWeight(1);
  for (let x = 0; x <= WIDTH; x += 36) g.line(x, 0, x, HEIGHT);
  for (let y = 0; y <= HEIGHT; y += 36) g.line(0, y, WIDTH, y);
}

function drawSource(g) {
  g.background(27, 55, 74);
  g.noStroke();
  for (let radius = 210; radius >= 18; radius -= 18) {
    g.fill(234, 130 + Math.floor(radius / 3), 69, 220);
    g.ellipse(180, 244, radius * 2, radius * 2);
  }
  g.fill(42, 157, 143);
  g.triangle(405, 404, 552, 72, 690, 404);
  g.fill(255, 214, 122, 185);
  g.rect(390, 116, 220, 34);
}

function drawGlobal(g, paths) {
  g.background(27, 55, 74);
  g.noFill();
  g.strokeWeight(2.2);
  const first = new Float64Array(2);
  const next = new Float64Array(2);
  for (let path = 0; path < paths.length; path += 1) {
    paths[path].pointInto(0, first, 0);
    g.stroke(...channels(PATH_COLORS[path % PATH_COLORS.length]));
    for (let step = 0; step < paths[path].steps; step += 1) {
      paths[path].pointInto(step + 1, next, 0);
      g.line(first[0], first[1], next[0], next[1]);
      first[0] = next[0];
      first[1] = next[1];
    }
  }
}

function channels(argb) {
  return [(argb >>> 16) & 0xff, (argb >>> 8) & 0xff, argb & 0xff];
}

/** Per-region elliptical alpha mask, inset 12px within the region's own frame. */
function drawMask(g, region) {
  g.clear();
  g.noStroke();
  g.fill(255);
  const ellipseWidth = region.right - region.left - 12;
  const ellipseHeight = region.bottom - region.top - 12;
  g.ellipse((region.left + region.right) * 0.5, (region.top + region.bottom) * 0.5, ellipseWidth, ellipseHeight);
}

/** Mode 1 content: region-relative converging lines and centered ring outlines. */
function drawLocalLines(g, region) {
  g.clear();
  const frameWidth = region.right - region.left;
  const frameHeight = region.bottom - region.top;
  g.translate(region.left, region.top);
  g.noFill();
  g.stroke(34, 58, 75);
  g.strokeWeight(1.5);
  for (let x = -40; x < frameWidth + 80; x += 18) g.line(x, 0, frameWidth - x * 0.25, frameHeight);
  g.stroke(207, 91, 72, 180);
  for (let radius = 18; radius < Math.max(frameWidth, frameHeight); radius += 24) {
    g.ellipse(frameWidth * 0.5, frameHeight * 0.5, radius * 2, radius * 2);
  }
}

/** Mode 2 content: this region's own crop of the source (redrawn at its original position via translate), plus an inset outline. */
function drawLocalSnip(g, region) {
  g.clear();
  const w = region.right - region.left;
  const h = region.bottom - region.top;
  g.translate(region.left, region.top);
  g.image(sourceImage, 0, 0, w, h, region.left, region.top, w, h);
  g.noFill();
  g.stroke(255, 245, 213, 180);
  g.strokeWeight(2);
  g.rect(8, 8, w - 16, h - 16);
}

new window.p5((p) => {
  let outputImage;
  let maskedRegions;

  function rebuildMasks() {
    maskedRegions = composition.regions.map((region) => {
      const g = p.createGraphics(WIDTH, HEIGHT);
      g.pixelDensity(1);
      drawMask(g, region);
      const raster = toArgbRaster(g);
      g.remove();
      return { region, coverage: alphaCoverage(raster) };
    });
  }

  function globalRaster() {
    const g = p.createGraphics(WIDTH, HEIGHT);
    g.pixelDensity(1);
    drawGlobal(g, composition.paths);
    const raster = toArgbRaster(g);
    g.remove();
    return raster;
  }

  function localRasterFor(region) {
    const g = p.createGraphics(WIDTH, HEIGHT);
    g.pixelDensity(1);
    if (composition.mode === 1) drawLocalLines(g, region);
    else drawLocalSnip(g, region);
    const raster = toArgbRaster(g);
    g.remove();
    return raster;
  }

  p.setup = () => {
    p.createCanvas(WIDTH, HEIGHT, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();

    const sourceGraphics = p.createGraphics(WIDTH, HEIGHT);
    sourceGraphics.pixelDensity(1);
    drawSource(sourceGraphics);
    sourceImage = sourceGraphics;

    const ground = p.createGraphics(WIDTH, HEIGHT);
    ground.pixelDensity(1);
    drawGround(ground);
    composition = createMaskedPartitionMarks(toArgbRaster(ground));

    rebuildMasks();
    outputImage = p.createImage(WIDTH, HEIGHT);
    paint();
  };

  function paint() {
    let displayed;
    if (composition.mode === 0) {
      const global = globalRaster();
      displayed = composition.compose(maskedRegions, () => global);
    } else {
      const localMap = new Map();
      for (const region of composition.regions) localMap.set(region.id, localRasterFor(region));
      displayed = composition.compose(maskedRegions, (region) => localMap.get(region.id));
    }
    fromArgbRaster(outputImage, displayed);
    p.image(outputImage, 0, 0);
    revision += 1;
    art.dataset.revision = String(revision);
    const modeName = ["global paths (canvas)", "local rings (sharp mask)", "local source snippet"][composition.mode];
    status.textContent = `mode ${composition.mode}: ${modeName} · ${composition.alternateLayout ? "alternate" : "default"} layout`;
  }

  function action(name) {
    if (name === "m") { composition.cycleMode(); paint(); return; }
    if (name === "n") { composition.toggleAlternateLayout(); rebuildMasks(); paint(); return; }
    if (name === "0") { if (composition.reset()) rebuildMasks(); paint(); return; }
    if (name === "s") {
      // Saving never rerenders; it saves the displayed raster.
      outputImage.save("masked-partition-marks.png");
    }
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
