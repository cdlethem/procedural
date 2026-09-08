# JAVA2D adapter validation registration

Registered before native adapter runs, 2026-09-07. Integration owner: root; reviewer:
Sol. Subject: `packages/java-processing/.../Java2DFrame.java`, implementing the reviewed
`drawing.fresh-raster-2d` profile. This is separate from the exhausted earlier CP1
helper/PDE budgets. No native profile support is claimed by this registration.

Use the pinned Processing 4.5.6 core and JDK 17 already recorded by the runtime tooling.
Compile current adapter and core sources for every run; bind source, fixture, runner,
runtime and profile hashes in results. Run under one serialized xvfb executor. Store
images and builds under ignored `.work/`; keep small result metadata in `evidence/`.

Initial budget: one complete probe suite and four CP1 images. Permit one corrective
suite and four corrective CP1 images only after recording a concrete failed predicate
and the proposed repair. Compilation, pure tests and inspection consume no render budget.
Do not repeat successful images just to refresh metadata. Register a revised budget
explicitly if an unresolved finding needs further native evidence.

The probe suite must include these independently asserted groups:

1. Background-only surfaces at 1×1, 640×640, 1920×1080, 2048×1, 1×2048 and 2048×2048.
   Assert logical/backing dimensions, density 1, opaque alpha and exact RGB background
   at every pixel. Complete and explicitly release each transferred surface.
2. Bounds and clipping: normalized coordinates on each boundary and one binary32 ULP
   inside/outside; widths 1/256, 1 and M plus outside values. Invalid input must abort
   before drawing that batch. Fully offscreen valid commands leave the background
   unchanged; a width-4 central horizontal crossing changes interior centre pixels.
   Minimum-width coverage is recorded, with no minimum visible-pixel promise.
3. A 64×64 colour/order panel on black: red and then blue half-opacity quads overlap
   in a flat interior region. Assert channels within two byte values of source-over
   arithmetic, opaque output and blue greater than red in the overlap. Reverse order
   must reverse this inequality. Opaque fill is exact and zero-opacity fill unchanged.
   Both quad windings yield the same complete image. A single translucent quad has
   uniform interior pixels (exclude a two-pixel edge band), including its diagonal.
4. Alternate quads and segments: stroke-only segments do not inherit fill; quads do
   not inherit stroke. A width-8 segment from (16,32) to (48,32) has visible round-cap
   extension at (13,32) and no extension at (10,32). Check identity transform and full
   clip on the owned surface; the parent's existing transform/style/pixels stay intact.
5. Lifecycle: successful end transfers the actual surface once; repeated end/abort
   cannot dispose it. Invalid later batches release the owned surface and publish no
   output. Check original error indices after no-ops and earlier successful batches.
   Exercise allocation/readiness, initialization, draw and end failure at the native
   adapter boundary. Fault injection into a real JAVA2D surface must be identified as
   injected evidence, not spontaneous device/context-loss certification. Assert release
   counts and retained references as well as error codes and state.
6. Route all four CP1 base/length/palette/bar edits through this adapter. Compare the
   canonical command stream and retained field values to the existing CP1 construction;
   record image dimensions, non-background coverage and decoded hashes. Length/palette
   edits must preserve field data and command positions; bars preserve mark centres.
   Require visible pixel changes for all three edits and inspect the four images.
   This is technique/edit-transfer evidence, not upstream baseline pixel reproduction.

Any failing group blocks claiming this host supports the full profile. Keep observed
results, repairs and scope limitations explicit; do not remove a failing case to pass.
