import { CONTAINER_LETTERS } from "../composition/shape-pieces.js";
import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
type Option = readonly [value: string, label: string];
const control = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition, integer = false): Parameter =>
  control(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly Option[], visibleWhen?: Condition): Parameter =>
  control({ key, label, description, type: "select", options: options.map(([value, text]) => ({ value, label: text })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter =>
  control(toggle(key, label, description), visibleWhen);

const lettered: Condition = { family: ["letters", "mixed"] };
const holed: Condition = { family: ["letters", "polygons", "mixed"] };
const ringed: Condition = { container: ["ring"] };
const lettering: Condition = { container: ["letter"] };
const falling: Condition = { rule: ["settle"] };
const stopped: Condition = { stop: ["coverage"] };
const hatched: Condition = { render: ["hatch", "mixed"] };

export const shapePackingDefinition: InstrumentDefinition = {
  id: "shape-packing",
  title: "Shape Packing",
  description: "Interlocking non-convex pieces (letters, leaves, blobs, polygons with holes) fitted into a container by a deterministic rule: largest first, at a set of angles, at the exact place that touches its neighbours, with a minimum gap. What does not fit is reported, and the negative space that remains can be drawn.",
  renderer: "2d",
  parameters: [
    select("container", "Container", "The shape the pieces are packed into. A ring has a hole nothing enters; a letter uses the ink of a glyph (its counters are holes too); the leaf is a curved, lobed outline. Pieces keep at least the edge margin from every edge, hole and counter.",
      [["rectangle", "Rectangle"], ["ellipse", "Ellipse"], ["ring", "Ring (hole in the middle)"], ["letter", "Letter"], ["leaf", "Leaf"]]),
    select("letter", "Container letter", "The glyph whose ink is the container. Letters with counters (A, B, R, 8, @) leave islands that pieces may fill separately; the ink is fitted uniformly into the width and height below.",
      CONTAINER_LETTERS.map((c): Option => [c, c]), lettering),
    n("hole", "Ring hole", "Width and height of the ring's hole as a fraction of the outer ellipse. Larger values give a thinner band to pack.", .15, .85, .01, .05, .95, ringed),

    n("centerX", "Center X", "Horizontal centre of the container on the canvas.", 0, 640, 1, -4096, 4096),
    n("centerY", "Center Y", "Vertical centre of the container on the canvas.", 0, 640, 1, -4096, 4096),
    n("width", "Width", "Width of the container's box. Width and height are independent, so a different ratio stretches the container (an ellipse, a letter, the leaf); pieces are never stretched.", 100, 640, 1, 20, 4096),
    n("height", "Height", "Height of the container's box.", 100, 640, 1, 20, 4096),
    n("angle", "Rotation", "Turns the container about its centre, in degrees clockwise. The pieces are packed into the turned container.", -180, 180, 1, -3600, 3600),

    select("family", "Piece family", "The population of pieces. Letters are glyphs of the outline font (counters are holes); leaves have a bent midrib, uneven sides and lobed edges; blobs are concave radial shapes; polygons are L, T, U, cross, star, arrow, chevron, comb, bolt, crescent, frame and donut, stretched at random; mixed draws one of the four for each piece. Every piece has a stable id, so a bigger count only adds pieces.",
      [["letters", "Letters"], ["leaves", "Leaf shapes"], ["blobs", "Blobs"], ["polygons", "Polygons"], ["mixed", "Mixed"]]),
    select("letters", "Letters", "Which characters letter pieces draw from. Each piece picks one at random (from the seed and its id), so letters repeat once the count passes the set.",
      [["upper", "A to Z"], ["lower", "a to z"], ["digits", "0 to 9"], ["mixed", "Letters and digits"]], lettered),
    n("count", "Pieces", "How many pieces are tried. More pieces than fit is normal: the ones that fit nowhere, even after shrinking, are reported as unplaced and simply not drawn. Work grows with this, the angles and the search resolution, and is limited (600 pieces, 60 million search steps).", 8, 200, 1, 1, 600, undefined, true),
    n("sizeMax", "Largest piece", "Longest side of the biggest pieces, in canvas units, before they are rotated. Pieces are placed largest first, so the big ones set the structure and the small ones fill what is left.", 40, 260, 1, 2, 2000),
    n("sizeMin", "Smallest piece", "Longest side of the smallest pieces. It may not exceed the largest piece.", 8, 120, 1, 1, 2000),
    n("skew", "Small-piece bias", "How sizes are spread between the smallest and largest: 1 is even on a logarithmic scale, larger values make most pieces small with a few large ones, smaller values favour large pieces.", .5, 4, .1, .1, 10),
    select("counters", "Counters", "Holes in a piece (the inside of an A, a frame, a donut). Open counters are free space that smaller pieces may enter, which needs pieces placed after the ones with holes; solid counters are filled, so nothing enters them.",
      [["open", "Open (smaller pieces may enter)"], ["solid", "Solid (filled in)"]], holed),

    select("order", "Order", "The order pieces are tried in. Largest first gives a strong size hierarchy; smallest first places the small ones in the best spots and the big ones may then find no room; shuffled ignores size (the shuffle comes from the seed).",
      [["largest", "Largest first"], ["smallest", "Smallest first"], ["shuffled", "Shuffled"]]),
    select("rule", "Placement rule", "Where among all the places a piece touches its neighbours it goes. Grow from the middle: the place nearest the container's centre, so the pile spreads outward. Follow the edge: the place nearest the container's boundary, so pieces line the wall and then the layers inside it. Settle: the place furthest in a chosen direction, like pieces falling and stacking.",
      [["center", "Grow from the middle"], ["walls", "Follow the edge"], ["settle", "Settle in a direction"]]),
    n("settleAngle", "Settle direction", "Direction pieces fall, in degrees clockwise from the +x axis on the canvas: 90 is down, 0 to the right, 270 up.", 0, 360, 1, -3600, 3600, falling),
    n("rotations", "Rotations", "How many equally spaced angles every piece may take around a full turn, all tried for every piece: 1 keeps them upright (letters stay readable), 4 quarter turns, 8 and more let pieces tilt into each other's gaps. The best-fitting angle wins by the placement rule.", 1, 24, 1, 1, 24, undefined, true),
    flag("mirror", "Allow mirrored", "Also try every angle mirrored left to right. Mirrored letters read backwards."),
    n("gap", "Gap", "Minimum distance between any two pieces, in canvas units. Pieces are checked exactly as shapes grown by half the gap, so no two are ever closer than this (up to a chord error of 1/16 of the half gap). Zero lets pieces touch.", 0, 16, .5, 0, 200),
    n("margin", "Edge margin", "Minimum distance between a piece and the container's edge, holes and counters, in canvas units.", 0, 40, .5, 0, 500),
    n("resolution", "Search resolution", "Cells across the longest side of the container in the search grid. Finer grids find narrower notches and give a tighter fit, at a cost that grows with its square; the final placement is always exact and the gap is kept at any resolution.", 64, 256, 1, 16, 320, undefined, true),
    n("retries", "Retries", "How many more times a piece that fits nowhere is tried, each at the shrink factor times the previous size, before it is given up as unplaced. Zero never resizes: a piece either fits at its own size or is reported.", 0, 6, 1, 0, 8, undefined, true),
    n("shrink", "Shrink per retry", "The size factor of each retry. Smaller values give up fitting the piece sooner but finish faster.", .5, .95, .01, .05, .99),
    select("stop", "Stop", "Try every piece, or stop as soon as the pieces cover a target share of the container's area (the pieces left over are reported as stopped).",
      [["all", "Try every piece"], ["coverage", "At a coverage target"]]),
    n("coverage", "Coverage target", "Fraction of the container's area (holes excluded) covered by piece area at which packing stops.", .1, .95, .01, .01, 1, stopped),

    select("render", "Draw", "How each piece is drawn: flat fill, an outline, a fill with an ink outline, parallel hatching, or a different technique for each piece tone (the first tone filled, the second hatched, the third outlined, then repeating). Counters are always left open.",
      [["fill", "Fill"], ["outline", "Outline"], ["fillOutline", "Fill and outline"], ["hatch", "Hatch"], ["mixed", "Fill, hatch and outline by color"]]),
    select("colorBy", "Color by", "What chooses each piece's color from the palette (the first palette color is the ink; the others are piece tones). Size: from the smallest to the largest placed piece. Order: cycles in placement order. Angle: by the angle step the piece took. Family: letter, leaf, blob, polygon.",
      [["size", "Size"], ["order", "Placement order"], ["angle", "Angle"], ["family", "Family"]]),
    n("weight", "Line weight", "Stroke width of outlines, hatch lines, the leftover outline and the container outline.", .3, 3, .05, .05, 50),
    n("hatchSpacing", "Hatch spacing", "Distance between hatch lines. At most 150,000 lines are drawn; a smaller spacing or many pieces can reach it.", 1.5, 12, .25, .5, 200, hatched),
    n("hatchAngle", "Hatch angle", "Direction of the hatch lines in degrees (added to each piece's own turn when the hatch follows the piece).", 0, 180, 1, -3600, 3600, hatched),
    flag("hatchFollow", "Hatch follows piece", "Turn the hatching with each piece and anchor it to the piece, instead of one global set of lines across the canvas.", hatched),
    select("leftover", "Negative space", "Draw the container minus every piece: a light wash of the ink color, an outline of the remaining gaps, or nothing. It is derived exactly, so gaps inside counters and between pieces show as they are.",
      [["none", "None"], ["fill", "Wash"], ["outline", "Outline"]]),
    flag("frame", "Container outline", "Draw the container's boundary (and its holes) as an ink line."),
  ],
  controlGroups: [
    { label: "Container", controls: ["container", "letter", "hole"] },
    { label: "Placement", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "angle"] },
    { label: "Pieces", controls: ["family", "letters", "count", { label: "Size range", controls: ["sizeMax", "sizeMin"], proportional: true }, "skew", "counters"] },
    { label: "Packing rule", controls: ["order", "rule", "settleAngle", "rotations", "mirror", { label: "Spacing", controls: ["gap", "margin"], proportional: true }] },
    { label: "Search", controls: ["resolution", "retries", "shrink", "stop", "coverage"] },
    { label: "Drawing", controls: ["render", "colorBy", "weight", { label: "Hatch", controls: ["hatchSpacing", "hatchAngle", "hatchFollow"] }, "leftover", "frame"] },
  ] satisfies ControlGroup[],
  defaults: {
    container: "ellipse", letter: "S", hole: .45,
    centerX: 320, centerY: 320, width: 540, height: 540, angle: 0,
    family: "mixed", letters: "upper", count: 80, sizeMax: 150, sizeMin: 26, skew: 1.6, counters: "open",
    order: "largest", rule: "center", settleAngle: 90, rotations: 8, mirror: false, gap: 3, margin: 6,
    resolution: 150, retries: 2, shrink: .85, stop: "all", coverage: .7,
    render: "fill", colorBy: "size", weight: 1, hatchSpacing: 3.5, hatchAngle: 35, hatchFollow: true, leftover: "none", frame: false,
  },
  validate(q) {
    if ((q.sizeMin as number) > (q.sizeMax as number)) throw new Error("Smallest piece exceeds Largest piece: lower Smallest piece or raise Largest piece");
  },
};
