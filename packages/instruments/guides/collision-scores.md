# Collision Scores

Discs are launched into a container and bounce off its walls and each other. Every contact is kept
as a record (when, which two bodies, where, along which normal, how hard), and the drawing is read
from that record: each disc's **trail** with an exact corner at every bounce, a **mark** at each
contact sized by its impulse, **rays** along the directions the discs left in (and arrived from), a
**graph** joining discs that met, the discs themselves and the container outline. All of them read the
same log, so switching one treatment off or replacing it moves nothing else.

The default releases fourteen discs one by one from a nozzle on the left of an ellipse: a fan of
straight trails with a corner at every bounce, rings on the harder hits, and red graph lines between
the discs (drawn where they ended) that met, heavier where they met harder.
Change one launch heading by a degree and every later bounce changes: the score is the consequence of
the initial conditions, not a texture.

This is a 2D model of frictionless discs with exact reflection laws, not physical accuracy: no
spin, no deformation, no rolling. Your own container or region is a future host feature; the
instrument stores only a bundled container name and scalar settings, while the library accepts any
planar domain (see the end).

## The motion

| Controls | What changes on the canvas |
|---|---|
| **Container**, **Barriers**, **Barrier count/size/tilt** | The walls: rectangle, ellipse (a 96-sided polygon), diamond, an L-shaped room whose inner corner is struck as a point, or a box around a diamond island; plus staggered round pins or tilted slats. Pins that would not leave room for a disc are left out, and nothing blocks the emitter. |
| **Center, Width/Height, Rotation** | Where the container sits, how large it is and its turn. The emitter does not turn with it. |
| **Bodies**, **Radius**, **Radius spread**, **Mass** | How many discs, their size, and how sizes vary (a stable seeded draw per disc). *Mass by area* lets big discs barely deflect when small ones hit them. |
| **Emitter** and its position, size, angle, **Release every** | Scattered over the container, evenly on a line or ring, or released one by one from a nozzle. A birth waits while the nozzle is occupied. A line or ring too small for all discs at once releases them one after another, in order, as each one's own place frees up (at most eight per step); a place against a wall is refused, and a disc that never leaves keeps the rest unborn. |
| **Heading**, **Heading spread**, **Speed**, **Speed spread** | Launch direction and speed, with seeded variation per disc. |
| **Disc bounce**, **Wall bounce**, **Wall friction**, **Gravity** | Elasticity between discs and against walls (1 conserves energy exactly), friction on the sliding component at walls, and a downward kick each step. Lossy contacts settle: a disc at rest stops bouncing. |
| **Steps**, **Recording window** | How long the motion runs, and how many of the last steps are drawn (0 draws everything). Later steps only extend earlier ones, so dragging Steps never rewrites the past. |

## What is drawn

| Controls | What changes on the canvas |
|---|---|
| **Contacts shown**, **Weakest contact**, **Smallest size** | Which contacts get marks and rays (disc, wall or all); contacts weaker than this share of the strongest impulse are dropped, which hides the tiny impulses of grazing; and the size the weakest shown contact keeps. Sizes follow the square root of the impulse. |
| **Color by** | Body: each disc its own color. Kind: trails, disc contacts and wall contacts in three colors. Time: palette colors in order through the window (trails are cut into that many bands). |
| **Container outline**, **Draw discs** | The walls and posts; the discs at the end of the window at true radius. |
| **Trails**, weight, spacing, bead, brush width | Each path as ink, stitches, beads or a dry brush. Only the recording window changes which part is drawn. |
| **Contact mark**, size, line weight, petals | Dots, rings, rosettes or arrows at each contact point, turned to its normal. |
| **Bounce rays**, length, weight | Rays along each disc's outgoing direction (or also its incoming one); length follows the impulse. |
| **Contact graph**, nodes at, line weight, node size | One line per pair that met, thickness by summed impulse; nodes at each disc's final position (the drawn discs) or at the mean of its contacts, which pulls a long run toward the middle. |

Palette, mark, material and window edits repaint the same recorded motion: only initial-condition
edits (container, barriers, bodies, emitter, launch, bounce, gravity, seed) and the step count run
the simulation, and more steps run only the new ones.

## Try these

- **Billiards:** *Emitter* scattered, *Heading spread* 180, *Container* rectangle, *Trails* none, *Contact graph* on, *Mass* equal.
- **Pinball:** *Barriers* pins with 4 rows, *Gravity* 0.03, *Wall bounce* 0.8, a nozzle at the top.
- **Fountain of chords:** *Emitter* ring, *Heading* 0, *Container* ellipse, *Trails* stitch.
- **Impact map:** *Trails* none, *Contact mark* rosettes, *Weakest contact* 0.3, *Color by* time.
- **One late second:** *Steps* 600 and *Recording window* 80 draws only the end of a long run.

## Use the pieces in code

```js
import { bundledContainer, collisionModel, collisionSnapshots, collisionScore, atEach, strokeWith, motif, pathMaterial } from "@procedurals/instruments";

const model = collisionModel({
  container: bundledContainer({ shape: "rectangle", centerX: 320, centerY: 320, width: 400, height: 300, rotation: 0 }), // any planar domain
  posts: [[320, 320, 20]],                                       // [x, y, radius] round obstacles
  bodies: { count: 6, radius: 10, radiusSpread: 0, massLaw: "equal" },
  emitter: { mode: "scatter", x: 0, y: 0, extent: 0, angle: 0, every: 0, heading: 0, headingSpread: 180, speed: 4, speedSpread: 0.2 },
  physics: { restitution: 1, wallRestitution: 1, wallFriction: 0, gravity: 0 },
});
const score = collisionScore(collisionSnapshots(model, 7, 300));   // cached, frozen; the same call again returns the same object
score.contacts[0];  // { id, time, a, b, point, normal, impulse, approach, aIn, aOut, bIn, bOut, ... }
score.trails[0];    // { body, times, xs, ys }: a vertex at every whole step and at every contact
```

`drawCollisionScores(p, recipe, { trail, mark, ray, edge, node, disc })` replaces any treatment with an
ordinary callback while the score stays the same object; `collisionScoresComposition(input)` resolves the
named instrument to its recipe. Lengths are canvas units, speeds units per step, angles degrees.

## Model and limits

One step is one frame. Gravity is a velocity kick at the start of a frame; between contacts discs fly
straight, and the earliest contact of the frame is solved exactly and resolved, repeatedly, so there
is no tunnelling at any speed and nothing is ever pushed apart to repair an overlap. Contacts closer
than 1e-9 frames are simultaneous and resolved walls first, then by lower disc number, then by the
other body's number. Equal-mass elastic discs conserve momentum and kinetic energy exactly and
reflect at the incoming angle; with gravity, energy is not conserved. Resting contact under gravity
(approach speed within twice the kick) is resolved but not recorded.

At most 96 discs, 3000 steps, 4000 wall elements, 30,000 records, and a per-frame contact bound. Over
a bound the error names the control to change and nothing is truncated. A set-up that cannot place
its discs (nozzle or a line/ring place against a wall) is refused with the control to change; scatter is
checked by area (at most 35% of the container) and finally by the seed's own placement.
