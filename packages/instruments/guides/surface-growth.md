# Surface Growth

A flat disc grows a frilled rim, and because the rim wants to be longer than the circle it is attached to, it folds:
leaf-like ruffles rise out of a calm pale centre, nearer folds hide farther ones, and the underside of each fold
shows darker where it turns away. Drag **Steps** and the same skin grows up, first smooth, then rippled at the edge,
then fully ruffled. Change *where* it may grow (the rim, a ring, stripes, blobs, a hot spot) and the whole skin folds
differently, not only the places you touched. Orbit the camera, recolour or change how it is drawn, and the skin itself
is never recomputed.

The surface is a real evolving mesh, not a noisy sphere. Each vertex carries a growth scale; an edge's rest length
follows from it; every step the skin lengthens where the **growth field** is high, relaxes in 3-D under stretching
and bending, and splits the edges that stretch too far, so growing regions get more triangles. Ruffles are what a
short boundary does when its neighbour keeps getting longer.

It is a bounded spring-and-hinge skin, not cloth physics, not a finite-element membrane and not a model of any
plant, coral or tissue. Nothing here is printable, and no biological accuracy is claimed.

## One picture, four stages

1. **Growth**: seed surface, growth field, the growth rule and the steps. One cached run.
2. **The skin**: the mesh at the chosen step, with per-vertex attributes (growth, field, stretch, refinement depth).
3. **The view**: the camera, painter order, hidden-line paths and occlusion-tested grains for that mesh.
4. **Appearance**: colours, weights, materials, opacities.

Editing a later stage never touches an earlier one. A camera or palette edit redraws in milliseconds; a growth edit
recomputes the run; scrubbing **Steps** extends the same run or replays it from a nearby saved state.

## The seed surface

| Controls | What changes on the canvas |
|---|---|
| **Seed surface** | A flat sheet, disc or long strip (lying flat and ready to buckle upward), or a closed sphere. All are triangle meshes. |
| **Resolution** | Vertex density of the seed. Refinement adds detail only where growth needs it, so a coarse seed gives broad, few folds and a fine one gives finer detail from the start. |
| **Perturbation** | The initial random push along the normal, as a share of a seed edge. A perfectly flat skin under compression has no reason to buckle up rather than down (it stays exactly flat); this is the nudge. Each vertex draws from its own stream, so the same seed always folds the same way, and a new seed folds differently. |
| **Center X/Y**, **Size** | Where the surface's center lands on the canvas and the radius of the sphere around it that contains the whole grown skin. The picture is framed to the grown skin, so a bigger skin still fills the same space. |

## Where it grows

| Controls | What changes on the canvas |
|---|---|
| **Growth field** | *Edge*: growth near the rim. *Ring*: a ring (or a round spot at radius 0) around a point. *Stripes*: parallel bands. *Blobs*: seeded patches. *Everywhere*: uniform. Growth goes where the field is high; the rest is pushed into folds. The sphere has no edge. |
| **Band width** | For *Edge*: how far from the rim growth reaches. For *Ring*: the ring's width. Reaching the centre turns edge growth into global swelling. |
| **Ring radius**, **Ring center X/Y** | The ring's size and position on the seed. Radius and width scale together as **Ring**. |
| **Stripes**, **Stripe angle**, **Stripe sharpness** | Stripes across the seed, their direction, and how sharply growth switches on and off. More stripes give finer, closer folds. |
| **Blob scale**, **Blob contrast** | Size and sharpness of seeded growth patches. |
| **Baseline growth** | Growth everywhere regardless of the field. 0 confines it to the field; raising it swells the whole skin. |
| **Hot spot**, **Spot X/Y**, **Spot width** | A second growing region, a round spot (the larger of the two fields wins). Move it to bias where the big fold starts. |

## Growth, skin and refinement

| Controls | What changes on the canvas |
|---|---|
| **Growth rate** | How fast a fully growing part lengthens per step. Slower rates follow the growth more exactly and give cleaner, rounder folds. |
| **Growth limit** | The largest expansion of any part. A part at the limit stops; when every growing part has arrived, the skin only settles. A higher limit means more to fold. |
| **Steps** | How much growth has happened. Scrub it to watch the folds form. |
| **Bending** | Stiffness of folds. Low: many tight frills. High: a few broad, smooth folds. 0: limp. It is a bending rigidity in units of the stretch modulus times seed length squared, so it does not change when you refine. |
| **Pin** | Hold nothing, the rim, the center vertex or one side still. Pinned parts never move, so the free part buckles against them: a fixed rim gives a dome or pillow, a pinned side a hanging curtain. The sphere has no rim and ignores it. |
| **Relaxation** | Sweeps per step, at most. More follow the growth more exactly; fewer let the skin lag and soften. It costs in proportion. |
| **Contact distance** | Vertices closer than this (in seed edges) that are not neighbours push apart, so folds lying on each other keep apart. 0 lets them pass through. It acts between vertices only; faces can still cross between them. |
| **Refine**, **Edge limit**, **Vertex limit** | Split edges longer than **Edge limit** seed edges at their midpoints. A lower limit gives finer ruffles and uses more vertices. When the **Vertex limit** is reached, longer edges stay unsplit and the run counts them, never silently. |

## How it is drawn

| Controls | What changes on the canvas |
|---|---|
| **Faces** | None, flat colour, lit per triangle (*Facets*) or lit with smoothed normals (*Smooth*). Faces are painted far to near, so nearer folds hide farther ones. |
| **Underside**, **Face opacity** | Faces turned away from the camera painted like the top, tinted toward the ink colour, or left out; and the faces' opacity (below 1 the far folds show through). |
| **Light direction/height/strength** | The light is fixed to the view, so orbiting does not change how a fold is lit. |
| **Color by** | Colour faces and grains by growth so far, stretch (compression to tension, scaled to what this skin shows) or refinement depth. The colours ramp through the palette. |
| **Lines** | *Contours*: silhouette, rim and (with **Crease angle**) sharp folds. *Wire*: every mesh edge. Both or none. All are hidden-line solved, not dimmed. |
| **Hidden lines**, **Hidden opacity** | Parts of a line behind the skin are removed or drawn faintly. |
| **Line material**, **Contour/Wire/Level weight** | Ink, stitches or beads; stroke widths (they scale together as **Line weights**). |
| **Level lines**, **Levels** | Lines of equal growth, stretch, height or refinement depth across the surface. |
| **Grains**, **Grain mark**, **Grain size** | Marks spread evenly over the surface; those the skin hides are left out, smaller the farther away. More grains only add grains. |
| **Projection**, **Yaw**, **Pitch**, **Roll**, **Eye distance** | The camera. Perspective shrinks the far side; a part nearer than a fiftieth of the eye distance is not drawn. |

Palette colours: the first draws every line; the others fill the faces (the first fill colour, or a ramp through
them with **Color by**). Nothing is painted behind the picture: it is a transparent layer, and a skin with only
lines is as useful as a filled one.

## Limits and errors

Nothing is truncated silently and every error names the control to change. The sliders stop at 160 steps, a
vertex limit of 1,400, 16 relaxation sweeps and resolution 24, so that every slider at its maximum at once still
prepares in under two seconds; the code accepts up to 1,200 steps, 16,000 vertices and 60 sweeps, limited by a
declared worst case (every step at the full vertex limit) that is refused beyond 400 million work units, naming
the controls to lower. The default prepares in under a second; a scrub of one step takes a fraction of that. A triangle that collapses to a sliver is reported with its
step, its vertex ids and what to change (lower Growth rate or limit, raise Bending or Relaxation). Self-contact is
scoped as above. Seed surfaces are the four bundled ones; binding a user's own mesh or growth field to the app is
future work, though the code API accepts any triangle mesh and a sampled field (a reaction pattern, for instance).

## Use it from code

```ts
import { bundledGrowthSeed, growthField, surfaceGrowthSnapshots, grownSurface, createInstrument, surfaceGrowthComposition, drawSurfaceGrowth } from "@procedurals/instruments";

const seed = bundledGrowthSeed("disc", 16);                       // or growthSeed(yourTriangleMesh)
const field = growthField({ regions: [{ kind: "edge", width: 0.45 }], combine: "max", baseline: 0.04 }, seed, 42);
const run = surfaceGrowthSnapshots(seed, field, { rate: 0.012, limit: 3, bending: 0.0004, sweeps: 12, pin: "none",
  perturb: 0.15, refine: true, edgeLimit: 1.4, maxVertices: 3000, thickness: 0 }, 42, 150);
const { mesh, frame } = grownSurface(run);                          // a validated Mesh: attributes growth, field, stretch, birth, generation, parentA, parentB
const earlier = grownSurface(run, 60);                              // the same run, scrubbed

drawSurfaceGrowth(p, surfaceGrowthComposition({ ...createInstrument("surface-growth"), seed: 7 }), { line: myMaterial, grain: myMark });
```

Vertex `i` is `v:<i>`: vertices are born in index order and never removed, and a split vertex records its two parents,
birth step and generation as attributes. Faces are re-derived and carry no stable identity. `gridGrowthField` turns a
sampled field (for instance a competition pattern) into a growth field.
