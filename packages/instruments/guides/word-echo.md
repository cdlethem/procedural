# Word echo

Marks walk either editable licensed glyph contours or an independent spiral/wave. Each echo queries an authored scalar series at an explicit time; marks are displaced and sized by those sampled controls without changing the source path. No live microphone, browser clock, fallback system font, header, rules, waveform or page fill is required.

| Controls | Effect |
| --- | --- |
| Contour text | Enter 1–20 printable ASCII characters: **A–Z, a–z, digits, space and ordinary punctuation** (U+0020–U+007E). Other Unicode characters are explicitly rejected; no replacement or system-font fallback. Glyph outlines and advance widths come from the already licensed GlyphMarks font. |
| Source path, path shape, radius, turns, aspect | Use real font contours or build a separate spiral/wave. Text changes do not change a path-mode source. Radius/turns/aspect edit the independent path. |
| Center X/Y, contour size, direction | Move, scale and rotate the source locally; contours are not automatically page-fitted. |
| Input series, time, echo count/interval, echo shifts | Synthesized PCM-derived RMS/accent and the contrasting authored non-audio tide/gust series both pass through the native `controlsAt` mapping (`sampleRecordedControls`). Each echo queries time − its age × interval, clamped to the start of the recorded series; shifts place the echo copies. |
| Mark spacing, dot/stroke/ring marks, signal gain, base mark size, radius scale | Physical arc-length spacing is measured on each contour or path, not on arbitrary font vertex indices. Signal gain controls normal displacement, radius scale is supplied to the native mapping, and base size changes material only. |
| Source guide, waveform | Both off by default. Enable the guide to inspect unshifted contours/path, or the waveform to compare levels. |

For open, broken typography: text **SIGNAL 2026!**, contour path, four echoes spaced **0.125 s**, mark spacing **12**, offset X **8**, offset Y **-7**, rings, show guide off; scrub time from **0** toward **4.875** to inspect different recorded queries. For a glyph-free wave: switch source path to **path**, shape **wave**, radius **210**, turns **3**, aspect **0.8**, nine echoes spaced **0.375 s**, offset Y **4**, short strokes, and compare **synth** versus **non-audio** at the same time. The same path stays fixed across signal changes.

The packaged `src/assets/word-echo-glyphs.json` contains 95 printable ASCII glyphs with measured font advance widths sampled deterministically from the existing licensed GlyphMarks true-type font. Its embedded source-font, license, pinned p5 2.3.2 Typr parser and sampling metadata preserve exact provenance; `assets/FONT-LICENSE.txt` carries the original typeface terms. `src/assets/word-echo-contours.json` retains the authored two-word contours. The original font binary is not needed at runtime. There is no runtime font loading. The authored synthesized PCM is analyzed into forty RMS/accent samples at 0.125-second intervals; the alternate non-audio series has the same channel schema. Neither is a recorded microphone performance.
