# Perceptual bands

Sculpt an Oklab color field with a **profile** of left and right edges rather than parallel bars. Each sampled color occupies one band cell; **Band coverage** leaves transparent gaps that reveal layers below. A narrowing edge makes a tapered ribbon, an abrupt profile change makes a shard, and wide alternating edges make a broad stepped field.

| Control | Canvas effect |
| --- | --- |
| Bands | Number of colors and rank cells across the entire untrimmed field; zero draws nothing. |
| Edge profile | JSON rows `[heightFraction,leftX,rightX]`, measured relative to Center X. Fractions start at 0, end at 1 and increase strictly; edges connect linearly between rows. Each band follows profile knots exactly. |
| Height, center and rotation | Set field extent and placement in 640-unit canvas coordinates, then rotate the entire field about its center. |
| Band coverage | Centered painted fraction of each rank cell; zero paints nothing. |
| From / To | Clip to a portion of the original rank domain without restretching geometry or reassigning sampled colors. Equal values paint nothing. |
| Color source / Custom color stops | Use **all** layer palette colors, or select custom and supply an independent JSON array of 2–32 `#RGB` / `#RRGGBB` stops. |
| Reverse colors | Reverse the sampled color sequence without reversing or moving geometry. |

Start with `[[0,-210,100],[0.3,-170,220],[0.65,-230,150],[1,-80,190]]`; then try `[[0,-15,25],[0.4,-200,200],[0.7,-70,140],[1,40,45]]` for a pinched expanding wedge. Use custom stops such as `["#173042","#d29069","#fbebad"]` to keep the color study independent of the layer palette. Increase **Bands** for a finer stepped gradient, or lower **Band coverage** and place another layer underneath. A profile may narrow to zero width.

Colors are sampled by the real `color.oklab-ramp` operation; the polygon edges, placement, gaps and clipping are drawing choices applied afterward. Band count changes color resolution, not the shape of the profile.
