# Quilled path sculptures (brief 14)

Status: **implemented on branch `w2/quilled-paths`, unmerged; reviewed from rendered SVG output only.**
Root has not operated the instrument through the real Studio interface, layered it in the app, or
reviewed responsiveness there.

## Artist-facing brief

Paper strips stood on edge along a scaffold, nested inside one another, rolled at their ends and
drawn with thickness and occlusion from a small orthographic tilt camera, or flat as a plan of the
paper's top edge. The instrument is **Quilled Paths** (`quilled-paths`); its guide is
`packages/instruments/guides/quilled-paths.md`.

Computation removed: offsetting closed paths into valid nest rings, rolling an open strip into a
spiral of stated pitch, keeping strips apart, wall geometry that cannot invert at a bend, and a
correct painter's order for walls. Simpler alternative: stroke the paths with thick lines (no
occlusion, no nesting, no rolls). Reusable outputs: strips, wall geometry, projected footprint.

## Frozen boundary

Code: `composition/quill-scaffold.ts`, `quill-strips.ts`, `quill-geometry.ts`, `quill-draw.ts`;
instrument definition `adapters/quilled-paths-instrument.ts`; tests
`tests/composition-quilled-paths.test.ts`. Every producer returns a frozen value, cached by
construction identity (scaffold array identity plus the options that construct it); appearance,
camera and height never rebuild earlier stages.

- **Scaffold** (`quillScaffold`): any frozen `Path[]` is valid. Bundled: `contourPaths` (existing),
  `letterPaths` (outline rings of a word from `typeLine`, unshaped Latin only, `level` = containment
  depth), `spiralPaths` (archimedean `core+(1−core)u`, logarithmic `core^(1−u)`, fermat
  `√(core²+(1−core²)u)`; arm k starts at `2πk/arms`), `scrollPaths` (one sine-S strip per
  `poissonSites` site, random angle/side/length from `componentSeed(seed, "scroll:<i>", …)`). Ids:
  `level:…`, `letter:<ring>`, `spiral:<arm>`, `scroll:<site>`.
- **Strips** (`quillStrips`): ordered `QuillStrip` centerlines plus diagnostics. Ids are
  `<scaffold id>#<piece>` and `<scaffold id>/nest:<±k>#<piece>` (`+k` inward, `−k` outward); seeds come
  from `componentSeed(seed, id, purpose)`. Steps: subdivide (keep vertices, segments ≤ `resolution`),
  rolled ends, nest rings, junction trimming.
- **Rolls** (`rollPoints`): tangent (G1, not curvature continuous) at the join; radius of curvature
  `R − pitch·φ/2π` over the turned angle φ, closed-form position; turns are exactly
  `pitch = thickness + curlGap` apart, ending at the tightest bend `1.25·pitch`. `curl` names the
  side each end rolls toward (viewer's left/right looking along the strip): left/right = C scroll,
  opposite = S scroll, random = stable per strip end.
- **Local nesting**: ring k is `offsetPolyline2D` (miter limit 2) of the original path by
  `k·spacing`. It is valid only if simple, same orientation, shrinking/growing as asked, and no vertex
  nearer the source than 0.9 of the distance. The first invalid ring ends that direction for that
  path only (`diagnostics.nestStops`: `collapsed`, `crosses itself`, `inverted`).
- **Junction policy**: strips rank by (|ring|, ring sign, scaffold order). A segment closer than
  97% of `thickness + clearance` to a higher-ranked kept segment (or to its own strip beyond
  `2r + resolution` along the arc) is dropped; a strip splits into pieces, pieces shorter than `2r`
  are dropped. A roll that touches anything is cut at its first contact (no detached arcs).
  `overlap: "reject"` throws naming the first pair. **Crossing is never supported**: strips are
  apart or trimmed, so no depth ordering of interpenetrating walls is ever needed.
- **Geometry** (`quillGeometry`): per segment a cap and two side walls, plus two end faces on
  open strips; side walls are `parallelTransportRibbon3D` ribbons with a +z normal. Offsets use
  miter joins with a **pinch** at tight bends (slides of inner offsets ≤ 90% of a segment's length,
  miter ≤ 3 half thicknesses; counted in `pinchedVertices`): no quad inverts. Height is
  `height·(1−variation·u)·(1+nestHeight)^|ring|`, at least 0.5.
- **Camera and painter's order** (`quillProjection`): yaw about the pivot, pitch 0–85° from straight
  down, zoom; `screen = anchor + zoom·(u, v·cos p − z·sin p)`. Visible faces (normal toward the camera)
  are painted in ascending plan depth `v` of their centroid; heights never enter the order. This is
  exact for vertical walls over one plane wherever strips are apart, approximate only within one segment.
- **Footprint** (`projection.footprint`): `bounds`, convex `hull` of everything painted, and each
  strip's ground outline rings projected with the same camera (plan outlines when flat).
- **Consumer** (`drawQuilled`): paints projected faces through a replaceable `face` callback;
  `quillPaper` is the stock painter (palette colour by strip/ring/level/height/single, shading from a
  fixed light at 55° elevation, edge line on caps).
- **Units**: canvas units, y down, z up; angles in degrees in options.
- **Limits** (each throws naming the control): 90,000 strip vertices, 4,000 strips, 220,000 faces,
  40 roll turns, 60 million clash tests, 120,000 scaffold points.

## Controls and dependencies

Groups: Scaffold (Contours, Spirals, Scrolls subgroups), Placement (proportional Size), Paper
(proportional Size: wall height, thickness), Nesting, Terminals (proportional Roll: radius, gap),
View, Material. Conditions: contour controls on `source: contours` (frequency on noise/waves,
hills on hills); `word` on letters; spiral controls on spirals; scroll controls on scrolls; nesting
on contours/letters; terminals on contours/spirals/scrolls; curl/roll size on those with terminals not
`none`; yaw, pitch, light direction on the tilted view. Controls a selection hides are neutral (letters
ignore rolls, spirals ignore nesting, flat ignores camera and light direction) and are not even
validated against each other. Wall height, height variation and the nest height step stay visible
in the flat view although they change nothing unless colour is by height (a disjunction the
conjunctive condition cannot state).

## Not done / boundaries chosen

- The instrument always trims; `overlap: "reject"` and the diagnostics are library-only (a drawing that
  throws at draw time cannot be predicted from stored values, and the existing hidden-control
  property test requires drawable random configurations).
- Nesting is per path: a ring that self-crosses ends that direction for the whole path (a narrow
  neck stops nesting of both lobes). Polygon holes/Booleans/offsets with proper joins are the planar-domain
  foundation; nothing here replaces them and the root can retrofit.
- No shadows, no glue junctions, no strip crossings; no per-strip user heights beyond the stable
  variation.
- User paths for a saved instrument need host binding; only the four bundled scaffolds are selectable.

## Checks

`tests/composition-quilled-paths.test.ts` (32 tests): rolls against the radius law and turn spacing
(independent circumradius measurement), subdivision, scaffold laws, exact offset radii and
collapse/stop cases for both windings, roll sides, trimming against a brute-force distance, ranking,
cut rolls, cross-strip clearance on real scaffolds, bounds and messages, box geometry values, pinch
without inversion (orientation and wall-normal invariants), camera formula, culling, and painter's
order compared with a true z-buffer (mismatch < 0.4% of pixels, while a 3D-centroid order differs on
1.7%). Mutations confirmed to fail: painter key including height; no pinch; roll not cut at contact;
ranking by scaffold order only; yaw applied wrongly.

## Review record

Rendered through the throwaway SVG surface. Defects found by looking and fixed: first palette started with a
near-black paper that read as holes; dashed dark lines along strip tops (seam stroke wider than the
edge line's round caps); detached coil fragments after trimming (a roll is now cut at first contact);
hills contour default merged into one blob (added Hill radius; default is noise contours);
muddy palette ramps for height/level colour (now an Oklab ramp); the pinch rule notched clean right
angles (slides are now summed per segment rather than a blanket 45% rule).
