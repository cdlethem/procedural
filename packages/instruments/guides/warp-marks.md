# Warp marks

Construct a small transparent RGBA image from **bars, discs, rings or tiles**, then sample it through a local deformation map. This is source substitution, not a stripe-mask preset: zero marks or zero ink alpha leaves nothing on the canvas. The displayed raster is a separate, movable footprint; a caller-owned layer transform can place it again.

| Controls | Canvas effect |
| --- | --- |
| Source mark, arrangement, marks | Choose the silhouette and the number of stamps in a line, grid or scattered area. Zero marks clears this layer. |
| Source seed offset, source X/Y, source width/height, line spacing, placement disorder | Change mark centers without changing the deformation map or palette. Spacing governs line arrangements; extent governs grid/area (area is scattered, not a deterministic evenly filled rectangle). |
| Mark length/width/aspect/direction, ink alpha | Change the actual source shape and opacity. Rings have a transparent center; overlapping translucent marks combine alpha. |
| Raster resolution | Square 64–192 sample grid; it controls edge detail and operation cost, **not** printed size. |
| Deformation X/Y, reach, swirl, pull | Set a smooth circular influence in raster coordinates; signed swirl rotates sampling around the center, signed pull shifts samples radially. |
| Directional wave, frequency, phase, direction, shear | Shift samples transversely in a directional wave or along its axis in a signed shear. Amounts of zero remove their effects. |
| Output X/Y, width/height | Move/resize the transformed image in 640×640 canvas coordinates, separately from the mark population. Zero width/height hides the image. |
| Seed, palette | Seed changes source population. Palette colors the already-chosen mark positions without moving them. |

Try a single off-center ring with a small swirl and zero wave/pull for a barely disturbed stamp. Try line-arranged bars, low disorder, a narrow source height, then raise directional wave and change its angle for a displaced ribbon. A scattered group of tiles with signed pull and swirl can yield interrupted, folded-looking fragments; this is pixel remapping, **not** a physical paper-fold simulation.

`bilinearRasterRemap2D` uses edge-clamped source coordinates. The instrument premultiplies RGBA before interpolation and restores straight color afterward; zero-alpha samples have zero RGB. Setting all four displacement amounts to zero returns the exact source pixels, including translucent edges. Source marks can reach the raster boundary if placed there: edge clamp then repeats the edge sample rather than introducing a transparent outside-world pixel. Keep marks within the raster if clear external margins matter. The raster is rescaled to its chosen canvas footprint, without automatic fitting or an opaque backing sheet.
