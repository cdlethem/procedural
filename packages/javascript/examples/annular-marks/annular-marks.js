import { annularSolid3D } from "../../src/annular-mesh.js";

export const PRIMARY = Object.freeze([0x7597aa, 0xb66d55, 0xeac798, 0x585e77]);
export const ALTERNATE = Object.freeze([0xd386a2, 0x51776c, 0x9fc5ae, 0x696482]);
const KIND_INDEX = Object.freeze({ "outer-wall": 0, "inner-wall": 1, "top-annulus": 2, "bottom-annulus": 3 });

function rebuild(wide, deep, coarse) {
  return annularSolid3D({
    outerRadius: 150.0,
    innerRadius: wide ? 60.0 : 110.0,
    bottomZ: deep ? -45.0 : -15.0,
    topZ: deep ? 45.0 : 15.0,
    slices: coarse ? 12 : 48,
    maxFaces: 384,
  });
}

/**
 * Editable owned indexed closed annular mesh study for AnnularMarks. Motivated by
 * survey/out/2017/Generativos/aros/notes.md (the annulusMesh candidate and its
 * generalisation decision). Width, depth, facet count, colors, and instance
 * arrangement here are authored study settings, not AnnularMesh3D defaults or
 * recommended parameter ranges. See catalog/validation/annular-mesh.json,
 * targets.processing-java.technique.
 */
class AnnularComposition {
  #wide = false;
  #deep = false;
  #coarse = false;
  #alternate = false;
  #arrangement = false;
  #mesh;
  #meshBuilds = 0;

  constructor() {
    this.#mesh = rebuild(this.#wide, this.#deep, this.#coarse);
    this.#meshBuilds = 1;
  }

  get mesh() { return this.#mesh; }
  get wide() { return this.#wide; }
  get deep() { return this.#deep; }
  get coarse() { return this.#coarse; }
  get alternate() { return this.#alternate; }
  get arrangement() { return this.#arrangement; }
  get meshBuilds() { return this.#meshBuilds; }

  #rebuild() {
    this.#mesh = rebuild(this.#wide, this.#deep, this.#coarse);
    this.#meshBuilds += 1;
  }

  faceColor(kind, recolored) {
    return (recolored ? ALTERNATE : PRIMARY)[KIND_INDEX[kind]];
  }

  toggleWide() { this.#wide = !this.#wide; this.#rebuild(); }
  toggleDeep() { this.#deep = !this.#deep; this.#rebuild(); }
  toggleCoarse() { this.#coarse = !this.#coarse; this.#rebuild(); }
  toggleAlternate() { this.#alternate = !this.#alternate; }
  toggleArrangement() { this.#arrangement = !this.#arrangement; }

  reset() {
    const geometryChanged = this.#wide || this.#deep || this.#coarse;
    this.#wide = false;
    this.#deep = false;
    this.#coarse = false;
    this.#alternate = false;
    this.#arrangement = false;
    if (geometryChanged) this.#rebuild();
  }
}

export function createAnnularMarks() {
  return new AnnularComposition();
}
