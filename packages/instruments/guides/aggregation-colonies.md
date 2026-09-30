# Aggregation Colonies

A branching accretion: a thin tree of tiny grains with long empty channels between its arms and ragged,
still-growing tips at the outside. It grows the way frost or mineral dendrites do. Walkers are released
from a source, wander at random and stick to the colony where they touch it; the arms shield the channels
behind them, so growth piles up at the tips. The same finished colony is drawn several ways at once: a
mark at every grain, ink, stitches or beads along the parent links, a soft halo, and separate marks at the
active tips, all coloured by when, where and on which limb the grain attached. A new seed grows a
different colony.

This is a specified **2D off-lattice diffusion-limited aggregation** model, not Andy Lomas's 3D Aggregation
process, and it does not reproduce it. It is not a physical simulation either: there is no fluid, charge or
temperature, only walkers with a radius, a sticking chance and an optional drift.

## How a colony grows

One growth step releases one walker. It starts on the **source**, takes steps of random direction, and
when it comes within one grain diameter of the colony it sticks (with the **sticking probability**) and
becomes a new grain exactly one diameter from the grain it touched, which is its parent. A walker that
leaves the canvas margin is lost, and one that wanders too long is abandoned; neither adds anything. If
**Give up after** walkers in a row fail, the colony has run out of room or reach and **stalls**: it stays
exactly as it is, and raising **Walkers** no longer changes it. A colony can also start empty (no seed fits
inside the domain); that is a valid, blank result, not an error.

Growth only ever appends. Raising **Walkers** keeps every grain already there, so the slider scrubs time
without rerolling the structure, and the finished colony is retained: changing colours, marks or ink never
regrows it. Changing anything that shapes a walker or the start (seeds, source, wall, radius, sticking,
wind, seed number) grows a new colony.

## Grow the colony

| Controls | What changes on the canvas |
|---|---|
| **Seed shape**, **Seed grains** | A single point gives one tree. A ring, line or scatter of seeds gives several that compete for the same walkers and meet in the gaps. Seeds outside the wall, or closer than a grain radius to another seed, are dropped. |
| **Seed X/Y, width/height, angle** | Where the seeds sit and how they are spread. Walkers with **Pull to seed** drift toward the seed point. |
| **Source**, **Source X/Y, width/height, angle** | Where walkers start: an ellipse or rectangle outline, a line, or anywhere inside the wall. A source close to the seeds grows a compact colony; a far one lets arms reach out; a line source opposite a line of seeds grows a forest of parallel trees. |
| **Particle radius** | Grain size. A grain sits at twice this from its parent, so it sets the detail scale and how many grains fill a region. |
| **Sticking probability** | Low values let walkers wander into the channels before they stick, filling and thickening the arms; 1 gives the classic sparse tip-dominated tree. |
| **Wind**, **Wind direction** | A drift on every step. Growth builds up on the side facing the wind and starves on the other side; a strong wind against the colony can stop it altogether (it stalls). |
| **Pull to seed** | A drift toward the seeds: it fills the interior and shortens the arms. |
| **Path turning** | Small values make long straight runs, so walkers arrive as streaks and the arms become straighter. |
| **Walkers**, **Step reach**, **Walker lifetime**, **Give up after**, **Escape margin** | Time, and the bounds that end a walker or the run. Reach is a speed only: steps shrink near grains and walls so no contact is skipped. The run's work is bounded by Walkers × Lifetime; over the limit the error names both. |

## Confine growth inside a wall

| Controls | What changes on the canvas |
|---|---|
| **Domain** | None, a rectangle, an ellipse, an ellipse with a hole, letters, or an image silhouette. Its outline and the outline of every hole are walls: walkers bounce off them, grains keep a radius clear of them, and no link crosses one. |
| **Letters**, **Silhouette image**, **Image variant**, **Brightness cut** | The bundled character or picture that becomes the wall, and which pixels count as inside. Counters in R or 8 are holes. A part of the domain that holds no seed stays empty; give each letter or island its own seed (a line or scatter of seeds across it). |
| **Domain X/Y, width/height, Hole size** | Position and size of the domain; letters and images are fitted without stretching. |
| **Domain outline**, **Outline weight** | Draw the walls in the second palette colour. |

Your own type, mask or region enters through the library as a typed region (below); binding a user's
own asset to the Studio layer is future host work. The images here are bundled deterministic samples.

## Draw it

Every treatment reads the same colony.

| Controls | What changes on the canvas |
|---|---|
| **Colour by** | Attachment age (early to late), limb (each seed and each large branch starts a colour), depth in the tree, or flat. A grain has one colour in every treatment. |
| **Colour bands** | How many palette colours age, depth or limb spread over. |
| **Branch taper** | Thins marks and links toward the tips (thickness follows how much of the colony hangs from a grain). 0 keeps everything the same size. |
| **Reveal** | Draws only grains attached by that fraction of the walkers: a time scrub of the finished colony. Colours keep their full-run meaning. |
| **Grain mark**, **Mark size** | The mark at every grain: dot, ring, rosette or arrow, sized in grain diameters. |
| **Tip mark**, **Tip size** | A second mark only at active tips (grains without children). |
| **Halo**, **Halo size**, **Halo strength** | A large translucent dot at every grain; they add up to a soft density field. |
| **Parent links**, **Link weight**, **Link spacing**, **Bead size** | The parent graph as continuous ink, stitches or beads. Each limb is one stroke. |

## Try these

- **Frost:** the defaults; raise **Walkers** and watch the tips advance.
- **Coral:** *Sticking probability* 0.1, *Parent links* none, dots at *Mark size* 1.2.
- **Wind-swept:** a line of seeds at the bottom, a line source at the top, *Wind* 0.4 downward.
- **Lichen in a letter:** *Domain* letters, *Source* inside, a line of 40 seeds across the word.
- **Ring garden:** *Domain* ellipse with a hole, *Source* inside, a ring of 24 seeds.
- **Glowing tips:** *Halo* on, *Tip mark* rosette, *Colour by* depth.

## Use the pieces in code

```js
import { growColony, colonyMarkSites, colonyLinkPaths, atEach, strokeWith, motif, pathMaterial,
  planarDomain, aggregationColoniesComposition, drawAggregationColonies } from "@procedurals/instruments";

const colony = growColony({
  seed: 7,
  seeds: { shape: "ring", count: 6, x: 320, y: 320, width: 80, height: 80, angle: 0 },
  source: { shape: "ellipse", x: 320, y: 320, width: 600, height: 600, angle: 0 },
  domain: { kind: "domain", domain: planarDomain({ outer: [[100, 100], [540, 100], [540, 540], [100, 540]] }) },
  walker: { radius: 3, stick: 0.6, bias: 0, biasAngle: 0, pull: 0, turn: 180 },
  growth: { reach: 40, lifetime: 2500, patience: 80, escape: 60 },
}, 2000);

colony.sites;   // frozen sites grain:0…, each with parent, born, depth, limb, mass, tip
colony.graph;   // directed forest: parent → child, age = steps - born + 1
```

`colony.sites` are ordinary `Site` values, so `atEach(p, colony.sites, motif(spec, palette))` places any
mark, and `colonyLinkPaths(colony, view)` returns `Path` values for `strokeWith` and any path material.
`drawAggregationColonies(p, recipe, { mark, tip, link, halo })` replaces any consumer with your own callback.
The colony, and the site and path lists derived from it, are cached objects: a repaint returns the same ones.
Lengths are canvas units and angles degrees; the library never clears a canvas.

## Limits

Walkers ≤ 12,000; seed grains ≤ 400; Walkers × (Lifetime + 25) ≤ 16,000,000 walker steps (the slider maximum of 4,000 walkers at the default lifetime is 10 million). Over a limit the
error names what to lower and nothing is truncated. Mostly a colony stalls or fills long before the
limits: at the defaults about 1,200 grains from 2,800 walkers, of which roughly half escape.
