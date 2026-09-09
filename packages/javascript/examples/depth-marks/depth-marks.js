import { gradientNoise3D01 } from "../../src/gradient-noise-3d-01.js";
import { regularGrid } from "../../src/regular-grid.js";
import { RadialProfile3D } from "../../src/radial-profile.js";
import { cyclicPalette } from "../../src/cyclic-palette.js";

/**
 * Editable depth-slice field with a planar dot-field draw mode and a retained-mesh
 * transfer draw mode for DepthMarks. Independently composed; not source replay.
 * Explicit settings here (grid spacing, dot scale, profile shape) are artwork
 * choices, not library defaults or measured ranges. See
 * catalog/validation/gradient-noise-3d-01.json, targets.processing-java.technique.
 */
function makeMesh() {
  const profile = [];
  for (let row = 0; row <= 16; row += 1) {
    const z = -190.0 + row * 380.0 / 16.0;
    const radius = row === 0 || row === 16 ? 0.0 : Math.sqrt(190.0 * 190.0 - z * z);
    profile.push([z, radius]);
  }
  const mesh = RadialProfile3D.generate({
    profile, slices: 32, capStart: false, capEnd: false, maxFaces: 2000,
  });
  const faceCenters = new Float64Array(mesh.faceCount() * 3);
  const triangle = [0, 0, 0], point = [0, 0, 0];
  for (let face = 0; face < mesh.faceCount(); face += 1) {
    mesh.triangleInto(face, triangle, 0);
    for (let corner = 0; corner < 3; corner += 1) {
      mesh.vertexInto(triangle[corner], point, 0);
      for (let axis = 0; axis < 3; axis += 1) faceCenters[face * 3 + axis] += point[axis];
    }
    for (let axis = 0; axis < 3; axis += 1) faceCenters[face * 3 + axis] /= 3.0;
  }
  return { mesh, faceCenters };
}

class DepthComposition {
  #field = gradientNoise3D01({ seed: 42 });
  #grid = regularGrid({ origin: [32.0, 32.0], spacing: [9.6, 9.6], columns: 60, rows: 60 });
  #primaryPalette = cyclicPalette({ colors: [0x244451, 0x278c83, 0xd5a942, 0xc65948] });
  #alternatePalette = cyclicPalette({ colors: [0x3c568a, 0x8d5193, 0xd48b58, 0x4b8465] });
  #mesh; #faceCenters;
  #depth = 0.25;
  #alternate = false;
  #meshMode = false;
  #planarSamples; #meshSamples;

  constructor() {
    const built = makeMesh();
    this.#mesh = built.mesh;
    this.#faceCenters = built.faceCenters;
    this.#rebuildSamples();
  }

  #rebuildSamples() {
    const point = [0, 0];
    this.#planarSamples = new Float64Array(this.#grid.size);
    for (let i = 0; i < this.#planarSamples.length; i += 1) {
      this.#grid.pointInto(i, point, 0);
      this.#planarSamples[i] = this.#field.sample(point[0] / 96.0, point[1] / 96.0, this.#depth);
    }
    this.#meshSamples = new Float64Array(this.#mesh.faceCount());
    for (let face = 0; face < this.#meshSamples.length; face += 1) {
      this.#meshSamples[face] = this.#field.sample(
        this.#faceCenters[face * 3] / 96.0 + 3.0,
        this.#faceCenters[face * 3 + 1] / 96.0 + 3.0,
        this.#faceCenters[face * 3 + 2] / 96.0 + this.#depth,
      );
    }
  }

  get grid() { return this.#grid; }
  get mesh() { return this.#mesh; }
  get depth() { return this.#depth; }
  get alternate() { return this.#alternate; }
  get meshMode() { return this.#meshMode; }
  get planarSamples() { return this.#planarSamples; }
  get meshSamples() { return this.#meshSamples; }
  get palette() { return this.#alternate ? this.#alternatePalette : this.#primaryPalette; }

  toggleDepth() { this.#depth = this.#depth === 0.25 ? 1.25 : 0.25; this.#rebuildSamples(); }
  toggleAlternate() { this.#alternate = !this.#alternate; }
  toggleMeshMode() { this.#meshMode = !this.#meshMode; }

  reset() {
    this.#depth = 0.25;
    this.#alternate = false;
    this.#meshMode = false;
    this.#rebuildSamples();
  }
}

export function createDepthMarks() {
  return new DepthComposition();
}
