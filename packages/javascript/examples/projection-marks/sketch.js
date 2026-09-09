import { createProjectionMarks } from "./projection-marks.js";

const CONTOUR_POINTS = 241;
const LINE_POINTS = 121;
const LINE_COUNT = 12;

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeProjectionMarks() {
  return Object.freeze({ composition, revision });
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(720, 480, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    composition = createProjectionMarks();
    paint();
  };

  function paths(flatPoints) {
    p.beginShape();
    for (let i = 0; i < CONTOUR_POINTS; i += 1) p.vertex(flatPoints[2 * i], flatPoints[2 * i + 1]);
    p.endShape();
    for (let row = 0; row < LINE_COUNT; row += 1) {
      p.beginShape();
      for (let i = 0; i < LINE_POINTS; i += 1) {
        const index = CONTOUR_POINTS + row * LINE_POINTS + i;
        p.vertex(flatPoints[2 * index], flatPoints[2 * index + 1]);
      }
      p.endShape();
    }
  }

  function paint() {
    p.background(248, 245, 235);
    p.noFill();
    p.stroke(125, 145, 160, 115);
    p.strokeWeight(1);
    const discs = composition.discOrders[composition.order];
    for (let i = 0; i < discs.length; i += 1) {
      const [x, y, r] = discs[i];
      p.ellipse(x, y, 2 * r, 2 * r);
    }
    p.stroke(190, 110, 100, 85);
    p.strokeWeight(1);
    paths(composition.inputPoints.flat());
    if (composition.alternate) p.stroke(145, 55, 100); else p.stroke(25, 70, 125);
    p.strokeWeight(1.6);
    paths(composition.activeCoordinates);
    revision += 1;
    art.dataset.revision = String(revision);
    const strengthLabel = ["0.45", "1.0", "0.0"][composition.mode];
    status.textContent = `strength ${strengthLabel} · order ${composition.order === 0 ? "forward" : "reversed"} · ${composition.alternate ? "alternate" : "base"} color`;
  }

  function action(name) {
    if (name === "m") composition.cycleMode();
    else if (name === "o") composition.toggleOrder();
    else if (name === "c") composition.toggleAlternate();
    else if (name === "s") { p.saveCanvas("projection-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
