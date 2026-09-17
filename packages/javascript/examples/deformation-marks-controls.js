import { deformationMarksSettings, drawPullMarks, drawProjectionMarks, validateDeformationMarks } from "./deformation-marks-studies.js";

const palettes = [
  [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7],
  [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd],
];

export function mountDeformationMarksStudy(slug) {
  const pull = slug === "pull-marks";
  if (!pull && slug !== "projection-marks") throw Error("Unknown deformation study");
  const defaults = deformationMarksSettings[slug].defaults;
  const initial = { ...defaults, seed: 42, palette: 0 };
  const state = { ...initial };
  const art = document.querySelector("#art"), controls = document.querySelector("#controls"), status = document.querySelector("#status");
  const fields = {};
  let revision = 0;

  const specs = [
    ["sourceMode", "Source paths", "select", ["rows", "columns", "spokes"]],
    ["pathCount", "Paths", "number", 4, 80, 1],
    ["jitter", "Source jitter", "number", 0, 40, "any"],
    ["influenceCount", pull ? "Influences" : "Discs", "select", ["1", "2"]],
    ["centerX1", "First center X", "number", 0, 640, "any"],
    ["centerY1", "First center Y", "number", 0, 640, "any"],
    ["radius1", "First radius", "number", 10, 450, "any"],
    ...(pull ? [["power1", "First falloff", "number", .2, 6, "any"]] : []),
    ["centerX2", "Second center X", "number", 0, 640, "any"],
    ["centerY2", "Second center Y", "number", 0, 640, "any"],
    ["radius2", "Second radius", "number", 10, 450, "any"],
    ...(pull ? [["power2", "Second falloff", "number", .2, 6, "any"]] : []),
    ...(!pull ? [["strength", "Projection strength", "number", 0, 1, "any"]] : []),
    ["weight", "Stroke weight", "number", .1, 12, "any"],
    ["seed", "Seed", "number", 0, 4294967295, 1],
    ["palette", "Palette", "select", ["Garden ink", "Electric ink"]],
  ];
  for (const [key, labelText, kind, a, b, step] of specs) {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement(kind === "select" ? "select" : "input");
    input.name = key;
    if (kind === "select") {
      for (const [index, value] of a.entries()) {
        const option = document.createElement("option");
        option.value = key === "palette" ? String(index) : String(value);
        option.textContent = String(value);
        input.append(option);
      }
    } else {
      input.type = "number";
      input.min = String(a);
      input.max = String(b);
      input.step = String(step);
    }
    label.append(input);
    controls.append(label);
    fields[key] = input;
  }
  for (const [action, label] of [["reset", "Reset"], ["save", "Save PNG"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.textContent = label;
    controls.append(button);
  }

  function syncFields() {
    for (const [key, input] of Object.entries(fields)) input.value = String(state[key]);
    for (const key of ["centerX2", "centerY2", "radius2", "power2"])
      if (fields[key]) fields[key].parentElement.hidden = state.influenceCount === 1;
  }
  function readFields() {
    const next = { ...state };
    for (const [key, input] of Object.entries(fields)) {
      if (input.parentElement.hidden) continue;
      if (!input.validity.valid) {
        status.textContent = `${input.labels?.[0]?.textContent?.trim() ?? key} is outside its accepted range.`;
        return false;
      }
      next[key] = key === "sourceMode" ? input.value : Number(input.value);
    }
    if (!Number.isInteger(next.seed) || next.seed < 0 || next.seed > 4294967295 ||
        !Number.isInteger(next.palette) || next.palette < 0 || next.palette >= palettes.length) {
      status.textContent = "Use a nonnegative integer seed and an available palette.";
      return false;
    }
    try { validateDeformationMarks(next, pull); }
    catch (error) { status.textContent = error.message; return false; }
    Object.assign(state, next);
    syncFields();
    return true;
  }

  const sketch = new window.p5((p) => {
    p.setup = () => { p.createCanvas(640, 640, p.P2D).parent(art); p.pixelDensity(1); p.noLoop(); };
    p.draw = () => {
      try {
        p.clear();
        const draw = pull ? drawPullMarks : drawProjectionMarks;
        draw(p, { params: state, seed: state.seed, palette: palettes[state.palette] });
        art.dataset.renderStatus = "ready";
        art.dataset.revision = String(++revision);
        status.textContent = `${state.sourceMode} · ${state.pathCount} paths · ${state.influenceCount} ${pull ? "pulls" : "discs"} · jitter ${state.jitter}`;
      } catch (error) {
        art.dataset.renderStatus = "error";
        status.textContent = `Could not draw: ${error instanceof Error ? error.message : String(error)}`;
      }
    };
  });
  const render = () => sketch.redraw();
  controls.addEventListener("input", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.type === "number" && readFields()) render();
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
  return { snapshot: () => ({ ...state, revision, renderStatus: art.dataset.renderStatus }) };
}
