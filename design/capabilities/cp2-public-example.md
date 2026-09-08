# CP2 public example: draw movement, then choose its marks

Status: root implementation and acceptance brief, before public candidate renders.
Operation: `path.gradient-trace-2d` 0.1.0. This is the next I2 capability, not completion
of rare-family coverage or the downstream milestones.

The artist starts with seed, starting positions, step count and distance. The package
handles feedback integration. The result can be drawn as movement segments or decorated
with perpendicular marks; palette and mark extent can change without recomputing movement.
The editable composition uses public regular-grid, gradient-path and cyclic-palette values.
The native drawing adapter remains the versioned internal starter component already used
by CP1. No private trace implementation or generic recipe executor belongs in this example.

Use the accepted private experiment's explicit base composition: a row-major 6 by 4 grid
starting at [60,80], pitch [104,160], seed 42, 2000 steps, distance 0.4, field scale 0.002,
field offset [0,0], angle base -20 and scale 40. Each start is traced sequentially; retain
24 immutable paths for subsequent mark and palette edits (1,152,384 raw payload bytes).
This bounded example retention is deliberate, not an implicit library memory guarantee.
Generate drawing commands in bounded synchronous batches; do not retain every command.

Render 640 by 640 at density 1, background ECE7DA, stroke width 1, round caps, opacity 150.
Base palette: 31A151, FFA71E, 05084C, DE4638, 3DBDB7. Select each path's colour using the
public cyclic palette at pathIndex/paletteLength. Marks attach to point i+1 for heading i,
for i=0,4,8,...; heading+pi/2 sets perpendicular direction, total length 12. Trace mode
emits every movement as an independent segment, not a joined polyline. Keep these choices
visible in the composition source and starter controls; they are not public defaults.

## Edits and checks

The actual editable example must expose trace/marks, length 12/24, base/alternate palette,
count 2000/2001 and distance 0.4/0.8, with save capturing the already displayed composition.
Each control changes only its named setting. Movement controls regenerate the paths;
mark/palette controls reuse the exact same retained objects. Keyboard controls are adequate
for desktop/browser; Android needs visible touch controls. Configuration construction stays
in one named composition function, so the main sketch does not rebuild maps at every mark.

Before native rendering, verify all 24 public paths against the private accepted movement
where Java arithmetic is identical; verify exact count-prefix and first-step invariants,
changed later headings for distance edits, command counts (48000 trace, 12000 base marks),
independent geometry/colour streams and immutable movement. Use shared numeric fixture
criteria for the named cross-target paths; never infer arbitrary cross-target identity.
Native checks must observe actual edit callbacks and save behavior, not only helper calls.

The public visual suite contains base trace, base marks and long marks per target. Compare
Java's mechanism and geometry with the already accepted private images and inspect all
new native outputs. Exact private PNG identity is diagnostic, not a cross-renderer gate:
the native adapters can differ in raster handling. Require correct dimensions, opaque
background, nonempty drawing, expected canonical command counts/style and direct inspection
of continuous varying paths and coherent perpendicular bands. No raster score alone can
approve the visual mechanism. Declare each executor's finite attempt budget and runtime
bindings before launching it; failures consume attempts and are preserved. No CP1 reruns.

## Provenance and limits

Motivation: `survey/out/2019/generativos/ciserp/notes.md`,
`survey/out/2018/Generativos/mantel/notes.md`,
`survey/out/2019/generativos/natalata/notes.md`, and
`survey/out/2019/generativos/limo002/notes.md`, with exact dependency/remainder accounting
in `design/operations/gradient-path-admission.md`. This validates the shared finite feedback
and mark-reuse mechanism. It does not reproduce their simplex fields, fill closure,
modulation, triangulation or nested branches; none is silently attributed to the new core.

The base carrier decision is already visually accepted in
`evidence/parameter-experiments/cp2-path-choice/decision.md`. Finer scale can create long
horizontal runs. Preserve that limitation, canvas exits and path convergence. No isotropy,
source-pixel reproduction, continuous useful parameter range, physics or branching claim.
Native support remains unvalidated until the public example and affected port checks pass.

## Drawing-boundary correction after the first native attempts

The unsuffixed PDE decimals were converted to float before double assignment. The starter
now uses explicit double literals and the officially generated class has a pure regression
covering the default and distance toggle. Initial native failure remains preserved.

The next attempt rendered the three registered visual states but later hit the drawing
profile's coordinate guard on far-offcanvas movement. Keep the raw path and command stream
unchanged. A separate example-only visible stream culls a segment only when its entire
bounding box is disjoint from the canvas padded by one pixel. It never clamps endpoints.
With this piece's maximum segment length24 and width1 round strokes, kept endpoints fit
within[-25,665] and omitted segments cannot contribute to canvas pixels. This is deliberately
not a general clipping operation or a relaxation of the adapter's[-640,1280] domain.

Pure checks for every registered edit must prove raw counts, preserved subsequence order,
wholly invisible omitted bounds, batch<=4096 and successful drawing normalization of all
submitted commands. Report raw source count separately from submitted visible count. The
failed native attempts do not establish final distance/save acceptance; the revised visible
stream needs its own reviewed execution plan, retaining both failures.
