import { createSpringMarks } from "./spring-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const COLORS = [0x173f5f, 0xaf5441, 0xe9c46a, 0x347969];
const OTHER_COLORS = [0x493657, 0xb85065, 0xe6b89c, 0x467c89];
const settings = { running: false, dirty: true, alternate: false, trails: true, targets: false, mode: 0, strength: 0.025, retention: 0.7 };
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeSpringMarks() {
  return Object.freeze({ composition, revision, settings: Object.freeze({ ...settings }) });
}

function markColor(index) {
  const colors = settings.alternate ? OTHER_COLORS : COLORS;
  return colors[index % colors.length];
}

function channels(rgb) { return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff]; }

new window.p5((p) => {
  const position = [0, 0], otherPosition = [0, 0], velocity = [0, 0], initial = [0, 0], target = [0, 0];
  const edge = [0, 0];

  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    composition = createSpringMarks();
  };

  function rgbStroke(rgb, alpha) { const [r, g, b] = channels(rgb); p.stroke(r, g, b, alpha); }
  function rgbFill(rgb, alpha) { const [r, g, b] = channels(rgb); p.fill(r, g, b, alpha); }

  function drawInitialRings() {
    p.noFill(); p.stroke(45, 50, 55, 75); p.strokeWeight(1); p.ellipseMode(p.CENTER);
    for (let body = 0; body < composition.motion.size; body += 1) {
      composition.initialInto(body, initial, 0);
      p.ellipse(initial[0], initial[1], 9, 9);
    }
  }

  function drawTrails() {
    p.noFill(); p.strokeWeight(1); p.strokeCap(p.ROUND); p.strokeJoin(p.ROUND);
    const samples = composition.sampleCount;
    for (let body = 0; body < composition.motion.size; body += 1) {
      rgbStroke(markColor(body), 105);
      p.beginShape();
      // historyInto is chronological; endShape intentionally does not close the ring.
      for (let sample = 0; sample < samples; sample += 1) {
        composition.historyInto(sample, body, position, 0);
        p.vertex(position[0], position[1]);
      }
      p.endShape();
    }
  }

  function drawDots() {
    p.noStroke(); p.ellipseMode(p.CENTER);
    const motion = composition.motion;
    for (let body = 0; body < motion.size; body += 1) {
      motion.positionInto(body, position, 0);
      rgbFill(markColor(body), 230);
      p.ellipse(position[0], position[1], 8, 8);
    }
  }

  function drawVelocity() {
    const motion = composition.motion;
    p.noFill(); p.strokeWeight(1.5); p.strokeCap(p.ROUND);
    for (let body = 0; body < motion.size; body += 1) {
      motion.positionInto(body, position, 0);
      motion.velocityInto(body, velocity, 0);
      rgbStroke(markColor(body), 220);
      // 24 is a display-only authored scale for the current logical-step velocity.
      p.line(position[0], position[1], position[0] + velocity[0] * 24.0, position[1] + velocity[1] * 24.0);
    }
  }

  function drawFixedWire() {
    const motion = composition.motion;
    const mesh = composition.mesh;
    p.noFill(); p.strokeWeight(1.1); p.strokeCap(p.ROUND);
    for (let index = 0; index < mesh.edgeCount; index += 1) {
      mesh.edgeInto(index, edge, 0);
      // Canonical mesh vertices are mapped back to the original spring body explicitly.
      const firstBody = composition.bodyForVertex(edge[0]);
      const secondBody = composition.bodyForVertex(edge[1]);
      motion.positionInto(firstBody, position, 0);
      motion.positionInto(secondBody, otherPosition, 0);
      rgbStroke(markColor(index), 185);
      p.line(position[0], position[1], otherPosition[0], otherPosition[1]);
    }
  }

  function drawTargetGuides() {
    const motion = composition.motion;
    p.noFill(); p.strokeWeight(1); p.strokeCap(p.ROUND);
    for (let body = 0; body < motion.size; body += 1) {
      motion.positionInto(body, position, 0);
      composition.targetInto(body, target, 0);
      rgbStroke(markColor(body), 120);
      p.line(position[0], position[1], target[0], target[1]);
      rgbStroke(markColor(body), 220);
      p.line(target[0] - 4, target[1], target[0] + 4, target[1]);
      p.line(target[0], target[1] - 4, target[0], target[1] + 4);
    }
  }

  function renderComposition() {
    p.background(243, 240, 232);
    drawInitialRings();
    if (settings.trails) drawTrails();
    if (settings.mode === 0) drawDots();
    else if (settings.mode === 1) drawVelocity();
    else drawFixedWire();
    if (settings.targets) drawTargetGuides();
  }

  p.draw = () => {
    if (!settings.running && !settings.dirty) return;
    if (settings.running) composition.step();
    renderComposition();
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.tick = String(composition.tick);
    const modeName = ["dots", "velocity", "wire"][settings.mode];
    status.textContent = `tick ${composition.tick} · ${settings.running ? "running" : "paused"} · ${modeName}${settings.trails ? " · trails" : ""}${settings.targets ? " · targets" : ""}`;
    // Capture only after every drawing layer has completed. Saving never rerenders or ticks.
    settings.dirty = false;
  };

  function action(name) {
    if (name === " " || name === "space") { settings.running = !settings.running; settings.dirty = true; return; }
    if (name === ".") {
      if (!settings.running) { composition.step(); settings.dirty = true; }
      return;
    }
    if (name === "d") composition.disturb();
    else if (name === "m") settings.mode = (settings.mode + 1) % 3;
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "h") settings.trails = !settings.trails;
    else if (name === "t") settings.targets = !settings.targets;
    else if (name === "k") { settings.strength = settings.strength === 0.025 ? 0.05 : 0.025; composition.response(settings.strength, settings.retention); }
    else if (name === "v") { settings.retention = settings.retention === 0.7 ? 0.9 : 0.7; composition.response(settings.strength, settings.retention); }
    else if (name === "0") {
      settings.running = false; settings.alternate = false; settings.trails = true; settings.targets = false; settings.mode = 0;
      settings.strength = 0.025; settings.retention = 0.7;
      composition.reset();
    } else if (name === "s") { p.saveCanvas("spring-marks", "png"); return; }
    else return;
    settings.dirty = true;
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => {
    action(p.key === " " ? " " : String(p.key).toLowerCase());
    // Space is our run/pause shortcut. Prevent a focused button from also receiving
    // the browser's synthetic click, which would toggle the simulation a second time.
    if (p.key === " ") return false;
  };
}, art);
