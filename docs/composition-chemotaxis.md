# Chemotactic Trails (brief 17)

Status: **implemented on branch `w3/chemotactic-trails`, unreleased. Reviewed from rendered output only (SVG
rasterized with Chromium); not yet exercised through the real Studio interface, layered in the app, or reviewed
for responsiveness there.** It runs through the [stateful snapshots](composition-snapshots.md) foundation (F7)
and uses the existing path materials, motifs, bristle brush and planar domains. Guide:
`packages/instruments/guides/chemotactic-trails.md`. Code: `src/composition/chemotaxis.ts` (model and
producers), `chemotaxis-layouts.ts` (emitter layouts, bundled barriers), `chemotaxis-draw.ts` (recipe,
consumers, drawing), `src/adapters/chemotactic-trails-instrument.ts` (controls); tests
`tests/composition-chemotaxis.test.ts`.

## Artist-facing brief

Trails and colonies that reorganize because the walkers both sense and change their environment. Sensing
Trails (existing) reads a *fixed* landscape; here the landscape is the walkers' own diffusing, decaying
deposit, so trails reinforce into veins, colonies from different emitters meet, loops form and barriers
redirect them. One run is drawn three ways: the chemical as contour lines and/or filled bands, every walker's
recorded trajectory through `pathMaterial` (ink, stitch) or the dry brush (`bristleMaterial`), and a `motif`
at the living walkers turned to their heading. Emitters (position, count, strength) and barrier regions are
editable; scrubbing the step count grows the same colony.

Honest scope: a 2D model on a square grid over the 640-unit canvas. It is a drawing model of feedback between
walkers and a field, not a physical or biological measurement, and one chemical is modelled (see "Species").

## Model and frozen update order

One `Simulation` (`chemotactic-trails`): state after `k` steps from state after `k − 1`.

State: chemical `field` (`grid × grid`, row-major, cell `(i, j)` centred at `((i + ½) c, (j + ½) c)`,
`c = 640 / grid`), `wall` mask, and agent slots in birth order (`x`, `y`, `heading` in turns, `alive`, `origin`
emitter, `strength`, birth step) with a birth counter `next`. Ids are `agent:<serial>`; a slot is never reused;
a dead agent keeps its slot and last position.

Stages of step `k ≥ 1`, all agents in ascending id, all synchronous with respect to the field:

0. **birth**: slots whose birth step is `k` appear at their emitter (position drawn in the spawn disc, heading
   uniform, from the agent's own stream `birth`; if the drawn cell is a wall the emitter position is used);
1. **sense**: reads the OLD field at two probes (`reach` ahead, heading ∓ `sensorAngle`, bilinear); contrast
   `s = (R − L) / (R + L + 0.02)`; `turn = attraction · turnRate/360 · s + wander/360 · (2u − 1)` turns, `u` from
   the agent's stream `wander` at this step. Only headings change;
2. **move**: `speed` along the new heading. Wall mode: a move whose end or midpoint leaves the arena or lies in
   a wall cell is blocked per axis (position kept, heading mirrored on that axis; a blocked diagonal reverses);
   wrap mode: torus. A move never lands in a wall cell;
3. **deposit**: each living agent adds `deposit · strength` bilinearly over the four nearest cell centres
   (wall cells excluded, their share renormalised, so the whole amount lands), then each emitter adds
   `beacon · strength` at its position;
4. **lifespan**: an agent that has acted `lifespan` steps dies (0: never; an agent born at step `b ≥ 1` acts at
   `b, b + 1, …`; agents born at step 0 first act at step 1);
5. **relax**: diffusion `c + (D/4) Σ_open (n − c)` (conserving; no flux through wall cells or the arena edge, or
   torus), then decay `× (1 − decay)`; wall cells are zero.

Nothing in 1 and 2 sees the deposits of step `k`; an agent responds to what earlier steps laid. The probes and
the bilinear sampling (boundaries `clamp`/`wrap`) are those of `sensorMotorStep2D`, which the tests use as the
oracle; the contrast normalisation (chemotaxis is a relative reading, so emission strength need not retune the
gain), noise, walls, deposit and relaxation are this model's.

**Termination.** When no agent is alive, none is left to be born, and no emitter leaks, the chemical only
decays; it is set to zero when its maximum falls below 1e-9 and the state is `halted`: every later step returns
it unchanged. A colony with nobody to bear is halted at step 0. A leaking emitter never halts.

## Contract

Inputs (`ChemotaxisConstruction`, plain data): `emitters[]` (`x`, `y`, `agents`, `strength`), `spawnRadius`,
`release`, `lifespan`, `deposit`, `beacon`, `diffusion`, `decay`, `reach`, `sensorAngle` (degrees), `turnRate`
(degrees per step), `attraction` (−1…1), `wander` (degrees), `speed`, `edge` (`wall`/`wrap`), `grid`, `barrier`
(resolved planar regions, `PlanarRegionData[]`), plus `seed` and `steps`. Units: canvas units and steps;
chemical in units of one agent's deposit per step (readings below 0.02 count as nothing).
Appearance never enters the construction or the cache key.

Outputs, all frozen and cached: `chemotaxisSnapshots(...)` → `Snapshots` (history: one `ChemotaxisFrame` per
step with `x`, `y`, `heading` as `Float32Array`, `live`, counts, `fieldMax`, `fieldTotal`, `halted`; checkpoints
every 40 steps, held privately; `stateAt`/`finalState` return copies); `chemicalField(snaps, step?)` (values,
wall mask, max, total); `chemotaxisTrails(snaps, {memory, minLength})` (paths `trail:agent:<n>`, `#1`, `#2` …
where a torus wrap cuts it; positions at consecutive steps from birth or `steps − memory` to the last living
step plus the move that ended it); `chemotaxisAgents(snaps)` (sites: id, heading angle, origin, alive);
`fieldContourPaths(field, levels, seed)` and `fieldBands(...)` (closed level-set rings by the linear-time
marching squares of `iso-rings.ts`, crossings linear along grid edges). `chemotacticProducts(recipe)` bundles
them; `drawChemotacticTrails(surface, recipe, {contour, trail, mark})` draws barrier, bands, contours, trails,
marks and accepts an ordinary callback for any consumer.

Ownership: builders own their arrays; every published value is frozen or a private copy (typed arrays are
typed read-only; do not write them). Seeds: emitter scatter and pillar placement from `componentSeed(seed,
id, purpose)`; agent birth and wander from `ctx.stream(agentId, purpose)`; never draw-order randomness.

Failure: nothing is truncated or replaced by a fallback; every error names the control. Bounds: agents ≤ 2,400
(`Emitters × Agents per emitter`); trajectory history `4 · agents · (steps + 1) ≤ 3,600,000` values
(`Agents × Steps`, about 370 steps at 2,400 agents); work `initial + steps · (16 · agents + grid²) ≤
60,000,000` (`Steps × (agents and field cells)`); `grid` 16…256; `steps` ≤ 1,200; `speed` ≤ 8; emitters ≤ 16;
contour vertices ≤ 150,000 (`Contours`, `Lowest contour`); bristle hair points ≤ 600,000
(`Hairs`, `Trail share`, `Trail memory`, `Shortest trail`). An emitter inside the barrier is an error
(`Center X/Y`, `Layout radius`); a pillar count that cannot fit clear of the emitters is an error; emitters are held inside the canvas (a ring past the edge or a center dragged to 640 is clamped to the edge); scatter
emitters move to a clear place instead (up to 40 redraws from their own stream, else an error). Instrument
admission (`definition.validate`) applies the budget and the seed-free placement checks before drawing.

## Controls, groups, dependencies

Groups (top level): Colony · Placement · Chemistry · Sensing · Arena · Time · Field · Trails · Agent marks ·
Barrier fill. Placement follows the first construction section: `centerX`, `centerY`, then the proportional
**Size** subgroup (`layoutRadius`, `spawnRadius`: two radii, one unit, zero means none) and `layoutAngle`.
The only proportional group is Size; `Probes`, `Steering` and `Brush` are plain subgroups.

Inline `visibleWhen`: `layoutAngle` ← layout ring/line; `barrierSize` ← barrier wall/enclosure/island;
`barrierGap` ← wall/enclosure; `pillarRadius`, `pillars` ← pillars; `barrierOpacity` ← any barrier;
`contours`, `lowestContour` ← field ≠ none; `contourLine`, `contourWeight` ← field contours/both;
`washOpacity` ← field bands/both; `trailShare`, `trailMemory`, `trailMinLength`, `trailColor` ← trails ≠ none;
`trailWeight` ← ink/stitch; `brushWidth`, `hairs` ← bristles; `markShare`, `markSize`, `markColor` ← mark ≠ none.
Slider intervals are the useful range; hard limits are the model's (e.g. steps slider 0…600, hard 1,200
subject to the coupled bounds above; agents slider 10…150 per emitter, hard 1,000: every slider at its maximum together is admitted, tested).

Persisted settings are technique id, scalars and palette only. Bundled emitter layouts (ring, line, scatter)
and barriers (wall with door, enclosure with mouth, island, pillars) are validated selects; a user's own
emitters and barrier region are accepted by the direct API as typed values, and binding them to a user's asset
in the host is future work. Palette: tone 0 the chemical, barrier fill and single-colour marks; tone 1 trails;
with "by emitter" emitter `k` uses `1 + k mod (palette size − 1)`.

## Species

Several species (or repulsive and attractive channels between colonies) are **not** implemented. They are a
defined extension only when interaction channels are specified (one field per species, a matrix of who senses
and lays what); a palette colour per emitter here is a label of origin over one shared chemical, and the guide
says so.

## Checks

`tests/composition-chemotaxis.test.ts` (27 tests, including every numeric control at its slider minimum and maximum, alone and together, admitted, drawn and within the declared work; independent expectations): relaxation weights and total
(quarter shares, decay, corner and torus, wall on each of four sides); the bilinear sampler equals
`sensorMotorStep2D`'s probes and samples (clamp and wrap); every step of a 24-step colony equals the
oracle-computed sense-then-move from the previous state (heading to 1e-12, position to 1e-9); a fresh deposit is
never sensed the same step; without chemical agents keep their heading and with it they turn (same seed);
attraction/ignore/flee ordering; a beacon-only field equals the closed form `B(1−d)(1−(1−d)^k)/d` with and
without a barrier; total chemical `= deposit · strength · steps acted` with birth schedule and lifespan, also
beside walls; birth counter ids, emitter round robin and release schedule; halting (identical states after,
never with a leaking emitter, at step 0 with nobody to bear); `checkSimulation` (bit-identical replay, spacing
invariance, prefix, resume equals scratch, replay from a longer run's checkpoint) with barriers, release,
lifespan and wrap; cancellation leaves nothing in the cache and a retry equals a clean run; no agent in a wall
cell at any step, wall mask equals the barrier geometry, wandering agents find the door; emitter in barrier
error; trajectories equal the history (prefix, ids, death, memory window, torus cuts); layouts; contour
vertices sample to the level and areas shrink with level; bounds name the control; recolour and every drawing
edit return the same snapshots object and structural edits do not; the chemical's centroid follows a moved
emitter and moved colonies diverge; trail materials share paths; the instrument prepares/cancels and stays
transparent; hidden controls change nothing (11 selections); groups. The global conditional-control property
test and `audit-controls` run on this instrument too (audit: 1,603 probes, 0 violations, 0 dead, 0 numeric).

Mutations confirmed to fail (each by at least one test): diffusion leaking into walls; turn sign flipped;
lifespan off by one; deposit not renormalised beside walls; deposit before sensing; birth schedule off by one;
appearance (a trail weight) in the cache key; a changed sensing floor.

## Review record

Rendered defaults, three seeds (42, 7, 1234567, plus 99), twelve structural settings (ring, line and scatter
layouts; wall with door, enclosure, island, pillars; wrap; repulsion; release plus lifespan streams; one large
colony; eight small ones; beads, bands, bristles, rosettes), early/mid/late steps (0, 25, 60, 140, 300, 600),
sparse and dense/extreme cases (12 agents; 2,400 agents at grid 160; decay 0; diffusion 0; grid 48 and 160;
speed 8 and wander 45; turn 90°, angle 90°, reach 60), and layered compositions with existing unmodified
instruments in both orders (Contour Scores, Motif Ecologies, Substitution Tilings). Defects found by looking
and fixed:

- First defaults (attraction 1, wander 6) collapsed every colony into one comet that left the canvas: dull.
  Retuned defaults (attraction 0.5, wander 14, beacon 0.6, spawn radius 30, 150 agents): visible progression
  from knots to veins to loops and junctions.
- Bands compounded to a muddy grey at 0.12 opacity: default 0.06, slider 0.02…0.5.
- Agent marks were invisible (same colour as a trail, 9 units): single-colour marks use tone 0, default
  size 11, share 0.2.
- The conditional-control property test drew a configuration the admission accepted but drawing rejected
  (an emitter inside the barrier): scatter emitters now avoid solid barriers, and admission checks the
  seed-free placements.
- A scatter layout with a barrier at the center always errored (emitter 1 sits at the center): a blocked
  center emitter now scatters.

Timings (Node, null drawing surface, this machine, best of one process): default 92 ms first draw, 3 ms
appearance-only edit, 54 ms structural edit (emitter moved); steps at the slider maximum (600 steps, 600
agents, grid 96) 123 ms first, 1.3 ms recolour, 135 ms structural edit, 16 ms for +1 step, 21 ms for −1 step;
2,400 agents, grid 160, 370 steps with bands, contours, every trail and a mark on every agent 467 ms first,
18 ms recolour, 463 ms structural edit; bristles on 15% of 600 agents 126 ms first, 3 ms recolour.

## Open concerns and decisions to confirm

- The sense rule is implemented in `chemotaxis.ts`, not by calling `sensorMotorStep2D`: that operation
  validates its whole input (every field cell) per call, which would dominate a run, and has no noise or walls.
  Probes and sampling are tested equal to it; the contrast normalisation is a deliberate departure (gain acts on
  `(R − L)/(R + L + 0.02)`, not `R − L`). Say if the raw-difference rule is preferred.
- Retention (checkpoint every 40 steps, history every step) is fixed and part of the key. History stores
  positions as `Float32` (4 values per agent per step); a 2,400-agent run is about 3.7 million values, so the
  shared cache (8 million values) keeps only one or two such runs: scrubbing steps within one construction stays
  cheap, alternating between two huge colonies recomputes.
- Barriers thinner than about half a step can be crossed in the direct API (moves are tested at midpoint and
  end); bundled barriers are at least 14 units thick and speed is capped at 8.
- Diffusion and decay are per cell per step, so changing Field resolution changes the physical spread; it is a
  separate control from the drawing on purpose, and the guide says so.
- One chemical only; multiple species left undefined (above).
- The default step count (140) and trail memory (70) were chosen by eye for the transition from knots to veins.
