# Bridge Web

Weave a finite network by adding one short link at a time between adjacent crossings. Seven authored, noncrossing strands establish the starting shape. **Insert bridge** advances a bounded sequence of candidate segments; **Change route** selects a different crossing gap and slant for the next link. Coral links show inserted edges, while ink-colored strands retain their shape through splits. **Reset** restores the initial graph; **Save** downloads the displayed canvas.

| Editable control | Effect on canvas |
|---|---|
| Strand points in `packages/javascript/examples/bridge-web/sketch.js` | Change the web's starting silhouette and spacing. |
| Candidate y, slant and `gapIndex` schedule | Change where each short bridge joins neighboring strands. |
| Route button | Change the next candidate and crossing-gap selection without changing existing graph state. |
| Node/edge/work caps | Bound the number of inserted links and exact geometric work. |

The study uses `graph.insert-segment-bridge-2d` for every split and link, and uses returned events to keep strand and bridge colors attached to their descendants. `bridgeWeb.setGraph(graph)` accepts an independent embedded graph for transfer. For related composition context, see [Hoff's *A Tangle of Webs*](https://inconvergent.net/2019/a-tangle-of-webs/).
