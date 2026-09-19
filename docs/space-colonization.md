# Space Colonization

Tips grow toward the nearest unconsumed source; a tip that reaches a source consumes it and branches into rotated offsets. Each **Step** runs one bounded space-colonization operation and appends the grown links to the retained network; the coral tips are the active front. **Branches** sets how many new tips each reached source spawns; **Spread** sets how wide they fan out; both reset the network to a fresh growth. **Auto** grows continuously; **Sources** reveals the target grid; **Reset** restores the seed tips; **Save** downloads the displayed canvas.

| Editable control | Effect on canvas |
|---|---|
| `Branches` button | Cycle the branching factor (1–4); 1 keeps a tip as a single path, 4 fans each reached source into four new tips. Resets the network. |
| `Spread` button | Cycle the branch half-spread (0.3–1.2 rad); larger values fan the new tips wider around the incoming growth direction. Resets the network. |
| `Step` / `Auto` buttons | Advance one growth step, or grow continuously until the active front is exhausted. |
| `Sources` button | Show the distributed target grid; consumed sources dim. |
| Seed tips and target grid in `packages/javascript/examples/space-colonization/sketch.js` | Set the starting front and the field the tips grow toward. |

The step is one portable operation, `growth.space-colonization-step-2d`; it returns the new tips, the segments grown this step, and the updated consumed flags, and takes no palette. The retained node/edge network is the reusable output; steering momentum and a soft source-strength field are separate limits. For related context, see space-colonization models of drainage and plant venation.
