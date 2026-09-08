# Sol review: CP3 private placement experiment

Status: accepted visual evidence for the bounded private experiment. This review does
not admit an operation, freeze a signature, approve a default or continuous range, claim
source reproduction, or establish target support.

## Evidence inspected

I inspected each original 640×640 PNG produced by the five registered attempts:

| case | PNG SHA-256 | accepted circles | visual finding |
|---|---|---:|---|
| `base-rings` | `d9b3cbaf32ba3f817582e0ded52aa3afe0a150e3147a403c542fe471d2d59485` | 424 | The small-biased proposal rule produces a legible field with many small rings and enough large rings to anchor the composition. The centre rectangle is visible as a square placement region with an outer margin. |
| `more-separation` | `7e9c3c50f411959f46929c1f8c0f41308407d9b76394af9e9d88660a62860d24` | 353 | The same proposals at scale 1.2 leave visibly wider spaces around rings. Several large anchors remain recognizable while crowded small-ring groups open up. The edit reads as size-relative clearance, rather than a fixed pixel gap. |
| `smaller-forms` | `57f0bd6ad8a2f95a62abb1efdd5a0f9920847726c0ae593b7f0365eb38240ee4` | 613 | Reducing maximum radius from 64 to 32 removes the dominant large anchors and produces a denser, more even fine-ring field. This is a clear size-structure edit, with more accepted placements as an outcome rather than a promised count. |
| `diamonds` | `114a41e1f1b35130bf7e42d67a429130a932821c4d221a1bea68668c2f81f809` | 424 | The exact baseline centres, radii, source indices and colours form an equally legible angular composition when rings are replaced by inscribed diamonds. Large and small landmarks align with the baseline, so the motif substitution is easy to verify visually. |
| `authored-radial` | `cf4eb5a28f8ab00237bce0a8bf1881da6963575dc9d8e3f41f8e0d57a7d5b62e` | 111 | The authored proposals create readable concentric bands with an empty centre and irregular openings caused by ordered rejection. It is visibly distinct from the rectangular seeded field and demonstrates a useful proposal-source substitution. It is not evidence for a public radial generator or for `studio` source equivalence. |

The bound result is
[`result.json`](../../evidence/parameter-experiments/cp3-placement/result.json), SHA-256
`d5f729b829b44e62b5b104141520562c7ce442deb25a4953d991565e755b1b7e`.
It records Processing 4.5.6 JAVA2D with core SHA-256
`88b18be731790abbb539a6b0b7d77a1d69472628cef957ade26735d1d780acb4`.
The registered plan SHA-256 is
`5f0315e5d52a4e963833776afa34dc4334f9fae1fcf246b7640ef22ed699e6e6`;
the Java prototype SHA-256 is
`6456603fdc26daa438ad9f4a319ca02621b79d2391e7cfcf3bf8d010b16e644c`.

All attempts report opaque images of the registered dimensions and background. The
parameter comparisons changed 23,082 pixels for scale 1.2 and 69,170 pixels for maximum
radius 32. These measurements establish change only; the findings above come from direct
inspection. The independent numeric evidence establishes proposal identity, accepted
topology, prefix behavior and unchanged geometry more precisely than visual alignment can.

## Decision against the registered criteria

The experiment earns continued contract work on the two-level boundary. The seeded
centre-rectangle route removes deterministic proposal generation, ordered collision
search and bounded-work accounting. The explicit ordered-circle filter is justified by
the radial transfer. Both routes use the reviewed acceptance kernel, while retained
circle values and original proposal indices let drawing code change motif and colour
without carrying style payloads through placement.

`separationScale` is worth retaining as an explicit contract question. Scale 1.2 has an
understandable visual effect against the exact scale-1 proposal stream. This experiment
does not visually approve 0.96, select a default, or establish a recommended interval.

Maximum radius is also worth retaining as an explicit proposal-distribution control.
The 64-to-32 edit strongly changes the size hierarchy. Those two prototype values do not
establish a range, and the result does not isolate minimum radius: it remains fixed at the
package-designed value 4 in every seeded image.

The motif and proposal substitutions pass. The numeric evidence proves that baseline and
diamond geometry and source-index colours are identical; the images show that the same
placement supports recognizably different mark construction. The radial case shows that
authored proposal order can replace the seeded rectangle without copying the collision
rule into drawing code.

## Limits carried into contract work

- The five images use one seed, one centre rectangle, one renderer and one density. Seed
  and rectangle remain deterministic geometry inputs, without an approved artistic range.
- Minimum radius 4 is a private prototype setting. Its independent visual effect and a
  useful public floor were not tested here.
- Attempts 5,000 were fixed in every image. The 10,000-attempt prefix is numerically
  verified, but this experiment does not show whether the additional accepted circles
  make the promised “continue filling gaps” edit visually useful.
- The 200,000-attempt run is a bounded timing observation, not a public ceiling or a
  visual density recommendation.
- The squared binary64 acceptance rule is a package design. It is not bit-identical to
  the source sketches' Processing `dist()` calls, and no source-pixel reproduction follows.
- Circle containment, invalid and degenerate inputs, result carriers, resource failure,
  exact public names and four-target conformance remain contract and implementation work.

