# CP3 pinned-source audit: sequential circle proposals

This audit retrieves source only for the three candidates selected in the CP3
investigation. It does not admit a cluster, select an API, merge algorithms, approve a
range, or reproduce a render.

## Pinned acquisition and provenance

The source was fetched read-only from
[`manoloide/AllSketchs`](https://github.com/manoloide/AllSketchs) at
[`69bdd8513e4482a5e6018e36887d4bc208660eb5`](https://github.com/manoloide/AllSketchs/tree/69bdd8513e4482a5e6018e36887d4bc208660eb5),
the revision recorded in `survey/snapshot.json`. The ignored acquisition directory
`.work/investigations/cp3-source/` contains the commit identifier, selected-path list,
MIT notice, and SHA-256 manifest. It contains no package source.

| candidate | pinned source | SHA-256 |
|---|---|---|
| `2018/Generativos/caramelo#0` | [`caramelo.pde`](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/caramelo/caramelo.pde) | `6f8accc753db0cf0dc1e8ceee642df745f408e23f917fe7ecd0ca80c26d8bd62` |
| `2018/Generativos/candy#0` | [`candy.pde`](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde) | `e4791246c1b25bc4e3c647e0ce9e3da178de53b1e0d5a34523a0769131001883` |
| `2017/Generativos/studio#0` | [`studio.pde`](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/studio/studio.pde) | `0ed93fd157ec966dabc19ce358179f9a6f9e0bb30e61f69d2d90121a290a7f0b` |

Only those main tabs appear in the pinned tree for these sketches; their checked-in
baseline records also list only those tabs. The fetched root
[`LICENSE`](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/LICENSE)
is MIT, SHA-256 `98abe149fa5183cb8edbcaac0a4bc3a7d01218f63e4fee5d779c05ecbb119dc4`.

The Phase 2 records named `source_sha256` do **not** match these PDE hashes. For all
three candidates they exactly match the checked-in `notes.md` hash instead: caramelo
`204b387d…`, candy `8d08f3cd…`, studio `9bde5b78…`. They therefore bind the survey
report text, not this upstream source retrieval. This audit supplies the missing raw
source provenance; it does not reinterpret the older field.

## Units and equality

None of the three source files calls `ellipseMode`. Processing's default is `CENTER`,
where the last two `ellipse()` arguments are width and height, while `RADIUS` would make
them half-width and half-height ([Processing reference](https://processing.org/reference/ellipseMode_)).
Thus every stored packing `s` examined here is diameter-valued, not radius-valued.

| sketch | source evidence | consequence |
|---|---|---|
| caramelo | candidate `s` is stored at [L44–59](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/caramelo/caramelo.pde#L44-L59) and drawn as `ellipse(..., s, s)` at [L76–85](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/caramelo/caramelo.pde#L76-L85). | `(p.z+s)*0.5` at [L50–55](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/caramelo/caramelo.pde#L50-L55) is the sum of radii. |
| candy | `s` is proposed at [L30–42](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde#L30-L42) and drawn twice with `ellipse(..., s, s)` at [L58–63](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde#L58-L63). | The `0.48` multiplier yields `0.96 × (r₁+r₂)`, so it deliberately permits a small geometric overlap rather than exact non-overlap. |
| studio | `s` is stored at [L67–84](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/studio/studio.pde#L67-L84); the active ring is passed to `arc(..., s, s)` through [`colorCircle`, L199–216](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/studio/studio.pde#L199-L216). | Its `0.5 × (s+p.z)` rejection threshold at [L75–81](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/studio/studio.pde#L75-L81) is exact summed-radius separation. |

All three reject only when `dist < threshold`; equality is accepted. Caramelo and
studio therefore admit tangent diameter circles; candy admits equality at its smaller
`0.96 ×` summed-radius threshold. These source-specific rules cannot be collapsed into
one unexplained `gapFactor`.

## Proposal order, domain, and random consumption

Each loop visits proposals in order, compares against the accepted prefix in that same
order, stops the inner scan at the first collision, and appends only after a successful
scan. No loop sorts, retries a rejected candidate, or promises an accepted count.

- **caramelo outer loop.** It draws `x`, `y`, then two factors for diameter `s`, in that
  order, for 10,000 attempts ([L44–59](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/caramelo/caramelo.pde#L44-L59)). Centres are uniform over the canvas and no circle-containment test occurs, so accepted circles may cross its edge. `randomSeed(seed)` is called before a 10,000-item dust loop ([L21–38](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/caramelo/caramelo.pde#L21-L38)); that prelude consumes the stream before packing. The nested loop has 1,000 attempts and draws angle, diameter, and two radial factors before its prefix test ([L87–105](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/caramelo/caramelo.pde#L87-L105)). Its radial candidate domain is distinct from the outer rectangle. From its expressions, the proposed nested diameter is below `0.2p.z` and its centre offset is below `0.3(p.z-s)`; this implies the candidate disc stays inside its parent disc, but that is an inference from these constants, not a reusable containment policy.

- **candy.** It consumes background and foreground colour draws before packing, with a
  variable number of foreground redraws ([L22–29](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde#L22-L29)). Each of its 200,000 proposals then draws canvas-wide `x`, canvas-wide `y`, and two diameter factors before the prefix scan ([L30–42](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde#L30-L42)). There is no edge containment. Per-disc rendering randomness follows the completed packing loop, so it cannot alter the already accepted proposal sequence, although the unused `det = random(100)` still consumes a draw ([L45–57](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde#L45-L57)). The source declares and changes `seed` but never calls `randomSeed`; this conflicts with treating the source alone as a seed-replay specification ([L1](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde#L1), [L14–20](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde#L14-L20)).

- **studio.** `generate()` first replaces `seed` with a random value, then `render()`
  seeds Processing's `noise` and `random` generators ([L26–36](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/studio/studio.pde#L26-L36)). The attempt count itself consumes two random draws, then every proposal consumes diameter, radial distance, and angle before the prefix test ([L65–84](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/studio/studio.pde#L65-L84)). Its centre is drawn in a size-dependent radial domain `d < cx*1.5-s`, not a rectangle. That bound does not impose canvas containment: at 960px, the permitted radial extent can exceed the 480px half-canvas. Styling randomness occurs after packing ([L98–112](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2017/Generativos/studio/studio.pde#L98-L112)).

## Discrepancies that block source-faithful reuse

The investigation and Sol review correctly separated proposal domain, size units,
clearance and seeded stream semantics. Pinned source resolves the immediate ambiguity but
also shows why no candidate is yet a portable reference algorithm:

1. The reports call caramelo's packing value a radius, but its `ellipse(..., s, s)` calls
   and half-sum comparison establish a diameter. Candy and studio use the same units.
2. Caramelo and studio use tangency-permitting half-sum tests; candy uses a smaller
   multiplier. Their candidate domains are respectively rectangular, rectangular, and
   radial; only the nested caramelo loop has source-specific parent containment.
3. The random stream is not interchangeable: caramelo has dust before packing, candy has
   colour-dependent prelude draws and no `randomSeed`, and studio randomizes a seed before
   reseeding the packer. A portable seeded convenience must specify its own stream and
   consumption rather than inherit any one of these as corpus semantics.
4. Candy's speckle expression passes `random(PI)` to `acos` without a clamp
   ([L65–72](https://github.com/manoloide/AllSketchs/blob/69bdd8513e4482a5e6018e36887d4bc208660eb5/2018/Generativos/candy/candy.pde#L65-L72)). The report's rim-distribution explanation therefore is not a safe sampler specification; speckles remain outside this spacing investigation.

The evidence supports further contract work on *ordered, bounded, size-aware sequential
rejection* as a design question. It does not select containment, equality, clearance,
proposal distribution, a portable RNG, or a merged packing API. No useful parameter range
or source-pixel reproduction is claimed here.
