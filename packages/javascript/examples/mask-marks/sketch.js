import { createMaskMarks } from "./mask-marks.js";

const WIDTH = 720, HEIGHT = 480;

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeMaskMarks() {
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
  g.background(239, 232, 213);
}

function drawSource(g) {
  g.background(21, 62, 75);
  g.noStroke();
  for (let radius = 250; radius > 12; radius -= 18) {
    // Java int division: radius/3 truncates before the 120 offset.
    g.fill(245, 120 + Math.floor(radius / 3), 65);
    g.ellipse(245, 235, radius * 2, radius * 2);
  }
  g.fill(47, 190, 174);
  g.triangle(420, 395, 580, 65, 695, 400);
}

function drawMarks(g) {
  g.background(32, 38, 63);
  g.stroke(235, 116, 116);
  g.strokeWeight(5);
  for (let x = -400; x < 900; x += 22) g.line(x, 0, x + 350, HEIGHT);
}

function drawMask(g) {
  g.clear();
  g.noStroke();
  g.fill(255);
  g.ellipse(245, 240, 360, 320);
  // Half alpha creates partial visibility; RGB does not determine alpha-mask values.
  g.fill(0, 128);
  g.triangle(410, 395, 575, 70, 675, 395);
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
    const source = p.createGraphics(WIDTH, HEIGHT);
    source.pixelDensity(1);
    drawSource(source);
    const marks = p.createGraphics(WIDTH, HEIGHT);
    marks.pixelDensity(1);
    drawMarks(marks);
    const mask = p.createGraphics(WIDTH, HEIGHT);
    mask.pixelDensity(1);
    drawMask(mask);

    composition = createMaskMarks(toArgbRaster(ground), toArgbRaster(source), toArgbRaster(marks), toArgbRaster(mask));
    outputImage = p.createImage(WIDTH, HEIGHT);
    paint();
  };

  function paint() {
    fromArgbRaster(outputImage, composition.displayed);
    // Java's draw(): background(110) then image(displayed); transparent mask
    // regions show the gray ground.
    p.background(110);
    p.image(outputImage, 0, 0);
    revision += 1;
    art.dataset.revision = String(revision);
    const modeName = ["marks over ground", "source over ground", "marks/source crossfade"][composition.mode];
    status.textContent = composition.showMask ? "showing retained mask" : modeName;
  }

  function action(name) {
    if (name === "m") composition.cycleMode();
    else if (name === "v") composition.toggleShowMask();
    else if (name === "s") {
      // Saving never rerenders; it saves the displayed raster (alpha included).
      outputImage.save("mask-marks.png");
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
