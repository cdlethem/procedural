# PullMarks acceptance plan

Root's next Java workflow after CP19 core acceptance; not evidence that it has run.
Use the new RadialPull2D core, not the private study helper. JAVA2D512x512, density1,
retained grid input and three ClosedSpline2D contours from the reviewed private experiment.
Use the same two centers(200,240),(350,320), radius120 and power2 as example configuration.

Precompute both input sample collections and transformed collections. Ordinary loops define
sampling and draw polylines; the only radial deformation algorithm must be RadialPull2D.
Keep field/configuration, input sampling and output geometry visibly separate. Artist guide
must explain center discontinuity, folds/self-intersections and finite sampling artifacts.
No polygon fill/topology or smooth/inverse claim. No source recreation credit.

Six-state native sequence and cached save:

1. Baseline grid, radius120,power2, initial palette.
2. R changes radius to180, rebuilds field and transformed samples; input samples retained.
3. P changes power to0.5, rebuilds field and transformed samples; input samples retained.
4. C changes stroke palette only; field and transformed values retained.
5. M draws the retained transformed contours; no replacement deformation algorithm.
6. 0 resets all controls, reproducing exact baseline pixels and geometry values.
7. S saves the displayed cached image with no extra draw or geometry recomputation.

Reuse established JAVA2D profile/native lifecycle infrastructure and the shared machine
lease. Assertions distinguish source-built core identity, descriptor values, input geometry
retention, output replacement only on field edits, retained recolor/transfer, dimensions,
renderer, full frame sequence, reset equality and cached PNG equality. Root inspects all
representative edited states; a successful probe alone is not visual acceptance.

After scoped core/native reviews, update catalog attestations, artist reference, chooser and
Java0.22 source manifest. Build a fresh archive, compile every extracted example, verify
actual extracted PullMarks edit/save outputs against reviewed candidate pixels, and preserve
prior core classes/examples. Ports remain deferred and cannot inherit Java acceptance.
