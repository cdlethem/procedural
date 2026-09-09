import { createPolygonMarks, COLORS } from "./polygon-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observePolygonMarks() {
  return Object.freeze({ composition, revision });
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(512, 512, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    composition = createPolygonMarks();
    paint();
  };

  function paint() {
    p.background(246, 226, 220);
    p.noStroke();
    const placements = composition.placements;
    for (let i = 0; i < placements.size; i += 1) {
      const source = placements.sourceIndexAt(i);
      const [r, g, b] = channels(COLORS[(source + (composition.alternate ? 2 : 0)) % COLORS.length]);
      p.fill(r, g, b);
      p.beginShape();
      for (let j = 0; j < placements.vertexCountAt(i); j += 1) {
        p.vertex(placements.xAt(i, j), placements.yAt(i, j));
      }
      p.endShape(p.CLOSE);
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.placedCount = String(placements.size);
    status.textContent = `${placements.size} placed of 600 proposed · seed ${composition.seed} · ratio ${composition.ratio} · ${composition.shape === 0 ? "capsule" : "diamond"}`;
  }

  function action(name) {
    if (name === "a") composition.toggleRatio();
    else if (name === "m") composition.toggleShape();
    else if (name === "c") composition.toggleAlternate();
    else if (name === "r") composition.nextSeed();
    else if (name === "0") composition.reset();
    else if (name === "s") { p.saveCanvas("polygon-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
