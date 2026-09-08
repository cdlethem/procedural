# Root numeric decision for seeded line-pool growth

The operation requires reproducible binary64 elementary math: sin, cos and atan2 with
fdlibm5.3 IEEE-core semantics under Java floating-point rules, plus correctly rounded sqrt.
Basic arithmetic uses IEEE754 binary64 round-to-nearest ties-to-even, separate multiply/add,
no fused contraction or reassociation. This is one language-neutral algorithm requirement,
not permission for each host's ordinary math implementation. Java uses StrictMath.

Root verified the installed JDK17 source at java.base/java/lang/StrictMath.java in
.work/toolchains/jdk-17.0.20.1+1/lib/src.zip: the class specification explicitly requires
fdlibm5.3 semantics for sin/cos/atan2. No OpenJDK implementation is copied into the package.
The eventual contract must pin this algorithm and include exact mathematical-result bit
vectors. Other targets remain deferred until they supply equivalent elementary math and
pass exact topology, RNG and coordinate vectors. Do not claim support based on ordinary
JavaScript Math or Python math similarity. The porting cost is real and remains in I2.

## Why this choice

A length test reads coordinates produced by earlier trig. Different last bits can alter a
skip, consume a different RNG suffix and change later topology. Coordinate tolerances cannot
repair this. Nominal cached lengths, epsilon comparisons and rounded cut decisions would
change the admitted mutable-geometry computation. A reproducible math requirement preserves
that computation while using the maintainer-authorized Java-first delivery path.

Source Processing float/Random results still differ from the proposed binary64/xoshiro
operation. This is already declared; portable-operation renders must establish usefulness
again. The private Processing prototype remains reference evidence for mechanism and controls,
not exact public-operation goldens.

## Frozen arithmetic/error order for contract authoring

Input validation completes before generation. At each attempt draw selection words and
compute valid index; subtract dx,dy; check each finite in x then y order; compute dx*dx,
dy*dy and their sum, checking each finite in order; sqrt; atan2(dy,dx). If length is below
minimum, increment skip and consume no further words. Signed zeros follow IEEE operations;
normalize zeros only on exported coordinate fields, not while calculating atan2.

For successful selection, sample source policy scalars in draft order. Check each range's
subtract, multiply, add for finiteness, then derived angle and length arithmetic. Determine
actual append count. If currentSize+appendCount>maxSegments fail SEGMENT_LIMIT_EXCEEDED
before computing child trig/endpoints. Parent cut coordinates are computed next, then
only appended child coordinates in append order. Parent mutation and append commit occur
only after all coordinates are finite. ARITHMETIC_OVERFLOW reports attempt and named stage;
no partial result. RNG state is private and discarded on failure. The contract must enumerate
stage names and cover conflicting-error precedence in fixtures.

Storage: four packed binary64 coordinates per segment and one divided flag. Set maxSegments
representation domain1..536870911 so4*N fits signed-int array indexing; this is a representation
bound, not a promise that allocating that many entries is feasible. Grow storage as needed,
never preallocate the cap. Host allocation failure remains a host resource error, never a
partial successful result. User cap governs actual retained output, not speculative children.
Attempt count0..2147483647 is a work bound, not density or a recommended runtime budget.

Next: materialize the catalog contract and small independent fixture oracle against these
rules, then review before production implementation. Required second-stroke/seed transfer
and30-pool workload remain outstanding. No public operation is implemented by this decision.
