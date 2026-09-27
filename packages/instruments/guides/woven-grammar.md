# Grammar Paths: Woven Fold starting recipe

Grammar Paths lets you write an **axiom** and parallel productions for **F, G, X, Y**. Woven Fold begins with an X/Y fold; Recursive Tiles begins with a repeating F/G tile path, and either starting recipe can be rewritten with the same controls. Each generation applies all four rules simultaneously using `parallelTokenRewrite`, then `tokenTurtle2D` interprets the final tokens. Tokens are single characters: `F` draws a full step, `G` draws a step scaled by **G/F ratio**, `X` and `Y` are silent rewrite variables, `+` and `-` turn by opposite signed angles, and `[` / `]` save and restore turtle position and heading. This is token data, not script source. The study is deterministic: seed does not change the drawing.

**Iterations** controls generations (the saved `iterations` key remains); **step** and **signed turn angle** set local geometry. **Start X/Y and heading** place the turtle directly on the canvas—paths are not fitted or centered automatically. **Path weight**, **endpoint marks / dot diameter**, and **midpoint ticks / tick length** are independent mark controls. Zero path weight still permits visible ticks or nodes. There is no mandatory border, ground, or page title.

## Control map

| Controls | Canvas effect |
| --- | --- |
| Axiom, F / G / X / Y productions, Iterations | Choose the initial tokens, their simultaneous replacements, and how many generations build the final path. X/Y can steer growth without drawing. |
| Step, G/F ratio, Turn angle | Set F's segment length, G's relative length, and the signed turn made by `+` (with `-` turning the other way). |
| Start X/Y, Heading | Place and aim the turtle in canvas coordinates without fitting the result to the page. |
| Path weight, Endpoint marks / dot diameter | Change stroke width or show segment endpoints independently of path strokes. |
| Midpoint ticks, Tick length | Add short normal marks at segment midpoints and control their extent independently of endpoints. |

## Contrasting recipes

- **Woven fold (default):** axiom `X`, X `+YF-XFX-FY+`, Y `-XF+YFY+FX-`, F `F`, G `G`, iterations 5, step 9, angle 90. X/Y generate a folded woven path without drawing themselves.
- **Straight stitch:** axiom `F`, F `FG`, G `G`, X `X`, Y `Y`, iterations 5, step 12, G/F ratio .35, angle 90; add ticks and turn off path strokes for a disconnected stitch rhythm.
- **Bracketed fan:** axiom `F`, F `F[+G]F[-G]F`, G `G`, iterations 3, angle 28, step 8; turn on endpoint marks to inspect branch tips.

The axiom must be nonempty. Each production may be empty to erase its symbol on the next generation; all text is limited to 128 characters and the eight named tokens (no whitespace). An expanded string with an unmatched `[` or `]` is rejected, including underflows. Expansion length, total generations, turtle work and stack depth are bounded *before* rewriting; excess growth reports an error rather than truncating the drawing.
