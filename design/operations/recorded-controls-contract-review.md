# Recorded-control contract review

Root reviewed the Sol proposal and clarified the operation before implementation:
STEP holds the left sample on open intervals and is right-continuous at exact knots.
Before/after the supplied timeline, hold the endpoint without gap checking; strict
interior queries reject brackets wider than maxGap even for STEP. Exact knots bypass
interpolation but still execute every normalization/mapping primitive. Finite-check
subtractions before clamping, even when an endpoint could algebraically bypass them.
Static carrier/value validation precedes work budget, which precedes gap and arithmetic.
All channel and mapping records are validated even when their values will not be queried.
No public font wrapper is admitted. Recorded scalar reuse, not FFT or CV, is the scope.
Root-authored analytical fixtures are frozen before worker implementation. Target support
remains unvalidated; a passing fixture alone does not accept the type/audio workflow.
