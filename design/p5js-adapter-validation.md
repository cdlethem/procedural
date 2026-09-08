# p5.js adapter validation registration

Root registration, 2026-09-07, before any p5 adapter rendering. Profile authority is
`catalog/drawing/fresh-raster-2d.json`; this is the Canvas2D target, not WebGL.

Use local p5 2.3.2, Playwright 1.63.0 and Chromium 153.0.8010.12 (revision 1243).
Serve only repository test inputs over loopback; disable external requests. Record
source/profile/runner/package-lock/browser identities. Use deviceScaleFactor 2 with
an explicit viewport, and assert every owned graphics buffer remains density 1.
Store images under ignored `.work/reproductions/p5js-adapter`.

Initial budget: one probe suite (pixel and lifecycle parts may run separately once)
and four CP1 images. One corrective suite/four corrective images may follow only a
recorded failure, diagnosis and repair. Compilation, browser launch and pure tests do
not consume image budget. Do not repeat passing images for metadata freshness.

Pixel groups mirror the JAVA2D registration, with browser-specific native evidence:

1. Opaque exact-RGB background at 1×1, 640×640, 1920×1080, 2048×1, 1×2048 and 2048×2048;
   assert logical/backing dimensions and density 1 despite deviceScaleFactor 2.
2. Converted bounds and one-f32-ULP inside/outside both axes; width minimum 1/256,
   1 and maximum M; convex boundary quads; invalid full batches draw nothing. Fully
   clipped commands leave every background pixel unchanged; width-4 central crossing
   is visible. Record subpixel coverage without promising visibility at every alignment.
3. Red/blue opacity128 overlap in both orders: flat interior channels within two bytes
   of source-over arithmetic and later colour dominates. Opaque colour exact, opacity0
   unchanged, both quad windings identical, diagonal/interior uniform excluding 2px edges.
4. Alternate strokes and fills, width8 round-cap extension at x13 but not x10 for a
   segment x16..48 at y32. Assert parent transform/clip/style/pixels unchanged and owned
   geometry positioned correctly with full-surface clipping.

Lifecycle group: invalid environment precedes static capability; allocation/readiness
map to RESOURCE_FAILURE; initialization/draw/end to RENDER_FAILURE. Inject faults into
actual browser Canvas2D calls via internal hooks, preserving the distinction from
spontaneous context loss. Assert prior-batch count/noncommit, absolute index after noops,
no output after abort, backing canvas zeroed and p5 removal once, completion transfer,
idempotent explicit release, and parent preservation. Include empty/noop-only loss,
reentry and cleanup exceptions. Native failure must not leave an active state after
the surface is released.

CP1: render base/length/palette/bar with the existing public JS grid/noise/palette cores,
same explicit composition constants as the JAVA2D CP1 plan. Retain field values while
editing. Compare converted geometry, colour and model values to Java evidence using
exact checks where portable and declared 2e-4 coordinate tolerance for native trig
differences; never claim cross-host pixel identity. Palette preserves geometry, length
doubles segment deltas about the same centres, bars preserve centres. All edits must
change visible pixels; inspect all four outputs and record dimensions, coverage and hashes.

Only all groups plus CP1 establish the scoped browser profile. No py5/Android/WebGL or
upstream corpus reproduction claim follows from this suite.
