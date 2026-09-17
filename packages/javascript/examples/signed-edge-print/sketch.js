import { drawSignedEdgePrint, materialsASettings } from "../materials-a-studies.js";

const slug = "signed-edge-print";
const defaults = materialsASettings[slug].defaults;
const art = document.querySelector("#art");
const controls = document.querySelector("#controls");
const status = document.querySelector("#status");
const fields = Object.fromEntries(["source", "axis", "treatment", "scale", "cutoff", "seed", "palette"]
  .map((name) => [name, controls.elements.namedItem(name)]));
const palettes = [
  [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7],
  [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd],
];
const initial = { ...defaults, seed: 42, palette: 0 };
const state = { ...initial };
let revision = 0;
let sketch;

function syncFields() {
  for (const [name, input] of Object.entries(fields)) input.value = String(state[name]);
}
function readFields() {
  for (const input of Object.values(fields)) if (!input.validity.valid) {
    status.textContent = `${input.labels?.[0]?.textContent?.trim() ?? input.name} is outside its accepted range.`;
    return false;
  }
  const scale = Number(fields.scale.value), cutoff = Number(fields.cutoff.value), seed = Number(fields.seed.value);
  if (!Number.isInteger(scale) || scale < 4 || scale > 120 || !Number.isFinite(cutoff) || cutoff < 0 || cutoff > 4 || !Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    status.textContent = "Use pixel size 4–120, edge cutoff 0–4, and a nonnegative integer seed.";
    return false;
  }
  Object.assign(state, {
    source: fields.source.value, axis: fields.axis.value, treatment: fields.treatment.value,
    scale, cutoff, seed, palette: Number(fields.palette.value),
  });
  return true;
}
function render() { sketch.redraw(); }
sketch = new window.p5((p) => {
  p.setup = () => { p.createCanvas(640, 640, p.P2D).parent(art); p.pixelDensity(1); p.noLoop(); };
  p.draw = () => {
    try {
      p.clear();
      drawSignedEdgePrint(p, {
        id: slug, technique: slug, visible: true, opacity: 1,
        seed: state.seed, palette: [...palettes[state.palette]], cutEdits: [],
        transform: { x: 320, y: 320, scale: 1, rotation: 0 },
        params: { scale: state.scale, cutoff: state.cutoff, source: state.source, axis: state.axis, treatment: state.treatment },
      });
      art.dataset.renderStatus = "ready";
      art.dataset.revision = String(++revision);
      status.textContent = `${state.source} · ${state.axis} response · ${state.treatment} · pixel size ${state.scale} · cutoff ${state.cutoff}`;
    } catch (error) {
      art.dataset.renderStatus = "error";
      status.textContent = `Could not draw: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
});
controls.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === "number") {
    if (readFields()) render();
  }
});
controls.addEventListener("change", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === "number") return;
  if (readFields()) render();
});
controls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "reset") { Object.assign(state, initial); syncFields(); render(); }
  else if (button.dataset.action === "save") sketch.saveCanvas(slug, "png");
});
syncFields();
window.signedEdgePrintStudy = { snapshot: () => ({ ...state, revision, renderStatus: art.dataset.renderStatus }) };
