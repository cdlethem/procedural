# Hinged Panels

A flat tiling of panels folds along its shared edges into a spatial fragment. Every panel stays a rigid piece
of paper with its own name, every shared edge is a hinge with an angle you can edit, and the pieces are posed
outward from one anchored panel, so nothing stretches and every panel can be found again in the folded form.
The starting drawing is a twelve-by-twelve sheet of squares whose hinges all fold thirty-eight degrees with a
good measure of chance mixed in: the sheet curls into a dome, and where the chance is strongest strips of
panels hang off it like tassels. Panels are lit from a fixed light, coloured by how far they are from the
anchor along the hinges, and the hinges are inked. The picture is a projection of real geometry: a panel in
front hides what is behind it, and a different camera shows the same folded sheet from another side.

A tiling has more hinges than one folded sheet can honour. Around a vertex of a square grid, for example, four
hinges cannot take arbitrary angles and still close. The study folds along a spanning tree of the hinges and
reports the rest: where a hinge could not be honoured the two panels no longer meet, and the crack shows.
Nothing is bent or stretched to hide it, and *Mark cracks* draws the conflicts in the accent colour.

The flat crease pattern is a layer of its own. Set *Treatment* to *Crease pattern* and the same panels and
hinges are drawn flat, mountains dash-dotted, valleys dashed, cracks dotted, with the same fills and motifs, so
it can sit under the folded layer or stand alone. It never builds a pose or a camera.

Everything is built from the tiling and its angles. Changing the camera, the light, colours, fills, hatching,
lines or motifs never moves a panel; changing *Fold progress* to 0 gives the flat sheet exactly.

## Choose the panels

| Controls | What changes on the canvas |
|---|---|
| **Panel source** | The flat tiling: **squares**, **triangles**, **bricks** (2 x 1, every row shifted, so one edge is shared with two panels) or **Penrose rhombs** grown from a seed patch by substitution (with the lone half-rhombs at the patch edge, so the patch is one piece). A shared edge is a hinge. |
| **Columns**, **Rows** | Panels across and up, for squares, triangles (a cell is two triangles) and bricks. |
| **Seed patch**, **Substitution depth** | The Penrose patch (the five-fold **sun**, the **decagon**, a single **thick** or **thin** rhomb) and how many times it is divided; panels multiply by about 2.6 per step. |
| **Panel retention** | Share of panels kept. Omitted panels leave bare paper and cut the hinge graph; a piece cut loose from the anchor stays flat where it started. The same panels are omitted whatever the fold or drawing. |

## Decide the folds

| Controls | What changes on the canvas |
|---|---|
| **Fold rule** | **Uniform**: every hinge the same. **Stripes**: a wave across the sheet, so pleats. **Radial**: a wave in distance from the centre, so rings. **Checker mountain/valley**: the sign alternates every cell. **Seeded**: a random angle per hinge. |
| **Fold angle** | The largest fold at any hinge, degrees. The limit is 179: exactly 180 would lay one panel on another. |
| **Fold direction** | Whether the base fold is a mountain (panels dip away from the viewer) or a valley. |
| **Period**, **Stripe direction**, **Wave phase** | Wavelength (or checker cell) in panel edges; the direction the stripes run; and the wave's phase. Period 2 with phase 0 alternates mountain and valley on every row of hinges, which is an accordion. |
| **Disorder** | Blends the rule toward a random angle per hinge: low values keep the structure and roughen it, 1 replaces it with chance. A new seed reshuffles the chance only. |
| **Fold progress** | Multiplies every angle: 0 is the flat sheet, 1 the full fold. The hinge graph and closure are the same at every value. |
| **Folding hinges**, **Hinge direction**, **Folding share** | All hinges fold; only those whose axis runs within 18 degrees of a direction (folds along one direction always close, so pleats and scrolls are clean); or a random share, chosen hinge by hinge. Hinges that do not fold stay rigid flat joints. |

## Closure and anchors

| Controls | What changes on the canvas |
|---|---|
| **Closure** | Which hinges the tree keeps. **Nearest first** grows outward from the anchors, so cracks appear far from them; **Strongest first** honours the largest folds and lets the weakest hinges open. |
| **Anchor panel**, **Anchored panels** | The panel that stays where it started (the centre one, the one nearest a corner, or one chosen by the seed), and how many are held. Extra anchors are spread as far apart as possible; each keeps its own tree, and folds between the trees rarely meet. |

## Body, placement and view

| Controls | What changes on the canvas |
|---|---|
| **Gap between panels** | Each panel is drawn shrunk toward its own centre, leaving paper between them. Hinge lines keep their true place. |
| **Thickness** | Panels become slabs this deep behind their front, in panel edges: sides and backs appear, and slabs hide more of what is behind them. Folded treatment only. |
| **Center X/Y**, **Sheet size**, **Scale to**, **Rotation** | Where the sheet sits, the canvas length of a diagonal, and the turn about the centre (clockwise, degrees). **Scale to** picks the diagonal: the flat sheet's, so the form shrinks as it folds and Fold progress scrubs at one scale, or the folded form's own bounding diagonal. |
| **Projection**, **Yaw**, **Pitch**, **Perspective strength** | The camera. Pitch 90 looks straight down at the flat pattern; perspective foreshortens (smaller strength, stronger). |

## Fill, lines and motifs

| Controls | What changes on the canvas |
|---|---|
| **Treatment** | **Folded** draws the posed sheet through the camera; **crease pattern** draws it flat. |
| **Panel fill**, **Color by**, **Fill opacity** | None, flat colour or shaded. A panel takes its palette entry from its tile class, its hinge depth from the anchor, whether its own fold is a mountain or a valley, its tilt, its height, its name, or one accent. Panels seen from behind are paler. |
| **Shading**, **Light direction**, **Light height** | How much the fixed light changes a panel's colour, and where it comes from; moving the camera does not move the light. |
| **Hatching**, **Hatch angle**, **Hatch spacing**, **Hatch weight** | Hatch lines drawn in each panel's own flat coordinates, then folded with the panel: they continue across neighbouring panels in the flat sheet and foreshorten where it folds. |
| **Lines**, **Line weight**, **Hidden lines**, **Mark cracks** | Which edges are inked: mountain and valley folds, every hinge including the flat ones, or hinges plus the sheet outline. Lengths behind a panel are dropped or kept faint. Cracks are the two sides of every hinge the fold could not honour. |
| **Panel motif**, **Motif size**, **Motif line weight**, **Motif turn**, **Size variation** | One mark on every panel, mapped onto it: it turns and foreshortens with the panel and reads mirrored from behind. A panel hidden by another loses its mark. Size variation is chosen by panel name. |

## Things to try

| Setting | Result |
|---|---|
| Squares, Fold rule Uniform, Folding hinges One direction (0), Fold angle 25, Disorder 0 | A clean scroll: every panel keeps its place around a cylinder. Raise Disorder to crumple it. |
| Squares, Stripes, Period 2, Folding hinges One direction, Fold angle 60 | An accordion of pleats with every hinge closed. Set Fold progress to 0 to unfold it exactly. |
| Squares, Checker, Fold angle 60, Disorder 0.2, Mark cracks | Panels hinged in a checkerboard of mountains and valleys; the cracks show where the vertices cannot close. |
| Penrose rhombs, Depth 3, Seeded, Fold angle 70, Color by Tile class | Fragments of a Penrose patch, thick and thin rhombs still identifiable. |
| Uniform 60, Anchored panels 3, Anchor Corner | Three separate curled balls: each anchor holds its own tree. |
| Fill None, Lines Hinges and outline, Hidden lines Faint | A wire model with hidden-line removal: an edge-only drawing stays readable. |
| Treatment Crease pattern, Lines Folds, Panel fill Flat | The unfolded pattern with the folds marked; layer it under the folded sheet. |

## As functions

The stages are ordinary functions; the instrument is one composition of them. Lengths are panel edges (the shortest
edge is 1), angles are degrees, and a hinge's angle is the signed dihedral angle with the `meshEdgeAngle` sign
(mountain positive).

```js
import { panelTiling, hingeAngles, foldPanels, posedPanels, camera, paintOrder, hiddenLines, hingedCurves,
  meshTopology, meshEdgeAngle } from "@procedurals/instruments";

const tiling = panelTiling({ seed: 7, source: "triangle", columns: 6, rows: 5, patch: "sun", depth: 2, retention: 1 });
const angles = hingeAngles(tiling, { seed: 7, rule: "stripes", angle: 60, direction: "mountain", period: 2, stripeAngle: 90,
  phase: 0, disorder: 0.2, amount: 1, select: "all", axis: 0, share: 1 });     // one signed angle per hinge
const folded = foldPanels(tiling, angles, { seed: 7, anchor: "center", anchors: 1, tree: "breadth" });
// folded.pose: a rigid pose per panel; folded.report: tree / realized / off-angle / open for every hinge

const posed = posedPanels(folded, { gap: 0, thickness: 0 });   // a Mesh; posed.panelOfFace names every face's panel
const view = camera({ projection: "perspective", yaw: 30, pitch: 40, zoom: 40, distance: 30, center: [320, 320] });
const order = paintOrder(posed.mesh, view);                    // triangles far to near
const lines = hiddenLines(posed.mesh, hingedCurves(folded, "hinges", false), view);
```

`panelTilingFromPolygons` accepts a caller's own convex triangles and quadrilaterals with their hinge segments, in
code only. `foldPanels` takes any array of angles, so a field of your own can drive the fold. `drawHingedPanels`
takes `{ line, mark }` callbacks that replace the built-in line material and panel motif. The instrument only names
bundled tilings; binding a user's own mesh as panels (its faces and adjacency) is future host work.

## Limits

A tiling is limited to 4,000 panels (a grid is counted before retention, so retention cannot be used to slip past the
limit), and a fold angle to 179 degrees. Over a limit the call fails naming the control to
reduce (*Columns* and *Rows*, *Substitution depth*, *Thickness*); nothing is truncated. The model is kinematic
only: panels are rigid, folding is along the spanning tree, and the solver does not detect panels that pass through
one another (the painter's order reports overlaps it cannot settle). It is not cloth simulation, and it makes no claim
about printable joints, paper stress or fabrication.
