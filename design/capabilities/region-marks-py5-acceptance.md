# RegionMarks py5 native acceptance plan

Scope: existing RegionMarks composition in py50.10.11a0, Java17, JAVA2D640×640 density1.
Run through the machine-wide native lock with a180-second outer command deadline.
Reuse the installed py5 environment and xvfb. No extra runtime/toolchain installation.

Call the actual starter setup/key_pressed callbacks in its native sketch subclass;
this is callback evidence, not physical-keyboard usability. Instrument paint and ellipse
calls without changing their arguments. Record exact retained geometry, native pixel hashes,
PNG dimensions/hashes, source/runtime hashes before/after and all errors.

Preregistered sequence: baseline(seed42,100 splits,fraction0.5):301 cells/301 marks;
M grid:301/2709; C palette:301/2709; G full-list selection:301/2709;
N200 splits:601/5409; R seed43:601/5409; X authored:11/99.
Seven paints total. M/C retain identical geometry objects; G/N/R/X replace geometry.
Then R/N/G in authored mode must cause no paint or replacement. S saves the existing
canvas without paint or replacement; saved RGBA must equal displayed RGBA.

Capture baseline/grid/colour/layout/authored for root inspection. Compare nested-cell
structure, interior marks and authored substitution; no source-sketch reconstruction,
physical-device or pixel-identity-across-hosts claim. The Python model already matches
JavaScript exactly across these five distinct geometry scenarios; Java/JS parity is
separately source-bound. A failed run remains failed; any correction is recorded before
another bounded attempt. No broad render matrix is authorized by this plan.
