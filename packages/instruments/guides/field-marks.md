# Shape a sampled field of marks

The source is a set of sample positions, not an automatically full-canvas texture. Set its center,
columns, rows and pitch for an aligned grid. Source width and height retain only grid samples inside
that footprint; in Scatter mode they instead bound independently seeded positions. Retention removes
whole samples before material is drawn. The same seed, footprint and retention preserve these positions
when you change the palette, length, line/bar/dot shape or weight.

## Explore

| Intent | Try |
| --- | --- |
| A small organized patch | Grid, 22 columns × 16 rows, pitch 7, source width 150, height 105; move the center to an edge. |
| Broken short strokes | Grid, 55 × 38, pitch 6, retention .42, maximum length 5, shortest fraction .3. |
| Open broad texture | Scatter, 110 × 80, source width 540, height 430, retention .7, bar marks, maximum length 17. |
| Directional studies | Reduce Angular variation for nearly parallel strokes; raise it and change Field frequency to bend the orientation across the footprint. |

Field frequency samples seeded portable noise for **direction as well as length and color**. Direction
adds a common angle; Angular variation scales how much the sampled field can turn it. Shortest fraction
controls the length range without replacing the samples. Maximum length or Mark weight at zero hides
the marks. Select Line, Dot or Bar directly to change mark treatment.

The surface does not add a frame, automatic fit or a faded mask. Scatter samples are not blue-noise
spaced and can cluster; a grid whose pitch exceeds its footprint can be nearly empty. Source positions
can lie outside the canvas. Use the layer transform and palette to combine patches with paths, shapes
or other fields.
