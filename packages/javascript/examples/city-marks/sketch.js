import { createCityComposition, cyclicPalette } from "./city-marks.js";

const SIZE = 960;

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let palette = null;
let seed = 42;
let low = false;
let colorPhaseSteps = 0;
let displayedFrame = null;
let revision = 0;
let lastDrawMs = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeCityMarks() {
  return Object.freeze({ composition, revision, lastDrawMs });
}

const face = new Int32Array(3);
const a = new Float64Array(2), b = new Float64Array(2), c = new Float64Array(2);
const uv = new Float64Array(2);

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
    palette = cyclicPalette({ colors: [0x121b4b, 0x028594, 0xe55e7f, 0xfbaf34, 0xf0d5ca] });
    rebuild();
    paint();
  };

  function rebuild() {
    composition = createCityComposition(seed);
  }

  function roof(h) {
    p.vertex(a[0], a[1], h);
    p.vertex(b[0], b[1], h);
    p.vertex(c[0], c[1], h);
  }

  function wall(start, end, h) {
    p.vertex(start[0], start[1], h);
    p.vertex(end[0], end[1], h);
    p.vertex(end[0], end[1], 0);
    p.vertex(start[0], start[1], 0);
  }

  /** Batched window boxes for one wall: computes each window's rotated/translated
   * box corners with portable matrix math (no per-window push/pop/translate/
   * rotate/box(), which is far too slow at this count in WebGL immediate mode)
   * and emits its two largest faces (front/back, matching the box's 0.1-deep
   * thickness -- the visually dominant surfaces from this camera angle) into
   * the currently open QUADS shape, colored per window's lit state. */
  function windows(f, w, start, end, h) {
    const dx = end[0] - start[0], dy = end[1] - start[1];
    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const ww = (Math.hypot(dx, dy) / composition.horizontalCount(f)) * composition.wallWidthFraction(f, w);
    const hh = (h / composition.verticalCount(f)) * composition.wallHeightFraction(f, w);
    const hw = ww / 2, hd = hh / 2, thickness = 0.05;
    const grid = composition.windowGrid(f);
    for (let i = 0; i < grid.size; i += 1) {
      grid.pointInto(i, uv, 0);
      const px = start[0] + dx * uv[1], py = start[1] + dy * uv[1], pz = h * (1 - uv[0]);
      if (composition.windowLit(f, w, i)) p.fill(255, 220, 200);
      else p.fill(0);
      for (const sy of [-thickness, thickness]) {
        for (const [sx, sz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) {
          p.vertex(sx * cos - sy * sin + px, sx * sin + sy * cos + py, sz + pz);
        }
      }
    }
  }

  function paint() {
    const started = performance.now();
    p.background(0);
    // p5's draw()/redraw() cycle resets the matrix stack each frame, matching
    // Processing's automatic per-frame reset; this manual paint() must do the
    // same explicitly, or repeated calls compound translate/rotate/scale.
    p.resetMatrix();
    // p5's WEBGL renderer accumulates light state across repeated lights()
    // calls made outside its normal per-frame draw()+redraw() lifecycle (this
    // sketch paints directly from key/click handlers); noLights() immediately
    // before every lights() call prevents saturation across repaint calls
    // (same documented fix as AnnularMarks/DepthMarks).
    p.noLights();
    p.ambientLight(120, 120, 120);
    p.directionalLight(10, 20, 30, 0, -0.5, -1);
    p.lightFalloff(0, 1, 0);
    p.directionalLight(180, 160, 160, -0.8, 0.5, -1);
    p.ortho(-480, 480, -480, 480, 0.02, 2500);
    p.translate(0, 0, -400);
    p.rotateX(p.QUARTER_PI);
    p.rotateZ(p.QUARTER_PI);
    p.scale(2.1);
    p.stroke(0, 240);
    p.strokeWeight(0.08);

    p.beginShape(p.TRIANGLES);
    for (let f = 0; f < composition.mesh.faceCount; f += 1) {
      if (!composition.groundVisible(f)) continue;
      loadFace(f);
      p.fill(composition.groundGray(f));
      roof(0);
    }
    p.endShape();

    p.strokeWeight(0.4);
    const heightScale = low ? 80 : 200;
    for (let f = 0; f < composition.mesh.faceCount; f += 1) {
      loadFace(f);
      const h = heightScale * composition.heightUnit(f);
      const rgb = palette.sample(composition.palettePhase(f) + colorPhaseSteps / 5.0);
      p.beginShape(p.TRIANGLES);
      p.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
      roof(h);
      p.endShape();
      p.beginShape(p.QUADS);
      p.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
      wall(a, b, h);
      wall(c, b, h);
      wall(a, c, h);
      p.endShape();
      p.push();
      p.noStroke();
      p.beginShape(p.QUADS);
      windows(f, 0, a, b, h);
      windows(f, 1, c, b, h);
      windows(f, 2, a, c, h);
      p.endShape();
      p.pop();
    }

    lastDrawMs = performance.now() - started;
    displayedFrame = p.get();
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `seed ${seed} · ${low ? "low" : "tall"} heights · color offset ${colorPhaseSteps} · ${composition.mesh.faceCount} buildings · ${lastDrawMs.toFixed(0)}ms`;
  }

  function action(name) {
    if (name === "c") colorPhaseSteps = (colorPhaseSteps + 1) % 5;
    else if (name === "h") low = !low;
    else if (name === "r") { seed = (seed + 1) >>> 0; rebuild(); }
    else if (name === "0") { seed = 42; low = false; colorPhaseSteps = 0; rebuild(); }
    else if (name === "s") {
      if (displayedFrame) displayedFrame.save("city-marks.png");
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
