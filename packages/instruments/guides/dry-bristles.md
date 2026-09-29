# Dry Bristles

A few broad strokes of separate hairs laid along contour lines: dense and dark where the brush
pressed, splitting into pale hairs, ragged gaps and single bristles where it lifted or ran out of
ink, with a round swelling start and a tapered end. The rest of the contour family stays as fine
stitched lines in a second colour, so heavy and delicate marks sit side by side. A new seed is a
different landscape (different lines, different hairs and a different paper).

The brush follows **any path**. Three sources ship with the instrument: harmonic traces (phase-shifted
loops of two oscillators), a family of contour lines, or a hand scribble cut into strokes where the
hand turns hardest. The brush, contact and line settings are the same for all of them. Your own paths
(a traced image, another instrument's lines) are a future host feature: the library accepts them as
plain data, but the instrument's saved settings name only the bundled sources.

**Each stroke is a real brush.** A cross-section of hairs is carried along the path's own direction, so
a corner turns the brush rather than flipping it: hairs fan out on the outside of a bend and bunch on
the inside. Where a hair touches is state that belongs to the hair, its tuft and the paper: light
pressure lifts the outer hairs first, each hair runs dry at its own point, and the paper's grain
decides where a light touch skips. All of it is measured along the path, not per vertex, so changing
**Path step** makes the stroke cheaper or smoother without making it inkier or drier.

## Choose the paths and the heavy strokes

| Controls | What changes on the canvas |
|---|---|
| **Paths** | **Harmonic traces**, **Contour family** or **Hand scribble**. |
| **Figure**, **Traces**, **Trace spread** | (Traces) The frequency ratio of the two main oscillators, how many phase-shifted copies, and the phase between neighbours. The seed changes the figure's shape. |
| **Field**, **Field frequency**, **Contour count**, **Contour interval** | (Contours) The landscape behind the lines, its scale, how many lines each level gives and how far apart the levels are. |
| **Hand**, **Stroke length** | (Scribble) Which bundled movement, and the shortest stroke: it ends at the hand's sharpest bend between one and 1.6 times this length. |
| **Center X/Y, Scale, Rotation** | Position, size and turn of the whole path family. Brush width and line weights keep their canvas sizes. |
| **Heavy share** | How many of the paths become broad strokes; the others stay fine lines. Raising it only adds strokes, the ones already brushed stay put, and any share above 0 brushes at least one. |
| **Shortest heavy path** | Paths shorter than this stay fine lines, however large the share. |
| **Width variation** | Makes some strokes narrower than the nominal width (a stable draw per stroke) without changing which paths are brushed. |

## Shape the brush

| Controls | What changes on the canvas |
|---|---|
| **Brush width**, **Hair weight** | Width of the brush at full pressure, and the thickness of each hair. |
| **Hairs** | Hairs across the brush. More is a denser brush and costs proportionally more (see limits). |
| **Center bias** | Negative packs hairs at the edges, leaving a hollow middle; positive crowds them in the centre. |
| **Tufts**, **Clumping**, **Cohesion** | Bundles the hairs into neighbouring groups. Clumping squeezes each group together and opens gaps between them; cohesion makes a group lift, run dry and waver as one, so the stroke splits into fingers. |
| **Hold**, **Edge angle** | *Along the path* keeps the brush's edge at a fixed angle to the direction of travel (an angle staggers the hairs along the stroke). *Fixed on canvas* keeps one angle on the canvas, like a chisel nib: strokes along the edge go thin and strokes across it go broad. |
| **Path step** | Distance between the stations where the brush is sampled. Resolution, not ink. |

## Pressure, ends and dryness

| Controls | What changes on the canvas |
|---|---|
| **Pressure**, **Pressure level**, **Presses** | How pressure runs along each path: even, swelling to the middle, pressed hard then lifting, or repeated presses. Width and contact follow it. |
| **Light-touch size**, **Pressure curve** | Brush width at zero pressure, and whether light pressure counts for more or less. |
| **Tip**, **Tip length** | The brush at each end: blunt, round (swells in and out), pointed (tapers away) or dragged (blunt start, tapering tail). |
| **Dryness** | How much light pressure lifts hairs, outer hairs first. |
| **Depletion** | Hairs run out of ink along each path, each at its own point, so the end frays to a few pale hairs. |
| **Hair waver** | Sideways drift of each hair. |
| **Entry**, **Exit** | Distance over which hairs meet or leave the paper at the ends, each at its own point. Exit only shows where depletion has left ink to lift. |
| **Paper tooth**, **Tooth strength**, **Tooth grain** | The paper's grain decides where light pressure reaches. Every stroke shares one paper, so gaps line up where strokes cross; hard pressure fills the tooth first. |

## Colour and fine line

| Controls | What changes on the canvas |
|---|---|
| **Second pigment** | Share of hairs in the third palette colour (a stable per-hair draw; raising it only recolours). The hairs themselves use the first colour. |
| **Footprint wash** | A tint under each stroke where the brush touched, in the fourth palette colour. |
| **Line**, **Line weight**, **Stitch spacing / phase** | The fine line on the paths that are not brushed: ink or stitches, in the second palette colour. |
| **Trace heavy strokes** | Also draws the fine line along the brushed paths, over the hairs. |

## Try these

- **Dry-brush fragment:** *Heavy share* 0.1, *Dryness* 1, *Depletion* 0.95, *Tooth strength* 1.3, *Tooth grain* 3.
- **Combed brush:** *Tufts* 5, *Clumping* 0.95, *Cohesion* 1, *Tip* pointed with length 130.
- **Chisel calligraphy:** *Paths* harmonic traces, *Hold* fixed on canvas, *Edge angle* 20, *Heavy share* 1.
- **Loaded presses:** *Pressure* presses (2 to 5), *Second pigment* 0.5, *Paths* hand scribble with *Stroke length* 140.
- **Hollow ribbons:** *Center bias* −0.7, a wide brush, a wash of 0.3.
- **Stitched guide:** *Trace heavy strokes* on, so a stitched line rides along each heavy stroke.

## Use the pieces in code

The brush is an ordinary path material, and the instrument is these same functions.

```js
import { pathSet, bristleMaterial, bristleStroke, strokeWith, dryBristlesComposition, drawDryBristles }
  from "@procedurals/instruments";

// Any paths you resolved yourself: ids, points in canvas units, closed or not.
const paths = pathSet([{ id: "s", points: [[80, 400], [200, 250], [360, 300], [540, 180]] }], 1);
const spec = {
  frame: { step: 3, pressure: { profile: "swell", level: 1, pulses: 1 } },   // for paths that carry no pressure of their own
  brush: { hairs: 50, width: 48, map: { floor: 0.2, curve: 1 }, dryness: 0.7, depletion: 0.5, wander: 0.2,
    tip: { shape: "dragged", length: 120 }, paper: { seed: 3, strength: 0.6, grain: 5 } },
  ink: { weight: 1.1, mix: 0.2, inkTone: 0, mixTone: 1, wash: 0.1, washTone: 2 },
};
strokeWith(p, paths, bristleMaterial(spec, [0x222222, 0xb8452f, 0xc99a3b]));

// Or read the stroke as data: hair paths, footprint rings and how much ink was laid down.
const stroke = bristleStroke(paths[0], spec.frame, spec.brush);
stroke.hairs; stroke.footprint; stroke.contact; stroke.inkLoad; stroke.hairLength; stroke.area;
```

`stroke.hairs` are `Path` values, so any path material strokes them; `stroke.footprint` is one closed
ring per touched stretch; `stroke.contact` is the fraction of hairs on the paper at each station. A path
that already carries `arcs`, `angles` and `pressure` (a Gesture Scores path) is brushed with those
as given. `dryBristlesComposition(input)` resolves the named instrument to a plain descriptor, and
`drawDryBristles(p, recipe, { hair, line })` replaces either consumer with your own callback while the
paths and strokes stay the same cached objects. The library never fetches or decodes and never clears
a canvas; lengths are canvas units and angles degrees.

## Limits

Hairs times path stations, summed over all brushed paths, may not exceed 600,000; a single path may
have at most 20,000 stations. Over a limit the error names what to change (**Hairs**, **Path step**,
**Heavy share**, **Shortest heavy path**) and nothing is truncated. Trace and scribble lengths depend on the
seed, so a setting near the limit can pass for one seed and not another.
