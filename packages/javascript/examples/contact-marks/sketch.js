import { createContactMarks } from "./contact-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { dirty: true };
let composition = null;
let displayedFrame = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeContactMarks() {
  return Object.freeze({ composition, revision });
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    composition = createContactMarks();
  };

  function renderMarks() {
    p.background(244, 240, 232);
    const [qr, qg, qb] = [70, 95, 105];
    p.stroke(qr, qg, qb, 45);
    p.strokeWeight(1);
    for (const q of composition.queries) p.line(q[0], q[1], q[2], q[3]);
    p.stroke(43, 59, 68);
    p.strokeWeight(3);
    for (const edge of composition.obstacles) p.line(edge[0], edge[1], edge[2], edge[3]);
    const colors = composition.palette;
    for (let i = 0; i < composition.contacts.size; i += 1) {
      const hit = composition.contacts.hitAt(i);
      if (hit === null) continue; // This piece omits misses; the query result preserves them.
      const q = composition.queries[i];
      const [r, g, b] = channels(colors[hit.obstacleIndex]);
      p.stroke(r, g, b);
      p.strokeWeight(2.5);
      p.line(q[0], q[1], hit.x, hit.y);
      p.noStroke();
      p.fill(r, g, b);
      p.ellipse(hit.x, hit.y, 10, 10);
      p.fill(43, 59, 68);
      p.ellipse(q[0], q[1], 4, 4);
    }
  }

  p.draw = () => {
    if (!settings.dirty) return;
    renderMarks();
    // Capture only after every drawing layer has completed. Saving never rerenders.
    displayedFrame = p.get();
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `${composition.shifted ? "shifted" : "base"} obstacle · ${composition.alternateColors ? "alternate" : "default"} colors`;
    settings.dirty = false;
  };

  function action(name) {
    if (name === "n") composition.toggleShifted();
    else if (name === "c") composition.toggleAlternateColors();
    else if (name === "0") composition.reset();
    else if (name === "s") {
      // Saving never rerenders; it saves the last captured frame.
      if (displayedFrame) displayedFrame.save("contact-marks.png");
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
    // Space is not a shortcut here, but suppress its focused-button synthetic click
    // consistently with the other starters.
    if (p.key === " ") return false;
  };
}, art);
