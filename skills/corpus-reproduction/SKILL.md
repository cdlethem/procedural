---
name: corpus-reproduction
description: Validate a portable operation or target port by rebuilding representative surveyed sketches, comparing canonical output and rendered frames, and treating failures as abstraction evidence.
---

# Corpus reproduction

## Purpose and trigger

Use this skill when an operation first becomes runnable, a target port claims support, an
abstraction changes, or a visual regression raises doubt. Pure and command fixtures prove
portable semantics; reproduction proves that those semantics can express the motivating
artistic mechanism.

Do not reproduce sketches before Phase 2 approves the operation catalog. Do not select
only sketches already likely to pass.

## Select cases before implementation tuning

Create a reproduction plan that records:

- operation/version and target revision;
- motivating source and notes paths;
- why each sketch represents the operation;
- renderer, dimensions, determinism, animation, shader/display reliability, and assets;
- baseline frame paths and benchmark profile;
- operation parameters mapped to source behavior;
- required targets and explicit capability exclusions;
- success criteria chosen before candidate rendering.

Choose the smallest representative set that covers the actual claim. Across an operation
family, include where applicable:

- more than one motivating sketch or explain why only one exists;
- ordinary and boundary parameter usage;
- JAVA2D/P2D/P3D behavior claimed by the operation;
- static and animated/accumulating work;
- a rare technique when the operation exists to support that long tail;
- deterministic and non-deterministic profiles;
- meaningful topology, ordering, transforms, colour/style state, and assets.

A reproduction may simplify unrelated one-off aesthetic choices, but it must preserve the
mechanism the operation claims to abstract. Record every intentional difference.

## Define acceptance up front

For each case, define success at applicable layers:

1. **Recipe/configuration:** schema-valid and uses only approved operations.
2. **Pure output:** golden vectors pass.
3. **Canonical output:** geometry/command kind, order, counts, topology, transforms,
   colours, and style state match the declared contract.
4. **Execution:** native adapter runs without warnings or state leakage.
5. **Raster output:** dimensions and benchmark profile gates pass.
6. **Visual mechanism:** direct inspection confirms the intended structure remains
   present; objective similarity alone is insufficient.
7. **Coverage:** every required baseline frame and target case is present.

Use existing profiles in `docs/portability.md` and `benchmarks/corpus.json`; case-specific
overrides require repeated reference evidence showing that the profile is too strict or too
weak. Never loosen a threshold after seeing one candidate simply to make it pass. Preserve
raw metrics under any override.

## Build the reproduction

Recreate the sketch through the public operation contract, not by copying its original
helper or reaching into private adapter APIs. Keep explicit:

- seed and stochastic source;
- canvas, renderer, density, and colour space;
- assets and font identity;
- frame/time values and retained state;
- operation parameters;
- target capabilities.

Candidate frames use the benchmark convention:

```text
<candidate-root>/<sketch>/frame_NNNNN.png
```

Every stored changing baseline frame is required. Static sketches compare frame 1;
animated or accumulating sketches compare all baseline frames in the manifest. Do not
substitute frame 1 for an unimplemented state transition.

## Rendering discipline

Rendering is expensive and serialized:

- use `tools/benchmark.py` and the external full survey-output checkout;
- run one Processing render at a time through a single pausable executor;
- confirm the external renderer is idle before using any shared build area;
- never modify the checked-in survey snapshot or upstream source corpus;
- keep candidate renders and reproduction records inside this repository, but do not
  commit bulk render output.

Pure, command-stream, source analysis, and independent target work may use available
local, external, or remote agents concurrently after contracts are frozen. Rendering stays
serialized.

## Observe and compare

Run the appropriate native fixtures, then `tools/benchmark.py` for candidate renders. Read
every required rendered image. Record:

- dimensions and exact equality;
- MAE and changed-pixel fraction;
- SSIM, histogram intersection, edge similarity, dHash distance, and aggregate score;
- profile gates and pass/fail;
- adapter warnings and missing cases;
- direct visual observations tied to visible output;
- expected differences and their contract basis.

Treat non-deterministic cases by their configured profile and compare only robust
structural/colour evidence. Xvfb shader baselines marked suspect are informational, not
proof of correctness. A benchmark score says how images differ; it does not explain why or
prove that the intended mechanism survived.

## Diagnose failure without moving the goalposts

Use the earliest failing layer:

- invalid recipe/configuration → catalog or reproduction mapping;
- pure mismatch → algorithm/numeric/RNG semantics;
- command mismatch → topology, order, transforms, or style state;
- command match but raster mismatch → adapter, renderer, density, font, asset, shader, or
  benchmark-profile calibration;
- all targets render similarly but unlike the corpus → wrong abstraction or reproduction
  mapping;
- only parameter choices fail → consult `skills/parameter-evidence/SKILL.md`;
- missing target case → incomplete claim, not an averageable failure.

Assume repeated reproduction failure is evidence against the abstraction before declaring
the sketch special. Do not add source-sketch conditionals, target-specific constants,
private escape hatches, or undocumented fallbacks.

## Record and conclude

Store a machine-readable reproduction record and a concise decision beside its candidate
artifacts. Include contract/version, source provenance, target/runtime, exact configuration,
frames, raw metrics, gates, warnings, visual observations, intentional differences, and
conclusion.

Possible conclusions:

- accepted for specified targets/capabilities;
- implementation defect, with the regression fixture added;
- contract ambiguity, returning to `operation-contract`;
- abstraction rejected or revised, returning to the Phase 2 decision record;
- informational only because the reference evidence is unreliable;
- blocked by an explicit unsupported capability.

The operation or port is not complete until all required cases pass or the catalog and
coverage report explicitly narrow the support claim.
