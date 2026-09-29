# Conditional controls (foundation F9)

The web app should show only the controls that matter for the current choices: annulus
settings only when the support is an annulus, petal count only for rosettes. This document
is the contract, how conditions are written and proven, the coverage reached, and what is
left. It is part of the [next-release roadmap](next-release-roadmap.md) (F9).

## Contract

`Parameter.visibleWhen` names the controls a parameter depends on.

- **Conjunction.** Every named driver must hold one of its allowed values:
  `{ support: ["annulus"] }`, `{ material: ["beads"], beadMark: ["rosette"] }`.
- **Drivers are discrete.** A driver is a `select` or `boolean` control of the same
  instrument. Numeric and text controls cannot be drivers.
- **Effective visibility.** A control is shown only if its own condition holds **and every
  driver it names is itself shown**. A chain (`material` → `beadMark` → `beadPetals`) needs no
  hand-flattening, and a control can never appear under a choice that is itself hidden.
- **Retention.** Hidden controls keep their values and remain valid. Switching a choice back
  restores what the artist had set.
- **Irrelevance guarantee (the testable part).** While a control is hidden, changing it does
  not change what is drawn. Conversely, no condition may hide a control that matters.
- **Load-time validation** (`validateVisibility`): a condition must name at least one existing
  select/boolean control, not itself; list at least one legal, distinct value; must actually
  restrict the driver (a condition allowing every value is rejected); and the dependency graph
  must be acyclic. Errors name the instrument, control and driver.

`visibleParameters(id, values)` (also `visibility.ts`) returns the controls to show, in
definition order, applying effective visibility. **Consumers should call it rather than
re-implementing the rule.** The private app's `LayerControls` currently checks only each
control's own condition against the stored values, so under a hidden driver it can show a
dependent control the contract hides; it should switch to this helper.

## Where conditions are written

- **New entries** declare `visibleWhen` inline next to the control (as the reference-composition
  entries do).
- **Entries whose adapters predate this** get their conditions from
  `packages/instruments/src/control-dependencies.ts`, a generated overlay keyed by instrument
  and control that is merged onto the definitions at load. Naming a control that already has an
  inline condition is an error, so each control has exactly one source of truth. The overlay
  exists so that 84 legacy adapters need no hand edits and every condition traces to a
  measurement rather than a reading of the code.

## Evidence

Every condition in the overlay is measured, not inferred from names or descriptions.

- `tests/helpers/draw-fingerprint.ts` draws an instrument into a recording canvas and hashes
  what was *visibly* drawn: each painting call with the fill and stroke actually in effect,
  so a stroke weight set while the stroke is off does not count as an effect.
- `tests/helpers/audit-controls.ts` treats every select/boolean as a driver, draws under all
  combinations (or a pairwise-covering sample when there are too many), changes every other
  control to a few different valid values, and records whether the drawing changed. If
  relevance depends on one to three drivers and the relevant combinations form a product set,
  that is a condition. It then **tries to refute** each one: it re-tests the hidden region with
  randomized numeric settings, aimed at the condition's boundary, and drops any condition that
  fails. Existing conditions get the same treatment; the audit reports a *violation* if one
  hides a control that matters.
- `tests/helpers/generate-control-dependencies.ts <report>` writes the surviving conditions
  into the overlay between generation markers; it is deterministic.
- `tests/conditional-controls.test.ts` keeps the guarantee in the suite: validation cases,
  effective visibility, the overlay merge, and a property test that changes hidden controls on
  seeded random configurations (discrete choices and numerics) and requires an unchanged
  drawing. A separate heavier one-off run (five seeds per instrument, numerics randomized, up to
  six hidden controls per configuration) made 6,225 hidden-control changes across all 84
  conditional instruments with no drawing change.

Run the measurement with
`npx tsx tests/helpers/audit-controls.ts --workers 22 --out .work/control-audit/report.json`
from `packages/instruments` (about four minutes for all instruments on a 24-core machine).

### Findings that mattered

- The first audit reported violations in two of the newest entries. Ordered Disorder's
  `rotation` was hidden for round marks, but it also decides which sites are classed as
  strongly disturbed, and those change color. Wallpaper's `cellHeight` was correctly hidden
  for square and hexagonal groups, but it still scaled the symmetry-breaking radius, and the
  cache key ignored it, so a stale result could be served. Both were fixed and the second has
  a regression test that computes in separate cache slots.
- A first version of the fingerprint hashed inert style calls and reported dependencies that
  do not exist (`weight` "mattering" for dots). Hashing effective paint only removed them.
- Holding numeric controls at their defaults hides real dependencies: 38 proposed conditions
  were refuted once numerics were randomized. One (`dye-currents.stripeAngle`) was only caught
  by the property test until the refutation was aimed at condition boundaries.

## Coverage

| | |
|---|---|
| Instruments audited | 124 (2,362 controls, about 40,000 drawing probes) |
| Conditions written from measurement | 292 controls in 84 instruments |
| Violations by existing conditions | 0 |
| Controls that always matter (need no condition) | the remainder of the non-conditional controls |
| Left visible: relevance is a disjunction of selections | 364 |
| Left visible: irrelevant everywhere sampled | 46 (mostly numerically disabled, e.g. an amount of 0) |
| Left visible: condition refuted by numeric perturbation | 38 |

Controls in the last three rows are **left visible on purpose**; hiding on incomplete evidence
would remove a control the artist may need.

## Not expressible yet

1. **Disjunctions.** `weight` matters if any of `showLine`, `showRibbon` or `showStations` is on.
   A conjunctive `visibleWhen` cannot say that. Supporting alternatives (an array of
   conditions, any one sufficient) would cover most of the 364, but the private app's current
   `LayerControls` iterates `Object.entries(visibleWhen)` and would throw on an array. This should
   be added only after the app adopts `visibleParameters`.
2. **Numeric drivers.** "Third stage settings matter only when its amount is above zero" needs a
   condition on a number (for example a threshold). Not supported; those controls stay visible.
3. **Groups.** Resolved by [control groups](control-groups.md): `inspectorItems(id, values)`
   returns the grouped tree with hidden controls and empty groups omitted.

## Plan for this release

- Every new brief states which of its controls depend on which selections and declares them
  inline (`roadmap` §3 F9, §7).
- The audit and the property test run for every entry before it is considered done; an entry
  with a violation is not done.
- Private app: adopt `inspectorItems` (which applies this visibility and hides empty groups),
  then (with the library) add alternatives to cover the disjunctive controls.
