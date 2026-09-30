# Polygon Watercolor

A shape washed in translucent passes: dense where many passes overlap, pale and feathered where only one
reaches, with ragged edges that echo each other without ever matching. The default is a lobed blob with two
reserved holes and twenty patch-shaped passes gathered around one point, so the pigment builds up unevenly
toward that centre and thins to a pale halo. A new seed is a different blob, different holes and different
patches.

This is a geometric wash, not a fluid simulation. Every pass is the **same parent shape** carried through a
smooth displacement of its boundary. The displacement has broad swells and finer ripples, and each pass mixes a
field shared by all passes with a field of its own, so the passes agree about the broad outline as much or as
little as you choose. Where the passes disagree, the overlap of translucent layers shows as tone steps.

The parent can be a blob (with round holes), a ring with a hole, letterforms (their counters are holes) or the
compartments of a Region Quilt, including L- and T-shaped merged compartments. Your own silhouettes or type are a
future host feature: the library washes any planar shape you resolve yourself (see below), but the instrument's
saved settings name only the bundled shapes.

## Choose the parent and where it sits

| Controls | What changes on the canvas |
|---|---|
| **Shape** | **Blob**, **Ring with a hole**, **Letterforms** or **Quilt compartments**. |
| **Lobes**, **Hole count**, **Hole size** | (Blob) main bulges of the outline, how many round holes are cut into it, and their radius. The seed sets the outline's phases and the holes' places. |
| **Ring hole** | (Ring) the hole's radius as a fraction of the outer radius. |
| **Word** | (Letterforms) which bundled word is washed; counters are holes. |
| **Compartments**, **Merged**, **Layout**, **Gutter** | (Quilt) how many compartments (the 12 by 12 cut grid refuses very fine cuts, so large requests give somewhat fewer), the share joined into L- and T-shaped regions, whether they abut or are inset from each other, and the gap between them. |
| **Center X/Y**, **Size** (width, height), **Rotation** | The box the shape is fitted to. A quilt partition stays axis-aligned, so rotation turns the other shapes only. |

## Shape the boundary

| Controls | What changes on the canvas |
|---|---|
| **Swell** | The wavelength of the broadest ripple, as a fraction of the shape's shorter side. Larger gives long lazy bulges, smaller a busy edge. Scale-free, so the same setting suits a blob and a line of type. |
| **Detail** | How many ripple scales are layered, each half the wavelength of the one before. One is a smooth swell; six adds fine feathering. Every scale doubles the outline samples. |
| **Roughness** | How strongly fine ripples keep up with broad ones: 0 smooth and lapping, 1 torn. |
| **Edge variance** | How far the boundary strays from the parent. 0 leaves every pass exactly the parent; 1 is the largest broad ripple the boundary allows (a tenth of its wavelength, rms). |

## Correlate the passes

| Controls | What changes on the canvas |
|---|---|
| **Independence** | 0: every pass shares one boundary, so the passes coincide and the wash is one crisp flat shape. 1: every pass has an unrelated boundary. In between, two passes' displacements have correlation 1 minus this. |
| **Independent at** | Which ripples differ between passes: **all**, only the **fine** ones (passes share their broad outline and differ in the ragged detail: a crisp shape with a torn rim) or only the **broad** ones (a fuzzy halo of lobes that share the texture). |
| **Regions** | (Letters and quilts) **One shared field**: touching edges move together, so neighbouring compartments stay together and ripple alike. **Separate fields**: each region has its own boundary, so neighbours overlap (darker seams) and pull apart (paper showing). |

## Lay the passes

| Controls | What changes on the canvas |
|---|---|
| **Passes** | Translucent layers per region. More passes deepen the middle; pass *k* never depends on how many there are, so adding passes only appends layers. |
| **Reach** | **Whole shape**: every pass covers the whole parent. **Patches**: each pass covers only a ragged elliptical patch of it. |
| **Patch size**, **Patch focus** | (Patches) the patch radius as a fraction of the region's half diagonal, and how far the patches gather on one common point: 0 scatters them, 1 stacks them into a dense overpainted patch with a pale halo. |
| **Pass creep** | Each later pass is grown (positive) or shrunk (negative) by this many units per pass before its boundary is displaced: nested tone steps rather than a common edge. |

## Reserve holes

| Controls | What changes on the canvas |
|---|---|
| **Holes** | **Reserved**: the parent's holes (a ring's, a blob's, a letter's counters) stay unpainted in every pass; their edges retreat raggedly but never advance. **Washed over**: the wash covers them. |
| **Reserve margin** | Extra clearance kept around reserved holes, in canvas units. |

## Pigment

| Controls | What changes on the canvas |
|---|---|
| **Pigment**, **Second pigment** | One pigment (the first palette colour), two pigments (that share of passes in the second colour, by a stable draw per pass: raising it only recolours), or one pigment per region (a stable draw per region). |
| **Pigment opacity** | Opacity of each pass. Where passes overlap the pigment builds up; where one reaches it stays pale. |
| **Edge pigment**, **Edge weight** | A darker line where pigment pooled along each pass's boundary. Stretches that lie on a reserved hole are not stroked, so a masked edge is not drawn once per pass. |

Colour, opacity, edge and pigment never touch the geometry: changing them redraws the same passes.

## Try these

- **Light partial wash:** *Reach* patches, *Patch size* 0.45, *Passes* 6, *Pigment opacity* 0.05, *Patch focus* 0, *Hole count* 0.
- **Dense overpainted patch:** *Patch size* 0.5, *Patch focus* 1, *Passes* 40, *Pigment opacity* 0.2.
- **One shared edge:** *Independence* 0: the passes coincide and the shape reads as a flat cut-out with soft warped edges.
- **Crisp shape, torn rim:** *Independent at* fine ripples only, *Independence* 1, *Roughness* 0.7, *Detail* 5.
- **Torn feathering:** *Reach* whole shape, *Roughness* 1, *Detail* 6, *Edge variance* 1, *Independence* 1.
- **Tone steps:** *Reach* whole shape, *Pass creep* -2 (or +3), *Independence* 0.6.
- **Masked ring:** *Shape* ring, *Reserve margin* 24: a clean paper halo around the hole.
- **Quilt of washes:** *Shape* quilt, *Pigment* one per region, *Regions* one shared field; switch to separate fields for overlapping seams.
- **Letters:** *Shape* letterforms, *Reach* whole shape, *Passes* 22, *Independence* 0.8.

## Use the pieces in code

The instrument is these same functions. The producer returns a `PlanarDomain` for every pass; a painter is an
ordinary callback over those frozen values.

```js
import { planarDomain, textDomain, washPasses, drawPolygonWatercolor, polygonWatercolorComposition, createInstrument }
  from "@procedurals/instruments";

// Any planar shape you resolved yourself: a region, a domain, a traced silhouette, type outlines.
const parent = textDomain("wash", { centerX: 320, centerY: 320, width: 560, height: 200 });
const wash = washPasses(parent, {
  seed: 7, passes: 20,
  boundary: { swell: 0.25, octaves: 4, roughness: 0.45, variance: 1, independence: 0.75, divergence: "all" },
  creep: 0, patches: { size: 0.6, focus: 0.4 }, coupling: "one", holes: "reserved", margin: 0,
});
for (const pass of wash.passes) {
  pass.id;        // "text:wash/2/p13": parent region id, then pass index; stable when only the pass count or the paint changes
  pass.domain;    // a PlanarDomain: simple rings, disjoint regions, holes; possibly empty
  pass.reserved;  // what this pass never paints, or null; pass.domain never intersects it
  pass.fills;     // one closed ring per region (holes joined by zero-width cuts): fill it, never stroke it
  pass.edges;     // boundary polylines without the stretches on a reserved hole
}

// Keep something unpainted: pass any shape as `reserve`, for example type over a wash.
washPasses(blob, { ...options, reserve: textDomain("HI", { centerX: 320, centerY: 320, width: 300, height: 200 }), margin: 4 });

// The named instrument, and a replacement for the painter.
const recipe = polygonWatercolorComposition(createInstrument("polygon-watercolor"));
drawPolygonWatercolor(p, recipe, { pass: (surface, pass, run) => { /* paint pass.domain your own way */ } });
```

`washOutline(parent, options, regionId, pass)` returns the raw displaced outline before the fold policy is applied, for
inspection. The library never fetches or decodes and never clears a canvas; lengths are canvas units and angles degrees.

## What is guaranteed

- **Folds are resolved, never accepted.** A displaced outline can cross itself. Each region's displaced rings are
  resolved by the exact positive fill rule, so a reversed loop (a kink) paints nothing. Every pass is a valid
  `PlanarDomain` for any setting; an empty pass (a patch off the region, a wash shrunk away) is a valid empty domain.
- **Reserves are exact.** With *Holes* reserved, or with a `reserve` shape, the Boolean difference is taken last: no pass
  intersects a reserve, whatever the boundary does. Computed crossing vertices are rounded to the nearest binary64 point,
  so an intersection can hold slivers of about 1e-14 area.
- **Touching regions stay together only while nothing folds.** Under one shared field, quilt compartments sample their
  common edge identically (regions insert their neighbours' vertices, so even T-junctions match) and abut exactly. A fold on
  a shared edge is dropped from one side and kept on the other, which opens a small overlap; gentler settings avoid it.
- **Structure is stable.** Passes keep their ids and geometry when the pass count, colour, opacity, pigment or palette
  change. Boundaries change only with structural settings and the seed.

## Limits

Boundary samples, summed over every pass and region (the outline length divided by a third of the finest ripple, plus each
patch outline), may not exceed 600,000. Over the limit the error names what to change (**Detail**, **Passes**,
**Patch size**, **Swell**) and nothing is truncated. **Passes** go to 64 (the slider stops at 40) and **Detail** to 8; the
finest ripple may not be narrower than half a canvas unit. On the development machine a default first preparation takes
about 100 ms, a colour or opacity edit redraws in a few milliseconds, and the largest settings near the sample limit
prepare in about two seconds. A quilt partition asks for `Compartments - 1` cuts on a 12 by 12 grid; a very small box or
a gutter wider than a compartment is an error naming **Gutter**.
