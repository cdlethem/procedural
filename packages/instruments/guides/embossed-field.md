# Embossed field

Turn seeded source features into raised-looking fragments, scattered textures, or a broad relief. A directional signed 3×3 convolution separates their illuminated and shaded slopes; dots or tiles print those responses without covering blank canvas.

| Control | Canvas effect |
| --- | --- |
| Pixel size | Sets source sampling density and printed mark size, not feature positions or radii. Slider 6–48; exact values 4–120. |
| Source field | **Mounds** have rounded slopes; **waves** have oscillating bands inside an explicit soft envelope; **cutout** has crisp oval islands. All use the same seeded feature geometry. |
| Features | Number of separate seeded elements. One makes an accent; many can build a textured field. Slider 1–24; exact values 1–64. |
| Feature radius | Typical source radius as a fraction of the 600-unit drawing area. Small radii make isolated marks; large radii overlap. Slider .03–.36; exact values .01–1.5. |
| Spread | Extent of the region containing feature centers around the chosen center. Zero stacks them; 1 spans the drawing area. Exact values extend to 2, allowing off-canvas sources. |
| Center X / Center Y | Relocates the region of seeded centers, in canvas fractions. Slider 0–1; exact values −1–2, including off-canvas crops. |
| Aspect ratio | Lengthens each feature along one axis while approximately preserving area. Slider .35–3.5; exact values .1–10. |
| Orientation | Rotates the feature axes in degrees, with individual seeded variations. The exact domain extends to ±3600 degrees. |
| Source contrast | Multiplies the source heights before convolution. Zero removes the relief; values above one emphasize overlapping slopes. Slider 0–3; exact values 0–10. |
| Response axis | Vertical, horizontal, or diagonal selects the direction of change made visible by signed convolution. |
| Relief strength | Changes opacity of light and shadow ink, not source geometry or convolution. Zero leaves the layer empty. |
| Mark treatment | **Tiles** print complete source cells; **dots** expose the sampled structure with response-dependent diameters. |
| Seed | Changes the feature centers, relative size, angular variations, and wave phases. It does not affect sampled pixel size or palette. |
| Palette | Slots 1 and 2 color negative and positive responses without rebuilding the source. |

Try a single small cutout at an off-center location for a stamped accent; change to several elongated mounds with narrow spread for overlapping raised ridges, or many compact waves with wide spread for a broken patterned field. Blank source cells yield exactly zero response—even at image edges—and paint no marks, leaving surrounding layers visible. This instrument source construction supplies scalar values to the existing [signed convolution operation](https://github.com/cdlethem/procedural/blob/web-toolkit-v0.2.2/catalog/operations/convolve-2d-signed.json); it does not replace that operation. Older saved compositions retain their original source construction.
