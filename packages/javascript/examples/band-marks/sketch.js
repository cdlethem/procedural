import { P5Frame } from "../../src/internal/p5-frame.js";
import { BACKGROUND_RGB, bandPathCommands, createBandMarks } from "./band-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { wider: false, alternate: false, marks: false };
let model = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeBandMarks() {
  return Object.freeze({ model, revision, settings: Object.freeze({ ...settings }) });
}

function rebuildPaths() {
  model = createBandMarks(settings.wider);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuildPaths();
    paint();
  };

  function paint() {
    const frame = new P5Frame(p);
    let completed = null;
    try {
      status.textContent = "Drawing…";
      frame.begin({ width: 640, height: 640, density: 1, background: BACKGROUND_RGB });
      let batch = [];
      let commandCount = 0;
      for (const command of bandPathCommands(model, settings.alternate, settings.marks)) {
        batch.push(command);
        commandCount += 1;
        if (batch.length === 4096) { frame.batch(batch); batch = []; }
      }
      if (batch.length !== 0) frame.batch(batch);
      completed = frame.end();
      p.image(completed, 0, 0);
      revision += 1;
      art.dataset.revision = String(revision);
      art.dataset.commandCount = String(commandCount);
      status.textContent = `${commandCount.toLocaleString()} ${settings.marks ? "tick marks" : "path segments"} · ${settings.wider ? "wide" : "narrow"} tolerance · ${settings.alternate ? "alternate" : "base"} palette`;
    } catch (error) {
      status.textContent = `Could not draw: ${error.code ?? error.message}`;
      throw error;
    } finally {
      if (completed) P5Frame.releaseCompleted(completed);
      else if (frame.state !== "completed") frame.abort();
    }
  }

  function action(name) {
    if (name === "t") { settings.wider = !settings.wider; rebuildPaths(); }
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "m") settings.marks = !settings.marks;
    else if (name === "0") { settings.wider = false; settings.alternate = false; settings.marks = false; rebuildPaths(); }
    else if (name === "s") { p.saveCanvas("band-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
