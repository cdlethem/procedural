# Triangulation evidence audit

**Purpose:** bounded retrieval for a possible future point-set triangulation capability.
This is not an admission decision, a proposed signature, or evidence of target support.
It was compiled from the current normalized SQLite records, six nonstub notes, and the
pinned `AllSketchs` checkout at commit
`69bdd8513e4482a5e6018e36887d4bc208660eb5`.

## Scope distinction

The shipped triangle operations are [`TrianglePoints2D`](../../packages/java/src/main/java/org/procedurals/sampling/TrianglePoints2D.java): they map or seed points **inside one
caller-provided triangle**. They do not derive triangles from an input point set, establish
Delaunay adjacency, construct Voronoi cells, or clip cells to a boundary.

The `voronoi-delaunay` survey tag is a retrieval label, not proof that every tagged sketch
uses both constructions. In the inspected material, it usually means a Delaunay call used
as a drawing substrate. No inspected source computes Voronoi sites, polygons, dual edges,
or clipping against a rectangle or arbitrary polygon. `colidion#1` uses “Voronoi-like” to
describe a circle-deformation effect; it is not Voronoi construction.

## Decisive candidate rows

| Candidate ID | Computation and result boundary | Evidence and source status |
| --- | --- | --- |
| `2017/Generativos/triangularGradient#2` `triangulate(PVector[]) -> Triangle[]` | Local Bowyer–Watson: x-sort points, create a supertriangle, remove circumcircle-conflicting faces for each insertion, cancel paired edges, and remove faces sharing supertriangle vertices. The sketch then uses every triangle only to derive a circumcentre and draw an annulus. | The candidate and algorithm are in [the note](../../survey/out/2017/Generativos/triangularGradient/notes.md); source calls it at `triangularGradient.pde:40–63`. The tab [`Triangulatorr.pde`](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/triangularGradient/Triangulatorr.pde) is an attributed local Paul Bourke port. |
| `2018/Generativos/datata#0` `delaunayTriangulate(PVector[]) -> Triangle[]` | Another local incremental supertriangle/circumcircle implementation. Random disc points are triangulated once; faces are filtered solely by whether `p1` lies inside the disc, then immediately filled and shaded. That is not polygon clipping: faces crossing the disc edge may remain. | [The note](../../survey/out/2018/Generativos/datata/notes.md) identifies the local port. Source `datata.pde:34–64` shows point sampling, one batch triangulation, and the single-vertex filter. |
| `2018/Generativos/naifSelva#0` `delaunay(PVector[]) -> Triangle[]` | A local incremental port is invoked after **every** inserted point. Its result drives per-face colour interpolation and a black star mask; no retained mesh is exposed by the sketch. | [The note](../../survey/out/2018/Generativos/naifSelva/notes.md) records the repeated full retriangulation and its first-frame cost. `naifSelva.pde:78–94` confirms the call schedule. |
| `2019/generativos/lightcity#1` `triangulate(points) -> Triangle[]` | The third-party triangulator receives centres of biased quadtree rectangles. Each returned triangle is extruded into a triangular prism and receives window grids on its three vertical faces. Triangulation is only one input to the city composition. | [The note](../../survey/out/2019/generativos/lightcity/notes.md) explicitly calls the step a plain library call. `lightcity.pde:96–112` imports and calls `org.processing.wiki.triangulate.Triangulate`; the library version and its tie/degeneracy semantics are not recorded. |
| `2019/generativos/parapara#2` `delaunayMesh(points, strokeColor, alpha)` | The third-party triangulator receives a loosely packed depth-sized point set. The sketch draws all face edges with low alpha and then derives triangle centroids for separate specks. It returns no topology to its caller. | [The note](../../survey/out/2019/generativos/parapara/notes.md) names the dependency and records the mesh as visually faint. `parapara.pde:142–174,192–211` confirms the library call, edge drawing, and centroid pass. |
| `2020/generative/05_08/ruso#0` `triangulateScatter(cx, cy, radius, n, alphaMax)` | A compound drawing helper: biased disc scatter, third-party triangulation, per-vertex palette/alpha fills, then a centroid-wire overlay. It does not separate point generation, topology, face order, styling, or drawing. | [The note](../../survey/out/2020/generative/05_08/ruso/notes.md) records that compound boundary. `ruso.pde:77–102` is the library call and face styling; `:105–128` is the wire overlay. |

## Local source provenance

The audit read these pinned upstream files through the local corpus checkout. The first
column is the path below the upstream revision; hashes are SHA-256 of the retrieved file.

| Source | SHA-256 | Relevant lines |
| --- | --- | --- |
| `2017/Generativos/triangularGradient/triangularGradient.pde` | `adaf1beb0dd283282432d3e9f09d7b4a3751fd90b15c7fea051c3ae71179e419` | 40–63: sample points, triangulate, circumcentre rings |
| `2017/Generativos/triangularGradient/Triangulatorr.pde` | `bc82fb5625ea6a557b8da954fbba678bb8248e4b8c63b36163b36eda2f164369` | local Bowyer–Watson port |
| `2018/Generativos/datata/datata.pde` | `f6b306af447cee7aa530a25d325fc76b2acd56f2b9f16761bd4d01ec97c88661` | 34–64: disc points, triangulation, one-vertex face filter |
| `2018/Generativos/datata/triangulator.pde` | `fc5bcff9b0b55c1f096ff689d5b068e1c0f507c5de9391dc73938d91b5055386` | local incremental port |
| `2018/Generativos/naifSelva/naifSelva.pde` | `0d35c2618574cc254bb35a2cc52ccad1e76a32a04215246befd54940b2203787` | 78–94: retriangulation on insertion |
| `2018/Generativos/naifSelva/Triangulator.pde` | `4fe3abf23459e67a57294aa20bc8abcd879874bd04ec01d05e6debbde24e7b61` | local port, documented as a refactoring of a library implementation |
| `2019/generativos/lightcity/lightcity.pde` | `dc9b95a5a364f1644256986349f7c0f25d614a189f4f3a68d2617c1f155aadcc` | 96–112: centres to library call |
| `2019/generativos/parapara/parapara.pde` | `b9e72b24f1dfd28e13539fefeac8ac59c760203783d1684887b2057be014d548` | 163–174 and 192–211: library faces, centroids |
| `2020/generative/05_08/ruso/ruso.pde` | `74a5440c1c33aa8c6b241f98d3fca8cb83d0078ca361b9eb994bd2efa26587ac` | 77–128: scatter, library faces, wire overlay |

The six note SHA-256 values are respectively:

- `triangularGradient`: `a98eaf0e7d134069c543f85c5cb5caf2f22bb0b14246f6d305704b6c9db29dd2`
- `datata`: `1bdd530a6dad3d7b0c85b721bc97c036ad112585100cbede1b1095066807da13`
- `naifSelva`: `60d5752f1e72daa0efd925ad033d61ff6b83ceab4d929a5ce8c47d8da2ab38d2`
- `lightcity`: `cf46a24a25e0ac442a0f959876063bfe18e73583648491d3f3c3f9784182f92e`
- `parapara`: `ea08ea5cb8ca5d4c0c40796af45322f5d515755c990fad2c6fb40e22952f14fd`
- `ruso`: `a476b25cc8eb5a329b07a4de66d244b2c544ddd433f9526bb28c4ab9c2189d0f`

## What this evidence does and does not establish

The repeated computational shape is point set → Delaunay faces → immediate, sketch-specific
rendering or downstream geometry. It suggests that a retained ordered face result could
remove a real algorithmic burden for several different uses: circumcircle-derived marks,
faceted fills, a wire overlay, and prism extrusion. It does not establish a single caller
order, duplicate-site policy, collinearity policy, cocircular tie break, orientation, face
ordering, or clipping semantics. The local ports sort by x and use object identity to cancel
edges; the source does not specify a stable ordering for equal x values or duplicate sites.

The third-party sketches add a separate portability boundary. They import
`org.processing.wiki.triangulate.*`, but no versioned library source, license record, output
ordering, or degeneracy contract accompanies the notes. A future independent operation could
not inherit those behaviors from the examples without a new specification and fixtures.
Likewise, a Voronoi-cell API would require new evidence for dual construction, unbounded-cell
handling, and explicit clipping; neither follows from Delaunay face drawing.

Measured controls are also mixed with surrounding composition. `datata` changes disc size and
an area-based point count together; `naifSelva` changes point count while repeatedly
retriangulating; `lightcity` changes subdivision before point centres are formed; `parapara`
reports its mesh lines remain visually negligible even after the tested alpha change; and
`ruso` changes point count inside biased clusters while its alpha change was visually
ineffective under stacked transparency. These observations support inspecting point-set
triangulation as an ingredient, but they do not support parameter ranges, a drawing helper,
or a visual guarantee.

The renderer boundary is material: the local examples were inspected in P3D or P2D, while
several selected results are consumed by immediate Processing drawing. None provides an
independent JavaScript, Python, Android, retained-mesh, or clipped-cell result. No rendering
was performed for this audit.
