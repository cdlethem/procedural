# Data Scores

Let a small table decide the structure of a picture: which cell a row takes, how big its mark is,
how far it drifts from the grid, how much area a region owns, and where along a score it sits. The
starting study is a library's loans over a year: three stacked lanes (fiction, science, travel), one
mark per month placed by month, lifted by the number of loans and sized by the share returned late.
Colour follows the season, ringed ghosts stand where a value was never recorded, and a small key
underneath is generated from the same mapping that drew the marks.

Three tables ship with the instrument, each with three measures, two categories and some missing
values. Switch the table, the layout or any mapping and everything is redrawn from the recorded
values; nothing is fetched or sampled live.

| Table | Rows | Measures | Categories | Missing |
|---|---|---|---|---|
| Harbour log | 48 half-hourly readings | hour, tide height (m), wind (kn) | tide (rising/falling), sea state (calm/moderate/rough) | wind and sea state during a sensor dropout |
| Orchard parcels | 30 parcels | year planted, area (ha), yield (t/ha) | crop (5), soil (3) | some yields and soils |
| Library loans | 12 months × 3 genres | month, loans, late share | genre (3), season (4) | some late shares and seasons |

The tables are illustrative samples, fixed and deterministic. Binding your own recording or table to
a Studio layer is future host work; called as a library function, `dataScoresComposition` and
`drawDataScores` already accept any table you construct (see the end of this guide).

## Choose what to read

| Controls | What changes on the canvas |
|---|---|
| **Table** | Which recorded table every mapping reads. Columns are addressed by position (first, second, third measure; first, second category), so any choice below works with any table. |
| **Time measure** | The measure that orders rows in time. It drives the window and, in a timeline, each mark's horizontal position. |
| **Window start / length** | Keep only the rows inside a slice of the time measure's range. Rows outside vanish from everything, including merged groups. In a timeline the window fills the width, so a short window zooms in. |
| **Missing values** | Ghost draws a pale ring (marks) or an outline (regions) where a mapped value is missing; gap draws nothing. Either way the row keeps its place, so nothing moves. A row without its time or area has no place and is always left out. |
| **Merge rows by / Merge with** | Lattice and treemap only. Turns every category into one unit whose measures are summed, averaged, medianed, maximised, minimised or counted. Missing values are skipped; a category with no value stays missing rather than becoming zero. |

## Choose the layout

| Controls | What changes on the canvas |
|---|---|
| **Layout** | **Lattice**: one cell per unit. **Treemap**: one region per unit, area exactly proportional to a measure. **Timeline**: units along time, one lane per category. |
| **Order, Sort by, Largest first** | Lattice and treemap. Table order keeps the recorded order; sorted orders by a measure (missing last), which turns a lattice into a gradient and puts the biggest treemap regions first; shuffled deals units with the seed, so a new seed re-tiles the picture while every area stays exact. |
| **Drift by, Looseness, Drift correlation** | Lattice. Looseness is how far a cell may leave the grid, as a fraction of a cell; the drift direction comes from one shared correlated field, so neighbours move together when correlation is large. **Drift by** lets a measure decide each cell's share of the drift: high values drift furthest, low ones stay exactly on the grid, missing ones stay put. |
| **Area measure** | Treemap. The measure that is each region's area. Areas are exact to floating point and regions tile the footprint. A row with no value has no region; a zero has none either (a zero-area boundary is not a region). |
| **Lanes, Lane order, Height measure, Lane spread** | Timeline. One lane per category stacked in declared or seeded order (categories have no natural order, so the seed re-deals them; each mark keeps its category's lane). The height measure lifts marks inside their lane; a mark with no value sits on the lane's centre line and breaks the line. |
| **Center, Width, Height** | The footprint the layout fills. Width and height are one proportional pair. |

## Map values to appearance

| Controls | What changes on the canvas |
|---|---|
| **Size measure** | The measure that sets mark size (lattice, timeline) or fill spacing and contour density (treemap). None draws every mark the same. |
| **Domain start / span** | Where the response begins and how much of the measure's range it covers, as fractions of that range. A narrow span exaggerates differences and pushes the rest to the extremes. |
| **Response curve** | Linear, square root (lifts small values) or square (favours large ones), applied to the position inside the domain. |
| **Outside the domain** | Clamp holds the end size; extrapolate continues the curve, so marks below the domain vanish and those above grow; leave out draws nothing for that row while it keeps its place. |
| **Color by** | The category that picks the palette colour. Categories beyond the palette reuse colours. A category is a class in the order the table lists it, never a number: "10" comes before "2" if the table says so. |

## Marks (lattice, timeline)

| Controls | What changes on the canvas |
|---|---|
| **Marks, Form by** | One kind of mark for every unit, or dots, rings, rosettes and arrows dealt by a category. |
| **Largest / Smallest mark, Mark line weight** | Diameter at the top and bottom of the domain (the largest mark is every mark's size without a size measure) and stroke width. They are one proportional group. |
| **Petals, Opening** | Radial strokes in each rosette, and the open centre of rosettes or inner ring offset of rings. |
| **Score line, Line weight, Stitch spacing, Lane guides** | Timeline. Join a lane's marks in time order with ink or stitches. The line breaks where a height is missing or a reading was left out, and is never bridged over it. Lane guides draw a faint rule and the category name at each lane. |

## Fill (treemap)

| Controls | What changes on the canvas |
|---|---|
| **Fill, Fill by** | Hatch, dots or contours in every region, or a different fill per category. |
| **Densest / Sparsest spacing** | Hatch or dot spacing (contour density) for the largest and smallest values of the size measure. Dot fills place at most 80 dots per region, so in a large region they form a cloud rather than filling it; hatch and contours fill regions of any size. |
| **Hatch angle, Fill line weight, Tint, Gap, Outline regions, Outline weight** | Direction and weight of the strokes, the flat colour under each fill, space taken from inside each region (areas stay exact), and a fine outline around each region. |

## The key

| Controls | What changes on the canvas |
|---|---|
| **Draw** | The drawing with its key, the drawing alone, or the key alone. Add the same table twice, one layer as **Drawing only** and one as **Key only**, to place and scale the key as its own layer. |
| **Key X / Y / Scale** | Where the key sits and how large it is. |

The key is built from the resolved mapping, never from fixed text: which column is the axis, lane
and height, the domain and the sample sizes at its start, middle and end (drawn through the same
curve), each category with its colour and form, and a ring for missing values (an empty square for
treemap regions). Labels use the bundled outline font: unshaped printable ASCII only, up to 20
characters, with anything else shown as "?". This is not full-script typography.

## Try these

- Harbour log, timeline, one lane, height = tide height, size = wind, colour = sea state: two tides
  as a wave with the sensor dropout as a run of rings on the centre line (or a broken line with **Leave
  a gap**).
- Orchard parcels, treemap, area = area, hatch fill by crop, size = yield: a quilt whose blocks are
  the parcels' true sizes, denser where yield is high, empty where it was not recorded. Shuffle with
  new seeds; every area stays the same.
- Orchard parcels, lattice sorted by yield largest first, size = area, drift by = area, looseness .7:
  a grid that starts orderly at the top and comes loose exactly where the big parcels are.
- Orchard parcels, treemap merged by crop (sum): five regions, one per crop, each exactly the crop's
  share of the total area.
- Library loans, timeline, window .45 to .6, lanes by season: a two-month zoom where the marks of one
  month stack in a column.
- Size domain start .4, span .3, **Extrapolate**: small readings disappear and large ones swell.

## Use the pieces yourself

The table, the resolved attributes and the layouts are ordinary frozen values consumed by the
same `atEach`, `inside` and `strokeWith` functions as every other composition.

```js
import { dataTable, resolveData, treemapLayout, inside, regionFill } from "@procedurals/instruments";

const table = dataTable({
  id: "budget",
  columns: [
    { name: "spend", kind: "continuous", unit: "k", values: [120, 45, null, 300, 80] },
    { name: "dept", kind: "categorical", categories: ["ops", "art"], values: ["ops", "art", "art", "ops", null] },
  ],
});
const data = resolveData(table, {
  groupBy: null, aggregate: "sum", window: null, missing: "keep", required: ["area"],
  channels: { area: { kind: "quantity", column: "spend" }, tone: { kind: "category", column: "dept" } },
});
// Rows without spend have no area, so they have no region; the rest tile the box exactly.
const { regions } = treemapLayout(data, data.units, { seed: 1, centerX: 320, centerY: 320, width: 500, height: 400 });
const palette = [0x1f2a33, 0xc4452b];
inside(p, regions, (p, region, run) => {
  const fill = { kind: "hatch", inset: 2, retention: 1, spacing: 6, angle: 45, weight: 1, underpaint: .2,
    mark: { kind: "dot", size: 3, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 },
    material: { kind: "ink", weight: 1, spacing: 6, phase: 0, phaseSpread: 0, levelRamp: 0, retention: 1,
      mark: { kind: "dot", size: 3, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } },
    contour: { source: "noise", frequency: 2, resolution: 23, aspect: 1, hillCount: 3, hillRadius: .23, levelBase: -.65, levelStep: .35, levels: 4 } };
  regionFill(fill, [palette[region.unit.channels.tone ?? 0]])(p, region, run);
});
```

Whole recipes are JSON: `dataScoresComposition(createInstrument("data-scores"))` returns the recipe
with its table embedded by value, `drawDataScores(surface, recipe, { mark, fill, line })` draws it
(any consumer may be replaced by an ordinary callback), and `prepareDataScores(recipe, cancelled)`
warms treemap region geometry. `dataScoresScene(recipe)` returns the resolved data and layout for any
other consumer. Missing-value policy (`error`, `omit`, `keep`), domains, curves, aggregation and the
window are all arguments of `resolveData`; the library refuses to convert a category to a number or a
measure to a category, and never turns "no value" into zero.

Limits: a table has at most 2000 rows and 24 columns. A treemap's region fills are checked against
the shared nested-geometry budget before drawing and fail with a message naming the row count,
spacing and fill kind; lattices and timelines are not limited by it. Lengths are canvas units of the
640-unit reference canvas.
