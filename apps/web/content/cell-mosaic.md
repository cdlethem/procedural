# Cell mosaic

Turn a rectangle into an irregular field of colored tiles. Each supplied site owns its nearest region; jittering the sites changes the seams, while the palette and facets change the surface treatment.

Start with the default arrangement, then increase **Disorder** to loosen its rows. **Tile inset** scales every tile toward its site and opens transparent gaps, letting a Studio layer beneath show through.

| Control | Canvas effect |
|---|---|
| Cells | More sites make more, usually smaller regions. |
| Disorder | Moves sites away from their regular row positions. |
| Tile inset | Opens gaps by shrinking polygons toward their sites. |
| Facets | Adds translucent triangular color accents inside each tile. |
| Site dots | Reveals the points controlling the boundaries. |
| Seed | Chooses another repeatable site arrangement. |
| Palette | Colors tiles and their accents without changing cell geometry. |

The sketch calls [Voronoi cells](../catalog/operations/voronoi-cells-2d.json), then draws the returned polygons. Replace the fills with your own marks. The inset is a proportional scale around a site; it does not create a constant-width border.
