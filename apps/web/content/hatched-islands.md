# Hatched islands

Two line families are clipped to a filled island with holes. The island silhouette and every hatch fragment come from explicit polygon input and `hatch-region-lines-2d`.

| Control | Canvas effect |
| --- | --- |
| Spacing | Sets the primary field's line spacing. |
| Cross | Sets the secondary field's line spacing. |
| Rotation | Turns the primary field's direction. |
| Twist | Turns the secondary field relative to the primary; zero makes the fields parallel. |
| Region | Replaces the outer ring and hole geometry. |
| Outline | Shows or hides the existing boundary drawing. |

The browser adapter draws the clipped fragments as Canvas2D marks. Palette and outline changes preserve the clipped geometry. The editable source sketch also offers an SVG export action.
