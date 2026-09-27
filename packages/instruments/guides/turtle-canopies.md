# Turtle Canopies: Grammar Paths starting recipe

Grow branching fragments from editable turtle productions. The Turtle Canopy recipe starts with `F → F[+F][-F]F`; change the rule, root and step to make sparse forks, repeated rails or dense local trees. This is the same Grammar Paths instrument as Woven Fold and Recursive Tiles, with a different starting construction—not a stochastic growth simulation.

| Controls | Canvas effect |
| --- | --- |
| Axiom; F/G/X/Y productions; Rewrite generations | Build the actual token sequence by simultaneous replacement. Empty productions erase symbols. F/G draw; X/Y are silent structural variables. |
| F step; G/F ratio | Set segment lengths directly, without fitting the finished tree to the canvas. G can supply shorter connectors. |
| Turn angle | `+` and `-` turn in opposite signed directions; brackets restore the parent position and heading. |
| Start X/Y; Heading | Place and aim the root in canvas coordinates, including off-canvas positions. |
| Path weight; Endpoint marks; Dot diameter | Show branches, tips or both without changing the grammar. |
| Midpoint ticks; Tick length | Add independent transverse marks along drawn segments. |

Try these constructions:

- **Canopy:** default rule, depth 4, step 20, angle 25, start (320,500), heading -90.
- **Sparse fork:** rule `F[+G][-G]`, G production `G`, depth 2, step 45, G/F ratio .7, angle 48; move the start to (170,380).
- **Branching rail:** rule `F[+G]F`, G production `G`, depth 3, step 18, angle 70, heading 0, start (120,320). Hide path strokes and enable endpoint marks for a disconnected rhythm.

The alphabet is `F G X Y + - [ ]` without whitespace. The axiom cannot be empty; each text field is bounded to 128 tokens. Unmatched expanded brackets, excessive stack depth and joint expansion/turtle work fail explicitly before rewriting. An entirely erased drawing is valid. No seed participates, no automatic centering is applied, and no paper or frame is painted.
