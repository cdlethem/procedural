# Reaction stripes

Build a changing field of colored square cells from an editable starting
pattern. The default diagonal bands make broad stripes early in a Gray–Scott
reaction; replacing the source with discs or speckle changes
what enters the same 24 × 24 simulation. Reaction spots draws the same kind of
concentration state as varying-size discs.

| Control | Canvas effect |
| --- | --- |
| Initial field | Chooses repeated discs, diagonal bands, or seeded speckle as the starting pattern. Each choice can use the same initial-fill value. |
| Source X / Source Y | Shifts the starting pattern across the grid. Reseeding shifts its phase and changes speckle patches. |
| Source frequency | Changes how often features repeat across the starting field. |
| Initial fill | Activates that fraction of the 24 × 24 starting grid from the source's highest values. At the default 0.10, about 58 of 576 cells start active, whichever source is selected. Zero starts empty and one starts full. |
| Passes | Runs synchronous chemical updates. Zero reveals the starting mask; more passes spread and mix it. Long runs can fill the drawing or fade below the visible threshold. |
| Feed / Kill | Set replenishment and removal in the Gray–Scott update. Their visual effect depends on the source and time; extremes can smooth away the original bands. |
| Cell size | Sizes the painted squares without changing the chemical grid or update rule. |
| Stroke weight | Changes square outlines; zero removes them. |
| Palette | Changes color while keeping the field construction and update settings. |

The default begins as sparse diagonal bands; increasing Passes spreads them
and can eventually fill the square. The square cells are a mark choice over
the concentration grid, not a road or woven-stripe generator. The coefficients and ranges are authored for this
study, not inferred from the reference corpus. Empty canvas areas remain
transparent. Exact number fields accept valid values beyond the sliders, with
a combined update budget for long replays; a high pass value can be a useful
limit test even when the image becomes nearly uniform.
