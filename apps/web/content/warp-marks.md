# Warp marks

Bend a stripe image into flowing color currents. Studio first makes a seeded palette raster, then a noise field tells each output pixel where to sample that image. Use **Source coverage** to cut clear gutters into the source stripes before they bend; lower layers remain visible through those warped openings.

| Control | Canvas effect |
| --- | --- |
| Strength | Moves each output sample farther through the noise field. Zero shows the unwarped source. |
| Scale | Changes the size of the noise-field turns. Larger values vary more slowly across the image. |
| Stripe | Sets the source band width and its seeded local variation before remapping. |
| Source coverage | Sets the filled fraction of each three-stripe source group. One keeps the original continuous image; zero clears the entire layer; intermediate values make gutters that warp with the color. |
| Seed | Changes both the source stripe variation and the displacement field. |
| Palette | Recolors the source bands without supplying a paper color. |

The mask is applied in source space, before `bilinearRasterRemap2D` samples the raster. The masked path carries premultiplied color through the remap and restores ordinary color afterward, keeping translucent edges clear of dark halos. The fully covered path retains its original opaque pixels. Replace the generated raster in `apps/web/lib/adapters/effects.ts` with another image to bend different material. The Studio document owns the background; layer opacity affects the resulting image and its clear openings remain clear.
