import { drawSystemsAQuality } from "./cellular-quality.js";
import { cellularQualitySettings } from "./cellular-quality-settings.js";
import { systemsASettings } from "./systems-a-studies.js";

function control(field, params, edit) {
  const row = document.createElement("label"); row.className = "control";
  const title = document.createElement("span"); title.textContent = field.label; row.append(title);
  if (field.type === "number") {
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = String(field.min); slider.max = String(field.max);
    slider.step = String(field.step); slider.value = String(params[field.key]);
    slider.setAttribute("aria-label", `${field.label} slider`);
    const exact = document.createElement("input");
    exact.type = "number"; exact.min = String(field.hardMin); exact.max = String(field.hardMax);
    exact.step = "any"; exact.value = String(params[field.key]);
    exact.dataset.param = field.key; exact.setAttribute("aria-label", `Exact ${field.label}`);
    slider.addEventListener("input", () => { exact.value = slider.value; edit(field.key, Number(slider.value)); });
    exact.addEventListener("change", () => {
      const value = Number(exact.value);
      if (exact.value.trim() === "" || !Number.isFinite(value) || value < field.hardMin || value > field.hardMax ||
          (field.integer && !Number.isInteger(value))) {
        exact.setCustomValidity("Enter a supported value"); exact.reportValidity(); return;
      }
      exact.setCustomValidity(""); slider.value = String(Math.max(field.min, Math.min(field.max, value)));
      edit(field.key, value);
    });
    row.append(slider, exact);
    row.sync = value => { exact.value = String(value); exact.setCustomValidity("");
      slider.value = String(Math.max(field.min, Math.min(field.max, value))); };
  } else {
    const input = document.createElement("select");
    input.dataset.param = field.key; input.setAttribute("aria-label", field.label);
    for (const value of field.options) { const option = document.createElement("option");
      option.value = value; option.textContent = value; input.append(option); }
    input.value = params[field.key]; input.addEventListener("change", () => edit(field.key, input.value));
    row.append(input); row.sync = value => { input.value = value; };
  }
  return row;
}

export function createCellularStudySketch({ slug, title, legacyDraw }) {
  const settings = cellularQualitySettings[slug];
  if (!settings) throw new Error(`Unknown cellular study ${slug}`);
  const art = document.querySelector("#art"), controls = document.querySelector("#controls"), status = document.querySelector("#status");
  if (!art || !controls || !status) throw new Error("Cellular study page requires art, controls and status");
  const palettes = [[0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7], [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd]];
  let params = { ...settings.defaults }, palette = 0, legacy = false, legacyVariant = false, revision = 0;
  let sketch;
  const rows = settings.controls.map(field => control(field, params, (key, value) => {
    params = { ...params, [key]: value, legacy: false }; legacy = false;
    sync(); sketch.redraw();
  }));
  const panel = document.createElement("div"); panel.className = "parameter-grid"; panel.append(...rows);
  controls.after(panel);
  const legacyButton = controls.querySelector('[data-action="legacy"]');
  const variantButton = controls.querySelector('[data-action="t"]');
  function sync() {
    rows.forEach((row, index) => row.sync(params[settings.controls[index].key]));
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
        const selected = legacy ? { ...systemsASettings[slug].defaults,
          ...(legacyVariant ? systemsASettings[slug].structuralEdit : {}), legacy: true } : params;
        const layer = { id: "native-cellular-study", technique: slug, visible: true, opacity: 1, seed: 42,
          palette: [...palettes[palette]], cutEdits: [], transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params: selected };
        if (legacy) legacyDraw(buffer, layer); else drawSystemsAQuality(buffer, layer);
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
    else if (key === "0") { params = { ...settings.defaults }; palette = 0; legacy = false; legacyVariant = false; }
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
