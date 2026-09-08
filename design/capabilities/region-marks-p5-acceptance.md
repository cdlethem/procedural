# RegionMarks p5.js native acceptance plan (draft)

Scope: the existing Java RegionMarks workflow on p5.js2.3.2, Chromium and a640×640
P2D canvas at density1. Core fixture conformance is a prerequisite. This is a technique
workflow port, not a new original-sketch recreation or pixel-identity claim.

Use the established p5 browser server/Playwright infrastructure and the machine-wide
`tools/with_native_render_lock.py` wrapper. One initial bounded browser session, at most
180 seconds after launch; no implicit rerender campaign. Keep image/build output in.work.
Record source/runtime hashes before/after, actual callbacks, page errors, PNG dimensions
and hashes. Root inspects baseline, changed layout and retained-style images.

Registered sequence, chosen before rendering:

1. Initial seed42,100 splits,fraction0.5:301 cells,301 single marks; capture baseline.
2. M click: identical composition object and geometry,2709 grid marks; capture grid.
3. Keyboard C: identical composition object and geometry, alternate palette; capture colour.
4. G click: new composition, same301 cells, fraction1; capture layout.
5. N click: new composition,601 cells and5409 marks.
6. R click: seed43, new composition,601 cells.
7. X click: authored source,11 cells and99 marks; capture authored.
8. R/N/G clicks in authored mode: no new composition or paint for each.
9. S click: download existing canvas; no composition, paint or geometry change.

Seven composed frames, three ignored observations and one cached save. Validate the
saved PNG against the displayed canvas. Browser antialiasing may differ from Java; compare
pure geometry exactly and inspect the same nested-cell mechanism. Do not relax counts,
geometry retention, source substitution or save behavior to accommodate an implementation.
No physical-keyboard usability, other browser, font, shader or3D support claim is implied.

The model uses the accepted partition and regular grid operations. Authored grid replacement
remains ordinary example code, matching the Java substitution example. Before rendering,
compare the model's ordered bounds, creation IDs and normalized mark placement to Java for
seeded baseline, changed fraction/count/seed and authored cells. Browser drawing uses native
binary64 coordinates; the Java sketch explicitly narrows drawing coordinates to float.
This is an intentional host drawing difference, not a change to portable geometry.
