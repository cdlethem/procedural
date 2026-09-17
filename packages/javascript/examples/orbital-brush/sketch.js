import { CANVAS, palette, rgb } from "../motif-compositions/compositions.js";
import { orbitalBrushRecords, spacedSampleIndices, validateOrbitalRecordInput } from "../motif-compositions/orbital-records.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const defaults = Object.freeze({
  source: "wave", centerX: 360, centerY: 360, centerStepX: 0, centerStepY: 0,
  radiusX: 92, radiusY: 58, paths: 7, radialSpacing: 26, angle: 0, angleStep: 19,
  lobes: 3, depth: 0.18, samples: 144, marks: "beads", markSize: 1.5,
  markSpacing: 12, markOpacity: 180, guides: false, paletteId: "mauve-mist",
});
let settings = { ...defaults };
let paths = [];
let revision = 0;

export function observeOrbitalBrush() {
  return Object.freeze({ paths: structuredClone(paths), settings: Object.freeze({ ...settings }), revision });
}

function checked(next) {
  for (const key of ["paths", "lobes", "samples", "markOpacity"])
    if (!Number.isSafeInteger(next[key])) throw new Error(`${key} must be a whole number.`);
  if (next.paths < 1 || next.paths > 2048 || next.lobes < 1 || next.lobes > 2048 ||
      next.samples < 1 || next.samples > 16384 || next.markOpacity < 0 || next.markOpacity > 255)
    throw new Error("A count or opacity is outside its safety domain.");
  for (const key of ["centerX", "centerY", "centerStepX", "centerStepY", "radiusX", "radiusY",
    "radialSpacing", "angle", "angleStep", "depth", "markSize", "markSpacing"])
    if (!Number.isFinite(next[key])) throw new Error(`${key} must be finite.`);
  if (Math.abs(next.centerX) > 10000 || Math.abs(next.centerY) > 10000 ||
      Math.abs(next.centerStepX) > 10000 || Math.abs(next.centerStepY) > 10000 ||
      next.radiusX < 0 || next.radiusX > 10000 || next.radiusY < 0 || next.radiusY > 10000 ||
      Math.abs(next.radialSpacing) > 10000 || Math.abs(next.angle) > 36000 ||
      Math.abs(next.angleStep) > 36000 || Math.abs(next.depth) > 100 ||
      next.markSize < 0 || next.markSize > 10000 || next.markSpacing < 0 || next.markSpacing > 10000)
    throw new Error("A drawing value is outside its safety domain.");
  validateOrbitalRecordInput(next);
  return next;
}

function syncControls() {
  for (const input of controls.querySelectorAll("[data-key]")) {
    const value = settings[input.dataset.key];
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = String(value);
  }
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(CANVAS, CANVAS, p.P2D).parent(art);
    p.pixelDensity(1);
    p.noLoop();
    syncControls();
    paint();
  };

  function paint() {
    const started = performance.now();
    paths = orbitalBrushRecords({ params: settings });
    const colors = palette(settings.paletteId);
    p.clear();
    for (const path of paths) {
      const ink = rgb(colors[path.colorIndex % colors.length]);
      if (settings.guides) {
        p.noFill();
        p.stroke(...ink, 65);
        p.strokeWeight(0.7);
        p.beginShape();
        for (const point of path.points) p.vertex(...point);
        p.endShape(p.CLOSE);
      }
      if (settings.marks === "ribbons") {
        p.noFill();
        p.stroke(...ink, settings.markOpacity);
        p.strokeCap(p.ROUND);
        p.strokeWeight(settings.markSize);
        p.beginShape();
        for (const point of path.points) p.vertex(...point);
        p.endShape(p.CLOSE);
        continue;
      }
      const indices = spacedSampleIndices(path, settings.markSpacing);
      p.stroke(...ink, settings.markOpacity);
      p.fill(...ink, settings.markOpacity);
      p.strokeCap(p.ROUND);
      p.strokeWeight(Math.min(2, settings.markSize / 3));
      for (const index of indices) {
        const point = path.points[index];
        if (settings.marks === "beads") {
          p.noStroke();
          p.circle(point[0], point[1], settings.markSize);
          continue;
        }
        const previous = path.points[(index + path.points.length - 1) % path.points.length];
        const next = path.points[(index + 1) % path.points.length];
        const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.hypot(dx, dy);
        if (length === 0) {
          p.circle(point[0], point[1], settings.markSize);
          continue;
        }
        const half = settings.markSize / (2 * length);
        p.line(point[0] - dy * half, point[1] + dx * half,
          point[0] + dy * half, point[1] - dx * half);
      }
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.anchors = JSON.stringify(paths.map((path) => path.points));
    art.dataset.geometry = JSON.stringify(paths);
    art.dataset.renderStatus = "ready";
    art.dataset.drawMs = String(performance.now() - started);
    status.textContent = `${paths.length} equal-distance paths · ${settings.marks} · transparent layer`;
  }

  controls.addEventListener("change", (event) => {
    const input = event.target.closest("[data-key]");
    if (!input) return;
    const key = input.dataset.key;
    const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
    try {
      if (input.type === "number" && input.value.trim() === "") throw new Error(`${key} needs a value.`);
      settings = checked({ ...settings, [key]: value });
      paint();
    } catch (error) {
      status.textContent = error.message;
      syncControls();
    }
  });
  controls.addEventListener("click", (event) => {
    const action = event.target.closest("button[data-action]")?.dataset.action;
    if (action === "reset") {
      settings = { ...defaults };
      syncControls();
      paint();
    } else if (action === "save") p.saveCanvas("orbital-brush", "png");
  });
  p.keyPressed = () => {
    const key = String(p.key).toLowerCase();
    if (key === "0") {
      settings = { ...defaults };
      syncControls();
      paint();
    } else if (key === "s") p.saveCanvas("orbital-brush", "png");
  };
}, art);
