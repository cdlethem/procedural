# Root CP4 contract review

Status: accepted and frozen for Java implementation. Root ran the final catalog check
and all108 unit tests successfully; the shared fixture contains34 cases.
This is root's direct review during the maintainer's pause on Sol assignments.

The admitted boundary remains one eager seeded region generator. Root read the draft,
independent reference implementation and its initial33 cases. Requested corrections are:

- Remove an unsolicited serialize/config-replay API and input retention. Keep only detached
  geometry/identity export; callers retain the original configuration.
- Replace the false linear-work claim with quadratic worst-case movement for flat ordered
  storage, while permitting an output-preserving rank-indexed optimization later.
- Define every native accessor, destination return convention and validation error carrier.
- Keep root representability static (INVALID_RECTANGLE), with no dynamic index sentinel.
  A positive root is valid at zero replacements even when it cannot be split.
- Define separately rounded subtraction, halving and addition for each midpoint. Check x
  before y; no partial success or skipped leaf after an unrepresentable split.
- Creation IDs are monotonic births. Appending and removing preserves strict ID order in
  the live list; sorting by creation ID is therefore equivalent, not a wrong algorithm.
- Longer successful runs share earlier replacement history, but their *final leaves* are
  not a prefix or a superset. Do not inherit the circle-placement continuation guarantee.
- Do not reject large valid rectangles because width×height overflows: area is not consumed.

The independent fixture reference uses endpoint storage and the specified one-unit seeded
selection. It agrees with the existing independent five-seed stream evidence. Its odd-list
case actually selects the fractional final interval, unlike flooring the eligible count.
Root supplied concrete one-ULP and subnormal cases, a finite midpoint where naive endpoint
addition overflows, and a non-overflowing reassociation case that differs by one binary64
value. These distinguish plausible incorrect implementations rather than mirroring only
ordinary examples.

The fixture generator must support the reviewed status after freeze, assert its midpoint
adversary metadata, and keep active JavaScript proxies/hooks outside the passive input
contract. It must not promise universal proxy detection. Resource-exhaustion proof may be
source inspection with an explicit unexecuted-test marker; no forced-exhaustion claim may
be inferred from ordinary successful allocations.

The catalog checker previously skipped output validation for an unknown fixture format.
The new partition-output branch must validate exact finite/canonical output, bounds/ID
alignment and count, generator/source bindings, and dynamic error detail. Tests must also
reject unknown formats. This is metadata/fixture validation, not execution of public Java.

After these corrections pass, freeze the single catalog entry and shared fixtures, then
implement the Java core under `quadrant-partition-implementation-brief.md`. The private
JavaRandom images remain useful technique evidence, but the actual xoshiro-backed native
RegionMarks example still requires a registered run and visual review before delivery.

## Frozen inputs

- `catalog/operations/seeded-quadrant-partition.json` SHA-256 `effcfead03c5de7cb92bc7430dbee965cf6368baaea43743b429659e36c8ffe1`
- `fixtures/operations/seeded-quadrant-partition.json` SHA-256 `bb1b6a2cadc0f276cd227706da9c27459f00d1811cbc0ee18faea37941744683`
- `tools/generate_quadrant_partition_fixtures.py` SHA-256 `15b80b0696a1d184ac091cecb6032da5b9b2ff7cccaa36ecfac6441f15004e41`

The reviewed-status transition changes no numeric behavior. The fixture was regenerated
against that final contract; public Java and native workflow acceptance remain separate.
