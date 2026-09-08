# CP8 — make letters into trails

Status: root-selected Java workflow; not implemented or delivered. No new public
operation is admitted. CP7 remains the latest delivered package.

## Artist task and boundary

Start with repeated digits that accumulate along curved paths. Change how tightly
the marks overlap, shorten the visible trails, replace the digits with letters or
dots, and recolour them while retaining their trajectories. Then change the field
scale or integration distance to alter the trajectories themselves.

The computational burden is already removed by `GradientPath2D`: it samples the
field at each evolving position and retains the result. CP8 demonstrates a new
mark and font environment over those values. `GlyphComposition.java` will be an
editable example tab, not a new core class or a font adapter contract. Ordinary
Processing text drawing remains visible in the PDE. No outline extraction,
kerning, paragraph layout, shaping, or glyph triangulation is claimed.

This is a design decision about the package, distinct from the survey's suggestion
to publish the whole `advectGlyphs` helper. Wrapping field integration, glyph
selection, font loading, colour, and drawing in one public sink would duplicate an
existing operation and hide useful editing boundaries. The simple grayscale ramp
also remains example arithmetic. A reusable stamping convenience can be reconsidered
after the complete example exposes a repeated burden; it is not justified yet.

## Evidence personally checked by root

Primary report: `survey/out/2018/Generativos/numbers/notes.md`, candidates #0
`advectGlyphs` and #1 `fadeRamp`. Root read the report and upstream
`2018/Generativos/numbers/numbers.pde` at revision
`69bdd8513e4482a5e6018e36887d4bc208660eb5`. The source draws each glyph **before**
sampling the angle and advancing. It does not rotate the glyph with the heading.
For S stamps, positions 0 through S−1 are used; the final integrated position is
not stamped. The fill ramp divides the stamp index by S, so it does not reach its
nominal final colour. These details must remain explicit in the example mapping.

The report records large differences for noise scale ×0.1 and ×8, trail count
1000→300, stamps 200→50, and integration distance 0.5→2. Alpha 50→200 was subtle
under heavy overlap. These are individual source observations, not useful ranges
for our different noise algorithm or font. The source's missing Archivo Black
font fell back; its declared `seed` is not applied inside `generate()`. Survey
determinism is therefore harness evidence, not a source-owned replay guarantee.

Neighbour `survey/out/2016/Generativos/textureGridText/notes.md` uses cardinal
straight echoes of upright letters; it supports the mark/placement separation,
but its trail-length and alpha sweeps were subtle. It does not warrant a second
trajectory generator. The broader retrieval is recorded in
`typography-evidence-audit.md`: six direct text candidate rows among 44 rows in
15 typography-tagged sketches. That bounded audit establishes no glyph-outline
algorithm; it is not a claim that every untagged corpus sketch lacks one.

## Example design, before visual tuning

Use a 640×640 JAVA2D canvas at density 1. Retain 48 paths, each integrated for 160
steps. For each path, an explicitly constructed Java `Random(seed)` selects start
X and Y as integer pixels in [40,600), integer size in [16,40), and an integer
symbol index in [0,10), in that order, using bounded `nextInt` calls. This
Java-only example RNG is separate from the core field's explicit
unsigned32 seed. No Processing global random state is consumed. Changing field
scale or distance with the same seed retains starts, sizes and symbol indices.

Initial integration distance is 0.75, field scale 0.006, field offset [0,0],
angle base 0 and angle scale 2π. These are provisional piece settings, not library
defaults, recommended ranges, or measured visual claims. The core's independent
gradient noise replaces the source's Processing Perlin field. Different canvas,
font, sample count, placement and RNG are intentional: acceptance is technique
level, never source-pixel identity or full-corpus certification.

Draw upright stamps at point indices j=0, stride, … strictly below visibleSteps.
Initial visibleSteps=160 and stride=1. Glyphs use CENTER/CENTER alignment and one
retained size per path. Start with digits `0123456789`; the alternate is
`ABCDEFGHIJ`, preserving the same symbol indices. A dot is the second mark
transfer, using the same positions and a diameter of size/5. The monochrome ramp
is gray=230−200*j/visibleSteps, alpha 50 over background 230. A colour mode uses
the existing CyclicPalette with phase j/visibleSteps and the same opacity. No
font metrics feed back into trajectory computation.

| Control | Change | Required retention |
| --- | --- | --- |
| N | Visible prefix 160 / 80 stamps before stride | All paths and mark attributes |
| D | Stamp stride 1 / 4 | All paths; stride-4 anchors are an exact subset |
| G | Digits / letters | Paths, symbol indices, sizes |
| M | Glyph / dot | Paths and sampled anchors |
| C | Gray / colour ramp | Geometry and mark attributes |
| V | Integration distance 0.75 / 2 | Starts, sizes, symbol indices; regenerate paths |
| F | Field scale 0.006 / 0.03 | Starts, sizes, symbol indices; regenerate paths |
| R | Increment explicit seed | Rebuild composition |
| 0 | Restore seed 42 and initial controls | Exact starting geometry and pixels |
| S | Save displayed image | No generation or drawing side effects |

Stride changes which already-integrated points are stamped; integration distance
changes the path because later noise queries occur at different positions. The
guide must teach this distinction rather than treating both controls as speed.
Prefix shortening keeps the geometry but changes the normalized style ramp over
the visible prefix; only positions, not colours, are prefix-identical.

## Font and runtime boundary

The required behavior is native raster text for the explicit ASCII glyph sets,
using a named font file and declared size/alignment. Font selection and coverage
must be checked before drawing; missing, unreadable, or insufficient fonts fail
explicitly. No silent substitute. The font/environment audit must select the
concrete asset and inspect license terms before packaging. Bundled font identity
and hash will be recorded alongside the installed runtime. That selection is a
remaining implementation prerequisite, not a reason to delay the pure helper.

No core or existing catalog contract changes are needed. JAVA2D is the first
workflow target; P2D, other fonts, and other language targets remain unvalidated.
The PDE owns normal text/style setup and synchronous redraw. Save the completed
displayed image without making hidden font or geometry changes.

## Acceptance to register before rendering

First compile the pure helper against the delivered JAR and check fixed-seed
replay, changed field/distance with identical mark metadata and starts, exact
stride subset and prefix anchors, and use of the pre-advance position. Exercise
the maximum 48×160 stamp workload without per-stamp position-array allocation.
Do not duplicate the core integration algorithm in the helper or its tests.

The installed native plan must bind the actual PDE/helper/font/JAR bytes, runtime,
canvas, and all controls. Check draw counts (7680 baseline, 3840 short prefix,
1920 stride-4 with full prefix), geometry/object retention on style controls,
regeneration only on structural controls, glyph coverage, font identity, reset
pixel equality, and saved-image equality. Check missing-font and missing-glyph
failures explicitly. Record actual warnings and reject unexplained ones.

Before any candidate render, register a small visual comparison covering baseline,
stride, prefix, letters, dots, colour, distance, and field scale. Root must inspect
whether upright repeated forms follow the paths, sparse stamps separate, shorter
trails remain coherent, and glyph substitution demonstrates the same placement.
The visual claims remain unproven until inspected. If this density obscures the
editing task, preserve the experiment and revise settings with a new plan.

No shipped count changes until installed execution, native edit/save validation,
visual review, documentation, and packaging pass. This workflow would raise the
starter count to eight while leaving the reusable-operation count at eleven.
