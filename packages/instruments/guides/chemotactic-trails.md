# Chemotactic Trails

Fine veins of colour wander out of a few tangled nests, thicken where several walkers share them, join
where two colonies meet and leave pale contour halos around the busiest stretches. Each walker is steering by
the very trail the others laid a moment ago, so the picture is a record of walkers and chemical shaping each
other: drag **Steps** and the same colony grows up, first as knots at the emitters, then as veins, then as a
network of loops and junctions. Move an emitter and the whole colony reorganizes around the new start, not just
its first few marks. Recolour and nothing recomputes.

Everything is drawn from one run. The **chemical** (contour lines and/or filled bands), each walker's
**trajectory** (ink, stitches or a dry brush of separate hairs) and **marks** at the walkers themselves are
three drawings of the same state, so changing one never moves another.

It is a 2D drawing model of feedback between walkers and a diffusing, decaying field on a grid over the
640-unit canvas. It is not a measurement of any organism or chemistry.

## How a step works

Every step runs the same five stages in the same order, for all walkers at once:

1. **Birth**: walkers due this step appear at their emitter (see Release).
2. **Sense**: each walker reads the *old* chemical at two probes, ahead-left and ahead-right, and turns toward
   the stronger one (or away from it). Nothing laid this step is visible yet.
3. **Move**: each walker advances along its new heading; it bounces off the canvas edge and off barriers.
4. **Deposit**: each walker adds chemical where it now stands; each emitter adds its beacon.
5. **Relax**: the chemical spreads to neighbouring cells (diffusion), then fades (decay).

So a walker follows what earlier steps left, including its own earlier path and its neighbours', and the more
walkers pass, the more they attract. Each walker's random wander comes from its own seeded stream, so adding or
removing one walker never shakes the others.

## The colony

| Controls | What changes on the canvas |
|---|---|
| **Emitter layout**, **Emitters** | Where the colonies start: evenly on a ring, evenly along a line, or scattered in a disc (the seed scatters them; adding one keeps the others). A single emitter sits at the center; a scatter's first emitter does too unless a barrier covers it. |
| **Agents per emitter** | Population of each colony. More walkers make thicker, faster-forming veins. Emitters × agents may not exceed 2,400. |
| **Strength taper** | Makes later emitters weaker (they lay less chemical and their beacon is fainter), so colonies compete unequally: 1 makes the last emitter lay nothing, and its walkers only follow. |
| **Release** | 0 starts everyone at once; a positive number streams walkers out over that many steps, one emitter after another. |
| **Lifespan** | Walkers die after this many steps (0: never). When all have died and no beacon leaks, the chemical fades away and the drawing stops changing. |
| **Center X/Y**, **Layout radius**, **Spawn radius**, **Layout angle** | Position of the emitters and of the barrier; the ring radius, line half length or scatter radius; how far around its emitter a walker may start; the turn of the ring or line. Layout and spawn radius scale together as **Size**. |

## Chemistry and sensing

| Controls | What changes on the canvas |
|---|---|
| **Deposit** | Chemical each walker lays per step. It sets the scale: a reading below 0.02 counts as nothing. |
| **Beacon** | Chemical each emitter leaks per step whether or not walkers are near. It marks the nests and pulls walkers out toward and between them; 0 leaves the field to the walkers. |
| **Diffusion** | How far a deposit spreads per step. High values blur trails into halos that walkers sense from further away; low values keep narrow veins. |
| **Decay** | How fast the chemical fades. Fast decay makes walkers follow only fresh trails; slow decay lets old ones keep pulling, so loops persist. |
| **Probe reach**, **Probe angle** | How far ahead and how far to each side the two probes read. Wide probes compare distant sides and hunt for other colonies; narrow ones follow ridges. |
| **Turn rate**, **Attraction**, **Wander** | The largest turn per step; whether walkers follow (positive) or flee (negative) the chemical, and how strongly; the random turn each step. Negative attraction gives territories: walkers avoid each other's trails and spread over the whole canvas. |
| **Speed** | Distance moved per step. |

Positive attraction with little wander pulls a colony into one travelling comet; more wander and a longer
reach give branching and junctions; negative attraction gives cell-like territories.

## Arena and time

| Controls | What changes on the canvas |
|---|---|
| **Edge** | *Walls* bounce walkers off the canvas edge. *Wrap around* joins opposite edges into a torus: trails cross the seam (drawn as separate pieces) and the chemical flows across it. |
| **Field resolution** | Cells per side of the chemical grid. Finer grids follow thinner veins and take longer per step; diffusion and decay are per cell, so a finer grid spreads over shorter distances. |
| **Barrier** | A solid obstacle centered on the middle: a wall with a door, an enclosure with a mouth, an island, or scattered pillars. Walkers bounce off and no chemical crosses. Scatter emitters avoid it; an emitter that lands inside it is reported as an error, not moved. |
| **Barrier size**, **Barrier opening**, **Pillar radius**, **Pillars** | The wall half length or enclosure/island radius; the width of the door or mouth; the pillars (kept clear of the emitters; a count that cannot fit is reported). |
| **Steps** | How many updates have run. Scrubbing up extends the same run; scrubbing down replays from a nearby saved state, so it is quick either way. |

## Drawing the chemical

| Controls | What changes on the canvas |
|---|---|
| **Field** | Contours, filled bands, both, or none. |
| **Levels**, **Lowest level** | How many levels, spaced geometrically from the lowest (a fraction of the current peak) to 85% of it, so faint halos and dense cores both show. |
| **Contour line**, **Contour weight** | Ink, stitch or beads for contour lines, and their thickness. |
| **Band opacity** | Opacity of each filled band; bands lie on each other, so the densest field is darkest. |

## Drawing trajectories and agents

| Controls | What changes on the canvas |
|---|---|
| **Trails** | Each walker's recorded path as ink, stitches, a dry brush of separate hairs, or nothing. The paths are the same whichever material draws them. |
| **Trail share**, **Shortest trail** | Which trails are drawn (a stable draw per walker, so raising the share only adds trails), and the shortest kept. |
| **Trail memory** | How many steps behind each walker are drawn; 0 draws its whole history. Changing it never changes where anyone went. |
| **Trail weight**, **Trail color** | Ink or stitch thickness; one colour or a palette colour per emitter. Emitter colours label where a walker came from; all walkers share one chemical. |
| **Brush width**, **Hairs** | (Bristles) width of the brush and hairs across it. Every trail costs hairs × its length; the total is bounded. |
| **Agent mark**, **Mark share**, **Mark size**, **Mark color** | A small dot, rings, rosette or arrow at living walkers, turned to their heading; which share carry one (a stable draw); its size; one colour or the emitter's colour. |
| **Barrier opacity** | Opacity of the solid drawn where the barrier stands; 0 hides it, but walkers and chemical still respect it. |

Palette colours: the first draws the chemical, the barrier and single-colour marks; the others draw trails
(one per emitter when coloured by emitter, cycling).

## Limits and errors

Nothing is truncated silently. Emitters × agents ≤ 2,400; agents × steps is limited by how much trajectory
history is kept (at 2,400 walkers, about 370 steps); steps × (walkers and grid cells) is limited by work. An
error names what to lower. Speed is at most 8 units per step so that a barrier (at least 14 units thick) cannot
be jumped. A barrier of your own (a resolved region) and your own emitters are accepted by the code API; binding
them to a user's drawing in the app is future work, and saved instruments name only the bundled layouts and
barriers.

Only one chemical is modelled. Several species that repel or attract each other need defined interaction
channels and are not part of this instrument.

## Use it from code

```ts
import { chemotacticTrailsComposition, chemotacticProducts, drawChemotacticTrails, createInstrument } from "@procedurals/instruments";

const recipe = chemotacticTrailsComposition({ ...createInstrument("chemotactic-trails"), seed: 7 });
const { snapshots, field, contours, trails, agents } = chemotacticProducts(recipe); // one cached run
drawChemotacticTrails(p, recipe, { trail: myMaterial, mark: myMark }); // replace any consumer with your own callback
```

`snapshots` holds the retained history (positions of every walker at every step) and saved states; `field` is
the chemical at the last step; `contours`, `trails` and `agents` are frozen and shared between draws.
