# Field displacement contract review

Root review, 2026-09-17, accepted before implementation. Prerequisite cluster check passed;
that structural result is separate from this semantic decision.

Root inspected the candidate/parent notes and actual source of burbujas_ani and cirnoi.
The first mutates x before querying y and recentres both samples; the second uses a separate
absolute value-noise fBm generator. Neither whole helper is admitted as equivalent. Supplied
sample pairs allow existing portable samplers, repeated axis passes and future field results
to compose without callbacks, hidden state or another noise implementation. The bulk affine
and polar conversion is a useful convenience with reusable offsets as well as points.

Independent Terra challenge accepted this boundary and found signed-zero offset ambiguity.
Resolved once: canonicalize dx/dy zeros before output and point addition. Added nonzero,
negative and huge-angle Java StrictMath goldens, both-channel affine/negative-distance case,
and a late malformed sample before insufficient work. No tolerance inflation: fixed absolute
1e-12 for floating output, exact order/shape/error codes. Existing fdlibm trig defines runtime
semantics, not the fixture tolerance. Static validation, budget, mapped channels, trigonometry,
then output addition have a single explicit order. No short circuit for zero gain.

No recommended ranges or defaults are established. The component-level native study is
preregistered before rendering and cannot earn an original-scene recreation count. Target
implementation, native edits and withheld transfer remain to be checked.
