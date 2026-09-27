# Contact network

Build current-neighbor webs or sparse chains from an editable moving population.

An editable starting population is replayed through `radiusPairs2D` and the synchronous `pairForceStep2D`. Every tick recomputes pairs from current positions, advances all agents together, and retains the resulting positions. Links are queried **again at the final positions**; they do not depict old encounters. The canvas adds no walls, collisions, alignment, or contact memory.

| Control | Effect |
| --- | --- |
| Agents; starting shape | Place 1–160 agents in an ordered area, line, ring, or grid. Grid columns are derived from count and aspect; a ring of positions alone has no attached links. |
| Source X/Y; extent; aspect; source angle | Position, size, vertical-to-horizontal ratio, and rotate the **initial** source in canvas units/degrees. Zero extent may intentionally stack points. Nothing is fitted or clamped to the canvas. |
| Starting disorder | Seeded independent displacement relative to approximate initial spacing; zero keeps positions ordered. |
| Velocity heading; starting speed; heading spread | Set starting velocity direction/speed; spread seeds individual directions within ± the given degrees. Position and heading randomness are independent, so a heading edit does not reroll initial positions. |
| Ticks | Repeat the synchronous step 0–180 times, starting from the same initial state. Zero displays that state directly. |
| Radius | Inclusive Euclidean distance for nearby pairs at each tick and at the final frame. |
| Open chains | Divide agent indices into up to three balanced, open contiguous chains; a lone agent has no edge. Fixed adjacent-index force/link pairs replace radius queries. No closing or cross-chain edge is inserted. |
| Attraction; avoidance; avoidance reach | Attractive force scales pair displacement; avoidance repels a pair only strictly inside its reach. Zero avoidance or zero reach disables separation. This changes dynamics, not just stroke appearance. |
| Damping; speed cap | Per-step post-force velocity multiplier and maximum speed; each step uses `dt: 1`. |
| Current links; link weight; link dot size | Independently paint final pairs as lines or midpoint dots; weight zero removes link marks. Dot size controls only midpoint dots. |
| Retained trails; trail stride; trail weight | Independently connect sampled stored positions (including the final one), or paint sampled dots. Zero weight removes trails. |
| Current nodes; node size | Independently paint final agent positions; zero diameter removes them. |
| Final velocity spokes; velocity length; velocity weight | Optionally draw actual final solver velocities from each current agent as `position → position + final velocity × length`. Off by default; zero length or weight hides them, and a stationary agent gets no spoke. |
| Dot marks | Switch displayed links to pair-midpoint dots and trails to sampled dots; it does **not** change replay state or pair membership. |

All inputs are checked before source allocation. At most 160 agents and 180 steps are supported, with a **3,000,000-unit pair-work** limit. With spatial pairs, worst case is `(2 × ticks + 1) × (count + count × (count − 1) / 2)`; an open-chain replay uses just `ticks × (2 × count − number of chains)`. A radius query can compare every unordered pair even if few links survive. There is no retry or automatic reduction. One latest replay is retained for style-only edits; changing a force, position, velocity, topology, or relevant seed rebuilds it. Seed can affect history only when positional disorder and extent are both positive, or heading spread and starting speed are both positive.

**Recipes:** For an intimate knot, select area, 38 agents, extent 115, radius 56, ticks 45, attraction 0.002, avoidance 0.34; show links/nodes but not trails. For a sparse ordered communication strip, choose line, 42 agents, extent 520, disorder 0, speed 0, radius 27, ticks 0; enable links and omit nodes. For a visibly different *fixed topology*, choose grid, 36 agents, extent 250, Open chains on, ticks 60, attraction 0.0007 and avoidance 0.3; turn on trails and turn off current nodes. The final links then follow adjacent source indices, not spatial proximity.
