# Agent trails

Three rings of points retain their sampled movement paths as nearby relationships pull and separate them. The frame at each tick is replayed from explicit state, so its history is deterministic and editable. This is an original study, not a recreation of a surveyed artwork.

| Control | Canvas effect |
| --- | --- |
| Ticks | Extends the retained trail by replaying the synchronous force step. |
| Radius | Changes the proximity graph used on each replayed step. |
| Avoidance | Changes short-range separation during those steps. |
| Open chains | Substitutes three supplied chains for the proximity graph. |
| Dot marks | Changes trail drawing without changing its retained samples. |

The adapter calls the accepted proximity query and force step directly. The canvas clips drawing only; it supplies no walls, wrapping, or hidden agent behavior.
