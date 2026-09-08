import { BACKGROUND_RGB, DOT_DIAMETER, createRampMarks, rampGridDots } from "./ramp-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { shifted: false, alternate: false, radial: false };
let model = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeRampMarks() {
  return Object.freeze({ model, revision, settings: Object.freeze({ ...settings }) });
}

function rebuildRamp() {
  model = createRampMarks(settings.shifted, settings.alternate);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuildRamp();
    paint();
  };

  function paint() {
    const rgbColor = (rgb) => [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255];
    p.background(...rgbColor(BACKGROUND_RGB));
    p.noStroke();
    let dotCount = 0;
    // Dots are drawn directly with p5's native circle primitive: the shared
    // fresh-raster-2d vocabulary (segment2/quad2) has no round-fill primitive, and an
    // approximating square would visibly change this composition's dot shape.
    for (const dot of rampGridDots(model, settings.radial)) {
      p.fill(...rgbColor(dot.rgb));
      p.circle(dot.x, dot.y, DOT_DIAMETER);
      dotCount += 1;
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.dotCount = String(dotCount);
    status.textContent = `${dotCount.toLocaleString()} ramp-sampled dots · ${settings.radial ? "radial" : "linear"} coordinate · ${settings.shifted ? "shifted" : "base"} stops · ${settings.alternate ? "alternate" : "base"} palette`;
  }

  function action(name) {
    if (name === "t") { settings.shifted = !settings.shifted; rebuildRamp(); }
    else if (name === "c") { settings.alternate = !settings.alternate; rebuildRamp(); }
    else if (name === "f") settings.radial = !settings.radial;
    else if (name === "0") { settings.shifted = false; settings.alternate = false; settings.radial = false; rebuildRamp(); }
    else if (name === "s") { p.saveCanvas("ramp-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
