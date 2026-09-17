# Radius query and pair-force step — root contract review

Root reviewed before implementation, 2026-09-17. Independent architecture challenge by
`neighbor_design_challenge` (GPT-6 Astra) read the actual proposed specifications. Root
retains admission and acceptance responsibility. The challenge is retained with batch evidence.

Resolved: use an x sweep, explicitly allowing quadratic vertical cases and orientation-dependent
work. Radius pairs are original-array indices, not persistent identities under topology edits.
The step uses supplied pairs, never silently recomputes neighbors. Current contact rendering
must requery updated positions (or label pre-step topology). Trail accumulation is not contact
persistence. Query overflow during an axis/hypot screen means outside; the same nonfinite
arithmetic in the force step is NUMERIC_OVERFLOW. Coincident force is zero. Unit mass,
linear zero-rest attraction and radial tapered repulsion are authored choices, not Reas physics.

Freeze normalization before multiplication: ux=dx/length, repulsiveX=strength*ux. Check each
primitive in the stated order. Damping zero stops movement; test the distinction from older
spring semantics. Units and per-call damping are explicit. Query/step empty and identity
cases still fully validate. Errors never publish partial output or mutate input.

Choose two operations, deferring contact-history to a future selected task. A fixed-edge
chain transfer will exercise graph substitution after freeze. No new source recreation claim.
Fixtures are analytical and independent of implementation; native acceptance remains pending.
