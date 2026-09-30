# Aggregation Colonies (brief 15)

Status: **implemented on branch `w3/aggregation-colonies`, unreleased. Reviewed from rendered output and package
tests only; not exercised through the real Studio interface, layered in the app, or reviewed for responsiveness
there.** It runs on the [stateful snapshot foundation](composition-snapshots.md) (F7), the
[planar domains](composition-domains.md) (F4) and the frozen [reference slice](composition-reference-slice.md)
conventions. Guide: `packages/instruments/guides/aggregation-colonies.md`. Instrument id `aggregation-colonies`.

## Artist-facing brief

Branching accretions whose empty channels and active tips emerge from deposition. Seeds, a release source, a
wind, a sticking chance and an optional wall decide the colony; the same finished colony is drawn as marks at
its grains, ink/stitches/beads along its parent links, a halo and tip marks, coloured by attachment age, limb or
depth, and can be confined inside letters or an image silhouette. **Scope: a specified 2D off-lattice DLA
model. It is not Andy Lomas's 3D Aggregation process and is not a physical simulation.**

## The model (one growth step = one released walker)

Release from the source (ellipse or rectangle outline, line, or uniformly inside the domain) → walk → attach or
end. Full statement, update order and analytic consequences are the header of `composition/aggregation.ts`.

- Walk: an angle stepper (`angleWalkStep`, heading change within ±`turn`) plus drift toward the wind and the seed
  point, both as fractions of the random step. The step is at most the distance that cannot touch a grain or a
  wall (walk-on-spheres shortcut, floor `radius/2`), so no contact is skipped and a wall can never be tunnelled.
- Attach: a step landing within `contact = 2 radius` of a grain sticks with probability `stick` (one fixed draw
  per micro-step, so `stick` cannot move a walk before its first contact). The new grain is placed exactly
  `contact` from its **parent**, the nearest grain to the landing point, **lowest id among equal distances**
  (`PointGrid.nearest`). It is refused if the link would come within one radius of a wall.
- Termination: a walker that leaves the arena (canvas, source, seeds and domain, plus `escape`) is `escaped`; one
  that uses `lifetime` steps is `timedOut`; `patience` consecutive walkers that neither attach nor find room
  (also `unlaunched`) **stall** the colony (`status: "stalled"`, `stalledAt`), after which every step is a
  no-op. No seed fitting the domain is a valid empty colony.
- Live regions: walkers are released only into regions of the domain that hold a seed (a walker in another
  region could never reach the colony).

Analytic invariants tested: every non-seed grain is exactly `contact` from its parent; no two grains closer than
`contact/2`; grains stay inside the domain a radius clear of every wall and hole; ids and parents only append.

## Producers, values, ownership

| Symbol | File | Role |
|---|---|---|
| `growColony(options, steps)`, `prepareColony(options, steps, cancelled)` | `composition/aggregation.ts` | Cached, cancellable colony through `Simulation` / `colonyCache` (a `SimulationCache`, checkpoint every 250). |
| `Colony` | same | Deeply frozen: `sites` (`ColonySite extends Site`: id `grain:<n>`, `parent`, `born`, `depth`, `root`, `limb`, `children`, `mass`, `tip`), `graph` (a `Graph` forest, parent → child, `age = steps − born + 1`, edge `weight` = the child's share of its tree's tips), `status`, `stalledAt`, `counts`, `bounds`, `domain`, `snapshots`. |
| `colonySimulation(domain)`, `colonyParams(options)` | same | The `Simulation` (id carries a content hash of the domain) and its construction key (controls a selection makes irrelevant are zeroed so they cannot split the cache). |
| `colonyDomain(spec)` | same | Bundled rectangle/ellipse/ring/letters/image domains as `PlanarDomain`; `{ kind: "domain", domain }` accepts any resolved region. |
| `DomainWalls` | `composition/domain-walls.ts` | Exact inside test and clearance queries over the domain's cached edge grid; holes and separate regions are all obstacles. |
| `colonyMarkSites`, `colonyTipSites`, `colonyLinkPaths`, `colonyTone`, `shownGrains` | `composition/aggregation-draw.ts` | Consumers' inputs: `Site`s and chained `Path`s, cached by colony identity and view. |
| `aggregationColoniesComposition`, `drawAggregationColonies`, `prepareAggregationColonies` | same | JSON-compatible recipe, drawing through `atEach`/`motif` and `strokeWith`/`pathMaterial`, cooperative preparation. Any of `mark`, `tip`, `link`, `halo` is replaceable. |
| Definition, controls | `adapters/aggregation-colonies-instrument.ts`, `composition/aggregation-controls.ts` | Parameters, groups, `visibleWhen`, defaults, cross-control validation. |

Inputs: persisted instruments name only bundled domains (letters, `portrait/geometry/landscape` silhouettes by a
brightness cut). Typed resolved values (`PlanarDomain`) enter through the direct API; **binding a user's own mask,
type or region in Studio is future host work.** The `noise` bundled image is not offered (no usable silhouette).

## Bounds and failure

Steps ≤ 12,000; seed grains ≤ 400; `steps × (lifetime + 25) ≤ 16,000,000` walker steps (the error names Growth
steps and Walker lifetime); at most about 12,400 grains, so state ≤ ~90,000 values; the grain index has at most a
million cells (cell size grows with the arena). Every invalid option throws an `Error` naming the control.
Nothing is truncated. Units: canvas units, degrees, dimensionless fractions.

## Controls (groups)

Seeds (shape, count) · Placement (X, Y, **proportional Size**: width/height, angle) · Source (shape, X, Y,
**proportional Size**, angle) · Domain (kind, letters, image, variant, cut, X, Y, **proportional Size**, hole) ·
Walkers (radius, sticking, Wind: strength + direction, pull, turning) · Growth (walkers, reach, lifetime,
give-up, escape) · Color (colour by, bands, taper, reveal) · Marks (grain mark and size, tip mark and size, Halo:
on/size/strength) · Links (parent links, weight, spacing, bead size, Outline: on/weight). `visibleWhen`,
inline: seed count and size only for a spread seed shape; seed height only for ring/scatter; source geometry
only for an outline or line source; domain details by domain kind; outline only with a domain; bands only when
colouring is not flat; mark size, tip size, halo, link details by their selection. Slider intervals (e.g.
Walkers 0–4,000) are narrower than hard limits (Walkers 12,000, radius 0.75–40). Defaults: a point seed, an
ellipse source, radius 3, sticking 1, 2,800 walkers, age colouring with tapered ink and dots, about 1,240 grains.

## Evidence

`tests/composition-aggregation.test.ts` (25 tests): contact-distance/separation invariants at three seeds and
four configurations; walker outcome accounting; exact lowest-id tie at a scripted equidistant contact (both seed
orders); release geometry (ellipse/rectangle/line/inside fractions); seed geometry and greedy overlap dropping;
`checkSimulation` (replay, prefix, resume, spacing, cancellation, element independence) with and without a
domain; more steps only append and fewer replay equal scratch; replay from checkpoints equals a shorter run;
cancellation caches nothing and retry equals uninterrupted; appearance edits return the identical `Snapshots`
and `Colony` objects, hidden controls never split the key, every initial-condition control recomputes; equal
domain content shares a run and an edited vertex recomputes; full-domain stall with a packing upper bound; empty
result; exact patience; every limit names its control; wind and stickiness effects; graph weights/ages/masses;
grains and links a radius clear of walls (brute-force segment distance); seedless regions stay empty; treatments
partition the parent edges and follow the grains; draw-call counts; hidden controls never change the drawing
(≥ 120 checks). Full suite: 1,067 tests pass on the merged branch.

Mutations confirmed to fail (`.work` harness, each by ≥ 1 test): no projection onto the contact circle; both wall
clearances removed (each alone is redundant defence in depth: the step size already respects the wall, so a
single removal survives by design); equidistant contact to the highest id; a stalled colony that keeps releasing;
seedless regions not excluded; patience off by one; drift not budgeted in the step; the published colony
rebuilt on every read; overlapping seeds; sticking ignored; wind reversed.

## Timing (Node 22, null surface, quiet machine, best single runs)

| Case | first | recolour | reveal/taper | structural (radius +0.1) | steps −100 |
|---|---|---|---|---|---|
| defaults, 2,800 walkers | 98 ms | 9 ms | 1 ms | 83 ms | 16 ms |
| slider max, 4,000 walkers | 101 ms | 12 ms | 1 ms | 86 ms | 12 ms |
| hard max, 12,000 walkers (lifetime 500) | 140 ms | 17 ms | 3 ms | 102 ms | 13 ms |
| letters GROW, 4,000 walkers, 40 seeds | 954 ms | 3 ms | 1 ms | 799 ms | 4 ms |
| image silhouette (geometry), 4,000 walkers | 583 ms | 11 ms | 2 ms | 476 ms | 12 ms |
| worst probed: walled letters, lifetime 6,000, sticking 0.02 | 3.9 s | | | | |
| worst probed: landscape silhouette, 4,000 walkers, sticking 0.02 | 3.4 s | | | | |

Extending steps costs only the new steps (checkpoints). Under machine load the same runs were up to six times
slower; the work bound (16 M walker steps) is the reason a walled worst case stays in seconds.

## Defects found by looking, and their fixes

1. Walkers released facing away with small `turn` produced no colony: release heading now faces the seeds.
2. A source outside the canvas margin lost its walkers instantly: the arena now covers canvas, source, seeds
   and domain.
3. Limb colouring gave one or two colours: limbs are now trunks plus subtrees of at most a sixth of the
   heaviest tree.
4. Bundled image silhouettes at the default cut were empty or specks: the cut range and default were set from
   the measured luminance of each image, and `noise` is not offered.
5. Walkers released in a seedless letter timed out by the thousand: walkers are released only into live regions.
6. Long chains of overlapping stroke caps looked beaded: links are chained into one polyline per limb segment.

## Open concerns

- Real-interface acceptance, layering in the app and interaction cost are root's.
- Limb numbers and colours derive from the final colony, so a longer run can regroup limb colours (ids never change).
- Dense, thin-ink settings (radius 1.5, dots only) read faint; combined settings with rosette tips get cluttered.
- Letters use the unshaped Latin outline font (1–20 ASCII); only five words are offered in the control.
