import { createClipMarks } from "./clip-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { dirty: true };
let composition = null;
let displayedFrame = null;
let revision = 0;

function renderMarks(p, composition) {
  p.background(246, 241, 231);
  p.noFill();
  if (composition.overlay) {
    p.stroke(222, 216, 205);
    p.strokeWeight(1);
    for (const s of composition.sources) p.line(s[0], s[1], s[2], s[3]);
  }
  p.strokeWeight(2);
  const clipped = composition.clipped;
  for (let i = 0; i < clipped.size; i += 1) {
    const segment = clipped.segmentAt(i);
    // Split pieces keep source identity, so both pieces receive the same color.
    const source = clipped.sourceIndexAt(i);
    if (composition.alternateColor) {
      const c = source % 2 === 0 ? [137, 62, 100] : [190, 104, 64];
      p.stroke(c[0], c[1], c[2]);
    } else {
      p.stroke(31, 90, 101);
    }
    p.line(segment[0], segment[1], segment[2], segment[3]);
  }
  p.stroke(72, 68, 64);
  p.strokeWeight(1.5);
  p.noFill();
  p.beginShape();
  for (const vertex of composition.polygon) p.vertex(vertex[0], vertex[1]);
  p.endShape(p.CLOSE);
  if (composition.endpoints) {
    p.noStroke();
    p.fill(187, 82, 54);
    for (let i = 0; i < clipped.size; i += 1) {
      const segment = clipped.segmentAt(i);
      p.ellipse(segment[0], segment[1], 4, 4);
      p.ellipse(segment[2], segment[3], 4, 4);
    }
  }
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    composition = createClipMarks();
  };

  p.draw = () => {
    if (!settings.dirty) return;
    renderMarks(p, composition);
    // Capture only after every drawing layer has completed. Saving never rerenders.
    displayedFrame = p.get();
    revision += 1;
    art.dataset.revision = String(revision);
    const source = composition.alternateSource ? "supplied" : (composition.sparse ? "sparse" : "dense");
    status.textContent = `${source} source · ${composition.shallow ? "shallow" : "normal"} floor · ${composition.alternateColor ? "alternate" : "default"} colors`;
    settings.dirty = false;
  };

  function action(name) {
    if (name === "h") composition.toggleSparse();
    else if (name === "n") composition.toggleShallow();
    else if (name === "t") composition.toggleAlternateSource();
    else if (name === "c") composition.toggleAlternateColor();
    else if (name === "m") composition.toggleEndpoints();
    else if (name === "o") composition.toggleOverlay();
    else if (name === "0") composition.reset();
    else if (name === "s") {
      // Saving never rerenders; it saves the last captured frame.
      if (displayedFrame) displayedFrame.save("clip-marks.png");
      return;
    } else return;
    settings.dirty = true;
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => {
    action(String(p.key).toLowerCase());
    if (p.key === " ") return false;
  };
}, art);
