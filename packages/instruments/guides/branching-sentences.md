# Branching sentences

Grow a single off-center sprig, a wide fan, or a dispersed grove from the same branching grammar. Each depth-indexed rule draws a step and offers a chosen number of child branches from its tip. Fork count, divergence and bias shape the silhouette; contraction changes step lengths toward the tips. Branch survival opens gaps and makes each specimen grow differently, while tip opening changes how the fan spreads with depth. The rest of the canvas stays transparent for other layers.

| Control | Visible effect |
| --- | --- |
| Branches per fork | One continues a crooked stem; two makes a paired fork; more produces fuller canopies, subject to the joint work budget. |
| Signed divergence and branch bias | Divergence fans the children around the parent (negative mirrors the fan); bias leans every child to one side. |
| Branch survival | Seeded chance of keeping each child and its descendants. Lower it for irregular, incomplete growth; zero leaves only the trunks. Surviving branches retain their positions as this control changes. |
| Tip opening | Multiplies divergence toward the outer forks. Above one opens the tips more than the trunk; below one narrows them. |
| Length contraction | Each generation multiplies its step by this amount: below one shortens outer growth, above one extends it. |
| Angular and length disorder | Seeded variation affects turns at individual joints and lengths of individual drawn segments. Zero yields regular geometry. Palette and mark edits do not change the sampling. |
| Depth and trunk step | Depth adds rewrite generations and branches; trunk step sets the first segment's actual pixel length, without automatically fitting the drawing to the canvas. |
| Starting heading | Rotates the growth direction; -90° points upward. |
| Specimens, center X/Y, horizontal/vertical spread | Place one stem or scatter many around the chosen normalized center; spread measures origin scatter in pixels and zero keeps origins together. |
| Stroke weight and branch taper | Set initial width and multiply width at each succeeding depth. A taper of zero hides later lines. |
| Draw tips | Add optional small endpoint marks; no frame or background is painted. |
| Seed | Reproduces origin placement, surviving branches, per-joint angles and segment lengths; changing the seed discovers another growth from the same grammar. |

Try a sparse crooked sprig with one branch per fork, survival 1, depth 7, bias 14°, angular disorder 20°, and contraction .9. For a broad canopy, use three branches per fork, depth 5, divergence 55°, step 45 px and contraction .75; reduce survival to break its symmetry. For an asymmetric grove, use two branches per fork, depth 5, bias 18°, three specimens, horizontal spread 250 px and vertical spread 80 px. These are editable starting combinations, not separate preset trees. Dense combinations are rejected before expansion using the complete, unpruned grammar: at most 100,000 tokens or 18,000 segments across all specimens. Reducing survival cannot bypass that work limit.

Exact-entry domains keep angles finite (divergence and bias each ±180°, heading ±1080°) while allowing reversed, wrapped, or cropped forms. The first step may range from .1 to 160 px; contraction from .1 to 1.5 and length disorder from 0 to .95 keep segment lengths positive. Each specimen spans at most 1,000 px of horizontal and vertical origin scatter. These numerical limits bound meaningful edits without fitting artwork into a fixed frame.
