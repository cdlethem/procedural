# BranchMarks py5 native acceptance

Preregister one actual py50.10.11a0/Processing JAVA2D 640x640 density1 run.
Use pinned Python3.13.15 and JDK17 with xvfb, under the shared machine lock:
`python3 tools/with_native_render_lock.py --timeout 240 -- timeout 180 ...`.
Reuse tests/native/py5_grain_marks.py callback infrastructure. Preserve every attempt.
Core and model remain frozen during native execution.

The accepted Java BranchMarks PDE defines draw treatment. The reviewed Python model
already compares eight actual Java compositions. Test native line and ellipse calls,
explicit binary32 renderer transport, nominal-length taper and actual child-count tips.
This is a callback/native-raster workflow test, not physical keyboard or source recreation.

Use keys n,n,g,0,w,0,b,0,c,m,x,m,c,n,r,0, then ignored q and cached s.
Check all settings and revision at each state. M/C retain composition identity and all
values; geometry controls and reset rebuild. Rule extension preserves all-tree geometry,
headings, lengths, parents and generations; it may change child counts and tip membership.
Precomputed expectations are unchanged from the accepted Java/p5 workflow:

| State | Segments | Trees | Drawn terminal dots |
| --- | ---: | ---: | ---: |
| initial | 101 | 1 | 53 |
| extended | 192 | 1 | 99 |
| extended-restored | 101 | 1 | 53 |
| narrowing | 101 | 1 | 53 |
| reset-1 | 101 | 1 | 53 |
| wide | 101 | 1 | 53 |
| reset-2 | 101 | 1 | 53 |
| binary | 38 | 1 | 16 |
| reset-3 | 101 | 1 | 53 |
| recolour | 101 | 1 | 53 |
| thin | 101 | 1 | 0 |
| forest | 288 | 7 | 0 |
| forest-taper | 288 | 7 | 145 |
| forest-palette | 288 | 7 | 145 |
| forest-extended | 560 | 7 | 280 |
| forest-seed | 634 | 8 | 313 |
| final-reset | 101 | 1 | 53 |


Capture all17 compositions, verify actual line/dot counts and nonempty 640-square rasters.
Each edit changes pixels; resets match initial pixels. Unknown q and save must preserve
model identity, geometry, pixels and paint count. Saved PNG decodes to the displayed RGBA.
Require exactly17 paints. Bind source, catalog, fixtures, observer and runtime before/after.
Root inspects initial, extended, narrowing, binary, thin, forest, forest-taper and
forest-extended images before acceptance. Rendering differences from other hosts are not
pixel-diff failures; semantic geometry and native draw treatment remain required.
No package, source-recreation or universal host-math claim follows from this test.
