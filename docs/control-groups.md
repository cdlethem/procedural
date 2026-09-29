# Control groups

Every instrument states how its controls are organized: which groups exist, which controls
belong to each, in what order, and which clusters can sensibly be scaled together. The package
owns that organization; the web app decides how to present it (sections, collapsible panels,
a ratio lock on a proportional cluster, one slider driving several controls).

## Contract

`InstrumentDefinition.controlGroups` is an ordered tree (`packages/instruments/src/control-groups.ts`).

```ts
type ControlGroup = {
  label: string;                                  // heading, unique among siblings, no "/"
  controls: readonly (string | ControlGroup)[];   // control keys and nested groups, in display order
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
- **Visibility.** Groups do not change conditional visibility ([conditional controls](conditional-controls.md)).
  `inspectorItems(id, values)` returns the tree for current values: visible controls only,
  groups with nothing visible omitted, `proportional` preserved. Consumers should call it rather
  than re-deriving the tree or re-implementing visibility.
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

Reference entries in `adapters/reference-composition-instruments.ts` show the conventions.

## Verification

`tests/control-groups.test.ts` covers validation, derivation and the inspector tree. Because
grouping is organization only, every instrument's default and seeded random configurations
must draw the same fingerprint before and after grouping changes.
