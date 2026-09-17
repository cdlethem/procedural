# Draw moving relationships

Start with **Contact Network** to draw changing connections between nearby points.
Start with **Agent Trails** to retain the paths those points travel. Both let you
change which points interact independently from how their movement is drawn.

Run `node tools/serve_survey_coverage_studies.mjs`, then open either
`http://127.0.0.1:8789/packages/javascript/examples/contact-network/index.html` or
`http://127.0.0.1:8789/packages/javascript/examples/agent-trails/index.html`.
The server uses the repository's existing p5 2.3.2 installation.

Both studies start paused. Advance 60 ticks to see the first movement, then advance
again to compare the developing structure. Play advances one logical tick per
draw until tick240. Reset returns to the exact initial arrangement. Save downloads
the displayed canvas without advancing it.

| Edit | Canvas effect |
|---|---|
| Radius54 /86 | Changes which nearby points influence one another; the larger radius usually joins more of the drawing |
| Avoidance .22 /.64 | Changes short-range repulsion on subsequent steps; compare the same starting arrangement to see how spacing evolves |
| Paper / midnight | Recolors the retained state and complete recorded paths |
| Lines / dots | Changes the drawing treatment without advancing or resetting the motion |
| Open-chain study | Replaces changing proximity relationships with three supplied open strokes and starts a new arrangement |
| One tick / +60 ticks | Advances a precise number of logical steps while paused |
| Reset | Restores the initial population, settings, tick and empty movement history |

The controls are authored example choices, not library defaults or measured useful
ranges. In the shared [study source](../packages/javascript/examples/contact-network/study.js),
change initial positions and velocities, the palette, or the fixed edge list to
make another composition. Initial arrays are constructed explicitly with no RNG.
Each point retains the same index throughout a run.

The package removes two algorithms. `radiusPairs2D({points,radius,maxWork})` returns
every unordered pair within the inclusive radius, sorted by original point indices.
`pairForceStep2D(...)` reads those pairs and the complete old positions and velocities,
computes reciprocal attraction and tapered repulsion, then returns detached next
positions, velocities and force sums. No point reads another point's partly updated
state. The studies query the new positions again before drawing current connections.

```js
const { pairs } = radiusPairs2D({ points, radius: 54, maxWork: 20000 });
const next = pairForceStep2D({
  points, velocities, pairs,
  attraction: 0.0011, repulsion: 0.22, repulsionRadius: 42,
  damping: 0.94, dt: 1, maxSpeed: 2.1, maxWork: 20000,
});
const current = radiusPairs2D({ points: next.points, radius: 54, maxWork: 20000 });
// Draw current.pairs with next.points, then retain next as the next tick's state.
```

Attraction grows with distance. Repulsion acts only inside repulsionRadius and
decreases toward its edge. At exactly coincident positions there is no direction,
so the pair contributes zero force. Damping multiplies velocity before movement;
zero damping stops movement on that tick. A speed cap limits displacement after
damping. These are specified rules for an editable drawing system, not a collision
solver or a promise of physical stability.

To substitute a graph, pass its sorted, unique `[i,j]` edges with `i<j` directly to
the same step. The open-chain study does exactly this. It does not infer edges from
distance, close the paths or reconnect crossings. The population order must remain
unchanged while those indices are in use.

The examples keep at most241 position snapshots, including the starting state.
Their viewport clips drawing only: motion has no wrapping, bounce or boundary
constraint. Work budgets count operation events rather than milliseconds. The
radius search can still examine quadratically many candidates, especially when
many points share a narrow x range.

[Reas's Process](https://reas.com/process/) motivates drawing relationships, while
[Tissue](https://reas.com/microimage/) motivates drawing through responsive motion.
The studies use independently specified point interactions. Persistent pair-opacity
and sensor/motor feedback are separate computations. A retained path is a point's
movement history, not memory of a pair's contact.
