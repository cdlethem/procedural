const guide = (title, summary, useWhen, inputs, output, code, tryThis, pitfalls) => ({
  title, summary, useWhen, inputs, output, code, tryThis, pitfalls,
});

export const externalExpansionApiGuides = {
  "spatial.radius-pairs-2d": guide(
    "Find nearby point pairs",
    "Connect nearby marks while keeping their positions and drawing treatment separate.",
    "Use the returned pairs to draw a proximity network or drive the pair-force step.",
    {
      points: "Finite [x,y] positions. Array indices identify the points for this call.",
      radius: "Inclusive distance threshold in the same units as the positions; zero finds exact coincidences.",
      maxWork: "Budget for one event per point plus every pair in the x-distance window. Dense or vertical sets can still need quadratic work.",
    },
    "{pairs}: detached [i,j] indices, i<j, in strict lexicographic order. There is no self-pair or duplicate.",
    `const result = radiusPairs2D({points:[[0,0],[3,4],[20,0]],radius:5,maxWork:6});
console.log(result.pairs);`,
    "Change the radius without changing the positions, then draw the same pair list with a different mark or opacity.",
    ["Indices do not retain identity after insertion or reordering.", "There is no wrapping, collision resolution or persistent contact state.", "A deterministic x sweep can still be quadratic for vertical point sets."],
  ),
  "motion.pair-force-step-2d": guide(
    "Move a network with pair forces",
    "Let connected points pull together and resist crowding, then draw their motion as trails or changing relationships.",
    "Supply a proximity graph or a fixed graph; the same synchronous step works with either.",
    {
      points: "Finite [x,y] positions; one per equal-unit-mass body.",
      velocities: "Finite [vx,vy] values in coordinate units per time unit, matching points.",
      pairs: "Canonical unique [i,j] pairs with i<j in strict lexicographic order.",
      attraction: "Nonnegative linear attraction coefficient, in inverse time squared.",
      repulsion: "Nonnegative peak repulsive acceleration, tapered to zero at repulsionRadius.",
      repulsionRadius: "Short-range repulsion distance; zero disables repulsion.",
      damping: "Per-call velocity multiplier from zero to one, applied before movement.",
      dt: "Strictly positive logical time step; the operation never reads a clock.",
      maxSpeed: "Nonnegative speed cap in coordinate units per time unit.",
      maxWork: "Budget of at least point count plus supplied pair count.",
    },
    "{points,velocities,forces}: three detached arrays. Forces are the summed pre-damping, pre-speed-cap force vectors.",
    `const next = pairForceStep2D({points:[[0,0],[2,0]],velocities:[[0,0],[0,0]],pairs:[[0,1]],attraction:0.5,repulsion:0,repulsionRadius:0,damping:1,dt:1,maxSpeed:10,maxWork:3});
console.log(next.points);`,
    "Replace proximity pairs with a fixed chain, or change repulsion while retaining the initial state. Requery next positions before drawing current proximity edges.",
    ["Coincident points have no invented separation direction.", "Damping is per call, so changing dt alone does not preserve the trajectory.", "There are no walls, collisions, flock alignment or retained contact ages.", "This authored force law does not recreate Reas Process 18 or Tissue."],
  ),
};
