# Editable browser example acceptance

The corrective actual-page test passed on 2026-09-07. All four control states produce
the accepted CP1 RGBA hashes at 640×640 despite deviceScaleFactor 2. The page keeps one
visible canvas, advances one revision per edit, reports completion and emits no browser
errors. The actual downloaded `field-marks.png` decodes to the displayed bar image.

The first run exposed main-canvas density reset; the diagnosis and one corrective
allowance are recorded in `p5js-ui-density-repair.md`. Both UI allowances are consumed.
No more rendering is required for this change. See `evidence/conformance/p5js-ui.json`
for exact source/runtime bindings and `p5js-ui-initial.json` for the preserved failure.

Accept the native development example's control/display/save path. This is automated
interaction evidence, not a human usability study or a published npm distribution.
