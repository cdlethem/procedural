# Agent trails

Draw retained motion as filaments, lines of dots or final-velocity rakes, with links and body marks optional.

Starting points and velocities advance through the same explicit `radiusPairs2D` / `pairForceStep2D` replay as Contact network. The ring-and-trail defaults are just a different starting recipe, not another force solver. The sampled paths are positions *actually returned* by the synchronous step, from tick zero through the final tick; editing a stroke never advances the population.

| Control | Effect |
| --- | --- |
| Agents; starting shape | Set 1–160 starting agents and choose area, line, ring, or grid. The ring placement does not itself attach neighbors. |
| Source X/Y; extent; aspect; source angle | Move, scale, compress vertically, and rotate the initial arrangement, without a page-fit transform. |
| Starting disorder | Seeded positional displacement; zero restores exact ordered starting positions. |
| Velocity heading; starting speed; heading spread | Common initial heading/speed plus seeded ± angular variation. Heading edits do not reroll starting positions; positional disorder does not reroll velocities. These are initial velocities, not final velocity spokes. |
| Ticks | Number of full synchronous pair-force steps. Zero has only the initial positions, so no trail segment exists. |
| Radius | Inclusive current-pair search radius, reapplied at every step and at the final state. |
| Open chains | Divide indices into up to three balanced, open contiguous chains; a lone agent has no edge. Fixed adjacent-index pairs replace nearby force/link pairs, independently of starting shape. No wrap or cross-chain edge; radius is inactive. |
| Attraction; avoidance; avoidance reach | Attraction scales displacement along each active pair. Avoidance applies short-range repulsion strictly inside its reach. |
| Damping; speed cap | Multiply post-force velocity every step, then cap its magnitude; `dt` remains 1. No boundaries, collision impulses, steering, or wrapping are added. |
| Retained trails; trail stride; trail weight | Toggle histories independently; draw every Nth stored tick and always the final tick. Zero weight removes trails. |
| Current links; link weight; link dot size | Toggle final nearby or open-chain relationships independently; midpoint-dot size applies in Dot marks mode. |
| Current nodes; node size | Toggle final bodies separately; zero diameter hides them. |
| Final velocity spokes; velocity length; velocity weight | Show independently the actual final solver velocities from each current agent: `position → position + final velocity × length`. On by default; zero length or weight hides all spokes, and stationary agents have no spoke. |
| Dot marks | Change sampled trails to point marks and current links to pair-midpoint dots, without affecting their history or dynamics. |

Population is capped at 160, ticks at 180, and pair work at **3,000,000 units**. Worst-case spatial-pair work is `(2 × ticks + 1) × (count + count × (count − 1) / 2)`; open-chain work is `ticks × (2 × count − number of chains)`. Coupled limits are validated before making source arrays. At most 181 history frames are retained for one latest structural source; style/palette edits reuse it. Seed can influence trajectories only when positional disorder and extent are both positive, or heading spread and starting speed are both positive.

**Recipes:** For interrupted orbital fragments, choose ring, 75 agents, extent 340, heading spread 100, ticks 72, trail stride 4; enable trails, disable links, keep small nodes. For convergent streams, choose line, 28 agents, extent 260, angle 35, heading 105, speed 1.7, spread 0, radius 48, ticks 90, trail stride 1; show trails only. For a source topology experiment, choose grid, 49 agents, extent 280, open chains on, attraction 0.001, ticks 48; enable links and trails but hide nodes, then toggle Dot marks to compare samples with continuous paths. Changing palette and mark widths in each recipe leaves every retained position untouched.
