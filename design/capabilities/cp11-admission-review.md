# CP11 admission: occupied lattice paths

Root admits `path.occupied-lattice-paths-2d` as one operation candidate for contract
preparation. The accepted architectural direction is cp11-lattice-decision.md;
this admission does not approve implementation, exact signatures or target support.

Motivating candidate: `2019/generativos/tata#0`, note SHA256
`66d58d804843d0aeda177cc6f32405078e4bcb7ab8f5812424f47c9dabb795a2`, candidate
evidence SHA256 `45447ac269b308ceba89d8b6e21066f75169ae05c4b8311c63172300471d571b`.
Root read the note and source loop; the concise evidence brief records the pinned PDE.
The reusable computation is cardinal path generation with arrangement-wide occupied
cells. This is component extraction and independently specified policy, not equivalence
to every behaviour of the source helper.

The source's four-proposal rounds, omitted/unreserved start, random start/length choice
and scene-shared random stream are explicitly left out. Complete reserved starts and
selection among genuinely available neighbours replace the first two policies for a
clearer path and termination model. Input ordering and explicit starts replace scene
layout policy. The portable RNG is contract work using existing project primitives.
These changes are disclosed design divergences; source random streams and pixels will
not match. Measured source count/length changes establish that these are consequential
controls, but establish neither public defaults nor recommended ranges for the new model.

The output must make a complete editable composition easier: retain paths once, change
stroke/colour without regeneration, and transfer the occupied vertices into marks.
That shared occupancy bookkeeping is absent from RegularGrid and GradientPath2D.
Rendering the source shadows, highlights, endpoints, rings and cell backgrounds remains
ordinary example code. No additional decoration operation is admitted by this decision.

`2019/generativos/guagua#1` remains deferred in the lattice family. Its unrestricted,
revisiting pre-move sequence has no equivalent shared occupancy rule. Tata's style
candidate and guagua's grid candidate also remain unchanged. Rare lattice techniques
are being covered deliberately; this one candidate does not certify the whole family.

The ledger changes only tata#0's authored disposition and cluster, preserving its
identity, original text, hashes and prior audit. One keep replaces one review_required;
no bulk disposition pass. Exact schemas, numerical/work limits and native accessors
must be reviewed before catalog freeze. Use a small distinguishing fixture set and the
existing Java/native workflow rather than new validation infrastructure.
