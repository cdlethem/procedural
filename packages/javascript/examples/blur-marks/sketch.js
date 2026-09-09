import { createBlurMarks } from "./blur-marks.js";

const WIDTH = 720, HEIGHT = 480;

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeBlurMarks() {
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

function drawGround(g) {
  g.background(22, 34, 48);
  g.noStroke();
  g.fill(32, 49, 63);
  for (let x = 0; x < WIDTH; x += 80) g.rect(x, 0, 40, HEIGHT);
}

function drawArtwork(g) {
  g.clear();
  g.noStroke();
  g.fill(240, 100, 65, 155);
  g.ellipse(390, 255, 240, 240);
  g.noFill();
  g.stroke(255, 220, 120);
  g.strokeWeight(3);
  for (let i = 0; i < 7; i += 1) {
    const x = 140 + i * 60;
    g.line(x, 110, x + 70, 365);
  }
  g.stroke(125, 220, 240);
  g.strokeWeight(5);
  g.ellipse(300, 215, 170, 170);
}

new window.p5((p) => {
  let outputImage;

  p.setup = () => {
    p.createCanvas(WIDTH, HEIGHT, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();

    const ground = p.createGraphics(WIDTH, HEIGHT);
    ground.pixelDensity(1);
    drawGround(ground);
    const artwork = p.createGraphics(WIDTH, HEIGHT);
    artwork.pixelDensity(1);
    drawArtwork(artwork);

    composition = createBlurMarks(toArgbRaster(ground), toArgbRaster(artwork));
    outputImage = p.createImage(WIDTH, HEIGHT);
    paint();
  };

  function paint() {
    fromArgbRaster(outputImage, composition.displayed);
    p.image(outputImage, 0, 0);
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.filterCalls = String(composition.filterCalls);
    const modeName = ["sharp", "soft", "horizontal", "vertical"][composition.mode];
    status.textContent = `mode ${modeName} · ${composition.blended ? "blended with sharp" : "not blended"} · filter calls ${composition.filterCalls}`;
  }

  function action(name) {
    if (name === "m") composition.cycleMode();
    else if (name === "b") composition.toggleBlended();
    else if (name === "s") { p.saveCanvas("blur-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
