# Gesture skeletons

Separately seeded open gestures are sampled, simplified and left as sparse,
articulated fragments. Short spans, arbitrary directions and negative space
make the gestures usable as small marks in a larger canvas.

| Control | Visible effect |
| --- | --- |
| Joint tolerance | Distance below which a sampled bend is discarded. Zero retains all source points. |
| Gestures, Path spacing | Number of independently seeded gestures and their signed separation across the chosen direction. |
| Path span, Center X/Y, Direction | Fragment length, position and travel direction; nothing is automatically fitted to the canvas. |
| Bend amplitude, Bend cycles | Cross-path reach and rhythm of each gesture; zero amplitude makes straight segments. |
| Forward bend | Folds travel back along its own direction, producing hooked or looping gestures instead of only wavy segments. |
| Noise blend, Seed | Blend of a wave and independent coherent noise fields; seeds alter the gesture anatomy. |
| Source points | Samples in each raw gesture before simplification. |
| Placement variation | Seeded horizontal and vertical scattering independent of the regular spacing. |
| Stroke weight | Width of articulated strokes; independent of joint tolerance. |
| Show nodes, Node size | Optional retained joints and their diameter, off by default. |
| Palette | Recolors the same gestures without resampling them. |

Try two to four gestures with a 90-pixel span and large variation for an
isolated cluster; increase count and signed spacing for a looser procession.
Source points and gesture count share a worst-case simplification work budget.

Each independently seeded source is processed by `geometry.simplify-polyline-2d`.
