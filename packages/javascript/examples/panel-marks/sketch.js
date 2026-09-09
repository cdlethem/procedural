import { createPanelMarks } from "./panel-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { alternate: false, solidPanels: false };
const colors = [0x264653, 0x2a9d8f, 0xd7aa35, 0xe28d4b, 0xd96750];
const otherColors = [0x375e97, 0x8c579c, 0x458a73, 0xb15075, 0xa77c40];
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observePanelMarks() {
  return Object.freeze({ composition, revision, settings: Object.freeze({ ...settings }) });
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    composition = createPanelMarks();
    paint();
  };

  function paint() {
    p.background(245, 242, 235);
    p.rectMode(p.CORNER);
    p.strokeWeight(1);
    const layout = composition.layout;
    const palette = settings.alternate ? otherColors : colors;
    const bounds = [0, 0, 0, 0];
    for (let index = 0; index < layout.size; index += 1) {
      layout.boundsInto(index, bounds);
      // Cell-to-world conversion is ordinary drawing arithmetic; no partition logic here.
      const x = 20 + bounds[0] * 10, y = 20 + bounds[1] * 10;
      const w = (bounds[2] - bounds[0]) * 10, h = (bounds[3] - bounds[1]) * 10;
      const [r, g, b] = channels(palette[index % palette.length]);
      if (settings.solidPanels) {
        p.stroke(r, g, b);
        p.fill(r, g, b, 90);
        p.rect(x + 2, y + 2, w - 4, h - 4);
        p.stroke(40, 60, 70, 180);
        p.line(x + w * 0.5, y + 3, x + w * 0.5, y + h - 3);
      } else {
        p.stroke(r, g, b, 210);
        p.noFill();
        for (let inset = 1; w - 2 * inset > 0 && h - 2 * inset > 0; inset += 3) {
          p.rect(x + inset, y + inset, w - 2 * inset, h - 2 * inset);
        }
      }
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.cellCount = String(layout.size);
    status.textContent = `${layout.size} panels · ${composition.attempts} attempts · ${composition.randomAxis ? "random" : "longest"} axis · ${settings.solidPanels ? "solid" : "outline"}`;
  }

  function action(name) {
    if (name === "a") { composition.cycleAttempts(); }
    else if (name === "p") { composition.toggleAxisPolicy(); }
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "m") settings.solidPanels = !settings.solidPanels;
    else if (name === "0") {
      composition.reset();
      settings.alternate = false;
      settings.solidPanels = false;
    } else if (name === "s") { p.saveCanvas("panel-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
