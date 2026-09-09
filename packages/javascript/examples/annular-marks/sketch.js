import { createAnnularMarks } from "./annular-marks.js";

const status = document.querySelector("#status");
const controls = document.querySelector("#controls");
const art = document.querySelector("#art");
let composition = null;
let revision = 0;

/** Immutable browser-test observation only; it exposes no mutation or redraw capability. */
export function observeAnnularMarks() {
  return Object.freeze({ composition, revision });
}

function channels(rgb) {
  return [(rgb >>> 16) & 0xff, (rgb >>> 8) & 0xff, rgb & 0xff];
}

new window.p5((p) => {
  p.setup = () => {
    // p5's WEBGL renderer centers the origin at the canvas middle, unlike Processing's
    // P3D which keeps (0,0) at the top-left corner. The single-instance mode's Java
    // `translate(320,320)` recentring is a no-op here and is dropped (as in DepthMarks);
    // the arrangement mode's absolute top-left instance positions are converted by
    // subtracting (width/2, height/2) once per instance.
    p.createCanvas(640, 640, p.WEBGL).parent("art");
    p.pixelDensity(1);
    p.noLoop();
    composition = createAnnularMarks();
    paint();
  };

  function paintMesh(recolored) {
    const mesh = composition.mesh;
    const normal = [0, 0, 0], point = [0, 0, 0], triangle = [0, 0, 0];
    p.beginShape(p.TRIANGLES);
    for (let face = 0; face < mesh.faceCount; face += 1) {
      const [r, g, b] = channels(composition.faceColor(mesh.faceKindAt(face), recolored));
      p.fill(r, g, b);
      mesh.normalInto(face, normal, 0);
      if (typeof p.normal === "function") p.normal(normal[0], normal[1], normal[2]);
      mesh.triangleInto(face, triangle, 0);
      for (let corner = 0; corner < 3; corner += 1) {
        mesh.vertexInto(triangle[corner], point, 0);
        p.vertex(point[0], point[1], point[2]);
      }
    }
    p.endShape();
  }

  function paint() {
    p.background(24, 27, 34);
    p.ortho();
    // p5's WEBGL directional/ambient light lists accumulate across repeated calls
    // outside its normal per-frame draw() lifecycle (this sketch calls paint()
    // directly from click/key handlers, not through p.draw()+redraw()); clearing
    // with noLights() immediately before lights() keeps each paint's lighting
    // identical to a single fresh Processing draw() frame instead of compounding.
    p.noLights();
    p.lights();
    p.noStroke();
    if (composition.arrangement) {
      for (let instance = 0; instance < 3; instance += 1) {
        p.push();
        p.translate(155 + 165 * instance - p.width / 2, 225 + 90 * (instance % 2) - p.height / 2, 0);
        p.rotateX(0.9);
        p.rotateY(0.3 + instance * 0.25);
        p.scale(0.62);
        paintMesh(composition.alternate !== (instance === 1));
        p.pop();
      }
    } else {
      p.push();
      p.rotateX(0.9);
      p.rotateY(0.3);
      paintMesh(composition.alternate);
      p.pop();
    }
    revision += 1;
    art.dataset.revision = String(revision);
    art.dataset.meshBuilds = String(composition.meshBuilds);
    status.textContent = `${composition.wide ? "wide" : "narrow"} · ${composition.deep ? "deep" : "shallow"} · ${composition.coarse ? "coarse" : "fine"} · ${composition.alternate ? "alternate" : "primary"} · ${composition.arrangement ? "triple" : "single"} · builds ${composition.meshBuilds}`;
  }

  function action(name) {
    if (name === "w") composition.toggleWide();
    else if (name === "d") composition.toggleDeep();
    else if (name === "f") composition.toggleCoarse();
    else if (name === "c") composition.toggleAlternate();
    else if (name === "m") composition.toggleArrangement();
    else if (name === "0") composition.reset();
    else if (name === "s") { p.saveCanvas("annular-marks", "png"); return; }
    else return;
    paint();
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (button) action(button.dataset.action);
  });
  p.keyPressed = () => action(String(p.key).toLowerCase());
}, art);
