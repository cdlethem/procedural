# Image Directed Field (brief 35)

Status: **implemented on branch `w2/image-directed-field`, unreleased. Reviewed from rendered output only
(SVG surface rasterized in headless Chromium); not exercised through the real Studio interface.** It
builds on the merged [raster and image-structure foundation](composition-raster-structure.md) and the frozen
[reference slice](composition-reference-slice.md) boundary. Guide: `packages/instruments/guides/image-directed-field.md`.

## Artist-facing brief

Paths and marks that follow or resist the structure of an image: hair-like silhouettes and directional
abstractions. A picture (one of the bundled samples, or a raster a host decoded) is analysed once into a direction
field with a confidence; evenly spaced streamlines are traced through it and drawn with `pathMaterial` (ink,
stitches, beads); oriented sites are placed through the same field and drawn with `motif`. **Follow** runs along
edges (the tangent of the level lines), **Resist** across them, **Blend** follows the picture where its structure is
coherent and an ambient field (constant angle, swirl, rays, each turnable) where it is not.

## Pieces (one implementation per concern)

| Piece | File | Notes |
|---|---|---|
| Structure tensor, orientation, sign-continuous vectors | `composition/image-structure.ts` (foundation, unchanged) | Reused; no second orientation or sampling implementation. |
| Streamline tracer, `DirectionFn` consumer interface | `composition/streamlines.ts` | Jobard-Lefer even spacing with RK4; independent of images. |
| Field, lines, sites | `composition/image-field.ts` | `imageStructure`, `imageField`, `fieldLines`, `fieldSites`. |
| Descriptor, drawing, preparation | `composition/image-directed-field.ts` | `imageDirectedFieldComposition`, `imageDirectedFieldProducts`, `drawImageDirectedField`, `prepareImageDirectedField`. |
| Definition, controls, groups, validation | `adapters/image-directed-field-instrument.ts` | 50 controls. |

**Why a new tracer.** The released `rk4VectorGridTrace2D` (used by Stream Ribbons, Curved Trajectories and the curl
instrument) integrates one line on a *vector grid* with bilinear interpolation of signed vectors, fixed step and count.
It cannot take a direction function, so an unsigned orientation cannot keep its sense across a wrap, and it has no
separation control, curvature limit or confidence stop. Extending it would change a released operation
contract; instead `traceStreamlines(options)` takes `DirectionFn(x, y, hint) => unit vector | null` so any field can
use it. The released instruments are unchanged.

## Frozen semantics

- **Coordinates and units.** Canvas units; the picture is an axis-aligned frame (centre, width, height; independent
  scales allowed) turned `rotation` degrees about its centre. Tracing happens in the unrotated frame and the vertices
  are then rotated, so a rotation edit only re-maps cached geometry. Published angles are radians, unsigned, in [0, pi).
- **Field.** `follow`: tangent of the level lines, confidence = the image's coherence. `resist`: across them (the
  perpendicular of the canvas tangent, so anisotropic frames stay exact), same confidence. `blend`: double-angle
  sum `c * e(2 tangent) + w * (1 - c) * e(2 ambient)`; the angle is half the argument of the sum and the confidence is its
  length: coherent image structure wins, flat areas take the ambient direction with confidence `w`, and confidence dips only where a
  strong image direction and the ambient one disagree. The ambient angle is added to `swirl` (around the picture centre,
  + pi/2) and `radial` directions. Averaging orientations, not angles, means 0.05 and pi - 0.05 average to horizontal.
- **Flat areas.** No direction is defined (energy at or below 1e-10, or an exactly isotropic tensor): confidence 0,
  so follow and resist never draw there, at any threshold, and `defined` is false. Only blend with ambient strength > 0 fills them.
- **Coherence scale** is in canvas units, converted to pixels through the frame (mean of the two scales); more than 64 pixels
  throws naming the control (foundation bound). Resolution therefore never changes the physical scale.
- **Gate.** Usable = `confidence > 0`, `confidence >= minConfidence` and inside the optional tone window on the chosen
  channel. Lines start only at usable places inside the picture and end at the first unusable one. Sites exist only at usable places.
- **Sign continuity.** The tracer passes the previous direction as `hint`; every RK4 stage takes the sign nearest the previous
  stage, so no line reverses where an unsigned angle wraps (tested on an analytic circle field and a ring pattern).
  Marks carry the unsigned axis: an arrow shows the axis, not a sense.
- **Lines.** Starts are a jittered grid of `startSpacing` (`componentSeed(seed, "line:i:j", "startx"|"starty"|"order"|"first")`),
  tried in a seeded order, each growing both ways (which half goes first is seeded and they share `maxLength`).
  With `fill`, candidates at `separation` to both sides of every `ceil(separation / (2 step))`-th vertex (in acceptance order)
  are tried until none is valid (valid: inside, usable, at least `0.95 separation` from every line). A line ends at no direction, the
  domain edge (cut exactly there), `maxLength`, a step-to-step turn of more than `step / minRadius`, or coming within
  `separation * stopFraction` of another line or of its own earlier part (arc distance beyond `2 separation`), which closes a loop with a gap.
  Lines shorter than `minLength` are removed with the room they took. Step = `min(2, separation * stopFraction / 2)`.
  `clip` off grows the domain by `maxLength` on each side through the picture's edge-replicated field; starts stay inside.
- **Ids and randomness.** Grid lines `line:<i>:<j>`, fill lines `<parent>/<vertex><L|R>`, marks `mark:<i>:<j>`. Seeds via
  `componentSeed`; a cell's scatter does not depend on other cells. Palette, material, weights, colour rule and mark style never
  change ids, geometry or cache identity (tested by `===` on the cached arrays). Topology edits (separation, starts, seed, picture)
  may rename fill lines. **Chance** lives in the starts (positions and order) and mark scatter; the picture arrangement is a
  separate `imageVariant` control so a new seed re-rolls strokes over the same subject.
- **Attributes.** `FieldLine`: `length`, `meanValue`, `meanConfidence`, `meanDirection`, `parent`. `FieldSite`: `confidence`,
  `value`, `coherence`. Colour (`single`, `tone` dark to light along the palette, `direction` in equal palette turns,
  `random`) and `toneWeight` (weight and bead size by `round((1 - toneWeight * meanValue) * 8) / 8`, at least one eighth) read them at draw
  time.
- **Ownership.** Results are frozen; the analysis (image, channel, pixel smoothing; 6 entries), field, lines and sites are cached (8
  each) by construction only. Equal pictures share a construction by raster hash.

## Work bounds (each throws, naming the control; nothing is truncated)

| Bound | Value | Control named |
|---|---|---|
| Start cells / mark cells | 40,000 | Start spacing / Mark spacing |
| Lines | 30,000 | Line separation, Start spacing |
| Vertices | 500,000 | Line separation, Start spacing, Longest line |
| Integration steps (including removed lines) | 1,500,000 | same |
| Drawing callback units (lines + stations + marks) | 600,000 | Station spacing, Line separation, Longest line |
| Separation cells of the domain | 4,000,000 | separation |
| Coherence scale | 64 pixels once mapped | Coherence scale |
| Orientation work | foundation bound | Coherence scale |

## Controls (50)

Groups: **Image** (image, arrangement, resolution, read structure from), **Placement** (centerX/Y, proportional *Size* width/height,
rotation), **Field** (direction, ambient kind/angle/strength [blend], coherence scale, confidence threshold, *Tone mask*),
**Streamlines** (on/off, *Spacing*: separation, crowding stop, start spacing, start scatter; fill; *Extent*: shortest, longest, tightest turn; clip),
**Line material** (material, weight, tone weight, *Stations*, retention, *Bead mark* with proportional *Scale* diameter/line weight and *Shape*),
**Marks** (mark, *Spacing*, proportional *Scale* diameter/line weight, *Shape*, variation, retention), **Color** (colour rule).
Proportional: Size, bead Scale, mark Scale only (shared unit, zero means none). Not proportional: spacing/extent lengths (different roles).

Conditions (inline `visibleWhen`, all conjunctions of selects/booleans): ambient kind/angle/strength on `mode = blend`; tone window on
`maskTones`; every line control on `lines`; weight on ink/stitch; spacing, phase, cross-line phase on stitch/beads; bead controls on
beads (petals on rosette, opening on rings/rosette, line weight on rings/rosette/arrow); mark controls on `mark != none` (same nested rules).
The control audit (`tests/helpers/audit-controls.ts image-directed-field`: 50 controls, 2,632 probes) reports **zero violations, zero proposed
further conditions**. Left visible because relevance is a disjunction (lines *or* marks): image, arrangement, resolution, read structure from,
center X/Y, width, height, rotation, direction, coherence scale, confidence threshold, limit to tones, colour rule.

## Evidence

`tests/composition-image-directed-field.test.ts` (30 tests), independent analytic expectations: RK4 radius error < 5e-3 on a circle of radius 100
at step 2 with exact 2-unit steps and a single sense of travel through the unsigned wrap; a uniform field's fill lines exactly one separation apart
(20 lines, 5..195) and cut exactly at the domain edge from an off-lattice seed; no two lines closer than the stopping distance over a pairwise
check; curvature refusal (radius 100 at limit 150 ends after one step each way, radius 60 traces around); rollback of removed stubs both ways
(with and without `minLength`); pure function of options and limit messages; follow vertical / resist horizontal on stripes with confidence > 0.97;
a 45-degree ramp on a 2:1 frame is `pi + atan2(-1, 2)` (and 3pi/4 on a square frame, pi/4 resisted); rotation maps `(dx, dy)` to `(-dy, dx)`;
flat pictures draw nothing in follow/resist at threshold 0 and straight 30-degree lines in blend with confidence exactly the ambient strength;
blend orientation averaging near the half-turn wrap on an isotropic crossed pattern and swirl vs rays a quarter turn apart; lines on stripes
98% aligned within 0.06 rad; lines around a ring pattern within a radial band and single-sense; clip, unclipped overrun and rotation re-mapping;
tone mask on lines and sites; zero-scatter site grid exact; seed scatter stable per cell; appearance edits reuse the same frozen arrays;
descriptor equals ordinary functions operation for operation; tone weight per line and neutral at zero; colour rules; hidden controls unchanged by
the repo's effective-paint fingerprint; seed use and cancellable preparation; limit messages; raster hash cache identity.

**Mutations confirmed to fail** (8 tried, 8 killed): resist behaving like follow; hint sign ignored in the line field; blend ambient weight using
coherence instead of 1 - coherence; anisotropic tangent ignoring frame scales; short lines kept; own-neighbourhood exclusion removed; turn limit off;
clipped end not cut at the boundary (the first test seed was lattice-aligned and let this one survive; the seed was moved off the lattice).

**Rendered review** (SVG surface, headless Chromium under the native render lease; not real-interface acceptance): defaults on all four bundled images;
portrait at seeds 1, 2, 3 and arrangements 0, 1, 2; landscape at three seeds; 24 structural settings (resist, blend constant/swirl/rays/spiral, stitch and
bead materials, marks alone, tone-masked hair, coarse and fine coherence scale, sparse unfilled long lines with a turn limit, dense separation 3,
crowding stop 0.3 and 0.9, saturation channel, clip off with rotation, stretched frame, combined beads + arrows); layered with the unmodified Motif Ecologies
and Contour Scores in both orders (ink and stitch). The portrait subject stays recognisable at defaults (hood/hair, brows, lids, lips, neck, collar).

Measured (Node 22, this machine, headless, no drawing surface): first prepare of the portrait default 88 ms (248 lines, 17.7k vertices); appearance-only
edit (palette, weight, colour rule) 2 ms; stitch material 2 ms prepare + 15 ms draw; structural edit at seed 7, 47 ms; separation 3.5, 126 ms (516 lines,
68k vertices); landscape 256 px, coherence 20, separation 3, 164 ms; noise 512 px, separation 3, threshold 0 with 11.4k arrow marks at spacing 6, 491 ms
(1,754 lines, 141k vertices); 640-unit picture, separation 3, longest 1200, 158 ms. Separation 0.5 and 1 on a 640 picture throw after 0.5 to 0.6 s.

## Decisions and limits

- Source image is a validated select of the four bundled samples plus a separate arrangement number; host-supplied images bind through the typed
  `FieldImage` descriptor (`{kind: "raster", raster}`), which is not persisted by the instrument: that binding is future host work.
- No new marks. `motif` has no dash; the arrow (axis-only) is the oriented mark, and `stitch` gives dashes on lines.
- Bristles and beads are other materials/instruments: the direct API's `line` consumer replaces the ink with any `PathMaterial`.
- The seed's effect is real but modest when `fill` is on (evenly spaced streamlines fill the same field; starts and order decide where the gaps and
  breaks fall); with `fill` off it decides which starts are traced and the drawing differs strongly.
- Rotating a picture that fills the canvas can move geometry past the canvas edge (as with every framed instrument here).
- No polygon clipping is used (clip is a rectangle in the picture's own frame); no planar-domain dependency.
- `canPrepareInstrument` in `src/index.ts` still has two `return` statements from an earlier merge (the second is unreachable, and drops Data Scores'
  preparation from `canPrepareInstrument`); only the live one was extended. Root should resolve that when merging.
