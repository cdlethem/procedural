# Visual research for the composable-instruments release

Root synthesis, 27 September 2026. Supports the [authoritative next-release roadmap](next-release-roadmap.md),
not new implementation acceptance. The [tracked corpus](../evidence/external-art/2026-09/corpus.json)
retains source URLs, work IDs, artist statements and limitations. Historical collection/recreation
claims are not upgraded by this review.

## Scope and method

- **6,497 distinct available images**, 24 artist/studio groups; 1,988 of 2,023 selected
  records have local images. 383 source URLs were unavailable at collection time.
- **229 new labelled contact sheets**, 30 images per full sheet. Eight visual research
  workers report opening all assigned sheets. Six Hoff SVGs missing from raster contact
  generation were separately viewed as rendered SVGs. A contact sheet is a thumbnail grid,
  not individual inspection of every original.
- Root personally opened a sheet for every group and **58 mapped individual originals**,
  plus the six released-instrument baseline sheets. Workers opened additional originals
  and selected video/GIF previews across the major identified styles. Some originals are
  themselves very small; opening them cannot recover missing detail.
- This review is of **stills**. It does not establish motion, latency, responsiveness,
  temporal coherence, physical behaviour, or a specific undisclosed algorithm.
- A numbered image below is the per-artist number in
  `.work/next-release-visual-review/<artist-slug>/index.json`, not a corpus work number.
  That mapping gives the content hash, original, preview and associated work records.
  Multiple images can share a work; one image can be associated with several records.
- Root rejected erroneous worker associations and missing-feature claims. Package gaps
  in the roadmap are root's comparison with the exact release, not inherited from worker
  speculation. In particular, generic flames, reaction diffusion, weaving, registered
  screens, CA stepping and implicit ray computation already exist.
- The [review mapping](../evidence/external-art/2026-09/next-release-review.json) preserves
  root's exact original paths and the numbered citations used below. It is not a claim that
  every citation is an independently reviewed final artwork; roles and exceptions stay here.

The purpose is to understand the range of intended outputs and the relationships worth
exposing. It is not an exhaustive taxonomy of each artist's oeuvre, nor a claim that all
6,497 images were individually examined at original resolution.

## Findings that change the architecture

1. **Marks have roles.** Davis's large forms, small decorative detail and connective accents
   differ in placement and purpose. A single scatter density slider cannot express that.
   A site producer needs role/scale attributes and replaceable child techniques.
2. **Regions coordinate different materials.** Hobbs's quiet planes, nested strokes and
   interruptions share spatial organization. Separate unrelated layer seeds are insufficient;
   regions and paths need reusable identity.
3. **Material is a computation, not a color.** Bristle gaps, watercolor boundaries, thread
   topology, quilled walls and granular accumulation respond to construction. A blur or
   opacity control does not replace those relationships.
4. **History matters.** Growth bands, river scars, chemical trails and deposition distinguish
   systems with similar final silhouettes. Preserve state/history separately from painting.
5. **Source and result need an explicit relationship.** Image transformations, text, data,
   gestures and scans require owned input representations. A hidden procedural source cannot
   stand in for an artist's chosen input.
6. **Space is not merely a lighting preset.** Surface growth, articulated panels, spatial
   fibers, point clouds and selective mesh abstraction need real representations and depth.
7. **Restraint is constructive.** Molnar's omissions, sparse signals, interrupted bands and
   barely occupied paper are not incomplete versions of dense wallpaper. Empty regions,
   selective stages and partial results belong in the control model.
8. **Composition can replace proliferation.** The same sites can hold dots or branching
   miniatures; the same paths can carry thread, text or grains. This is the most direct
   response to the user's functional-composition direction.

## Artist-by-artist style synthesis

Counts below are available assets / contact sheets, not accepted artworks or algorithms.
Examples are individual-detail anchors from root or delegated reviews; they are not the
entire contact-sheet set. Proposed controls are our design decisions unless a source
explicitly documents them.

### Joshua Davis — 908 / 31

Distinct families include organic motif collages, dense symmetric illustration, editorial
text, disrupted facets/grids and luminous motion-design stills. Root's #336/#347 show large
rounded masses surrounded by unequal small accents and substantial margin; #355 contrasts
connected chain-like forms with large quiet fields. Worker examples include #337/#382
collage, #494/#495 ornament, #358/#359 type, #437/#438 facets and #449/#450 flowing abstraction.
The transfer is **role-aware placement and motif substitution**, not “more circles.”
Typography and symmetry need their own source/layout decisions; video stills do not prove
an audio-reactive implementation. See [Anderson Ranch 2007](https://joshuadavis.com/Anderson-Ranch-Print-2007/)
and [Clear Magazine](https://joshuadavis.com/Clear-Magazine/). Roadmap: 01, 02, 07, 22, 39, 42.

### Casey Reas — 584 / 20

Major families: accumulated fine paths/relations, local radial or puff-like masses,
translucent cell/mark arrangements, optical/geometric series and image/film recomposition.
Root #481 MicroImage and #503 Tissue show fine marks building density with open channels;
worker #541/#543 Path show sweeping bundles, #442/#443 Puff localized masses, and #544 Cells
large translucent disks with separate fine strokes. Cells has only one mapped asset.
Supplementary #141/#142 compare optical dots with broken grid strokes; #341/#350 Cinema
Image compare an installation view with photo/color recomposition. These are not the
same style as accumulated paths. Worker access to #143's original/preview failed although
its sheet thumbnail was visible; #143 is not counted as individual-detail evidence.
Catalogue records often say **algorithm unassessed**. Use explicit path/site/history
outputs and material consumers, not inferred rules. [MicroImage A-04](https://index.reas.com/work?id=recZTrxXLiWirkxMW),
[Tissue C-06](https://index.reas.com/work?id=recTQENwbnBuFMGna). Roadmap: 05, 11, 17, 34; existing contact/sensing families.

### Tyler Hobbs — 396 / 14

Compared families: From Noise's falling multiscale marks (#11/#12), Day Gardens' quiet
planes (#22/#23), Fidenza's interrupted broad ribbons (#48/#50), Holmberg's tiny colored
facets (#259/#260), sparse vertical signal marks (#308/#309), and QQL's unequal rings
(#63/#64). Root #91/#109 add coordinated regions and fine nested structure; #119 reveals
aligned rows of dots following broad shared curves. The critical decisions are region
ownership, scale distribution, omission and material—not only a flow field.
Physical analogues and installation photographs are different evidence from clean outputs.
[Careless and Well-Intentioned](https://www.tylerxhobbs.com/works/careless-and-well-intentioned),
[Aligned Movement](https://www.tylerxhobbs.com/works/aligned-movement). Roadmap: 01, 03, 04, 07, 10, 32.

### Anders Hoff / inconvergent — 145 / 5

Compared graph/DSL drawings (six directly viewed SVGs), branching/venation (#112/#113
mapped video previews), differential meshes (#126/#127), sand spline (#131/#133),
volumetric light (#43/#44) and architectural/faceted illustrations. Root #92/#100/#110
show granular membranes, a sparse circular accumulation and strong density seams.
Separate geometry, traversal, accumulation and exposure. Graph querying need not become
a whole new DSL; light-volume examples do not prove that a 2D dot field is volumetric.
[Grains of Sand](https://inconvergent.net/2017/grains-of-sand/),
[Sand Spline](https://inconvergent.net/generative/sand-spline/). Roadmap: 05, 11, 15, 50, 53; volumetric rendering remains outside the selected core scope.

### Sighack / Manohar Vanga — 166 / 6

Compared line-material specimen charts (#9/#10), grainy horizon compositions (#1/#2),
image overlays (#21/#22), needlepoint-like mosaics (#26/#27), random-walk fills (root #73/#77),
value sketches (#122/#123) and watercolor swatches (#144/#146). Sheets also show source
photos, palette strips, packing and Poisson diagrams; these are not all generated artworks.
The flood fills vary from broad branching fields to narrow isolated fronts. Value grouping,
connected regions, mark choice and material are separable computations.
[Watercolor](https://sighack.com/post/generative-watercolor-in-processing),
[Flood-fill walks](https://sighack.com/post/flood-fill-art-using-random-walks),
[Value sketches](https://sighack.com/post/generative-value-sketches-using-k-means-clustering).
Roadmap: 08, 10, 13, 21, 31, 32; existing placement is reused.

### Vera Molnar — 49 / 2

Distinct families: nested/perturbed geometry (#34/#35), interrupted short-stroke fields
(#44/#45), sparse red bars (#4/#5), and serial pastel bands (#27/#28). Root #17/#23 show modest shifts and
omissions in square order and pale interstices between dark overlapping shapes. These
are not calls for a maximal noise parameter: small, localized exceptions and large empty
areas carry the composition. Institutional reproductions include hand execution, paintings
and computer drawings; do not assign one algorithm to them all.
[1980s works](https://dam.org/museum/artists_ui/vera_molnar/works_vera_molnar/works-from-the-1980s/),
[Interstices](https://dam.org/museum/artists_ui/artists/molnar-vera/interstices-2/).
Roadmap: 03, 07, 22; existing lattices/partitions as producers.

### Tim Rodenbroeker — 19 / 1

Compared modular type (#13/#15), optical repetition (#8/#10), image redrawing (#7/root #17)
and public-display/object documentation. Root #13 is a photograph of blue/white posters:
repetition, clipping and regional stretching turn words into structure. #17 preserves a
face through small directional marks. Sources, glyph runs, panel organization and material
must be independently selectable. The Bach project's title and a photographed silhouette
do not establish a particular live sound mapping.
[Programming Posters](https://trcc.timrodenbroeker.de/programming-posters/),
[Redrawing Images](https://trcc.timrodenbroeker.de/redrawing-images/). Roadmap: 32, 35–39, 42.

### Ben Fry — 55 / 2

Families include data-geographic networks, relationship arcs, labelled/isometric data
structures, typographic books/tables and processed media. Root #15 disarticulate and #21
Distellamap distinguish image/line processing from semantic correspondence; the latter
mapped original is only 150×219 and cannot establish fine detail. Workers also inspected
All Streets, Chromosome 14, Frankenfont's book views (#3/#4) and Video Pieces (#52/#53):
abstract vertical bands versus a glyph-like figure. Packing rectangles is not data-driven hierarchical layout,
and an arbitrary web is not a graph preserving real endpoint relationships.
[disarticulate](https://www.benfry.com/disarticulate/),
[Distellamap](https://www.benfry.com/distellamap/). Roadmap: 05, 34, 38, 41, 42; not a general dashboard product.

### Golan Levin — 115 / 4

Compared tracked-motion installations, gesture/voice performance, processed portraits,
drawn symbols and data-interface documentation. Root #45 Messa di Voce shows performers
and projected marks; #53 Moon Drawings shows repeated hand-drawn symbols. Worker Footfalls,
Motion Traces and paired Manual Input views (#23/#24) reinforce that **the input/result
relationship is part of the work**. Floccular Portraits (#94/#95) contrast crops/line density;
Secret Lives of Numbers (#62/#63) and Axis (#59/#60) are Levin data interfaces, not Fry works.
A performance photo is not a finished canvas or proof of timing.
Preserve recordings and let multiple drawing techniques consume them. Camera tracking,
sound interpretation and installation hardware remain separate acquisition capabilities.
[Messa di Voce](https://www.flong.com/archive/projects/messa/index.html),
[Moon Drawings](https://www.flong.com/archive/projects/moon-drawings/index.html). Roadmap: 01, 34, 40–42.

### Tomasz Sulej / GenerateMe — 543 / 19

Compared density/exposure (#1/#2), vector-field drawings (#25/#26), nonlinear folds
(#17/#18), pixel sorting (#222/#224/#225), slicing (#182/#183), FM (#292/root #293),
displacement (#283/root #284) and neural transformations (#49/#50). Root #298 also shows
fine directional marks retaining a bird silhouette. Some nearby tutorial pictures are
unaltered source photos; two earlier monument inputs were explicitly rejected as proof
of sorted output. The useful split is source → selection/map → transformation → material.
Neural imagery stays an external-input boundary.
[Vector-field drawing](https://generateme.wordpress.com/2016/04/24/drawing-vector-field/),
[FM](https://generateme.tumblr.com/post/170838479034/fm-generateme-scripts-part-9).
Roadmap: 11, 27, 29, 33–35; extend existing density consumers.

### Jonathan McCabe — 278 / 10

Compared cyclic flow (#1/#2), multiscale BZ-labelled images (#17/#91), locally symmetric
Turing fields (#153/#154), strange-attractor traces (#177/#178), banded bilateral ornament
(root #165/#166) and rectangular layered structures (root #171/#172). Coarse forms contain
fine local detail; symmetry and field state matter independently of palette. Album titles
support named families, not their full equations. Existing Gray–Scott is present; the new
work is scale coupling or genuinely different rules, not “add reaction diffusion.”
[Local reflection Turing patterns](https://www.flickr.com/photos/jonathanmccabe/albums/72157669902107982),
[Diatomaceous](https://www.flickr.com/photos/jonathanmccabe/albums/72157623472782429).
Roadmap: 18, 19, 22, 27; density/material improvements shared with flames.

### Scott Draves — 32 / 2

Compared flame prints (#1/#2), Flame (#9/#10), Bomb's patterns/documentation and Hifidreams
installation views (#5/#6). Root #20 Clade adds fine luminous curls; #9 is an airy isolated
plume. Several originals are roughly 280 pixels wide and Sheep is itself a montage.
Density, reconstruction and exposure deserve independent controls. Flame Clouds already
exists; do not propose fractal flames as wholly absent. Bomb's heterogeneous named
processes cannot be assigned to individual stills without supporting evidence.
[Flame](https://scottdraves.com/flame), [Clade](https://scottdraves.com/clade).
Roadmap: shared density/material foundation, 19, 27; no evolving installation acceptance.

### Nervous System — 763 / 26

Compared Hyphae/Xylem (#75/#76; one small process diagram), reaction fields (#67/#68;
diagram versus output), Floraform (#125/#126), Laplacian fronts (#467/#468), cellular
jewelry (#194/#195), articulated Kinematics (#341/#342), boundary-adaptive Corollaria
(#365/#366) and dendritic puzzle cuts (#423/#424). Root Growing Objects #14/#17 shows
rounded protrusions versus perforated ruffled sheets. These imply distinct representations:
branch graph, field, region, articulated mesh and growing surface. Product photographs
are not solver states, and no fabrication guarantee follows.
[Growing Objects](https://n-e-r-v-o-u-s.com/projects/albums/growing-objects/),
[Floraform](https://n-e-r-v-o-u-s.com/projects/albums/floraform-system/).
Roadmap: 02, 16, 18, 20, 47, 50–52; generic cells/growth are not all missing.

### Andy Lomas — 63 / 3

Compared chemotaxis (#1/#2), cellular forms (#33/#34), plantlike forms (#25/#26, root #28),
constrained/vase forms (#16/#17) and aggregation (#49/#50). Fine cell texture and large
silhouette vary separately; nutrient/constraint relationships have explicit artist-described
evidence. Shared images for Constrained/Mutant Vase records cannot prove which mechanism
produced each depicted object. A 2D colony is a useful scoped transfer, not equivalent to
these spatial cellular forms. Surface growth remains its own substantial mechanism.
[Chemotaxis](https://andylomas.com/digitalChemotaxis.html),
[Cellular Forms](https://andylomas.com/cellularForms.html). Roadmap: 15, 17, 20, 50.

### Deskriptiv — 70 / 3

Compared Vespers (#1/#2, root #6), Rottlace (#10, root #12), Wanderers (#18/#19), DoubleMesh
(#47/#48) and Flyknit (#55/#56). One DoubleMesh image is an editable-system view, another
a fabricated lattice; Flyknit contrasts flowing strands with dense interlacing. Root's
mask/fiber views show material varying with anatomy and spatial location. This requires
surface-aware construction and material fields, not another regular flat weave.
Distinguish a wearer photograph, rendered campaign image, interface and fabricated object.
[DoubleMesh](https://deskriptiv.com/doublemesh), [Flyknit](https://deskriptiv.com/nikeflyknit),
[Rottlace](https://deskriptiv.com/rottlace-bjork). Roadmap: 48, 51, 52, 54; no material-engineering claim.

### Robert Hodgin — 145 / 5

Families include river landscapes/history, map-derived city scenes, quilled strips,
embroidery, fish-like masses and atmospheric forest scenes. Root River Scars #1 shows
current channel, smaller tributaries and older scars; Individuation #18 shows nested
paper-like walls, rolled ends and real occlusion. Paired worker views include river #1/#2,
city #9/#10, fish #93/#94, forest #107/#108, quilling #18/#19 and embroidery #54/#55.
These distinguish initial structure, evolution, instance geometry and
lighting. Static fish arrangements do not establish a flocking solver; map-source or
physical-looking imagery does not supply reusable assets.
[River Scars](https://roberthodgin.com/project/river-scars),
[Individuation](https://roberthodgin.com/project/individuation),
[Embroidery](https://roberthodgin.com/project/embroidery). Roadmap: 13, 14, 43–45, 49, 54.

### Watabou — 88 / 3

Compared cities/neighbourhoods, villages, cave/glade topology, dungeon plans, island maps
and mansion/game documentation. Root #12/#26 shows buildings organized by streets and
boundaries, not independently scattered over them. Workers opened city #1/#2, cave #4/#5,
island/region maps #16/#17 and mansion scenes #19/#20. Corridors, parcels, shorelines,
symbols and annotations are separable outputs;
connectivity and containment are structural requirements. Screenshots document useful
generators without recovering their algorithms. The proposal extracts reusable spatial
organization rather than promising several complete themed map products.
[Neighbourhood](https://watabou.itch.io/neighbourhood),
[Village](https://watabou.itch.io/village-generator). Roadmap: 02, 03, 38, 43, 45.

### Raven Kwok — 249 / 9

Compared recursive/cellular subdivisions, rule-grid imagery, geometric line systems,
field/particle work and installation documentation. Root Greatness #105 turns a subject
into locally varying cells/triangles; Skyline #114 shows strongly stretched regions
around a radial center. Worker #99/#100 contrast jagged radial forms with a bold circular grid.
Octree.OBJ #76/#77 compare smooth source-like geometry with blocky output in technical
viewports; Rule 110 #78/#79 and Derivations #95/#96 add graphic versus installation views.
Screenshots alone do not prove their construction. Existing CA stepping and mesh subdivision are present. The more useful
addition is hierarchical, source-conditioned construction with replaceable terminal content.
[Greatness](https://ravenkwok.com/greatness/), [Skyline](https://ravenkwok.com/skyline/).
Roadmap: 06, 19, 30, 54, 55; full voxel authoring is not implicitly promised.

### LIA — 457 / 16

Compared translucent filament masses, sculptural ribbons/ruled surfaces, modular boxes
(#74/#75), stark block compositions (#166/#167), teletext frames (#175/#176), and physical
plotter marks (#90/#91). Root #157 is a photographed print with grainy/translucent swept
marks; #166 is hard-edged black/white construction. These should not share one fixed
material treatment. Accumulation, local scale, clipped modules and selected negative space
are consequential. Recorded frames and installation photographs do not prove interactivity.
Root also inspected Volatile Structures #9's translucent angular strand mass and cathedral
work #27's sweeping ruled ribbons, complementing worker #8/#26.
[CLOUDS](https://www.liaworks.com/stills-and-prints/clouds-generative-art-and-the-future-of-interactive-storytelling/),
[B&W Forever](https://www.liaworks.com/archive/bw-forever-a-generative-video/).
Roadmap: 03, 10, 11, 14, 28, 39, 52.

### Takahiro Kurashima — 239 / 8

Compared moiré books/plates (#151/#152), geometric unit arrangements, symmetry/number
patterns (#237/#238) and kinetic objects/shadows (#55–57). Root #64/#88 shows fine curves
and overlapping registered line fields producing broad visual forms. The transfer is
**two real replaceable pattern sources with shared registration**, not a second independent
moiré renderer. #221 was uninformative as an individually decoded black frame; worker #222
and root #223 show alternating unit rotations. Some distinct one-image works cannot supply
a second local variant.
[Nacre](https://takahirokurashima.com/lithograph/lithograph-a/),
[New Vibration](https://takahirokurashima.com/la-maison-du-whisky/).
Roadmap: 07, 22, 25, 28; existing Registered Screens is the starting point.

### onformative — 284 / 10

Compared material analysis/product forms (#1/#6), sculpting process/render (#33/#34),
river landscapes (#87/root #89), cloud/performance documentation (#140/#141), data-driven
branching letters (#168/#169) and network interfaces (#257/#258). Root #82 shows a lifted
brush-like material fragment; #89 separates channel structure from richly differentiated
terrain. Pairs sometimes compare **process/input with output**, not two final renders;
that distinction is itself architecturally useful. Growing Data explicitly describes
agent/Brownian behaviour driven by air quality, not just font-outline extraction.
Root #142/#143 additionally show point/mesh processing in a software viewport, not clean
finished cloud renders; interface visibility must not be confused with algorithm proof.
[Material Innovation](https://onformative.com/work/material-innovation),
[Meandering River](https://onformative.com/work/meandering-river),
[Growing Data](https://onformative.com/work/growing-data). Roadmap: 12, 17, 25, 36, 42, 44, 52, 54.

### Benjamin Bardou — 287 / 10

Compared scene-legible nocturnal cloud imagery (#4/#7/#17), abstract particulate volumes
(#188/#210), painterly landscapes (root #154/#169) and exhibition documentation. Root's
landscapes contrast sharp cuboid/vertical fragments with soft multiscale paint-like patches.
Artist descriptions name point clouds, volumetric imaging, Gaussian splatting and AI
assistance for some projects, but do not specify every source/capture/model pipeline.
A 2D image-to-marks study and a real 3D point-cloud consumer are useful, distinct transfers;
neither is a scan reconstruction or learned image synthesizer.
[Imaginary Landscape 6](https://benjaminbardou.com/works/imaginary-landscape-6.html),
[Imaginary Landscape 11](https://benjaminbardou.com/works/imaginary-landscape-11.html).
Roadmap: 12, 32, 34, 54; explicit external-source boundary.

### Quayola — 363 / 13

Compared pointillist landscapes (#3/#4), tree-like cloud/wire structures (#65/#69), stepped
reliefs (#139/#140), selective facets (root #168/#176) and fabrication/exhibition views.
The root pair makes the key relationship clear: detailed anatomy survives in selected
areas while coarse facets take over elsewhere. A random triangle overlay is insufficient.
Likewise, dense colored points alone do not establish how a landscape source was acquired.
Keep source geometry, local abstraction, sectioning, material and camera independently editable.
[Laocoön D20-Q1](https://quayola.com/laocoon-d20-q1/),
[Laocoön Fragments](https://quayola.com/laocoon-fragments/). Roadmap: 31, 32, 46, 53–55.

### Inigo Quilez — 199 / 7

Compared documented distance-field scenes (#61/#62), 2D distance bands (#193/#194), terrain
(#131/#136), fractal boundary distance (#64/#65), domain warping (#69/#72), and root's
Mandelbulb/Menger examples (#104/#111). Technical articles support mechanisms more directly
than appearance-only gallery records. Distinguish safe distance functions, estimates,
height fields and generic scalar fields. The accepted implicit-ray core is present;
artist-directed composition and material consumers are the web-facing gap.
[Raymarching distance fields](https://iquilezles.org/articles/raymarchingdf/),
[Mandelbulb](https://iquilezles.org/articles/mandelbulb/),
[Menger](https://iquilezles.org/articles/menger/). Roadmap: 26, 27, 45, 46, 53, 56.

## Admission boundaries

The roadmap incorporates these visual relationships without asserting exact recreation.
Hyperbolic tiling, inversion, collision models and other proposed algorithms are explicit
original design choices where no reviewed source establishes that method. Conversely,
artist-described techniques are not accepted package implementations merely because the
reference image was opened.

The meaningful release proof will be artists changing inputs and substituting consumers
through the actual interface, producing varied and intentional compositions. This research
selects that work; it does not replace its creative or technical verification.
