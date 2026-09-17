import { weightedRasterPoints2D } from "../../src/weighted-raster-points-2d.js";
import { weightedRasterCentroids2D } from "../../src/weighted-raster-centroids-2d.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const WIDTH = 80, HEIGHT = 100;
const defaults = { inverted: false, many: false, relaxed: false, thermal: false, stitches: false, ochre: false };
const settings = { ...defaults };
let model, sourceImage, revision = 0;

const clamp = (value) => Math.max(0, Math.min(1, value));
function relief(x, y) {
  const ridge = 0.42 + 0.17 * Math.sin(9 * y) + 0.05 * Math.sin(27 * y);
  const crest = Math.exp(-Math.pow((x - ridge) / 0.15, 2));
  const shoulder = 0.6 * Math.exp(-Math.pow((x - 0.78) / 0.20, 2) - Math.pow((y - 0.25) / 0.28, 2));
  const basin = 0.5 * Math.exp(-Math.pow((x - 0.23) / 0.11, 2) - Math.pow((y - 0.70) / 0.19, 2));
  return clamp(0.08 + 0.65 * crest + shoulder - basin);
}
function thermal(x, y) {
  const plumeA = Math.exp(-Math.pow((x - 0.23) / 0.18, 2) - Math.pow((y - 0.25) / 0.25, 2));
  const plumeB = 0.85 * Math.exp(-Math.pow((x - 0.73) / 0.16, 2) - Math.pow((y - 0.68) / 0.20, 2));
  const bridge = 0.30 * Math.exp(-Math.pow((y - (0.58 - 0.22 * x)) / 0.09, 2));
  return clamp(0.04 + plumeA + plumeB + bridge);
}
function densityImage(p) {
  const source = settings.thermal ? thermal : relief;
  const tones = new Array(WIDTH * HEIGHT), weights = new Array(WIDTH * HEIGHT);
  const preview = p.createImage(WIDTH, HEIGHT);
  preview.loadPixels();
  for (let row = 0; row < HEIGHT; row += 1) for (let column = 0; column < WIDTH; column += 1) {
    const index = row * WIDTH + column;
    const tone = source((column + 0.5) / WIDTH, (row + 0.5) / HEIGHT);
    tones[index] = tone;
    weights[index] = Math.round(1200 * Math.max(0, ((settings.inverted ? 1 - tone : tone) - 0.12) / 0.88));
    const shade = Math.round(242 - 179 * tone), pixel = index * 4;
    preview.pixels[pixel] = shade;
    preview.pixels[pixel + 1] = shade + (settings.thermal ? 0 : 3);
    preview.pixels[pixel + 2] = shade + (settings.thermal ? 2 : 5);
    preview.pixels[pixel + 3] = 255;
  }
  preview.updatePixels();
  return { tones, weights, preview };
}

new window.p5((p) => {
  p.setup = () => { p.createCanvas(720, 560).parent(art); p.pixelDensity(1); p.noLoop(); paint(); };
  function paint() {
    const { tones, weights, preview } = densityImage(p);
    sourceImage = preview;
    const count = settings.many ? 700 : 420;
    const sampled = weightedRasterPoints2D({ width: WIDTH, height: HEIGHT, weights, count, rngState: 20260917, maxWork: 10000000 });
    let points = sampled.points, masses = null;
    if (settings.relaxed) {
      const moved = weightedRasterCentroids2D({ width: WIDTH, height: HEIGHT, weights, sites: points, maxWork: 12000000 });
      points = moved.sites; masses = moved.masses;
    }
    model = { width: WIDTH, height: HEIGHT, weights, points, pixelIndices: sampled.pixelIndices, rngState: sampled.rngState, masses };
    p.background("#f7f3ea");
    p.noStroke(); p.fill("#253943"); p.textSize(15); p.textStyle(p.BOLD);
    p.text("IMAGE MASS  /  EDITABLE MARKS", 42, 38); p.textStyle(p.NORMAL);
    p.textSize(11); p.text("SOURCE / " + (settings.thermal ? "THERMAL" : "RELIEF"), 44, 83);
    p.text("WEIGHTED POSITIONS", 389, 83);
    p.stroke("#889997"); p.strokeWeight(1); p.noFill();
    p.rect(42, 99, 280, 350); p.rect(386, 99, 280, 350);
    p.noStroke(); p.image(sourceImage, 43, 100, 278, 348);
    p.fill("#f1eee5"); p.rect(387, 100, 278, 348);
    p.stroke(settings.ochre ? "#a25036" : "#203f4a");
    p.fill(settings.ochre ? "#b76645" : "#245665");
    for (const [x, y] of points) {
      const px = 387 + x * 278 / WIDTH, py = 100 + y * 348 / HEIGHT;
      if (settings.stitches) { p.strokeWeight(1.35); p.line(px - 3.4, py + 2.5, px + 3.4, py - 2.5); }
      else { p.noStroke(); p.circle(px, py, 3.6); }
    }
    p.noStroke(); p.fill("#41545b"); p.textSize(12);
    p.text(settings.inverted ? "LIGHT SOURCE AREAS ATTRACT MARKS" : "DARK SOURCE AREAS ATTRACT MARKS", 44, 478);
    p.text(`${count} marks · ${settings.relaxed ? "one weighted step" : "sampled positions"}`, 389, 478);
    p.text("Dots and stitches reuse the same sampled point positions.", 44, 513);
    revision += 1;
    art.dataset.renderStatus = "ready"; art.dataset.revision = String(revision);
    status.textContent = `${settings.thermal ? "Thermal" : "Relief"} input · ${count} ${settings.stitches ? "stitches" : "dots"} · ${settings.relaxed ? "one centroid step" : "sampling only"} · ${settings.inverted ? "inverted" : "base"} density`;
    window.weightedImageStudy = { snapshot: () => structuredClone({ settings, sourceKind: settings.thermal ? "thermal" : "relief", tones, model }) };
  }
  function action(key) {
    if (key === "d") settings.inverted = !settings.inverted;
    else if (key === "n") settings.many = !settings.many;
    else if (key === "r") settings.relaxed = !settings.relaxed;
    else if (key === "t") settings.thermal = !settings.thermal;
    else if (key === "m") settings.stitches = !settings.stitches;
    else if (key === "i") settings.ochre = !settings.ochre;
    else if (key === "0") Object.assign(settings, defaults);
    else if (key === "s") { p.saveCanvas("weighted-image-atlas", "png"); return; }
    else return;
    paint();
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(p.key.toLowerCase());
}, art);
