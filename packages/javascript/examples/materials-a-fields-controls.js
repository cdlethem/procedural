import { materialsASettings } from "./materials-a-studies.js";

const number = (key, label, min, max, step, hardMin = min, hardMax = max, integer = false) =>
  ({ key, label, type: "number", min, max, step, hardMin, hardMax, integer });
const select = (key, label, options) => ({ key, label, type: "select", options });
const check = (key, label) => ({ key, label, type: "check" });

const configs = {
  "quantized-stripes": [
    number("stripes", "Stripes", 8, 52, 1, 8, 52, true),
    number("count", "Colors", 2, 10, 1, 2, 10, true),
    number("bandCoverage", "Band coverage", 0, 1, .01),
  ],
  "perceptual-bands": [
    number("bands", "Bands", 6, 40, 1, 6, 40, true),
    number("phase", "Edge phase", 0, 6.28, .01, -1e6, 1e6),
    number("bandCoverage", "Band coverage", 0, 1, .01),
  ],
  "reduced-mosaic": [
    number("scale", "Cell size", 12, 20, .1),
    number("count", "Colors", 2, 10, 1, 2, 10, true),
    select("fieldMask", "Show source values", ["all", "high", "low"]),
    number("maskThreshold", "Source cutoff", 0, 1, .01),
  ],
  "nearest-feature-mosaic": [
    number("scale", "Cell size", 8, 20, .1),
    number("features", "Features", 4, 30, 1, 4, 30, true),
    select("display", "Region display", ["regions", "boundaries", "both"]),
    number("boundaryWidth", "Boundary width", 0, 6, .1, 0, 30),
    check("showSites", "Show sites"),
    number("siteSize", "Site size", 0, 12, .1, 0, 50),
  ],
};

function makeControl(field, params, change) {
  const row = document.createElement("label");
  row.className = "control";
  const name = document.createElement("span");
  name.textContent = field.label;
  row.append(name);
  if (field.type === "number") {
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = String(field.min); slider.max = String(field.max);
    slider.step = String(field.step); slider.value = String(params[field.key]);
    slider.setAttribute("aria-label", `${field.label} slider`);
    const exact = document.createElement("input");
    exact.type = "number"; exact.min = String(field.hardMin); exact.max = String(field.hardMax);
    exact.step = field.integer ? "1" : "any"; exact.value = String(params[field.key]);
    exact.setAttribute("aria-label", `Exact ${field.label}`); exact.dataset.param = field.key;
    slider.addEventListener("input", () => { exact.value = slider.value; change(field.key, Number(slider.value)); });
    exact.addEventListener("change", () => {
      const value = Number(exact.value);
      if (exact.value.trim() === "" || !Number.isFinite(value) || value < field.hardMin || value > field.hardMax ||
          (field.integer && !Number.isInteger(value))) {
        exact.setCustomValidity("Enter a supported value"); exact.reportValidity(); return;
      }
      exact.setCustomValidity(""); slider.value = String(Math.max(field.min, Math.min(field.max, value)));
      change(field.key, value);
    });
    row.append(slider, exact);
    row.sync = value => { slider.value = String(Math.max(field.min, Math.min(field.max, value))); exact.value = String(value); exact.setCustomValidity(""); };
  } else if (field.type === "select") {
    const input = document.createElement("select"); input.dataset.param = field.key;
    input.setAttribute("aria-label", field.label);
    for (const option of field.options) { const item = document.createElement("option"); item.value = option; item.textContent = option; input.append(item); }
    input.value = params[field.key]; input.addEventListener("change", () => change(field.key, input.value));
    row.append(input); row.sync = value => { input.value = value; };
  } else {
    const input = document.createElement("input"); input.type = "checkbox"; input.dataset.param = field.key;
    input.checked = params[field.key]; input.setAttribute("aria-label", field.label);
    input.addEventListener("change", () => change(field.key, input.checked));
    row.append(input); row.sync = value => { input.checked = value; };
  }
  return row;
}

export function createFieldStudySketch({ slug, title, draw }) {
  const fields = configs[slug], settings = materialsASettings[slug];
  if (!fields || !settings) throw Error(`Unknown material field ${slug}`);
  const art = document.querySelector("#art"), controls = document.querySelector("#controls"), status = document.querySelector("#status");
  if (!art || !controls || !status) throw Error("Study page requires art, controls and status");
  const palettes = [[0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7], [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd]];
  let params = { ...settings.defaults }, palette = 0, revision = 0, sketch;
  const rows = fields.map(field => makeControl(field, params, (key, value) => { params = { ...params, [key]: value }; sketch.redraw(); }));
  const panel = document.createElement("div"); panel.className = "parameter-grid"; panel.append(...rows); controls.after(panel);
  const sync = () => rows.forEach((row, index) => row.sync(params[fields[index].key]));
  sketch = new window.p5(p => {
    p.setup = () => { p.createCanvas(640, 640, p.P2D).parent(art); p.pixelDensity(1); p.noLoop(); };
    p.draw = () => {
      const buffer = p.createGraphics(640, 640, p.P2D); buffer.pixelDensity(1); buffer.clear();
      try {
        draw(buffer, { id: "native-study", technique: slug, visible: true, opacity: 1, seed: 42,
          palette: [...palettes[palette]], cutEdits: [],
          transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params });
        p.clear(); p.image(buffer, 0, 0, 640, 640);
        art.dataset.revision = String(++revision); art.dataset.renderStatus = "ready";
        status.textContent = `${title} · seed 42 · transparent layer`;
      } catch (error) {
        art.dataset.renderStatus = "error";
        status.textContent = `Could not draw: ${error instanceof Error ? error.message : String(error)}`;
      } finally { buffer.remove(); }
    };
  });
  function action(key) {
    if (key === "s") { sketch.saveCanvas(slug, "png"); return; }
    if (key === "c") palette = 1 - palette;
    else if (key === "t") params = { ...params, ...settings.structuralEdit };
    else if (key === "0") { params = { ...settings.defaults }; palette = 0; }
    else return;
    sync(); sketch.redraw();
  }
  controls.addEventListener("click", event => { const button = event.target.closest("button[data-action]"); if (button && controls.contains(button)) action(button.dataset.action); });
  window.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target?.closest?.("input,textarea,select,[contenteditable]")) return;
    const key = event.key.toLowerCase(); if (["t","c","0","s"].includes(key)) { event.preventDefault(); action(key); }
  });
  sync(); return sketch;
}
