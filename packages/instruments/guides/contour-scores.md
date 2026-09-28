# Contour Scores

Write a landscape as ink, stitches or beads. The starting score is a tilted field of
broken, tangent-oriented strokes: close bands build density, while quiet field regions
leave irregular areas of bare paper. Its paths and their material are separate values.
A bead is another point-mark callback, not a second contour algorithm.

## Shape the score

| Controls | What changes on the canvas |
|---|---|
| **Field** | Noise makes irregular terrain; hills make nested islands; waves make repeating bands; a saddle makes crossing and opening contours. |
| **First threshold**, **Threshold interval**, **Threshold count** | Select which field heights become paths. These controls change the number, extent and topology of visible bands. Zero thresholds yields no paths. |
| **Frequency** | Change the spatial frequency of noise or waves. |
| **Hill count**, **Hill radius** | Change the seeded hill population and how broadly its islands merge. These appear for hills. |
| **Field aspect** | Change the field's directional proportions without stretching the finished marks. |
| **Grid resolution** | Change sampled contour detail and preparation cost. Coarse sampling is a legitimate angular treatment. |
| **Width**, **Height**, **Center X/Y**, **Landscape angle** | Set the source footprint and its position. |
| **Seed** | Change stochastic sources and stable material choices. Waves and saddle geometry are deterministic; their material colors and omissions can still change. |

For nested islands, choose hills, first threshold 0.2, interval 0.2 and six thresholds.
For a quiet supporting gesture, use a saddle, two thresholds and continuous ink. For an
ordered score, choose waves and then change frequency and aspect together. A threshold
outside the field's values legitimately produces no curve.

## Interpret the same paths

| Controls | What changes on the canvas |
|---|---|
| **Path material** | Continuous ink, tangent stitches or stations bearing point motifs. |
| **Stroke weight** | Ink and stitch thickness. Zero gives no stroke. |
| **Station spacing**, **Station phase** | Set the station rhythm and slide it along the actual polyline, including around corners. Spacing is an upper target: the path is divided into whole, uniformly spaced intervals. |
| **Cross-path phase** | Give each path its own stable station offset, so neighbouring contours' stitches or beads stop lining up. Zero keeps them aligned. |
| **Band size ramp** | For beads, shrink the mark from the first contour band toward the last. Zero keeps every bead the same size. |
| **Path retention** | Omit complete ink paths or individual stitch/bead stations without changing the source. |
| **Bead motif**, **Bead diameter** | Replace each station's mark with a dot, ring, rosette or arrow. |
| **Bead petals**, **Bead opening**, **Bead line weight** | Edit the nested rosette, ring or arrow rather than changing the contour beneath it. Applicable controls appear only for that mark. |
| **Palette** | Recolor the retained construction. |

Try the hill configuration above with dot beads of diameter 3.5 and station spacing 9.
Then replace only the dots with small rings. To make a fragment that supports another
layer, reduce threshold count or retention rather than hiding a rigid full-canvas scene
behind low opacity.

## Layer two materials on one source

```js
import {
  createInstrument, referenceComposition, contourPaths, strokeWith, pathMaterial,
} from "@procedurals/instruments";

const recipe = referenceComposition(createInstrument("contour-scores"));
const paths = contourPaths(recipe.source);

strokeWith(p, paths, pathMaterial({
  ...recipe.material, kind: "ink", weight: 0.4, retention: 1,
}, [0x203949]));
strokeWith(p, paths, pathMaterial({
  ...recipe.material, kind: "beads", spacing: 18, retention: 0.7,
  mark: { ...recipe.material.mark, kind: "rings", size: 6, weight: 0.8 },
}, recipe.palette));
```

Paths are immutable complete chains with stable IDs, source levels and closure flags.
A closed chain includes its closing edge without a duplicate seam station. Open-path
phase zero places a station at the beginning of each interval; phase one places it at
the end. At a singular contour junction, paths end at the junction: all extracted edges
remain present, without perturbing the threshold to manufacture a simple loop.

The field source permits up to 78 samples per side, 32 thresholds and 150,000
cell/threshold units. Chain construction has a separate aggregate work limit, and an
individual material path permits at most 12,000 stations within the shared drawing
budget. Exact entry and slider intervals are distinct. The host owns the transparent
layer, background, renderer lifecycle and document; this is not a general vector editor.
