import { createBodyMarks } from "./body-marks.js";

const SPINE_STEPS = 24;
const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { dirty: true };
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeBodyMarks() {
  return Object.freeze({ composition, revision });
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  const point = [0, 0];

  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    composition = createBodyMarks();
  };

  function drawBody(spine, rgb) {
    p.noStroke();
    const [r, g, b] = channels(rgb);
    p.fill(r, g, b, 220);
    p.beginShape();
    for (let sample = 0; sample < SPINE_STEPS; sample += 1) {
      spine.pointInto(sample, point, 0);
      const heading = spine.headingAt(sample);
      const width = composition.halfWidth(sample);
      p.vertex(point[0] + Math.cos(heading + Math.PI * 0.5) * width, point[1] + Math.sin(heading + Math.PI * 0.5) * width);
    }
    for (let sample = SPINE_STEPS - 1; sample >= 0; sample -= 1) {
      spine.pointInto(sample, point, 0);
      const heading = spine.headingAt(sample);
      const width = composition.halfWidth(sample);
      p.vertex(point[0] - Math.cos(heading + Math.PI * 0.5) * width, point[1] - Math.sin(heading + Math.PI * 0.5) * width);
    }
    p.endShape(p.CLOSE);
  }

  function drawCenterline(spine, rgb) {
    p.noFill();
    const [r, g, b] = channels(rgb);
    p.stroke(r, g, b, 225);
    p.strokeWeight(2.0);
    p.strokeCap(p.ROUND);
    p.beginShape();
    // samples 0..23 have headings. The terminal point 24 is intentionally not drawn here.
    for (let sample = 0; sample < SPINE_STEPS; sample += 1) {
      spine.pointInto(sample, point, 0);
      p.vertex(point[0], point[1]);
    }
    p.endShape();
  }

  function renderBodies() {
    p.background(246, 243, 235);
    for (let head = 0; head < composition.spines.length; head += 1) {
      const spine = composition.spines[head];
      const rgb = composition.palette.sample(composition.phaseFor(head));
      if (composition.centerlines) drawCenterline(spine, rgb);
      else drawBody(spine, rgb);
    }
  }

  p.draw = () => {
    if (!composition.running && !settings.dirty) return;
    if (composition.running) composition.advanceTick();
    renderBodies();
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.tick = String(composition.tick);
    status.textContent = `tick ${composition.tick} · ${composition.running ? "running" : "paused"} · ${composition.centerlines ? "centerline" : "body"} · taper ${composition.taperExponent}`;
    settings.dirty = false;
  };

  function action(name) {
    if (name === " " || name === "space") { composition.toggleRunning(); settings.dirty = true; return; }
    if (name === ".") {
      if (!composition.running) { composition.advanceTick(); settings.dirty = true; }
      return;
    }
    if (name === "m") composition.toggleCenterlines();
    else if (name === "w") composition.toggleTaper();
    else if (name === "0") composition.reset();
    else if (name === "s") { p.saveCanvas("body-marks", "png"); return; }
    else return;
    settings.dirty = true;
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(p.key === " " ? " " : String(p.key).toLowerCase());
}, art);
