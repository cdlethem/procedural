import { P5Frame } from "../../src/internal/p5-frame.js";
import { ALTERNATE_PALETTE, BASE_PALETTE, commandCount, createPathMarks, visiblePathMarkCommands } from "./path-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { seed: 42, steps: 2000, distance: 0.4, markLength: 12, trace: false, alternate: false };
let movement = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observePathMarks() {
  return Object.freeze({ movement, revision, settings: Object.freeze({ ...settings }) });
}

function rebuildMovement() {
  movement = createPathMarks(settings.seed, settings.steps, settings.distance);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuildMovement();
    paint();
  };

  function paint() {
    const frame = new P5Frame(p);
    let completed = null;
    try {
      status.textContent = "Drawing…";
      frame.begin({ width: 640, height: 640, density: 1, background: 0xece7da });
      let batch = [];
      let submittedCommandCount = 0;
      const colors = settings.alternate ? ALTERNATE_PALETTE : BASE_PALETTE;
      const rawCommandCount = commandCount(movement, settings.trace);
      for (const command of visiblePathMarkCommands(movement, settings.trace, settings.markLength, colors)) {
        batch.push(command);
        submittedCommandCount += 1;
        if (batch.length === 4096) {
          frame.batch(batch);
          batch = [];
        }
      }
      if (batch.length !== 0) frame.batch(batch);
      completed = frame.end();
      p.image(completed, 0, 0);
      revision += 1;
      art.dataset.revision = String(revision);
      art.dataset.rawCommandCount = String(rawCommandCount);
      art.dataset.submittedCommandCount = String(submittedCommandCount);
      status.textContent = `${commandCount(movement, settings.trace).toLocaleString()} ${settings.trace ? "movement segments" : "perpendicular marks"} · seed ${settings.seed}`;
    } catch (error) {
      status.textContent = `Could not draw: ${error.code ?? error.message}`;
      throw error;
    } finally {
      if (completed) P5Frame.releaseCompleted(completed);
      else if (frame.state !== "completed") frame.abort();
    }
  }

  function action(name) {
    if (name === "m") settings.trace = !settings.trace;
    else if (name === "l") settings.markLength = settings.markLength === 12 ? 24 : 12;
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "n") { settings.steps = settings.steps === 2000 ? 2001 : 2000; rebuildMovement(); }
    else if (name === "d") { settings.distance = settings.distance === 0.4 ? 0.8 : 0.4; rebuildMovement(); }
    else if (name === "s") { p.saveCanvas("path-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
