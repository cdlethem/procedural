# Bundled Relations

Draw who is connected to whom as a few readable ribbons instead of a tangle. The starting study is a
city's commuter flows: six districts around a ring, forty-eight zones in them, and about two hundred
weighted links. Each link leaves its zone in its district's colour and arrives in its destination's
colour, so every flow reads from origin to destination. Links between the same two districts travel
together as one ribbon, thin where the flow is small and thick where it is large; links inside a district
curl back as small petals. One ribbon, the flow between Harbour and Mill, is drawn heavier in dark ink.

Set **Bundle strength** to 0 and the same relationships become the plain straight-edge drawing (a
hairball), which is exactly the picture the bundling replaces. Everything between is a continuous blend.
Only edges that join the *same* two groups ever share a route, so unrelated links are not pulled together
just because they happen to cross.

Three datasets ship with the instrument. Each has six groups, so a control that names a group by position
works with any of them.

| Dataset | Places | Links | Direction | What it shows |
|---|---|---|---|---|
| Island ferries | 30 ports on 6 islands | 78 | from → to | Sailings mostly stay on an island; a few strong lines cross to a neighbouring island. Sparse enough to read edge by edge. |
| Commuter districts | 48 zones in 6 districts | 209 | net flow, from → to | Heavy traffic inside districts and along the ring road. The dense default. |
| Field citations | 60 papers in 6 fields | 125 | none | Citations gather inside a field and thin out toward neighbouring fields. |

The datasets are illustrative samples, fixed and deterministic, not measurements. Binding your own table
to a Studio layer is future host work; called as a library function, `relationsFromTables` and
`bundleEdges` already accept any two tables you construct (see the end of this guide).

## Choose the relationships

| Controls | What changes on the canvas |
|---|---|
| **Dataset** | Which places and links are drawn. |
| **Direction** | None reads every link as undirected. From → to keeps each link's orientation: colours can change from source to target, arrowheads become available, and opposite flows can form separate bundles. Field citations have no direction and ignore it. |
| **Edges shown, Weakest flow, Edge retention** | Show all links, only those between two groups, or only those inside a group; leave out links below a fraction of the strongest flow; or drop a stable share of links by id. Every place stays, and every link that remains keeps exactly the route it had. A new seed re-deals which links a partial retention keeps. |

## Arrange the places

| Controls | What changes on the canvas |
|---|---|
| **Endpoints** | **Circle**: each group takes a stretch of a ring. **Line**: the same along a baseline, with curves rising as arcs. **Map positions**: places stay where the dataset puts them (stretched to the footprint), so bundles run between real locations. |
| **Order within group** | Circle and line. Places in each group as recorded, largest flow first, a stable seeded shuffle, or *by partners*, which orders each place by where its partners lie and removes most crossings. |
| **Group size by, Gap between groups** | Circle and line. A group's stretch is proportional to its number of places or its total flow; the gap is the share of the ring left empty between groups. |
| **Start angle** | Circle. Where the first group begins, in degrees clockwise from the right; -90 is the top. |
| **Center, Width, Height, Rotation** | The footprint. Width and height are one proportional pair; on the circle they are the two diameters (an ellipse when different). |

## Shape the bundles

| Controls | What changes on the canvas |
|---|---|
| **Bundle strength** | 0 draws each link straight between its two places. 1 follows the family's shared waypoints completely. In between the curve is blended in exact proportion to the strength. |
| **Bundles** | *One per pair of groups* puts a → b and b → a together. *One per direction* keeps them side by side as separate ribbons (needs direction). Available with direction from → to. |
| **Hub depth** | How far each group's hub sits toward the interior: 0 at the places, 1 at the ring's centre (the line's full height, the map's centroid). Deep hubs pull links into long shared runs and a pinched centre; shallow hubs give short ribbons. |
| **Trunk lift** | How far each ribbon bulges toward the interior between its two groups, as a share of half the distance between them. |
| **Bundle separation** | How the ribbons meeting at one group spread across it: 0 stacks them on the hub, larger values leave each partner its own lane. |
| **Curve detail** | Samples per curve span. Low values show polygon corners; high values are smoother and cost more to draw. |

## Highlight a family

| Controls | What changes on the canvas |
|---|---|
| **Highlight** | Draw a chosen set heavier: every link touching a group, every link between two groups (either direction), or the heaviest few links. |
| **Group, Partner group** | Which groups, by position (1 to 6). The labels list what each position is in every dataset. Choosing the same group twice highlights the links inside it. |
| **Share of edges** | For *heaviest*: the fraction of shown links, heaviest first, that are highlighted (at least one). |
| **Highlight color, material, weight, spacing, bead** | Keep each highlighted link's own colour or draw all of them in the first palette colour; ink, stitches or beads with their own weight, spacing and bead. |

## Draw the edges and places

| Controls | What changes on the canvas |
|---|---|
| **Edge material, Edge weight, Edge spacing, Edge bead, Bead size** | Ink, stitches or beads along every link. Beads can be arrows, which point along the flow. Weight is that of the heaviest links. |
| **Weight contrast** | Links fall into five weight bands by the square root of their flow, from thinnest to heaviest. Contrast is how much thinner (or smaller, for beads) the weakest band is; 0 draws every link alike. |
| **Edge color** | One colour, the source group's colour, the target group's colour, or the source colour turning into the target colour at the middle of each link. The last shows the direction of every flow without an arrowhead. |
| **Arrowheads, Arrow size, Arrow position, Arrow share** | With direction from → to: a small arrow along each link at the chosen fraction of its length. Share keeps a stable, id-chosen fraction; at most 400 arrows are drawn. |
| **Place mark, size, Size by, Size contrast** | Dot, ring or rosette at every place, sized by its total flow if you like. |
| **Group bands, Band weight** | Circle and line. A thick arc or bar along each group in the group's colour. |

Colours come from the palette: the first is the ink colour, the next six are the six groups (fewer
palette colours are reused).

## Try these

- Field citations, *heaviest edges* share .06, edge colour *source group*: the six fields as petals with
  the few strongest cross-field citations picked out in ink.
- Island ferries, **Weakest flow** .3, no highlight: a sparse ring of lines you can follow one at a time.
- Commuter districts, strength 0, then drag strength up: the hairball resolves into families.
- Commuter districts, **Hub depth** .9, **Trunk lift** 0, **Bundle separation** 0: the classic pinched
  bundle with everything through the centre.
- Commuter districts, **Bundle separation** 1, **Hub depth** .4: each district gives every partner its own
  lane; the ribbons stay apart.
- Island ferries, **Endpoints** line, hub depth .75, highlight the pair of groups 1 and 2: an arc diagram.
- Commuter districts, **Bundles** *one per pair*, edge colour *source group*: opposite flows share one
  ribbon; switch back to *one per direction* to pull them apart.
- Edge material *beads* with *arrow* beads and **Edges shown** *between groups*: the flow direction as
  a stream of arrowheads.

## Use the pieces yourself

The relationships are a `Graph` (the same value the Graph Roles study uses), and the bundling is a function
of it: tables → graph → endpoint layout → selected edges → bundled paths, each a frozen value consumed by
the ordinary `strokeWith` and `pathMaterial`.

```js
import { dataTable, relationsFromTables, layoutEndpoints, selectRelations, bundleEdges,
  strokeWith, pathMaterial } from "@procedurals/instruments";

const ids = ["ny", "bos", "sf", "la", "ldn", "par"];
const nodes = dataTable({ id: "offices", rowIds: ids, columns: [
  { name: "region", kind: "categorical", categories: ["east", "west", "europe"], values: ["east", "east", "west", "west", "europe", "europe"] },
] });
const calls = dataTable({ id: "calls", rowIds: ["ny>ldn", "bos>par", "sf>la", "ny>sf", "ldn>par"], columns: [
  { name: "from", kind: "categorical", categories: ids, values: ["ny", "bos", "sf", "ny", "ldn"] },
  { name: "to", kind: "categorical", categories: ids, values: ["ldn", "par", "la", "sf", "par"] },
  { name: "minutes", kind: "continuous", unit: "min", values: [900, 400, 300, 150, 60] },
] });
const relations = relationsFromTables(nodes, calls, { group: "region", from: "from", to: "to", flow: "minutes" }, { seed: 1, directed: true });
const layout = layoutEndpoints(relations, { kind: "circle", startAngle: -90, gap: .1, sectorBy: "count", order: "partners",
  frame: { centerX: 320, centerY: 320, width: 420, height: 420, rotation: 0 } });
const view = selectRelations(layout, { minDegree: 0, maxDegree: 60000, minWeight: 0, maxWeight: 1, minAge: 0, maxAge: 1, isolated: true },
  { scope: "all", retention: 1 });
const { paths, bundles } = bundleEdges(layout, view, { strength: .85, inset: .6, lift: .5, separation: .15, detail: 8, families: "directed" });
// `paths` keep the edge ids ("ny>ldn"); `bundles` name each family and its shared waypoints.
const ink = { kind: "ink", weight: 1.2, spacing: 8, phase: .5, phaseSpread: 0, levelRamp: 0, retention: 1,
  mark: { kind: "dot", size: 3, petals: 6, opening: 0, weight: 1, rotation: 0, variation: 0, retention: 1 } };
strokeWith(p, paths, pathMaterial(ink, [0x1f2a33, 0xc4452b, 0x2f6f8f]));
```

Endpoints can also come from any existing graph: `layoutEndpoints({ graph, groups }, { kind: "graph", fit: false, frame })`
keeps the graph's own positions (a lattice, contact or branch graph), and your own group assignment says
which nodes bundle together. Whole recipes are JSON: `bundledRelationsComposition(createInstrument("bundled-relations"))`
returns the recipe with its tables embedded by value, `drawBundledRelations(surface, recipe, { edge, highlight, place, arrow, band })`
draws it (any consumer may be replaced by an ordinary callback that receives the same frozen paths or
sites), and `bundledStructure(recipe)` returns the relations, layout, selection and bundles for any other
consumer.

## What the routing does, and its limits

Each group has a hub, pulled from the group toward the interior by Hub depth, with one port per other group
around it. A link between two groups runs from its place to the port, along the family's shared trunk, to
the port of the other group and to its place; a link inside a group turns back halfway to the hub. That
control polygon is blended with the straight chord by the bundle strength and a smooth cubic B-spline is
drawn through it. There is no iteration and no randomness, and a link's route depends only on its own
endpoints and the layout, never on which other links exist, their order or which are shown.

A dataset holds one link per pair of places (net flow when two places exchange both ways) and no
self-links. At most 5000 links and 400,000 routed vertices are bundled at once, and stitch and bead
drawing is limited to 80,000 units of work; each limit is reported with the control to change (Weakest
flow or Edge retention, Curve detail, Edge or Highlight spacing). Nothing is silently truncated. Lengths
are canvas units of the 640-unit reference canvas.
