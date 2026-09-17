# Displace supplied points with a sampled two-channel field

Root capability decision, 2026-09-17. Second batch-1 capability, p5 first.

## Artist task and computation

Turn a retained grid, ring or strand into warped geometry; change displacement strength
without changing its sampling density, colours or connectivity. The operation owns ordered
pairing of samples with points, affine channel mapping, Cartesian or polar interpretation,
portable trigonometry, finite arithmetic and detached points/offsets. Sampling an existing
field with `points.map(...)`, making marks and retaining polyline boundaries are caller
composition. This is a cohesive conversion convenience, not a new noise algorithm.

## Evidence and limits

- `2017/Generativos/burbujas_ani#0`, [notes](../../survey/out/2017/Generativos/burbujas_ani/notes.md),
  SHA256 `17b1e0aa5dea249f361e0b07186813ed7cf6965c5263ede047a68ac7224cfe5d`.
  Root inspected source `des` lines103–106: x adds `noise(x*d,y*d,t)*s-s*.5`,
  **then y samples using the already changed x**, with x offset4535 and t+100.
  Notes omit both centering and this dependency. A single same-position channel pair
  is not equivalent; two ordered axis passes with resampling express it. Geometry,
  time and source Processing noise remain separate. Wobble1.2→3.0 was moderate;
  noise-detail .4→1.2 was subtle. These are no continuous recommended ranges.
- `2019/generativos/cirnoi#0`, [notes](../../survey/out/2019/generativos/cirnoi/notes.md),
  SHA256 `cf649dbb32de9ca203974b056402ffab757df56e55e1b9c725c03650c47f77a3`.
  Root inspected `dis` lines95–98: angle=sampleA*PI*4 and signed distance=sampleB*100;
  output adds cos(angle)*distance and sin(angle)*distance. The samples come from its
  four-octave absolute value-noise helper, which is **not** the forthcoming gradient
  accumulator. Warp100→300 was moderate; source noise remains a residual ingredient.
- `2018/Generativos/totop` parent note and exact `desform` source confirm signed simplex
  angle/distance channels. No normalized reusable candidate exists in this malformed
  report's parameter list; none is invented. Simplex is an excluded dependency.

The source checkout revision is `69bdd8513e4482a5e6018e36887d4bc208660eb5`.

## Boundary, alternative and reusable output

`field.displace-points-2d`, p5 `fieldDisplace2D({points,samples,mode,bias,gain,maxWork})`.
The two finite sample channels are already evaluated, one pair per point. Map each as
`bias[c] + gain[c]*sample[c]`. CARTESIAN interprets these as dx,dy; POLAR as angle in
radians and signed distance. Return detached `{points,offsets}` in original order.
Supplying equal channels expresses correlated displacements; zero gain isolates an axis.
Repeated calls with resampling express sequential deformations without hidden iteration.

Existing gradient noise supplies values; this conversion keeps that sampler replaceable by
another accepted field or caller data. `radial-pull-2d` uses centre/radius geometry, not
sampled channels; `gradient-path` integrates a trajectory rather than transforms supplied
vertices; RK4 consumes a vector grid and advances a path. None should be widened here.
No callbacks/renderer/field object cross the portable boundary. This adds one function,
not a family of field evaluators or a recipe executor. It does not implement raster warping,
3D/spherical displacement, attract/repel, source simplex/value noise, or a spline sampler.

## Controls, transfer and cost

Gain changes direction spread or distance independently. Bias recentres an unsigned field
or adds a fixed angular phase. Both may be finite signed values; these are mathematical
bounds, not artistic recommendations. No defaults or recommended intervals. Retain samples
to edit their interpretation; resample deliberately to change frequency or evaluation domain.
Reserve `2020/generative/01_04/telfi` for source/contract transfer after freeze.

Cost: explicit points, equally sized sample pairs, two interpretation modes and affine
mapping. O(N) validation/computation/output; one work event per point, no growing topology.
The reusable result can be drawn as strokes, fills or point marks. Test tiny,10k and100k
points with retained samples; field sampling cost is reported separately if measured.

## Acceptance and coverage

The step-0 baseline is459/800 plausible,366/800 operation-led; grain's narrow correction
is pending. Displacement's broad family has49 cases and28 sole gaps; that is an upper bound,
not projected credit for this API. Signed simplex, value-fBm, 3D geometry and query feedback
must retain independent residuals. Sampling supplied values is not proof a generator exists.

Freeze shared fixtures before implementation: mode distinction, negative samples/distance,
channel correspondence/order, bias and gains, zero-gain overflow order, empty input,
ownership, invalid samples before work, work before arithmetic, finite output. Native
`field-displacement` study uses portable gradient samples to deform retained grid lines
and circle rims, with a visible gain edit and drawing substitution. Preregister technique
component fidelity before rendering: it is a new composition motivated by the source
helpers, not an original-scene recreation. Compare its structure with source observations;
no whole-original demonstrated credit, and no automated original-image parity claim.

After validation: [core/native accepted](../../evidence/coverage/batch1/field-displace-2d/root-review.json).
The independent component study is rendered; withheld telfi is a partial source walkthrough
with a retained3D residual. Newly demonstrated originals:0. The
[affected-case review](../../evidence/coverage/batch1/coverage-review.json) closes seven
sampled-displacement components, leaving42 residual cases. Sequential updates require
explicit resampling between passes; a single frozen sample pair does not preserve them.
