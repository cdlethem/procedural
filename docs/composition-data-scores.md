# Data Scores (brief 42)

Status: implemented on branch `w1/data-scores`, not yet root-reviewed through the real interface.
Built on the frozen [reference slice](composition-reference-slice.md) and
[structural operators](composition-structural-operators.md) conventions.

## Artist-facing brief

Recorded values decide structure, not only colour. Three bundled tables (illustrative samples, each with
three measures, two categories and explicit missing values) become one of three layouts through named,
documented mappings:

- **Lattice:** one cell per row or per merged category. A measure sets mark size, a category sets its
  form and colour, and a measure decides how far each cell leaves the grid (`latticeSites`' shared
  correlated field, scaled per site), so the grid is exact where the data is low and loose where it is
  high.
- **Treemap:** one region per row or category with area exactly proportional to a measure. A category
  chooses the fill (hatch, dots, contours), a measure sets its spacing or contour density.
- **Timeline (the score):** rows placed along the time measure over an editable temporal window, one lane
  per category, lifted by a measure, joined by an ink or stitch line that breaks wherever a reading is
  missing.

A small key generated from the resolved mapping can be drawn with the picture or as a separate layer
(`Draw: key only`). This is a composition study plus reusable mappings, not a dashboard framework. It makes
no claim of live or audio-driven data: every input is a recorded table.

Mapping targets provided: size, spacing (lattice drift, fill spacing), timing (timeline position and
window), region area and motif/fill role. **Not done:** branching, nodal-mode weights and choosing where a
growth field is fed (brief 42 lists them as alternatives; the roles/sizes on a lattice and region-area
examples were built).

## Frozen input contract

The instrument stores only its technique id, scalar parameters and palette. Host-owned asset storage and
decoding are out of scope, so the library defines typed, deeply frozen, **resolved** tables (never URLs,
never fetched, never live capture) that the function API and the JSON recipe accept, and the instrument
ships three bundled deterministic tables selected by a validated `select` (`dataset`). Binding a user's
own table to a Studio layer is future host work. `dataScoresComposition(input)` embeds the chosen table
in the recipe by value, so a persisted recipe replays the recorded data (tested: a JSON reload draws an
identical picture, and the table's content key is identical).

## Frozen boundary and semantics

Files: `composition/data-table.ts` (type, validation, mappings, aggregation, resolution),
`composition/data-layouts.ts` (lattice, treemap, timeline producers), `composition/data-scores.ts` (recipe,
consumers, draw, prepare, instrument binding), `composition/data-key.ts` (key model and painter),
`composition/data-samples.ts` (bundled tables), `adapters/data-scores-instrument.ts` (controls).

- **`DataTable`.** `dataTable(input)` validates and freezes: columns of equal length; `continuous` columns
  hold finite numbers or `null` (any other value is an error naming table, column and row id);
  `categorical` columns carry an explicit ordered category list (distinct, non-empty, at most 64) and hold
  one of them or `null`; column names and row ids are unique. Row ids default to `row:<i>`. `key` is a
  64-bit hex content hash used only as cache identity. Limits: 2000 rows, 24 columns
  (`MAX_TABLE_ROWS`, `MAX_TABLE_COLUMNS`). A value already produced by `dataTable` is returned unchanged.
- **No conflation.** A `measure`/`quantity` channel refuses a categorical column, a `category` channel and
  `groupBy` refuse a continuous one, and aggregation applies numeric functions only to continuous columns
  (a merged unit's other categories take the **mode**, ties to the lowest class index). A category's class
  index is its declared position, never its numeric reading.
- **Missing.** `null` stays `null`. `resolveData` applies an explicit policy: `error` throws naming unit and
  channel, `omit` drops the unit (listed in `omitted`), `keep` retains it with `null` and lists the channel in
  `unit.missing`. A channel named in `required` (the timeline's `time`, the treemap's `area`) cannot be kept
  missing: the unit is omitted. Aggregates skip missing values; a group with none stays `null`, never 0.
- **Measure mapping.** `(value − start) / (end − start)` against an absolute domain (or the column's own
  extent, widened by 0.5 if constant) → clamp or extrapolate → a named curve (`linear`; `sqrt` and
  `square` are odd extensions, so extrapolated positions stay finite) → `range[0] + curve·(range[1] −
  range[0])`, ranges may descend. `outside: "omit"` leaves that channel `null` and lists it in
  `unit.outside`; the unit keeps its place. A non-finite result is an error. A `quantity` channel is the raw
  non-negative aggregated value (negative is an error, zero is allowed).
- **Units and window.** `buildUnits` applies the inclusive temporal window first, then merges. Unit ids
  are row ids or `group:<category>` (`group-missing` under `keep`), so window, sort, order and omission
  never rename anything. Groups appear in declared category order.
- **Output.** `ResolvedData { table, units, omitted, mapping }`: typed attributes per unit (`measures`, `classes`,
  mapped `channels`, `missing`, `outside`) **and the resolved source mapping** (absolute domains, units,
  categories), which the key reads. Cached by table key plus options (LRU 6), deeply frozen.
- **Treemap.** A binary treemap: each level splits the ordered run of units where the running weight is
  nearest half and cuts across the longer side in proportion to the two halves. Region area is
  `weight / total × width × height` to floating point and regions tile the footprint (tested at 1, 2, 7, 30
  and 120 regions against independently computed shares, pairwise non-overlap and total coverage). Zero-weight
  units have no region (`empty`). Region ids are unit ids. `partitionRegions` and `regionTree` are not used:
  their cuts are random and unweighted, so they cannot give exact areas; the result is still a plain
  `Region[]` for `inside` and the existing `regionFill`.
- **Lattice.** `latticeLayout` uses the existing `latticeSites` (shared correlated field) with
  `displacement = looseness`, then moves each site along its own disturbance vector by its `loose` share
  (clamped to 0..1, missing = 0). Zero looseness is the exact grid. Columns are `ceil(√(n·w/h))`, trailing
  cells stay empty.
- **Timeline.** `x` is the `time` channel's position along its range, lanes stack in declared or seeded
  category order (the lane for units with no category is always last), `level` lifts a mark inside its lane.
  Score lines join consecutive units of a lane and break at a unit with no height and wherever the table has a
  row of that lane that was omitted between two kept units (never bridged); rows outside the window break
  nothing. Path ids are `lane:<class>:<segment>`, tones follow the category.
- **Order and seed.** Seeds are `componentSeed(seed, id, purpose)`: `shuffled` order sorts units by
  `componentSeed(seed, unit id, "order")`, lane order by `componentSeed(seed, "lane:<category>",
  "lane-order")`, sites and regions carry `componentSeed(seed, id, "site" | "region")`. Removing a unit
  never reorders the others. The seed is structural only where a layout has an arbitrary choice: lattice
  (shuffled order, or looseness above 0), treemap (shuffled order, dot or contour fills), timeline (seeded
  lane order with more than one lane); `usesSeed` states it and is tested against real drawing changes.
- **Consumers.** `dataMark` (a `motif`), `dataFill` (`regionFill` per region in its tone) and `pathMaterial` are
  ordinary callbacks; `drawDataScores(surface, recipe, { mark, fill, line })` replaces any of them while
  the resolved data and layout stay the same cached objects. Units with a missing value are ghosts
  (`absence: "ghost"`) or nothing (`"gap"`); this is a drawing decision, so it never moves anything. Marks
  with a negative extrapolated diameter draw nothing; above 500 they are capped.
- **Work bounds.** Sites, regions and paths are charged to the shared `createCompositionRun` budget.
  Treemap fills are checked per fill kind against `boundNestedWork` (exported from `reference.ts`, one
  keyword changed) before geometry is built, and the error names row count, kind and spacing.
  The nested region geometry cache holds 64 entries, so a treemap above about 64 regions needs
  `prepareInstrument` (which retains the scene) to stay cheap on repeated draws.
- **Key.** `dataKey(recipe, data)` returns typed rows (title, axis/lane/height lines, size samples at the domain's
  start, middle and end through the same curve, category items with tone and form, a ghost row only when
  ghosts exist, a "blank = out of range" row only when values were left out). `drawDataKey` paints them with
  the outline font (`textOutlines`): unshaped printable ASCII only, cut at 20 characters, other characters
  shown as "?". Sample marks over 22 units are drawn together at a reduced factor.
- **Instrument.** `data-scores`, palette of six. Columns are addressed by position (stored values `first`/`second`/`third`, unchanged and validated). Option labels are generated from the bundled tables (`1st numeric column (hour · planted · month)`) and each column select's description lists what every position is in every table, so the labels cannot drift from what is read; every bundled table has
  three measures and two categories with missing values (tested). Layers are transparent: no background,
  no full-canvas rectangle.

## Controls (groups, dependencies)

Groups: Data (Window, Merge), Layout (Order, Lattice, Treemap, Timeline), Placement (proportional Size),
Mapping (Response), Marks (proportional Scale, Shape), Fill (Spacing, Outline), Score line, Key.
Proportional: `width`/`height`; `maxSize`/`minSize`/`markWeight` (one unit, zero is none).

Inline `visibleWhen`: layout selects which of Lattice/Treemap/Timeline/Marks/Fill/Score line controls show;
`order`/`groupBy` show for lattice and treemap, `sortBy`/`descending` when sorted, `aggregate` when merging;
size response controls when a size measure is chosen; `markRole` when marks are by category, `petals`,
`opening`, `markWeight` for the mark kinds that use them; `fillRole`, `angle`, `fillWeight` likewise;
`frameWeight` when outlined; `lineWeight`/`lineSpacing` for the chosen line; `laneOrder` when lanes are
used; key placement unless the key is off; the footprint unless the layer is key only.
The control audit (`tests/helpers/audit-controls.ts data-scores`, 54 controls, 3,874 probes) reports 0
violations, 0 dead controls and 0 remaining proposals; `timeBy`, `windowStart`, `windowLength` and `missing`
stay visible because their relevance depends on other settings (a disjunction), not on one selection.
Ghost rings and outlines use fixed line weights so that hidden weights never leak into the drawing (an
earlier version leaked; the property test found it).

Slider intervals are conveniences; hard limits: window start 0 to .99, window length .01 to 1 (so the axis
domain never collapses), domain start −4 to 4, span .001 to 8, footprint up to 8192, weights up to 50,
mark size up to 500. Exact entry outside the slider is accepted within them.

## Verification

`tests/composition-data-table.test.ts` (19) and `tests/composition-data-scores.test.ts` (17): validation
errors naming column and row; frozen values, content keys and JSON reload; closed forms for domain, curves,
clamp, extrapolation, descending ranges, constant and empty columns; categorical/continuous refusal in
every direction and class order ("10" before "2"); aggregates with hand-computed values, mode and ties;
missing policies, the `outside` state, required channels and a real 0 versus `null`; inclusive window
applied before merging; id stability; treemap area exactness, tiling and zero areas from the raw table
(also merged by crop); sorted and shuffled order independence; lattice exact grid and per-site drift
shares; timeline positions, lanes, breaks and seeded lane order; hidden-control property test (60
configurations, over 400 hidden-control changes) using the effective-paint fingerprint; `usesSeed` against
drawing; ghost/gap invariance of layout; key contents, key and drawing concatenating to the full layer;
consumer substitution with identical cached objects; work bounds and cancellation.
Eight mutations were confirmed to fail tests: count-based treemap split, missing becoming 0, clamp/extrapolate
swapped, line bridging omitted readings, mode tie rule, categorical read as number, window end exclusive,
shuffle by position instead of id.

## Review record

Rendered with a throwaway SVG surface: defaults (three seeds), all three layouts on all three tables,
sorted, shuffled, merged, windowed, extrapolated and omitted settings, sparse fragments, dense/large
footprints, key-only layers, and layered compositions with two existing instruments in both orders. Defects
found and fixed: hidden-control leaks (ghost ring weight, region outline weight); the size range being
treated as structure (a missing value and an `omit` domain re-flowed a lattice, so both are now drawing
decisions that keep the unit's place); the default key colliding with the drawing; sample labels colliding
with the largest sample mark; an "area area ha" label; nothing said which lane was which (lane names added
to the guides); the default having no structural seed variation (lane order is now seeded).
Known limits: dot fills place at most 80 dots per region (existing shared fill), so large regions show clouds;
rows sharing a time in one lane join in table order, which zigzags when a lane holds several series (choose
lanes by the series category).

Open: real-interface exploration, layering in Studio, preparation cost of large treemaps in the browser, and
whether hosts should offer user table binding.
