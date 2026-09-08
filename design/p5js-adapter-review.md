# Independent p5.js Canvas2D adapter review

Sol review, 2026-09-07. This review covers the internal p5.js adapter for
`drawing.fresh-raster-2d` v0.1.0 at source SHA-256
`658fc9bfd729faddba13329646168cf9ea61cd3f5535991653625b73c4f41ae7`.
It is limited to p5.js 2.3.2 P2D/Canvas2D in Chromium 153.0.8010.12 on the
recorded Linux x64 host.

The adapter keeps native objects outside the portable state and package public API. It
requests a fresh `p5.Graphics` with explicit P2D, forces density one, and verifies logical
dimensions, backing dimensions and an actual matching Canvas2D context before taking the
surface into the initialization phase. Initialization establishes the profile's transform,
compositing, style and opaque background. A complete batch is normalized before any native
drawing; emitting slots then execute in encounter order, while the portable source offsets
preserve absolute indices across no-ops.

Native allocation/readiness failures resolve as `RESOURCE_FAILURE`. Initialization,
drawing, context-loss and finalization failures resolve as `RENDER_FAILURE`, with the
original command index only for an in-flight emitting slot. The corrected catches do not
trust a host-thrown `FrameError`: they resolve through the pending phase. A reentrant call
still returns `INVALID_STATE` because that nested transition has already aborted the frame.
Pre-batch, pre-command and post-command context checks prevent known loss from committing a
batch; the end check prevents transfer after known loss.

Failure cleanup detaches adapter references and makes one best-effort pass over backing-size
reset and p5 removal without replacing the primary lifecycle error. Successful end detaches
the exact graphics object from the adapter and transfers it live. The transfer supplement
proves later end and abort misuse leave its dimensions, pixel and removal count unchanged,
then proves explicit release clears/removes it once across two helper calls.

The registered evidence is sufficient for scoped acceptance:

- `p5js-adapter-pixels.json` passes all four native pixel groups, including density at
  device scale two, bounds and clipping, alpha/order/winding, round caps, kind alternation,
  and parent isolation. Its adapter hash predates the exception-classification repair. The
  recorded repair changes failure routing only; it does not change density, paths, styles,
  compositing or successful drawing. Current-source lifecycle and CP1 evidence therefore
  close that historical binding without repeating passing pixel images.
- `p5js-adapter-failures.json` binds the current adapter and passes 18 browser lifecycle
  cases, including misleading host `FrameError` values in every native phase, absolute
  indices after no-ops, silent post-draw loss, reentry, cleanup failure, abort and release.
- `p5js-adapter-transfer.json` binds the current adapter and supplies the missing still-live
  ownership proof before release.
- `p5js-adapter-cp1.json` binds the current adapter and passes the four registered browser
  CP1 images. Each has 25,600 commands; model, converted geometry and colour hashes match
  the Java evidence, all edits change pixels, and root visually accepted the outputs in
  `design/p5js-cp1-decision.md`.

I find no remaining adapter or evidence blocker to marking the p5.js target
`native_adapter_implemented` and `validated-scoped`. Catalog integration should bind all
four final evidence records, the current adapter hash and this review. The result does not
claim WebGL, spontaneous browser context-loss reproduction, visibility of every supported
subpixel stroke, other p5/browser versions, cross-host pixel identity, py5, Android, or
full-corpus reproduction. The observed minimum-width probe covered zero pixels, which is
consistent with the profile's explicit lack of a universal visibility guarantee.
