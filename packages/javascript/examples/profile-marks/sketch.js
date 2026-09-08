import { createProfileComposition } from "./profile-marks.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

const defaults = { profile: 0, slices: 32, capStart: true, capEnd: true, alternate: false, trio: false };
const settings = { ...defaults };
const palettes = [cyclicPalette({ colors: [0xEBB858, 0xEEA8C1, 0xD0CBC3, 0x87B6C4, 0xEA4140, 0x5A5787] }), cyclicPalette({ colors: [0x243B53, 0x3E8C93, 0xE9C46A, 0xE76F51] })];
const art = document.querySelector("#art"), status = document.querySelector("#status");
let composition, revision = 0, drawnFaces = 0, acknowledgedImage = null;

/** Read-only browser-probe state. */
export function observeProfileMarks() { return Object.freeze({ composition, revision, drawnFaces, settings: Object.freeze({ ...settings }), acknowledgedImage }); }
function rebuild() { composition = createProfileComposition(settings.slices, settings.capStart, settings.capEnd); }
function color(p, rgb) { p.fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255); }
function downloadAcknowledged() {
  if (acknowledgedImage === null) return;
  const anchor = document.createElement("a"); anchor.href = acknowledgedImage; anchor.download = "profile-marks.png"; anchor.click();
}
new window.p5((p) => {
  p.setup = () => {
    p.createCanvas(640, 640, p.WEBGL).parent("art"); p.pixelDensity(1); p.noLoop(); rebuild(); p.redraw();
  };
  function drawMesh(mesh, x, objectScale) {
    const normal = new Float64Array(3), triangle = new Int32Array(3), vertex = new Float64Array(3), palette = palettes[settings.alternate ? 1 : 0];
    p.push();
    // WEBGL is canvas-centred; this maps the Java example's upper-left x positions to it.
    p.translate(x - 320, 0, 0); p.rotateX(1); p.rotateY(.35); p.scale(objectScale); p.beginShape(p.TRIANGLES);
    for (let face = 0; face < mesh.faceCount(); face += 1) {
      const band = mesh.bandAt(face), phase = band < 0 ? (mesh.faceKindAt(face) === "start-cap" ? .15 : .65) : band / 8 + mesh.cellAt(face) / (composition.slices * 8);
      color(p, palette.sample(phase));
      mesh.normalInto(face, normal); p.normal(Math.fround(normal[0]), Math.fround(normal[1]), Math.fround(normal[2]));
      mesh.triangleInto(face, triangle);
      for (let corner = 0; corner < 3; corner += 1) { mesh.vertexInto(triangle[corner], vertex); p.vertex(Math.fround(vertex[0]), Math.fround(vertex[1]), Math.fround(vertex[2])); }
      drawnFaces += 1;
    }
    p.endShape(); p.pop();
  }
  p.draw = () => {
    p.background(243, 240, 232); p.noStroke(); p.ambientLight(150); p.directionalLight(255, 255, 255, -.3, .5, -1);
    // Explicit camera/projection: local +Z profile geometry stays local; p5 WEBGL uses centred canvas coordinates.
    p.camera(0, 0, 800, 0, 0, 0, 0, 1, 0); p.ortho(-320, 320, -320, 320, 0, 2000); drawnFaces = 0;
    if (settings.trio) { drawMesh(composition.meshAt(0), 140, .45); drawMesh(composition.meshAt(1), 320, .45); drawMesh(composition.meshAt(2), 500, .45); }
    else drawMesh(composition.meshAt(settings.profile), 320, 1);
    revision += 1; art.dataset.revision = String(revision); status.textContent = `${drawnFaces} retained triangles · ${settings.trio ? "three forms" : ["cylinder", "waist", "pointed"][settings.profile]}`;
    acknowledgedImage = p.canvas.toDataURL("image/png");
  };
  function action(key) {
    if (key === "s") { downloadAcknowledged(); return; }
    if (key === "p") settings.profile = (settings.profile + 1) % 3;
    else if (key === "c") settings.alternate = !settings.alternate;
    else if (key === "x") settings.trio = !settings.trio;
    else { if (key === "d") settings.slices = settings.slices === 32 ? 8 : 32; else if (key === "b") settings.capStart = !settings.capStart; else if (key === "t") settings.capEnd = !settings.capEnd; else if (key === "0") Object.assign(settings, defaults); else return; rebuild(); }
    p.redraw();
  }
  document.querySelector("#controls").addEventListener("click", event => { const button = event.target.closest("button[data-action]"); if (button) action(button.dataset.action); });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
