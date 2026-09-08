# CP7 flat-normal numeric witnesses

This is a private arithmetic investigation for the selected profile-mesh workflow. It
records finite binary64 inputs in [the generated observation](../../evidence/investigations/cp7-normal-numeric-cases.json), not a public contract or an implementation decision.

The ordinary method subtracts two edges, takes their component cross product, squares
those components, takes `sqrt`, and divides. The comparison first requires finite
subtracted edges, divides both edges by their largest absolute component, crosses those
scaled edges, and uses `hypot` before normalization. The latter can preserve a direction
when a direct cross or its squared norm overflows, but it cannot repair an overflowing
subtraction and it still rejects a zero scaled cross.

The witnesses separate several observable stages without an epsilon rule. `large-cross-overflow`
has finite `1e200` edges whose direct cross overflows. `norm-square-overflow` has a finite
near-`1e308` cross whose square sum overflows. Both retain a finite scaled direction in
the recorded host calculation. `edge-subtraction-overflow` fails before either normal
method can form a finite edge. `cross-underflow` and the all-subnormal triangle retain
finite vertices but collapse their direct products to zero; scaled components preserve
one direction for the `1e-200` case, while generated subnormal angular points can
coincide exactly, so a topology/area check remains separately necessary. The thin-height
and opposite-axial cases distinguish a nonzero tiny contribution from a subtraction that
overflows.

These results do not select whether a future contract uses direct intermediates,
component scaling, a specific rejection stage, or any range restriction. They merely show
that finite profile inputs alone do not guarantee a finite nonzero direct normal, and
that endpoint/profile validity and face-normal validity need distinct evidence-backed
rules.

## Revision: independent edge scaling and dumped moderate meshes

The v2 observation preserves the first report and compares one common edge-component
scale with independently scaling each edge, then scaling the cross by its largest
component before the ordered square-and-square-root normalization. The high-aspect
`1e200 X` versus `1e-200 Y` witness makes the common scale erase the small edge, while
independent scaling preserves a unit Z direction. A subnormal near-parallel cross also
shows why cross-component scaling avoids direct norm-square underflow. The deliberately
near-parallel `1e200,1e-200,0` versus `1e200,0,0` witness shows the remaining limit:
independently dividing the first edge loses its ratio-`1e-400` perpendicular component,
so its rounded cross is zero and is rejected.

The v2 report also reads the existing five Java mesh dumps. For those moderate triangles,
direct flat normalization and the per-edge variant had the reported maximum component
difference and finite minimum direct cross norm. That is same-input numerical evidence,
not a rendering result or a portability guarantee. Nonfinite edge subtraction and zero
rounded crosses remain explicit observed rejection conditions rather than repaired cases.
