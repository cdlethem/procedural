import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["bores", "cells", "branches", "twigs", "iterations", "repeatX", "repeatY", "repeatZ", "levels", "pointCount", "steps", "meshDetail", "slices"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: [string, string][], visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, options.map(([value]) => value)), options: options.map(([value, name]) => ({ value, label: name })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  withCondition(toggle(key, label, description), visibleWhen);

const block: Condition = { form: ["carved-block"] };
const lattice: Condition = { form: ["lattice-cavity"] };
const blended: Condition = { form: ["lattice-cavity", "coral"] };
const growth: Condition = { form: ["coral"] };
const folded: Condition = { form: ["fractal-fragment"] };
const cutting: Condition = { cut: ["half", "quarter", "corner", "slot"] };
const turning: Condition = { cut: ["half", "quarter", "corner"] };
const hollowed: Condition = { hollow: [true] };
const ordered: Condition = { hollow: [true], cut: ["half", "quarter", "corner", "slot"] };
const perspective: Condition = { projection: ["perspective"] };
const painted: Condition = { fill: ["cells", "bands", "facets", "points"] };
const raymarched: Condition = { fill: ["cells", "bands"] };
const cells: Condition = { fill: ["cells"] };
const grains: Condition = { fill: ["points"] };
const creased: Condition = { creases: [true] };

const parameters: Parameter[] = [
  select("form", "Form", "The signed-distance tree to start from: a block carved by cylinders, a block hollowed by a lattice of voids and tunnels, a smooth union of seeded limbs, or a bounded fractal fold. Everything below (cutaway, shell, twist, repeat) then works on it.",
    [["carved-block", "Carved block"], ["lattice-cavity", "Lattice cavity"], ["coral", "Coral"], ["fractal-fragment", "Fractal fragment"]]),
  n("roundness", "Roundness", "Intersects the block with a sphere: 0 keeps the sharp cube, 1 leaves the sphere that touches the cube's faces, values between rub down only the corners.", 0, 1, 0.01, 0, 1, block),
  n("bores", "Bores", "Cylinders subtracted through the block: one along the vertical axis, two adds the left-right axis, three adds front-back.", 0, 3, 1, 0, 3, block),
  n("boreRadius", "Bore radius", "Radius of the drilled cylinders, in half-block units (the block's half side is 1).", 0.1, 0.7, 0.01, 0.02, 0.95, block),
  n("cells", "Cells per side", "Voids along each axis: the bounded repeat is cells x cells x cells copies, each cell as wide as the block divided by this.", 1, 6, 1, 1, 8, lattice),
  n("voidSize", "Void size", "Void radius as a fraction of half a cell: 1 makes neighbouring voids touch.", 0.2, 1, 0.01, 0.05, 1, lattice),
  n("tunnel", "Tunnels", "Radius of the tunnels joining the voids along the three axes, as a fraction of the void radius. 0 leaves closed voids, only visible in a cutaway.", 0, 1, 0.01, 0, 1, lattice),
  n("voidKeep", "Voids kept", "Share of voids and of tunnel lines present: each keeps itself by a stable hash of the seed, so a new seed reshuffles which are missing, including the holes on the faces. 0 carves nothing.", 0, 1, 0.01, 0, 1, lattice),
  n("blend", "Blend", "Smooth-union width: how far neighbouring limbs (coral) or cavities (lattice) flow into each other, as a share of the limb length or the cell. 0 is a hard union.", 0, 1, 0.01, 0, 1, blended),
  n("branches", "Branches", "Limbs leaving the trunk at seeded heights, azimuths, tilts and lengths.", 1, 10, 1, 1, 10, growth),
  n("twigs", "Twigs per branch", "Side limbs forking from every branch tip.", 0, 2, 1, 0, 2, growth),
  n("spread", "Spread", "How far limbs lean from the vertical, in radians of tilt (0.4 to 1.2 is a fan).", 0.1, 1.3, 0.01, 0, 1.5, growth),
  n("thickness", "Limb radius", "Radius of every limb, in half-block units; twigs are 70 percent of it.", 0.03, 0.16, 0.005, 0.01, 0.3, growth),
  flag("bulbs", "Tip knobs", "A knob at the end of every branch and twig.", growth),
  select("fold", "Fold", "The fractal: a Menger sponge folds space by absolute value and sorting then scales by 3, a tetrahedral fold reflects then scales by 2. The solid is the union of 20^n or 4^n shrunk copies of the shape.",
    [["menger", "Menger sponge"], ["tetra", "Tetrahedral"]], folded),
  n("iterations", "Iterations", "Fold levels, capped at 5: each multiplies the copy count and divides their size. 0 is the plain shape.", 0, 5, 1, 0, 5, folded),
  select("foldShape", "Shape", "What is copied: a cube, or a sphere that overlaps its copies into a fused, beaded solid.", [["box", "Cube"], ["sphere", "Sphere"]], folded),

  n("centerX", "Center X", "Horizontal canvas position of the sculpture's centre.", 80, 560, 1, -100000, 100000),
  n("centerY", "Center Y", "Vertical canvas position of the sculpture's centre.", 80, 560, 1, -100000, 100000),
  n("size", "Size", "Canvas diameter of the sphere that bounds the sculpture. The sculpture is always scaled to it, so adding repeats or a cut never changes the framing.", 120, 900, 1, 20, 100000),

  select("cut", "Cutaway", "Removes a slab, wedge or octant so the inside shows: a half-space, the quarter beyond a corner column, an octant beyond a corner, or a thin horizontal slot.",
    [["none", "None"], ["half", "Half"], ["quarter", "Quarter"], ["corner", "Corner"], ["slot", "Slot"]]),
  n("cutAt", "Cut position", "Where the cutting planes sit, in half-block units: 0 through the middle, positive keeps more of the sculpture on the side that is cut, negative less.", -0.9, 0.9, 0.01, -2.5, 2.5, cutting),
  n("cutTurn", "Cut direction", "Turns the cutter about the vertical axis, degrees clockwise seen from above, so the opening can face the camera.", -180, 180, 1, -3600, 3600, turning),
  flag("hollow", "Hollow", "Turns the sculpture into a skin: the field becomes its distance from the surface, minus half the wall, so both faces of the wall are surfaces."),
  n("wall", "Wall", "Thickness of the skin, in half-block units.", 0.02, 0.3, 0.005, 0.005, 1, hollowed),
  select("order", "Operation order", "Shell first shells the solid and then cuts the shell open, showing the hollow between two skins; cut first cuts the solid and then shells it, so every cut face is skinned as well.",
    [["shell-first", "Shell, then cut"], ["cut-first", "Cut, then shell"]], ordered),

  n("twist", "Twist", "Rotates every level about the vertical axis by this many radians per world unit of height. The field is divided by a Lipschitz constant so marching stays safe, at the cost of shorter steps.", -2, 2, 0.05, -12, 12),
  n("bend", "Bend", "Rotates about the front-back axis by this many radians per world unit of width, curling the sculpture like a banana.", -1, 1, 0.02, -6, 6),

  n("repeatX", "Copies across", "Bounded repetition of the whole sculpture along the left-right axis.", 1, 4, 1, 1, 12),
  n("repeatY", "Copies up", "Bounded repetition along the vertical axis.", 1, 4, 1, 1, 12),
  n("repeatZ", "Copies deep", "Bounded repetition along the front-back axis.", 1, 4, 1, 1, 12),
  n("repeatGap", "Copy gap", "Space between copies as a share of the sculpture's extent; 0 makes them touch. It cannot be negative because overlapping copies would break the distance bound.", 0, 1.5, 0.01, 0, 10),

  select("projection", "Projection", "Orthographic keeps parallel lines parallel; perspective draws farther parts smaller.", [["orthographic", "Orthographic"], ["perspective", "Perspective"]]),
  n("yaw", "Yaw", "Swings the viewer around the sculpture, degrees; positive moves the eye toward the right.", -180, 180, 1, -3600, 3600),
  n("pitch", "Pitch", "Raises the viewer above the horizon, degrees; 90 looks straight down.", -89, 89, 1, -90, 90),
  n("roll", "Roll", "Turns the picture about the viewing axis, degrees clockwise.", -180, 180, 1, -3600, 3600),
  n("distance", "Distance", "Eye distance in units of the bounding sphere's radius: small is a wide-angle close-up, large approaches orthographic.", 1.3, 8, 0.05, 1.1, 60, perspective),

  n("lightAzimuth", "Light around", "Direction of the light in the viewer's frame, degrees: 0 from the front, negative from the left, positive from the right.", -180, 180, 1, -3600, 3600, painted),
  n("lightElevation", "Light height", "Height of the light above the viewer's horizon, degrees.", -80, 89, 1, -90, 90, painted),
  n("ambient", "Ambient", "Light every surface receives whatever way it faces; low values give deep shadow tones.", 0, 1, 0.01, 0, 1, painted),
  n("aoStrength", "Occlusion", "How strongly crevices and cavities darken, from five distance-field samples along each normal.", 0, 1, 0.01, 0, 1, raymarched),
  n("depthFade", "Depth fade", "Darkens the far side of the sculpture, front to back.", 0, 1, 0.01, 0, 1, painted),

  select("fill", "Fill", "How the solid is filled: ray-marched cells or smooth vector bands (both from the distance field), painter-ordered facets of the extracted mesh, depth-sorted grains sampled from its surface, or nothing (lines only).",
    [["none", "None"], ["cells", "Cells"], ["bands", "Bands"], ["facets", "Facets"], ["points", "Grains"]]),
  n("levels", "Tone levels", "Shading steps between the darkest and lightest palette tone; many steps approach a smooth ramp.", 2, 12, 1, 2, 64, painted),
  n("opacity", "Fill opacity", "Paint strength of the fill.", 0, 1, 0.01, 0, 1, painted),
  select("cellShape", "Cell shape", "Squares tile the picture; dots vary in size with the tone (a halftone).", [["square", "Squares"], ["dot", "Dots"]], cells),
  n("cellGap", "Cell gap", "Space between cells as a share of the cell (squares) or the smallest dot.", 0, 0.5, 0.01, 0, 0.9, cells),
  n("pointCount", "Grains", "Surface samples drawn, area-weighted; the first n of a longer run are the same points.", 500, 30000, 100, 1, 100000, grains),
  n("pointSize", "Grain size", "Diameter of a grain in canvas units at the sculpture's centre; grains shrink with distance in perspective.", 0.5, 8, 0.1, 0.1, 100, grains),

  flag("silhouette", "Silhouette", "Draw the outline and the edges where a nearer part of the surface hides a farther one, from the extracted mesh with hidden-line removal."),
  flag("creases", "Creases", "Draw sharp edges of the extracted mesh where neighbouring faces meet at more than the crease angle."),
  n("creaseAngle", "Crease angle", "Smallest dihedral angle drawn as an edge, degrees; a cube's edges are 90.", 10, 90, 1, 1, 179, creased),
  select("sliceAxis", "Slice axis", "The axis the slice planes are stacked along.", [["x", "Left-right"], ["y", "Vertical"], ["z", "Front-back"]]),
  n("slices", "Slices", "Evenly spaced planar sections of the extracted mesh drawn as contour lines, hidden where the solid covers them. 0 for none.", 0, 40, 1, 0, 120),
  select("hiddenLines", "Hidden lines", "What happens to line work behind the solid: dropped, or drawn faint.", [["drop", "Drop"], ["faint", "Faint"]]),
  n("lineWeight", "Outline weight", "Thickness of silhouette and crease lines.", 0.2, 3, 0.05, 0, 50),
  n("sliceWeight", "Slice weight", "Thickness of slice contours.", 0.2, 3, 0.05, 0, 50),

  n("cellSize", "Cell size", "Side of a ray-marched cell in canvas units: smaller cells resolve finer detail at the square of the cost.", 2, 16, 0.5, 1, 64, raymarched),
  n("steps", "March steps", "Field evaluations allowed per ray. Rays that run out end as misses, which shows as missing thin or grazing surface.", 24, 256, 1, 8, 1000, raymarched),
  n("meshDetail", "Mesh detail", "Grid cubes along the sculpture's longest side for the extracted mesh behind facets, grains and line work; the surface error is about the cube's side squared.", 12, 72, 1, 4, 128),
];

const controlGroups: ControlGroup[] = [
  { label: "Form", controls: ["form", "blend",
    { label: "Block", controls: ["roundness", "bores", "boreRadius"] },
    { label: "Lattice", controls: ["cells", "voidSize", "tunnel", "voidKeep"] },
    { label: "Growth", controls: ["branches", "twigs", "spread", "thickness", "bulbs"] },
    { label: "Fold", controls: ["fold", "iterations", "foldShape"] }] },
  { label: "Placement", controls: ["centerX", "centerY", "size"] },
  { label: "Carve", controls: ["cut", "cutAt", "cutTurn", "hollow", "wall", "order"] },
  { label: "Deform", controls: ["twist", "bend"] },
  { label: "Repeat", controls: ["repeatX", "repeatY", "repeatZ", "repeatGap"] },
  { label: "View", controls: ["projection", "yaw", "pitch", "roll", "distance"] },
  { label: "Light", controls: ["lightAzimuth", "lightElevation", "ambient", "aoStrength", "depthFade"] },
  { label: "Fill", controls: ["fill", "levels", "opacity", { label: "Cells", controls: ["cellShape", "cellGap"] }, { label: "Grains", controls: ["pointCount", "pointSize"] }] },
  { label: "Lines", controls: ["silhouette", "creases", "creaseAngle", "sliceAxis", "slices", "hiddenLines", { label: "Line weights", controls: ["lineWeight", "sliceWeight"], proportional: true }] },
  { label: "Quality", controls: ["cellSize", "steps", "meshDetail"] },
];

export const implicitSculptureDefinition: InstrumentDefinition = {
  id: "implicit-sculpture", title: "Implicit Sculpture",
  description: "Solids, cavities, repeated structures and bounded fractals composed as a signed-distance tree, then drawn as ray-marched shading, smooth vector bands, mesh facets or grains with hidden-line silhouettes, creases and slice contours.",
  renderer: "2d",
  parameters, controlGroups,
  defaults: {
    form: "lattice-cavity", roundness: 0.35, bores: 3, boreRadius: 0.38, cells: 3, voidSize: 0.8, tunnel: 0.5, voidKeep: 0.7, blend: 0.3,
    branches: 6, twigs: 2, spread: 0.85, thickness: 0.075, bulbs: true, fold: "menger", iterations: 3, foldShape: "box",
    centerX: 320, centerY: 322, size: 600,
    cut: "quarter", cutAt: 0, cutTurn: 0, hollow: false, wall: 0.1, order: "shell-first",
    twist: 0, bend: 0, repeatX: 1, repeatY: 1, repeatZ: 1, repeatGap: 0.15,
    projection: "orthographic", yaw: 36, pitch: 26, roll: 0, distance: 4.5,
    lightAzimuth: -38, lightElevation: 42, ambient: 0.3, aoStrength: 0.8, depthFade: 0.2,
    fill: "bands", levels: 5, opacity: 1, cellShape: "square", cellGap: 0, pointCount: 9000, pointSize: 2.2,
    silhouette: true, creases: true, creaseAngle: 40, sliceAxis: "y", slices: 0, hiddenLines: "drop", lineWeight: 1.1, sliceWeight: 0.7,
    cellSize: 5, steps: 128, meshDetail: 32,
  },
};
