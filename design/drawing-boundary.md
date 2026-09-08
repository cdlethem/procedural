# Drawing values and first adapter boundary

Owner: root. Status: design direction reviewed by Sol and accepted by root with the
resolutions below; exact catalog contracts remain pending. No implementation/support claim.
Evidence revision: `b64fadf8cc484025f58a112b95630a7b0c420ea3`.

## Decision and artist benefit

Keep retained placement/field attributes separate from drawing values. An artist can
recolour or substitute marks without rerunning placement or field sampling. The running
[FieldMarks helper](../packages/java/examples/FieldMarks/MarkField.java) demonstrates
that separation with five named arrays and a small `drawMark` method. Its length,
palette and bar edits have [actual JAVA2D evidence](../evidence/reproductions/cp1-java2d/decision.md).

Introduce a small ordered drawing-value boundary for ports: explicit endpoint segments
and filled convex quads with explicit colour. These are data types and adapter behavior,
not new generative operations admitted by candidate frequency. Native examples continue
to use ordinary loops. No persisted recipe, generic scene graph or field-expression
language is needed to draw this piece. A public convenience can follow when native usage
shows what repeated work it saves; the current composition helper remains example-owned.

## Evidence and limits

[pelines](../survey/out/2018/Generativos/pelines/notes.md) independently samples attributes
at grid positions. Its endpoint clamping is an artwork choice, so adapters must not clamp
individual endpoints to canvas edges. Normal raster clipping at the surface boundary is
different: it preserves the original line geometry.

[ciserp](../survey/out/2019/generativos/ciserp/notes.md) feeds newly advanced positions
back into subsequent noise samples and draws perpendicular spokes plus faint step trails.
That integration must stay in a future reviewed operation. Its spokes and trails can use
endpoint segments with distinct styles in their original order. A stream of separate
segments does not claim joined-polyline stroke semantics: caps and alpha overlap at shared
endpoints can differ. Dots, joined paths, signed simplex fields and exact ciserp
reproduction remain explicit pending capabilities, not implicitly supported by this slice.

Quads come from the validated CP1 mark-substitution design test, not an inferred ciserp
candidate or newly claimed measured artistic range. The shared field/offset configuration
in the actual example supersedes the earlier three-seed walkthrough for this particular
piece; independently configured fields remain possible with the existing core.

## Proposed value semantics

Canonical values are JSON-compatible records, with no native renderer objects. The
following spelling is proposed for the future catalog schema, not a second authority:

```json
{"kind":"segment2","from":[1,2],"to":[3,4],"rgb":3244369,"opacity8":180,"width":1,"cap":"round"}
```

```json
{"kind":"quad2","vertices":[[0,0],[4,0],[4,2],[0,2]],"rgb":3244369,"opacity8":180}
```

- Coordinates and width are finite binary64 values in logical canvas units, x right,
  y down. Geometry is already in canvas coordinates; no implicit transform stack.
  Width must be positive. The first segment capability supports round caps only.
- RGB is an integer in 0..16777215, encoded sRGB8; opacity is a separate integer in
  0..255, straight alpha. There is no signed packed host colour or implicit colour mode.
- A quad has four distinct vertices in cyclic order, strictly convex, with no crossing
  edges or collinear triples. Either winding is accepted; it has fill only, no outline.
  Zero-area bars emit no quad. Segment records require distinct binary64 endpoints;
  producers constructing zero-length segments emit no command. Canonicalize signed zero
  to positive zero before equality checks. These are declared
  degeneracy rules, not host-dependent accidental dots.
- The initial adapter coordinate profile is binary32: round each coordinate and width
  once to IEEE-754 binary32, ties-to-even, before native calls on every target. Reject
  overflow or positive width rounding to zero. Reject a quad that loses strict convexity
  or distinct vertices after conversion; omit a segment whose converted endpoints coincide,
  while still consuming its encounter index. Collapsed segment omission avoids accidental
  host round-cap dots; malformed quad topology is an error rather than an inferred shape.
  This makes host float conversion explicit without restricting core field/layout values.
- Commands execute in encounter order using source-over compositing. Do not group by
  colour, kind or transparency. Opacity zero is valid and has no visible contribution.
  Coverage/antialiasing and final pixel rounding remain native raster behavior; no pixel
  identity across renderers follows from matching command values.

Finite float32 values alone are not a safe rasterizer domain. Root and Sol selected an
explicit [initial profile policy](drawing-profile-policy.md): density 1, surfaces up to
2048 per axis, canvas-relative overscan and positive bounded stroke width. This is
package policy; native boundary tests must establish each host's support. It is not an
artistic range or universal safety guarantee. Ports cannot invent different limits.
Exact predicates and validation/conversion precedence still need catalog form.

Each command is self-contained: segments use stroke only, quads use one closed filled
path/native quad with no stroke. Adapters explicitly change stroke/fill state when kinds
alternate; fresh-surface ownership does not excuse command-to-command state leakage.
A quad is one fill operation, not two separately source-over blended triangles that
could introduce an alpha seam. A claiming adapter provides both kinds and round caps;
missing support is UNSUPPORTED_CAPABILITY at frame preflight. Unknown command kinds or
cap values are INVALID_COMMAND, rather than late capability discovery.

Endpoint trigonometry stays in example mark construction. Its eventual portable numeric
fixtures must specify tolerance independently from the adapter's exact binary32 conversion.
The drawing adapter cannot recalculate headings, sample fields or call RNG. A future
path operation can share these drawing values without sharing CP1's retained array schema.

## Streaming, ownership and failure

The canonical contract is a sequence of independent data records. Native implementations
may translate bounded packed batches with named fields; callbacks alone are not the
interchange format. Validate a complete batch before drawing any of it, preserve order
across batches, and report the failing command index with stable INVALID_COMMAND or
UNSUPPORTED_CAPABILITY. No silent fallback. Batch failure is atomic for that batch only;
earlier successful batches remain drawn. Preflight the surface before the first batch.
Indices are zero-based encounter indices across the frame, including conversion no-ops;
empty batches do not advance them. Any validation/capability/native/context failure aborts
the frame, rejects later batches and prevents successful completion. Atomicity applies to
validation and preflight, not rollback after a native failure partway through drawing.
An aborted partial surface must never be reported as a completed output.

The [exact geometry investigation](../fixtures/drawing/geometry-investigation.json),
regenerated by `tools/build_drawing_geometry_fixtures.py`, includes a valid quad whose
ordinary binary64 determinant calculation loses a nonzero turn to cancellation, plus
post-conversion collapse and rounding ties. It is pre-contract evidence, not a native
implementation or a tested rasterizer domain. Topological validation must use exact
signs of determinants over the represented coordinates, not a blanket epsilon.

The producer owns its buffers and must not mutate them during synchronous consumption.
Adapters do not retain input buffers after return. Streaming uses O(batch size) temporary
memory and does not force simultaneous position, attribute and command object lists.
The initial example retains attributes for edits; that does not promise that a multi-million
step path will retain all positions. Batch size is a work/memory setting, not an art control.

First support is an integration-allocated surface transferred to the adapter for exclusive
ownership during begin through successful end. Fresh means no prior drawing, full-surface
clip, identity transform and a density-1 backing store. Width and height are explicit
positive integer pixel dimensions and background is explicit RGB24. Callers cannot draw
or mutate state during the frame. Successful end returns the completed surface to the
integration for display/save and eventual release; failures return no completed surface.
The integration releases resources on failure as well as success. First support is this
explicitly owned fresh drawing surface for a frame. Its environment
specifies width, height, density 1, opaque RGB background and source-over rendering.
The adapter initializes all state it relies on and owns it until frame end. Lifecycle
begin/end, save and display belong to host integration, outside portable computation.
No arbitrary caller clipping, blend mode, transform or shader state is accepted in this
first profile. Drawing on a borrowed existing surface requires a separate contract and
native state-restoration tests; the helper's current push/pop checks do not establish it.

The eventual catalog capability declaration must name the precise adapter profile and
its supported renderers. Unknown renderers, unsupported density or missing surface
readiness fail preflight before drawing. Context loss aborts the frame; replay requires
explicit reconstruction from retained values. Android lifecycle support must be exercised
on Android, not inferred from sharing Java source.

## Acceptance before implementation or support claims

1. Sol challenges this boundary; root resolves consequential choices. Then write the
   authoritative catalog value/capability schema and fixtures, with exact validation and
   conversion algorithms, versioning and stable error precedence. This proposal alone is
   insufficient to assign adapter implementation.
2. Distinguishing fixtures cover order-dependent translucent overlap, negative/off-canvas
   coordinates, unequal x/y values, both quad windings, invalid/degenerate geometry before
   and after float conversion, invalid colours/opacity/width, batch atomicity and failure
   indices. Verify every claimed target against the same records.
3. Refactor the CP1 portable route to produce these values; retain the editable native
   mark extension. Check base, length, palette and bar geometry/colour invariants before
   raster comparisons. Preserve the existing validated helper as historical evidence,
   with new source hashes and a separately registered render budget for changed code.
4. Run actual Processing, p5.js, py5 and Android adapters on fresh surfaces, including
   lifecycle and unsupported-capability paths. Register per-target visual acceptance
   before rendering. Existing core conformance is not adapter evidence.

## Alternatives considered

Keeping only host draw calls is useful as an extension but leaves no shared command
boundary to test or export. A scene graph adds lifecycle and transform complexity before
the example needs it. A universal mark-instance record would conflate CP1's independent
samples with CP2's evolving path state. Unbounded retained command lists impose avoidable
memory costs. Arbitrary caller-state compatibility expands the first renderer contract
beyond what the current tests establish. These can be investigated when an artist-facing
capability needs them; none is silently promised here.

## Independent review and root resolution

Sol accepted the responsibility split and identified four prerequisites: unambiguous
degeneracy ownership, a safe rasterizer domain, absolute failure indices with aborted-frame
semantics, and concrete exclusive surface lifecycle. Root accepted all four and integrated
them above, including explicit stroke/fill transitions. The numerical investigation and
profile policy are now linked above. Next work is their complete catalog contract and
shared fixtures, followed by adapter implementation and actual host validation.
