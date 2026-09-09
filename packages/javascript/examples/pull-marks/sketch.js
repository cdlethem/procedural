import { createPullMarks } from "./pull-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observePullMarks() {
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
    composition = createPullMarks();
    paint();
  };

  function drawPaths(paths, phaseStep, closed) {
    for (let path = 0; path < paths.length; path += 1) {
      const rgb = composition.palette.sample((path + (composition.alternate ? 2 : 0)) * phaseStep);
      const [r, g, b] = channels(rgb);
      p.stroke(r, g, b, closed ? 210 : 190);
      p.noFill();
      p.beginShape();
      for (const [x, y] of paths[path]) p.vertex(x, y);
      if (closed) p.endShape(p.CLOSE); else p.endShape();
    }
  }

  function paint() {
    p.background(245, 240, 230);
    p.noFill();
    p.strokeWeight(1.0);
    if (composition.contoursMode) drawPaths(composition.contourOutput, 0.31, true);
    else drawPaths(composition.gridOutput, 0.17, false);
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `radius ${composition.radius} · power ${composition.power} · ${composition.alternate ? "alternate" : "base"} palette · ${composition.contoursMode ? "contours" : "grid"}`;
  }

  function action(name) {
    if (name === "r") composition.toggleRadius();
    else if (name === "p") composition.togglePower();
    else if (name === "c") composition.toggleAlternate();
    else if (name === "m") composition.toggleContoursMode();
    else if (name === "0") composition.reset();
    else if (name === "s") { p.saveCanvas("pull-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
