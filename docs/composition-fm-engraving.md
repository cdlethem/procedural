# FM Engraving (brief 33)

Status: **implemented on branch `w2/fm-engraving`, unreleased. Reviewed from rendered output
only (throwaway SVG surface rasterised in Chromium); not yet exercised through the real Studio
interface, layered in the app, or reviewed for responsiveness there.** It is built on the merged
[raster and image-structure foundation](composition-raster-structure.md) and follows the frozen
[reference slice](composition-reference-slice.md) conventions. Guide:
`packages/instruments/guides/fm-engraving.md`.

## Artist-facing brief

Wavy line bands that encode an image's tone without becoming ordinary stippling. Scan lines run
across the picture; the tone under each point sets how fast the line waves and how tall the waves
are (and, optionally, how the lines crowd and thicken). Light tones below a threshold draw nothing,
so highlights and transparent regions are deliberate paper. Aliasing is not dressed up as a "glitch":
the frequency and the phase step are declared and reported (below).

What the toolkit removes: the reading of an image along scan paths, the frequency and amplitude
modulation with an exactly continuous phase (the foundation's `frequencyModulation`), and the exact
cutting of the result into visible runs at the threshold and at the footprint.

## Input contract (F3, image)

The library defines a typed, deeply frozen, RESOLVED input and never fetches or decodes. A saved
instrument persists only a technique id, scalar params and a palette, so it names a BUNDLED
deterministic picture (`portrait`, `geometry`, `landscape`, `noise` at 256 pixels, plus an integer
*sample variant* that re-arranges and re-tints it; the seed is deliberately separate). The direct
API and the typed descriptor accept `{kind: "raster", raster, mask?}` for any `Raster` a caller
resolved (RGB, gray, alpha, float), with an optional region mask (`valueRegionMask` of a connected
value region, so the engraving can be applied to one region). Binding a user's own image to a saved
instrument is future host work (an asset field in the document); the descriptor already accepts it.

## Producers and consumer

| Piece | Where | Contract |
|---|---|---|
| `toneField(options)` | `composition/engraving-tone.ts` | Frozen tone in [0, 1] over the footprint: CIE lightness (`valueField "lightness"`) of a resolved raster, `dark` (1 - L) or `light` (L), transparent pixels composited over the empty level so they are tone 0 either way, the region mask sets excluded pixels to 0, then an exact area average over cells about `smoothing` units wide, read bilinearly at pixel centres with the edge clamped. `fit` `contain`/`cover`/`stretch` places the image rectangle. Cached (8) by content, footprint size, fit, encoding, smoothing. |
| `engravingCarriers(options, tone, tau)` | `composition/engraving-carriers.ts` | Unmodulated scan lines in the footprint's local frame: `straight`, `curved`, `rings`, `spiral`, `flow`. Arc-length polylines with stable ids (`straight:k`, `ring:j`, `spiral:0`, `flow:n`). |
| `engravedLines(options)` | `composition/engraving.ts` | Per carrier: tone read every 1.5 units, `frequencyModulation`, normals from interpolated tangents, exact negative-space and clip cutting, placement. Returns frozen `EngravedLine`s (a `Path` plus the sampled `signal`) and `stats`. Cached (4) by construction. |
| `engravingComposition`, `engravingProducts`, `drawEngraving`, `tonePieces`, `prepareEngraving` | `composition/engraving-draw.ts` | The JSON-compatible descriptor, its producer, drawing through `strokeWith` and `pathMaterial` (ink or stitch), the tone-bin split consumer, cooperative preparation. `drawEngraving(surface, recipe, {line})` substitutes any `PathMaterial`. |
| Definition and controls | `adapters/fm-engraving-instrument.ts` | Parameters, groups, defaults, validation, `engravingFromValues`. |

Reused, not rewritten: `bundledRaster`, `valueField`, `sampleGrid`, `orientationField`/`orientationAt`,
`frequencyModulation` (the FM equation itself), `pathMaterial`, `strokeWith`, `componentSeed`, the
composition run budget. Not reused, with the reason: `clipToSupport` (plates) clips paths to
polygons but returns bare points with no per-vertex signal, so the exact per-segment interval
clip against the (convex) rectangle and ellipse is done here where the signal can be interpolated.
Polygon footprints and holes await the planar-domains foundation.

## Frozen semantics

- **Frames and units.** Local frame: origin at the footprint centre, x right, y down, canvas units.
  Placement rotates by `rotation` degrees (clockwise on screen) and translates. Frequencies are
  waves per 100 canvas units at the control boundary (cycles per unit in published signals);
  amplitudes are in line spacings at the boundary (canvas units in signals); scan angles in degrees
  (0 along +x, positive clockwise on screen); phases in radians.
- **Tone signal.** `v` = tone. `t = clamp((v - threshold) / (1 - threshold), 0, 1)`, `tau = t^curve`
  (0 stays 0). Frequency `f = fMin + (fMax - fMin) tau` with `fMin = baseFrequency/100`, `fMax =
  (baseFrequency + frequencyGain)/100`; amplitude `A = spacing (baseAmplitude + amplitudeGain tau)`.
  The point is the carrier point plus `A sin(phi)` along the right-hand normal (screen right of the
  direction of travel), `phi(s) = phi0 + 2 pi integral f ds` exactly (the foundation's quadratic-per-
  interval integral). Nothing else in the pipeline reads a threshold twice: `threshold` sets the gap
  and the remap, `curve` shapes tone for frequency, amplitude, spacing and width alike.
- **Negative space and clipping.** A segment is visible where its interpolated tone margin
  `v - threshold >= 0` and its points lie inside the clip region; both conditions are convex along a
  segment, so each segment yields one exact interval and a run starts and ends ON the boundary with
  every signal linearly interpolated at the crossing. The phase keeps running through gaps (test:
  the phase at the start of a run after a gap is `2 pi f s` from the carrier's start). Clip region:
  the footprint rectangle or its inscribed ellipse, intersected with the image rectangle when
  `fit = contain` and `clip = image`.
- **Carrier families.** `straight`: lines at `k * spacing` from the centre line at `angle`; enlarging
  the footprint adds lines at the edge and never moves or renames the others. `curved`: the same
  lines sheared by `bend sin(2 pi a / bendLength)`. `rings`: radius `j * spacing` about a centre given
  as a fraction of the footprint; rings under radius 6 are omitted (see the closure rule). `spiral`:
  radius advances `spacing` per turn. `flow`: evenly spaced streamlines (Jobard and Lefer) of the
  orientation field of the tone grid, direction blended by `follow * coherence` in doubled-angle form
  with the scan angle so flat or incoherent places continue at the scan angle and directions never
  flip; seeded from the seed; midpoint integration step 1.5; stop within half the local spacing of
  another line, at the footprint (plus one spacing) or at the line's own earlier course; lines under
  one spacing removed.
- **Tone-driven spacing.** `gap = spacing (1 - spacingGain tau)` at the line being left: the next
  straight/curved line advances along the fixed normal, the next ring along the radius, the spiral's
  radial advance per turn, and flow's separation distance. No crossing is possible except in flow's
  own convergence rule. `spacingGain` 0 never consults the tone.
- **Rings and phase closure.** A ring is a closed carrier whose total phase is rounded to whole
  cycles by adding `c s / L` (`|c| <= pi`); the sampling limit is reduced by `pi * 1.5 / L` to pay for
  it, which is why rings under radius 6 (circumference under 32) are omitted. A ring wholly inside the
  clip is one closed path; a ring cut by the clip is open runs (a run crossing the seam is two runs
  that meet there). Positive offset is inward for the clockwise ring. Ring and spiral carriers are
  inscribed polygons with stations every 1.5 units, so the sagitta is at most `1.5^2 / (8 r)`.
- **Sampling limit (declared, reported).** Every vertex advances the phase by at most `pi/8`
  (`stats.largestPhaseStep`, reported 0.3927 = pi/8 on defaults), `baseFrequency + frequencyGain <= 50`
  waves per 100 units, i.e. a 2-unit wavelength (`stats.maxFrequency`); tone is sampled every 1.5
  units, so tone detail finer than about 3 units is smoothed (`smoothing`), not aliased.
- **Ids and seeds.** Carrier ids above; run id `<carrier>/r:n`, n counting the carrier's visible runs
  before `minLength` is applied, so raising `minLength` never renames; tone-bin pieces
  `<run>/b:n` exist only in the consumer. Path seeds are `componentSeed(seed, id, "line")`. The
  wave's starting phase is `2 pi phaseSpread u(seed, carrier id, "phase")`. The seed matters only
  when `phaseSpread > 0` or the family is `flow` (`usesSeed`); a seed-free construction is one cached
  result. Line weight, colour, material, tone-to-width and stitching never enter a producer, key or id.
- **Consumer.** `ink` and `stitch` are the ordinary `pathMaterial`. With ink and `widthGain > 0`, or
  `colorBy = tone`, runs are split at the boundaries of ten tone bins into pieces that share their
  end vertices; piece weight is `lineWeight (1 + widthGain (2 tau - 1))` (zero draws nothing) and the
  palette entry is `floor(tau * palette length)` (the palette runs light to dark). `colorBy = ink` uses
  palette 0, `line` alternates entries by carrier index. The layer is transparent.
- **Limits (each names the control to change).** Footprint 1 to 4096 units; spacing 1 to 200; at most
  6,000 carriers and 1,000,000 carrier stations; at most **900,000 modulated vertices** in all; flow
  at most 600,000 points; frequency, amplitude sums as above; composition run 1,000,000 callback
  units. Stored values are pre-checked against an estimate (rejected above twice the vertex bound, so
  nothing is rejected that would have fit; the estimate ran 1.15 to 1.8 times the actual count in five
measured settings) and the exact count is enforced while building. Measured near the bound: 735,000
modulated vertices (640 x 640, spacing 3, 12 + 28 waves) took 0.41 s to build, retained about 80 MB and
drew 259,000 p5 vertex calls in 89 ms into a null surface; 900,000 scales that by about 1.2.

## Controls and groups

Sections in order: **Source image** (image, variant, fit, clip), **Placement** (center X/Y, a proportional
*Size* of width and height, rotation, shape; Placement follows the first construction section),
**Tone** (encode, smoothing, tone curve, negative space, shortest line), **Scan lines** (family, angle,
a *Spacing* group of line spacing and spacing gain, bend, bend length, radial center X/Y, image direction,
direction smoothing), **Waves** (proportional *Frequency*: base and gain; proportional *Amplitude*:
base and gain; phase spread), **Line** (line, weight, tone to width, stitch spacing, phase, color by).

Inline `visibleWhen`: clip by `fit = contain`; scan angle by family straight/curved/flow; bend and bend
length by curved; radial center by rings/spiral; image direction and direction smoothing by flow; tone to
width by ink; stitch spacing and phase by stitch. The control audit
(`tests/helpers/audit-controls.ts fm-engraving`: 36 controls, 1,513 probes) reports **zero violations**
and no proposed conditions. Two controls are reported dead on the audit's square footprint, `fit` and
`clip`: they matter only when the footprint's aspect differs from the picture's (a numeric condition
this contract cannot state), and are left visible (`clip` is conditional on `fit`). The property test in
`tests/composition-fm-engraving.test.ts` changes hidden controls in each family and requires an
unchanged drawing fingerprint.

## Checks

`tests/composition-fm-engraving.test.ts` (20 tests, independent expected values): fit rectangles and
bilinear/edge reading; tone equals CIE lightness of the linear-light byte (computed independently in
the test); exact area average; transparent pixels and region masks empty in both encodings; uniform
tone gives `A sin(2 pi f s)` about `10 k` to 1e-9 with runs starting and ending exactly on the clip;
tone mapping equations (threshold remap, curve, frequency, amplitude) per vertex; phase continuity across a
frequency step against the closed forms on either side, step under pi/8, reported frequency; negative
space (vertices only over tone at or above the threshold, chord length, phase continuing through a gap,
empty result valid); `minLength` never renames; ellipse and image-rectangle clipping with runs ending on
the ellipse, placement by rotation and translation; constant, tone-driven, ring and spiral spacing against
analytic values; ring closure to whole cycles and inward offset; flow: vertical streamlines for an x-ramp
at exactly one spacing apart, parallel lines at 30 degrees, tangent steps on a radial gradient, and a
minimum cross-line distance of half a spacing on circles and on a hyperbolic (saddle) field; seed derivation
from `componentSeed` and seed independence; appearance edits return the same objects, structural edits do
not; limits name their controls; drawing (weights, pieces tile runs, palette by tone, stitches, substitution);
registration, groups, hidden controls; cancellation; a region mask engraving one connected value region.

**Mutations confirmed to fail** (12 tried, all killed): threshold not remapped, ring phase closure
removed, negative space ignored, spacing crowding the wrong way, phase set to `f s` instead of the integral,
normal flipped, ellipse clip dropped, flow termination distance loosened (this one first *survived*: the
circles field never converges, so the saddle field was added and now kills it), phase seed purpose changed,
dark encoding not inverted, clip boundary not interpolated, tone-bin pieces not sharing joints.

## Review record

Rendered with a throwaway SVG surface (Chromium) on all four bundled pictures at defaults, three seeds,
two sample variants, twelve structural settings (rings off-centre, fine spiral, flow, curved bend, sparse,
dense pure FM, stitch coloured by tone, ellipse with light encoding, landscape with spacing gain and
rotation, heavy overlap, cover with rotation, colour by line on noise), the guide's own recipes, a
1,400-pixel view of the default, and the default layered with Region Quilts, Motif Ecologies,
Substitution Tilings and Contour Scores (existing, unmodified) in both orders. Defects found by looking
and fixed:

- the first default (negative space 0.12) filled the whole backdrop; the portrait vanished into texture and
  the vignette read as a ring around the head: portrait tone is about 0.3 to 0.4 for backdrop and face and 0.8 for
  hair and shoulders, so the default threshold is 0.46 (whole head still legible at 0.40, hair and shoulders at
  0.5);
- the first modulation (4 + 14 waves per 100 units, amplitude 0.1 + 0.4) read as a fine zigzag scribble:
  now 5 + 11 and 0.12 + 0.34, giving a legible woven mesh;
- at threshold 0.44 two vignette specks remained in the top corners; 0.46 removes them;
- tone-mode colour needs the palette ordered light to dark (the default palette is ink first): stated in the
  control and guide instead of reordering the shared default;
- a ring's positive offset points inward (clockwise travel): documented and tested, not silently flipped.

Timing (Node, null surface, this machine; a real p5 canvas costs more to draw): default first preparation
144 ms (tone, carriers, 120,000 vertices) and 8 ms to draw; an appearance-only edit (weight, colour, stitch,
tone to width) 1 ms to prepare and 3 to 20 ms to draw, with the very same producer objects; structural
edits 49 to 80 ms (threshold, frequency, spacing, rings, spiral); flow 167 to 171 ms. Large settings:
640 x 640 footprint, spacing 3, 8 + 22 waves (526,000 vertices, 226,000 drawing calls) 200 ms prepare and
16 ms draw; a new sample variant at that size 226 ms; a tone-crowded spiral at spacing 3 249 ms; flow at
spacing 3 with tone crowding 402 ms; over the bound (spacing 2 at 900 x 900) rejected at admission.

## Open concerns and decisions to confirm

- Persisted instruments name only bundled pictures; a user's own image needs a host asset field. The
  functions and descriptor already accept a resolved raster and a region mask.
- The bundled pictures are synthetic. The portrait's face has nearly the tone of its backdrop, so the default
  reads by its hair, shoulders and features against open paper: a content decision if a real portrait ships.
- Flow lines can pinch or loop where the image's direction field has singularities (neck of the portrait);
  they stop rather than cross, and this is stated behaviour, not smoothed away.
- The ring omission under radius 6 and the ink-only tone-to-width (stitches keep one weight) are conservative
  choices; both are documented.
- `canPrepareInstrument` on this branch's `index.ts` also contains an unreachable duplicate `return` line from
  the earlier data-scores merge; only the `fm-engraving` clause was added to the reachable line.
- Slider intervals are authored from the reviewed images, not certified; the hard limits are measured
  (900,000 vertices, 50 waves per 100 units, 4 line spacings of amplitude).
- Real-interface acceptance, layered work in the app and interaction cost at large settings are root's to exercise.
