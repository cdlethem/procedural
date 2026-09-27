# Guarded bands

Guarded bands is an ordered selection instrument: each seeded center path becomes a variable-width filled strip, and the selector accepts it only if its **filled boundary**, not merely its centerline, clears strips already retained. There is no page ruling or mandatory backdrop; even one off-center strip can serve as a layered accent.

| Control | Canvas effect |
| --- | --- |
| Candidates / Points per ribbon | Set the ordered proposal count and the resolution of their construction. Earlier candidates win conflicts. |
| Length / Ribbon spacing / Source X and Y / Direction | Set the independent footprint, spacing, location and rotation of the proposal family. Small counts and short lengths make local fragments. Length must be at least .01 so neighboring trajectory points remain distinct. |
| Curvature / Wave cycles / Disorder | Bend the paths; disorder adds reproducible local variation to each path and its placement. Change Seed for another construction. |
| Ribbon width / Width variation / End taper | Shape each strip's filled footprint before selection. |
| Clearance | Increase the required gap between actual filled footprints; more proposals may be rejected. |
| Filled ribbons / Centerlines / Outlines / Line weight | Choose material independently: line weight zero removes all line marks without removing filled strips. Disable fill and all lines for transparency. |
| Rejected paths | Reveal rejected source centerlines as dashed guides; it is off by default. |

Try **one local sliver** with Candidates 1, Length 130, Ribbon width 8, Source X 180 and Source Y 480. For **dense selection**, use 13 candidates, 35 spacing, 16 width and 2 clearance; then increase width and clearance to see a visibly sparser accepted set. For crossing, wide irregular strips, raise Curvature and Disorder together and rotate Direction. The selector is greedy in source order, not a global packing optimum. Palette and line-only controls leave the same candidate construction and selected set.
