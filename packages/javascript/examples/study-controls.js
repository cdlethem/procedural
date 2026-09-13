/** Private editable-example lifecycle; not part of the operation API. */
export function createStudySketch({ slug, title, defaults, structuralEdit, draw }) {
  const art = document.querySelector("#art");
  const controls = document.querySelector("#controls");
  const status = document.querySelector("#status");
  if (!art || !controls || !status) throw new Error("Study page requires art, controls and status elements.");
  const palettes = [
    [0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7],
    [0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd],
  ];
  let structure = false, palette = 0, revision = 0;
  const sketch = new window.p5((p) => {
    p.setup = () => {
      p.createCanvas(640, 640, p.P2D).parent(art);
      p.pixelDensity(1);
      p.noLoop();
    };
    p.draw = () => {
      try {
        p.background("#ece7da");
        const buffer = p.createGraphics(640, 640, p.P2D);
        buffer.pixelDensity(1);
        for (const key of ["CLOSE", "CORNER", "CENTER", "ROUND", "TRIANGLES"]) buffer[key] = p[key];
        buffer.clear();
        try {
          draw(buffer, {
            id: "native-study", technique: slug, visible: true, opacity: 1,
            seed: 42, palette: [...palettes[palette]], cutEdits: [],
            transform: { x: 320, y: 320, scale: 1, rotation: 0 },
            params: { ...defaults, ...(structure ? structuralEdit : {}) },
          });
          p.image(buffer, 0, 0, 640, 640);
        } finally { buffer.remove(); }
        art.dataset.revision = String(++revision);
        art.dataset.renderStatus = "ready";
        status.textContent = `${title} · seed 42 · ${structure ? "structural edit" : "baseline"}`;
      } catch (error) {
        art.dataset.renderStatus = "error";
        status.textContent = `Could not draw: ${error instanceof Error ? error.message : String(error)}`;
      }
    };
  });
  const action = (key) => {
    if (key === "s") { sketch.saveCanvas(slug, "png"); return; }
    if (key === "t") structure = !structure;
    else if (key === "c") palette = 1 - palette;
    else if (key === "0") { structure = false; palette = 0; }
    else return;
    sketch.redraw();
  };
  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button && controls.contains(button)) action(button.dataset.action);
  });
  window.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.target?.closest?.("input,textarea,select,[contenteditable]")) return;
    const key = event.key.toLowerCase();
    if (["t", "c", "0", "s"].includes(key)) { event.preventDefault(); action(key); }
  });
  return sketch;
}
