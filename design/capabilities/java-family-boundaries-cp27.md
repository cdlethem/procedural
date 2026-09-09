# Java family boundary review after CP27

Root review against Java 0.30, commit f32d1aad85ef8256f7af2871529bc049e276e43c.
This is a bounded evidence review, not full-corpus certification or completion acceptance.
It preserves all five requirements in docs/java-completion-plan.md.

| Family | Established Java entry point | Decision and remaining boundary |
| --- | --- | --- |
| Typography | GlyphMarks places native glyphs along GradientPath2D paths | Keep placement as composition, not a second advection algorithm. numbers describes repeated digit stamping; textureGridText describes cardinal glyph echoes. Neither establishes outline extraction or text shaping. Those remain unsupported and unassessed across the broader corpus. |
| Branching / L-system label | BranchMarks and CutBranchMarks | Keep endpoint growth and mutable line-pool subdivision distinct. The brotes walkthrough operates on geometric lines, despite calling the candidate an L-system. It does not establish symbolic grammar rewriting; no grammar-engine support claim. |
| Delaunay / Voronoi label | FacetMarks and ProjectionMarks | Delaunay triangulation and sequential point projection are supported separately. triangularGradient uses triangle circumcircles; colidion deforms contours. Neither proves nearest-site polygon construction. Voronoi cells remain unassessed, and the complete colidion fill/neighbor algorithm remains unfinished. |
| Radial 3D meshes | ProfileMarks and DepthMarks | Keep increasing-axis radius profiles. The aros washer requires inner walls and annular closing faces: a concrete missing topology, retained for implementation investigation rather than excluded to close the checklist. |

## Next bounded geometry task: annular forms

Artist task: build a ring with a visible hole, change its band width and depth, and reuse
its indexed faces and normals for color or arrangements. Existing RadialProfile3D cannot
represent both inner and outer radii at the same axial coordinate. Two profile surfaces
would still leave the artist implementing annular faces, orientation and normal handling.
That is algorithmic work, not merely drawing glue.

Root reread aros notes and source lines43–96. The source halves h, then uses h/sub,
covering -h through zero; the note's symmetric span is incorrect. It emits radial faces
at every axial subdivision, including duplicate interior faces, and gives inner and outer
walls the same winding. Preserve this provenance; do not copy these properties into an
independent clean mesh specification by accident. No measured parameter variants exist.

Compare a minimal annular mesh with a closed-meridian surface before freezing an API.
Prefer the smaller boundary if the broader profile model does not add a demonstrated
artist use. Admission requires a direct ring-width/depth edit and a second arrangement or
color consumer, plus clear winding, seam, face identity, normals, ownership and work limits.
A private comparison is the next action, not permission to publish an unfinished signature.
No need to add arbitrary solid modeling, booleans, shaders or a scene framework.

## Evidence inspected

- `survey/out/2018/Generativos/numbers/notes.md` SHA256 `94398ace5397871e0c9665232bd360e518c03c9d21da64c6fe0f128c2ced6508`.
- `survey/out/2016/Generativos/textureGridText/notes.md` SHA256 `4bc549badde9c8b5e9efcbd4155f47bd8da3e420c06016942525b565759889ba`.
- `survey/out/2019/generativos/brotes/notes.md` SHA256 `9a6da7579ae5d3c9d4331181e2e71bd40ab6caa698844b7bc20028c7e8d8fd77`.
- `survey/out/2017/Generativos/triangularGradient/notes.md` SHA256 `a98eaf0e7d134069c543f85c5cb5caf2f22bb0b14246f6d305704b6c9db29dd2`.
- `survey/out/2017/Generativos/aros/notes.md` SHA256 `13aedb8ce1603129b8e07c1453f58dd7abc8f67a6bbc42e523fe6c4f4eaaa891`.
- `design/capabilities/disc-projection-admission.md` SHA256 `2ac415607d65a78c51d27390c6093840673acc76216448f7d69857c701c7cea2`.
- `design/capabilities/cp7-profile-neighbour-boundaries.md` SHA256 `f6eb63ff1028adf7bacea219958218ab1d4fb9367cbba47a08ba84ca6c63f7db`.
- External upstream `2017/Generativos/aros/aros.pde` SHA256 `32fd8bf347ccbf8297c48a1b15717997eeff96564e610d4f79856d24e11f28ff`; read-only provenance, no source copied.
