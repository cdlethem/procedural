import { buildPathClipComposition, PATH_CLIP_COLORS, PATH_CLIP_DEFAULTS } from "./path-clip-quality.js";

const art = document.querySelector("#art");
const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const specs = [
  { key: "sourceMode", label: "Source paths", options: ["rows", "wander", "fan"] },
  { key: "pathCount", label: "Paths", min: 1, max: 80, step: 1 },
  { key: "steps", label: "Segments per path", min: 2, max: 160, step: 1 },
  { key: "wander", label: "Wander", min: 0, max: 80, step: .5, only: "wander" },
  { key: "seed", label: "Wander seed", min: 0, max: 4294967295, step: 1, only: "wander" },
  { key: "regionMode", label: "Clip boundary", options: ["rectangle", "portal", "bay", "regular"] },
  { key: "centerX", label: "Boundary center X", min: -320, max: 960, step: 5 },
  { key: "centerY", label: "Boundary center Y", min: -320, max: 960, step: 5 },
  { key: "regionWidth", label: "Boundary width", min: 10, max: 1000, step: 5 },
  { key: "regionHeight", label: "Boundary height", min: 10, max: 1000, step: 5 },
  { key: "notchWidth", label: "Notch opening", min: 0, max: 1000, step: 5, only: "notch" },
  { key: "notchDepth", label: "Notch depth", min: 0, max: 1000, step: 5, only: "notch" },
  { key: "sides", label: "Polygon sides", min: 3, max: 12, step: 1, only: "regular" },
  { key: "angle", label: "Polygon angle", min: -180, max: 180, step: 5, only: "regular" },
  { key: "weight", label: "Stroke weight", min: .1, max: 12, step: .1 },
  { key: "showOutline", label: "Show boundary", checkbox: true },
];
const fields = new Map();
let settings = { ...PATH_CLIP_DEFAULTS };
let composition;
let revision = 0;
let sketch;

for (const spec of specs) {
  const label = document.createElement("label");
  label.textContent = spec.label;
  label.dataset.only = spec.only ?? "";
  const input = document.createElement(spec.options ? "select" : "input");
  input.name = spec.key;
  input.setAttribute("aria-label", spec.label);
  if (spec.options) {
    for (const value of spec.options) {
      const option = document.createElement("option");
      option.value = value; option.textContent = value;
      input.append(option);
    }
  } else {
    input.type = spec.checkbox ? "checkbox" : "number";
    if (!spec.checkbox) {
      input.min = String(spec.min); input.max = String(spec.max); input.step = String(spec.step);
    }
  }
  label.append(input);
  controls.append(label);
  fields.set(spec.key, input);
}
for (const [action, name] of [["reset", "Reset defaults"], ["reload", "Reload"], ["save", "Save transparent PNG"]]) {
  const button = document.createElement("button");
  button.type = "button"; button.dataset.action = action; button.textContent = name;
  controls.append(button);
}

function writeFields() {
  for (const spec of specs) {
    const input = fields.get(spec.key);
    if (spec.checkbox) input.checked = settings[spec.key];
    else input.value = String(settings[spec.key]);
  }
  showRelevantFields();
}

function showRelevantFields() {
  for (const spec of specs) {
    const input = fields.get(spec.key);
    const only = spec.only;
    input.parentElement.hidden = only === "wander" && settings.sourceMode !== "wander" ||
      only === "notch" && !["portal", "bay"].includes(settings.regionMode) ||
      only === "regular" && settings.regionMode !== "regular";
  }
}

function readFields() {
  const next = {};
  for (const spec of specs) {
    const input = fields.get(spec.key);
    next[spec.key] = spec.checkbox ? input.checked : spec.options ? input.value :
      input.value.trim() === "" ? NaN : Number(input.value);
  }
  return next;
}

function channels(rgb) { return [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255]; }

function paint() {
  try {
    const next = readFields();
    const built = buildPathClipComposition(next);
    settings = next;
    composition = built;
    showRelevantFields();
    sketch.clear();
    sketch.noFill();
    sketch.strokeWeight(settings.weight);
    const piece = [0, 0, 0, 0];
    for (let i = 0; i < built.clipped.size; i++) {
      built.clipped.segmentInto(i, piece, 0);
      const path = Math.floor(built.clipped.sourceIndexAt(i) / settings.steps);
      sketch.stroke(...channels(PATH_CLIP_COLORS[path % PATH_CLIP_COLORS.length]));
      sketch.line(...piece);
    }
    if (settings.showOutline) {
      sketch.stroke(...channels(PATH_CLIP_COLORS.at(-1)), 150);
      sketch.strokeWeight(Math.min(settings.weight, 2));
      sketch.beginShape();
      for (const [x, y] of built.polygon) sketch.vertex(x, y);
      sketch.endShape(sketch.CLOSE);
    }
    revision++;
    art.dataset.revision = String(revision);
    art.dataset.renderStatus = "ready";
    art.dataset.clippedSize = String(built.clipped.size);
    art.dataset.sourceSize = String(built.sources.length);
    status.textContent = `${built.clipped.size} retained pieces from ${built.sources.length} source segments · ${settings.sourceMode} through ${settings.regionMode}`;
  } catch (error) {
    art.dataset.renderStatus = "error";
    status.textContent = error.message;
  }
}

controls.addEventListener("change", event => {
  if (event.target.matches("input,select")) paint();
});
controls.addEventListener("click", event => {
  const action = event.target.closest("button[data-action]")?.dataset.action;
  if (action === "reset") { settings = { ...PATH_CLIP_DEFAULTS }; writeFields(); paint(); }
  else if (action === "reload") location.reload();
  else if (action === "save") sketch.saveCanvas("path-clip-marks", "png");
});

window.pathClipMarksStudy = Object.freeze({
  get settings() { return { ...settings }; },
  get composition() { return composition; },
  get revision() { return revision; },
});

new window.p5((p) => {
  sketch = p;
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    writeFields();
    paint();
  };
}, art);
