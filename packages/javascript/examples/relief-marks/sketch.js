import { createReliefComposition } from "./relief-marks.js";

const SIZE = 960;
const PALETTE = [0x366A51, 0xDFAB56, 0xE5463E, 0x2884BC];

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let seed = 42;
let tall = false;
let color = 0;
let displayedFrame = null;
let revision = 0;
let lastDrawMs = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeReliefMarks() {
  return Object.freeze({ composition, revision, lastDrawMs });
}

const face = new Int32Array(3);
const a = new Float64Array(2), b = new Float64Array(2), c = new Float64Array(2);

function loadFace(index) {
  composition.mesh.triangleInto(index, face, 0);
  composition.mesh.pointInto(face[0], a, 0);
  composition.mesh.pointInto(face[1], b, 0);
  composition.mesh.pointInto(face[2], c, 0);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(SIZE, SIZE, p.WEBGL).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuild();
    paint();
  };

  function rebuild() {
    composition = createReliefComposition(seed);
  }

  function drawSpikes() {
    p.fill(255);
    for (let leaf = 0; leaf < composition.leafCount; leaf += 1) {
      if (!composition.spikeAt(leaf)) continue;
      composition.centerInto(leaf, a, 0);
      const height = composition.spikeHeight(leaf);
      p.push();
      p.translate(a[0], a[1], height * 0.5);
      p.box(height * 0.02, height * 0.02, height);
      p.pop();
    }
  }

  /** Emits the Java source's three triangles: one slope and two first-edge walls. */
  function drawReliefFace(height) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const dz = -height;
    // Processing calculates flat face normals. p5 immediate geometry requires
    // them explicitly, otherwise every emitted triangle gets one default normal
    // and the defining faceted shading disappears.
    p.normal(dy * dz, -dx * dz, dx * (c[1] - a[1]) - dy * (c[0] - a[0]));
    p.vertex(a[0], a[1], height);
    p.vertex(b[0], b[1], height);
    p.vertex(c[0], c[1], 0);
    p.normal(dy * dz, -dx * dz, 0);
    p.vertex(a[0], a[1], height);
    p.vertex(b[0], b[1], height);
    p.vertex(b[0], b[1], 0);
    p.normal(dy * dz, -dx * dz, 0);
    p.vertex(a[0], a[1], height);
    p.vertex(b[0], b[1], height);
    p.vertex(a[0], a[1], 0);
  }

  function paint() {
    const started = performance.now();
    p.background(240);
    // Direct calls from click/key handlers are outside p5's normal draw cycle.
    // Reset transforms and lights so a repaint never compounds either state.
    p.resetMatrix();
    p.noLights();
    p.ambientLight(120, 120, 120);
    p.directionalLight(10, 20, 30, 0, -0.5, -1);
    p.lightFalloff(0, 1, 0);
    p.directionalLight(180, 160, 160, -0.8, 0.5, -1);
    // WEBGL coordinates are already centred, unlike Processing P3D's canvas
    // coordinates. The camera offset matches the established CityMarks port.
    p.ortho(-480, 480, -480, 480, 0.02, 2000);
    p.translate(0, 0, -400);
    p.rotateX(p.QUARTER_PI);
    p.rotateZ(p.QUARTER_PI);
    p.scale(2.2);
    p.noStroke();
    drawSpikes();
    const rgb = PALETTE[color];
    p.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
    // The source begins one same-color TRIANGLES shape per face; batching
    // produces the identical ordered triangles without avoidable API churn.
    p.beginShape(p.TRIANGLES);
    const height = tall ? 12 : 4;
    for (let i = 0; i < composition.mesh.faceCount; i += 1) {
      loadFace(i);
      drawReliefFace(height);
    }
    p.endShape();

    displayedFrame = p.get();
    lastDrawMs = performance.now() - started;
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `seed ${seed} · ${tall ? "tall" : "low"} relief · color ${color} · ${composition.leafCount} centres · ${composition.mesh.faceCount} facets · ${lastDrawMs.toFixed(0)}ms`;
  }

  function action(name) {
    if (name === "c") color = (color + 1) % PALETTE.length;
    else if (name === "h") tall = !tall;
    else if (name === "r") { seed = (seed + 1) >>> 0; rebuild(); }
    else if (name === "0") { seed = 42; tall = false; color = 0; rebuild(); }
    else if (name === "s") {
      if (displayedFrame) displayedFrame.save("relief-marks.png");
      return;
    } else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => {
    action(String(p.key).toLowerCase());
    if (p.key === " ") return false;
  };
}, art);
