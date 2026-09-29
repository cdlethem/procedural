# Quilled Paths

Strips of paper stood on edge, following a scaffold of lines, rolled into tight spirals at their ends
and nested inside one another. The starting picture is a contour landscape: bands of coloured paper
wind across the sheet, the closed ones holding a second and third strip inside them, the open ones
finishing in little rolled coils, all seen from a tilted camera so the walls, their thickness and
what hides what are clear. Turn the view to **flat** and the same sculpture becomes a plan drawing of the
paper's top edge, a set of coloured ribbons and coils that reads without any camera.

A new seed rearranges the contour landscape, the scattered scrolls and the wandering of arms, and
changes which paths stand lower. It never changes colours.

## Choose the scaffold

| Scaffold | What you get |
|---|---|
| **Contours** | The level lines of a noise, hill, wave or saddle landscape. Closed loops nest inside themselves; open lines end in coils. |
| **Letters** | The outline rings of a word, counters included. Every ring is a closed strip, so letters nest like target rings. |
| **Spirals** | Archimedean, logarithmic or fermat arms from a small core outward, each ending in a coil. |
| **Scrolls** | Short S-shaped strips scattered by a Poisson population, each rolled at both ends: the classic C and S scrolls. |

The scaffold is bundled and chosen here. Your own paths (a route, a contour family from another
instrument, a warped grid) go through the library functions below; binding a host's own files to a
saved instrument is future host work.

| Controls | What changes on the canvas |
|---|---|
| **Scaffold** | Which of the four path families is used. |
| **Contour field / Frequency / Hill count / Hill radius** | The landscape whose level lines are drawn. Wide hills merge into one summit; narrow ones keep separate rings. |
| **Contour levels / First threshold / Threshold interval** | How many level lines, where the first one sits, and how far apart they are. Crowded lines lose their later strips (see clearance). |
| **Word** | Which word's outlines are drawn. |
| **Spiral / Arms / Turns / Core size / Arm variation** | Spiral law, number of arms, how many times each winds, how big the empty core is, and stable per-arm differences in length and start angle. |
| **Scroll separation / Strip length / Length variation / S bend** | How far apart the scrolls sit, how long each is, how much shorter some are, and how far each swings sideways. |
| **Center, Width, Height, Rotation** | Placement of the scaffold; the camera pivots about the center. |

## The paper

| Controls | What changes on the canvas |
|---|---|
| **Wall height / Paper thickness** | How tall the strips stand, and how wide their top edge is. Thickness is what you see from above; height is what you see when tilted. |
| **Height variation** | Stable per-path shortening of walls. A new seed lowers different paths. |
| **Clearance** | The least gap between two strips. Wherever a strip comes closer than this to a higher-ranked one it is cut back: scaffold strips outrank nest rings, shallower rings outrank deeper ones, and earlier paths outrank later ones. The cut ends are visible, not hidden, so no two walls ever pass through each other. |
| **Path resolution** | The longest straight piece of a centerline. Finer is smoother and slower. |

Bends tighter than the paper are not inverted: the strip pinches to a narrower top edge there, so no
wall ever turns inside out.

## Nesting

| Controls | What changes on the canvas |
|---|---|
| **Nest rings** | Extra strips inside (or outside) every closed path, one every **Strip spacing**. A ring stops where its offset would cross itself or collapse, so a narrow stem or a small hill nests less deeply than a wide one, and only for that path. Open paths do not nest. |
| **Nest toward** | Inward, outward or both. |
| **Strip spacing** | Centerline distance between a path and its rings. It cannot be smaller than paper thickness plus clearance. |
| **Nest height step** | Each ring is this much taller or shorter than the one before: a negative step makes a crater, a positive one a spire. |

## Rolled ends

| Controls | What changes on the canvas |
|---|---|
| **Rolled ends** | None, start, end or both ends of every open strip roll into a spiral that leaves the strip tangentially. |
| **Curl direction** | Left or right rolls both ends toward the same side of the strip (a C scroll); opposite rolls them toward opposite sides (an S scroll); random chooses each end independently and stably. |
| **Curl radius / Curl gap** | The outer radius of a roll, and the gap between successive turns. Larger radii make more turns; the innermost turn is as tight as the paper can bend. A roll that touches another strip is cut at the point of contact. |

## View and material

| Controls | What changes on the canvas |
|---|---|
| **View** | Tilted draws walls with depth; flat is the plan view of the tops. |
| **Camera yaw / pitch** | Turn the sculpture about the vertical axis; tilt away from looking straight down (near 0 the walls are edge-on, near 85 the tops nearly vanish). |
| **Zoom** | Scales the whole picture about the center; line weights keep their size. |
| **Colour by** | One colour per path and its nests, by nest ring, along the palette by contour level or arm, along the palette by wall height, or one colour. |
| **Shading / Light direction** | How strongly walls are lit from one side, and from where. |
| **Edge line** | A dark line along the top edges of the paper. |

Faces are painted back to front in order of their plan depth, which is the correct visibility order
for walls standing on one ground plane.

## Try these

- **Flat plan of a landscape:** *View* flat, *Colour by* level, thickness 4.
- **Crater:** Hills scaffold with narrow hills, *Nest rings* 4, *Nest height step* −0.2, pitch 60.
- **S scrolls:** Scrolls, *Curl direction* opposite; switch to left for C scrolls.
- **Letters as targets:** Letters, *Nest rings* 5, *Strip spacing* 5, *Colour by* ring, flat.
- **One long coil:** Spirals with one arm, eight turns, thin paper, no rolled ends.

## Use the pieces in code

Every stage is an ordinary function returning a frozen, cached value; the named instrument is these
same functions. Lengths are canvas units, angles degrees, and nothing is fetched.

```js
import { contourPaths, quillStrips, quillGeometry, quillProjection, quillPaper, drawQuilled } from "@procedurals/instruments";

// Any list of Path values is a scaffold: a contour family here.
const scaffold = contourPaths({ seed: 4, source: "noise", width: 480, height: 440, centerX: 320, centerY: 320,
  resolution: 56, frequency: 2.4, aspect: 1.3, hillCount: 5, hillRadius: 0.2, levelBase: -0.2, levelStep: 0.12, levels: 6, rotation: 0 });

const strips = quillStrips(scaffold, { seed: 4, spacing: 9, nest: 2, nestSide: "inward", thickness: 3, clearance: 1, resolution: 4,
  overlap: "trim", terminals: "both", curl: "opposite", curlRadius: 22, curlGap: 1.5 });
strips.diagnostics;               // trimmed segments, where nesting stopped and why, rolled ends
const geometry = quillGeometry(strips, { height: 30, heightVariation: 0.3, nestHeight: -0.12 });
const projection = quillProjection(geometry, { yaw: 12, pitch: 52, zoom: 1, pivot: [320, 320], anchor: [320, 320] });
projection.footprint;             // bounds, convex hull and each strip's projected ground outline
```

Use `overlap: "reject"` to stop with a message naming the first pair of strips instead of trimming.
Replace the painter with any callback over the same faces (`drawQuilled(p, recipe, { face })`);
`quillComposition(input)` resolves the named instrument to its typed descriptor. Exceeded limits
(vertices, strips, faces, roll turns) throw errors that name the control to change.
