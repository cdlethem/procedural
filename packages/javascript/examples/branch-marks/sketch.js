import { createBranchComposition } from "./branch-marks.js";

const defaults = { seed: 42, more: false, narrowing: false, binary: false,
  wider: false, forest: false, taper: true, alternate: false };
const settings = { ...defaults };
const palettes = [
  [0x183E4A, 0x225B60, 0x347969, 0xAF5441],
  [0x443D65, 0x765075, 0xA96962, 0xBB793E],
];
const art = document.querySelector("#art"), status = document.querySelector("#status");
let composition, revision = 0, drawnSegments = 0, drawnTips = 0;

/** Read-only state used by the browser workflow probe. */
export function observeBranchMarks() {
  return Object.freeze({ model: composition, composition, revision, drawnSegments, drawnTips,
    settings: Object.freeze({ ...settings }) });
}
function rebuild() {
  composition = createBranchComposition(settings.seed, settings.more, settings.narrowing,
    settings.binary, settings.wider, settings.forest);
}
function rgb(p, color) { p.stroke((color >>> 16) & 255, (color >>> 8) & 255, color & 255); }
function fillRgb(p, color) { p.fill((color >>> 16) & 255, (color >>> 8) & 255, color & 255); }

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1); p.noLoop(); rebuild(); paint();
  };
  function paint() {
    p.background(243, 240, 232);
    const colors = palettes[settings.alternate ? 1 : 0], segment = new Float64Array(4);
    drawnSegments = 0; drawnTips = 0;
    for (let root = 0; root < composition.size; root += 1) {
      const tree = composition.treeAt(root);
      for (let index = 0; index < tree.size; index += 1) {
        tree.segmentInto(index, segment, 0);
        rgb(p, colors[Math.min(colors.length - 1, Math.floor(tree.generationAt(index) / 2))]);
        p.strokeWeight(settings.taper ? Math.fround(Math.max(0.65, tree.lengthAt(index) * 0.035)) : 1);
        p.line(Math.fround(segment[0]), Math.fround(segment[1]), Math.fround(segment[2]), Math.fround(segment[3]));
        drawnSegments += 1;
      }
      if (settings.taper) {
        p.noStroke(); fillRgb(p, colors[colors.length - 1]);
        for (let index = 0; index < tree.size; index += 1) {
          if (tree.childCountAt(index) !== 0) continue;
          tree.segmentInto(index, segment, 0);
          p.ellipse(Math.fround(segment[2]), Math.fround(segment[3]), 4, 4);
          drawnTips += 1;
        }
      }
    }
    revision += 1; art.dataset.revision = String(revision);
    status.textContent = `${drawnSegments} segments in ${composition.size} ${composition.size === 1 ? "tree" : "trees"} · ${drawnTips} actual tips`;
  }
  function action(key) {
    if (key === "s") { p.saveCanvas("branch-marks", "png"); return; }
    if (key === "m") settings.taper = !settings.taper;
    else if (key === "c") settings.alternate = !settings.alternate;
    else {
      if (key === "0") Object.assign(settings, defaults);
      else if (key === "r") settings.seed = (settings.seed + 1) >>> 0;
      else if (key === "n") settings.more = !settings.more;
      else if (key === "g") settings.narrowing = !settings.narrowing;
      else if (key === "w") settings.wider = !settings.wider;
      else if (key === "b") settings.binary = !settings.binary;
      else if (key === "x") settings.forest = !settings.forest;
      else return;
      rebuild();
    }
    paint();
  }
  document.querySelector("#controls").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]"); if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
