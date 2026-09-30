# FM Engraving

Engrave a picture as wavy line bands. The starting picture is a head and shoulders drawn in a
fine navy line: where the picture is dark (hair, shoulders, eyes, the shadow under the nose and
mouth) the lines bunch closer, swell, and their waves grow taller and quicker until they overlap
into a woven mesh; where it is light (the face, the background) nothing is drawn, so those places
stay open paper. Tone is carried by how the lines wave, not by dots, and the picture stays
recognisable because the light areas are left empty on purpose.

The instrument ships four generated pictures instead of photographs: **Portrait blobs**,
**Geometric scene**, **Landscape** and **Photographic noise**. They are chosen with **Source
image**. Your own pictures are a future host feature: the library accepts a validated image value,
but this instrument's saved settings name only the bundled ones.

**The picture is never changed.** Everything below is computed from its tone, so you can change
the scan lines, the waves, the negative space or the ink without losing the picture. Changing
line weight, color, stitch or **Tone to width** does not move a single line; changing the
threshold, spacing, angle, frequency, amplitude or family rebuilds the lines.

## How a line is made

A scan line (a *carrier*) crosses the picture. Every 1.5 canvas units along it the picture's tone
is read. Tone sets two things: how quickly the line waves (its **frequency**) and how tall the
waves are (its **amplitude**). The wave's phase is the exact running total of frequency along the
line, so a line never jumps or kinks where the frequency changes, and the wave carries on unchanged
through a gap, so it resumes in step after a highlight. Where the tone falls below **Negative
space**, the line is simply not drawn.

## Source image and placement

| Controls | What changes on the canvas |
|---|---|
| **Source image** | Which picture is engraved. |
| **Sample variant** | Moves and re-tints the parts of the chosen picture (a slightly different subject); the seed keeps its own job. |
| **Fit** | **Contain** shows the whole picture in the footprint, **cover** fills the footprint and crops the picture, **stretch** distorts it onto the footprint. |
| **Clip to** | Only with **contain**: **image** stops the lines at the picture's edge; **footprint** lets them run on, over the picture's edge tone, to the footprint's edge. |
| **Center X/Y**, **Width/Height**, **Rotation** | Where the footprint is, how big, and how far the whole picture, footprint and lines turn. Width and height can be scaled together. |
| **Shape** | Rectangle, or the ellipse inscribed in the footprint; lines are cut exactly at its edge. |

## Tone and negative space

| Controls | What changes on the canvas |
|---|---|
| **Lines encode** | **Dark** makes shadows the strong lines on paper that stays empty; **light** does the reverse. Transparent pixels are empty either way. |
| **Tone smoothing** | Averages the picture over cells this wide before it is read. Detail finer than the line spacing cannot be carried; this keeps it from turning into noise. |
| **Tone curve** | Below 1, light tones count for more; above 1, only the darkest places get strong modulation. |
| **Negative space** | The tone below which nothing is drawn. Raise it to leave more paper; the wave starts from its base at the edge of each open area. |
| **Shortest line** | Drops small fragments so open areas do not fill with specks. Dropped lines are never renamed. |

## Scan lines

| Controls | What changes on the canvas |
|---|---|
| **Scan lines** | **Straight** parallel lines; **curved** lines all bent by one sine; **rings** concentric circles; **spiral** one continuous spiral; **flow** streamlines that follow the picture's own edges and stripes. |
| **Scan angle** | Direction of straight, curved and flow lines. In flow it is the direction used where the picture has no clear direction. |
| **Line spacing** | The gap between neighbouring lines where the tone is light. |
| **Spacing gain** | How much dark tones crowd the lines: 0.5 halves the gap in the darkest places. |
| **Bend**, **Bend length** | Amplitude and wavelength of the shared bend in curved lines. |
| **Radial center X/Y** | Where rings and the spiral are centered, as a fraction of the footprint. |
| **Image direction**, **Direction smoothing** | Flow only: how strongly lines follow the picture's edges (0 gives plain straight lines) and how smoothly. |

## Waves

| Controls | What changes on the canvas |
|---|---|
| **Base frequency**, **Frequency gain** | Waves per 100 canvas units at the lightest drawn tone, and how many more are added at the darkest. Base plus gain is at most 50 (a 2-unit wavelength); the sliders stop at 22 together so any slider setting draws. Scaling the two together retunes the whole range. |
| **Base amplitude**, **Amplitude gain** | Wave height in line spacings at the lightest tone and how much taller at the darkest. Base plus gain is at most 4. Above about 0.5 neighbouring lines overlap into a mesh. A base of 0 leaves light lines straight; a gain of 0 gives pure frequency modulation. |
| **Phase spread** | How far each line's wave starts from a common phase, drawn from the seed. 0 lines every crest up; 1 scatters them. |

## Line

| Controls | What changes on the canvas |
|---|---|
| **Line** | Continuous **ink**, or **stitches** laid along each wave. |
| **Line weight** | Stroke width. |
| **Tone to width** | Ink only: how much tone thickens the line. 1 runs from a hairline at the lightest tone to twice the weight at the darkest. |
| **Stitch spacing / phase** | Stitch only. |
| **Color by** | **Ink** uses the first palette color. **Tone** runs the palette from the lightest tone to the darkest (order the palette that way). **Line** alternates palette colors from line to line. |

A new seed changes the phase of every line's wave (when **Phase spread** is above 0) and, for
**flow**, where the streamlines start, so the whole set of lines is laid out differently. With no
phase spread and a non-flow family the seed changes nothing, and the instrument says so.

## Try these

- **Etched portrait:** the default, then *Negative space* 0.40 for the whole head, or 0.5 for hair, shoulders and eyes only.
- **Banknote:** *Scan lines* rings, *Radial center Y* -0.08, *Line spacing* 5, *Tone to width* 0.
- **Toned photograph:** *Line spacing* 5, *Base amplitude* 0.25, *Amplitude gain* 0, *Frequency gain* 12, *Tone to width* 0: constant-height waves whose frequency alone carries the tone, reading as a smooth gray. (Typing a finer spacing such as 2.5 and a gain of 30 works too, past the sliders.)
- **Following the form:** *Scan lines* flow, *Image direction* 1: lines wrap the hair and fold with the shoulders.
- **Sparse:** *Line spacing* 14, *Base frequency* 2.5, *Frequency gain* 4, *Line weight* 1.6, *Tone to width* 0.7.
- **Stitched:** *Line* stitch, *Line spacing* 8, *Stitch spacing* 6, *Color by* tone with a palette ordered light to dark.
- **Landscape relief:** *Source image* landscape, *Negative space* 0.3, *Spacing gain* 0.4, *Scan angle* 20.

## Use the pieces in code

Every stage is an ordinary function and returns a frozen value; the instrument is these same functions.

```js
import { createRaster, toneField, engravedLines, drawEngraving, engravingComposition,
  segmentValueBands, valueRegionMask, strokeWith, pathMaterial } from "@procedurals/instruments";

// Any picture you decoded yourself: 8-bit gray here; RGB, RGBA and float rasters work too.
const raster = createRaster({ width: 2, height: 1, channels: 1, format: "u8", colorSpace: "srgb", alpha: "none", data: [0, 255] });

const lines = engravedLines({
  seed: 1, source: { kind: "raster", raster },                        // optionally: mask: valueRegionMask(segmentValueBands(raster, {bands: 4, connectivity: 8}), 2)
  footprint: { centerX: 320, centerY: 320, width: 400, height: 400, rotation: 0, shape: "rectangle" },
  image: { fit: "contain", clip: "image", encode: "dark", smoothing: 4 },
  tone: { curve: 1, threshold: 0.3 },
  scan: { family: "straight", spacing: 6, spacingGain: 0.3, angle: -15, bend: 0, bendLength: 100, radialX: 0, radialY: 0, follow: 0, flowSmoothing: 0 },
  wave: { baseFrequency: 5, frequencyGain: 11, baseAmplitude: 0.12, amplitudeGain: 0.34, phaseSpread: 0.3 },
  minLength: 6,
});
// lines.lines: paths in canvas units (`points`, stable `id`) with their sampled `signal`
// (arc length, tone, frequency, amplitude, phase, offset), and lines.stats.
strokeWith(p, lines.lines, pathMaterial({ kind: "ink", weight: 1, spacing: 4, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 1, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } }, [0x1d2733]));
```

`engravingComposition(input)` resolves the named instrument to a typed descriptor, and
`drawEngraving(p, recipe, { line })` replaces the ink or stitch material with any callback that
receives whole runs. Restricting the engraving to one connected value region is the `mask` above.
Lengths are canvas units, angles degrees, and the library never fetches or decodes an image.
