# Stroke Relief

Broad strokes that stand off the page. The starting picture is four long strokes and a few dabs, crossing near the middle:
each stroke has a soft edge ridge and fine furrows along its length, a highlight runs down the flank that faces the light,
and where one stroke was painted over another there is a clean wall along the edge of the one on top. Change the light and
every highlight and shadow moves; nothing else does. A new seed is a different take of the same construction (different
curves, widths and loads, and a different set of dabs).

There are two independent layers. The **flat layer** is the strokes as plain ribbons in their pigments. The **relief layer** is
a transparent patch of light and shadow, empty on the paper and wherever the surface is flat. Drawn together they are the
lit impasto; the flat layer alone is a flat-colour version you can use anywhere; the relief patch alone is light and
shadow you can lay over any other layer.

## How it is built

1. **Strokes.** Each stroke has, along its path, a width and a *load* (pressure: how much paint the brush carries).
2. **Height.** Every stroke is deposited into a height field, in canvas units. Its height at a point is
   `Height × load × cross-section`, so a heavily loaded stroke stands higher, and the middle of a stroke is higher than its edge.
3. **Crossings.** The **Overlap** rule says how strokes combine where they cross. The **Deposition order** says which stroke
   goes on top. The stroke on top always owns the pigment; the rule decides the height.
4. **Light.** The slope of the height field, lit from a direction and elevation you choose, is drawn as nested bands of shadow
   and highlight. Moving the light re-shades the same height; it cannot change the strokes.

Nothing flows or dries: this is a 2.5D material, not a paint simulation and not a claim about how paint behaves.

## Strokes and placement

| Controls | What changes on the canvas |
|---|---|
| **Stroke set** | The bundled strokes that are deposited. *Crossing strokes*: unequal strokes and dabs that cross. *Woven bands*: wavy bands laid across and then down, so every crossing has an over and an under. *Fan of strokes*: strokes leaving one corner together, so paint piles up there. *Looping whorl*: strokes that cross themselves. *Calligraphic swashes*: thick–thin strokes. The *Dry brush* sets replay a bundled hand movement through the bristle producer; each hair is one narrow stroke, so dry gaps and ragged ends become gaps and ridges in the relief. |
| **Stroke width** | Scales the width of every ribbon (not the dry brush). Below about two cells a stroke is too thin to shade cleanly. |
| **Brush width / Hair width** | The dry brush's width at full pressure, and the width of each hair's stroke. Hairs wider than the spacing between them fuse into one grooved mass. They scale together as one edit. |
| **Hairs / Dryness / Depletion** | How many hairs, how readily light pressure lifts them off the paper (gaps), and how soon each runs out of paint along the stroke (a frayed end). |
| **Center X/Y, Scale, Rotation** | Place, size and turn the whole set. Widths scale with the geometry; the height and the light do not. |

Your own captured or drawn strokes are a future host feature: the library takes a validated list of strokes with widths
and loads (see below), but the instrument's saved settings name only the bundled sets.

## Relief

| Controls | What changes on the canvas |
|---|---|
| **Cross-section** | *Round*: a dome. *Flat*: a plateau with rounded shoulders, so light only catches the edges. *Furrowed*: a plateau cut by lengthwise grooves. |
| **Height** | How tall a fully loaded stroke is, in canvas units. Taller strokes have steeper flanks, so the light reads them more strongly. |
| **Edge ridge** | A levee of extra paint along both edges. Zero leaves a clean dome or plateau; large values make a hollow channel between two rims. |
| **Hairs across / Furrow depth** | (Furrowed only.) How many bristles cross a stroke, so one groove fewer, and how deeply they cut. Grooves fade in and out along the stroke as it runs dry. Too many for the cell size fuse into one. |
| **Light-touch height / Load curve** | How a light load becomes height: at zero load the stroke is this fraction of full height; a curve above 1 lets only heavy loads build up. |
| **Cell size** | Resolution of the height field, in canvas units. Smaller cells resolve thinner strokes and grooves and cost more (2 units is about 100,000 cells). The shading is drawn as smooth polygons whatever the cell size, so nothing looks pixelated. |

## Deposition

| Controls | What changes on the canvas |
|---|---|
| **Overlap** | *Add*: paint stacks, so a crossing is higher than either stroke and the lower stroke's edges show through as ridges. *Maximum*: the surface is the envelope, so a crossing is exactly as tall as the taller stroke. *Displace*: the later stroke replaces what is under it and leaves a wall along its edge. |
| **Deposition order** | *Drawn*: the list order (the last stroke is on top). *Reversed*. *Shuffled*: a stable shuffle, so removing a stroke never reorders the others. *Heaviest last*: the stroke that carries the most paint finishes on top. The top stroke owns the pigment at every crossing. |

## Light and drawing

| Controls | What changes on the canvas |
|---|---|
| **Light direction / Light height** | Where the light comes from (degrees clockwise from the top of the canvas) and its angle above the surface. Low light rakes across the ridges; overhead light darkens every slope alike. |
| **Shading depth** | How strongly slopes darken or lighten. Flat tops and the paper stay clear at any value. |
| **Gloss / Highlight tightness** | The sharp highlight on slopes that face the light, and how thin it is. |
| **Show** | *Both*, the *flat* ribbons alone, or the *relief* patch alone. |
| **Color by** | Each stroke's own color, its place in the deposition order (the stack reads as a color sequence) or a single color. |

The first palette color is the shadow; the other palette colors are the pigments, and the highlight is white with a little
of the first pigment. Palette and color edits repaint immediately; a light edit re-shades in a fraction of a second; only
structural controls rebuild the height.

## Try these

- **Overpainting:** *Woven bands*, *Overlap* displace, *Deposition order* shuffled: every crossing has its own over and under.
- **Glazed paint:** *Overlap* add: the lower strokes' edges ride up through the upper ones.
- **Bristle streaks:** *Calligraphic swashes*, *Cross-section* furrowed, *Hairs across* 5, *Light height* 12: raking light along the grooves.
- **Dry brush:** *Dry brush · broad sweep*, *Overlap* maximum, *Cross-section* flat, *Hairs* 22, *Hair width* 8.
- **Light on paper:** *Show* relief, over another layer.
- **A flat layer and a separately lit copy:** two layers of this instrument, one *Show* flat and one *Show* relief with the light from the other side.

## Use the pieces in code

The strokes, the height, the normals and the shaded patch are ordinary frozen values; the named instrument is these same
functions.

```js
import { strokeSet, depositHeight, reliefNormals, shadeRelief, pigmentField, depositionOrder,
  strokeWith, flatRibbon, shadedPatch, createCompositionRun } from "@procedurals/instruments";

// Strokes you resolved yourself: points in canvas units, a full width and a load in [0, 1] per point (or one number).
const strokes = strokeSet({ id: "mine", seed: 1, strokes: [
  { id: "a", points: [[60, 200], [200, 180], [420, 240]], widths: [20, 46, 30], loads: [0.4, 1, 0.6] },
  { id: "b", points: [[240, 60], [260, 300], [230, 520]], widths: 34, loads: 0.7 },
] });

const relief = depositHeight(strokes, {
  bounds: [0, 0, 640, 640], cell: 2, height: 10, section: "round", edgeRidge: 0.3, furrows: 6, furrowDepth: 0,
  loadMap: { floor: 0.25, curve: 1 }, overlap: "displace", order: "drawn",
});   // relief.height, relief.owner (stroke on top of each cell), relief.coverage
const normals = reliefNormals(relief);
const patch = shadeRelief(normals, { azimuth: -50, elevation: 32 }, { contrast: 1.9, gloss: 0.6, shininess: 36 });
// Moving the light gives another patch from the very same height and normals objects:
const other = shadeRelief(normals, { azimuth: 140, elevation: 25 }, { contrast: 1.9, gloss: 0.6, shininess: 36 });

const palette = [0x2b2019, 0xc4452b, 0x2f6f8f];   // shadow, then pigments
const order = depositionOrder(strokes, "drawn");
strokeWith(p, order.map((i) => ({ ...strokes.strokes[i], tone: i })), flatRibbon(palette));   // the flat layer
shadedPatch(palette)(p, patch, createCompositionRun());                                       // the relief layer
```

`strokeReliefComposition(input)` resolves the named instrument to a typed descriptor and
`drawStrokeRelief(p, recipe, { flat, patch })` replaces either layer with your own callback while the producers stay the same
cached objects. `strokesFromPaths` turns any path list (contours, flow traces, hairs) into strokes and `strokeFromGesture` turns
a replayed hand movement into one. Every length is in canvas units; nothing is fetched, decoded or captured. Very dense
settings throw with the control to change (more than about 262,000 cells, 60 million cell–segment tests or 800,000 shading
vertices) rather than dropping detail.
