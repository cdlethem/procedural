# Geometric generations

Turn a chosen starting grid into a field of colored square cells. A Life-like
rule decides which cells survive or appear at each generation; the square mark
makes the grid structure explicit. The default checker source can be swapped
for repeated discs, diagonal bands, or speckle. Organic cells draws the same
kind of state with rounded marks.

| Control | Canvas effect |
| --- | --- |
| Initial field | Chooses repeated discs, bands, checker regions, or seeded speckle for the first generation. |
| Source X / Source Y | Shifts the initial pattern through the grid. Reseeding changes its phase and speckle patches. |
| Source frequency | Sets how frequently features repeat in the starting field. |
| Initial fill | Changes the number of initially live cells; higher values fill more of the 20 × 20 grid. |
| Rule | Selects Life, HighLife, Seeds, or Day & Night birth/survival behavior, independently of the starting pattern. |
| Boundary | WRAP connects opposite edges for neighbor counting; DEAD leaves outside neighbors empty. |
| Passes | Advances synchronous generations. Zero shows the starting field; a long run can settle into a sparse pattern or extinguish it. |
| Cell size | Sizes and spaces the painted squares without changing the simulation grid. |
| Stroke weight | Changes square outlines, including zero for no outline. |
| Palette | Recolors the current live cells without changing their positions. |

The rule operates on a binary source grid; squares are the output treatment,
not a different automaton from Organic cells. Empty parts of this layer remain
transparent, so it can be combined with other Studio layers. Exact number
entry allows valid values beyond the sliders, subject to a combined update
budget. If an edit produces an empty canvas, lower Passes or change Initial
fill, Rule, or Boundary to inspect the cause.
