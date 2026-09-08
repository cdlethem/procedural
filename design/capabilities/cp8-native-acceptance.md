# CP8 native acceptance specification

Root specification before the first render. This is not an executable render plan
and does not authorize a previously consumed attempt. No CP8 images exist yet.

Use the actual officially preprocessed GlyphMarks PDE and its two editable Java
tabs against the delivered CP7 core, Processing 4.5.6 and the pinned Java 17
runtime. Stage the unchanged audited DejaVu Sans TTF as `data/GlyphMarks.ttf`
alongside its complete license notice. Bind all source, JAR, font, license, probe,
executor, and plan hashes before launch and verify unchanged inputs afterward.
The font file is a staged distribution dependency, not a tracked binary asset.

Native target: JAVA2D, 640×640, pixel density 1, static redraw. Initial seed 42.
Run through the sole Processing executor with exclusive attempt output under
`.work`, a process-group timeout, and terminal result preservation. Before launch
confirm no other Processing render is active. Unexpected stderr is a failure;
do not adapt the warning policy after seeing output.

## Sequence and distinguishing checks

Post keys `n0d0g0m0c0v0f0r0s`, waiting for each requested frame to complete.
There are 17 draw states and 17 key events; the final S event does not draw.

| State | Key | Stamp calls | Expected change |
| --- | --- | ---: | --- |
| baseline | initial | 7680 | Digits, full prefix, stride 1 |
| short | n | 3840 | Same paths and attributes; point indices 0…79 |
| reset-short | 0 | 7680 | Exact baseline geometry and pixels |
| sparse | d | 1920 | Same paths and attributes; indices 0,4,…156 |
| reset-sparse | 0 | 7680 | Exact baseline |
| letters | g | 7680 | Same anchors/sizes, selected letter replaces digit |
| reset-letters | 0 | 7680 | Exact baseline |
| dots | m | 7680 | Ellipses replace text at same anchors |
| reset-dots | 0 | 7680 | Exact baseline |
| colour | c | 7680 | Same geometry, explicit palette ramp |
| reset-colour | 0 | 7680 | Exact baseline |
| distance | v | 7680 | New paths; exact initial positions/sizes/symbol indices |
| reset-distance | 0 | 7680 | Exact baseline |
| field-scale | f | 7680 | New paths; exact initial positions/sizes/symbol indices |
| reset-field-scale | 0 | 7680 | Exact baseline |
| new-seed | r | 7680 | New paths and changed metadata |
| reset-seed | 0 | 7680 | Exact baseline |

Total stamp calls: 120960. Instrument actual text(char,x,y) and ellipse calls
from the PDE, not expected-count formulas alone. Capture arguments and compare
their float coordinates with the public retained path at the expected index;
this specifically catches accidentally stamping point j+1. Require upright text,
CENTER/CENTER alignment, selected glyph/size, and the expected fill at the actual
drawing call. Validate Processing state through accessible native state or
instrumented public calls, not a separate mock renderer.

For N/D/G/M/C, check the composition and all path object identities are retained.
For V/F/R/0, require a replacement composition. V/F preserve exact starts and
mark metadata while altering subsequent geometry. A colour/prefix change does
not promise unchanged rasterization of earlier stamps: the normalized ramp uses
the visible prefix length. Prefix and stride retention are assertions about
anchors, never claims that whole pixels remain a subset under compositing.

Read parsed native font identity and verify coverage after actual setup. Bind the
staged TTF bytes to the audit. Record JAVA2D renderer identity and library code
source. Run missing/corrupt/uncovered-glyph checks against the actual loader in
the staged environment separately from success; a preflight failure must happen
before any text drawing, without selecting another font.

Save all 17 completed frames under ignored output. Require opaque 640×640 PNGs,
nonblank initial output, all eight resets pixel-identical to baseline, and the
S-handler image pixel-identical to reset-seed. Observe a short quiet interval
after S to establish that no additional draw was scheduled. Rendering counts and
saved pixels are separate checks.

## Visual review

Root must directly inspect the nine distinct states: baseline, short, sparse,
letters, dots, colour, distance, field-scale, and new-seed. Check recognizable
upright glyph stamping along curved trajectories, a meaningful difference in
overlap with sparse stamps, visible prefix shortening, glyph/dot substitution,
and structural changes from integration edits. Compare all states at the same
scale. Record observed occlusion, clipping and legibility; do not infer those
properties from draw counts. Font and field replacements make this a
technique-level composition test, not an exact reproduction of `numbers`.

If the unrendered settings do not make those editing tasks legible, preserve the
failed or inconclusive attempt and revise the composition with a new registered
plan. Do not lower the acceptance requirements or claim another shipped starter
on the strength of compilation alone.
