# Motif compositions

These three editable p5 examples show how retained placements support different marks.
The [Ornament field](../packages/javascript/examples/ornament-poster/index.html) makes a
botanical scatter or an ordered repeat. The
[Shape matrix](../packages/javascript/examples/geometric-panel/index.html) makes a sparse,
staggered or crowded arrangement of geometric shapes. The
[Orbital brush](../packages/javascript/examples/orbital-brush/index.html) draws intersecting
loops as ribbons or beads.

| Study | Placement record | Main construction controls | Mark and colour controls |
| --- | --- | --- | --- |
| Ornament field | Seeded accepted circles or a 12 × 12 regular grid | Seed, layout, density, mark scale, angle, angle stride, horizontal and vertical offsets | Relative petal, leaf and emblem weights; palette; optional guide |
| Shape matrix | Regular grid, including one row or one column | Independent rows and columns, density, scale, alternate row and column shifts, horizontal and vertical offsets, angle and angle step | Relative wedge, bar, disc and arc weights; palette; optional grid guides |
| Orbital brush | Equal-distance samples of explicit ellipses or radial-wave source paths | Path count and samples, centres and centre steps, radii and radius step, angles, lobe count and wave depth | Ribbons, beads or perpendicular dashes; size, spacing, opacity, guides and palette |

Set a shape weight to zero to leave it out; larger weights make it more common among
occupied anchors. At least one weight must remain positive. Density changes how many
anchors carry marks. Shape matrix limits combined rows × columns to 2,048 cells so edits
remain bounded; each dimension can independently be one. Both field canvases preview on
paper in the page, while the p5 canvas and saved PNG remain transparent for layering.

For each study, **Reset** or **0** restores all starting controls; **Save** or **S** exports
the current transparent PNG. Palette and mark treatments recolour or repaint retained
geometry. Orbital brush limits the combined source vertices and sampled points to 64,000
per edit, and changing mark size or opacity leaves its sampled path record intact. Colours are copied
from the shipped palettes, so editing an example does not mutate those palette records.

Run the examples from the repository with:

```sh
node tools/serve_survey_coverage_studies.mjs
```

Open `http://127.0.0.1:8789/packages/javascript/examples/ornament-poster/index.html`,
or replace `ornament-poster` with `geometric-panel` or `orbital-brush`. The server uses
the existing local p5 2.3.2 installation. Edit each study's `sketch.js` to replace its
marks. Ornament and matrix mark records are composed in the example-private
`examples/motif-compositions/field-records.js` from the package's circle placement and
regular grid operations. Orbital source paths are assembled in the example-private
`orbital-records.js` and sampled with the package's `resamplePolyline2D` operation.

Previously saved Studio poster and panel layers retain their historical composition
until edited. New layers start with these field and matrix controls.

The [external reference collection](external-art-corpus.md) supplies composition context
from Joshua Davis and Casey Reas.
