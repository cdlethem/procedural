# Implicit Sculpture

A carved, hollowed, repeated or fractal solid drawn with real depth. The starting study is a block of
warm stone hollowed by a three-by-three-by-three lattice of voids joined by tunnels, with a quarter
cut away so the cavities show: the front faces are flat, the tunnels open into holes on the sides, and
inside the cut you see smooth-blended chambers, shaded in five posterised tones, darkening in the
creases, with an ink outline, sharp edges and nothing drawn that the solid hides. Every seed omits a
different set of voids and tunnels. It is not a mesh model and not a noise heightfield: the solid is a *signed
distance tree* (a sphere, a box, a torus, a capsule, a cylinder, combined by union, intersection,
subtraction, smooth union, shell, bounded repetition, twist, bend and a bounded fractal fold), and the
picture is computed from it, so a cut really opens a cavity, a shell really has an inside, and a hole
stays a hole from any angle.

The sculpture, the camera and the appearance are separate. Changing the form, the cut, the shell,
the twist or the repeat builds a new solid. Changing yaw, pitch, projection, size or centre re-marches
the rays and re-solves the hidden lines, but never rebuilds the solid or its mesh. Changing
colours, tone levels, light, opacity or line weights recomputes nothing: the marched cells are
painted again. Nothing is filled behind the sculpture; the layer paints transparent space.

## Choose the form

| Controls | What changes on the canvas |
|---|---|
| **Form** | Which tree you start from. **Carved block**: a cube (optionally rubbed toward a sphere) with cylinders bored through it. **Lattice cavity**: a block minus a bounded lattice of voids joined by tunnels. **Coral**: a holdfast, a trunk and seeded limbs, smooth-unioned. **Fractal fragment**: a Menger sponge or a tetrahedral arrangement of cubes, folded up to five times. |
| **Roundness**, **Bores**, **Bore radius** (block) | 0 keeps the sharp cube, 1 leaves the sphere that touches its faces. Up to three cylinders are drilled: vertical, then left-right, then front-back. |
| **Cells per side**, **Void size**, **Tunnels**, **Voids kept** (lattice) | The lattice is cells × cells × cells copies of one void (bounded repetition). Void size 1 makes neighbours touch; tunnels join them along the axes and open onto the faces; *Voids kept* removes voids and tunnel lines by a stable per-cell hash of the seed, so a new seed reshuffles which are missing, holes on the faces included. |
| **Blend** (lattice, coral) | How far neighbouring cavities or limbs flow into each other (smooth union). 0 is a hard union. |
| **Branches**, **Twigs per branch**, **Spread**, **Limb radius**, **Tip knobs** (coral) | Limbs leave the trunk at seeded heights, azimuths, tilts and lengths; each has side twigs and a knob at the tip. A new seed grows a different coral. |
| **Fold**, **Iterations**, **Shape** (fractal) | Menger folds space by absolute value and sorting and scales by 3 (20 of 27 sub-cubes survive each level); tetrahedral reflects and scales by 2 (4 copies). Iterations are capped at 5: each level multiplies the copies and shrinks their detail, and the picture stops resolving them below a cell. |

## Carve, deform, repeat

| Controls | What changes on the canvas |
|---|---|
| **Cutaway**, **Cut position**, **Cut direction** | Removes a half-space, the quarter or octant beyond a corner, or a thin slot, so the inside shows. Direction turns the opening about the vertical axis to face the camera. The framing never changes: the sculpture is always scaled by its uncut bounds. |
| **Hollow**, **Wall** | Turns the sculpture into a skin: the field becomes the absolute distance to the surface minus half the wall, so the wall has an outside face and an inside face. A wall thinner than about a mesh cell cannot be extracted: facets, grains and lines then leave it out, while cells and bands still draw it. |
| **Operation order** | With Hollow and a cut, **Shell, then cut** opens the skin and shows the empty interior between the two faces of the wall; **Cut, then shell** skins every cut face too. They differ wherever the cut meets a wall. |
| **Twist**, **Bend** | Rotates every level about the vertical axis in proportion to height (twist), or about the front-back axis in proportion to width (bend). Strong values slow the marching (see Limits) but stay safe. |
| **Copies across / up / deep**, **Copy gap** | Repeats the whole sculpture on a lattice spaced by its extent times one plus the gap. The picture is re-fitted, so repeats shrink each copy. |

## Place and view

| Controls | What changes on the canvas |
|---|---|
| **Center X/Y**, **Size** | Where the sculpture sits and the canvas diameter of the sphere that bounds it. |
| **Projection**, **Yaw**, **Pitch**, **Roll**, **Distance** | Orthographic keeps parallels parallel; perspective shrinks the far parts (Distance is the eye distance in bounding radii). Yaw swings the eye around, pitch raises it, roll turns the picture. |
| **Light around / height**, **Ambient**, **Occlusion**, **Depth fade** | A light fixed in the viewer's frame. Ambient is the light every surface gets; Occlusion darkens crevices from five distance samples along each normal; Depth fade darkens the far side. |

## Fill

| Controls | What changes on the canvas |
|---|---|
| **Fill** | **Cells**: one ray per cell, merged into rectangles or drawn as dots. **Bands**: the same shading as smooth vector regions, one per tone level. **Facets**: the extracted mesh painted far to near. **Grains**: sampled surface points, depth sorted and hidden where the solid covers them. **None**: lines only. |
| **Tone levels**, **Fill opacity** | Steps of the ramp from the palette's shadow to light colours (entries 1 to n−1; entry 0 is ink), and paint strength. A one-colour palette shades by density instead. |
| **Cell shape**, **Cell gap** | Squares tile the picture; dots vary in size with tone (a halftone). Gap leaves paper between cells. |
| **Grains**, **Grain size** | Number of surface samples (the first n of a longer run are the same points) and their diameter, shrinking with distance in perspective. |

## Lines

| Controls | What changes on the canvas |
|---|---|
| **Silhouette**, **Creases**, **Crease angle** | The outline and the edges where the solid hides itself, and sharp edges wherever neighbouring faces meet at more than the angle, from the extracted mesh with hidden-line removal: a line behind the solid is dropped (or faint), never drawn through it. |
| **Slice axis**, **Slices** | Evenly spaced planar sections of the mesh drawn as contour lines, hidden where the solid covers them. |
| **Hidden lines** | Drop hidden runs, or draw them faint. |
| **Outline weight**, **Slice weight** | Line thicknesses; the two scale together as one edit. |

## Quality

| Controls | What changes on the canvas |
|---|---|
| **Cell size**, **March steps** | The side of a ray-marched cell (cost grows with its inverse square) and the field evaluations allowed per ray. A ray that runs out is a miss, which shows as missing thin or grazing surface. |
| **Mesh detail** | Grid cubes along the sculpture's longest side for the extracted mesh behind facets, grains and lines. Features smaller than a cube blur, and a sculpture with no extractable surface (or a hollow wall thinner than 0.8 of a cube) draws no facets, grains or lines, while cells and bands still draw. |

## Things to try

| Setting | Result |
|---|---|
| Carved block, Roundness 0.35, three bores, Cutaway none | The dice: rubbed corners, three crossing bores. |
| Fractal fragment, Menger, Iterations 3, Cutaway corner | A sponge with an octant removed, its interior layers visible. |
| Carved block, Hollow, Wall 0.08, Roundness 0, Cutaway quarter: Shell then cut / Cut then shell | Same cut, opposite interiors: an empty room between skins, or a solid-looking wall. |
| Coral, Blend 0.7, Branches 10, seeds 1, 2, 3 | Three different soft corals. |
| Lattice, Cells 5, Void size 0.9, Fill Cells, Cell shape Dots, Cutaway half | A halftone of the void lattice. |
| Any form, Fill None, Slices 12 | Line work only: contours of the solid, hidden where it covers itself. |
| Carved block, Twist 1.2, Roundness 0 | The block wrung like a cloth. |
| Coral, Copies 3 across and 3 deep | A field of corals: one bounded repeat. |

## As functions

The producers are ordinary functions; the instrument is one composition of them. World units are
half the block's side; canvas units are the 640 reference frame.

```js
import { sdf, sdfBox, sdfCylinder, sdfSphere, sdfPlace, sdfSubtract, sdfIntersection,
  camera, sdfView, shadeView, sdfMesh, sdfSurfacePoints, marchRays,
  hiddenLines, meshTopology, meshFeatureEdges, meshEdgeCurves } from "@procedurals/instruments";


// A tree is data. Validation names the node and field of any mistake.
const die = sdf(sdfSubtract(
  sdfIntersection(sdfBox([1, 1, 1]), sdfSphere(1.4)),
  sdfCylinder(0.4, 1.6), sdfPlace(sdfCylinder(0.4, 1.6), { rotate: [0, 0, 90] })));   // two bores, crossing
die.class;        // "bound": never exceeds the true distance, so marching by it is safe
die.bounds;       // conservative box; die.radius the bounding sphere the camera fits

// Camera and marching are separate from the tree.
const view = camera({ yaw: 36, pitch: 26, target: die.center, zoom: 600 / (2 * die.radius), distance: 3 * die.radius, center: [320, 320] });
const cells = sdfView(die, view, { cellSize: 5, maxSteps: 128, ao: true });   // cached by tree, camera, sampling
const tone = shadeView(cells, view, die, { azimuth: -38, elevation: 42, ambient: 0.3, aoStrength: 0.8, depthFade: 0.2 });

// The extracted mesh feeds the visibility consumers and sampling.
const { mesh, provenance } = sdfMesh(die, { detail: 32 });    // dual contouring; provenance names method, grid, counts
const grains = sdfSurfacePoints(die, { detail: 32, count: 9000, seed: 7 });   // on the exact surface, gradient normals
```

`marchRays` runs the released implicit ray-march operation (`field.raymarch-implicit-rays-3d`) whenever the
tree is expressible in its typed scene (spheres, boxes, translation and uniform scale, union,
intersection, subtraction, smooth union) and the same rule over the compiled field otherwise; a test pins
that they agree exactly. A general scalar field (`sdfField` without a declared Lipschitz constant) can be
meshed and sliced but is refused by name if you try to march it: an arbitrary field is never treated as a
safe distance estimator. The instrument only names bundled construction; binding a caller's own tree or
mesh to a Studio layer is future host work.

## Limits

A tree holds at most 128 nodes, nested 16 deep; fold iterations stop at 5; a repeat has at most 32
copies per axis and its child must fit inside half the spacing (the tree refuses otherwise, naming the
node). A march is checked against a worst-case work bound before any ray is traced, and refused naming
Cell size and March steps; at most 60,000 cells are marched. The mesh takes at most 2,500,000 grid
points and 200,000 faces, refused naming Mesh detail when typed past the sliders (the slider ends always draw). Facets stop at 120,000. Twist and bend divide the
field by a Lipschitz constant derived from the sculpture's bounding sphere, so heavily twisted forms
march with shorter steps and may need more March steps. No physical accuracy or fabrication claim is
made: the mesh approximates the zero set to about a cell, and a feature smaller than a cell blurs.
