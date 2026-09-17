import { drawPathsAQuality } from "./paths-a-quality.js";
import { pathsASettings } from "./paths-a-studies.js";

// Example controls mirror the Studio's slider interval and wider exact-entry domain.
const num = (key, label, min, max, hardMin, hardMax, step = 1, integer = false) =>
  ({ key, label, type: "number", min, max, hardMin, hardMax, step, integer });
const select = (key, label, options) => ({ key, label, type: "select", options });
const check = (key, label) => ({ key, label, type: "check" });
const outline = [
  num("sides", "Sides", 3, 12, 3, 256, 1, true),
  num("notch", "Notch depth", 0, .9, 0, .95, .01),
  num("aspect", "Height ratio", .3, 2, .01, 100, .01),
  num("rotation", "Rotation", -180, 180, -1e6, 1e6),
];
const weight = num("weight", "Stroke weight", 0, 12, 0, 100, .25);

const faceting = (kind, sides, innerRadius, scale, grain, strokeWeight) => ({
  defaults: { scale, grain, weight: strokeWeight, kind, sides, innerRadius, aspect: .9, rotation: 12,
    fillAlpha: 115, showEdges: true, hatchMode: "fan", hatchAlpha: 165, legacy: false },
  controls: [
    num("scale", "Boundary radius", 60, 280, .01, 10000),
    num("grain", "Grain marks", 0, 60, 0, 1000, 1, true), weight,
    select("kind", "Boundary", ["convex", "notched"]),
    num("sides", "Outer sides", 3, 12, 3, 256, 1, true),
    num("innerRadius", "Notch radius", .1, .9, .01, 1, .01),
    num("aspect", "Height ratio", .3, 2, .01, 100, .01),
    num("rotation", "Rotation", -180, 180, -1e6, 1e6),
    num("fillAlpha", "Facet fill", 0, 255, 0, 255, 1, true),
    check("showEdges", "Show facet edges"),
    select("hatchMode", "Grain treatment", ["fan", "dots", "none"]),
    num("hatchAlpha", "Grain opacity", 0, 255, 0, 255, 1, true),
  ],
});

export const pathStudyConfigs = {
  "rounded-panels": {
    defaults: { iterations: 2, panels: 6, weight: 2, sides: 5, notch: .25, aspect: 1, rotation: -18,
      panelSize: 57, columns: 3, gapX: 26, gapY: 34, stagger: .2, treatment: "both", fillAlpha: 95, legacy: false },
    controls: [
      num("iterations", "Corner cuts", 0, 6, 0, 16, 1, true),
      num("panels", "Panels", 1, 16, 1, 1000, 1, true), weight, ...outline,
      num("panelSize", "Panel radius", 20, 130, .01, 10000),
      num("columns", "Columns", 1, 8, 1, 1000, 1, true),
      num("gapX", "Column gap", -120, 180, -10000, 10000),
      num("gapY", "Row gap", -120, 180, -10000, 10000),
      num("stagger", "Row stagger", -1, 1, -100, 100, .01),
      select("treatment", "Treatment", ["outline", "fill", "both"]),
      num("fillAlpha", "Fill opacity", 0, 255, 0, 255, 1, true),
    ],
  },
  "road-margins": {
    defaults: { distance: 12, routes: 5, weight: 2, turns: 10, amplitude: 46, frequency: 1.25,
      phase: 15, routeSpacing: 103, iterations: 2, miterLimit: 2,
      showCenterline: false, showEdges: true, bothSides: true, showNodes: false, legacy: false },
    controls: [
      num("distance", "Signed margin", -40, 40, -10000, 10000),
      num("routes", "Routes", 1, 12, 1, 1000, 1, true), weight,
      num("turns", "Turns", 1, 32, 1, 1000, 1, true),
      num("amplitude", "Bend amplitude", -130, 130, -10000, 10000),
      num("frequency", "Bend cycles", -3, 5, -1000, 1000, .05),
      num("phase", "Bend phase", -180, 180, -1e6, 1e6),
      num("routeSpacing", "Route spacing", -160, 160, -10000, 10000),
      num("iterations", "Route smoothing", 0, 5, 0, 16, 1, true),
      num("miterLimit", "Join limit", 1, 8, 1, 1000, .1),
      check("showCenterline", "Show centerlines"), check("showEdges", "Show margin edges"),
      check("bothSides", "Both sides"), check("showNodes", "Show waypoints"),
    ],
  },
  "nested-contour-strokes": {
    defaults: { distance: 12, rings: 8, weight: 2, sides: 7, notch: .25, aspect: .85, rotation: 12,
      scale: 198, startOffset: 0, miterLimit: 2, marks: "outline", dotSize: 4, alpha: 190, legacy: false },
    controls: [
      num("distance", "Signed ring gap", -40, 40, -10000, 10000),
      num("rings", "Rings", 1, 16, 1, 1000, 1, true), weight, ...outline,
      num("scale", "Boundary radius", 50, 280, .01, 10000),
      num("startOffset", "Starting offset", -100, 100, -10000, 10000),
      num("miterLimit", "Join limit", 1, 8, 1, 1000, .1),
      select("marks", "Ring marks", ["outline", "dots", "both"]),
      num("dotSize", "Vertex size", 0, 12, 0, 1000, .25),
      num("alpha", "Mark opacity", 0, 255, 0, 255, 1, true),
    ],
  },
  "faceted-silhouettes": faceting("convex", 7, .65, 205, 16, 2),
  "concave-grain": faceting("notched", 6, .48, 215, 24, 1.5),
};

function makeControl(field, params, update) {
  const row = document.createElement("label");
  row.className = "control";
  const title = document.createElement("span");
  title.textContent = field.label;
  row.append(title);
  if (field.type === "number") {
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = String(field.min); slider.max = String(field.max);
    slider.step = String(field.step); slider.value = String(params[field.key]);
    slider.setAttribute("aria-label", `${field.label} slider`);
    const exact = document.createElement("input");
    exact.type = "number"; exact.min = String(field.hardMin); exact.max = String(field.hardMax);
    exact.step = "any"; exact.value = String(params[field.key]);
    exact.setAttribute("aria-label", `Exact ${field.label}`);
    exact.dataset.param = field.key;
    slider.addEventListener("input", () => { exact.value = slider.value; update(field, Number(slider.value)); });
    exact.addEventListener("change", () => {
      const value = Number(exact.value);
      if (exact.value.trim() === "" || !Number.isFinite(value) || value < field.hardMin || value > field.hardMax ||
          (field.integer && !Number.isInteger(value))) { exact.setCustomValidity("Enter a supported value"); exact.reportValidity(); return; }
      exact.setCustomValidity("");
      slider.value = String(Math.max(field.min, Math.min(field.max, value)));
      update(field, value);
    });
    row.append(slider, exact);
    row.sync = (value) => { slider.value = String(Math.max(field.min, Math.min(field.max, value))); exact.value = String(value); exact.setCustomValidity(""); };
  } else if (field.type === "select") {
    const input = document.createElement("select");
    input.setAttribute("aria-label", field.label); input.dataset.param = field.key;
    for (const option of field.options) { const element = document.createElement("option"); element.value = option; element.textContent = option; input.append(element); }
    input.value = params[field.key]; input.addEventListener("change", () => update(field, input.value));
    row.append(input); row.sync = (value) => { input.value = value; };
  } else {
    const input = document.createElement("input");
    input.type = "checkbox"; input.checked = params[field.key]; input.dataset.param = field.key;
    input.setAttribute("aria-label", field.label); input.addEventListener("change", () => update(field, input.checked));
    row.append(input); row.sync = (value) => { input.checked = value; };
  }
  return row;
}

export function createPathStudySketch({ slug, title, legacyDraw }) {
  const config = pathStudyConfigs[slug];
  if (!config) throw new Error(`Unknown path study ${slug}`);
  const art = document.querySelector("#art"), controls = document.querySelector("#controls"), status = document.querySelector("#status");
  if (!art || !controls || !status) throw new Error("Path study page requires art, controls and status");
  const palettes = [[0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7], [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd]];
  let params = { ...config.defaults }, palette = 0, legacy = false, legacyVariant = false, revision = 0;
  let sketch;
  const rows = config.controls.map(field => makeControl(field, params, (_field, value) => {
    params = { ...params, [_field.key]: value, legacy: false }; legacy = false;
    sketch.redraw();
  }));
  const panel = document.createElement("div"); panel.className = "parameter-grid"; panel.append(...rows);
  controls.after(panel);
  const legacyButton = controls.querySelector('[data-action="legacy"]');
  const variantButton = controls.querySelector('[data-action="t"]');
  function sync() {
    rows.forEach((row, index) => row.sync(params[config.controls[index].key]));
    legacyButton?.setAttribute("aria-pressed", String(legacy));
    if (variantButton) variantButton.hidden = !legacy;
  }
  sketch = new window.p5(p => {
    p.setup = () => { p.createCanvas(640, 640, p.P2D).parent(art); p.pixelDensity(1); p.noLoop(); };
    p.draw = () => {
      const buffer = p.createGraphics(640, 640, p.P2D);
      buffer.pixelDensity(1); buffer.clear();
      for (const key of ["CLOSE", "CORNER", "CENTER", "ROUND", "TRIANGLES"]) buffer[key] = p[key];
      try {
        const selected = legacy ? { ...pathsASettings[slug].defaults,
          ...(legacyVariant ? pathsASettings[slug].structuralEdit : {}), legacy: true } : params;
        const layer = { id: "native-study", technique: slug, visible: true, opacity: 1, seed: 42,
          palette: [...palettes[palette]], cutEdits: [], transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params: selected };
        if (legacy) legacyDraw(buffer, layer); else drawPathsAQuality(buffer, layer);
        p.clear(); p.image(buffer, 0, 0, 640, 640);
        art.dataset.revision = String(++revision); art.dataset.renderStatus = "ready";
        status.textContent = `${title} · ${legacy ? (legacyVariant ? "original variant" : "original composition") : "editable composition"} · seed 42`;
      } catch (error) {
        art.dataset.renderStatus = "error";
        status.textContent = `Could not draw: ${error instanceof Error ? error.message : String(error)}`;
      } finally { buffer.remove(); }
    };
  });
  function action(key) {
    if (key === "s") { sketch.saveCanvas(slug, "png"); return; }
    if (key === "c") palette = 1 - palette;
    else if (key === "legacy") { legacy = !legacy; legacyVariant = false; }
    else if (key === "t") { if (!legacy) return; legacyVariant = !legacyVariant; }
    else if (key === "0") { params = { ...config.defaults }; palette = 0; legacy = false; legacyVariant = false; }
    else return;
    sync(); sketch.redraw();
  }
  controls.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (button && controls.contains(button)) action(button.dataset.action);
  });
  window.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.target?.closest?.("input,textarea,select,[contenteditable]")) return;
    const key = event.key.toLowerCase();
    if (["c", "0", "s", "t"].includes(key)) { event.preventDefault(); action(key); }
  });
  sync();
  return sketch;
}
