import { P5Frame } from "../../src/internal/p5-frame.js";
import { BACKGROUND_RGB, createLoopMarks, loopFanTriangles, loopTileCommands } from "./loop-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { moved: false, alternate: false, fans: false };
let model = null;
let revision = 0;
let displayedFrame = null;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeLoopMarks() {
  return Object.freeze({ model, revision, settings: Object.freeze({ ...settings }) });
}

function rebuildCurves() {
  model = createLoopMarks(settings.moved);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuildCurves();
    paint();
  };

  function paintTiles() {
    const frame = new P5Frame(p);
    let completed = null;
    try {
      frame.begin({ width: 640, height: 640, density: 1, background: BACKGROUND_RGB });
      let batch = [];
      let commandCount = 0;
      for (const command of loopTileCommands(model, settings.alternate)) {
        batch.push(command);
        commandCount += 1;
        if (batch.length === 4096) { frame.batch(batch); batch = []; }
      }
      if (batch.length !== 0) frame.batch(batch);
      completed = frame.end();
      p.image(completed, 0, 0);
      return commandCount;
    } finally {
      if (completed) P5Frame.releaseCompleted(completed);
      else if (frame.state !== "completed") frame.abort();
    }
  }

  function paintFans() {
    // Fan drawing is an artistic use of the selected outline, not polygon triangulation,
    // and is outside the shared fresh-raster-2d command vocabulary (segment2/quad2 only,
    // no triangle primitive). It draws directly on the main canvas, matching the
    // established Profile marks precedent for content outside that shared vocabulary.
    const rgbColor = (rgb) => [(rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255];
    p.background(...rgbColor(BACKGROUND_RGB));
    p.noStroke();
    let commandCount = 0;
    for (const triangle of loopFanTriangles(model, settings.alternate)) {
      p.fill(...rgbColor(triangle.rgb), triangle.opacity8);
      p.triangle(triangle.cx, triangle.cy, triangle.x1, triangle.y1, triangle.x2, triangle.y2);
      commandCount += 1;
    }
    return commandCount;
  }

  function paint() {
    try {
      status.textContent = "Drawing…";
      const commandCount = settings.fans ? paintFans() : paintTiles();
      displayedFrame = p.get();
      revision += 1;
      art.dataset.revision = String(revision);
      art.dataset.commandCount = String(commandCount);
      status.textContent = `${settings.fans ? "fan triangles" : "outline + tile marks"} · ${commandCount.toLocaleString()} shapes · ${settings.moved ? "moved" : "baseline"} geometry · ${settings.alternate ? "alternate" : "base"} palette`;
    } catch (error) {
      status.textContent = `Could not draw: ${error.code ?? error.message}`;
      throw error;
    }
  }

  function action(name) {
    if (name === "t") { settings.moved = !settings.moved; rebuildCurves(); }
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "m") settings.fans = !settings.fans;
    else if (name === "0") { settings.moved = false; settings.alternate = false; settings.fans = false; rebuildCurves(); }
    else if (name === "s") { p.saveCanvas("loop-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
