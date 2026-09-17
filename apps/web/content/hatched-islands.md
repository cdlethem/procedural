# Hatched islands

Two line families are clipped to a filled island with holes. The island silhouette and every hatch fragment come from explicit polygon input and `hatch-region-lines-2d`.

| Control | Canvas effect |
| --- | --- |
| Rotate hatches | Changes both supplied line directions. |
| Dense hatches | Reduces both perpendicular line spacings. |
| Other island | Replaces the outer ring and hole geometry. |
| Outline | Shows or hides the existing boundary drawing. |

The browser adapter draws the clipped fragments as Canvas2D marks. Palette and outline changes preserve the clipped geometry. The editable source sketch also offers an SVG export action.
