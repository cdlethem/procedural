# Glyph marks: repeated letters along retained trails

GlyphMarks has passed scoped Java validation: the actual Processing sketch completed
17 edit/reset states and its save handler, with an explicitly loaded DejaVu Sans font.
Root inspected nine distinct rendered states. Other targets and fonts are unvalidated.

The idea comes from [`2018/Generativos/numbers`](../survey/out/2018/Generativos/numbers/notes.md):
repeat a small mark while it follows a curved field path. In this version, the reusable
part is already provided by `GradientPath2D`; the editable composition decides where to
start, which symbol to use, how to draw it, and how to style it. The boundary is described
in [the CP8 design](../design/capabilities/cp8-glyph-marks.md).

Follow the [Java installation guide](installing-glyph-marks.md), then open
`GlyphMarks.pde` with its two Java tabs in Processing. The PDE is
ordinary Processing code. The nested drawing block in `draw()` is the place to replace a
digit with a letter, dot, or another mark without changing the retained paths.

## Font first

GlyphMarks uses native raster text and requires an explicit TTF file. The selected font
must be readable, licensed for the intended distribution, and cover both configured symbol
sets:

```text
0123456789
ABCDEFGHIJ
```

The example fails when the font is missing, unreadable, or lacks a required glyph. It does
not silently use a fallback font. The package supplies `data/GlyphMarks.ttf` and its
license. To deliberately use a different font, replace that file with a suitable TTF;
the loader checks the requested characters. Different font metrics and glyph shapes
change the image, and only the bundled font has been validated here.

## What stays and what changes

`GlyphComposition` retains 48 `GradientPath2D` paths of 160 integration steps. For each
path, an explicit Java `Random(seed)` chooses an integer-valued start x, start y, size, and
symbol index in that order. This is example metadata, separate from the field's unsigned
32-bit seed and from Processing's global random state.

Style edits keep the retained paths, starts, sizes, and symbol indices:

- choosing digits or letters (`G`)
- choosing glyphs or dots (`M`)
- switching grayscale and colour (`C`)
- shortening the displayed prefix (`N`)
- changing stamp spacing (`D`)

Geometry edits rebuild the retained paths while keeping the same metadata when the seed is
unchanged:

- integration distance (`V`)
- field scale (`F`)
- seed (`R`)

`0` restores the initial seed and controls. `S` saves the already displayed frame; it does
not generate new geometry.

## Three edits with different meanings

A path has already been integrated before the PDE draws it. The drawing loop stamps point
indices `0, stride, 2 * stride, …` that are strictly below the visible prefix.

- **Prefix (`N`)** changes how many early retained points are shown. It does not change the
  path itself. The grayscale or colour ramp is normalized to the selected visible prefix,
  so its style values may change even though the retained positions do not.
- **Stride (`D`)** changes which points in that same retained prefix are stamped. With
  stride four, the marks are an exact subset of the stride-one anchors; it does not make
  integration faster or recompute a path.
- **Integration distance (`V`)** changes the next position before the next field query, so
  later positions and the entire resulting trajectory can change.

The PDE stamps before the corresponding integration advance. For 160 visible steps, it
uses positions 0 through 159 and does not stamp the final retained point at index 160.

## Controls

| Key | Edit | Retained geometry and metadata |
| --- | --- | --- |
| `N` | Toggle a 160 / 80-point visible prefix before stride | Kept |
| `D` | Toggle stamp stride 1 / 4 | Kept |
| `G` | Toggle digits / letters | Kept |
| `M` | Toggle glyphs / dots | Kept |
| `C` | Toggle grayscale / colour | Kept |
| `V` | Toggle integration distance 0.75 / 2 | Rebuilt; metadata kept |
| `F` | Toggle field scale 0.006 / 0.03 | Rebuilt; metadata kept |
| `R` | Increment the explicit seed | Rebuilt with new metadata |
| `0` | Restore initial controls and seed 42 | Rebuilt to the initial state |
| `S` | Save the current displayed frame | Kept |

The source study observed substantial changes after modifying its own Perlin noise scale,
trail count, stamp count, and movement increment. Those measurements belong to that source
sketch. GlyphMarks uses independent gradient noise, a Java `Random`, a different renderer,
font, placement, path count, and sample count, so the constants in this table are
piece settings rather than documented ranges or visual guarantees.

In the reviewed Java render, dense digits form soft curved bands, while sparse stamps
show more of the individual repeated outlines. Sparse glyphs still overlap. Letters
change the edges and ends of those bands; dots reveal narrower versions of the same
trajectories. Some trails extend beyond the canvas: this example does not provide
text-aware collision avoidance or clipping layout. The source and scope are recorded in
the [native review](../evidence/reproductions/cp8-java2d/root-review.json).
