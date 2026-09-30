# Conditional controls (foundation F9)

The web app should show only the controls that matter for the current choices: annulus
settings only when the support is an annulus, petal count only for rosettes. This document
is the contract, how conditions are written and proven, the coverage reached, and what is
left. It is part of the [next-release roadmap](next-release-roadmap.md) (F9).

## Contract

`Parameter.visibleWhen` names the controls a parameter depends on. It is either **one
alternative** (an object) or a **non-empty array of alternatives** meaning "shown if **any**
alternative holds". Every object-valued `visibleWhen` written before alternatives existed keeps
its exact meaning: it is an array of one.

- **An alternative is a conjunction.** Every driver it names must satisfy its entry:
  `{ support: ["annulus"] }`, `{ material: ["beads"], beadMark: ["rosette"] }`.
- **Discrete drivers** (`select`, `boolean`) list allowed values, as before.
- **Numeric drivers** (`number`) take a comparison object instead of a list, with the operators
  `lt`, `lte`, `gt`, `gte`, `eq`, `ne` and finite-number literals: `{ retained: { lt: 1 } }`,
  `{ passes: { gte: 2 } }`, `{ passes: { gte: 2, lt: 8 } }`. One operator, or one lower bound
  (`gt`/`gte`) with one upper bound (`lt`/`lte`) forming a consistent interval; nothing else. A
  value that is not a finite number satisfies no comparison (not even `ne`). **Text controls are
  never drivers.**
- **Arrays of alternatives.** `weight: [{ showLine: [true] }, { showRibbon: [true] }, { showStations: [true] }]`
  shows `weight` when any of the three is on. Alternatives may mix discrete and numeric drivers:
  `keepBy: [{ retainBy: ["area"], retained: { lt: 1 } }, ...]`.
- **Effective visibility.** A control with no condition is shown. A control with a condition is
  shown if at least one alternative both **holds against the current values** and **names only
  drivers that are themselves shown**. An alternative with a hidden driver counts for nothing, so a
  chain (`material` → `beadMark` → `beadPetals`) needs no hand-flattening, and a control can never
  appear under a choice that is itself hidden; a hidden numeric driver's value cannot justify
  anything either. Formally, the shown set is the *least fixpoint* of that rule (start with the
  unconditional controls, repeatedly add every control with a justified alternative). On a
  validated instrument, which is acyclic, this is the same as the obvious recursion; an
  unvalidated cycle simply never justifies itself.
- **Retention.** Hidden controls keep their values and remain valid. Switching a choice back
  restores what the artist had set.
- **Irrelevance guarantee (the testable part).** While a control is hidden, changing it does
  not change what is drawn. Conversely, no condition may hide a control that matters. (A
  condition may still show a control that does not currently matter; that is the safe
  direction, and a numeric threshold located by measurement can sit fractionally on that side.)
- **Load-time validation** (`validateVisibility`, run for every instrument at load). Errors
  name the instrument, control, alternative (`visibleWhen[1]`) and driver:
  - the condition is an object or a non-empty array of objects; no alternative is empty;
  - every driver exists, is not the control itself, and is a `select`, `boolean` or `number`
    control (never `text`);
  - a discrete entry lists at least one distinct legal value and **restricts** its driver (an
    entry allowing every value is a tautology and is rejected, inside an array too);
  - a comparison is used only on a number control, uses only the six operators with finite
    literals, at most two operators that form one interval (`lt`+`lte`, `gt`+`gte`, `eq` or `ne`
    with anything else are rejected), and a value list is rejected on a number control;
  - every literal lies inside the driver's **hard range** (`hardMin`/`hardMax`, else `min`/`max`);
  - a comparison is **satisfiable** and **restricts**: a contradictory interval (`gt 5, lt 3`,
    `gt 3, lte 3`), one that never holds over the range (`lt 0` on 0–1, `gt 1, lt 2` on an
    integer control, `eq 1.5` on an integer) or one that always holds (`gte 0` on 0–1) is rejected;
  - **no exact duplicate alternatives**, no alternative **redundant** because another already
    shows the control whenever it holds (`{ mark: ["dot"] }` beside `{ mark: ["dot", "ring"] }`),
    and the alternatives must not jointly allow every combination (`{ on: [true] }` with
    `{ on: [false] }`, `lt .5` with `gte .5`);
  - the dependency graph is acyclic **over the union of every alternative's drivers**: a cycle
    that exists only through the second alternative is still a cycle.

`visibleParameters(id, values)` returns the controls to show, in definition order;
`controlIsVisible(id, key, values)` answers for one control; `inspectorItems(id, values)`
(see [control groups](control-groups.md)) returns the grouped tree. Internally the item-based
forms live in `visibility.ts`, next to `visibilityAlternatives(parameter)` and
`visibilityDrivers(parameter)`, which hosts can use to describe a condition ("shown when ...")
or find what to watch. **A host must call one of these and never re-implement the rule.** A raw
consumer that reads `visibleWhen` as `Record<driver, values[]>`, for instance by iterating
`Object.entries(visibleWhen)`, is wrong on an array (its entries are alternatives, not
drivers), wrong on a comparison (an object where it expects a list), and wrong whenever an
alternative's driver is hidden.

> **The private app's own `LayerControls` (outside this repository) must adopt `inspectorItems`
> before array conditions or comparisons can appear in its inspector.** It currently checks each
> control's own condition with `Object.entries(visibleWhen)`, which would misbehave on an array.
> This repository now ships such conditions in instrument definitions, so that adoption is a
> prerequisite for the app taking this version.

## Where conditions are written

- **New entries** declare `visibleWhen` inline next to the control (as the reference-composition
  entries do). Instruments merged from the recent waves were audited again after alternatives and
  thresholds existed and gained inline conditions only where the measurement proved them.
- **Entries whose adapters predate this** get their conditions from
  `packages/instruments/src/control-dependencies.ts`, a generated overlay keyed by instrument
  and control that is merged onto the definitions at load. Naming a control that already has an
  inline condition is an error, so each control has exactly one source of truth. The overlay
  values may be arrays and comparisons like any other.

## Evidence

Every condition in the overlay and every condition added inline by this work is measured, not
inferred from names or descriptions.

- `tests/helpers/draw-fingerprint.ts` draws an instrument into a recording canvas and hashes
  what was *visibly* drawn: each painting call with the fill and stroke actually in effect,
  so a stroke weight set while the stroke is off does not count as an effect.
- `tests/helpers/audit-controls.ts`, **first stage.** Every select/boolean is a driver; the audit
  draws under all combinations (or a pairwise-covering sample when there are too many), changes
  every other control to a few different valid values, and records whether the drawing changed.
  If relevance depends on one to three drivers and the relevant combinations form a product set,
  that is a conjunction. It then **tries to refute** each one: it re-tests the hidden region with
  randomized numeric settings, aimed at the condition's boundary, and drops any condition that
  fails. Existing conditions get the same treatment; the audit reports a *violation* if one
  hides a control that matters.
- **Second stage (`audit-learn.ts`): alternatives and thresholds.** Controls left over (a
  disjunction, dependent on a number, or "dead" only because a default such as an amount of 0
  disables them) are sampled with the numbers moved around, each sample labelled "changing the
  control changed the drawing" or not. The audit finds which drivers, moved alone, flip that
  label from a fair share of starting points (relevance also flickers with the numbers, since a
  tiny drawing changes nothing), fits a disjunction of short conjunctions over those drivers, and
  probes just inside and just outside its own guess, refitting on every miss. Every number
  threshold is then **located on the real drawing** by bisection along the driver and written
  as a round, verified-irrelevant literal (`gt 0`, `lt 1`, `gte 2` on an integer control); a
  threshold that cannot be placed exactly is dropped, which only widens the condition. A proposal
  is written only if `validateVisibility` accepts it, effective visibility still shows every
  control everywhere it was measured to matter (a driver must stay shown where its dependents
  matter, and a context where one does not is added as a positive sample and the fit retried),
  and randomized refutation aimed at each alternative's boundary (one driver just outside its
  entry, the rest inside) finds no hidden configuration where the control changes the drawing.
  A counterexample is fed back and the fit retried up to four times. Showing a control that does
  not currently matter is safe, so the fit tolerates that (at most 35% of the irrelevant samples)
  but never the reverse. Runs are seeded but choose their sample sizes from the measured draw
  time, so a busy machine can find fewer conditions than an idle one; a run only ever proposes
  what survived its own refutation.
- `tests/helpers/generate-control-dependencies.ts <report> [--inline out.json]` merges the
  surviving conditions into the overlay between generation markers (deterministic; re-running on
  an empty report changes nothing) and, for instruments whose adapters already declare
  `visibleWhen` inline, writes them to the `--inline` file for adding next to the control.
- `tests/visibility-alternatives.test.ts` holds independent truth tables (alternatives, every
  operator at and either side of its boundary for float and integer controls, effective
  visibility through hidden discrete and numeric drivers, a least fixpoint on an unvalidated
  cycle, cycles through a second alternative) and one case per validation error.
  `tests/conditional-controls.test.ts` keeps the guarantee in the suite: a property test that
  changes hidden controls on seeded random configurations (discrete choices, and every compared
  number at its default, range ends, each literal and just either side of it) and requires an
  unchanged drawing, plus one that targets every control under an array or comparison
  condition.

Run the measurement with
`npx tsx tests/helpers/audit-controls.ts --workers 22 --out .work/control-audit/report.json`
from `packages/instruments`. The first stage took about four minutes for 124 instruments on an
idle 24-core machine; with the second stage the 173 instruments audited here took well over an
hour, and the report is written when every worker finishes (`<out>.jsonl` receives each
instrument as it completes).

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
- Refuting the first learned alternative for `inversion-gardens.retention` (`gasket` or
  `rule = tree`) found a configuration under `rule = word` where it matters; fed back, the fit
  no longer had a short explanation, and `retention` stays visible. `fill` survived as
  `gasket` **or** `source` in `rings`, `net`, `grid`, `wallpaper`.
- The learner's own refutation is not the last line of defence. A heavier run of the suite's
  property test (twelve hidden configurations per control under an array or comparison, two extra
  seeds) refuted two proposals that the audit, run on a loaded machine with small samples, had
  let through: `dye-currents.stripeSpacing` (`projection` and `texture`) and
  `stream-ribbons.steps` (overlapping `fieldY` intervals, which is noise). Both were removed; the
  rest passed. Re-run the audit on an idle machine and keep the property test.
- Fitting numbers exactly matters: a sample-midpoint threshold such as `clipShare > 0.37` fitted
  the labels of a first version and was noise; bisecting on the drawing and dropping what cannot
  be placed removed such artefacts.

## Coverage

| | Before | This work |
|---|---|---|
| Instruments audited | 124 (2,362 controls, about 40,000 drawing probes) | 173 (4,694 controls, about 153,000 probes; `visibility-drawing` had not finished when the run was stopped, so it has no measured conditions yet) |
| Conditions from measurement, overlay | 292 controls in 84 instruments | 428 controls in 90 instruments (**136 new**, 6 more instruments) |
| Conditions from measurement, inline | (declared by hand with each entry) | **45 new** in 18 instruments |
| New conditions by kind | | 181: about 80 alternatives, 32 numeric thresholds, 35 both, 34 plain conjunctions the first stage had refuted at default numbers |
| Violations by existing conditions | 0 | 0 in the 155 older instruments; 2 in newer entries (see below) |
| Left visible: relevance is a disjunction the fit could not express or refutation broke | 364 | 486 controls in 173 instruments (more instruments; the 364 older ones are largely in this number) |
| Left visible: irrelevant everywhere sampled | 46 | 62 |
| Left visible: relevance flickers with numbers, no clean threshold | 38 | 36 |
| Controls that always matter | remainder | 2,314 |

Newly conditional controls per instrument (overlay and inline, 54 instruments): `annular-marks` 21,
`contour-relief` 15, `profile-marks` 13, `depth-marks` 12, `pattern-competition` 8,
`tiled-circuits` 7, `wet-pigment` 6, `sensing-trails` 6, `registered-screens` 6, `optical-plates` 6,
`flocking-marks` 6, `pinned-waves` 5, `mesh-abstraction` 5, `neighborhood-growth` 4,
`gesture-scores` 4, `cell-mosaic` 4, `scatter-envelopes` 3, `compatible-mosaics` 3, and one or two
each in the other 36. Examples: `slit-compositions.repeatMode` shown when `repeats >= 2`,
`wet-pigment.tiltAngle` when `tilt > 0`, `inversion-gardens.fill` as above,
`gesture-scores.echoX/Y/Turn` when `echoes >= 2`.

Controls in the last three rows are **left visible on purpose**; hiding on incomplete evidence
would remove a control the artist may need. Examples the measurement did not prove and that
therefore stay visible: `adaptive-compartments` / `connected-value-regions` `keepBy` (no sampled
configuration made it matter, so it is reported irrelevant rather than conditional on
`retained < 1`), `crossing-lace` overlay `near`, `inversion-gardens` `retention` and `weight`.

The audit found two inline conditions from earlier waves that hide a control that matters:
`hinged-panels.perspective` and `surface-growth.backFaces` / `faceOpacity`. They are not changed
here.

## Not expressible yet

1. **Fits beyond a few alternatives.** A control whose relevance needs more than five
   alternatives, or more than four literals in one, is left visible.
2. **Numeric drivers that only flicker.** Relevance that switches with sizes and counts with no
   clean threshold (retention on a small drawing) is chaotic, not a condition.
3. **Text drivers.** Text controls are never drivers.
4. **Groups.** Resolved by [control groups](control-groups.md): `inspectorItems(id, values)`
   returns the grouped tree with hidden controls and empty groups omitted.

## Plan for this release

- Every new brief states which of its controls depend on which selections and declares them
  inline (`roadmap` §3 F9, §7), using alternatives and comparisons where relevance needs them.
- The audit and the property test run for every entry before it is considered done; an entry
  with a violation is not done.
- Private app: adopt `inspectorItems` (which applies this visibility and hides empty groups)
  before taking a version that ships array conditions or comparisons; see the contract note.
