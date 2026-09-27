# Neighborhood growth

Seed an initial population in an area, a ring or a line, and independently seed a proposal pool in a separate square region. Each tick queries the current exact relative-neighborhood graph, relaxes eligible edges synchronously, then admits density-qualified proposals. New points enter the graph on the next tick. Open chain replaces the exact graph with adjacent-index links, while keeping the same relaxation and admission rules.

| Control | Canvas effect |
| --- | --- |
| Initial points / Source shape / Source extent / Source aspect | Construct the initial population and choose its footprint. |
| Source X / Source Y / Source direction / Source disorder | Place, rotate and perturb the initial source without moving the proposal pool. |
| Proposal count / Pool X / Pool Y / Pool extent | Independently choose how many candidates exist and where they can arrive. The pool has its own seeded stream. |
| Ticks / Insert per tick | Set the number of relaxation/admission rounds and their per-round acceptance target. |
| Density radius / Min neighbors / Max neighbors | Admit only candidates with a nearby **existing** population inside the inclusive count interval. Zero minimum permits remote islands; a positive minimum propagates from current material. |
| Open chain / Length threshold / Relaxation step | Choose the exact graph or indexed chain, the eligible edge lengths and displacement strength. |
| Graph lines / Graph weight | Show current edges independently; zero graph weight leaves no graph strokes. |
| Nodes / Dot diameter | Draw current points independently from line strokes. Seed and admitted nodes use separate palette slots. |
| Displacement traces / Trace weight | Optional lines from seed positions to current positions; off by default. |

For **a compact spreading colony**, use a 16-point ring, source extent 95, a 160-point pool of extent 220 centered on the ring, density radius 50 and min neighbors 1. For **detached sparks**, move the pool to (490, 160), use a sparse 10-point line centered at (180, 440), set min neighbors 0 and insert 2; experiment with traces off so the graph remains a reusable fragment. The pool, count and ticks share a cubic exact-neighbor and candidate-judgment budget: if their combined worst case is too costly, reduce one of them rather than expecting clipping or hidden truncation. `relative-neighborhood-pairs-2d`, `threshold-edge-relaxation-2d` and `radius-pairs-2d` perform the graph, motion and density work; no extra boundary force or collision repair is applied.
