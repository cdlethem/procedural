# Visibility Drawing (brief 53)

Status: **instrument, 2026-09-30; unreleased.** Instrument id `visibility-drawing`, title "Visibility Drawing", a study in
section H of the [release roadmap](next-release-roadmap.md) built on the spatial foundation F8
([spatial inputs and drawing](composition-spatial.md)). Code: `packages/instruments/src/composition/visibility-{scenes,features,view,drawing}.ts`
and `src/adapters/visibility-drawing-instrument.ts`; guide `guides/visibility-drawing.md`; tests
`tests/composition-visibility-drawing.test.ts` (25 tests). It draws with 2D marks only (no WEBGL) and claims neither scan
reconstruction nor physical accuracy.

## What it makes

A solid drawn as selected lines instead of filled polygons: **silhouette**, **crease** (dihedral angle above a threshold),
**rim** (boundary edges), **section** curves (exact plane cuts from `mesh-section.ts`) and **contours** (triangle-exact
iso-lines of height, slope or mean curvature). Each class is independently *Removed*, *Visible only* or *Hidden dashed*, and has
its own path material (`pathMaterial` ink, stitch or beads) and weight. Hidden-line removal is the foundation's exact solver.
Visible faces can be toned by **hatching** (families of parallel strokes that multiply as faces darken, cut by the same solver)
or by an opaque **painter-ordered fill**, from a fixed light. A depth cue lets weight and/or opacity follow depth along every
line. An edge-only drawing (Surface tone None) is a complete drawing by itself.

## Stages, what each caches, and what recomputes

```
scene ─ visibilityMesh(shape, detail, terrain, vase profile, seed)            cached by construction
  ├─ VIEW INDEPENDENT (cached by mesh content + rule)
  │    creaseEdges(angle, kind) · boundaryEdges · sectionCurves(axis, tilt, spacing, offset) · contourCurves(field, levels)
  ├─ camera: viewCamera(mesh, view)                                             a small value; never cached, never touches the mesh
  └─ VIEW DEPENDENT (cached by mesh + camera + rule)
       silhouetteEdges · ownership (crease minus silhouette) · curvePaths per class (exact hidden-line removal)
       tonedHatch(light, rule) · paintedFaces (painter order)
  appearance (never cached, recomputes nothing): materials, weights, palette, colour, depth cue, hidden-line style, fill colour
```

| Edit | Recomputed | Reused |
|---|---|---|
| Palette, weight, material, Color by, Depth cue, hidden opacity/weight/dash, Fill color/paleness/bands/shade, Stations, Visible only <-> Hidden dashed | nothing (the producer values are the identical frozen objects) | everything |
| Camera (Yaw, Pitch, Roll, Projection, Eye distance, Center, Object size) | silhouette edges, the visibility solve of every drawn class, hatch, painter order | mesh, topology, creases, rim, sections, contours (the same objects) |
| A class rule (Crease angle, Section spacing, Contour levels, ...) | that class's candidates and its visibility solve | every other class's paths (the same arrays) |
| Light or Smoothing angle | hatch structure (families depend on tone); fill tone is per draw | all line classes |
| Shape, Detail, seed, terrain, vase profile | everything | nothing |
| A class set to Removed | not computed at all | - |

`constructionCounts` (exported as `visibilityConstructionCounts`) counts real constructions by stage, so a host or a test can see
which stage ran; the tests use it to pin exactly the table above (a camera edit: 0 creases, 0 rim, 0 sections, 0 contours, 1
silhouette, 1 hatch, one visibility solve per drawn class; an appearance edit: all zero; a contour-level edit: 1 contours, 1
visibility solve, everything else 0).

## Ownership: no duplicates, no cracks

* **One class per edge.** An edge that is both crease and silhouette is drawn by the silhouette when that class is drawn (an outline
  is one continuous stroke); `creaseCurvesExcluding` chains the remaining crease edges. With the silhouette Removed the crease
  class owns them again. Boundary edges never coincide with either (silhouettes exclude boundary edges; a boundary edge has no
  dihedral angle). A quad's diagonal is never an edge.
* **Shared edges and cracks** are the foundation's: a closed occluder region with a rounding slack, so a triangulated wall has no
  seam and a curve on the surface is never hidden by the faces it lies on.
* **Tolerance.** Drawings use one millionth of the object's bounds diagonal (`visibilityTolerance`), a thousand times the
  foundation default. Measured slivers of 1e-5 canvas units split a sphere's outline at silhouette vertices under the default;
  hidden stretches shorter than the tolerance and depth differences below it are ignored, and points closer than 0.01 canvas
  unit in a run are one point.
* **Near plane.** The solver clips curves and occluders to the perspective near plane; hatch and fill triangles are clipped to it
  in camera space before projection, so geometry behind the eye is never mirrored (tested with a slab half behind the eye).

## Hidden-line policy per class

Visible runs are drawn with the class's material; hidden runs, when the class is *Hidden dashed*, are drawn as `stitch` at the
*Dash length* period (the stitch dash covers 54% of the period), at *Hidden weight* of the class weight and *Hidden opacity*, and
before the visible runs so a dash never covers a stroke. Opacity is applied by a surface wrapper that scales the alpha of every
fill and stroke a material sets, so it works for ink, stitch and beads alike.

## Tone: hatch and fill

`darkness = 1 - (ambient + (1 - ambient) max(0, n . L))`, `L` from azimuth (0 = +z toward +x) and elevation (world fixed), `n` the
triangle's face normal, blended (interior-angle weighted) with the faces around its corners whose normals lie within
*Smoothing angle* of it (a cube stays flat, a sphere smooth; both triangles of a flat quad agree). Back faces of an open mesh are
lit with the flipped normal (two-sided). No cast shadows.

*Hatch.* Family `j` of `F` runs at `angle + 180 j / F` degrees on the lattice of lines `(k + 0.5) spacing` anchored at the canvas
origin. A triangle carries family `j` when `darkness > t0 + (1 - t0) j / F`. The projected triangle (near-plane clipped, convex)
is cut by each lattice line, the two end points are unprojected onto the triangle's plane, and the 3D segment goes to the
foundation's `hiddenLines`, so a stroke is hidden exactly where a nearer surface covers it. The visible pieces of one lattice line
are re-joined across triangles only where the screen gap is at most 1e-5 and the depth gap at most 1e-7 relative (a depth jump is
another surface). The planar-domain hatcher was not used: each hatch region is a convex projected triangle, for which a direct
line-polygon clip is exact and much cheaper than building an exact planar domain per triangle, and exact visibility of the strokes
comes from the 3D solver, not from polygon Booleans.

*Fill.* `paintOrder` (far to near; `cull: "back"` for a closed consistently oriented mesh, none otherwise) drawn as opaque
polygons with a same-colour 0.8 stroke that hides antialiasing seams, tone by `fillBands` steps, mixed toward white by
*Fill paleness*, darkened by *Fill shade*. Opaque by design: a transparent layer paints the object's silhouette only, never the
canvas, and translucency belongs to the layer.

## Depth cue

`depthRange` is the depth interval of the mesh's vertices. `cueBin` puts a depth in one of 6 bins; `splitByDepth` cuts a projected
path exactly where its depth crosses a bin boundary (1/depth is affine in the screen parameter under perspective, depth itself
under orthographic projection) so weight and opacity vary along a single line. Factor `1 - 0.85 amount (bin + 0.5) / 6`.

## Contours: fields

`height` is world y; `slope` the angle in degrees between the vertex normal and +y; `curvature` the mean curvature from the
dihedral angles of the real edges, `H_i = (1/4) sum_e |e| theta_e / A_i` (quad diagonals are not edges, so the triangulation
cannot add noise; the cotangent Laplacian, tried first, drew diagonal-dependent diamonds on a torus). Levels are evenly spaced
strictly inside the field's range (5th to 95th percentile for curvature). A field constant up to discretisation (curvature
varying by under a tenth of its size, as on a sphere) has no contours, which is a valid empty result reported as `range: null`.

## Controls and groups

Groups: Form, Placement (center X/Y, Object size), View, Silhouette, Creases, Rim, Sections, Contours, Surface tone (Hatch,
Fill, Light), Lines (with the one **proportional** cluster, Stations: Station spacing and Dash length, both canvas lengths, so
scaling them together rescales every dash and stitch pattern). Other candidates were not proportional (weights sit in their
class group; counts and angles never are). Inline `visibleWhen`: Detail (not the figure), Terrain (shape terrain), Vase profile
(vase, assembly), Rim (open shapes), Eye distance (perspective), each class's own controls (mode is not Removed), the hatch,
fill, smoothing and light controls by *Surface tone*, Cue strength (a depth cue chosen). Left visible because their
relevance is a disjunction a conjunctive condition cannot state (listed, not guessed): Hidden opacity, Hidden weight, Dash length
(any class Hidden dashed), Station spacing, Bead scale (any class stitch or beads, or dashed), Color by, Depth cue.

Slider intervals against hard limits: Detail 1 to 5 (hard 8; 6 for the icosphere and assembly, checked and named), Section
spacing 0.02 to 0.3 (hard 0.004, i.e. at most 250 planes), Contour levels 1 to 40 (hard 200), Crease angle 5 to 120 (hard 0.5 to
180), Object size 200 to 640 (hard 20 to 5000), Eye distance 1.5 to 10 (hard 0.25 to 100: the eye may enter the object). The
seed is used by the terrain and the assembly (slots, sizes and turns of the four parts); other shapes are unseeded and say so
(`usesSeed`).

## Bounded work (measured)

Named limits: hatch segments at most 150,000; section planes at most 250; contour levels at most 200; visibility segments at most
200,000 per class and the solver's work bound (both re-thrown naming Detail, Section spacing, Contour levels, Hatch spacing or
Hatch families); drawing work 1,500,000 units (one per stroke plus one per stitch or bead), refused naming Station spacing, Hatch
spacing, Contour levels, Detail and Ink. Nothing truncates. A 500-line curvature ask on a fine torus is refused with
`hiddenLines: 352812 curve segments; the limit is 200000`.

Measured on this machine (single runs, no warm-up; the machine was lightly loaded for the first column and carried a load average
near 80 on 24 cores for the second, so treat the second as a pessimistic bound):

| Case | first prepare + draw | camera-only edit | appearance-only edit | structural edit |
|---|---|---|---|---|
| Default assembly, detail 3 | 123 ms / 2.4 s | 92 ms / 0.87 s | 3 ms / 36 ms | 41 ms / 0.48 s |
| Assembly detail 6, sections 0.03, 40 contours dashed, fill + hatch 3 px | 1.45 s / 10.3 s | 0.83 s / 4.0 s | 27 ms / 146 ms | 0.40 s / 1.1 s |
| Icosphere detail 6 (81,920 triangles), hatch, sections 0.02, 40 slope contours | 0.59 s / 4.7 s | 0.26 s / 2.3 s | 5 ms / 95 ms | 0.27 s / 3.0 s |
| Terrain detail 8, all classes, fill + hatch | 135 ms / 0.56 s | 93 ms / 0.34 s | 7 ms / 42 ms | 74 ms / 0.31 s |

(A structural edit here changes hatch angle, section spacing, contour levels and crease angle together.) An 80-configuration
fuzz over the whole control space (slider ranges plus 15% beyond them, random seeds and selects) produced no unnamed error; two
configurations hit named limits. These are observations, not certified slider ranges.

## Boundary decisions made conservatively

* Closed consistently oriented meshes use front-face occluders (identical answer at half the work); open meshes use all
  triangles and two-sided light. A `data` mesh with inconsistent orientation is drawn as an open mesh.
* Silhouette edges are polygon edges of the mesh (the true silhouette of the faceted mesh), not a smooth-surface contour.
* A hatch stroke that stops at a change of surface is not joined across it.
* The assembly's parts never touch (gaps of at least 0.01) so the painter order is exact and coplanar contact never arises.
* Hidden and Visible only share one computation, so toggling between them is instant.

## Not done

Host binding of a user's mesh (the functions accept any validated `Mesh`; the instrument names bundled shapes only), cast
shadows, translucent fills, smooth-surface (non-polygonal) silhouettes, contours of user fields in the instrument (the function
`isoContours` takes them), a WEBGL check and any Studio control acceptance in the real interface.

## Review record (rendered through a throwaway SVG surface and Chromium, not accepted through the real interface)

Reviewed: the default and three other seeds (parts move between slots and change size and turn); nine strongly different
settings (sphere sections + slope contours, oblique torus sections with three hatch families, terrain topographic contours with rim,
seeded ridges with banded fill plus hatch plus dashed contours, open goblet with sections and hatch, faceted figure with dashed
creases and banded fill, beads and stitches over a fill, torus curvature contours in strong perspective, an eye inside the terrain
bounds); nine camera moves (yaw 100 and 200, top-down, from below, roll with a close eye, orthographic, everything dashed in an
isometric view, a dense combination); and six layered pairs in both orders with the unmodified Substitution Tilings (translucent
wash), Motif Ecologies and Contour Scores, plus a filled drawing over and under the wash and the motifs (the opaque fill hides
what is beneath it and the motifs cross it above). Depth is real: the ring is hidden by the vase and reappears on its far side, the
plinth's edges are dashed exactly where the solids stand on them, and a perspective eye at 0.55 of the object's size clips the
terrain at the near plane without cracks.

Defects found by looking, and fixed: (1) the default drew the assembly small; camera size now measures the smallest sphere holding
every vertex, not the bounds diagonal (a sphere had been drawn at about 58% of its declared size). (2) A hidden sliver of 1e-5 canvas units at a
silhouette vertex split a sphere's outline into four runs; the solver tolerance is 1e-6 of the object and repeated points are merged.
(3) The depth cue used the bounding sphere's depth interval, so an object's outline crossed only two bins; it uses the vertices'
interval. (4) Mean curvature from the cotangent Laplacian drew noisy diamonds on a torus because a quad's diagonal changes the
triangulation, and the vertex area over triangles skewed quads by a third; curvature now uses the real edges' dihedral angles and
face-share areas. (5) Fill in palette entry 1 matched the crease colour and hid the creases; *Fill paleness* mixes it toward
white. (6) Smooth vertex normals on a box gave the two triangles of the plinth's top different tones (a diagonal shadow across a
flat face); tone now blends only faces within the *Smoothing angle*. (7) A hatch stroke joined across a change of surface
carried a wrong depth jump; joins need matching depth. (8) A constant curvature field (a sphere) asked for a million contour
segments of discretisation noise; such a field now has no contours.
