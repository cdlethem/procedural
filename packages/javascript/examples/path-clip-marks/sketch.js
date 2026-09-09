import { createPathClipMarks, PATH_COLORS } from "./path-clip-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observePathClipMarks() {
  return Object.freeze({ composition, revision });
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    composition = createPathClipMarks();
    paint();
  };

  function paint() {
    p.background(247, 243, 233);
    p.noFill();
    if (composition.showUnclipped) {
      p.stroke(189, 184, 176, 72);
      p.strokeWeight(0.7);
      for (const [x1, y1, x2, y2] of composition.sources) p.line(x1, y1, x2, y2);
    }
    p.strokeWeight(1.5);
    const clipped = composition.clipped;
    const segment = [0, 0, 0, 0];
    for (let piece = 0; piece < clipped.size; piece += 1) {
      clipped.segmentInto(piece, segment, 0);
      const source = clipped.sourceIndexAt(piece);
      const path = composition.sourceToPath[source];
      // Every split piece retains its source path's palette identity.
      if (composition.alternateColors) {
        const [r, g, b] = channels(PATH_COLORS[path]);
        p.stroke(r, g, b);
      } else {
        p.stroke(37, 89, 107);
      }
      p.line(segment[0], segment[1], segment[2], segment[3]);
    }
    p.noFill();
    p.stroke(68, 64, 60);
    p.strokeWeight(1.5);
    p.beginShape();
    for (const [x, y] of composition.polygon) p.vertex(x, y);
    p.endShape(p.CLOSE);

    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.clippedSize = String(clipped.size);
    status.textContent = `${clipped.size} clipped pieces of ${composition.sources.length} source segments · ${composition.shallowNotch ? "shallow" : "deep"} notch · ${composition.alternateColors ? "path colors" : "single color"} · ${composition.showUnclipped ? "source shown" : "source hidden"}`;
  }

  function action(name) {
    if (name === "n") composition.toggleNotch();
    else if (name === "c") composition.toggleAlternateColors();
    else if (name === "o") composition.toggleShowUnclipped();
    else if (name === "0") composition.reset();
    else if (name === "s") { p.saveCanvas("path-clip-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
