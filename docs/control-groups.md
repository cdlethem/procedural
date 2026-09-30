# Control groups

Every instrument states how its controls are organized: which groups exist, which controls
belong to each, in what order, and which clusters can sensibly be scaled together. The package
owns that organization; the web app decides how to present it (sections, collapsible panels,
a ratio lock on a proportional cluster, one slider driving several controls).

## Contract

`InstrumentDefinition.controlGroups` is an ordered tree (`packages/instruments/src/control-groups.ts`).

```ts
type ControlStage = "form" | "process" | "material" | "color" | "frame";
type ControlGroup = {
  label: string;                                  // heading, unique among siblings, no "/"
  controls: readonly (string | ControlGroup)[];   // control keys and nested groups, in display order
  stage?: ControlStage;                           // required on top-level groups, forbidden on nested ones
  proportional?: true;                            // see below
};
```

- **Complete and exclusive.** Every control belongs to exactly one group; top-level entries are
  groups. Groups are non-empty and nest at most three levels.
- **Proportional.** Every member is a numeric control measuring one quantity in one unit, where
  zero means none of it, so multiplying all of them by one factor is a meaningful single edit:
  footprint width and height, a mark's diameter and line weight, two radii, two opacities.
  Load-time validation requires at least two direct numeric members, no nested groups, and a
  non-negative lower bound (so positions and signed angles can never be proportional). Whether
  the members truly share a unit is an authoring judgment reviewed with the definition.
- **Derived flat form.** Loading reorders `parameters` into group order and sets each
  control's `Parameter.group` to its slash path (`"Material/Bead mark/Scale"`), so a consumer
  that reads only the flat list still sees contiguous nested sections. `Parameter.group` is
  derived output; authoring it is an error.
- **Stages.** Every top-level group states what the artist decides with it, from the fixed
  vocabulary `CONTROL_STAGES` in this order: `form` (what is built: the population, field,
  paths, partition, lattice, tiling, source image), `process` (how it develops: disorder,
  relaxation, growth, forces, simulation, sampling, iteration), `material` (how it is drawn:
  marks, lines, fills, textures, edges, faces), `color` (a `Color` group; the host adds the
  palette), `frame` (`Placement`, crop, boundary of the canvas, `View`, light). Nested groups
  belong to their parent's stage; authoring `stage` on one is an error. Groups of one stage need
  not be contiguous in declared order: `stageItems(id, values)` buckets the visible tree by stage
  in vocabulary order, keeping declared order inside each stage and omitting empty stages, and
  every `InspectorItem` group carries its `stage`. Loading also derives `Parameter.stage`.
  Stages are organization only: nothing about drawing, validation or visibility depends on them,
  and a host presents them as a path, never a gate.
- **Featured.** An instrument may declare `featured`: one to four control keys, in order, that
  best show what it does at first touch (a landing or "start here" knob set). Keys must exist,
  not repeat, and be numbers or selects. `featuredControls(id)` returns them, or, absent a
  declaration, up to three number/select controls of the first `form` group.
- **Visibility.** Groups do not change conditional visibility ([conditional controls](conditional-controls.md)).
  `inspectorItems(id, values)` returns the tree for current values: visible controls only,
  groups with nothing visible omitted, `proportional` preserved. A `visibleWhen` may be an array of
  alternatives or hold numeric comparisons, so a consumer must call it rather than re-deriving the
  tree or re-implementing visibility (an old consumer iterating `Object.entries(visibleWhen)`
  misbehaves on an array).
- **Pure organization.** Groups never change drawing, validation, defaults or saved values.

## Authoring guide

Declare `controlGroups` next to `parameters` in each definition. TypeScript requires it; load
fails with a precise message when a control is missing, repeated, unknown, or a proportional
group breaks its rules. Shared control sets (factories, families) share group builders.

1. **Follow what the artist decides, in construction order.** Typical top level, two to five
   sections: what is built (the population, field, paths, partition, lattice, simulation
   setup), how it is changed (disorder, forces, growth, maps, iterations), how it is drawn
   (`Mark`, `Material`, `Filler`, `Drawing` when it mixes several mark kinds, `Color`), and the
   camera (`View`) for 3D studies. Name sections with the instrument's own vocabulary (`Field`,
   `Partition`, `Growth`, `Bead mark`) when it says more than a generic name.
2. **Placement.** The main footprint's center, size and rotation form a `Placement` section
   that follows the first construction section (parallel sections such as `Screen A`/`Screen B`
   stay contiguous before it): `centerX`, `centerY`, a proportional `Size` subgroup for its
   width/height (or radii), and the rotation. A secondary positioned thing (a second attractor,
   a map center, a focus) keeps its position with its other controls, e.g.
   `First pull: centerX1, centerY1, radius1, power1`.
3. **Mode first, then its dependents.** A select or toggle leads the group whose controls it
   governs; its `visibleWhen` dependents follow it.
4. **Clusters of similar inputs become subgroups** of two or more: `Size`, `Scale` (a mark's
   diameter with its line weight), `Shape`, `Stations`, `Spacing`, `Line weights`, `Opacity`.
   Do not wrap a single control or nest just to nest; loose controls in a section are fine.
5. **Proportional only when scaling together is one edit.** Yes: width/height, radiusX/radiusY,
   tile width/height, start/end width, several line weights, several opacities on one scale,
   grid columns/rows. No: counts mixed with lengths, lengths in different units (canvas
   fractions vs canvas units vs cells), unrelated 0–1 amounts, positions, angles, frequencies.
6. **Consistency.** Family members and instruments sharing a control set use the same groups
   for the same controls; recurring clusters use the recurring labels above.
7. **Labels** are sentence case, one to three words, and do not repeat the instrument title.
8. **Stage every top-level section** by what the artist is deciding, not by where it sits: the
   first construction section and the shape being built are `form` even when a `Boundary`,
   `Solid` or `Strands` label sounds like something else; iteration, growth, disorder, sampling
   and simulation are `process`; anything about how marks are put down is `material`; `Placement`,
   canvas crops, `View` and lighting are `frame`. A `Color` section is `color`. Every instrument
   has at least one `form` section: if its construction lives in a `Growth` or `Strokes` section,
   that section is `form`. Shared builders state the stage once.
9. **Feature the first-touch knobs** when an instrument's best demonstration is not simply the
   first three numeric controls of its first `form` section: two or three controls whose sweep
   visibly reshapes the default image within a frame.

Reference entries in `adapters/reference-composition-instruments.ts` show the conventions.

## Verification

`tests/control-groups.test.ts` covers validation, derivation, stages, featured controls and the
inspector tree. Because grouping is organization only, every instrument's default and seeded
random configurations must draw the same fingerprint before and after grouping changes.
