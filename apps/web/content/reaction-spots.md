# Reaction spots

Grow a field of colored discs from a chosen starting pattern. The discs show the
changing concentration of one Gray–Scott chemical on a fixed 24 × 24 grid: larger
values make larger spots. Try a single disc source for a clustered start, bands
for a directional start, or speckle for irregular patches. The same initial
field can be shown as square marks in Reaction stripes.

| Control | Canvas effect |
| --- | --- |
| Initial field | Choose repeated discs, diagonal bands, checker regions, or seeded speckle as the starting chemical pattern. |
| Source X / Source Y | Move that starting pattern across the grid before any update. Reseeding also changes its phase; speckle changes its patches. |
| Source frequency | Sets how many source features repeat across the grid. Higher values make a finer starting pattern. |
| Initial fill | Changes the threshold for active starting cells. Higher values put chemical into more cells; zero starts empty and one starts full. |
| Passes | Advances the chemical field. Zero shows the initial state; later passes can spread, merge, homogenize, or extinguish visible spots. |
| Feed / Kill | Change the two Gray–Scott update coefficients independently. Their effect depends on the initial field and elapsed passes; some combinations become nearly uniform or fall below the drawing threshold. |
| Cell size | Changes the diameter and spacing of the drawn spots without changing the simulation grid. |
| Stroke weight | Changes spot outlines. Zero removes the outlines. |
| Palette | Recolors the spots without changing the chosen field or coefficients. |

The source controls create a binary initial field, which supplies the concentration
state passed to the Gray–Scott step. The coefficients and available ranges are
study design choices; they are not measured values from an artist's work. The
layer leaves empty canvas areas transparent for composition with other Studio
layers. Exact number entry accepts valid values beyond the slider intervals;
a combined cell-update budget bounds long replays. Very long runs can lose the
spatial distinctions present at the start.
