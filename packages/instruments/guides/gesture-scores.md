# Gesture Scores

Replay one recorded hand movement three ways at once. The starting picture is a broad dry-brush
stroke, dense where the hand pressed and splitting into a few pale hairs where it lifted or ran out
of ink; a curtain of gold sand falling below it, thickest where the hand slowed; and a row of red
arrows beside the stroke that follow its direction. A new seed is a different take of the same
movement (a slightly different path and tempo, and different bristles and grains).

A recording is a list of timestamped positions, with a pressure value when the device supplied one.
The instrument ships five sample recordings that differ in duration, event rate, regularity and
pressure (see below). Your own captured strokes are a future host feature: the library accepts a
validated recording value, but the instrument's saved settings name only the bundled ones.

**The recording is never changed.** Smoothing, the time window, placement and sampling are all
computed from it, so you can change any of them, or the material of any layer, without losing what
was recorded. Changing a material (bristle weight, grain or glyph mark, palette) does not move
anything; changing the window, smoothing, sampling or seed rebuilds the replay and all three layers
follow it together.

## The recordings

| Recording | What it is |
|---|---|
| **Broad sweep** (90 Hz) | One flowing swash, fast in the middle, pressure swelling and lifting. |
| **Spiral with rests** (60 Hz) | An outward spiral with two exact pauses where the hand presses harder. Sand piles at the pauses. |
| **Cursive loops** (120 Hz) | A chain of loops with the pressure rising and falling once per loop. |
| **Scribble, no pressure** (30 Hz) | Dense back-and-forth scribble with no pressure channel: pressure comes from speed instead (slow is heavy, fast is light). |
| **Wandering hand** (75 Hz) | A smooth random movement that is different for every seed. |

Every recording has irregular timestamps like a real device. The replay does not depend on how often
the device reported: the same curve recorded at 30 Hz and at 240 Hz gives the same derived stroke to
within a fraction of a percent of its size.

## Shape the replay

| Controls | What changes on the canvas |
|---|---|
| **Recording** | Which movement is replayed. |
| **Smoothing** | Softens the hand's tremor and corners; a standard deviation in milliseconds. The two ends stay where they were recorded. |
| **Center X/Y, Scale, Rotation** | Position, size and turn of the whole gesture. Stroke width, sand and glyph sizes keep their canvas sizes when the gesture scales. |
| **Window start / length** | Which part of the recording is replayed, as fractions of its duration. Every layer shows the same part, and what remains stays exactly where it was: bristles, grains and glyphs are not re-rolled. |
| **Sample by** | **Distance** places stroke vertices and glyphs evenly along the path. **Time** places them at equal moments, so they crowd where the hand slowed or rested and thin where it moved fast. |
| **Stroke spacing / interval**, **Glyph spacing / interval** | The distance or time between stroke vertices and between glyphs, whichever mode is selected. |

## Pressure

| Controls | What changes on the canvas |
|---|---|
| **Pressure source** | **Recorded** uses the captured pressure (a recording without one uses speed). **Speed** presses hard where the hand is slow. **Constant** ignores the hand. |
| **Constant pressure** | The pressure used for every moment when the source is constant. |
| **Light-touch size** | Brush width, glyph size and sand release at zero pressure, as a fraction of full pressure. |
| **Pressure curve** | Below 1, light pressure counts for more; above 1, only hard pressure counts. |

## Repetition

**Repeats** draws copies of the whole gesture; each is moved by **Step X/Y** and turned by **Step turn**
from the one before, about the gesture's center. A turn with no step makes a rosette of the gesture;
a step with no turn makes a stack of echoes. Each copy has its own bristle and sand randomness. The
step controls only matter when there is more than one repeat.

## The three layers

| Layer | Controls | What changes on the canvas |
|---|---|---|
| **Bristles** | **Bristles** on/off, **Brush width**, **Hair weight**, **Hairs** | A broad brush of separate hairs, as wide as the pressure allows. More hairs fill the band; fewer leave gaps. |
| | **Dryness** | How much light pressure lifts hairs off the paper, outer hairs first, in streaks. |
| | **Depletion** | Hairs run out of ink along the stroke, each at its own point, so the end frays to a few pale hairs. |
| | **Hair waver** | Sideways drift of each hair. |
| **Line** | **Line**, **Line weight**, **Stitch spacing / phase** | A single thin line (continuous or stitched) through the middle of the stroke, in the second palette color. |
| **Sand** | **Grain**, **Release rate**, **Pressure gating** | Grains are released on a fixed clock, so the sand is thick where the hand slowed or rested. Gating turns the release probability into the pressure, so light strokes go sparse. |
| | **Fall time**, **Fall speed**, **Fall direction**, **Carried motion**, **Scatter** | Each grain lands after its own delay: it falls in the chosen direction and keeps a share of the hand's velocity, then scatters. Fall time 0 puts every grain on the stroke. |
| | **Grain size / line weight / variation / retention** | The look of each grain and its stable omission. |
| **Glyphs** | **Glyph** and its size, line weight, petals, opening, variation, retention | The mark placed along the stroke. |
| | **Glyph offset** | Moves each glyph across the path; positive is to the right of the direction of travel as seen on the canvas. A value beyond half the brush width puts glyphs beside the stroke. |
| | **Direction follow**, **Pressure size** | Turns each glyph along the stroke, and makes its size follow the pressure. |

## Try these

- **Dry-brush fragment:** *Window start* 0.3, *Window length* 0.35, more *Dryness* and *Depletion*, no sand.
- **Rests made visible:** *Spiral with rests*, *Sample by* time, glyph interval 60: the glyphs pile up where the hand stopped.
- **Feathered line:** turn **Bristles** off, *Line* ink at weight 2.5, glyph rings at offset 0: a pen drawing whose rings show the rhythm of the hand.
- **Sand drawing:** small brush width, *Fall time* 1100, *Fall speed* 160, *Release rate* 700, no glyphs.
- **Rosette:** *Repeats* 8, *Step turn* 45, *Step X/Y* 0, a smaller *Scale*.
- **Pressure swap:** the same recording with *Pressure source* speed: a different stroke from the same movement.

## Use the pieces in code

A recording, its replay and each layer's geometry are ordinary values; the named instrument is these
same functions.

```js
import { createRecording, gestureTrack, gesturePath, bristleBand, sandGrains, gestureSites,
  atEach, strokeWith, pathMaterial, motif } from "@procedurals/instruments";

// Any recording you resolved yourself: timestamps in ms (strictly increasing), x/y in canvas units,
// and pressure in [0, 1] or null when the device gave none.
// (bundledRecording("sweep", 42) is the same kind of value.)
const recording = createRecording({ id: "mine", t: [0, 16, 33, 51, 70, 90], x: [10, 40, 90, 160, 230, 270], y: [50, 30, 40, 90, 110, 80], pressure: null });

const track = gestureTrack(recording, { smoothing: 30, frame: { centerX: 320, centerY: 320, scale: 1, rotation: 0 } });
const window = { start: 0, end: recording.duration };
const pressure = { source: "recorded", whenAbsent: "speed", level: 0.5 };   // what a missing channel means is your choice
const path = gesturePath(track, { seed: 1, sampling: { kind: "arc", spacing: 2 }, window, pressure });
const hairs = bristleBand(path, { hairs: 40, width: 60, map: { floor: 0.2, curve: 1 }, dryness: 0.5, depletion: 0.5, wander: 0.2 });

strokeWith(p, hairs, pathMaterial({ kind: "ink", weight: 1.2, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x222222]));
atEach(p, sandGrains(track, { seed: 1, window, pressure, map: { floor: 0, curve: 1 }, rate: 300, lag: 700, fall: 120, fallAngle: 90,
  inherit: 0.3, spread: 4, gate: 0.8 }), (surface, site) => surface.circle(0, 0, 3));
```

`path` is a `Path` with per-point `times`, `arcs`, `angles`, `speeds` and `pressure`, so any path
material strokes it. Sand grains and glyph sites are `Site` values that also carry `time`, `pressure`
and `arc`. `gestureScoreComposition(input)` resolves the named instrument to a typed descriptor and
`drawGestureScore(p, recipe, { bristle, line, sand, glyph })` replaces any layer with your own
callback while the producers stay the same cached objects. The library never captures pointer events,
fetches or clears a canvas; every length is in canvas units and time is in milliseconds.
