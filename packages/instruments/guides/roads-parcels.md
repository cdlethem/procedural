# Roads and Parcels

A street network that looks planned: a few long avenues, collectors between them, then local streets
filling whatever is left until no block is bigger than you asked for. Every enclosed block is cut into lots
along its nearest road, lots are sorted into three types that each get their own fill (flat colour, hatching,
dots or contours), and some land is left open: a reserved zone such as a park or a lake, a hub plaza,
and blocks you choose to keep unbuilt. The layer paints only the roads and lots; everything else is
transparent, so it sits above or below any other instrument.

It is a 2D model of *how a street framework is organised*, not a city simulation: no traffic, terrain, zoning
law or land value. Streets follow a guide field you choose, and each new street is added where there is
most room.

**One network, several readings.** The grown streets are a planar graph. The lots, the road drawing, the
junction marks and (in code) any other consumer read that same network. Recolouring, changing the road material,
the fills or the outlines never regrows a street; changing a road width recuts the lots but keeps the streets;
changing the block size, the pattern, the anchors, the zone or the seed grows a different network, and every lot,
block and fill follows it.

## How the streets grow

Growth is a stepped process with a fixed order, so the same settings always give the same network and
**Steps** is a scrubber: at 0 only the boundary road and the zone exist; each step tries to add one street;
raising Steps only *adds* streets, and the streets already there stay put. The first **Anchors** streets pass
through points on a ring around the centre. After that, each step picks the place with the most room (the
widest gap between roads, measured against the local block size), runs a street through it along the guide
field in both directions, and stops each end at the first road it meets. Growth ends by itself when nowhere has
room for a street; steps after that change nothing.

| Controls | What changes on the canvas |
|---|---|
| **Street pattern** | The guide field: *Grid* (all streets at one angle and its perpendicular), *Radial and ring* (spokes and rings around the focus), *Spiral* (spokes turned by a fixed angle) or *Organic* (smooth noise bends the streets). |
| **Block size** | The widest open disc growth tolerates between roads. Halving it roughly quadruples the streets; it is the main density control. |
| **Steps** | How far growth has run (see above). The slider ends at 600; the hard limit is 1500. |
| **Wobble** | Each street's own turn away from the field. 0 is a perfectly regular pattern; larger values give a hand-drawn, less planned network. |
| **Anchors**, **Anchor ring**, **Anchor angle** | How many streets are placed first, how far from the centre, and how the ring is turned. Anchors set the skeleton of avenues; 0 starts from the most open place. |
| **Boundary road** | A road around the site. Off, streets run out through the edge and only blocks that are completely enclosed get lots; open-ended streets are drawn but bound nothing. |
| **Center X/Y, Width, Height, Rotation** | Place the site (canvas units). The network is grown for this width and height and then turned as a whole; rotation never changes it. |

### Guide field and focus

| Controls | What changes on the canvas |
|---|---|
| **Grid angle** | (Grid) The direction of the streets. |
| **Spiral turn** | (Spiral) 0 gives spokes and rings; larger values wind them into spirals. |
| **Warp**, **Field scale** | Noise added to the guide angle (up to *Warp* degrees) with features of the given size. Warp 0 keeps a grid straight; organic patterns always use the noise. |
| **Hub ring** | (Radial and spiral) A ring road around the focus that spokes end on. Its inside is an unbuilt plaza. |
| **Focus X/Y** | The centre of radial and spiral patterns, of the hub, and of the shrinking blocks, as an offset from the site centre. |
| **Blocks at focus**, **Focus reach** | Block size at the focus as a fraction of *Block size*, and how far from it blocks stay small before growing back to full size. 1 makes blocks equal everywhere. |

### Junctions and dead ends

| Controls | What changes on the canvas |
|---|---|
| **Junction policy** | *T-junctions*: a street ends on the first road it meets. *Crossroads*: it passes through one ordinary street on each side first. *Long crossings*: up to three, so streets run long across the site. |
| **Snap distance** | A street ending this close to a node lands on it, and one running this close alongside a road joins it, so there are no slivers or near misses. |
| **Shallowest meeting** | A street may not meet a road at a smaller angle than this; such a street cannot finish. |
| **Dead ends** | What happens to a street that cannot finish. *Drop* removes it. *Keep as stubs* keeps it when its other end connected: a road that simply stops, drawn as a road, with lots kept clear of it. Either way the void it could not fill remains one large block. |

Every junction is a real node of the network and no two roads cross without one: that is checked, not assumed.

## Reserved space

| Controls | What changes on the canvas |
|---|---|
| **Reserved zone**, **Zone X/Y**, **Zone width/height**, **Zone angle** | An ellipse or rectangle kept clear of streets and lots (park, water, empty quarter). Its outline is a road, joined to its surroundings by two links, so it is a block of its own and never subdivided. The shape is clipped to stay inside the site. |
| **Unbuilt blocks**, **Unbuilt rule** | The share of blocks left without lots, chosen *randomly* (a stable draw per block), the *largest*, the *least compact* or the *farthest from the focus*. The hub plaza and the zone are always open. |

## Roads and lots

| Controls | What changes on the canvas |
|---|---|
| **Avenues**, **Collectors** | How many of the first-grown streets are avenues (widest) and collectors (medium). Everything later is a local street. The boundary road, hub ring and links count as avenues. |
| **Avenue / Collector / Street width** | Stroke width of each class. Lots keep half of it, plus the setback, clear of the road, so wider roads take more land. |
| **Lot width**, **Lot depth** | The typical frontage and depth of a lot. A block wider than about 1.5 lots is cut across; deeper than about 1.6 lots it is cut parallel to its road, and what remains behind the front lots is an unbuilt court. |
| **Lot variety** | 0 cuts every piece in half; 1 lets each cut fall anywhere the minimum lot width allows. |
| **Setback** | Extra land kept clear beside each road. |
| **Lot types by** | Which rule sorts lots into three types: the class of the road they front, their size (largest first), their distance from the focus (nearest first), the age of their road (oldest first) or chance. The last three make three equal bands. |
| **Type A / B / C fill** | Solid colour, hatching, dots, contours or open for each type, in palette colours 2, 3 and 4. |
| **Fill spacing**, **Fill weight**, **Fill inset**, **Underpaint** | Spacing of hatch lines, dots and contour levels, their weight, the gap to the lot's edge, and a tint of the type's colour under non-solid fills. |
| **Hatch angle** | Hatching direction measured from the lot's road: 0 runs along the street, 90 across it. |
| **Lot outlines**, **Outline weight** | Draw every lot's boundary. |
| **Road material**, **Stitch spacing** | Ink, stitches or beads along every street. A street is one path, so stitches run on through junctions. |
| **Road color** | One ink, or tinted by age (oldest third in the ink colour, the middle third in the fifth colour, the newest in the second). |
| **Junction marks**, **Mark size** | A dot or ring at every junction of three roads or more, larger where four or more meet. |

Palette roles: 1 ink for roads and outlines, 2 to 4 lot types A to C, 5 accent (junction marks, middle-aged streets).

## Try these

- **Planned town:** *Street pattern* grid, *Wobble* 0, *Warp* 0, *Junction policy* crossroads, *Anchors* 4.
- **Old organic quarter:** *Organic*, *Block size* 60, *Wobble* 20, *Boundary road* off.
- **Radial city:** *Radial and ring*, *Hub ring* 40, *Blocks at focus* 0.4, *Anchors* 0.
- **Park in a grid:** a rectangular zone, *Unbuilt blocks* 0.2 with *Largest*.
- **Growth study:** step *Steps* from 0 to 100 with *Road color* by age and *Type A/B/C* open.
- **Land-use map:** *Underpaint* 1 with *Dots* on one type, *Contours* on another and *Hatching* on the third reads as a plan of land uses.

## Use the pieces in code

```js
import { growRoads, roadNetwork, roadBlocks, roadParcels, roadsParcelsComposition, roadsParcelsProducts,
  drawRoadsParcels, strokeWith, pathMaterial } from "@procedurals/instruments";

const recipe = roadsParcelsComposition(input);   // the stored controls as a typed value
const { network, blocks, parcels } = roadsParcelsProducts(recipe);
network.graph;        // planar Graph: nodes n:<k>, edges e:<k>, weight by street rank, age by birth
network.streets;      // one Path per street (ring streets, links, route streets), with kind and rank
blocks.blocks;        // each face as a PlanarRegion, its buildable land (holes allowed) and road classes
parcels.lots;         // lots with id, frontage, front road, angle to the road, type, and a fitted frame

// Your own road drawing: any path material, or your own callback.
drawRoadsParcels(p, recipe, { road: (surface, path) => { /* … */ }, lot: (surface, region) => { /* … */ } });
```

Values are frozen and cached by the identity of the one before them (`growRoads` by construction, then
`roadNetwork`, `roadBlocks`, `roadParcels`), so an appearance-only edit returns the same objects. Element ids
are stable: streets are `street:<k>` in birth order, nodes and edges keep their serial when a later street splits
an edge, and a block's id changes exactly when its boundary does; lot ids extend their block's id.
`prepareInstrument` builds every stage in time slices and reports `false` when cancelled, leaving nothing cached.

## Limits

Steps stop at 1500, and one step may charge at most 150,000 work units; the grid over the site may not have more
than 400,000 cells (a small *Block size* on a large site is rejected naming **Block size**). At most 4,000 blocks and
12,000 lots; over that, the error names **Block size**, **Steps**, **Lot width** or **Lot depth**, and nothing is
thinned. Your own street geometry or a bound raster or mask for the reserved zone is a future host feature: the
saved instrument names only the bundled patterns and the zone shapes above.
