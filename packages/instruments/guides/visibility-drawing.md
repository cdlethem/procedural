# Visibility Drawing

A solid drawn as an engineer or an engraver would draw it: outlines, hard edges, slices and contour
lines, with the lines behind other parts either removed or dashed, and tone laid on as hatching or
a banded wash. The starting study is a still life of four separate solids on a plinth (a vase, a
sphere, an upright ring and a block) seen in perspective: a heavy outline, creases in a second
colour with their hidden stretches dashed, the vase's rim in a third, and the faces cross-hatched
more the more they turn from a light on the left. Because the parts stand in front of one another,
the dashed lines run only where something really covers them (the plinth's far edges behind the
solids, the block's back edges behind its own faces), and a new seed moves the parts to other slots
and turns and sizes them a little.

It is not a wireframe with faded back edges. Every visible or hidden stretch is decided by exact
geometry: each line is cut wherever a nearer triangle covers it, so an edge that goes behind the vase
ends at the vase's outline and reappears on its other side, in orthographic or perspective view. The
same solver decides which stretches of every hatch stroke are seen. Nothing here is a 3D renderer: the
result is 2D strokes drawn on the canvas layer, and the layer stays transparent (only a Filled tone
paints the object's own faces).

Everything is built in stages that do not disturb one another. Changing weights, materials, colours, the
depth cue or the hidden-line style rebuilds nothing. Moving the camera keeps the mesh and every
camera-independent class (creases, rim, section cuts, contours) and recomputes only the silhouette, the
visibility of each class and the hatch. Changing a class's own rule (crease angle, section spacing, contour
levels) recomputes that class. A class set to *Removed* is not computed at all.

## Choose the solid

| Controls | What changes on the canvas |
|---|---|
| **Shape** | The **assembly**, an **icosphere**, a **torus**, a seeded **terrain**, a **vase** (open at the top, so its inside shows) or a low-poly **faceted figure**. Closed solids have no rim; the terrain and vase are open surfaces. |
| **Detail** | More facets: subdivision levels for the icosphere and the assembly's sphere, a multiple of the segments for the torus, terrain and vase. Silhouettes and contours follow the surface more smoothly; a low crease angle then draws every facet. The figure ignores it. |
| **Terrain**, **Vase profile** | Which height field (hills, ridges, crater, dunes; a new seed is a new landscape) and which revolved profile (amphora, goblet, bottle, urn). |
| **Center X/Y**, **Object size** | Where the object sits and how large it is drawn (the canvas diameter of the sphere around its bounds). They move the camera only. |
| **Projection**, **Yaw**, **Pitch**, **Roll**, **Eye distance** | The camera. Orthographic keeps parallel edges parallel; perspective converges them and enlarges near parts. *Eye distance* (in object diameters) sets how strong the perspective is; put the eye inside the object's bounds and the near plane removes what is closer than a fiftieth of the distance. |

## Choose which edges are drawn

Every class has the same first control: **Removed** (not computed), **Visible only** (hidden stretches
dropped) or **Hidden dashed** (the same visible line plus the hidden part as thin, faint dashes). Each
also chooses its own material (**ink**, **stitch**, **beads**) and weight.

| Class | Controls | What changes on the canvas |
|---|---|---|
| **Silhouette** | Mode, material, weight | The outline of the form (edges between a face turned toward the eye and one turned away). It follows the camera. |
| **Creases** | Mode, **Crease angle**, **Crease kind**, material, weight | Edges where the surface folds by at least the angle between the two faces (a cube's edge is 90). *Ridges* are convex folds and *valleys* concave. An edge that is both a crease and part of the silhouette is drawn once, as silhouette. |
| **Rim** | Mode, material, weight | The free edge of an open surface: the terrain's border, the vase's mouth. Not offered for closed solids. |
| **Sections** | Mode, **Section direction**, **Section tilt**, **Section spacing**, **Section shift**, material, weight | Exact cuts by parallel planes, drawn where each plane meets the surface: rings round a sphere, profile lines across terrain, two loops through a ring. Spacing is a fraction of the object's extent along the stack; the stack is centred on the object. |
| **Contours** | Mode, **Contour field**, **Contour levels**, material, weight | Lines of constant *height*, *slope* (the angle from facing up: bands follow steepness) or *mean curvature* (ridges and hollows) on the surface, evenly spaced inside the field's range. A constant field, such as a sphere's curvature, has no lines. |

## Tone the faces

| Controls | What changes on the canvas |
|---|---|
| **Surface tone** | **None** leaves a pure line drawing (the edge classes above stand on their own). **Hatched** lays parallel strokes on every visible face, more crossing directions on darker faces. **Filled** paints the visible faces opaque in bands, far to near. **Filled and hatched** does both. |
| **Smoothing angle** | Faces that meet at a fold no sharper than this shade as one smooth surface; sharper folds stay crisp. 0 shades every triangle flat; the default 35 smooths a sphere or torus but keeps a box's edges hard. |
| **Hatch spacing**, **Hatch angle**, **Hatch families**, **Bare highlights**, **Hatch material**, **Hatch weight** | The lattice the strokes lie on (fixed across the whole object, so neighbouring faces continue each other's lines), its direction (degrees clockwise from horizontal; further families spread evenly through 180), how many crossing families the darkest faces may carry, the darkness below which a face is left bare, and the stroke style. Beads make a stippled tone. |
| **Fill color**, **Fill paleness**, **Fill bands**, **Fill shade** | Which palette entry, how far it is mixed toward white (so lines stay readable over it), how many tone steps (2 to 3 is toon, 0 continuous) and how dark the shadow side gets. |
| **Light direction**, **Light height**, **Ambient light** | Azimuth (from +z toward +x, fixed in the world) and elevation of the light and the share of light that reaches faces turned away. There are no cast shadows. Turning the camera changes which faces the light meets. |

## Lines: colour, depth, hidden style

| Controls | What changes on the canvas |
|---|---|
| **Color by** | *Class*: silhouette and hatch use palette entry 0 (ink), creases 1, rim 2, sections 3, contours 4. *Ink* uses entry 0 for everything. |
| **Depth cue**, **Cue strength** | Weight, opacity or both fall with depth, following the depth of every point along a line (a line running away from the eye thins along its length). At strength 1 the farthest lines keep 15%. |
| **Hidden opacity**, **Hidden weight**, **Dash length** | How faint and thin the dashed hidden stretches are (against their class) and their period in canvas units. |
| **Station spacing**, **Bead scale** | Distance between stitches or beads and the bead diameter as a multiple of the line weight. |

## Things to try

| Setting | Result |
|---|---|
| Shape Terrain (hills), Contours Visible, 18 levels, Rim Visible, Surface tone None, Pitch 38 | A topographic sheet: elevation lines, a border, a silhouette. Try Slope or Curvature for the field. |
| Shape Icosphere, Sections Visible, spacing 0.08, Contours slope, Surface tone None, Orthographic | Latitude rings and steepness rings on a sphere, hidden ones dashed if you choose Hidden dashed. |
| Shape Torus, Sections Hidden dashed, Section tilt 35, Surface tone Hatched, Hatch families 3 | Oblique slices through a ring, dense cross-hatching where the tube turns from the light. |
| Shape Faceted figure, Creases 30 degrees Hidden dashed, Surface tone Filled and hatched, Fill bands 3 | A poster-flat figure with the creases through it dashed. |
| Silhouette Beads, Creases Stitch, Surface tone Filled, Fill paleness 0.5 | Outlines of dots over a pale banded wash. |
| Eye distance 0.5, Terrain, Contours Visible | The eye inside the sheet: near-plane clipping cuts the surface without cracks or duplicated lines. |
| Depth cue Weight and opacity, Cue strength 1, Perspective distance 2 | Strong depth: near edges heavy, far edges nearly gone. |

## As functions

The classes, the camera and the drawing are separate ordinary functions; the instrument is one
composition of them. Meshes are validated immutable values; the bundled shapes are chosen by id. A
mesh of your own (`mesh({ positions, triangles, quads })`) goes to the same functions (host binding of a user's
model to a Studio layer is future work).

```js
import { visibilityMesh, viewCamera, visibilitySilhouetteEdges, visibilityCreaseEdges, visibilityEdgeCurves,
  visibilitySectionCurves, visibilityContourCurves, visibilityCurvePaths, tonedHatch, strokeWith, pathMaterial,
  createCompositionRun } from "@procedurals/instruments";

const mesh = visibilityMesh({ shape: "assembly", detail: 3, terrainVariant: "hills", vaseProfile: "amphora", seed: 7 });
const view = viewCamera(mesh, { projection: "perspective", yaw: 28, pitch: 24, roll: 0, distance: 3.4, centerX: 320, centerY: 330, size: 590 });

// view independent: cached per mesh and rule, unchanged when the camera moves
const creases = visibilityEdgeCurves(mesh, visibilityCreaseEdges(mesh, { angle: 40, convexity: "both" }));
const cuts = visibilitySectionCurves(mesh, { axis: "y", tilt: 0, spacing: 0.06, offset: 0.5 }).curves;
const lines = visibilityContourCurves(mesh, { field: "height", levels: 12 }).curves;

// view dependent: exact hidden-line removal, both the visible and the hidden runs
const outline = visibilityCurvePaths(mesh, visibilityEdgeCurves(mesh, visibilitySilhouetteEdges(mesh, view)), view, "silhouette", "Detail");
const ink = pathMaterial({ kind: "ink", weight: 1.6, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x1c2430]);
strokeWith(p, outline.visible.map((path) => ({ ...path, tone: 0 })), ink, createCompositionRun());  // p: any p5-like surface

// tone: hatch strokes of the visible faces, already cut by the same solver
const hatch = tonedHatch(mesh, view, { spacing: 4.5, angle: -35, families: 2, threshold: 0.3,
  light: { azimuth: -35, elevation: 50, ambient: 0.15, smoothAngle: 35 } });
```

`visibilityProducts(recipe)` returns all of the producer values for a recipe (`visibilityDrawingComposition(input)`
resolves stored controls), each visible or hidden path carries its per-point camera depth and a `visible` label, and
`drawVisibilityProducts` takes `{ materials: { crease: myMaterial } }` to replace the built-in stroke of a class.
Compose it under or over other instruments: it leaves the canvas transparent, so fine visible lines above a translucent
region fill, or motifs placed at the feature paths, are ordinary layers.

## Limits

Detail stops at 6 for the icosphere and the assembly (81,920 triangles for the sphere alone) and at 8 for the others.
A hatch of more than 150,000 segments, more than 250 section planes, more than 200 contour levels, or a class whose
visibility solve exceeds the solver's work bound is refused with the controls to change named (Hatch spacing, Hatch
families, Section spacing, Contour levels, Detail); nothing is silently truncated. Drawing work (one unit per stroke
plus one per stitch or bead) is capped at 1,500,000. The solver's tolerance is a millionth of the object's size:
hidden stretches shorter than that and depth differences below it are ignored. The fill is a painter's algorithm, exact
except for pairs of triangles that intersect or coincide; the fill is opaque, so layer opacity, not the fill itself,
makes it translucent. A closed solid is assumed consistently oriented (outward normals); open surfaces are lit from
both sides. Mean curvature is least reliable on a rim vertex. Nothing here reconstructs a scanned object or claims
physical accuracy.
