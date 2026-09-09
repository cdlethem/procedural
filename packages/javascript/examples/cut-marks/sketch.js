import { createCutMarks, PALETTE } from "./cut-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeCutMarks() {
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
    composition = createCutMarks();
    paint();
  };

  function paint() {
    p.background(247, 243, 233);
    p.strokeWeight(1.0);
    for (const leaf of composition.model.leaves()) {
      const [r, g, b] = channels(PALETTE[leaf.id % PALETTE.length]);
      const [left, top, right, bottom] = leaf.bounds;
      const width = right - left, height = bottom - top;
      if (composition.decoration) {
        p.noFill();
        p.stroke(r, g, b, 210);
        p.rect(left, top, width, height);
        p.line((left + right) * 0.5, top, (left + right) * 0.5, top + height);
        p.line(left, (top + bottom) * 0.5, left + width, (top + bottom) * 0.5);
      } else {
        p.noStroke();
        p.fill(r, g, b, 190);
        p.rect(left, top, width, height);
      }
    }
    if (composition.selectedId >= 0) {
      try {
        const selected = composition.model.leaf(composition.selectedId);
        const [left, top, right, bottom] = selected.bounds;
        p.noFill();
        p.stroke(20, 20, 20, 255);
        p.strokeWeight(2.5);
        p.rect(left, top, right - left, bottom - top);
      } catch { /* leaf may have been removed since last render */ }
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.cellCount = String(composition.model.size);
    art.dataset.selectedId = String(composition.selectedId);
    status.textContent = `${composition.model.size} regions · ${composition.staggered ? "staggered" : "aligned"} · ${composition.holes ? "holes" : "solid"} · ${composition.decoration ? "outline" : "fill"} · ${composition.selectedId >= 0 ? "selected " + composition.selectedId : "none selected"}`;
  }

  p.mousePressed = () => {
    if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) return;
    composition.select(p.mouseX, p.mouseY);
    paint();
  };

  function action(name) {
    if (name === "a") composition.toggleStaggered();
    else if (name === "d") composition.toggleDecoration();
    else if (name === "h") composition.toggleHoles();
    else if (name === "x") composition.cutSelected("X");
    else if (name === "y") composition.cutSelected("Y");
    else if (name === "delete" || name === "backspace") composition.removeSelected();
    else if (name === "0") composition.reset();
    else if (name === "s") { p.saveCanvas("cut-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => {
    if (p.keyCode === p.DELETE || p.keyCode === p.BACKSPACE) { action("delete"); return; }
    action(String(p.key).toLowerCase());
  };
}, art);
