# CP7 radial-profile fixture integration

## Root integration choice

The recommendation below is retained as design input. Root selected a smaller envelope:
`operation`, `version`, `fixture_format`, `fixture_status`, `catalog_sha256`,
`source_bindings`, and `cases`. Each successful case embeds `comparison.positions_abs`
and `comparison.normals_abs`; there is no second allowance artifact or allowance lookup.
The generator is `tools/build_profile_fixtures.py` and is a required source binding.
Native-only obligations remain in the catalog and review, avoiding mirrored handwritten
lists. Fixtures currently carry `review_pending` until integrated validation and root
review complete. These choices supersede the proposed envelope and separate allowance
file below. They preserve all per-component checks and raw catalog/source bindings.

The generator derives cases and intervals from source modules directly. Root added exact
oracle/interval topology and numeric-reference correspondence checks before calculating
allowances around the actual stored reference values. It does not consume `.work` case
or allowance JSON as an authoritative input.

This is a fixture-format recommendation for the draft
`mesh.radial-profile-surface-3d` operation. It does not freeze the operation,
publish a fixture, approve an implementation, or add P3D support. The catalog
record remains the authority for the operation's input/output schemas,
validation order, topology, normal calculation, native forms, and errors.

The recommendation follows the separation used by
[`tools/check_branch_fixtures.py`](../../tools/check_branch_fixtures.py): a
fixture checker verifies source binding, schema projection, structural output
invariants, declared comparison metadata, and cross-case references. It does
not reproduce profile meshing, normal calculation, or trigonometry.

## Current private inputs

The staging oracle currently has 24 successful meshes and 19 error witnesses
in `.work/cp7-contract/fixture-cases.json`. Successful coverage includes open,
start-, end-, and both-cap cylinders; waist and frustum profiles; every
endpoint-pole/cap-flag combination; open one-pole meshes; large, small, and
minimum-subnormal scales; integral float carriers and negative-zero input; and
exact face capacity. Its errors cover static profile/domain failures, capacity
preceding geometry, and the three registered dynamic stages (`edge`,
`edge_scale`, `cross_scale`).

`.work/cp7-contract/fixture-allowances.json` has one bounded allowance row per
successful case. The source-bound local enclosure exercise in
`.work/cp7-contract/enclosure-perturbations.json` records five endpoint
patterns for each of those 24 meshes, or 120 passed perturbation runs. These
are draft oracle observations, not portable conformance evidence. Their scope
and limits are stated in
[`cp7-profile-fixture-policy.md`](cp7-profile-fixture-policy.md) and
[`cp7-profile-tolerance-investigation.md`](cp7-profile-tolerance-investigation.md).

## Recommended shared envelope

A future `fixtures/operations/radial-profile-surface.json` should use exactly
this top-level shape:

```json
{
  "operation": "mesh.radial-profile-surface-3d",
  "version": "0.1.0",
  "fixture_format": "radial-profile-surface-output",
  "fixture_status": "generated shared-contract vectors; native implementation validation is separate",
  "catalog_sha256": "<sha256 of catalog/operations/radial-profile-surface.json>",
  "generator": {"path": "tools/generate_radial_profile_fixtures.py", "sha256": "<sha256>"},
  "source_bindings": {
    "design/operations/cp7-profile-fixture-policy.md": "<sha256>",
    "tools/diagnostics/cp7/profile_fixture_cases.py": "<sha256>",
    "tools/diagnostics/cp7/profile_intervals.py": "<sha256>",
    "tools/diagnostics/cp7/validate_profile_outputs.py": "<sha256>"
  },
  "allowance_binding": {
    "path": "fixtures/operations/radial-profile-surface-allowances.json",
    "sha256": "<sha256>",
    "policy": "two-adjacent-reference-trig-intervals-v1"
  },
  "cases": [],
  "cross_case_checks": [],
  "native_only_cases": [],
  "native_ownership_access_requirements": [],
  "limitations": []
}
```

All paths are repository-relative, must remain inside the repository, and their
SHA-256 values must match current bytes. `catalog_sha256` must match the raw
canonical catalog source, not a reserialized dictionary. This makes a fixture
stale when the operation changes, even if its JSON Schema happens to accept the
same cases. `generator` is deliberately distinct from `source_bindings` so the
checker can require exactly one reproducible fixture producer without treating
its implementation as an operation definition.

The allowance file is a separately hash-bound generated artifact. Its top
level should be:

```json
{
  "status": "generated bounded engineering allowances; native verification is separate",
  "source_bindings": {"...": "<sha256>"},
  "cases": [
    {
      "id": "same-id-as-success-case",
      "status": "bounded",
      "positions_abs": [[0.0, 0.0, 0.0]],
      "normals_abs": [[0.0, 0.0, 0.0]]
    }
  ],
  "limits": "per-case interval policy statement"
}
```

Every listed tolerance must be a finite, canonical, nonnegative binary64
number. An allowance of zero requires the reference bit exactly. The row shape
must align with the complete output before any component comparison; a zip over
shortened arrays is invalid. An inconclusive interval belongs outside the shared
success set until separately resolved, never as a guessed larger allowance.

## Case representation

Each fixture case has exactly `id`, `input`, and either a success payload or an
error payload. Inputs and errors use the catalog's published names; the fixture
must not add aliases or a second input schema.

For a successful case, retain the numeric oracle's explicit bit wrapper only
at trigonometric output scalars:

```json
{
  "id": "cylinder-open",
  "input": {"profile": [[0, 2], [3, 2]], "slices": 3,
            "capStart": false, "capEnd": false, "maxFaces": 1000},
  "output": {
    "positions": [[
      {"value": 2.0, "bits_hex": "4000000000000000"},
      {"value": 0.0, "bits_hex": "0000000000000000"},
      {"value": 0.0, "bits_hex": "0000000000000000"}
    ]],
    "triangles": [[0, 1, 4]],
    "normals": [[
      {"value": 0.5, "bits_hex": "3fe0000000000000"},
      {"value": 0.8660254037844385, "bits_hex": "3febb67ae8584ca9"},
      {"value": 0.0, "bits_hex": "0000000000000000"}
    ]],
    "faceKinds": ["side"], "bands": [0], "cells": [0]
  },
  "comparison": {
    "mode": "per-component-absolute",
    "positions_abs": [[0.0, 3.3306690738754696e-16, 0.0]],
    "normals_abs": [[3.3306690738754696e-15, 5.662137425588298e-15, 1.8268145520643943e-15]],
    "allowance_case": "cylinder-open"
  }
}
```

A checker should unwrap each `{value,bits_hex}` scalar into its `value` solely
for `Draft202012Validator(op["output_schema"])`. It must then require a
lower-case 16-hex `bits_hex`, finite canonical `value`, and exact IEEE-754
binary64 bit agreement. This preserves the catalog's output schema as the
single schema rather than copying it for fixtures. `triangles`, `faceKinds`,
`bands`, and `cells` stay unwrapped catalog values and compare exactly.

`comparison` has exactly `mode`, `positions_abs`, `normals_abs`, and
`allowance_case`. Both allowance arrays align with their wrapped output arrays.
`allowance_case` must identify the same case and resolve to the hash-bound
allowance row with byte/value-identical rows. The only allowed mode is
`per-component-absolute`; it is not a blanket tolerance. It permits a target
value only when its finite canonical component differs by at most the declared
component allowance; zero allowance also requires the reference bits. Exact
counts, output dimensions, triangle indices/order/winding, face kind, band,
cell, and exported zero sign never use this comparison mode.

For an error case, the exact allowed shape is:

```json
{"id": "edge-overflow", "input": {"...": "..."},
 "error": "MESH_ARITHMETIC_INVALID",
 "error_detail": {"faceIndex": 0, "stage": "edge"}}
```

It must carry no `output`, `comparison`, or allowance fields. `INVALID_INPUT`
and `FACE_LIMIT_EXCEEDED` have no `error_detail`; the dynamic error has exactly
`faceIndex` (canonical nonnegative integer in the implied face range) and a
catalog-declared stage. Input schema validation plus the catalog's narrow
cross-field rules determine which static witnesses can use `INVALID_INPUT`.
The checker must reject a dynamic error whose input is statically invalid.

## Structural checks to integrate in `check_catalog`

Add `RADIAL_PROFILE_SURFACE_OUTPUT = "radial-profile-surface-output"` to the
known formats and dispatch only when the operation id is
`mesh.radial-profile-surface-3d`. Keep the dedicated validator in a small
module such as `tools/check_radial_profile_fixtures.py`, with a function shaped
like the existing `validate(root, prefix, op, fixture) -> list[str]`. The
catalog checker should still create its ordinary Draft 2020-12 input/output
validators; the dedicated validator receives the operation object rather than
a copied schema.

The dedicated validator should:

1. Require the envelope keys and validate identity, version, nonempty neutral
   `fixture_status`, catalog raw-source hash, relative source bindings, and the
   separate allowance-file hash.
2. Validate every case id is unique; project wrapped successful output scalars
   to primitive values; then validate `input` and the projected `output` with
   the catalog schemas.
3. Check finite canonical values, canonical `+0`, all six output arrays and
   their alignment, in-range distinct triangle indices, normal/position triple
   shapes, and exact metadata array alignment. It can verify declared topology
   facts visible in the output, such as index range and cap/side metadata
   domains, but must not reimplement ring construction, face winding, or the
   normal kernel.
4. Resolve the exact allowance row and compare its shapes and values with the
   per-case `comparison`. It checks fixture reference bits and allowance
   integrity, not whether an arbitrary target's sine/cosine obeys the envelope.
5. Check each error record's exact code/detail shape and static-versus-dynamic
   classification. It should enforce no partial output in all error records.
6. Resolve only declarative cross-case relations. Recommended initial kinds
   are `same-side-topology-under-cap-toggle`,
   `pole-cap-flags-do-not-add-fan`, `cap-start-end-independent`, and
   `face-limit-threshold`. Each kind should compare referenced recorded values
   and bits, never generate a mesh.

Focused checker tests should corrupt a catalog hash, a source binding, a wrapped
bit, a negative-zero scalar, an allowance alignment/value, a triangle index,
metadata order, an error stage/index, and each cross-case reference. The
existing private validator review already reports 22 such serialized-output
mutations rejected, but that report is not a shared-fixture checker result.

## Native-only obligations

Keep these out of success vectors and structural fixture acceptance:

- retained primitive storage, allocation/resource-failure behavior, and no
  partial result;
- Java `Map`/passive `List` carrier handling and target-specific active
  proxy/custom-container rejection;
- input mutation after construction, detached `At`/`toValues` output, `Into`
  atomicity, index precedence, destination typing, and untouched sentinels;
- same-target replay bit identity, bounded workload/storage measurements, and
  every claimed port's actual trig inclusion in the registered envelope;
- P3D adapter, context, lifecycle, draw, visual, and installation evidence.

These should appear as nonempty `native_only_cases` and
`native_ownership_access_requirements` entries with explicit unexecuted status
until a runner supplies evidence. A shared numeric fixture cannot establish
these behaviors.

## Coverage still needed before freeze

The current private set is strong for small topology, all endpoint cap-flag
combinations, poles, capacities, scales, and the three declared dynamic
failures. It still lacks the following fixture-level commitments:

- declared shared cross-case relations for cap independence, ignored cap flags
  at poles, seam/winding stability, and the exact face-limit threshold;
- a success with `-0.0` as an endpoint radius, proving accepted input-zero
  normalization rather than only negative-zero axial input;
- an explicit successful profile with negative finite axial coordinates at
  ordinary scale, if the final policy wants translation along the local axis
  represented independently of overflow witnesses;
- a dynamic witness whose first failing face is later than zero, if one exists
  under the specified kernel; otherwise the fixture should state that only
  reachable first-face witnesses are registered;
- malformed passive-carrier, nonfinite-number, destination, accessor,
  ownership, and resource cases as native-only obligations rather than JSON
  values that standard JSON cannot faithfully encode;
- a final independently generated shared fixture and allowance artifact after
  the canonical catalog hash is frozen. The current `.work` artifacts bind a
  draft worksheet/oracle, not a canonical operation file.

No missing item above authorizes a default, broader input range, renderer claim,
or public implementation. It is a checklist for root's fixture integration and
subsequent target validation.
