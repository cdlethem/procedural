# Lingering links

Make a small cluster of crossing, fading connections or an expansive constellation. Agents move from seeded starting positions; `radius-pairs-2d` finds contacts and `contact-history-2d` remembers separated pairs by identity. The marks are transparent outside the links.

| Control | Canvas effect |
| --- | --- |
| Ticks | Extends motion and contact history; zero steps leaves only optional agent dots. |
| Agents | Sets the number of moving points, and therefore the possible density of contacts. |
| Source shape | Scatters starts in an area, along a ring, or on a narrow line. |
| Source X / Source Y | Relocates the seed population without stretching the layer. |
| Extent / Aspect | Set its horizontal span and vertical-to-horizontal proportion. Zero extent stacks starts. |
| Direction | Rotates the source and points the initial movement in degrees. |
| Heading disorder | Spreads headings around that direction; zero aligns the agents. |
| Speed | Moves pairs farther per step, changing when contact appears or disappears. |
| Contact radius | Determines which moving pairs make a link. |
| Linger | Retains an absent contact for additional steps. |
| Stroke weight | Thickens/thins link strokes and midpoint marks without resampling contacts; zero suppresses both, not agent dots. |
| Link strokes / Midpoint dots / Agent dots | Independently choose connections, contact stamps, and current positions. |

Start with a narrow line and strong disorder for crossings; try a small ring, low radius and more linger for a sparse accent. Palette changes alter paint only, never the seeded starting points. No frame or background is drawn.
