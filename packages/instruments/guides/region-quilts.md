# Region Quilts

Divide a rectangular footprint, then decide what each leaf contains. The starting quilt
mixes diagonal hatches, small motif populations and local contour scores, with open
leaves and clear gutters. No frame or paper-colored backing is compulsory. The same
partition can become a restrained field of hatching, an irregular motif sampler or a
collection of miniature landscapes.

## Construct the regions

| Controls | What changes on the canvas |
|---|---|
| **Width**, **Height**, **Center X/Y** | Position the partition and change its proportions. |
| **Cut grid** | Set the discrete cut coordinates available on each side of the footprint. |
| **Cut attempts** | Refine the seeded binary partition. Zero leaves one large rectangle. |
| **Cut axis** | Prefer the longest side or choose directions randomly. |
| **Subdivision bias** | Favor more balanced areas or stronger contrasts between large and small leaves. |
| **Seed** | Discover another partition and independently derived child constructions. |
| **Inset**, **Leaf retention** | Open gutters or omit leaves without changing the cuts. Retention changes no sibling's seed. |

A low-attempt partition produces a few dominant panels; more attempts make finer
fragments. Increase inset and lower retention for negative space. The partition is data,
not a painted opaque mosaic: empty leaves reveal the host paper and other layers.

## Substitute and edit the filler

| Controls | What changes on the canvas |
|---|---|
| **Leaf filler** | Hatching, motif populations, contour scores or an explicit mixture. The mixture assigns one filler to each stable leaf ID. |
| **Source spacing** | Set hatch intervals or the separation between nested Poisson sites. |
| **Hatch direction** | Rotate hatch scanlines. Lines are centered in each leaf at half-spacing offsets. |
| **Line weight** | Share a stroke thickness across hatches, contours, motif outlines and petals. Filled dots have no outline. |
| **Nested motif**, **Nested mark size**, **Nested petals** | Edit the point marks inside motif-filled leaves. |
| **Nested field**, **Nested field frequency** | Replace the scalar source inside contour-filled leaves without changing the partition or its material. Noise and hills derive their own seed from the leaf. |
| **Nested contour material**, **Nested station spacing** | Draw those local paths as ink, stitches or beads. |
| **Nested bead motif**, **Nested bead size**, **Nested bead petals** | Reach a third level of composition: regions → contour paths → point marks. |
| **Palette** | Recolor all consumers while preserving the retained region and child geometry. |

Start with a few broad leaves and contours in continuous ink. Swap the nested field
between noise and waves, then switch only its material to beads. For a sparse geometric
counterpart, choose hatching and increase spacing. For an ornamental patch, choose motifs
and replace rosettes with rings. Hidden child controls retain their values when you change
the filler; switching back restores those choices.

## Use the nested construction in code

```js
import {
  createInstrument, referenceComposition, partitionRegions, inside, regionFill,
} from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("region-quilts"));
const regions = partitionRegions(recipe.source);
const landscapes = regionFill({
  ...recipe.fill,
  kind: "contours",
  contour: {
    ...recipe.fill.contour,
    source: "hills", hillCount: 4, hillRadius: 0.2,
    levelBase: 0.15, levelStep: 0.2, levels: 5,
  },
  material: {
    ...recipe.fill.material,
    kind: "beads", spacing: 11,
    mark: { ...recipe.fill.material.mark, kind: "rings", size: 5 },
  },
}, recipe.palette);
inside(p, regions, landscapes);
```

`inside` translates each callback to a local rectangle from `(0,0)` to the leaf's width
and height. `regionFill` calls the same `atEach` and `strokeWith` consumers used by the
other two studies, passing their shared run budget. Replace `landscapes` with your own
`(surface, region, run)` callback to use a different filler; there is no hidden graphics
buffer per leaf and no second rendering engine.

Nested point populations have an 80-site cap per leaf. Interiors smaller than one canvas
unit fall below the reused source domain and receive no child geometry. Oversized motif
marks and contour stations are omitted at the inset boundary without moving their source
positions. These are rectangular domains, not general polygon clips: ink/hatch centerlines
remain inside the inset, but a stroke can extend by half its width.

The source permits 1000-unit footprints, 150 grid divisions per side and 400 cut attempts.
The reference recipe rejects aggregates above 230,000 estimated nested-geometry units
before allocating child sources. Increase spacing or reduce cuts when that limit is
reached. Preparation yields between pairs of leaves and publishes a complete retained
scene only after its final cancellation check. Palette and material edits reuse that
construction. This named parameterized composition is not an arbitrary graph editor or
a cross-layer geometry binding.
