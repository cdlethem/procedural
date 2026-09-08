# Phase 2 rejection audit

Date: 2026-09-07. This is the integration-owner reconciliation of the 35 records
marked reject at audit entry. Seventeen were reopened; eighteen remain deliberate
exclusions of additional public wrappers. These are provisional design decisions,
not declarations that an idiom is unworthy or that all component operations exist.

Every row links its exact parent note; the ordinal and candidate name identify the
specific helper. The [authored ledger](../../design/phase2/cluster-decisions.json)
holds source hashes, prior decisions, reasons and component destinations.
The [architecture audit](phase2-architecture-review.md) describes method and limitations.

## Reopened rejections

The former rationale was too broad, described the wrong computation, or failed to
account for reusable geometry/state. Reopening does not automatically keep the helper.
Resolve component boundaries and repeated evidence before choosing an operation or recipe.

| candidate identity | computation review now required |
|---|---|
| [`2015/Generativos/dataBall#0` — tickArcPrimitive](../../survey/out/2015/Generativos/dataBall/notes.md) | Eight tick/arc/line primitives are explicitly described as reusable (122–180). Reopen the bundled HUD rejection to separate individual geometry/marks from the type-switch vocabulary; no eight-mode public function is approved. |
| [`2015/Generativos/dataBall#2` — rulerScale](../../survey/out/2015/Generativos/dataBall/notes.md) | rulerScale emits a column of squares and regularly spaced ticks (61–78). This is a coherent mark/layout computation, not the whole data screen. Compare repeated tick/ruler placement before choosing core operation versus recipe. |
| [`2015/Generativos/uiFuturist#0` — slide](../../survey/out/2015/Generativos/uiFuturist/notes.md) | slide draws a track and level bar from rectangle bounds and level. Review scalar-to-length mapping and two-rectangle composition independently from fixed HUD layout; aesthetic widget naming is not sufficient for rejection. |
| [`2015/Generativos/uiFuturist#2` — radar](../../survey/out/2015/Generativos/uiFuturist/notes.md) | radar combines concentric circles, tick/dash/dot rings. Separate polar placement, dash allocation and marks; a bundled radar recipe may remain excluded, but its generic components must receive explicit coverage decisions. |
| [`2015/Generativos/uiFuturist#4` — graph](../../survey/out/2015/Generativos/uiFuturist/notes.md) | graph samples a noise-driven polyline in framed bounds. Separate sampling, value-to-viewport mapping, clipping and frame marks; reopen the blanket HUD rejection rather than discarding a reusable plot-like computation. |
| [`2018/Generativos/magik3#0` — radiatingLineFan](../../survey/out/2018/Generativos/magik3/notes.md) | Successive noise-steered endpoint positions are joined to a fixed pivot, with palette progression. Distinguish endpoint integration, pivot-to-point fan segments and styling. The pivot-collapse choice is one-off; that does not reject the fan computation. |
| [`2018/Generativos/persons#1` — drawFigures](../../survey/out/2018/Generativos/persons/notes.md) | drawFigures returns head positions as well as emitting ellipse bodies and limbs. Reopen the whole-motif rejection to account for joint/head geometry independently of fixed figure styling, especially given the repeated persons family. |
| [`2018/Generativos/persons02#3` — capsulePerson](../../survey/out/2018/Generativos/persons02/notes.md) | The note calls capsule proportions and arm control points one-off, while persons03/05/06 expose related parameterised figures. Reopen for a cross-note comparison of articulated geometry versus fixed visual style; recurrence alone does not justify a public person renderer. |
| [`2018/Generativos/persons03#3` — capsulePerson](../../survey/out/2018/Generativos/persons03/notes.md) | The note explicitly identifies a parameterised capsulePerson block. Compare its joint/limb construction with persons02/05/06 and preserve reusable geometry/state before making a scope exclusion; keep fixed proportions and clothing style distinct. |
| [`2018/Generativos/persons05#0` — personAgent](../../survey/out/2018/Generativos/persons05/notes.md) | The figure has time-driven arm swing and rendering from position/size/angle/colours, separate from minimum-distance placement. Review articulation/state and figure marks independently; a figure name does not erase an agent-state computation. |
| [`2018/Generativos/persons06#1` — capsulePerson](../../survey/out/2018/Generativos/persons06/notes.md) | A recurring Person implementation exposes update and show with swinging limbs. Compare state transition and joint geometry across the family, separately from capsule/colour styling; do not infer a public renderer solely from recurring name. |
| [`2019/generativos/caritas#1` — checkerboard](../../survey/out/2019/generativos/caritas/notes.md) | The actual candidate is checkerboard(x,y,w,h,cols,colA,colB): alternating cell fill (108–115). It is not the face/cell scene. Reopen the scene-style rejection and compare lattice parity, cell bounds and fill commands as components. |
| [`2019/generativos/cucu#1` — swirlDash](../../survey/out/2019/generativos/cucu/notes.md) | swirlDash is one elongated ellipse whose rotation, squash, colour and alpha come from noise. Packing is in another candidate. Review attribute sampling, ellipse transform and ADD rendering; reopen the whole-scene rationale that did not describe this record. |
| [`2019/generativos/guagua#0` — gridCells](../../survey/out/2019/generativos/guagua/notes.md) | gridCells emits rounded square cells with explicit count, gap and corner radius. Separate lattice/cell bounds from rounded-rectangle marks; the source specifically calls it generic, so scene-style rejection alone is insufficient. |
| [`2019/generativos/limo002#1` — emitterBurst](../../survey/out/2019/generativos/limo002/notes.md) | emitterBurst follows a wavy spine then emits radial endpoint spikes. Separate integrated path, endpoint fan geometry and marks; keep the particular two-stage visual recipe distinct from those reusable computations. |
| [`2019/generativos/paraisooscuro#1` — bokehCircle](../../survey/out/2019/generativos/paraisooscuro/notes.md) | The actual candidate is a triangle-fan disk with a warped rim (257–284), not the full multi-layer scene. Review circular sampling, point warp and fan topology separately, retaining the bokeh appearance as style. |
| [`2020/generative/01_04/clim#1` — dotBurst](../../survey/out/2020/generative/01_04/clim/notes.md) | This candidate is dotBurst: radial scatter of translucent ellipses. The wavy line field is a separate candidate. Review radial point distribution and mark styling independently from flower placement/y-bias; reopen the decorative-name rejection. |

## Retained wrapper exclusions with component destinations

These exclude only an additional bundled public function. “Deferred” means an outstanding
component obligation; “recipe” preserves composition/example work; “adapter” preserves
capability and rendering work. None means that an implementation or contract is complete.

| candidate identity | explicit destinations and unresolved obligations |
|---|---|
| [`2014/Generativos/Arboles#1` — boundingStruc](../../survey/out/2014/Generativos/Arboles/notes.md) | **recipe — Bounding rectangle, centre line and diagonals:** Keep as a debug/frame example assembled from ordinary line/rectangle commands; no new frame operation. |
| [`2014/Generativos/palabrasAleatorias#1` — hsbPoster](../../survey/out/2014/Generativos/palabrasAleatorias/notes.md) | **deferred — Tapered strokes:** Related mark.tapered-line investigation must preserve width/colour profiles. **recipe — Single-hue palette and title/subtitle placement:** Preserve poster composition; font and supplied text remain explicit adapter/data inputs. |
| [`2014/Generativos/prueba2video#1` — growingArcGrid](../../survey/out/2014/Generativos/prueba2video/notes.md) | **recipe — Grid placement and per-frame growth:** The growing grid is a composition of placement and time-dependent scale. **deferred — Blink/lerp arc state:** Arco transition behavior must be reviewed independently of the grid wrapper. |
| [`2015/Generativos/caritas#0` — randomFace](../../survey/out/2015/Generativos/caritas/notes.md) | **recipe — Head/eye/mouth placement and proportions:** Keep the cartoon face as an example; compare neutral articulated/relative geometry in the separately reopened figure family. **adapter — Mixed HSB and packed-colour behavior:** Colour representation/conversion must be explicit when the example is ported. |
| [`2015/Generativos/triangulitos#1` — rcol](../../survey/out/2015/Generativos/triangulitos/notes.md) | **deferred — Two palette selections:** Related color.palette-pick evidence exists; preserve two draws and duplicate weighting. **deferred — Interpolation between selected colours with random factor:** A two-colour interpolation primitive is not automatically equivalent to cyclic paletteSample. Review colour-space and factor semantics. |
| [`2016/Generativos/rosita#1` — rcol](../../survey/out/2016/Generativos/rosita/notes.md) | **deferred — Random HSB channels, hue wrap and occasional colour blend:** General colour construction/sampling and interpolation require separate decisions; warm literal ranges remain recipe data. |
| [`2016/Generativos/textureGridText#2` — hueLock](../../survey/out/2016/Generativos/textureGridText/notes.md) | **recipe — One sampled hue reused with different saturation/brightness pairs:** Treat shared hue as an explicit value reused by colour construction, not a hidden global palette helper. **deferred — HSB colour construction:** Not covered merely by palette entry selection or cyclic interpolation. |
| [`2017/Generativos/chinasseForms#1` — iconCell](../../survey/out/2017/Generativos/chinasseForms/notes.md) | **deferred — Cell-local dot, rotated square, corner brackets and cross:** These are non-font marks; the old font-only rationale was incorrect. **adapter — Glyph placement and font style:** Keep supplied glyph/font separate from cell layout. **recipe — Five-way icon-style menu:** Exclude the particular menu wrapper, not its geometry or placement. |
| [`2018/Generativos/OP/op_014#0` — gridGradientTiles](../../survey/out/2018/Generativos/OP/op_014/notes.md) | **deferred — Random walks writing a direction grid:** A state-writing walk is not established by ordinary path.grid-walk membership. **deferred — Per-cell gradient quads and neighbour shading:** Gradient commands, tile orientation and neighbour updates need separate semantics. |
| [`2018/Generativos/datata#2` — facetedDisc](../../survey/out/2018/Generativos/datata/notes.md) | **deferred — Disk samples and Delaunay triangles:** Related sampling.disk and geometry.delaunay investigations preserve component evidence. **deferred — Per-face palette fill and corner-alpha overlay:** Assign vertex attributes and render gradients explicitly; no gradient support is implied. **recipe — Faceted-disc assembly:** Preserve as a motivating example rather than an extra primitive. |
| [`2018/Generativos/mares#0` — noiseScaleGrid](../../survey/out/2018/Generativos/mares/notes.md) | **deferred — Hex positions and noise-modulated radius:** Review lattice and sampled radius attributes separately. **recipe — Layered annular wedge/ellipse/arc scale motif:** Preserve the scale styling as composition; annular geometry remains separately investigated. |
| [`2018/Generativos/meteorito#4` — facetedDisk](../../survey/out/2018/Generativos/meteorito/notes.md) | **deferred — Uniform disk sampling and triangulation:** Related sampler and Delaunay evidence exists; point-density mapping remains separate. **deferred — Per-face colour and vertex-alpha shading:** Gradient/colour handling is not covered merely by triangulation. **recipe — Faceted-disk assembly:** Retain a convenient example without adding a bundled public primitive. |
| [`2018/Generativos/pathfinder#1` — noiseCity](../../survey/out/2018/Generativos/pathfinder/notes.md) | **deferred — Grid positions, per-cell noise heights and type flags:** These are the noiseCity candidate components; review them independently of buildings/parks/sand appearance. **recipe — Scene-specific building/park/sand assembly:** Keep city recipe work; do not claim all other pathfinder helpers are components of this exact candidate. |
| [`2018/Generativos/persons06#0` — gridPersons](../../survey/out/2018/Generativos/persons06/notes.md) | **deferred — Grid-snapped minimum-distance placement:** Related sampling.grid-min-distance investigation; preserve acceptance and attempt order. **deferred — Person construction and update:** Reopened persons06#1 and persons05#0 carry figure/state review. **recipe — Placement plus figure factory wrapper:** Keep the crowd assembly as composition rather than an additional gridPersons primitive. |
| [`2018/Generativos/puntis5#0` — rock](../../survey/out/2018/Generativos/puntis5/notes.md) | **deferred — Disk sites, Delaunay, triangle sampling and stipple allocation:** Related investigations exist; preserve density and RNG order. **adapter — Palette fill and ADD highlight:** Explicit attribute/blend commands and target support remain required. **recipe — Rock assembly:** Retain faceted-rock example, not a whole-scene primitive. |
| [`2018/Generativos/puntis6#0` — rock](../../survey/out/2018/Generativos/puntis6/notes.md) | **deferred — Disk sites, Delaunay and area-proportional stippling:** Preserve each sampler/topology/allocation computation separately. **deferred — Radial shade and ADD overlay:** Explicit gradient/overlay semantics are still unresolved. **recipe — Rock assembly:** Retain as a motivating composition. |
| [`2019/generativos/caritas#4` — face](../../survey/out/2019/generativos/caritas/notes.md) | **recipe — Layered face ellipses, arcs and proportions:** The note explicitly calls the face construction hand-tuned. **deferred — Stipple texture and relative placement:** Preserve component investigations independently of the cartoon face. |
| [`2020/generative/05_08/poses#1` — pastelDisc](../../survey/out/2020/generative/05_08/poses/notes.md) | **recipe — Translucent disc mark and snapped placement:** pastelDisc is a disc plus grid position. It is not stickFigure: poses#0 remains independently reopened for hierarchical limbs. |

## Decision standard going forward

Read the exact candidate and parent explanation before interpreting the sketch name.
First identify inputs, outputs, state, topology and component boundaries. A compound
helper can be excluded from the public core while its useful pieces remain obligations.
Do not claim an ingredient is covered merely because a similarly named family exists.
Compare recurrent figure articulation independently of fixed proportions, and portable
text placement independently of fonts. Repeated visual motifs alone do not justify a
public renderer; the computation and useful composition must justify it.

All 18 retained exclusions now carry structured `decision_audit` records. The checker
requires an audit for future rejections and nonempty remainder accounting for extraction.
Human review must still establish that the listed components and their destinations are
accurate; passing structural validation cannot establish this by itself.
