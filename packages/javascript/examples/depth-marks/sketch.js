import { createDepthMarks } from "./depth-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeDepthMarks() {
  return Object.freeze({ composition, revision });
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    // p5's WEBGL renderer centers the origin at the canvas middle, unlike Processing's
    // P3D which keeps (0,0) at the top-left corner like its 2D renderer. Dot-field
    // drawing below re-applies a top-left translate to match Java's absolute grid
    // coordinates; the mesh-mode Java `translate(320,320)` recentering is then a no-op
    // and is dropped.
    p.createCanvas(640, 640, p.WEBGL).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    composition = createDepthMarks();
    paint();
  };

  function paint() {
    p.background(247, 242, 230);
    p.ortho();
    p.noLights();
    const palette = composition.palette;
    if (!composition.meshMode) {
      p.push();
      p.translate(-p.width / 2, -p.height / 2, 0);
      p.strokeWeight(1.4);
      const point = [0, 0];
      const samples = composition.planarSamples;
      for (let i = 0; i < samples.length; i += 1) {
        composition.grid.pointInto(i, point, 0);
        const n = samples[i];
        const angle = n * Math.PI * 2.0, length = 3.0 + 17.0 * n;
        const [r, g, b] = channels(palette.sample(0.1 + 0.6 * n));
        p.stroke(r, g, b, 210);
        p.line(point[0], point[1], point[0] + Math.cos(angle) * length, point[1] + Math.sin(angle) * length);
      }
      p.pop();
    } else {
      p.push();
      p.lights();
      p.noStroke();
      p.rotateX(0.8);
      p.rotateY(0.5);
      const triangle = [0, 0, 0], point = [0, 0, 0], faceNormal = [0, 0, 0];
      const meshSamples = composition.meshSamples;
      const mesh = composition.mesh;
      p.beginShape(p.TRIANGLES);
      for (let face = 0; face < mesh.faceCount(); face += 1) {
        const [r, g, b] = channels(palette.sample(0.1 + 0.6 * meshSamples[face]));
        p.fill(r, g, b);
        mesh.normalInto(face, faceNormal, 0);
        if (typeof p.normal === "function") p.normal(faceNormal[0], faceNormal[1], faceNormal[2]);
        mesh.triangleInto(face, triangle, 0);
        for (let corner = 0; corner < 3; corner += 1) {
          mesh.vertexInto(triangle[corner], point, 0);
          p.vertex(point[0], point[1], point[2]);
        }
      }
      p.endShape();
      p.pop();
    }
    revision += 1;
    art.dataset.revision = String(revision);
    status.textContent = `depth ${composition.depth} · ${composition.alternate ? "alternate" : "primary"} palette · ${composition.meshMode ? "mesh" : "planar"}`;
  }

  function action(name) {
    if (name === "z") composition.toggleDepth();
    else if (name === "c") composition.toggleAlternate();
    else if (name === "m") composition.toggleMeshMode();
    else if (name === "0") composition.reset();
    else if (name === "s") { p.saveCanvas("depth-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
