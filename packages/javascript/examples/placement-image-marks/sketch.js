import { createPlacementImageMarks } from "./placement-image-marks.js";

const WIDTH = 720, HEIGHT = 480;

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { dirty: true };
let composition = null;
let displayedFrame = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observePlacementImageMarks() {
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

function drawSource(g) {
  g.noStroke();
  g.fill(235, 114, 80);
  g.rect(0, 0, 160, 160);
  g.fill(42, 157, 143);
  g.rect(160, 0, 160, 160);
  g.fill(250, 224, 155);
  g.ellipse(80, 80, 120, 120);
  g.fill(27, 55, 74);
  g.triangle(180, 140, 240, 20, 300, 140);
  g.fill(255, 160);
  g.rect(0, 70, 320, 20);
}

function drawGround(g) {
  g.background(241, 235, 219);
  g.stroke(209, 202, 186);
  for (let x = 0; x < WIDTH; x += 20) g.line(x, 0, x, HEIGHT);
  for (let y = 0; y < HEIGHT; y += 20) g.line(0, y, WIDTH, y);
}

function drawMaskShape(g) {
  g.clear();
  g.noStroke();
  g.fill(255);
  g.ellipse(360, 240, 440, 320);
}

new window.p5((p) => {
  let placedImage;

  /** Scales the isolated crop into the frame rectangle, clipped to the frame -- Java2DImagePlacement.render's imageMode(CORNER)+clip()+image() call, done on a real canvas. */
  function drawPlaced(placement) {
    const g = p.createGraphics(WIDTH, HEIGHT);
    g.pixelDensity(1);
    fromArgbRaster(placedImage, placement.isolated);
    const ctx = g.drawingContext;
    ctx.save();
    ctx.beginPath();
    ctx.rect(placement.clip.x, placement.clip.y, placement.clip.width, placement.clip.height);
    ctx.clip();
    g.imageMode(g.CORNER);
    g.image(placedImage, placement.rect.x, placement.rect.y, placement.rect.width, placement.rect.height);
    ctx.restore();
    const raster = toArgbRaster(g);
    g.remove();
    return raster;
  }

  p.setup = () => {
    p.createCanvas(WIDTH, HEIGHT, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();

    const sourceGraphics = p.createGraphics(320, 160);
    sourceGraphics.pixelDensity(1);
    drawSource(sourceGraphics);
    const sourceRaster = toArgbRaster(sourceGraphics);

    const ground = p.createGraphics(WIDTH, HEIGHT);
    ground.pixelDensity(1);
    drawGround(ground);

    const maskShape = p.createGraphics(WIDTH, HEIGHT);
    maskShape.pixelDensity(1);
    drawMaskShape(maskShape);
    const maskCoverage = alphaCoverage(toArgbRaster(maskShape));

    composition = createPlacementImageMarks(sourceRaster, toArgbRaster(ground), maskCoverage);
    placedImage = p.createImage(320, 160);
    paint();
  };

  function paint() {
    const placedRaster = drawPlaced(composition.placement);
    const displayed = composition.compose(placedRaster);
    if (!displayedFrame) displayedFrame = p.createImage(WIDTH, HEIGHT);
    fromArgbRaster(displayedFrame, displayed);
    p.image(displayedFrame, 0, 0);
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `${composition.fitMode} · ${composition.cropped ? "cropped" : "full"} source · align ${composition.align} · ${composition.masked ? "masked" : "unmasked"}`;
  }

  function action(name) {
    if (name === "f") composition.cycleFit();
    else if (name === "c") composition.toggleCropped();
    else if (name === "a") composition.cycleAlignment();
    else if (name === "m") composition.toggleMasked();
    else if (name === "s") {
      // Saving never rerenders; it saves the last composited frame.
      if (displayedFrame) displayedFrame.save("placement-image-marks.png");
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
