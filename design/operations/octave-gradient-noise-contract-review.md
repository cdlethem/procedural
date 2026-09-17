# Octave gradient noise contract review

Root review, 2026-09-17; contract accepted before implementation. Prerequisite cluster
check passed, separate from this semantic acceptance. The source evidence motivates an
additive octave dependency; neither composite candidate nor Processing noise is claimed
identical to this independent accumulation of our existing gradient profiles.

Independent Terra review found no semantic blocker and requested stronger ordering and
domain vectors. Added before freeze: an eight-octave raw sum whose reversed order differs
by .0625; a large-coordinate vector where evolving coordinates instead of frequency changes
the output by about5.9e-6; frequency underflow, lower-domain failure and3D z-domain failure.
All exceed or distinguish the unchanged1e-12 absolute/zero-relative fixture policy.
Expected outputs use existing independent Fraction-rounded noise oracles and Fraction
arithmetic for progression/accumulation/division, with no JavaScript implementation imported.

Root accepts one fixed seed across octaves, a precomputed finite schedule, no unused final
advance, full validation then exact schedule+query budget, schedule errors before query
errors, all axes checked before sampling, and zero-weight samples still evaluated. Positive
initial amplitude for WEIGHT_SUM prevents a zero denominator even if later weights underflow.
Empty query lists still charge and evaluate the schedule. Ownership and domain boundaries
are explicit; no field callbacks or ambient RNG/noise enters the API.

No recommended parameter ranges/defaults. Native component study, transfer and target
acceptance remain separate downstream checks; no whole-original reproduction promised.
