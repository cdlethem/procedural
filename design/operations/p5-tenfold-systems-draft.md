# Tenfold systems proposals: candidates 11–20

Status: **draft for root review, not public admission or implementation authority**.
Owner: systems design worker. Scope: p5.js only; other targets remain deferred.
These are independently specified design proposals, not extracted survey computations.
No original recreation, measured parameter range, native support or artistic acceptance
is asserted. Root must resolve the choices at the end before publishing catalog entries.

The portable-contract, deterministic-semantics and performance skills inform this draft.
The operation-contract admission gate has deliberately not been represented as passed:
this file precedes root's decisions and is not a second live catalog.

## Shared proposed conventions

- Every listed input key is required. Records have exactly their listed own data keys;
  arrays are ordinary dense arrays with own data elements. No coercion, booleans-as-numbers,
  accessors, native objects, callbacks, typed input buffers or renderer state. Inputs must
  remain passive during a call. Proxy behavior is outside the passive-carrier domain.
- A `number` is finite binary64. An `integer` is an exactly integral number, never a bool.
  `maxWork` is an integer in `[0,9007199254740991]`. All outputs are plain detached records
  and arrays; no caller array/record is retained or mutated. Strings and scalars are values.
- Integer array lengths and grid products must fit `[0,4294967295]`. Invalid shapes,
  impossible representation lengths and supplied-value domains give `INVALID_INPUT`.
  Complete static validation, including all later array elements, precedes work preflight,
  RNG draws, generated geometry and output-sized allocation. Static input validation has
  unavoidable input-sized cost and is not itself a promise of bounded wall time.
- Arithmetic work counts use exact nonnegative integers. An unsafe work sum/product or an
  allowance exceeded gives `WORK_LIMIT`. A charge is atomic: check before the charged action;
  a rejected action does not execute. Work allowances describe the specified schedules,
  not milliseconds, bytes or allocation guarantees. Host allocation failure remains a
  host resource error. There is no retry, reduced resolution or hidden partial success.
- Float primitives round separately to binary64; no reassociation or FMA. Check every
  computed primitive for finiteness. Nonfinite arithmetic, including division by an
  underflowed zero denominator, gives `NUMERIC_OVERFLOW`. Do not repair or clamp a numeric
  failure. Canonicalize input and exposed zero values to positive zero. Other than explicit
  boundary operations, no epsilon, snapping, normalization or state clipping is implied.
- Numeric scalar/coordinate/state comparisons allow absolute `1e-9` plus relative `1e-12`
  unless a fixture is marked exact. Bits, tokens, indices, ordering, termination codes,
  topology and RNG states compare exactly. Right-angle turtle fixtures allow coordinate
  absolute `1e-12` because trigonometry is the host binary64 `Math.sin`/`Math.cos` profile.
- Failures expose a stable `code`; listed diagnostic fields are plain scalars. No partial
  result or partially consumed mutable RNG object escapes. Randomness is private state
  threaded through successful calls, never a host global.
- A grid has `columns=C`, `rows=R`, `G=C*R`, row-major index `y*C+x`. Most discrete steps
  allow `C,R>=1`; derivative/interpolation operations explicitly require both >=2.
  Scalar arrays have G numbers, vector arrays G `[x,y]` pairs, binary arrays G exact 0/1
  numbers. `spacing=[hx,hy]` has positive finite components in caller distance units.
- Discrete `CLAMP` maps each neighbor index to the nearest valid index. `WRAP` uses
  nonnegative integer modulo independently per axis. On narrow grids different neighbor
  offsets can address the same cell, and every named offset is still counted separately.
  Spatial wrap periods are `C*hx` and `R*hy`; wrap is not a duplicated endpoint convention.
- For steps 12 and 16 use the same four-neighbor Laplacian over the old state:
  `lapX=((left-center)+(right-center))/(hx*hx)`;
  `lapY=((up-center)+(down-center))/(hy*hy)`; `lap=lapX+lapY`.
  Evaluate in that written order, X before Y. Read all neighbors from the supplied state;
  publish next arrays only after every cell succeeds. No per-cell in-place updates.

### Random stream shared by candidates 19 and 20

`rngState` is an integer in `[0,4294967295]`, including zero. A draw first sets
`state=(1664525*state+1013904223) mod 4294967296`, then returns `u=state/4294967296`.
The multiplication and addition are exact integer arithmetic before reduction. JavaScript
may use unsigned `Math.imul` arithmetic if it produces those exact uint32 states. For
uniform selection among K ordered candidates use `floor(u*K)`. Both operations return
`rngState` containing the final state; they do not use a seed expander or fork a stream.
The multiplication by K uses binary64, with K within the array-length domain; clamp an
otherwise rounded index K to K-1. This is bounded mapping, not unbiased rejection sampling.

Independent recurrence vectors (ten consecutive new states):

| Initial state | New states |
|---|---|
| 0 | 1013904223, 1196435762, 3519870697, 2868466484, 1649599747, 2670642822, 1476291629, 2748932008, 2180890343, 2498801434 |
| 1 | 1015568748, 1586005467, 2165703038, 3027450565, 217083232, 1587069247, 3327581586, 2388811721, 70837908, 2745540835 |
| 42 | 1083814273, 378494188, 2479403867, 955863294, 1613448261, 110225632, 1921058495, 508781842, 3753001289, 4271921684 |
| 2147483648 | 3161387871, 3343919410, 1372387049, 720982836, 3797083395, 523159174, 3623775277, 601448360, 33406695, 351317786 |

Fixture mappings should include state 0 => u=0 and state 4294967295 =>
u=4294967295/4294967296 as direct mapper tests, rather than implying the next draw from
initial state 0 returns zero. Operation fixtures below assert branch-dependent draw counts.

## 11. RK4 traces through an explicit vector grid

Proposed ID: `path.rk4-vector-grid-trace-2d`; transform/generator.

Artist output: a retained path following a supplied velocity field. This adds vector-grid
sampling and fourth-order integration to the existing fixed-step gradient-heading trace.
Studies: vortex streamlines; ribbons steered through a separately authored obstacle field.
The obstacle solver is not supplied by this operation and must not be hidden in its study.

Input:

```text
{vectors:[[number,number],...], columns:integer>=2, rows:integer>=2,
 origin:[number,number], spacing:[positive,positive], start:[number,number],
 dt:number>=0, steps:integer in [0,4294967294],
 boundary:"CLAMP"|"STOP", maxWork:integer}
```

Output: `{points:[[x,y],...], completedSteps:integer, termination:"STEPS"|"BOUNDARY"}`.
The first point is always the supplied start; point count is completedSteps+1. Velocity
components use caller distance per time unit; dt uses the matching time unit. No tangent,
normalization, adaptive integration, obstacles or closed-path detection is included.

Reserve `W=G+17*steps+1` before coordinate construction or trace storage. The allowance
accounts for four four-corner field samples plus one append per requested step, even if
STOP ends early. O(G+steps) work and retained storage; the output contains only accepted
steps. Construct `maxX=origin.x+(C-1)*hx`, `maxY=origin.y+(R-1)*hy` with checked arithmetic,
including for zero steps. The domain is that closed rectangle.
If either represented maximum is <= its origin, raise GRID_COLLAPSE: positive supplied
spacing did not produce a representable positive overall extent. This is distinct from
nonfinite arithmetic and is proposed explicitly for root review.

Sampler S(p): STOP returns the boundary signal when p is outside; CLAMP clamps only the
query coordinate, never the retained path point. Thus CLAMP traces may leave the rectangle.
Compute fractional grid coordinates after the boundary policy as (query-origin)/spacing,
then clamp these fractions to [0,C-1]/[0,R-1] to bound division-rounding excursions.
Use floor indices, except the final grid line uses the preceding cell with local
coordinate 1; exact query==represented maximum also selects that endpoint rule.
The uniform-grid arithmetic is specified this way rather than inferring distinct rounded
physical coordinates for every interior grid line. For each component
perform `top=a+tx*(b-a)`, `bottom=c+tx*(d-c)`, `result=top+ty*(bottom-top)`, with top-left a,
top-right b, bottom-left c, bottom-right d. Exact tx/ty 0 or 1 uses the corresponding value
directly rather than evaluating an unnecessary endpoint subtraction.

For each step, in order, `k1=S(p)`, `k2=S(p+(dt/2)*k1)`,
`k3=S(p+(dt/2)*k2)`, `k4=S(p+dt*k3)`. For each component compute
`sum=((k1+2*k2)+2*k3)+k4`, `next=p+(dt/6)*sum`. Check every primitive. STOP rejects the
whole current step if any stage query or final next point leaves the domain; retain the
previous prefix and report BOUNDARY. Stage overflow is an error, not a boundary signal.
Otherwise append next and continue. No stationary shortcut: dt=0 repeats positions and
still evaluates stages. Zero steps returns STEPS without querying start, even if outside.

Independent fixtures:

- `rk4-constant`: 3x3 vectors all [1,2], origin[0,0], spacing[2,2], start[1,1],
  dt=.5, steps2, CLAMP, maxWork44 => points[[1,1],[1.5,2],[2,3]], completed2, STEPS.
  These coordinates are exact; changing budget to43 => WORK_LIMIT.
- `rk4-linear`: 2x2 vectors[[0,0],[1,0],[0,0],[1,0]], origin[0,0], spacing[1,1],
  start[.25,.5], dt1, steps1, STOP, maxWork22 => final[65/96,.5], completed1, STEPS
  with numeric tolerance. This distinguishes RK4 from Euler and midpoint integration.
- `rk4-stage-stop`: constant [1,0] on 2x2 unit grid, start[.9,.5], dt.3, steps1,
  STOP, maxWork22 => only start, completed0, BOUNDARY. CLAMP instead completes at[1.2,.5].
- `rk4-zero`: same grid, start[2,2], steps0, maxWork5 => only start, completed0,
  STEPS; positive steps with STOP yields BOUNDARY. Nonfinite later vector => INVALID_INPUT,
  even when maxWork=0. Large finite velocity producing nonfinite stage => NUMERIC_OVERFLOW.
- `rk4-collapsed-extent`: 2x2 grid, origin[1e16,0],spacing[.25,1], any finite vectors,
  finite start,steps0,maxWork5 => GRID_COLLAPSE because 1e16+.25 rounds back to 1e16.

## 12. Gray–Scott reaction/diffusion step

Proposed ID: `field.gray-scott-step-2d`; state transform.

Artist output: next chemical concentration grids for reaction islands and stripe-grown
masks. The reusable output is scalar data for marching squares, palettes or image masks.
It owns one update; initialization, seeding disturbances, frame loops and rendering stay
outside. Studies must show an explicit bounded number of replayed steps.

Input:

```text
{state:{u:[number,...],v:[number,...]}, columns:integer>=1, rows:integer>=1,
 spacing:[positive,positive], diffusionU:number>=0, diffusionV:number>=0,
 feed:number>=0, kill:number>=0, dt:number>=0,
 boundary:"CLAMP"|"WRAP", maxWork:integer}
```

Output: `{u:[number,...],v:[number,...]}`. U/V are finite signed scalars, deliberately
not constrained to [0,1], so an unstable but finite result remains valid input to the next
call. No concentration clipping or assertion of physical stability is implied.

Reserve W=9G before output allocation. Visit cells row-major. Compute lapU then lapV by
the shared stencil. Then `reaction=(u*v)*v`, `du=(diffusionU*lapU-reaction)+feed*(1-u)`,
`dv=(diffusionV*lapV+reaction)-(feed+kill)*v`,
`uNext=u+dt*du`, `vNext=v+dt*dv`, in written order. Evaluate the complete expressions
even when dt or coefficients are zero. Work/storage O(G); no RNG or hidden timestep.

Independent exact fixtures:

- `gray-uniform`: 1x1 state{u:[.5],v:[.25]}, spacing[1,1], both diffusion0,
  feed=.125, kill=.125, dt=.5, WRAP, maxWork9 => u[.515625],v[.234375].
- `gray-diffusion`: 3x1 state{u:[1,0,0],v:[0,0,0]}, spacing[1,1], diffusionU=.25,
  diffusionV=0, feed=kill=0, dt1, WRAP, maxWork27 => u[.5,.25,.25],v[0,0,0].
  This catches accidental in-place updates and wrap multiplicity mistakes.
- `gray-equilibrium`: any valid grid of u1/v0, arbitrary finite coefficients producing
  finite intermediates => unchanged. A second gray-uniform call must consume its returned
  state, not reinitialize; expected u=.5317363739013672, v=.2192401885986328
  (exact fractions 278783/524288 and 114945/524288).
- maxWork26 for gray-diffusion => WORK_LIMIT; a NaN in final v element instead gives
  INVALID_INPUT. Finite state/coefficients whose reaction product overflows => NUMERIC_OVERFLOW.

## 13. Life-like cellular step

Proposed ID: `field.life-like-step-2d`; state transform.

Artist output: next binary grid under an explicit totalistic birth/survival rule.
Studies: colony carpets; cell-age relief, with age accumulation explicitly in the caller.
This is simultaneous local state evolution, not the existing occupancy-claim path walk.

Input:

```text
{cells:[0|1,...], columns:integer>=1, rows:integer>=1,
 birth:[integer in 0..8,...], survival:[integer in 0..8,...],
 boundary:"DEAD"|"WRAP", maxWork:integer}
```

Both rule lists are strictly increasing, duplicate-free and may be empty.
Output `{cells:[0|1,...]}`. Reserve W=9G. Count the eight Moore offsets in dy=-1..1,
then dx=-1..1 order, omitting only offset[0,0]. DEAD makes out-of-grid samples zero;
WRAP counts all eight offsets even if they address duplicate cells or the center itself.
Alive cells survive iff the count is in survival; dead cells are born iff it is in birth.
No asynchronous traversal, history, age, RNG or automatic stopping. O(G) work/storage.

Independent exact fixtures:

- `life-blinker`: C3,R3, cells[0,0,0,1,1,1,0,0,0], birth[3], survival[2,3], DEAD,
  maxWork81 => [0,1,0,0,1,0,0,1,0]. A second call returns the initial grid.
- `life-tiny-wrap`: 1x1 cells[1], birth[], survival[8], WRAP, maxWork9 => [1].
  With DEAD => [0]. This fixes narrow-grid multiplicity explicitly.
- `life-birth-zero`: 2x1 cells[0,0], birth[0], survival[], DEAD, maxWork18 => [1,1].
- Rule[3,3], unsorted[3,2], fractional cells or maxWork below9G => corresponding
  INVALID_INPUT / WORK_LIMIT; complete static validation wins over insufficient work.

## 14. Elementary cellular rows

Proposed ID: `field.elementary-cellular-rows`; generator.

Artist output: a space-time grid from a one-dimensional three-cell rule. Studies:
space-time tapestries; radial rule bands where rows are drawn as successive rings.
Unlike candidate13, the rule distinguishes ordered left/center/right configurations.

Input:

```text
{initial:[0|1,...], rule:integer in 0..255, rows:integer>=1,
 boundary:"ZERO"|"WRAP", maxWork:integer}
```

Initial length C>=1; output length C*rows must fit the shared representation limit.
Output `{columns:C,rows:rows,cells:[0|1,...]}`. Row0 copies initial. For later rows,
read only the previous row and set `pattern=4*left+2*center+right`,
`next=(rule >>> pattern)&1`. ZERO supplies0 outside the row; WRAP uses nonnegative
modulo, including duplicated neighbors for C=1/2. No random initial row is generated.
Reserve `W=C+4*C*(rows-1)`; O(C*rows) work/output and O(C) extra state at most.

Independent exact fixtures:

- `eca-rule90`: initial[0,0,1,0,0], rule90, rows4, ZERO, maxWork65 => rows
  00100 / 01010 / 10001 / 01010, flattened in that order.
- `eca-rule30-wrap`: initial[0,1,0], rule30, rows3, WRAP, maxWork27 =>
  010 / 111 / 000. This distinguishes ordered pattern lookup from live-neighbor counts.
- rows1 returns copied initial with W=C; row count0 or empty initial => INVALID_INPUT.
  Rule90 with budget64 => WORK_LIMIT. No out-of-range bit truncation is allowed.

## 15. Curl from a scalar grid

Proposed ID: `field.scalar-grid-curl-2d`; transform.

Artist output: planar vectors tangent to scalar level sets. Studies: circulation arrows
over terrain; particle paths driven by the same retained vectors through candidate11.
Finite differencing and its boundary semantics are the computation; no noise is hidden.

Input:

```text
{values:[number,...], columns:integer>=2, rows:integer>=2,
 spacing:[positive,positive], boundary:"ONE_SIDED"|"WRAP", maxWork:integer}
```

Output `{vectors:[[number,number],...]}`. Define curl as `[dScalar/dy,-dScalar/dx]`
in the caller's coordinates; no renderer-axis reversal. Interior derivativeX is
`(right-left)/(2*hx)`, and derivativeY analogously. ONE_SIDED uses forward difference
at x=0 and backward difference at x=C-1, each divided by hx; Y similarly. A two-column
grid therefore uses the same one-sided X derivative in both columns. WRAP uses central
differences everywhere, sampling modulo; with two columns its X derivative is zero.
Evaluate derivativeX before derivativeY, then construct the rotated pair. No vector
normalization or promise of exact discrete incompressibility under other samplers.
Reserve W=5G; O(G) work/storage.

Independent exact fixtures:

- `curl-affine`: values[0,2,3,5], C2,R2, spacing[2,3], ONE_SIDED, maxWork20 =>
  [[1,-1],[1,-1],[1,-1],[1,-1]]. Catches exchanged physical axes and missing spacing.
- `curl-periodic`: C3,R2, both rows[0,1,0], spacing[1,1], WRAP, maxWork30 => both
  vector rows[[0,-.5],[0,0],[0,.5]].
- Constant values => all[0,0]. Curl-affine under WRAP => all[0,0]. Budget19 on first
  fixture => WORK_LIMIT. Tiny positive spacing causing nonfinite derivatives => NUMERIC_OVERFLOW.

## 16. Damped wave-grid step

Proposed ID: `field.damped-wave-step-2d`; state transform.

Artist output: displacement and velocity arrays for ripple interference and vibrating
woven contours. This differs from reaction diffusion through its second-order state and
wave propagation. Caller owns initial impulses, iteration count and rendering.

Input:

```text
{state:{displacement:[number,...],velocity:[number,...]},
 columns:integer>=1, rows:integer>=1, spacing:[positive,positive],
 speed:number>=0, damping:number>=0, dt:number>=0,
 pinned:[0|1,...], boundary:"CLAMP"|"WRAP", maxWork:integer}
```

Output `{displacement:[number,...],velocity:[number,...]}`. A pinned cell must have
exact zero supplied displacement and velocity; otherwise INVALID_INPUT. Pins remain zero.
Reserve W=7G, then compute speedSquared=speed*speed once, checked even if all cells are
pinned. For each unpinned cell compute the old-displacement Laplacian, then
`acceleration=speedSquared*lap-damping*oldVelocity`,
`nextVelocity=oldVelocity+dt*acceleration`,
`nextDisplacement=oldDisplacement+dt*nextVelocity`. This is an explicitly specified
semi-implicit update, not an exact wave solver. Read old state everywhere and write both
new arrays atomically. No stability clamping; finite negative/large amplitudes are valid.
Spacing uses distance units, speed distance/time, damping inverse time and dt time.
Work/storage O(G).

Independent exact fixtures:

- `wave-impulse`: C3,R1, displacement[1,0,0],velocity[0,0,0], spacing[1,1], speed=.5,
  damping0, dt1, pinned[0,0,0], WRAP, maxWork21 => displacement[.5,.25,.25],
  velocity[-.5,.25,.25]. A second call gives displacement[-.125,.5625,.5625],
  velocity[-.625,.3125,.3125].
- `wave-damping`: 1x1 displacement[1],velocity[2], spacing[1,1], speed0,damping=.5,
  dt=.5, pinned[0], CLAMP, maxWork7 => displacement[1.75],velocity[1.5].
- `wave-pins`: C3,R1, displacement[0,0,0],velocity[0,1,0], spacing[1,1], speed1,
  damping0,dt=.5,pinned[1,0,1],CLAMP,maxWork21 => displacement[0,.5,0],velocity[0,1,0].
  Nonzero supplied pinned value => INVALID_INPUT. maxWork20 => WORK_LIMIT.

## 17. Parallel token grammar rewriting

Proposed ID: `grammar.parallel-token-rewrite`; transform.

Artist output: a rewritten token sequence reusable for substitution tile bands or
generation-stratified botanical text. Turtle interpretation is separate. No character
splitting, production probabilities, context sensitivity or symbol drawing is hidden.

Input:

```text
{axiom:[token,...], rules:[{symbol:token,replacement:[token,...]},...],
 iterations:integer in [0,4294967295], maxTokens:integer in [0,4294967295],
 maxWork:integer}
```

A token is a nonempty string compared by exact UTF-16 code-unit sequence, without Unicode
normalization. Rule symbols must be unique. Empty axiom, empty rules and empty replacement
are legal. Output `{tokens:[token,...]}`. An unmatched token passes through once. Each
generation reads only the previous generation, in order; replacements are not rewritten
again until the next generation. Zero iterations returns a detached axiom.

After static validation, atomically charge `W0=axiom.length+rules.length+sum(replacement.length)`
for setup, then fail OUTPUT_LIMIT if axiom exceeds maxTokens. Before each generation charge1,
including an empty generation. For each old token charge1 for its lookup; determine its
replacement/passthrough, check proposed new length<=maxTokens, then atomically charge its
output length before appending. OUTPUT_LIMIT precedes the emission charge for that token.
Work/storage follows total visited/emitted tokens, with at most two generations live.
String comparison/hashing additionally depends on token text lengths; maxWork is token-work,
not a character-processing or byte bound. It does not authorize retaining every generation.

Independent exact fixtures:

- `grammar-fibonacci`: axiom[A], rules A->[A,B], B->[A], iterations3, maxTokens5,
  maxWork25 => [A,B,A,A,B]. Setup6; generations cost4,6,9. maxWork24 => WORK_LIMIT.
  maxTokens4 with sufficient work => OUTPUT_LIMIT during the final A replacement.
- `grammar-erase`: axiom[A], rule A->[], iterations2,maxTokens1,maxWork5 =>[].
  Setup2, first generation2, empty second generation1. maxWork4 => WORK_LIMIT.
- `grammar-parallel`: axiom[A], rules A->[B],B->[C], iterations1,maxTokens1,maxWork8
  =>[B], not[C]. Zero iterations with maxWork5 returns[A].
- Unmatched token survives unchanged. Duplicate production symbols => INVALID_INPUT
  regardless of rule order or insufficient budget. Empty token strings => INVALID_INPUT.

## 18. Table-driven planar turtle

Proposed ID: `geometry.token-turtle-2d`; generator.

Artist output: retained segments with source token and branch-depth identity. Studies:
bracketed botanical fans; geometric space-filling paths. It consumes explicit tokens,
including candidate17 output, without hiding rewriting or assuming an L-system alphabet.

Input:

```text
{tokens:[token,...], commands:[command,...],
 start:{position:[number,number],heading:number}, unknown:"IGNORE"|"ERROR",
 maxSegments:integer in [0,4294967295],
 maxStackDepth:integer in [0,4294967295], maxWork:integer}
```

Command union (exact keys per variant): `{token,kind:"DRAW"|"MOVE",distance:number}`;
`{token,kind:"TURN",angle:number}`; `{token,kind:"PUSH"|"POP"}`. Tokens follow candidate17's
string domain, with unique command tokens. Signed distance is allowed; angles/headings
are radians without implicit wrapping. No implicit F, +, [, ] or style commands.

Output:
`{segments:[[x1,y1,x2,y2],...],sourceIndices:[integer,...],depths:[integer,...],
position:[x,y],heading:number}`.

Reserve W=commands.length+3*tokens.length. Visit tokens in order. Unknown tokens either
do nothing or raise UNKNOWN_TOKEN with tokenIndex. DRAW/MOVE computes
`dx=distance*cos(heading)`, `dy=distance*sin(heading)`, then x+dx and y+dy, checked in that
order. DRAW checks maxSegments before calculation, appends a segment even if zero length,
and records token index and current stack depth. MOVE only updates pose. TURN adds angle.
PUSH checks depth limit then copies the current pose; POP requires a nonempty stack and
restores its final pose. Unbalanced final nonempty stack raises UNBALANCED_STACK, without
partial output. Exceeding capacity raises OUTPUT_LIMIT or STACK_LIMIT, with tokenIndex;
empty pop raises STACK_UNDERFLOW with tokenIndex. Work O(tokens+commands), retained output
O(draws), temporary stack O(maximum actual depth), never preallocated to maxStackDepth.

Independent fixtures:

- `turtle-branch`: commands F=DRAW2, +=TURN(pi/2), [=PUSH, ]=POP;
  tokens[F,[,+,F,],F], start{position:[0,0],heading:0}, unknownERROR,
  maxSegments3,maxStackDepth1,maxWork22 => segments[[0,0,2,0],[2,0,2,2],[2,0,4,0]],
  sourceIndices[0,3,5],depths[0,1,0],position[4,0],heading0. Coordinate tolerance1e-12;
  all discrete metadata exact. This detects failure to restore heading or position.
- `turtle-zero`: command F=DRAW0, tokens[F], start[3,4]/heading0, ERROR,
  maxSegments1,maxStackDepth0,maxWork4 => segment[3,4,3,4], source0,depth0,final[3,4]/0.
- `turtle-ignore`: no commands,tokens[X],IGNORE,maxSegments0,maxStackDepth0,maxWork3
  => no segments and unchanged supplied pose. ERROR => UNKNOWN_TOKEN at0.
- POP first => STACK_UNDERFLOW at0; final unclosed PUSH => UNBALANCED_STACK.
  For turtle-branch maxStackDepth0 => STACK_LIMIT at1, maxSegments2 => OUTPUT_LIMIT at5,
  maxWork21 => WORK_LIMIT before interpretation. No drawing API is invoked by the core.

## 19. Bounded adjacency tile collapse

Proposed ID: `layout.adjacency-tile-collapse-2d`; constrained generator.

Artist output: tile IDs satisfying caller-supplied horizontal/vertical compatibility.
Studies: edge-matched cable fields; terrain adjacency mosaics. This proposal deliberately
uses minimum domain cardinality, not weighted entropy, and has **no backtracking**.
CONTRADICTION does not prove that the original constraint system was unsatisfiable.

Input:

```text
{columns:integer>=1,rows:integer>=1,
 right:[[tileIndex,...],...],down:[[tileIndex,...],...],
 weights:[positive number,...],domains:[[tileIndex,...],...],
 rngState:uint32,maxWork:integer}
```

T=right.length>=1. Down and weights have length T. Every adjacency row is strictly
increasing, duplicate-free indices0..T-1 and may be empty. Domains has G nonempty strictly
increasing index lists. Tile IDs are these array indices. right[a] lists tiles allowed to
the right of a; down[a] lists tiles allowed below a. Left/up constraints are their inverse
relations, not separately supplied tables. Outer edges impose no neighbor constraint;
there is no wrap or implicit socket rule. Output `{tiles:[tileIndex,...],rngState:uint32}`.

After static validation charge setup
`G+sum(domain lengths)+2*T+sum(right row lengths)+sum(down row lengths)` before copying
domains or building membership structures. This is input-sized preparation; no T-by-T
matrix is required. Use indexed adjacency membership with O(1) expected lookup or an
equivalent implementation that preserves the charged pair-test schedule.

An arc is `(sourceCell,direction)` to an in-range neighbor. Direction order is
RIGHT,DOWN,LEFT,UP. Initialize a FIFO queue with all arcs, source row-major then direction
order. Maintain at most one queued occurrence of each arc; remove its pending flag when
dequeued. Charge1 before each dequeue. Revise the source domain: visit source candidates
ascending; for each, visit target candidates ascending, charging1 before each compatibility
test and stop at the first supporting target. Keep supported source candidates in order.
Commit this revised domain after its candidate scan. Empty => CONTRADICTION with cellIndex.
If changed, enqueue all incoming neighbor->source arcs in the source's RIGHT,DOWN,LEFT,UP
neighbor order, suppressing already pending arcs. Include the just-visited target neighbor.

When the queue drains, charge G atomically for a selection scan. Choose the cell of smallest
domain cardinality>1, breaking ties by row-major index. If none, return singleton tile IDs
and unchanged current RNG state. Otherwise charge `2*domainSize+1` before weighted selection.
Sum positive candidate weights in ascending tile order with checked arithmetic, then draw
exactly once. Set target=u*totalWeight; choose the first ascending candidate whose cumulative
weight is strictly greater than target. A rounded target==totalWeight selects the final
candidate. Collapse that cell to its chosen singleton, enqueue incoming arcs as above,
and propagate again. No draw occurs for an already singleton cell or a propagation prune.
No hidden retries, random tie-breaks, entropy jitter or restart on contradiction.

Worst-case time is governed by charged arc candidate-pair tests and selection scans;
domains only shrink. Storage O(G*T+adjacency entries) in the worst case, with O(G) queued
arc capacity. A work failure discards private domains/state. No partially solved grid is
returned as success. Weighted accumulation overflow => NUMERIC_OVERFLOW before its draw.

Independent exact fixtures:

- `tiles-alternating`: C2,R1, right[[1],[0]], down[[0,1],[0,1]], weights[1,1],
  domains[[0,1],[0,1]],rngState0,maxWork38 => tiles[0,1],rngState1013904223.
  Setup16; initial propagation8; choose scan2; collapse5; propagation3+2; final scan2.
  Only one draw: the second cell is forced. Budget37 => WORK_LIMIT at the final scan.
- `tiles-independent`: same grid/domains/weights, right[[0,1],[0,1]], sufficiently large
  maxWork100 => tiles[0,0],rngState1196435762. This requires two draws, including the
  second unresolved cell; it distinguishes hidden per-cell seed resets.
- `tiles-contradiction`: alternating tables, domains[[0],[0]],rngState0,maxWork100 =>
  CONTRADICTION cellIndex0 during initial propagation, before any draw.
- `tiles-pinned`: alternating tables, domains[[0],[1]],rngState42,maxWork100 =>
  tiles[0,1],rngState42. Empty initial domain, duplicate adjacency entry or nonpositive
  weight => INVALID_INPUT. No interpretation as wildcard/all-tiles is permitted.

## 20. Seeded depth-first spanning tree

Proposed ID: `topology.seeded-depth-first-spanning-tree`; generator.

Artist output: parent/child topology reusable for corridor labyrinths and radial vein
trees. Input graph edges may come from a grid or existing Delaunay output. This is a
randomized DFS distribution, **not a uniformly sampled spanning tree**. It does not invent
an embedding, connect disconnected components or generate branch lengths.

Input:

```text
{vertexCount:integer in [1,4294967295],edges:[[integer,integer],...],
 root:integer in [0,vertexCount-1],rngState:uint32,maxWork:integer}
```

Each edge has 0<=a<b<vertexCount. Edges must be strictly lexicographically increasing;
duplicates and self-edges are invalid. Isolated vertices are represented through
vertexCount. Output `{edges:[[parent,child],...],parents:[integer,...],depths:[integer,...],
rngState:uint32}`. Output edges are directed discovery-order edges, not sorted undirected
pairs. Root parent=-1 and depth0; all other parents/depths correspond to first discovery.

Reserve setup W0=V+2E before owned graph/traversal storage. Build ascending neighbor lists;
strictly sorted input edges permit ordered appends without a separate random/sort phase.
Mark root visited, push it. Repeatedly take stack top v, scan **all** its neighbors in
ascending order, charging1 before every neighbor visit, and collect the currently unvisited
candidates. If none, pop v without a draw. Otherwise charge1 for the choice, draw exactly
once even for a singleton candidate list, select floor(u*K) with the shared mapping, mark
that vertex visited, append [v,child], set parent/depth and push child. The next loop starts
at the new top; when returning to v, rescan its full neighbor list with fresh charges.
On empty stack, if discovered count<V raise DISCONNECTED; otherwise return the tree/state.
No result escapes on disconnection, and the caller's RNG value remains an immutable input.

Time can include repeated neighbor scans and is bounded by charged visits, not assumed
linear DFS with a different cursor-based random policy. Storage O(V+E), with candidate
scratch reused per scan and a stack bounded by V. V=1/E=0 succeeds with W=1 and zero draws.

Independent exact fixtures:

- `tree-path`: V3,edges[[0,1],[1,2]],root0,rngState0,maxWork16 =>
  edges[[0,1],[1,2]],parents[-1,0,1],depths[0,1,2],rngState1196435762.
  Setup7; scans1,2,1,2,1; two choice units. Two draws occur despite forced moves.
- `tree-star`: V3,edges[[0,1],[0,2]],root0,rngState0,maxWork17 =>
  edges[[0,1],[0,2]],parents[-1,0,0],depths[0,1,1],rngState1196435762.
  With initial rngState2147483648 => edges[[0,2],[0,1]],same parents/depths,
  rngState3343919410. This fixes candidate ordering and the high-bit state behavior.
- `tree-single`: V1,edges[],root0,rngState42,maxWork1 => edges[],parents[-1],depths[0],
  rngState42. V2,edges[],root0 with enough work => DISCONNECTED without a successful result.
- Budget15 on tree-path => WORK_LIMIT. Reversed, duplicate, unsorted or out-of-range edges
  => INVALID_INPUT even with insufficient work. A second call using a returned RNG state
  must continue the recurrence table, not restart from the original state.

## Decisions and checks required from root

1. Approve the actual boundaries, especially cardinality-collapse without backtracking,
   randomized DFS rather than uniform spanning trees, and the separate token/turtle APIs.
   These choices reduce hidden machinery but are not equivalent to broader solver claims.
2. Approve the timestep schemes and boundary names. RK4 CLAMP holds the sampled field at
   the boundary while permitting path positions outside; discrete CLAMP duplicates edge
   samples. RK4's GRID_COLLAPSE and bounded fractional-grid arithmetic explicitly handle
   extreme origins/spacings. Curl ONE_SIDED is deliberately a different derivative policy.
3. Confirm signed chemical states/no clipping and exact pin validation for the wave model.
   Stability ranges need later native experiments; this draft supplies no recommended dt,
   feed/kill, speed, damping, resolution or iteration values.
4. Decide whether candidate19's no-backtracking contradiction behavior satisfies the artist
   task. If recovery is required, design its search stack, RNG continuation and work charges
   before implementation rather than silently retrying until an attractive result appears.
5. Review the work schedules and fixture arithmetic independently before freezing catalog
   entries. Numerical-fixture formulas here were derived from small analytic states, not
   copied from candidate implementations; they remain proposals requiring root review.
6. Add language-neutral schema/error fixtures for sparse arrays, wrong carriers, extra
   record keys, nonfinite final elements, signed zero, exact output detachment, safe-work
   overflow and one-below-budget cases. These supplement the distinguishing fixtures above.
7. Native studies must declare fixed seeds, initial states and explicit step counts; show
   structural edits and retained-output transfers. Test actual p5 rendering, reset/replay
   and save, under the shared machine lease. No algorithm's core result proves another
   operation's technique/native support or a surveyed-original reconstruction.
