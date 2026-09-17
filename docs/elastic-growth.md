# Elastic Strands

Grow three open, pinned strands into folding paper-like lines. Each **Step** grows rest lengths, changes preferred turns, responds to nearby finite segments, and bisects long edges while retaining ancestry. A faint trace shows their original positions. **Reverse curl** changes the future turning direction without changing the current state; **Show structure** reveals retained and inserted nodes. **Reset** restores the starting curves; **Save** downloads the displayed canvas.

| Editable control | Effect on canvas |
|---|---|
| Starting nodes, pins and curves in `packages/javascript/examples/elastic-loops/sketch.js` | Set the original paths and which endpoints stay fixed. |
| `restGrowth` and `turnRates` | Set material lengthening and where each old vertex folds. New midpoint vertices receive zero turn rate until explicitly edited. |
| Reverse curl | Change the sign of the next preferred-turn rates while retaining all current nodes and velocities. |
| `stretchStiffness`, `bendStiffness` | Set the length and turning response. |
| `contactRange`, `contactStrength` | Set finite-segment repulsion; range is a force radius, not hard clearance. |
| `damping`, `dt`, `maxSpeed` | Set movement persistence, step size and speed cap. |
| `maxSegmentLength` | Set when an edge bisects, adding visible material nodes. |
| Node/edge/work/backtrack caps | Bound output size, reserved work and embedding retries. |

The study supplies external accelerations through `elasticLoops.setWind([x,y])`; replacing them changes the next motion step without changing the core. A returned state guarantees embedded centerlines at the end of the step, not the swept path or thick-stroke clearance. The study is intentionally capped at 36 steps so its authored paths stay within the canvas.

The growth controls are motivated by [Hodgin’s *Individuation*](https://roberthodgin.com/project/individuation), whose described curling paper and crowded-curve process are substantially broader than this original planar study.
