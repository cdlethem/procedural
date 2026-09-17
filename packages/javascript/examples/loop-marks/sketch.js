import { P5Frame } from "../../src/internal/p5-frame.js";
import { BACKGROUND_RGB, COLORS, OTHER_COLORS, createLoopMarks, loopFanTriangles, loopTileCommands } from "./loop-marks.js";
import { drawLoopMarksModern, validateLoopMarks } from "./loop-marks-quality.js";
import { loopMarksQualitySettings } from "./loop-marks-quality-settings.js";

const art = document.querySelector("#art"), buttons = document.querySelector("#controls"), status = document.querySelector("#status");
if (!art || !buttons || !status) throw new Error("Loop Marks page requires art, controls and status");
const settings = loopMarksQualitySettings;
let params = { ...settings.defaults }, paletteIndex = 0, legacy = false, legacyMoved = false, legacyFans = false;
let legacyModel = createLoopMarks(false), revision = 0, sketch;

function makeControl(field, edit) {
  const row = document.createElement("label"); row.className = "control";
  const title = document.createElement("span"); title.textContent = field.label; row.append(title);
  if (field.type === "number") {
    const slider = document.createElement("input"); slider.type = "range";
    slider.min = String(field.min); slider.max = String(field.max); slider.step = String(field.step);
    slider.setAttribute("aria-label", `${field.label} slider`);
    const exact = document.createElement("input"); exact.type = "number";
    exact.min = String(field.hardMin ?? field.min); exact.max = String(field.hardMax ?? field.max);
    exact.step = "any"; exact.dataset.param = field.key; exact.setAttribute("aria-label", `Exact ${field.label}`);
    slider.addEventListener("input", () => { exact.value = slider.value; edit(field.key, Number(slider.value)); });
    exact.addEventListener("change", () => {
      const value = Number(exact.value), min = field.hardMin ?? field.min, max = field.hardMax ?? field.max;
      if (exact.value.trim() === "" || !Number.isFinite(value) || value < min || value > max ||
          (field.integer && !Number.isInteger(value))) {
        exact.setCustomValidity("Enter a supported value"); exact.reportValidity(); return;
      }
      const candidate = { ...params, [field.key]: value, legacy: false };
      try { validateLoopMarks(candidate); }
      catch (error) { exact.setCustomValidity(error instanceof Error ? error.message : String(error)); exact.reportValidity(); return; }
      exact.setCustomValidity(""); slider.value = String(Math.max(field.min, Math.min(field.max, value))); edit(field.key, value);
    });
    row.append(slider, exact);
    row.sync = value => { exact.value = String(value); exact.setCustomValidity("");
      slider.value = String(Math.max(field.min, Math.min(field.max, value))); };
  } else if (field.type === "select") {
    const input = document.createElement("select"); input.dataset.param = field.key; input.setAttribute("aria-label", field.label);
    for (const option of field.options) { const element = document.createElement("option");
      element.value = option.value; element.textContent = option.label; input.append(element); }
    input.addEventListener("change", () => edit(field.key, input.value));
    row.append(input); row.sync = value => { input.value = String(value); };
  } else throw new Error(`Unsupported Loop Marks control ${field.key}`);
  return row;
}
const rows = settings.controls.map(field => makeControl(field, (key, value) => {
  const candidate = { ...params, [key]: value, legacy: false };
  try { validateLoopMarks(candidate); }
  catch (error) { status.textContent = `Could not draw: ${error instanceof Error ? error.message : String(error)}`; sync(); return; }
  params = candidate; legacy = false; sync(); sketch.redraw();
}));
const panel = document.createElement("div"); panel.className = "parameter-grid"; panel.append(...rows); buttons.after(panel);
function sync() {
  rows.forEach((row, index) => row.sync(params[settings.controls[index].key]));
  buttons.querySelector('[data-action="legacy"]')?.setAttribute("aria-pressed", String(legacy));
  for (const key of ["t", "m"]) { const button = buttons.querySelector(`[data-action="${key}"]`); if (button) button.hidden = !legacy; }
}

sketch = new window.p5(p => {
  p.setup = () => { p.createCanvas(640, 640, p.P2D).parent(art); p.pixelDensity(1); p.noLoop(); };
  function paintLegacyTiles() {
    const frame = new P5Frame(p); let completed = null;
    try {
      frame.begin({ width: 640, height: 640, density: 1, background: BACKGROUND_RGB });
      let batch = [];
      for (const command of loopTileCommands(legacyModel, paletteIndex === 1)) {
        batch.push(command);
        if (batch.length === 4096) { frame.batch(batch); batch = []; }
      }
      if (batch.length) frame.batch(batch);
      completed = frame.end(); p.image(completed, 0, 0);
    } finally {
      if (completed) P5Frame.releaseCompleted(completed);
      else if (frame.state !== "completed") frame.abort();
    }
  }
  function paintLegacyFans() {
    const rgbColor = rgb => [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255];
    p.background(...rgbColor(BACKGROUND_RGB)); p.noStroke();
    for (const triangle of loopFanTriangles(legacyModel, paletteIndex === 1)) {
      p.fill(...rgbColor(triangle.rgb), triangle.opacity8);
      p.triangle(triangle.cx, triangle.cy, triangle.x1, triangle.y1, triangle.x2, triangle.y2);
    }
  }
  p.draw = () => {
    try {
      p.clear();
      if (legacy) { if (legacyFans) paintLegacyFans(); else paintLegacyTiles(); }
      else {
        const layer = { id: "native-loop-marks", technique: "loop-marks", visible: true, opacity: 1, seed: 42,
          palette: [...(paletteIndex ? OTHER_COLORS : COLORS)], cutEdits: [],
          transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params };
        p.push(); try { drawLoopMarksModern(p, layer); } finally { p.pop(); }
      }
      art.dataset.renderStatus = "ready"; art.dataset.revision = String(++revision);
      status.textContent = `Loop marks · ${legacy ? "original composition" : "editable composition"} · ${paletteIndex ? "alternate" : "base"} palette`;
    } catch (error) {
      art.dataset.renderStatus = "error";
      status.textContent = `Could not draw: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
});

function action(name) {
  if (name === "s") { sketch.saveCanvas("loop-marks", "png"); return; }
  if (name === "c") paletteIndex = 1 - paletteIndex;
  else if (name === "legacy") legacy = !legacy;
  else if (name === "t" && legacy) { legacyMoved = !legacyMoved; legacyModel = createLoopMarks(legacyMoved); }
  else if (name === "m" && legacy) legacyFans = !legacyFans;
  else if (name === "0") { params = { ...settings.defaults }; paletteIndex = 0; legacy = false;
    legacyMoved = false; legacyFans = false; legacyModel = createLoopMarks(false); }
  else return;
  sync(); sketch.redraw();
}
buttons.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button && buttons.contains(button)) action(button.dataset.action);
});
window.addEventListener("keydown", event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat ||
      event.target?.closest?.("input,textarea,select,[contenteditable]")) return;
  const key = event.key.toLowerCase();
  if (["c", "0", "s", "t", "m"].includes(key)) { event.preventDefault(); action(key); }
});
sync();
