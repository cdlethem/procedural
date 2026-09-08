import { P5Frame } from "../../src/internal/p5-frame.js";
import { BACKGROUND_RGB, COLORS, createCutBranchMarks, cutBranchCommands } from "./cut-branch-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { seed: 42, narrow: false, sparse: false, alternate: false, colorIndex: 0 };
let model = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeCutBranchMarks() {
  return Object.freeze({ model, revision, settings: Object.freeze({ ...settings }) });
}

function rebuild() {
  model = createCutBranchMarks(settings.seed, settings.narrow, settings.sparse, settings.alternate);
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(960, 960, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuild();
    paint();
  };

  function paint() {
    const frame = new P5Frame(p);
    let completed = null;
    try {
      status.textContent = "Cutting…";
      frame.begin({ width: 960, height: 960, density: 1, background: BACKGROUND_RGB });
      let batch = [];
      let commandCount = 0;
      for (const command of cutBranchCommands(model, settings.colorIndex)) {
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
      status.textContent = `${commandCount.toLocaleString()} retained cuts · seed ${settings.seed} · ${settings.narrow ? "narrow" : "wide"} angle · ${settings.sparse ? "sparse" : "dense"} work · ${settings.alternate ? "alternate" : "base"} stroke`;
    } catch (error) {
      status.textContent = `Could not draw: ${error.code ?? error.message}`;
      throw error;
    } finally {
      if (completed) P5Frame.releaseCompleted(completed);
      else if (frame.state !== "completed") frame.abort();
    }
  }

  function action(name) {
    if (name === "c") settings.colorIndex = (settings.colorIndex + 1) % COLORS.length;
    else if (name === "a") { settings.narrow = !settings.narrow; rebuild(); }
    else if (name === "w") { settings.sparse = !settings.sparse; rebuild(); }
    else if (name === "t") { settings.alternate = !settings.alternate; rebuild(); }
    else if (name === "r") { settings.seed = (settings.seed + 1) >>> 0; rebuild(); }
    else if (name === "0") { settings.seed = 42; settings.narrow = false; settings.sparse = false; settings.alternate = false; settings.colorIndex = 0; rebuild(); }
    else if (name === "s") { p.saveCanvas("cut-branch-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
