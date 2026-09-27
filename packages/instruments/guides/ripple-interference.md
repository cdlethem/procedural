# Ripple interference

Place one to three signed disturbances in a square wave field, then watch their contours meet and interfere. The starting composition uses two opposing pulses. Each pulse has its own center, spread and amplitude, so the field can also become a single expanding ring, a tight collision, or a broad offset swell.

The wave advances on a fixed 26 × 26 grid. The sketch draws each interior grid row as a colored contour displaced by the current field. The source field and pin mask are computed before the same damped-wave update; changing palette or line weight changes only the drawing.

| Control | Canvas effect |
| --- | --- |
| Impulses | Uses the first one, two or three independently placed pulses. Later pulse controls have no effect until that site is enabled. |
| Impulse X/Y | Moves each pulse center in normalized frame coordinates. Exact values outside 0–1 intentionally move a center beyond the frame. |
| Impulse spread | Widens or concentrates that pulse in grid cells. |
| Impulse amplitude | Sets its initial signed height. Opposite signs can cancel locally; zero deliberately disables one pulse. |
| Pin geometry | Holds no cells, the perimeter, one vertical or horizontal line, or a disc at zero displacement during every update. |
| Pin X/Y and radius | Positions a line or disc pin and sets the disc's size. The irrelevant coordinates are retained for later pin modes. |
| Show pins | Draws small marks at constrained cells without changing the simulation. |
| Passes | Advances the same starting field through more wave updates. Zero shows the initial displacement. |
| Cell spacing | Spreads contour samples apart on the canvas. Large values can intentionally crop the field; this does not change grid resolution. |
| Line weight | Changes contour thickness without changing the wave state. |

Try zero passes with one positive pulse to see the source, then add a negative pulse nearby and increase passes. Switch from no pins to a central line or disc to see how constraints alter propagation. The layer leaves space around its marks transparent for composition with other studies.
