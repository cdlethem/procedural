# Recursive Tiles: Grammar Paths starting recipe

The Recursive Tiles starting recipe opens Grammar Paths with an F/G tile path instead of Woven Fold's X/Y fold. A local path grows by editable whole-token parallel productions, then an explicit token turtle draws it. The **axiom** and **F / G / X / Y productions** use only `F G X Y + - [ ]`: F draws **step**, G draws **step × G/F ratio**, X/Y are silent structural symbols, + and - turn by the signed **angle**, and brackets save and restore location and heading. Rules run simultaneously: new tokens are not rewritten again until the next generation. No eval, script fragments, implicit scale-to-page, border or background.

**Depth** sets rewrite generations. **Start X/Y and heading** set local origin and direction in canvas units/degrees. **Path weight**, optional independent **endpoint marks / dot diameter**, and **midpoint ticks / tick length** expose line and mark layers separately. Seed has no effect because the editable grammar is deterministic.

## Control map

| Controls | Canvas effect |
| --- | --- |
| Axiom, F / G / X / Y productions, Rewrite generations (Depth) | Rewrite all chosen symbols in parallel for the specified number of passes; X/Y shape growth without drawing. |
| F step, G/F ratio, Turn angle | Set drawn segment lengths for F and G and opposite turns for `+` and `-`. |
| Start X/Y, Heading | Move and aim the local turtle path directly in canvas space; no page fit is applied. |
| Path weight, Endpoint marks / dot diameter | Change or hide path strokes while optionally showing and sizing drawn-segment endpoints. |
| Midpoint ticks, Tick length | Add normal tick marks midway along drawn segments and choose their length separately. |

## Contrasting recipes

1. **Folded tiles (default):** axiom `F`, F `F+G-F-G-F`, G `G`, depth 4, step 16, G/F ratio .7, angle 90, start (320,320). Repeated F folds retain shorter G connectors in a compact local motif.
2. **Straight rail:** axiom `F`, F `FG`, G `G`, depth 6, step 12, angle 0, start (90,300). Change G/F ratio to separate long and short strokes, then enable endpoint marks.
3. **Branching facets:** axiom `F`, F `F[+G]F[-G]F`, G `G`, depth 3, step 8, angle -35, start (300,500), heading -90. Brackets keep child paths attached to the parent, unlike independent branches.

An empty production erases its symbol on the next generation; an entirely erased drawing is valid. An empty axiom, illegal tokens or unmatched expanded brackets fail with explicit errors. Joint generation/turtle budgets reject exponential growth before allocating rewritten token arrays, and stack depth is bounded.
