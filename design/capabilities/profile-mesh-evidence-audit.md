# Profile / tube mesh evidence audit

This is an evidence retrieval note for CP7 boundary selection. It does not admit an
operation, choose a public signature, prescribe defaults, or establish renderer support.
The current ledger has a provisional `mesh.revolve` cluster for the first three records;
the fourth is still deferred. The source corpus remains upstream MIT-licensed
provenance. No source implementation is copied here.

## Evidence identity

The source inspection uses the pinned upstream checkout
`.work/investigations/cp3-source/repo` at
`69bdd8513e4482a5e6018e36887d4bc208660eb5`. The `git show` byte hashes below are
for that exact revision and path. “Survey source hash” is the existing ledger binding,
not a substitute for the pinned upstream blob.

| record / ledger state | surveyed note SHA-256 | survey source SHA-256 | pinned upstream PDE / SHA-256 |
| --- | --- | --- | --- |
| `2017/Generativos/cilindros#1` (`cylinderMesh`, provisional keep, `mesh.revolve`) | `ebd2bd7956c44c5d2f9db05e7dd9a610526143e3035ef1e630c1970f6f6b2fb2` | `ebd2bd7956c44c5d2f9db05e7dd9a610526143e3035ef1e630c1970f6f6b2fb2` | `2017/Generativos/cilindros/cilindros.pde` / `801beeac6b92fefbb9e0f4e9f8cd0bf3aeb5bba72a368879063d228a967be7ba` |
| `2015/Generativos/FFt/prueba4#0` (`tubeQuadMesh`, provisional merge, `mesh.revolve`) | `96655622169acc6f62bb1bbba7a359d15fca487ec48178872f3348259d7738fb` | `96655622169acc6f62bb1bbba7a359d15fca487ec48178872f3348259d7738fb` | `2015/Generativos/FFt/prueba4/prueba4.pde` / `8f90117ae1dbd46b5e00e067b850d679e362a365691aae124bfd625d6c4a0808` |
| `2017/Generativos/fieeee#1` (`colum`, provisional merge, `mesh.revolve`) | `5f193535ab67b1c5f8361845ccbde8bb444bd6e0b4043a1f923babd545d5be04` | `5f193535ab67b1c5f8361845ccbde8bb444bd6e0b4043a1f923babd545d5be04` | `2017/Generativos/fieeee/fieeee.pde` / `2a70246f66731b3776c7cff2e07e8ae1bdb41bca6bc71312332772fda3ef39bc` |
| `2015/Generativos/cityPink3d#0` (`prismTower`, reviewed defer) | `9961e1604c367d4f621a74a8302fed188d23f52e79d1164f58e1dad8c54d4533` | `9961e1604c367d4f621a74a8302fed188d23f52e79d1164f58e1dad8c54d4533` | `2015/Generativos/cityPink3d/cityPink3d.pde` / `69265e2cb42bb5f852a603c82d9e0ad7b8aa912d4713a778a6ac3366f2b0f636` |

The candidate identities and their current dispositions come from
`design/phase2/cluster-decisions.json`; no disposition is changed here.

## `cilindros`: circular side bands plus two polygon caps

The motivating P3D source calls `cilindro(s, s*8)` after choosing a scene position,
three rotations, and a palette fill (upstream lines 39–53). `cilindro(d,h)` derives a
single constant radius `d*0.5`, fixes `res1=128` around and `res2=32` along (57–65),
and samples two axial levels and two successive angles for each `(j,i)` patch
(67–84). Its geometry is an axis-aligned circular side surface; the source has no
arbitrary profile input. It then makes one closed ring polygon at each axial endpoint
(87–100). It supplies no explicit normal vectors.

The surface cells are not submitted as one `QUADS` batch: each four-vertex patch begins
and ends an untyped Processing shape (73–84). Two wave/palette values are assigned
between vertices at the lower and upper axial levels (74–83); this is renderer-specific
vertex/patch colour behavior, rather than evidence for a portable `colorFn` mesh field.
The note’s candidate calls it “per-quad colour function,” but the source uses private
random wave/frequency/drift state, an upstream palette helper, and fill calls during
shape submission. Those are separate from side topology.

Measured substitutions do not test ring/stack resolution, cap mode, seam identity,
winding, or normals. They test whole-scene count 20→8/40 (moderate; changed fraction
0.179/0.340), size multiplier 1.6→3.0 (large; 0.437), depth distribution (moderate;
0.232), and zeroed palette drift (moderate; 0.322). The latter removes observed colour
bands but leaves geometry unchanged by construction. The camera, random scatter,
8:1 aspect, rotations, lights, palette, and Processing fill behavior are scene or
renderer dependencies, as the note itself separates in its modularisation section.

## Nearby `tubeQuadMesh`: open, overlapping axial patches

`2015/Generativos/FFt/prueba4#0` is the closest independently named tube record. It is
P3D and emits `beginShape(QUADS)` once per frame (source lines 23–40). The cross-section
is circular in YZ at `i*da+ang`; there are 10 angular slices in the sampled setup and
no end caps or explicit normals. A camera translate, fixed X tilt, and frame-driven Z
spin surround the mesh (23–27); Minim/FFT setup is never consumed by the draw path.

A source correction matters for a potential profile abstraction. The outer `j=0..4`
loop does **not** connect five contiguous axial rings. Each patch spans
`[-length/2 + length*j/5, +length/2 + length*j/5]` (34–37), so each successive group is
a full-length side strip translated by `length/5` and overlaps its predecessor. The
note accurately identifies circular cross-sections and quads, but its “layers along the
length” wording should not be treated as evidence of a conventional contiguous ring
mesh or a profile sampler.

Its existing variants measured length 100→300 as large (mean 0.197, changed fraction
0.228), while angular division 10→4 and angular offset `1.5π`→0 both recorded `none`
(0.010 and 0.008 changed fractions). The results are frame/render dependent because
this sketch spins. There is no measured cap, normal, seam, or axial-layer test. Default
stroke/fill, near-black background, perspective placement, spin, and inactive audio are
outside topology.

## Nearby `colum`: a cosine-derived ring radius, with target ambiguity

`2017/Generativos/fieeee#1` constructs `res*2` axial intervals and `res` angular cells
(lines 120–153). For each axial pair it derives `r1/r2` from an absolute cosine mapped
between `s1` and `s2` (124–127), then emits four vertices between corresponding circular
rings (131–151). This is the strongest evidence here for a supplied sequence/function of
ring radii being separable from the ring-connection computation. It emits no caps and
no explicit normals. The cosine law is a caller-side profile choice, not evidence that a
revolved mesh must offer a cosine option.

The survey note says this “3-D tube” is invoked inside an offscreen 2-D `PGraphics` pass
and therefore flattened. The pinned source makes that claim uncertain: it calls
`texture.beginDraw()` and uses `texture` for background cells, but calls unqualified
`noStroke`, `pushMatrix`, `translate`, `colum`, and `beginShape` for the tube (50–88,
120–153). The source alone does not establish which Processing graphics target receives
those unqualified vertices. It therefore cannot establish 2-D flattening semantics,
P3D normal behavior, or a renderer-independent mesh result without runtime evidence.

Resolution 80→24 and waist random factor→0.5 each produced large image changes
(changed fractions 0.812 and 0.867), but both results are confounded by the offscreen
cell texture, per-cell random colour, ellipses, two rotated image planes, camera FOV/yaw,
and the target ambiguity. They show the motif is visually sensitive in this composition;
they do not validate a portable resolution or waist range.

## Nearby deferred `prismTower`: discrete stacked bands, not a lathe surface

`2015/Generativos/cityPink3d#0` remains `reviewed_defer`, rather than evidence that
all radial-profile objects share one operation. Each random tower uses a polygonal
cross-section with 3–9 sides and loops over `ch` layers (85–124). It alternates a radius
at each `j` based on parity and emits vertical quads whose four vertices all use that
same layer radius (101–121). Thus the source does not emit the sloped connector from one
radius to the next that the note’s “chevron profile” phrasing might suggest; adjacent
bands meet at a height with different radii. It also emits no caps or explicit normals.

The tower’s radius/height/sides/layer count are jointly randomized, placed in a large
random volume, viewed through a randomized camera, mixed with a noise terrain,
depth-disabled lines, translucent planes, and a shader. The measured tower-height
substitution is moderate; tower-count is subtle. These are scene observations, not
isolated topology evidence. This record is useful as a boundary: an n-gon stepped-band
builder may later compose with a profile/ring primitive, but source evidence does not
show that it is the same surface semantics.

## Boundary facts for the next review

There is repeated evidence for circular or polygonal cross-sections connected by ordered
quad patches, and `colum` supplies a nonconstant radius sequence. There is **not** yet a
common observed contract for:

- an arbitrary 2-D profile, axis choice, seam duplication versus wrapped indices, or
  whether rings are contiguous;
- cap topology/winding, normal generation, vertex sharing, UVs, or per-face/vertex colour
  ownership;
- renderer-neutral behavior. `cilindros` depends on P3D lights and fill submission;
  `fieeee` has unresolved graphics-target semantics; `prueba4` is animated; and the
  deferred tower is embedded in a shader-heavy scene;
- measured useful mesh-resolution, profile, cap, or normal parameter bounds. Existing
  image changes mostly alter composition, style, or an inseparable whole texture.

The CP7 decision should therefore distinguish a raw mesh/topology generator from any
P3D rendering adapter and from scene placement, palette, camera, lighting, or animation.
