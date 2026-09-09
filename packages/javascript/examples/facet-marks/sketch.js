import { createFacetMarks } from "./facet-marks.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
const settings = { seed: 42, fine: false, cells: false, alternate: false, sites: false, mode: 0 };
const palette = cyclicPalette({ colors: [0x173f5f, 0xaf5441, 0xe9c46a, 0x347969] });
const otherPalette = cyclicPalette({ colors: [0x493657, 0xb85065, 0xe6b89c, 0x467c89] });
let model = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeFacetMarks() {
  return Object.freeze({ model, revision, settings: Object.freeze({ ...settings }) });
}

function rebuild() {
  model = createFacetMarks(settings.seed, settings.fine, settings.cells);
}

function faceColor(index) {
  return (settings.alternate ? otherPalette : palette).sample(index * 0.173);
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.P2D).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    rebuild();
    paint();
  };

  function paint() {
    p.background(243, 240, 232);
    const mesh = model.mesh;
    const face = [0, 0, 0], edge = [0, 0], incidence = [0, 0];
    const a = [0, 0], b = [0, 0], c = [0, 0];
    if (settings.mode === 0) {
      p.noStroke();
      for (let i = 0; i < mesh.faceCount; i += 1) {
        mesh.triangleInto(i, face);
        mesh.pointInto(face[0], a); mesh.pointInto(face[1], b); mesh.pointInto(face[2], c);
        const [r, g, bl] = channels(faceColor(i));
        p.fill(r, g, bl);
        p.triangle(a[0], a[1], b[0], b[1], c[0], c[1]);
      }
    } else if (settings.mode === 1) {
      p.noFill(); p.strokeWeight(1.1);
      // Traverse unique edges, so an interior edge is drawn once rather than twice.
      for (let i = 0; i < mesh.edgeCount; i += 1) {
        mesh.edgeInto(i, edge); mesh.edgeFacesInto(i, incidence);
        mesh.pointInto(edge[0], a); mesh.pointInto(edge[1], b);
        const [r, g, bl] = channels(faceColor(incidence[0]));
        p.stroke(r, g, bl);
        p.line(a[0], a[1], b[0], b[1]);
      }
    } else {
      p.noFill(); p.strokeWeight(1);
      for (let i = 0; i < mesh.faceCount; i += 1) {
        const grain = model.grain[i];
        const [r, g, bl] = channels(faceColor(i));
        p.stroke(r, g, bl, 170);
        for (let pt = 0; pt < grain.size; pt += 1) {
          grain.pointInto(pt, a);
          p.point(a[0], a[1]);
        }
      }
    }
    if (settings.sites) {
      p.noStroke(); p.fill(30, 35, 40); p.ellipseMode(p.CENTER);
      for (let i = 0; i < mesh.vertexCount; i += 1) {
        mesh.pointInto(i, a);
        p.ellipse(a[0], a[1], 4, 4);
      }
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.faceCount = String(mesh.faceCount);
    art.dataset.grainCount = String(model.grainCount);
    const modeName = ["fill", "wire", "grain"][settings.mode];
    status.textContent = `${mesh.faceCount} faces (${model.grainCount} grain points) · seed ${settings.seed} · ${settings.fine ? "fine" : "coarse"} · ${settings.cells ? "cell" : "disc"} sites · ${modeName}`;
  }

  function action(name) {
    if (name === "m") { settings.mode = (settings.mode + 1) % 3; }
    else if (name === "c") settings.alternate = !settings.alternate;
    else if (name === "p") settings.sites = !settings.sites;
    else if (name === "n") { settings.fine = !settings.fine; rebuild(); }
    else if (name === "x") { settings.cells = !settings.cells; rebuild(); }
    else if (name === "r") { settings.seed = (settings.seed + 1) >>> 0; rebuild(); }
    else if (name === "0") {
      settings.seed = 42; settings.fine = false; settings.cells = false;
      settings.alternate = false; settings.sites = false; settings.mode = 0;
      rebuild();
    } else if (name === "s") { p.saveCanvas("facet-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
