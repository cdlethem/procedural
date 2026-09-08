import { createGrainComposition } from "./grain-marks.js";

const defaults = {seed: 42, density: 0.1, distribution: 0,
  strokes: false, alternate: false, cells: false};
const settings = {...defaults};
const palettes = [
  [0x173F5F, 0x9B342F, 0x176B60, 0x634779, 0x805515],
  [0xBA402F, 0x344E75, 0x6B4672, 0x426D35, 0x8C5221],
];
const art = document.querySelector("#art"), status = document.querySelector("#status");
let composition, revision = 0, drawnMarks = 0;
export function observeGrainMarks() {
  return Object.freeze({composition, revision, drawnMarks, settings: Object.freeze({...settings})});
}
function rebuild() {
  composition = createGrainComposition(settings.seed, settings.density, settings.distribution, settings.cells);
}
new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1); p.noLoop(); rebuild(); paint();
  };
  function paint() {
    p.background(243, 240, 232); p.strokeWeight(1);
    const colors = palettes[settings.alternate ? 1 : 0], position = new Float64Array(2);
    drawnMarks = 0;
    for (let region = 0; region < composition.size; region++) {
      const points = composition.regionAt(region), rgb = colors[region % colors.length];
      if (settings.strokes) p.stroke((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 150);
      else { p.noStroke(); p.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255, 150); }
      for (let i = 0; i < points.size; i++) {
        points.pointInto(i, position);
        // Match the Java example's explicit float transport to its renderer.
        const x = Math.fround(position[0]), y = Math.fround(position[1]);
        if (settings.strokes) p.line(Math.fround(x - 2), y, Math.fround(x + 2), y);
        // Explicit one-pixel disks: p5 2.3.2 point uses an epsilon line that
        // collapses at larger Canvas2D coordinates in the pinned browser.
        else p.ellipse(x, y, 1, 1);
        drawnMarks++;
      }
    }
    revision++; art.dataset.revision = String(revision);
    const distribution = ["uniform", "first-vertex concentration", "edge concentration"][settings.distribution];
    status.textContent = `${drawnMarks} points in ${composition.size} triangles · ${distribution}`;
  }
  function action(key) {
    if (key === "s") { p.saveCanvas("grain-marks", "png"); return; }
    if (key === "m") settings.strokes = !settings.strokes;
    else if (key === "c") settings.alternate = !settings.alternate;
    else {
      if (key === "0") Object.assign(settings, defaults);
      else if (key === "r") settings.seed = (settings.seed + 1) >>> 0;
      else if (key === "n") settings.density = settings.density === 0.1 ? 0.2 : 0.1;
      else if (key === "b") settings.distribution = (settings.distribution + 1) % 3;
      else if (key === "x") settings.cells = !settings.cells;
      else return;
      rebuild();
    }
    paint();
  }
  document.querySelector("#controls").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
