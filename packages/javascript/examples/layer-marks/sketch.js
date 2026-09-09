import { createLayerMarks } from "./layer-marks.js";

const WIDTH = 720, HEIGHT = 480;

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let sourceRaster = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeLayerMarks() {
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

function drawSource(g) {
  g.background(22, 56, 67);
  g.noStroke();
  for (let r = 220; r > 10; r -= 18) {
    // Java int division: r/3 truncates before the 140 offset.
    g.fill(238, 140 + Math.floor(r / 3), 70);
    g.ellipse(195, 245, r * 2, r * 2);
  }
  g.fill(225, 85, 90);
  g.rect(425, 95, 190, 160, 20);
  g.fill(50, 185, 165);
  g.triangle(410, 400, 600, 185, 650, 415);
}

/** Canvas-positioned pass: the full source plus canvas-centered ring outlines. Region-independent (same content regardless of which region is compositing it). */
function drawPicture(g, sourceImage) {
  g.clear();
  g.image(sourceImage, 0, 0);
  g.noFill();
  g.stroke(255, 245, 200);
  g.strokeWeight(3);
  for (let radius = 30; radius < 420; radius += 35) g.ellipse(360, 240, radius * 2, radius * 2);
}

/** Local pass: this region's own crop of the source (redrawn at its original position via translate), plus region-relative decoration lines. */
function drawLocal(g, sourceImage, region) {
  g.clear();
  const w = region.right - region.left;
  const h = region.bottom - region.top;
  g.translate(region.left, region.top);
  g.image(sourceImage, 0, 0, w, h, region.left, region.top, w, h);
  g.stroke(18, 35, 53);
  g.strokeWeight(2);
  for (let x = 12; x < w; x += 16) g.line(x, 12, 150, 180);
}

new window.p5((p) => {
  let outputImage;
  let sourceImage;

  p.setup = () => {
    p.createCanvas(WIDTH, HEIGHT, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();

    sourceImage = p.createGraphics(WIDTH, HEIGHT);
    sourceImage.pixelDensity(1);
    drawSource(sourceImage);
    sourceRaster = toArgbRaster(sourceImage);

    const ground = p.createGraphics(WIDTH, HEIGHT);
    ground.pixelDensity(1);
    ground.background(244, 238, 222);
    composition = createLayerMarks(toArgbRaster(ground));

    outputImage = p.createImage(WIDTH, HEIGHT);
    paint();
  };

  function pictureRaster() {
    const g = p.createGraphics(WIDTH, HEIGHT);
    g.pixelDensity(1);
    drawPicture(g, sourceImage);
    const raster = toArgbRaster(g);
    g.remove();
    return raster;
  }

  function localRasterFor(region) {
    const g = p.createGraphics(WIDTH, HEIGHT);
    g.pixelDensity(1);
    drawLocal(g, sourceImage, region);
    const raster = toArgbRaster(g);
    g.remove();
    return raster;
  }

  function paint() {
    const info = composition.modeInfo;
    let displayed;
    if (info.contentKind === "picture") {
      const picture = pictureRaster();
      displayed = composition.compose(() => picture);
    } else if (info.contentKind === "local") {
      const localMap = new Map();
      for (const region of composition.regions) localMap.set(region.id, localRasterFor(region));
      displayed = composition.compose((region) => localMap.get(region.id));
    } else {
      const picture = pictureRaster();
      const localMap = new Map();
      for (const region of composition.regions) localMap.set(region.id, localRasterFor(region));
      displayed = composition.composeCrossfade(() => picture, (region) => localMap.get(region.id));
    }
    fromArgbRaster(outputImage, displayed);
    p.image(outputImage, 0, 0);
    revision += 1;
    art.dataset.revision = String(revision);
    const modeName = ["picture (canvas)", "local (sharp)", "local (feathered)", "picture/local crossfade"][composition.mode];
    status.textContent = `mode ${composition.mode}: ${modeName}`;
  }

  function action(name) {
    if (name === "m") composition.cycleMode();
    else if (name === "s") {
      // Saving never rerenders; it saves the displayed raster.
      outputImage.save("layer-marks.png");
      return;
    } else return;
    paint();
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
