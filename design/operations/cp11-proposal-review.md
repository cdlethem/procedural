# CP11 proposal review

Root accepts the architectural proposal for catalog/fixture preparation with the exact
corrections below. This is not catalog freeze, implementation or runtime acceptance.
The candidate admission is design/capabilities/cp11-admission-review.md. Keep one operation.

- The configuration has five keys, not six: dimensions, starts, maxSteps, maxCells, random.
- Accept static potential-output admission: starts.length*(maxSteps+1) <= maxCells.
  This is intentionally conservative even if occupancy would shorten actual paths.
  It is a caller resource ceiling, not an artistic control or actual-cell guarantee.
- The inherited357913941 limit belongs to CP10's six-scalar state and is inappropriate
  here. Use maxCells0..1073741823, supporting two packed integer coordinates per cell
  within signed32 indexing. maxSteps0..1073741822; starts.length0..1073741823.
  Calculate the potential product with exact checked wide integer arithmetic. No dense
  allocation by dimensions and no allocation of maxCells just because it is permitted.
  The ceiling is representational; host allocation failures remain host failures.
- Use the existing xoshiro128**1.1/SplitMix64 specification exactly, citing the established
  contract rather than paraphrasing missing constants. Mapping is floor(uint32*count/2^32)
  for count1..4, one word per successful choice even with one option. Describe this
  exact discrete mapping; do not promise mathematically equal probabilities when the
  available count does not divide2^32. No random word for blocked or occupied starts.
- randomState() returns a detached long[4] with each value0..4294967295, not signed int[4].
  Canonical output uses four unsigned JSON integers. Seed and supplied-state carriers
  are mutually exclusive and exact as proposed.
- cellAt returns int[2]; cellInto takes int[]. Provide only Object/Object and long/long
  path/cell overloads; mixed Java arguments can use Object/Object. Validate path numeric
  domain, then path range, then cell numeric domain, then cell range, then destination.
  Empty occupied-start paths have no valid cell index. Into failures leave all slots intact.
- All native indices follow the existing safe nonnegative integer convention. pathCount
  and pathLengthAt return int. completionReasonAt returns String. One public nested
  LatticeException extends IllegalArgumentException with final String code for the listed
  errors; ordinary host resource failures are not translated.
- Complete static validation precedes budget comparison; all invalid config fields win
  over potential-count WORK_LIMIT_EXCEEDED. No output or caller mutation on failure.
  Fix the exact static field order in the catalog; do not leave it to implementations.

Seven scenario families are a scope guide, not literally seven JSON cases: malformed
input, zero/empty, reason precedence, multi-path occupancy and seed/state continuation
must each be distinguishable where required. Reuse existing RNG oracle/constants and
native runner conventions. Root will check the resulting shared vectors before code;
no new rendering or general-purpose validation framework is requested.
