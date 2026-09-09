import { createPointerMarks, PALETTE } from "./pointer-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { dirty: true };
let composition = null;
let displayedFrame = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observePointerMarks() {
  return Object.freeze({ composition, revision });
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    composition = createPointerMarks();
  };

  function drawDots() {
    p.noStroke();
    p.ellipseMode(p.CENTER);
    const point = [0, 0];
    for (let body = 0; body < composition.motion.size; body += 1) {
      composition.motion.positionInto(body, point, 0);
      const [r, g, b] = channels(PALETTE[body % PALETTE.length]);
      p.fill(r, g, b, 225);
      p.ellipse(point[0], point[1], 9.0, 9.0);
    }
  }

  function drawFixedWire() {
    p.noFill();
    p.strokeWeight(1.1);
    p.strokeCap(p.ROUND);
    const mesh = composition.initialMesh;
    const point = [0, 0];
    const otherPoint = [0, 0];
    for (let index = 0; index < mesh.edgeCount; index += 1) {
      const edge = mesh.edgeAt(index);
      // Canonical vertices map to their original spring bodies. This is fixed initial
      // connectivity, not a current Delaunay mesh or a non-crossing guarantee.
      composition.motion.positionInto(mesh.sourceIndexAt(edge[0]), point, 0);
      composition.motion.positionInto(mesh.sourceIndexAt(edge[1]), otherPoint, 0);
      const [r, g, b] = channels(PALETTE[index % PALETTE.length]);
      p.stroke(r, g, b, 190);
      p.line(point[0], point[1], otherPoint[0], otherPoint[1]);
    }
  }

  function drawTargetGuides() {
    p.noFill();
    p.strokeWeight(1.0);
    const point = [0, 0];
    for (let body = 0; body < composition.motion.size; body += 1) {
      composition.motion.positionInto(body, point, 0);
      const targetX = composition.targets[body * 2];
      const targetY = composition.targets[body * 2 + 1];
      const [r, g, b] = channels(PALETTE[body % PALETTE.length]);
      p.stroke(r, g, b, 105);
      p.line(point[0], point[1], targetX, targetY);
      p.stroke(r, g, b, 220);
      p.line(targetX - 4, targetY, targetX + 4, targetY);
      p.line(targetX, targetY - 4, targetX, targetY + 4);
    }
  }

  function renderMarks() {
    p.background(244, 241, 233);
    if (composition.wire) drawFixedWire();
    else drawDots();
    if (composition.showTargets) drawTargetGuides();
  }

  p.draw = () => {
    if (!composition.running && !settings.dirty) return;
    if (composition.running) {
      // Read the captured input once. No wall-clock, frame-rate, or live mouse read enters a tick.
      composition.stepWithInput(composition.pointerHeld, composition.pointerX, composition.pointerY);
    }
    renderMarks();
    // Capture only after every drawing layer has completed. Saving never rerenders or ticks.
    displayedFrame = p.get();
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.tick = String(composition.tick);
    status.textContent = `tick ${composition.tick} · ${composition.running ? "running" : "paused"} · ${composition.wire ? "wire" : "dots"} · ${composition.showTargets ? "targets" : "no targets"}`;
    settings.dirty = false;
  };

  function capturePointer() {
    if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      composition.capturePointer(p.mouseX, p.mouseY, p.width, p.height);
    } else {
      composition.releasePointer();
    }
  }

  p.mousePressed = capturePointer;
  p.mouseDragged = capturePointer;
  p.mouseReleased = () => composition.releasePointer();

  function action(name) {
    if (name === " " || name === "space") { composition.toggleRunning(); settings.dirty = true; return; }
    if (name === ".") {
      if (!composition.running) {
        composition.stepWithInput(composition.pointerHeld, composition.pointerX, composition.pointerY);
        settings.dirty = true;
      }
      return;
    }
    if (name === "s") {
      // Saving never rerenders or ticks; it saves the last captured frame.
      if (displayedFrame) displayedFrame.save("pointer-marks.png");
      return;
    }
    if (name === "m") composition.toggleWire();
    else if (name === "t") composition.toggleShowTargets();
    else if (name === "0") composition.reset();
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
