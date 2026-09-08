# Build a faceted city

CityMarks turns subdivision cells into triangular buildings with windowed walls. It composes
four existing operations: QuadrantPartition2D, Delaunay2D, RegularGrid and CyclicPalette.
Open the example and edit the composition directly; no facade framework or new core API
is required. Desktop Processing 4 with P3D/OpenGL is required.

C shifts building colours, H switches the height ceiling between200 and80, R changes the
seed,0 restores the initial scene, and S saves `city-marks.png`. Colour and height retain
the same sites, topology and window decisions. The sketch draws on demand; saving uses
the completed canvas. These are source-inspired example presets, not library-wide ranges.

CityComposition creates301 cells using100 replacements, triangulates their centres and
retains per-face heights, colours and per-wall window choices. CityMarks draws one roof
and three walls per triangle. Each wall maps normalized RegularGrid cell centres along
its edge and down from its roof, then draws shallow rotated boxes. The source's independent
random choices remain independent example policies; partitioning uses its own library stream.

To change the piece, begin with the sites and heights, then edit the palette and facade
spacing. Each face uses16–22 rows and columns. Width/height fractions leave gaps between
windows; warm lit boxes contrast with black unlit boxes. Native lighting shades the coloured
building faces. Keep geometry generation in the helper and drawing decisions in the PDE.

This is a structural recreation of `2019/generativos/ciscis002`, not a pixel-identical copy.
Library RNG, triangulation ordering, numeric precision and colour quantization differ from
the source. The camera uses fixed quarter-turn angles and density1; the source jitters the
camera and requests density2. The PDE corrects an unmatched source beginShape call with
explicit balanced roof/wall drawing. Unused noise and commented shader code are excluded.
The translated drawing pattern carries the upstream MIT notice in the PDE.

Evidence: `survey/out/2019/generativos/ciscis002/notes.md` describes strong changes for
height200→80, splits100→30, zoom2.1→1.2 and a vertical-window-count change. These observations
justify edit choices but not a continuous recommended parameter range. The complete mapping
is in `design/capabilities/ciscis002-recreation-walkthrough.md`.

The measured seed42 example has580 buildings and624,033 window boxes. Its first full-density
frame took about2 seconds to draw on the recorded desktop runtime; this is an observation,
not a performance guarantee. Other platform ports and human usability testing remain pending.
