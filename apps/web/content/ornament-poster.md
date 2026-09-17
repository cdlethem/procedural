# Ornament field

Build a loose botanical scatter or an ordered decorative repeat. Each mark sits on a retained anchor; change its family, placement, density and orientation independently. The layer stays transparent, so it can sit over other studies or a chosen Studio background.

Start with **Packed** for an irregular field. Change the layer seed to regenerate its circle placements. Choose **Grid** for a regular 12 × 12 arrangement. Increase one family’s weight to make it more common; set its weight to zero to remove it. At least one family needs a positive weight.

| Control | Canvas effect |
| --- | --- |
| Layout | Switches between seeded circle packing and a regular grid of anchors. |
| Petals, leaves, emblems | Relative frequencies of the three mark families. Zero excludes a family. |
| Density | Percentage of available anchors that carry marks; the chosen anchors grow as density rises. |
| Mark scale | Changes mark size without moving anchor centers. Zero hides the marks. |
| Angle | Rotates every mark in place. |
| Angle stride | Adds rotation along the retained anchor order, from aligned to fanned arrangements. |
| Horizontal and vertical offset | Move the entire field independently; large offsets can intentionally crop it. |
| Guides | Draws a fine inset frame to show the placement area. |
| Seed | Changes packed positions while preserving the selected controls. |
| Palette | Recolors the same arrangement. |

The packed placement uses the package’s seeded circle placement operation; the ordered option uses its regular grid operation. Both leave the shapes as editable p5 drawing choices.
