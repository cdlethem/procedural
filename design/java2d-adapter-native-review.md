# JAVA2D native integration review

Root integration result, 2026-09-07. The registered suite was executed as two serial,
independently reserved parts: pixel groups 1–4 and lifecycle group 5. This consumes
one initial suite, not two retries. Both reports bind the same current adapter sources.

- `evidence/conformance/java2d-adapter-pixels.json`: all four groups passed under pinned
  Processing 4.5.6/JDK 17.0.20.1. Six background sizes include 2048×2048. Bounds,
  clipping, widths, quad winding, alpha/order/seam, round caps and parent isolation pass.
- `evidence/conformance/java2d-adapter-failures.json`: all 11 cases passed with actual
  JAVA2D backing resources and deliberate phase faults. Tests establish phase/index
  errors, batch atomicity, disposal, suppression, transfer and release idempotence.
  They do not simulate spontaneous device loss or prove graphics-driver recovery.
- `evidence/reproductions/cp1-java2d-adapter/decision.md`: root accepted all four CP1
  edit outputs. Their historical source binding predates the reviewed cleanup-only
  change; current lifecycle tests establish that delta without repeating good images.

The minimum-width probe covered 49 pixels at its selected alignment. This is an observed
result, not a visibility guarantee. Raster identity is not promised across hosts.

These results are limited to the registered JAVA2D profile and CP1 suite. They do not
complete installation, p5.js, py5, Android, broader techniques or corpus certification.
Sol independently accepted the complete scoped evidence after reviewing current source
bindings and the historical CP1 cleanup delta. Only processing-java may carry validated
native status, bound through `evidence/conformance/java2d-native-review.json`. The other
three targets remain unvalidated. Failure-run image links refer to existing pixel-probe
outputs in the shared directory; they are not additional failure-test renders.
