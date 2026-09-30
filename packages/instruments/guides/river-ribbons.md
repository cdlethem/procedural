# River Ribbons

A river that has been wandering across its valley for a while. The picture is one bold teal ribbon, widening
downstream, looping through the valley; behind it, hundreds of fine brown lines are every place the channel has
been, dense where a bend crept sideways for a long time and fading with age; and here and there a pale ring or
crescent is an oxbow, a bend the river gave up when its neck wore through. A new seed is a different valley
history (a different starting wiggle and different resistant ground), not a reshuffle of one drawing.

The model is small and stated. The channel is a line of equally spaced nodes. Each step, every node moves sideways
toward the outside of its bend by an amount proportional to the **curvature there, averaged along the channel**;
the line is then resampled at equal spacing and checked for cutoffs. When two distant parts of the channel come
closer than the *cutoff neck*, the loop between them is cut out: it stops being channel and becomes an oxbow with
its own age. Every step's centerline is kept, so dragging **Migration steps** replays the river's history and
going back is cheap. This is a specified artistic model in two dimensions, not a hydrological prediction: there is
no flow solver, sediment budget or terrain.

## Shape the river

| Controls | What changes on the canvas |
|---|---|
| **Starting channel** | *Wandering* is a seeded, irregular offset from the valley axis; *sine-generated* is the regular sine-generated curve real meanders follow (the same for every seed). |
| **Wiggle harmonics / Start amplitude** (wandering) | More harmonics give more, tighter bends along the valley. Amplitude is how far they swing across the room between the valley walls; 0 is a straight channel, which never moves. |
| **Start wavelengths / Start turn** (sine-generated) | How many bend pairs, and how sinuous. The curve is shrunk across the valley if it would not fit between the walls. |
| **Valley center X/Y, Valley angle** | Where the valley is and how it is turned. 0 runs left to right. |
| **Valley length / half-width** | A rectangle whose long walls and end walls the banks never cross. The inlet and outlet are pinned to the axis a tenth of the length inside the end walls. A narrow valley presses bends against its walls and cuts them off often; a wide one lets them grow. Drag them together to scale the valley. |
| **Channel width** | Inlet width in canvas units. Node spacing, smoothing and the cutoff are measured in widths, so a wider channel is the same river at a larger scale. |
| **Outlet discharge** | Discharge grows along the channel to this multiple of the inlet; width follows its square root. 1 keeps the width constant. |

## Make it migrate

| Controls | What changes on the canvas |
|---|---|
| **Migration steps** | How long the river has been moving. Every step is kept; scars are the earlier steps. |
| **Bank mobility** | Distance moved per step, in widths per unit of (width × curvature): how fast bends grow and travel. 0 freezes the river. |
| **Smoothing length / Downstream lag** | The averaging length, in widths. Long makes broad rounded bends; short lets tight ones run away. With lag 1 a bend feels only the curvature upstream of it, so bends slide downstream as they grow; 0 is symmetric. |
| **Bank resistance** | 0 erodes uniformly. Higher leaves resistant patches the channel bends around and soft ground where it swings, different for every seed. |
| **Cutoff neck** | A bend is cut off when its neck is narrower than this many channel widths and the loop between is at least half a circle long. Small lets loops grow tight before cutting. |
| **Node spacing** | Equal spacing of the centerline, in widths. Finer follows tight bends; coarser is cheaper. It cannot exceed half the cutoff neck, which is what stops one limb crossing another between steps. |

## Draw it

| Controls | What changes on the canvas |
|---|---|
| **Current channel**, opacity, **Bend widening**, **Bank lines** and weight | The ribbon of the current channel, its width from the discharge; widening swells it at the tightest bends (drawing only, it never changes how the river migrates). Bank lines outline both edges. |
| **Old channels** (lines or bands), **Scar interval**, opacity, weight | Earlier channel positions every so many steps from step 0. Lines are thin centerlines (a scroll-bar pattern); bands are full ribbons. New scars are strong and older ones fade. |
| **Oxbows** (ribbon, ink, stitch, beads), opacity, mark size | The abandoned bends. A ribbon narrows and fades with age; the others follow the oxbow's centerline with a stock path material. |
| **Fade age / Infilling** | The age in steps at which scars and oxbows are faintest, and how much of an abandoned channel's width sediment has filled by then. |
| **Age field**, cell, opacity | Tints the floodplain by how long ago the channel last occupied each cell, newest strongest. |

Drawing controls never change the river: changing them repaints the same retained result at once. Changing the
starting channel, valley, width, migration, cutoff, spacing, steps or the seed recomputes it; dragging steps up
costs only the new steps.

## Try these

- **Scroll bars:** *Scar interval* 1, *Old channels* lines at weight 0.6: every position, a woodgrain of migration.
- **Quiet river:** *Bank mobility* 0.08, *Smoothing length* 5, *Bank lines* off: broad slow bends, few cutoffs.
- **Switchbacks:** *Valley half-width* 90, *Start amplitude* 0.9: the channel presses against both walls.
- **Oxbow beads:** *Oxbows* beads, *Fade age* 400, *Infilling* 0.2: abandoned bends as strings of beads.
- **Age map:** *Age field* on with *Old channels* off: a tinted floodplain and the ribbon.
- **The sine river:** *Starting channel* sine-generated, *Start wavelengths* 3, *Start turn* 65.
- **Layers:** transparent, so it sits over or under Contour Scores or Region Quilts; reorder and edit either.

## Use the pieces in code

The river, its history, its oxbows and each treatment are ordinary values; the named instrument is these functions.

```js
import { riverRibbons, riverTraces, oxbowPaths, riverAgeField, riverFields, riverBanks, ribbonHalfWidths,
  strokeWith, pathMaterial } from "@procedurals/instruments";

const river = riverRibbons({ seed: 7, steps: 240, centerX: 320, centerY: 320, length: 600, angle: 0, confinement: 190,
  planform: "wandering", harmonics: 6, amplitude: 0.6, waves: 3, turn: 60,   // the ignored planform's controls are not part of the identity
  width: 8, discharge: 2, mobility: 0.22, smoothing: 3, skew: 0.5, heterogeneity: 0.4, spacing: 0.7, cutoff: 3 });

river.channel.xy;                 // interleaved x, y of the current centerline; channel.ids are its node ids
river.frames[100].xy;             // the centerline after step 100 (every step is kept, oldest first)
river.oxbows;                     // { id: "oxbow:0", born, closed, ids, points, width, distance }, in birth order
const banks = riverBanks(river.channel.xy, ribbonHalfWidths(river.channel.xy, river.channel.width, river.channel.curvature, 8, 0.35));
strokeWith(p, riverTraces(river, 3), (surface, path) => { /* any path material; path.level is the step */ });
strokeWith(p, oxbowPaths(river), pathMaterial({ kind: "beads", /* … */ }, [0x2f7f86]));
const age = riverAgeField(river, 6);   // age.last[cell] = last step the channel was there, or -1
```

`riverRibbons` returns the same frozen scene object for the same construction, whatever you draw with it.
`riverRibbonsComposition(input)` resolves the named instrument to a typed descriptor and
`drawRiverRibbons(p, recipe, { ribbon, scar, oxbow })` replaces any consumer with your own callback. Lengths are canvas
units except node spacing, smoothing and the cutoff (in channel widths); angles are degrees; time is whole steps. A
limit that would be exceeded is reported naming the control that controls it, never truncated silently.
