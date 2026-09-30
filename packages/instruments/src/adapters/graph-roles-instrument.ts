import { proximityReplayInstrumentDefinitions, validateProximityReplayInstrument } from "./proximity-replay-instruments.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const when = (parameter: Parameter, visibleWhen: Condition): Parameter => ({ ...parameter, visibleWhen });
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, integer = false, visibleWhen?: Condition): Parameter => {
  const parameter = numeric(key, label, description, min, max, step, { hardMin, hardMax, integer });
  return visibleWhen ? when(parameter, visibleWhen) : parameter;
};
const select = (key: string, label: string, description: string, options: string[], visibleWhen?: Condition): Parameter => {
  const parameter = choice(key, label, description, options);
  return visibleWhen ? when(parameter, visibleWhen) : parameter;
};
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => {
  const parameter = toggle(key, label, description);
  return visibleWhen ? when(parameter, visibleWhen) : parameter;
};

const contact: Condition = { source: ["contact"] };
const lattice: Condition = { source: ["lattice"] };
const branches: Condition = { source: ["branches"] };
const routed: Condition = { route: ["shortest", "longest"] };
const marks = ["dot", "rings", "rosette", "arrow"];
const materials = ["ink", "stitch", "beads"];

export const graphRolesDefinition: InstrumentDefinition = {
  id: "graph-roles",
  title: "Graph Roles",
  description: "A network read by roles: a thin supporting web, a bold focal route between two chosen places, motifs on the nodes and fills only in the faces that really are planar.",
  procedure: "A maze with loops is grown over a grid, and that one network is read several ways at once. Hairlines trace its links by age, a bold route climbs between two points, dots swell at busy junctions, and some enclosed faces are filled.",
  renderer: "2d",
  parameters: [
    select("source", "Network", "Where the graph comes from: contact links between drifting agents, a grown lattice maze with loops and diagonals, or seeded branching trees.", ["contact", "lattice", "branches"]),
    select("direction", "Direction", "None reads links as undirected. Source direction keeps each edge's own orientation (chaser to chased in contact; older to younger in lattice and branches), enables arrowheads and lets a route follow it.", ["none", "source"]),
    n("agents", "Agents", "Bodies in the contact replay; every pair within the contact radius after the last tick is an edge.", 8, 120, 1, 1, 160, true, contact),
    select("startShape", "Starting shape", "Initial arrangement of the agents: a spiral area, a ring, a line or a grid.", ["area", "ring", "line", "grid"], contact),
    n("disorder", "Starting disorder", "Seeded jitter of the start positions as a fraction of spacing; a new seed re-rolls it.", 0, 1, .01, 0, 2, false, contact),
    n("ticks", "Ticks", "Pair-force steps before the network is read. Edges that have been in contact longest are the oldest.", 0, 120, 1, 0, 180, true, contact),
    n("radius", "Contact radius", "Two agents closer than this are joined. Larger radii give dense, crossing fabrics; small ones sparse queries.", 10, 120, 1, 0, 2000, false, contact),
    n("force", "Attraction", "Pull between agents in contact; higher values draw clusters together over the ticks.", 0, .005, .00005, 0, 1, false, contact),
    n("speed", "Starting speed", "Initial drift speed; with the heading spread it decides how the network is stretched over time.", 0, 3, .05, 0, 20, false, contact),
    n("damping", "Momentum", "Share of velocity kept each tick. Near 1 the agents keep drifting, so contacts form and break and edges get very different ages; low values freeze the network early.", .9, 1, .005, 0, 1, false, contact),
    n("columns", "Columns", "Lattice sites across.", 3, 40, 1, 2, 60, true, lattice),
    n("rows", "Rows", "Lattice sites down.", 3, 40, 1, 2, 60, true, lattice),
    select("region", "Region", "Keep lattice sites inside a rectangle, a disc or a ring.", ["rectangle", "disc", "annulus"], lattice),
    n("innerRadius", "Ring hole", "Excluded inner radius as a fraction of the disc radius.", 0, .9, .01, 0, .99, false, { source: ["lattice"], region: ["annulus"] }),
    n("blocked", "Blocked sites", "Seeded fraction of sites removed before growth; blocked sites leave holes and dead ends.", 0, .7, .01, 0, 1, false, lattice),
    n("braid", "Loops", "Fraction of the grid edges outside the spanning maze that are kept. 0 is a pure maze tree with no faces; 1 is the full grid.", 0, 1, .01, 0, 1, false, lattice),
    n("diagonals", "Diagonals", "Chance each cell diagonal exists. Both diagonals of a cell cross, which is a genuine non-planar crossing: such cells are never filled.", 0, 1, .01, 0, 1, false, lattice),
    n("wobble", "Wobble", "Stable displacement of every site inside its cell, so the lattice is not rigid.", 0, 1, .01, 0, 1, false, lattice),
    n("rootX", "Growth origin X", "Where the maze starts growing (0 left, 1 right); ages count away from it.", 0, 1, .01, 0, 1, false, lattice),
    n("rootY", "Growth origin Y", "Where the maze starts growing (0 top, 1 bottom).", 0, 1, .01, 0, 1, false, lattice),
    n("roots", "Trees", "Number of trunks along the bottom of the footprint.", 1, 6, 1, 1, 24, true, branches),
    n("generations", "Generations", "Levels of branching above the trunk.", 1, 6, 1, 0, 9, true, branches),
    select("children", "Children per branch", "Two or three potential child slots for every branch.", ["2", "3"], branches),
    n("branchAngle", "Branch angle", "Turn of the outer children relative to their parent, in degrees.", 5, 80, 1, 0, 180, false, branches),
    n("angleSpread", "Turn spread", "Seeded angle variation around each child slot, in degrees.", 0, 40, 1, 0, 180, false, branches),
    n("contraction", "Contraction", "Child length as a fraction of its parent's; the trunk is sized so an unbranched line spans the footprint.", .4, 1, .01, .05, 1.2, false, branches),
    n("survival", "Survival", "Chance each child slot grows; pruned branches leave open space and shorter routes.", .3, 1, .01, 0, 1, false, branches),
    n("centerX", "Center X", "Horizontal center of the footprint in canvas units.", 80, 560, 1, -320, 960),
    n("centerY", "Center Y", "Vertical center of the footprint in canvas units.", 80, 560, 1, -320, 960),
    n("width", "Width", "Footprint width; for contact networks the extent of the starting shape.", 100, 600, 1, 1, 1600),
    n("height", "Height", "Footprint height.", 100, 600, 1, 1, 1600),
    n("rotation", "Rotation", "Turns the whole network about its center, in degrees.", -180, 180, 1, -360, 360),
    n("minDegree", "Fewest links", "Keep only nodes with at least this many links in the source graph (hubs).", 0, 8, 1, 0, 1000, true),
    n("maxDegree", "Most links", "Keep only nodes with at most this many links (leaves and thin places). Zero means no limit.", 0, 40, 1, 0, 1000, true),
    n("minWeight", "Weakest edge", "Drop edges below this fraction of the strongest edge's weight.", 0, 1, .01, 0, 1),
    n("maxWeight", "Strongest edge", "Drop edges above this fraction of the strongest edge's weight.", 0, 1, .01, 0, 1),
    n("minAge", "Youngest edge", "Drop edges younger than this fraction of the oldest age.", 0, 1, .01, 0, 1),
    n("maxAge", "Oldest edge", "Drop edges older than this fraction of the oldest age.", 0, 1, .01, 0, 1),
    flag("isolated", "Keep isolated nodes", "Show nodes that have no surviving edge."),
    select("route", "Route", "Highlight the shortest or the longest simple route between the nodes nearest the start and end points. Only the selected roles are traversable.", ["off", "shortest", "longest"]),
    select("metric", "Measured by", "Length is Euclidean edge length, hops counts edges, weight prefers strong edges.", ["length", "hops", "weight"], routed),
    n("startX", "Start X", "The route starts at the selected node nearest this point.", 0, 640, 1, -4000, 4000, false, routed),
    n("startY", "Start Y", "Vertical position of the start point.", 0, 640, 1, -4000, 4000, false, routed),
    n("endX", "End X", "The route ends at the selected node nearest this point.", 0, 640, 1, -4000, 4000, false, routed),
    n("endY", "End Y", "Vertical position of the end point.", 0, 640, 1, -4000, 4000, false, routed),
    flag("followDirection", "Follow direction", "Traverse edges only from tail to head; a route may then not exist.", { direction: ["source"], route: ["shortest", "longest"] }),
    select("routeMaterial", "Route material", "Ink, stitches or beads along the focal route.", materials, routed),
    n("routeWeight", "Route weight", "Stroke width of an ink or stitch route.", .5, 10, .1, 0, 50, false, { route: ["shortest", "longest"], routeMaterial: ["ink", "stitch"] }),
    n("routeSpacing", "Route spacing", "Distance between route stitches or beads.", 4, 45, .5, .5, 1000, false, { route: ["shortest", "longest"], routeMaterial: ["stitch", "beads"] }),
    select("routeBead", "Route bead", "Mark on each route bead; arrows show the direction of travel.", marks, { route: ["shortest", "longest"], routeMaterial: ["beads"] }),
    n("routeBeadSize", "Bead size", "Diameter of route beads.", 2, 30, .5, 0, 500, false, { route: ["shortest", "longest"], routeMaterial: ["beads"] }),
    flag("endpoints", "Show endpoints", "Mark the first and last node of the route.", routed),
    n("endpointSize", "Endpoint size", "Diameter of the endpoint rings; zero hides them.", 4, 40, .5, 0, 500, false, { route: ["shortest", "longest"], endpoints: [true] }),
    select("edgeMaterial", "Edge material", "Ink, stitches or beads along every selected edge of the supporting network.", materials),
    n("edgeWeight", "Edge weight", "Stroke width of ink or stitch edges; keep it thin so the route can stand out.", .2, 4, .05, 0, 50, false, { edgeMaterial: ["ink", "stitch"] }),
    n("edgeSpacing", "Edge spacing", "Distance between stitches or beads on an edge.", 4, 45, .5, .5, 1000, false, { edgeMaterial: ["stitch", "beads"] }),
    select("edgeBead", "Edge bead", "Mark on each edge bead.", marks, { edgeMaterial: ["beads"] }),
    n("edgeBeadSize", "Edge bead size", "Diameter of edge beads.", 1, 14, .5, 0, 500, false, { edgeMaterial: ["beads"] }),
    select("edgeTone", "Edge color", "One color, or split edges into three color bands by weight or by age.", ["flat", "weight", "age"]),
    n("edgeRetention", "Edge retention", "Stable omission of edges, leaving open space without changing the network.", 0, 1, .01, 0, 1),
    flag("arrows", "Arrowheads", "Mark the direction of every edge with a small arrow at its midpoint.", { direction: ["source"] }),
    n("arrowSize", "Arrow size", "Length of the direction arrows. Edges shorter than three arrow lengths get none.", 4, 20, .5, 0, 500, false, { direction: ["source"], arrows: [true] }),
    n("arrowShare", "Arrow share", "Fraction of the eligible edges that carry an arrow, chosen by edge id; lower it on dense networks so direction stays readable.", 0, 1, .01, 0, 1, false, { direction: ["source"], arrows: [true] }),
    select("nodeMark", "Node mark", "Dot, ring or rosette at every selected node.", ["dot", "rings", "rosette"]),
    n("nodeSize", "Node size", "Diameter of the node mark; zero hides the nodes.", 0, 24, .5, 0, 500),
    select("nodeScaleBy", "Size by", "Scale each node by its degree, weight or age relative to the largest in the graph.", ["uniform", "degree", "weight", "age"]),
    n("nodeScaleAmount", "Size contrast", "How much smaller the lowest-valued node is drawn; 0 keeps all nodes equal.", 0, .9, .01, 0, .95, false, { nodeScaleBy: ["degree", "weight", "age"] }),
    flag("faces", "Fill faces", "Fill every bounded region that the planar edges really enclose. Crossing edges never make a face. Branch trees have no cycles, hence no faces.", { source: ["contact", "lattice"] }),
    select("faceTint", "Face color", "One color, bands by face size, or a stable color per face.", ["flat", "size", "varied"], { faces: [true] }),
    n("faceOpacity", "Face opacity", "Opacity of the face fills.", 0, 1, .01, 0, 1, false, { faces: [true] }),
    n("faceMinArea", "Smallest face", "Faces smaller than this area (canvas units squared) stay open.", 0, 3000, 10, 0, 10_000_000, false, { faces: [true] }),
    n("faceMaxArea", "Largest face", "Faces larger than this area stay open, which keeps big voids empty.", 200, 40000, 100, 0, 10_000_000, false, { faces: [true] }),
    n("faceRetention", "Face retention", "Stable omission of faces.", 0, 1, .01, 0, 1, false, { faces: [true] }),
  ],
  controlGroups: [
    { label: "Network", stage: "form", controls: ["source", "direction",
      { label: "Contact", controls: ["agents", "startShape", "disorder", "ticks", "radius", "force", "speed", "damping"] },
      { label: "Lattice", controls: ["columns", "rows", "region", "innerRadius", "blocked", "braid", "diagonals", "wobble",
        { label: "Growth origin", controls: ["rootX", "rootY"] }] },
      { label: "Branches", controls: ["roots", "generations", "children", "branchAngle", "angleSpread", "contraction", "survival"] }] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
    { label: "Roles", stage: "process", controls: [{ label: "Degree", controls: ["minDegree", "maxDegree"] },
      { label: "Weight", controls: ["minWeight", "maxWeight"] }, { label: "Age", controls: ["minAge", "maxAge"] }, "isolated"] },
    { label: "Route", stage: "process", controls: ["route", "metric", { label: "Start", controls: ["startX", "startY"] },
      { label: "End", controls: ["endX", "endY"] }, "followDirection"] },
    { label: "Focal route", stage: "process", controls: ["routeMaterial", "routeWeight", "routeSpacing",
      { label: "Bead mark", controls: ["routeBead", "routeBeadSize"] }, "endpoints", "endpointSize"] },
    { label: "Support edges", stage: "material", controls: ["edgeMaterial", "edgeWeight", "edgeSpacing",
      { label: "Bead mark", controls: ["edgeBead", "edgeBeadSize"] }, "edgeTone", "edgeRetention",
      { label: "Direction", controls: ["arrows", "arrowSize", "arrowShare"] }] },
    { label: "Nodes", stage: "form", controls: ["nodeMark", "nodeSize", "nodeScaleBy", "nodeScaleAmount"] },
    { label: "Faces", stage: "material", controls: ["faces", "faceTint", "faceOpacity", { label: "Area", controls: ["faceMinArea", "faceMaxArea"] }, "faceRetention"] },
  ] satisfies ControlGroup[],
  defaults: {
    source: "lattice", direction: "none",
    agents: 70, startShape: "area", disorder: .2, ticks: 30, radius: 72, force: .0016, speed: 1, damping: .985,
    columns: 16, rows: 13, region: "disc", innerRadius: .3, blocked: .08, braid: .5, diagonals: .06, wobble: .5, rootX: .1, rootY: .9,
    roots: 2, generations: 6, children: "2", branchAngle: 30, angleSpread: 12, contraction: .82, survival: .85,
    centerX: 320, centerY: 320, width: 500, height: 420, rotation: 0,
    minDegree: 0, maxDegree: 0, minWeight: 0, maxWeight: 1, minAge: 0, maxAge: 1, isolated: false,
    route: "shortest", metric: "length", startX: 90, startY: 530, endX: 550, endY: 110, followDirection: false,
    routeMaterial: "ink", routeWeight: 3.4, routeSpacing: 9, routeBead: "dot", routeBeadSize: 9, endpoints: true, endpointSize: 16,
    edgeMaterial: "ink", edgeWeight: .9, edgeSpacing: 10, edgeBead: "dot", edgeBeadSize: 3.5, edgeTone: "age", edgeRetention: 1,
    arrows: false, arrowSize: 9, arrowShare: .6,
    nodeMark: "dot", nodeSize: 5, nodeScaleBy: "degree", nodeScaleAmount: .6,
    faces: true, faceTint: "size", faceOpacity: .45, faceMinArea: 0, faceMaxArea: 40000, faceRetention: .75,
  },
  validate(q) {
    for (const [low, high, label] of [["minDegree", "maxDegree", "degree"], ["minWeight", "maxWeight", "weight"], ["minAge", "maxAge", "age"]] as const)
      if ((q[low] as number) > (q[high] as number) && !(high === "maxDegree" && q.maxDegree === 0))
        throw new Error(`Role ${label} range is inverted: ${low} exceeds ${high}`);
    if ((q.faceMinArea as number) > (q.faceMaxArea as number)) throw new Error("Face area range is inverted: faceMinArea exceeds faceMaxArea");
    if (q.source === "contact")
      validateProximityReplayInstrument({ ...proximityReplayInstrumentDefinitions[0].defaults, count: q.agents, ticks: q.ticks, openChains: false });
    if (q.source === "branches") {
      const slots = Number(q.children);
      let width = q.roots as number, potential = width;
      for (let generation = 0; generation < (q.generations as number); generation++) { width *= slots; potential += width; }
      if (potential > 12_000) throw new Error(`Branch trees could grow ${potential} segments; the limit is 12000 (fewer trees, generations or children)`);
    }
    if (q.source === "lattice" && (q.columns as number) * (q.rows as number) > 3600) throw new Error("Lattice has more than 3600 sites");
  },
};
