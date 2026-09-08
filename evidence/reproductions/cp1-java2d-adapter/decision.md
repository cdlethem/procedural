# CP1 adapter-route decision

Root inspected the four registered 640×640 images on 2026-09-07 after the initial run.
The run passed; four initial images are consumed, with no corrective run needed.
See `result.json` for source/runtime hashes and objective measurements.

All four cases retain 25,600 marks, with zero omitted zero-length records. The model,
converted geometry and colour hashes match the earlier working CP1 example's records.
The base decoded image hash also matches that example's actual PDE execution.

The base shows separate curved rows of short marks. Doubling length creates visibly
denser overlapping strokes while preserving the field arrangement. The palette edit
changes those same arrangements to purple, pink, cyan and pale yellow. Bars replace
the thin marks with broader rectangular coverage while retaining the directional
composition. All three edits have nonzero measured pixel changes; no unexpected blank
regions or clipped composition were apparent in the inspected outputs.

Accept this as scoped JAVA2D CP1 command-route and edit-transfer evidence. Native profile
boundary/failure probes, other target adapters, installation and upstream corpus
reproduction remain separate unfinished requirements. Images stay outside Git.

Subsequent review changed cleanup only: release now detaches retained image, graphics
and pixel-array references. The source-bound render result intentionally retains its
original adapter hash. The change executes after save/success transfer or during abort,
and does not alter geometry, style or rasterization. Do not rewrite that historical
hash or rerender successful CP1 images merely for freshness; the new native failure/
ownership suite must establish the changed cleanup behavior on current sources.
