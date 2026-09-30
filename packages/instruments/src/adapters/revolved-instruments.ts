import { RadialProfile3D, annularSolid3D, gradientNoise3D01 } from "@procedurals/javascript";
import type { ControlGroup, Layer } from "../types.js";
import { choice, numeric, text, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
interface MeshData {
  faceKindAt(face: number): string;
  cellAt(face: number): number;
  vertexInto(index: number, output: Float64Array, offset: number): void;
  triangleInto(face: number, output: Int32Array, offset: number): void;
  normalInto(face: number, output: Float64Array, offset: number): void;
  toValues(): { positions: number[][]; triangles: number[][]; normals: number[][];
    faceKinds: string[]; cells: number[]; bands?: number[] };
}
export interface ProfileMesh extends MeshData {
  vertexCount(): number;
  faceCount(): number;
  bandAt(face: number): number;
  vertexAt(index: number): number[];
  triangleAt(face: number): number[];
}
export interface AnnularMesh extends MeshData {
  readonly vertexCount: number;
  readonly faceCount: number;
  vertexAt(index: number): number[];
  triangleAt(face: number): number[];
}
type Mesh = ProfileMesh | AnnularMesh;
type Webgl = {
  TRIANGLES: string;
  push(): void; pop(): void; translate(x: number, y: number, z: number): void;
  rotateX(radians: number): void; rotateY(radians: number): void; rotateZ(radians: number): void;
  noLights(): void; ambientLight(value: number): void;
  directionalLight(r: number, g: number, b: number, x: number, y: number, z: number): void;
  noStroke(): void; noFill(): void; fill(r: number, g: number, b: number): void;
  stroke(r: number, g: number, b: number): void; strokeWeight(weight: number): void;
  normal(x: number, y: number, z: number): void;
  beginShape(kind: string): void; vertex(x: number, y: number, z: number): void; endShape(): void;
  line(x: number, y: number, z: number, xx: number, yy: number, zz: number): void;
};

const number = (p: Params, key: string): number => p[key] as number;
const flag = (p: Params, key: string): boolean => p[key] === true;


const degree = Math.PI / 180;
const MAX_FACES = 12000;

const sharedMaterial = () => [
  numeric("offsetX", "Offset X", "Mesh center in canvas units; 320 is the canvas center.", -320, 960, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
  numeric("offsetY", "Offset Y", "Mesh center in canvas units; 320 is the canvas center.", -320, 960, 1, { hardMin: -10000, hardMax: 10000, integer: false }),
  numeric("yaw", "Yaw", "Rotation around the mesh Y axis, degrees.", -180, 180, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
  numeric("pitch", "Pitch", "Rotation around the mesh X axis, degrees.", -180, 180, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
  numeric("roll", "Roll", "Rotation around the mesh Z axis, degrees.", -180, 180, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
  toggle("faces", "Faces", "Shade the selected mesh triangles."),
  toggle("edges", "Edges", "Stroke each distinct edge of the selected mesh triangles."),
  numeric("strokeWeight", "Edge weight", "Width of mesh edges in pixels.", .3, 3, .1, { hardMin: .01, hardMax: 30, integer: false }),
  choice("colorMode", "Palette mapping", "One solid color, source bands or face kinds, angular cells, or seeded 3D noise.", ["solid", "band", "angular", "noise"]),
  numeric("noiseScale", "Noise scale", "Local mesh units per noise cycle; only applies to Noise palette mapping.", 25, 250, 1, { hardMin: .001, hardMax: 10000, integer: false }),
  numeric("noiseDepth", "Noise depth offset", "Offset in noise Z coordinate, not geometry depth; only applies to Noise mapping.", -4, 4, .05, { hardMin: -10000, hardMax: 10000, integer: false }),
  numeric("ambient", "Ambient light", "Uniform face-light intensity (0–255).", 0, 200, 1, { hardMin: 0, hardMax: 255, integer: false }),
  numeric("directional", "Directional light", "Directional face-light intensity (0–255).", 0, 255, 1, { integer: false }),
  numeric("lightAzimuth", "Light azimuth", "Light vector's horizontal heading in degrees.", -180, 180, 1, { hardMin: -36000, hardMax: 36000, integer: false }),
  numeric("lightElevation", "Light elevation", "Light vector's vertical inclination in degrees.", -90, 90, 1, { integer: false }),
];
const materialDefaults = { offsetX: 320, offsetY: 320, yaw: 28, pitch: 65, roll: 0,
  faces: true, edges: false, strokeWeight: 1, colorMode: "band", noiseScale: 85, noiseDepth: .5,
  ambient: 115, directional: 220, lightAzimuth: -40, lightElevation: -50 };
const profileControls = () => [text("profile", "Axial profile", "One axial position, radius multiplier pair per line, strictly ascending; dimensionless values can extend outside 0–1.", 1600, true),
  numeric("height", "Axial scale", "Height in canvas units per unit profile axial position.", 60, 450, 1, { hardMin: .001, hardMax: 1000, integer: false }),
  numeric("radius", "Radial scale", "Radius in canvas units per unit profile radius multiplier.", 20, 210, 1, { hardMin: .001, hardMax: 1000, integer: false }),
  numeric("slices", "Angular slices", "Angular mesh cells (integer).", 8, 96, 1, { hardMin: 3, hardMax: 192, integer: true }),
  toggle("capStart", "Start cap", "Close a nonzero-radius first profile ring."),
  toggle("capEnd", "End cap", "Close a nonzero-radius last profile ring."),
  ...sharedMaterial()];
const profileDefaults = {profile: "0, 0.35\n0.14, 0.95\n0.46, 0.68\n0.78, 1.08\n1, 0.42",
  height: 330,
  radius: 120,
  slices: 32,
  capStart: true,
  capEnd: true,
  ...materialDefaults};
const depthDefaults = {...profileDefaults,
  profile: "0, 0.18\n0.12, 0.7\n0.35, 1\n0.59, 0.82\n0.82, 0.43\n1, 0",
  radius: 180,
  height: 360,
  capStart: false,
  capEnd: false,
  colorMode: "noise",
  noiseDepth: .5};
const annularDefaults = {outer: 160,
  inner: 78,
  depth: 110,
  slices: 40,
  startCell: 0,
  visibleCells: 40,
  showTop: true,
  showBottom: true,
  showInner: true,
  showOuter: true,
  ...materialDefaults,
  colorMode: "band"};

/** Placement, palette, lighting and edges are shared by every revolved study. */
const placementGroup: ControlGroup = { label: "Placement", stage: "frame", controls: ["offsetX", "offsetY", { label: "Rotation", controls: ["yaw", "pitch", "roll"] }] };
const paletteGroup: ControlGroup = { label: "Color", stage: "color", controls: ["colorMode", "noiseScale", "noiseDepth"] };
const facesGroup: ControlGroup = { label: "Faces", stage: "material", controls: ["faces",
  { label: "Intensity", controls: ["ambient", "directional"], proportional: true },
  { label: "Direction", controls: ["lightAzimuth", "lightElevation"] }] };
const edgesGroup: ControlGroup = { label: "Edges", stage: "material", controls: ["edges", "strokeWeight"] };
const profileGroups: ControlGroup[] = [
  { label: "Profile", stage: "form", controls: ["profile", { label: "Size", controls: ["height", "radius"], proportional: true }, "slices",
    { label: "Caps", controls: ["capStart", "capEnd"] }] },
  placementGroup, paletteGroup, facesGroup, edgesGroup];

export const revolvedInstrumentDefinitions: StudioDefinition[] = [
  { id: "profile-marks", title: "Profile marks", description: "Editable axial profile revolved by the retained radial mesh source.", renderer: "webgl",
    parameters: profileControls(), controlGroups: profileGroups, defaults: profileDefaults, validate: validateProfile },
  { id: "depth-marks", title: "Depth marks", description: "The same editable radial-profile source, with seeded noise palette mapping.", renderer: "webgl",
    parameters: [...profileControls()], controlGroups: profileGroups,
    defaults: depthDefaults, validate: validateProfile },
  { id: "annular-marks", title: "Annular marks", description: "Core annular solid with independently selected face kinds and angular cells.", renderer: "webgl",
    parameters: [numeric("outer", "Outer radius", "Outer wall radius in canvas units.", 50, 230, 1, { hardMin: .001, hardMax: 1000, integer: false }),
      numeric("inner", "Inner radius", "Inner wall radius in canvas units, strictly below outer radius.", 10, 150, 1, { hardMin: .001, hardMax: 1000, integer: false }),
      numeric("depth", "Solid depth", "Distance from bottom to top annulus in canvas units.", 10, 190, 1, { hardMin: .001, hardMax: 1000, integer: false }),
      numeric("slices", "Angular slices", "Angular mesh cells (integer).", 8, 96, 1, { hardMin: 3, hardMax: 192, integer: true }),
      numeric("startCell", "First visible cell", "Zero-based angular cell to start at.", 0, 39, 1, { hardMin: 0, hardMax: 191, integer: true }),
      numeric("visibleCells", "Visible cells", "How many successive angular cells to draw, wrapping around the ring; zero draws none.", 0, 40, 1, { hardMin: 0, hardMax: 192, integer: true }),
      toggle("showTop", "Top annulus", "Include top annulus faces."),
      toggle("showBottom", "Bottom annulus", "Include bottom annulus faces."),
      toggle("showInner", "Inner wall", "Include inner wall faces."),
      toggle("showOuter", "Outer wall", "Include outer wall faces."),
      ...sharedMaterial()],
    controlGroups: [
      { label: "Solid", stage: "form", controls: [{ label: "Size", controls: ["outer", "inner", "depth"], proportional: true }, "slices",
        { label: "Cells", controls: ["startCell", "visibleCells"] },
        { label: "Face kinds", controls: ["showTop", "showBottom", "showInner", "showOuter"] }] },
      placementGroup, paletteGroup, facesGroup, edgesGroup],
    defaults: annularDefaults, validate: validateAnnular },
];

function bounded(p: Params, key: string, minimum: number, maximum: number, integer = false): void {
  const value = p[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum ||
      (integer && !Number.isSafeInteger(value))) throw new Error(`${key} must be ${integer ? "an integer " : ""}in [${minimum}, ${maximum}]`);
}
function boolean(p: Params, key: string): void {
  if (typeof p[key] !== "boolean") throw new Error(`${key} must be boolean`);
}
function validateMaterial(p: Params): void {
  for (const key of ["offsetX", "offsetY"]) bounded(p, key, -10000, 10000);
  for (const key of ["yaw", "pitch", "roll", "lightAzimuth"]) bounded(p, key, -36000, 36000);
  bounded(p, "lightElevation", -90, 90);
  for (const key of ["ambient", "directional"]) bounded(p, key, 0, 255);
  bounded(p, "strokeWeight", .01, 30);
  bounded(p, "noiseScale", .001, 10000);
  bounded(p, "noiseDepth", -10000, 10000);
  for (const key of ["faces", "edges"]) boolean(p, key);
  if (!["solid", "band", "angular", "noise"].includes(String(p.colorMode))) throw new Error("Invalid palette mapping");
}
export function parseRadialProfile(input: string): [number, number][] {
  if (typeof input !== "string" || input.length > 1600) throw new Error("Profile text is too long");
  const lines = input.trim().split(/\r?\n/);
  if (lines.length < 2 || lines.length > 48) throw new Error("Profile needs 2–48 point pairs");
  let previous = -Infinity;
  return lines.map((line, index) => {
    const parts = line.trim().split(/[\s,]+/);
    if (parts.length !== 2 || parts.some(part => !part || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(part)))
      throw new Error(`Profile line ${index + 1} must contain axial position and radius multiplier`);
    const axial = Number(parts[0]), radius = Number(parts[1]);
    if (!Number.isFinite(axial) || Math.abs(axial) > 8 || !Number.isFinite(radius) || radius < 0 || radius > 8 ||
        (index > 0 && axial <= previous) || (index > 0 && index < lines.length - 1 && radius === 0))
      throw new Error(`Profile line ${index + 1} must have ascending axial position in [-8, 8] and radius in [0, 8] (interior > 0)`);
    previous = axial;
    return [axial, radius];
  });
}
function validateProfile(p: Params): [number, number][] {
  
  validateMaterial(p);
  bounded(p, "height", .001, 1000); bounded(p, "radius", .001, 1000); bounded(p, "slices", 3, 192, true);
  boolean(p, "capStart"); boolean(p, "capEnd");
  const profile = parseRadialProfile(p.profile as string);
  if (profile.length === 2 && profile[0][1] === 0 && profile[1][1] === 0)
    throw new Error("A two-point profile cannot have two zero-radius poles");
  const poles = Number(profile[0][1] === 0) + Number(profile[profile.length - 1][1] === 0);
  const caps = Number(flag(p, "capStart") && profile[0][1] > 0) + Number(flag(p, "capEnd") && profile[profile.length - 1][1] > 0);
  const faces = number(p, "slices") * (2 * (profile.length - 1) - poles + caps);
  if (faces > MAX_FACES) throw new Error(`Radial profile exceeds ${MAX_FACES} faces`);
  return profile;
}
function validateAnnular(p: Params): void {
  
  validateMaterial(p);
  for (const key of ["outer", "inner", "depth"]) bounded(p, key, .001, 1000);
  if (number(p, "outer") <= number(p, "inner")) throw new Error("Outer radius must exceed inner radius");
  bounded(p, "slices", 3, 192, true);
  bounded(p, "startCell", 0, number(p, "slices") - 1, true);
  bounded(p, "visibleCells", 0, number(p, "slices"), true);
  for (const key of ["showTop", "showBottom", "showInner", "showOuter"]) boolean(p, key);
}

let lastProfile: { key: string; mesh: ProfileMesh } | undefined;
let lastAnnular: { key: string; mesh: AnnularMesh } | undefined;
/** Build the retained SDK mesh; palette, lighting and canvas placement never alter this source. */
export function buildProfileMesh(p: Params): ProfileMesh {
  const points = validateProfile(p);
  const key = JSON.stringify([points, p.height, p.radius, p.slices, p.capStart, p.capEnd]);
  if (lastProfile?.key === key) return lastProfile.mesh;
  const mesh = RadialProfile3D.generate({
    profile: points.map(([axial, radial]): [number, number] => [(axial - .5) * number(p, "height"), radial * number(p, "radius")]),
    slices: number(p, "slices"), capStart: flag(p, "capStart"), capEnd: flag(p, "capEnd"), maxFaces: MAX_FACES,
  });
  lastProfile = { key, mesh };
  return mesh;
}
/** Build the retained annular-solid SDK mesh; cell visibility is a rendering filter. */
export function buildAnnularMesh(p: Params): AnnularMesh {
  validateAnnular(p);
  const key = JSON.stringify([p.outer, p.inner, p.depth, p.slices]);
  if (lastAnnular?.key === key) return lastAnnular.mesh;
  const mesh = annularSolid3D({ outerRadius: number(p, "outer"), innerRadius: number(p, "inner"),
    bottomZ: -number(p, "depth") / 2, topZ: number(p, "depth") / 2,
    slices: number(p, "slices"), maxFaces: MAX_FACES });
  lastAnnular = { key, mesh };
  return mesh;
}
function selectedAnnular(mesh: AnnularMesh, face: number, p: Params): boolean {
  const kind = mesh.faceKindAt(face);
  if (!(kind === "top-annulus" && flag(p, "showTop") || kind === "bottom-annulus" && flag(p, "showBottom") ||
        kind === "inner-wall" && flag(p, "showInner") || kind === "outer-wall" && flag(p, "showOuter"))) return false;
  const relative = (mesh.cellAt(face) - number(p, "startCell") + number(p, "slices")) % number(p, "slices");
  return relative < number(p, "visibleCells");
}
function bandIndex(mesh: Mesh, face: number, annular: boolean): number {
  if (annular) {
    const kind = mesh.faceKindAt(face);
    return kind === "outer-wall" ? 0 : kind === "inner-wall" ? 1 : kind === "top-annulus" ? 2 : 3;
  }
  const radial = mesh as ProfileMesh;
  const band = radial.bandAt(face);
  return band < 0 ? (radial.faceKindAt(face) === "start-cap" ? 0 : 1) : band + 2;
}
function drawMesh(p: Webgl, layer: Layer, mesh: Mesh, annular: boolean): void {
  const q = layer.params;
  const faces = annular ? (mesh as AnnularMesh).faceCount : (mesh as ProfileMesh).faceCount();
  const triangle = new Int32Array(3), normal = new Float64Array(3), a = new Float64Array(3), b = new Float64Array(3);
  const colorMode = String(q.colorMode);
  const noise = colorMode === "noise" ? gradientNoise3D01({ seed: layer.seed }) : undefined;
  const palette = layer.palette;
  const colored = (face: number): number => {
    let index = 0;
    if (colorMode === "band") index = bandIndex(mesh, face, annular);
    if (colorMode === "angular") index = mesh.cellAt(face);
    if (noise) {
      mesh.triangleInto(face, triangle, 0);
      let x = 0, y = 0, z = 0;
      for (let i = 0; i < 3; i++) {
        mesh.vertexInto(triangle[i], a, 0);
        x += a[0]; y += a[1]; z += a[2];
      }
      const scale = number(q, "noiseScale") * 3;
      index = Math.min(palette.length - 1, Math.floor(noise.sample(x / scale, y / scale, z / scale + number(q, "noiseDepth")) * palette.length));
    }
    return palette[index % palette.length];
  };
  p.push();
  p.translate(number(q, "offsetX") - 320, number(q, "offsetY") - 320, 0);
  p.rotateZ(number(q, "roll") * degree);
  p.rotateY(number(q, "yaw") * degree);
  p.rotateX(number(q, "pitch") * degree);
  const drawingFaces = flag(q, "faces"), drawingEdges = flag(q, "edges");
  const savedColors = noise && drawingFaces && drawingEdges ? new Uint32Array(faces) : undefined;
  if (drawingFaces) {
    p.noLights();
    p.ambientLight(number(q, "ambient"));
    const azimuth = number(q, "lightAzimuth") * degree, elevation = number(q, "lightElevation") * degree;
    const light = number(q, "directional");
    p.directionalLight(light, light, light, Math.cos(elevation) * Math.cos(azimuth), Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation));
    p.noStroke();
    for (let face = 0; face < faces; face++) {
      if (annular && !selectedAnnular(mesh as AnnularMesh, face, q)) continue;
      const color = colored(face);
      if (savedColors) savedColors[face] = color;
      p.fill((color >>> 16) & 255, (color >>> 8) & 255, color & 255);
      mesh.normalInto(face, normal, 0);
      mesh.triangleInto(face, triangle, 0);
      p.beginShape(p.TRIANGLES);
      p.normal(normal[0], normal[1], normal[2]);
      for (let corner = 0; corner < 3; corner++) {
        mesh.vertexInto(triangle[corner], a, 0);
        p.vertex(a[0], a[1], a[2]);
      }
      p.endShape();
    }
  }
  if (drawingEdges) {
    const seen = new Set<number>();
    const vertices = annular ? (mesh as AnnularMesh).vertexCount : (mesh as ProfileMesh).vertexCount();
    p.noLights(); p.noFill(); p.strokeWeight(number(q, "strokeWeight"));
    for (let face = 0; face < faces; face++) {
      if (annular && !selectedAnnular(mesh as AnnularMesh, face, q)) continue;
      const color = savedColors ? savedColors[face] : colored(face);
      p.stroke((color >>> 16) & 255, (color >>> 8) & 255, color & 255);
      mesh.triangleInto(face, triangle, 0);
      for (let corner = 0; corner < 3; corner++) {
        const first = triangle[corner], second = triangle[(corner + 1) % 3];
        const key = Math.min(first, second) * vertices + Math.max(first, second);
        if (seen.has(key)) continue;
        seen.add(key);
        mesh.vertexInto(first, a, 0); mesh.vertexInto(second, b, 0);
        p.line(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    }
  }
  p.pop();
}
export function drawRevolvedInstrument(p: Webgl, layer: Layer): void {
  
  const annular = layer.technique === "annular-marks";
  if (!annular && layer.technique !== "profile-marks" && layer.technique !== "depth-marks")
    throw new Error(`Unsupported revolved instrument: ${layer.technique}`);
  const q = layer.params;
  if (!flag(q, "faces") && !flag(q, "edges") ||
      annular && (number(q, "visibleCells") === 0 || !["showTop", "showBottom", "showInner", "showOuter"].some(key => flag(q, key)))) {
    if (annular) validateAnnular(q); else validateProfile(q);
    return;
  }
  const mesh = annular ? buildAnnularMesh(layer.params) : buildProfileMesh(layer.params);
  drawMesh(p, layer, mesh, annular);
}
