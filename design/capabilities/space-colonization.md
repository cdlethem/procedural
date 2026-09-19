# Space-colonization step (venation)

Root admits one p5-first operation for the third I-family slice: a bounded
space-colonization growth step that grows a set of tips toward the nearest
unconsumed source, consumes a source a tip reaches, and branches the tip at the
source. The step is a pure function of its input (tips, sources, the consumed
flags, and the growth parameters) and returns the new tips, the segments grown
this step, and the updated consumed flags. The study loops the step to grow a
retained node/edge network; the operation itself holds no state across calls.

The mechanism is the space-colonization / venation growth the corpus describes at
series level (Nervous System *Hyphae*, "root veins responding to distributed
hormone sources"); the source fixes no exact algorithm, so this is an
independently specified design, not a recreation. The nearest-source query
composes from the accepted point-set conventions (a direct nearest query, the
same geometry `spatial.radius-pairs-2d` uses) and the branching is a frozen
rotation of the growth direction; the retained network presents through the
accepted drawing operations.

The new computation is the *coupling* in one step of tip growth toward the
nearest source, source consumption, and branching — none of which is a single
accepted operation. Growth termination (a tip with no unconsumed source is
removed) and node identity (a consumed source is never regrown) are the
controlled evidence the plan names for this family.

A first bounded slice: one growth step, a direct nearest-unconsumed-source
query, a fixed reach threshold, a fixed branch count and branch angle, and a
size cap on the output tips. Steering/momentum (tips keep an inherited
direction instead of aiming straight at the source) and a soft source-strength
field are documented follow-ups, not implied capabilities.
