# Region marks

A seeded quadrant partition repeatedly replaces one eligible leaf with four quadrants. **Center X/Y** and **Width/Height** define the local rectangular source. **Refinements** and **Refinement eligibility** control the hierarchy; lower eligibility favors recently appended leaves less often and creates different scale relationships. **Maximum visible depth** recombines deeper leaves into their original quadrant ancestors without leaving holes; depth 0 is the full source, depth 1 has up to four quadrants. Seed changes subdivisions, not just colors. **Leaf retention** then selects the visible leaves independently of refinement, creating omissions without moving the surviving cells.

| Controls | What changes on the canvas |
| --- | --- |
| Center X/Y, Width/Height | Place and size the rectangular source of the partition, without fitting it to the canvas. |
| Refinements, Refinement eligibility, seed | Build the quadrant hierarchy: more successful refinements can create smaller leaves; eligibility changes which live leaves can split next. |
| Maximum visible depth, Leaf retention | Recombine deeper cells into their ancestors, then independently omit visible leaves without changing their underlying splits. |
| Fill leaves, Outline leaves, Inset, Outline weight | Treat the retained leaf backgrounds and borders independently; inset can erase tiny painted leaves. |
| Leaf marks, Marks per leaf, Mark scale, palette | Add none, dots, lines or dot grids inside retained leaves; control repetition, relative size and color without rebuilding the partition. |

**Fill leaves** and **Outline leaves** can each be disabled. **Leaf marks** chooses no mark, a dot, a horizontal line or a dot grid. **Marks per leaf** repeats dots/lines or sets the grid side length; **Mark scale** measures against the leaf's short side. **Inset** shrinks fills/outlines, and sufficiently tiny leaves may not draw at all. Nothing automatically draws paper or a frame.

Try a sparse corner patch with Center X 165, Center Y 500, Width 210, Height 180, Refinements 15, Retention .2, Fill off, Outline off, Mark dot, Marks per leaf 1. For a layered hierarchy, try Width 510, Height 320, Refinements 35, Eligibility .45, Retention .75, Outline on, Fill off, Mark grid, Marks per leaf 3 and Mark scale .3. Extreme repeated refinement can exhaust finite coordinate precision; reduce replacements or enlarge the source if the operation rejects the depth.
