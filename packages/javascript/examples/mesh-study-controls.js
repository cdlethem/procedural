/** Native Canvas2D controls for the six editable projected-mesh examples. */
const numeric = (label, min, max, integer = false) => ({ label, type: "number", min, max, integer });
const select = (label, options) => ({ label, type: "select", options });
const fields = {
  footprint: select("Footprint", ["beveled", "stepped"]),
  footprintWidth: numeric("Footprint width", 20, 600),
  footprintDepth: numeric("Footprint depth", 20, 600),
  inset: numeric("Corner inset", 0, 150),
  stepDepth: numeric("Step depth", 0, 300),
  shoulder: numeric("Shoulder width", 0, 300),
  height: numeric("Extrusion height", .001, 1000),
  segments: numeric("Path samples", 2, 512, true),
  verticalAmplitude: numeric("Vertical bend", -640, 640),
  verticalCycles: numeric("Vertical cycles", -32, 32),
  depthAmplitude: numeric("Depth bend", -640, 640),
  depthCycles: numeric("Depth cycles", -32, 32),
  width: numeric("Start width", 0, 640),
  endWidth: numeric("End width", 0, 640),
  widthPulse: numeric("Middle width pulse", -1, 8),
  base: select("Base mesh", ["tetra", "octa", "patch"]),
  axisX: numeric("X scale", -8, 8),
  axisY: numeric("Y scale", -8, 8),
  axisZ: numeric("Z scale", -8, 8),
  cornerLift: numeric("Corner lift", -640, 640),
  levels: numeric("Refinement", 0, 6, true),
  rotation: numeric("Camera yaw", -2 * Math.PI, 2 * Math.PI),
  pitch: numeric("Camera pitch", -Math.PI / 2, Math.PI / 2),
  zoom: numeric("View zoom", .05, 20),
  faceMode: select("Face colour", ["solid-lit", "bands", "facets"]),
  weight: numeric("Outline weight", 0, 12),
};
const sourceKeys = {
  "extruded-seals": ["footprint", "footprintWidth", "footprintDepth", "inset", "stepDepth", "shoulder", "height"],
  "stepped-blocks": ["footprint", "footprintWidth", "footprintDepth", "inset", "stepDepth", "shoulder", "height"],
  "transported-ribbons": ["segments", "verticalAmplitude", "verticalCycles", "depthAmplitude", "depthCycles", "width", "endWidth", "widthPulse"],
  "twisting-streamers": ["segments", "verticalAmplitude", "verticalCycles", "depthAmplitude", "depthCycles", "width", "endWidth", "widthPulse"],
  "rounded-polyhedra": ["base", "axisX", "axisY", "axisZ", "cornerLift", "levels"],
  "subdivided-shells": ["base", "axisX", "axisY", "axisZ", "cornerLift", "levels"],
};
const viewKeys = ["rotation", "pitch", "zoom", "faceMode", "weight"];
const palettes = [
  [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7],
  [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd],
];

export function createMeshStudySketch({ slug, title, defaults, structuralEdit, draw }) {
  const art = document.querySelector("#art"), controls = document.querySelector("#controls"), status = document.querySelector("#status");
  if (!art || !controls || !status || !sourceKeys[slug]) throw Error("Mesh page needs art, controls, status, and a known slug");
  const expected = [...sourceKeys[slug], ...viewKeys, "legacy"];
  if (Object.keys(defaults).sort().join(",") !== expected.sort().join(",")) throw Error("Mesh defaults and controls differ");
  let params = { ...defaults }, paletteIndex = 0, structural = false, revision = 0, sketch;
  const inputs = new Map();
  const groups = document.createElement("div"); groups.className = "mesh-fields";
  for (const [groupName, keys] of [["Source geometry", sourceKeys[slug]], ["View and surface", viewKeys]]) {
    const group = document.createElement("fieldset"), legend = document.createElement("legend");
    legend.textContent = groupName; group.append(legend);
    for (const key of keys) {
      const spec = fields[key], label = document.createElement("label"), input = document.createElement(spec.type === "select" ? "select" : "input");
      label.textContent = spec.label; label.htmlFor = `${slug}-${key}`;
      input.id = label.htmlFor; input.name = key;
      if (spec.type === "select") for (const option of spec.options) {
        const entry = document.createElement("option"); entry.value = option; entry.textContent = option; input.append(entry);
      }
      else { input.type = "number"; input.min = String(spec.min); input.max = String(spec.max); input.step = spec.integer ? "1" : "any"; }
      input.value = String(params[key]);
      input.addEventListener("change", () => {
        const value = spec.type === "select" ? input.value : Number(input.value);
        if (!input.checkValidity() || (spec.type === "number" && (!Number.isFinite(value) || (spec.integer && !Number.isInteger(value))))) {
          status.textContent = `${spec.label} is outside its accepted range.`; input.value = String(params[key]); return;
        }
        if (apply({ ...params, [key]: value }, paletteIndex)) structural = false;
        else input.value = String(params[key]);
      });
      label.append(input); group.append(label); inputs.set(key, input);
    }
    groups.append(group);
  }
  controls.append(groups);
  const sync = () => { for (const [key, input] of inputs) input.value = String(params[key]); };
  const render = (nextParams, nextPalette) => {
    const p = sketch;
    if (!p) return false;
    const buffer = p.createGraphics(640, 640, p.P2D);
    try {
      buffer.pixelDensity(1); buffer.CLOSE = p.CLOSE; buffer.ROUND = p.ROUND; buffer.clear();
      draw(buffer, { id: "native-mesh-study", technique: slug, visible: true, opacity: 1,
        seed: 42, palette: [...palettes[nextPalette]], cutEdits: [],
        transform: { x: 320, y: 320, scale: 1, rotation: 0 }, params: nextParams });
      p.clear(); p.image(buffer, 0, 0, 640, 640);
      params = nextParams; paletteIndex = nextPalette;
      art.dataset.revision = String(++revision); art.dataset.renderStatus = "ready";
      status.textContent = `${title} · ${nextParams.faceMode} · ${nextParams.legacy ? "earlier renderer" : "editable mesh"}`;
      sync(); return true;
    } catch (error) {
      art.dataset.renderStatus = revision ? "ready" : "error";
      status.textContent = `Could not draw: ${error instanceof Error ? error.message : String(error)}`;
      return false;
    } finally { buffer.remove(); }
  };
  const apply = (nextParams, nextPalette) => render(nextParams, nextPalette);
  new window.p5((p) => {
    p.setup = () => {
      sketch = p; p.createCanvas(640, 640, p.P2D).parent(art); p.pixelDensity(1); p.noLoop();
      render({ ...defaults }, 0);
    };
  });
  const action = (key) => {
    if (key === "s") { sketch.saveCanvas(slug, "png"); return; }
    if (key === "t") {
      const next = !structural;
      if (apply({ ...defaults, ...(next ? structuralEdit : {}) }, paletteIndex)) structural = next;
    } else if (key === "c") apply({ ...params }, 1 - paletteIndex);
    else if (key === "0" && apply({ ...defaults }, 0)) structural = false;
  };
  controls.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (button && controls.contains(button)) action(button.dataset.action);
  });
  window.addEventListener("keydown", event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.target?.closest?.("input,textarea,select,[contenteditable]")) return;
    const key = event.key.toLowerCase();
    if (["t", "c", "0", "s"].includes(key)) { event.preventDefault(); action(key); }
  });
  window.meshStudy = { snapshot: () => structuredClone({ slug, params, paletteIndex, structural, revision,
    renderStatus: art.dataset.renderStatus ?? "preparing" }) };
}
