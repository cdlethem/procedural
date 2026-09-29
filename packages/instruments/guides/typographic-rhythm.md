# Typographic Rhythm

A phrase is set far larger than the canvas and repeated line after line, then seen through a
sheet of rectangular windows. Where the windows agree, the type runs on unbroken across them.
Where they have been nudged, stretched or turned, the letters shear, double and break at the
window edges. Some windows are swapped for a line screen or a flat block of colour, some are left
as paper, and a small legible caption sits outside the fragments so the phrase can still be read.
The starting study sets *RHYTHM / IN / TYPE* in 130-unit capitals over an uneven partition:
letters are cropped to slices, a few windows show turned red type, screens and blocks break the
black, and *RHYTHM IN TYPE* runs along the bottom, untouched.

The picture is the same continuous poster every time; only what each window shows of it, and
how, changes. Change the phrase and every window stays exactly where it was; change the slicing
and the windows themselves are rebuilt. Windows never depend on the text, the type size or any
appearance choice.

## Slice the sheet

| Controls | What changes on the canvas |
|---|---|
| **Slicing** | **Grid** cuts equal columns and rows. **Partition** cuts uneven blocks by seeded binary subdivision, some large, some narrow. Either way the windows tile the module area exactly, with no gaps and no overlap. |
| **Columns**, **Rows** | Grid columns and rows (2–24). For a partition they set the resolution of the cuts and of the disruption field. |
| **Cuts**, **Cut axis**, **Size bias** | Partition only. More cuts give more, smaller blocks (0 leaves one window). *Longest* splits a block across its long side; *random* may cut either way. Negative bias favors blocks of even area, positive favors a few large and many small ones. |
| **Gutter** | Clear paper between neighbouring windows. Each window is clipped half the gutter inside its slice. A window left smaller than one unit is blank. At gutter 0, adjacent windows touch, and antialiasing can show a faint hairline where two abut. |
| **Center X/Y**, **Width/Height** | The composition rectangle, anchor strip included. |
| **Anchor side**, **Anchor height** | Where the caption sits (top, bottom, or none, which gives the whole rectangle to windows) and how thick the reserved strip is. The caption is the phrase's own caption set once at one size, fitted inside the strip with a margin; it is never cropped, displaced or covered. |

## Set the type

| Controls | What changes on the canvas |
|---|---|
| **Phrase** | One of six bundled phrases. Its lines repeat down the sheet; its caption becomes the anchor. Lowercase and uppercase both work. |
| **Type size** | The cap height, in canvas units. Larger than a window, letters are cropped to slices and the same letter can appear in several windows; smaller, whole words fit in one. |
| **Leading** | Row pitch as a multiple of the type size. Below 1 the rows overlap. |
| **Repeat gap** | Space between one repeat of a line and the next along its row, as a multiple of the type size. |
| **Rows per line** | How many consecutive rows repeat a phrase line before the next one starts. 1 cycles the lines row by row; 3 makes each word a band of three. |
| **Row phase** | Each row slides this many repeat periods further than the row above it. 0 stacks the lines; a third steps them diagonally. |

## Decide what each window holds

| Controls | What changes on the canvas |
|---|---|
| **Blank modules** | Share of windows left as paper. They cluster where the disruption field is high, so blanks form drifts rather than scattered holes. Zero leaves none. |
| **Screens** | Share of the remaining windows filled with parallel lines instead of type. |
| **Flat colour** | Share of what is left filled with a flat block. |
| **Turned type** | Share of type windows turned a quarter turn, clockwise, and drawn in the accent color. |

Each window's kind comes from its own stable draw. Raising one share only converts windows to that
kind; it never shuffles the others. A new seed gives a different arrangement. Colors follow
structure: palette entry 1 for turned type and some flats, 2 for screens, 3 for other flats, 0
for plain type and the anchor (the palette wraps).

## Disrupt the windows

| Controls | What changes on the canvas |
|---|---|
| **Displacement** | How far each window slides its view of the type, as a fraction of its own size. Neighbours slide alike, so the letters shear in coherent steps. Zero keeps the poster continuous. |
| **Stretch** | Peak horizontal stretch or squeeze of the type in a window, in octaves: 1 doubles or halves its width. Stretched windows read as wide bands, squeezed ones as condensed type. |
| **Zoom** | Peak size change of the type in a window, in octaves. Zoomed out, a window shows several rows of the phrase at once. |
| **Correlation** | The length, in cells, over which neighbouring windows share displacement, stretch and blanks. 1 is noisy, large values make regional drifts. |
| **Pinned modules** | Share of windows held exactly on the poster, so runs of undisturbed type remain among the disruptions. |
| **Focus X/Y**, **Focus radius** | Disruption is strongest at the focus and fades to nothing at this radius; outside it the poster is undisturbed. Radius 0 disrupts everywhere. |

## Ink and screens

| Controls | What changes on the canvas |
|---|---|
| **Type style** | **Solid** fills the glyphs. **Outline** strokes their edges. **Lined** fills them with the same line screen the screen windows use. |
| **Line weight** | Stroke width of outline and lined type. |
| **Screen period** | Distance between the sheet's screen lines before a window stretches it. A window that stretches it below 3 units is refused. It is also the line spacing of lined type. |
| **Screen angle**, **Angle variation** | Direction of the screen lines. *Aligned*: every window the same. *Crossed*: each window adds 0° or 90°. *Fanned*: each adds a multiple of 45°. |
| **Screen weight** | Stroke width of screen windows. |

Screens are drawn in the same coordinates as the type: lines carry the sheet's line index, so
neighbouring undisturbed screens continue each other's lines, and a stretched, displaced or
turned window maps its lines exactly as it maps its letters.

## Try these

- **Calm poster**: grid 5 × 5, gutter 0, displacement 0, stretch 0, zoom 0, blank 0, screens 0,
  flat colour 0, turned 0, type size 170. The phrase reads as one continuous poster, cut only by
  the grid.
- **Stretched bands**: phrase *slice*, grid 12 × 2, gutter 4, stretch 1, zoom 0.3, displacement 0.6,
  type size 200, leading 1, screens 0, flat colour 0.1.
- **Sparse fragments**: blank 0.5, pinned 0, screens 0, flat colour 0, turned 0.3, type size 260,
  cuts 14. A few large letters stand in open paper.
- **Dense texture**: grid 16 × 16, type size 40, leading 0.9, gutter 2, repeat gap 0.2.
- **Outline**: type style outline, line weight 1.6, type size 200, cuts 30, phrase *open*.
- **Lined type**: type style lined, angle variation fanned, screen period 9, screens 0.3,
  type size 170, phrase *again*.
- **Focused disruption**: phrase *open*, focus at 160, 130 with radius 300, displacement 0.9,
  stretch 1, zoom 0.7.
- **Lowercase, turned**: phrase *quiet*, turned 0.4, rows per line 2, row phase 0.3, type size 120.

## Use the layout in code

The windows come from one function and the type from another; a consumer draws both. Windows are
frozen and cached by their construction options alone, and the text is not one of them.

```js
import { createInstrument, referenceComposition, typeRhythmLayout, typeField, typeContent, typeAnchor,
  moduleScreen, moduleOutline, drawTypeRhythm, textSource } from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("typographic-rhythm"));
const layout = typeRhythmLayout(recipe.layout);          // modules: id, bounds, clip, kind, tone, turn, displacement, stretch
const field = typeField(recipe.text, recipe.field);      // the repeated type: lines, periods, scale
const { modules } = typeContent(layout, field);          // per text module: instances (row, repeat, line), rings, fill
drawTypeRhythm(p, recipe);                               // or draw the same values yourself
```

Text is a resolved value, never a URL, so a caller can supply its own:

```js
const text = textSource({ id: "poster", lines: ["BIG", "TYPE"], anchor: "BIG TYPE" });
const other = typeField(text, recipe.field);             // same layout object, new type
```

Each line and the anchor are 1–20 printable ASCII characters set in the library's licensed
outline font, one glyph after another by its own advance width. This is unshaped Latin only: no
kerning pairs, ligatures, other scripts, bidirectional text or combining marks. Letters are the font's
flattened outlines, so curves show facets above roughly 300 units of cap height. A host that
lets a user type their own phrase must add that binding itself; the library does not fetch or
store text.

A module's geometry is in its own local frame, with its clip rectangle at `[0, w] × [0, h]`, so the
existing `inside` consumer draws it directly. `typeRhythmLayout(options)` is deterministic per seed,
and module ids come from the slicing source: `lat:<col>:<row>` for grid cells and `region:<i>` for
partition leaves. Appearance never renames or moves a window.

## Order and bounds

Each window maps a point of the poster *q* to the canvas as *p = c + R · S · (q − c − D)*: subtract the
window's displacement *D*, stretch by *S* about its center *c*, turn by a quarter turn *R*, then clip to
the window's rectangle last. Stretching before turning means a turned window's stretch runs
vertically on the canvas.

Bounds are checked, never thinned: at most 600 windows, 2,000 glyph runs and 150,000 vertices per
window, and 1,000,000 vertices across a sheet. A setting that needs more is refused with the limit
named; raise the type size or use fewer windows. Strokes are clipped as centre lines, so a stroke of
weight *w* reaches *w*/2 past a window edge. The layer is transparent; nothing is drawn behind the
windows, and blank windows leave paper for other layers.
