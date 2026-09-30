import type { ControlGroup, InstrumentDefinition, Parameter } from "../types.js";
import { validateRoadsParcels } from "../composition/roads-parcels-params.js";
import { choice, numeric, toggle } from "./types.js";

type Condition = Record<string, readonly (string | number | boolean)[]>;
const withCondition = (parameter: Parameter, visibleWhen?: Condition): Parameter => visibleWhen ? { ...parameter, visibleWhen } : parameter;
const integerKeys = new Set(["steps", "anchors", "avenues", "collectors"]);
const n = (key: string, label: string, description: string, min: number, max: number, step: number,
  hardMin: number, hardMax: number, visibleWhen?: Condition): Parameter =>
  withCondition(numeric(key, label, description, min, max, step, { hardMin, hardMax, integer: integerKeys.has(key) }), visibleWhen);
const select = (key: string, label: string, description: string, options: readonly string[], labels: Record<string, string> = {}, visibleWhen?: Condition): Parameter =>
  withCondition({ ...choice(key, label, description, [...options]), options: options.map((value) => ({ value, label: labels[value] ?? value })) }, visibleWhen);
const flag = (key: string, label: string, description: string, visibleWhen?: Condition): Parameter => withCondition(toggle(key, label, description), visibleWhen);

const fillers = ["solid", "hatch", "dots", "contours", "none"];
const fillLabels = { solid: "Solid", hatch: "Hatching", dots: "Dots", contours: "Contours", none: "Open" };
const zoned: Condition = { reserve: ["ellipse", "rectangle"] };
const hubbed: Condition = { field: ["radial", "spiral"] };

export const roadsParcelsDefinition: InstrumentDefinition = {
  id: "roads-parcels",
  title: "Roads and Parcels",
  description: "A street network grown one street at a time, the blocks it encloses, and lots cut from each block along its nearest road: roads in width classes, lots in three types with their own fills, and land left unbuilt.",
  procedure: "Grow a street network step by step: pass the first streets through anchor points, then repeatedly find the place with the most room and run a street through it along a guide field, stopping each end at the first road it meets. Cut each enclosed block into lots along its nearest road and fill them by type.",
  renderer: "2d",
  parameters: [
    select("field", "Street pattern", "The guide field streets follow. Grid runs along one angle; radial makes spokes and rings around the focus; spiral turns them; organic bends with smooth noise.", ["grid", "radial", "spiral", "organic"],
      { grid: "Grid", radial: "Radial and ring", spiral: "Spiral", organic: "Organic" }),
    n("blockSize", "Block size", "The widest block the growth accepts: streets keep being added until no disc wider than this fits between roads. Small values give a fine mesh and take many more steps; the slider stops at 70 to stay responsive, exact entry goes down to 8.", 70, 240, 1, 8, 2000),
    n("steps", "Steps", "Growth steps, one attempted street each. Early streets are long and set the hierarchy; later ones fill what is left. Growth stops by itself when nothing fits (about 50 steps at the default, up to about 210 at the slider corner), so steps beyond that change nothing; the slider ends at 240 and exact entry goes to 1500.", 0, 240, 1, 0, 1500),
    n("wobble", "Wobble", "Each street's own turn away from the field, up to this many degrees either way. Zero follows the field exactly.", 0, 40, 1, 0, 90),
    n("anchors", "Anchors", "Streets grown first, through points on a ring around the site centre, before growth looks for room elsewhere. Zero starts from the most open place.", 0, 6, 1, 0, 12),
    n("anchorSpread", "Anchor ring", "Distance of the anchors from the centre, as a fraction of the way to the nearer site edge.", 0, 1, .01, 0, 1),
    n("anchorAngle", "Anchor angle", "Turns the ring of anchors, in degrees.", -180, 180, 1, -3600, 3600),
    flag("boundaryRoad", "Boundary road", "A road around the site edge. Off leaves the edge open: streets end there and only fully enclosed blocks get lots."),

    n("centerX", "Center X", "Horizontal centre of the site in canvas units.", 80, 560, 1, -320, 960),
    n("centerY", "Center Y", "Vertical centre of the site in canvas units.", 80, 560, 1, -320, 960),
    n("width", "Width", "Site width. The network is grown for this size.", 200, 640, 1, 40, 2000),
    n("height", "Height", "Site height.", 200, 640, 1, 40, 2000),
    n("rotation", "Rotation", "Turns the finished network about the site centre, in degrees; the pattern is grown unturned.", -180, 180, 1, -360, 360),

    n("gridAngle", "Grid angle", "Direction of the grid's streets, in degrees.", -90, 90, 1, -3600, 3600, { field: ["grid"] }),
    n("spin", "Spiral turn", "Angle between the spokes and the radial direction; 0 is a plain radial pattern, 45 an even spiral.", -80, 80, 1, -3600, 3600, { field: ["spiral"] }),
    n("warp", "Warp", "Smooth noise added to the guide angle, up to this many degrees, so a grid or a radial pattern bends unevenly.", 0, 60, 1, 0, 720, { field: ["grid", "radial", "spiral"] }),
    n("fieldScale", "Field scale", "Size of the noise features that bend the streets, in canvas units.", 60, 600, 5, 4, 4000),
    n("hubRadius", "Hub ring", "Radius of a ring road around the focus that spokes end on; its inside becomes an unbuilt plaza. Zero has no ring.", 0, 90, 1, 0, 2000, hubbed),

    select("junction", "Junction policy", "Tee: a street ends on the first road it meets. Crossing: it passes through one ordinary street on each side first. Through: up to three, so streets run long across the site.", ["tee", "crossing", "through"],
      { tee: "T-junctions", crossing: "Crossroads", through: "Long crossings" }),
    n("snap", "Snap distance", "A street that ends within this distance of a road's node lands on the node, and one that runs alongside a road this close joins it, so no slivers or near misses remain.", 1, 20, .5, .5, 200),
    n("minAngle", "Shallowest meeting", "A street may not meet a road at less than this angle (degrees); such a street is a dead end.", 0, 60, 1, 0, 80),
    select("deadEnds", "Dead ends", "A street that could not finish is dropped, or kept as a dead-end stub if it joined at the other end. Either way the void it could not fill stays one large block.", ["drop", "stub"],
      { drop: "Drop", stub: "Keep as stubs" }),

    n("focusX", "Focus X", "Horizontal offset of the focus from the site centre. The focus is the centre of radial and spiral patterns, of the hub ring, and of the shrinking blocks.", -320, 320, 1, -2000, 2000),
    n("focusY", "Focus Y", "Vertical offset of the focus from the site centre.", -320, 320, 1, -2000, 2000),
    n("focusScale", "Blocks at focus", "Block size at the focus as a fraction of Block size; it grows back to full size over Focus reach. The slider stops at .6; exact entry goes to .1.", .6, 1, .01, .1, 1),
    n("focusReach", "Focus reach", "Distance from the focus over which blocks grow back to their full size.", 40, 600, 5, 1, 4000),

    select("reserve", "Reserved zone", "A shape kept clear of streets and lots: a park, water or an empty quarter. Its outline is a road, so it is a block of its own.", ["none", "ellipse", "rectangle"],
      { none: "None", ellipse: "Ellipse", rectangle: "Rectangle" }),
    n("reserveX", "Zone X", "Horizontal offset of the zone from the site centre.", -320, 320, 1, -2000, 2000, zoned),
    n("reserveY", "Zone Y", "Vertical offset of the zone from the site centre.", -320, 320, 1, -2000, 2000, zoned),
    n("reserveWidth", "Zone width", "Width of the zone (of its bounding box before turning). It is clipped to stay inside the site.", 30, 400, 1, 0, 4000, zoned),
    n("reserveHeight", "Zone height", "Height of the zone.", 30, 400, 1, 0, 4000, zoned),
    n("reserveAngle", "Zone angle", "Turns the zone, in degrees.", -90, 90, 1, -3600, 3600, zoned),
    n("unbuiltShare", "Unbuilt blocks", "Share of the blocks left without lots. Which ones follows Unbuilt rule.", 0, .6, .01, 0, 1),
    select("unbuiltRule", "Unbuilt rule", "Random: a stable draw per block. Largest: the biggest blocks (parks). Irregular: the least compact. Remote: the farthest from the focus.", ["random", "largest", "irregular", "remote"],
      { random: "Random", largest: "Largest", irregular: "Least compact", remote: "Farthest from focus" }),

    n("avenues", "Avenues", "How many of the first streets grown are avenues (the widest class). The boundary road, hub ring and links are avenues too.", 0, 30, 1, 0, 100000),
    n("collectors", "Collectors", "How many streets after the avenues are collectors (medium width). All later streets are local.", 0, 60, 1, 0, 100000),

    n("lotWidth", "Lot width", "Typical frontage of a lot along its road. Lots are cut across a block until they are about this wide. The slider stops at 14 to keep the lot count responsive; exact entry goes to 2.", 14, 60, .5, 2, 2000),
    n("lotDepth", "Lot depth", "Typical depth of a lot from its road. A block deeper than about twice this keeps an unbuilt interior court. The slider starts at 18; exact entry goes to 2.", 18, 90, .5, 2, 2000),
    n("lotVariety", "Lot variety", "How unevenly blocks are cut into lots. Zero cuts every piece in half; one lets a cut fall anywhere the minimum widths allow.", 0, 1, .01, 0, 1),
    n("setback", "Setback", "Land kept clear beside each road, beyond half its width.", 0, 8, .25, 0, 200),

    select("typeBy", "Lot types by", "Which rule sorts lots into three types: the class of the road they front, their size, their distance from the focus, the age of their road, or chance.", ["class", "size", "center", "age", "random"],
      { class: "Road class", size: "Size", center: "Distance from focus", age: "Road age", random: "Chance" }),
    select("typeA", "Type A fill", "How lots of the first type are filled. Type A is the widest road class, the largest lots, the nearest to the focus, or the oldest roads.", fillers, fillLabels),
    select("typeB", "Type B fill", "How lots of the middle type are filled.", fillers, fillLabels),
    select("typeC", "Type C fill", "How lots of the last type are filled.", fillers, fillLabels),
    n("fillSpacing", "Fill spacing", "Distance between hatch lines, dots and contour levels inside a lot.", 2, 16, .25, .5, 500),
    n("fillWeight", "Fill weight", "Hatch and contour line weight; dots are 2.2 times as wide.", .3, 3, .05, 0, 20),
    n("hatchAngle", "Hatch angle", "Hatching direction relative to the lot's road: 0 runs along the street, 90 across it.", -90, 90, 1, -3600, 3600),
    n("fillInset", "Fill inset", "Gap between a lot's edge and its hatching, dots or contours.", 0, 6, .25, 0, 100),
    n("underpaint", "Underpaint", "Tint of a flat colour under hatching, dots and contours, in the type's colour.", 0, 1, .01, 0, 1),
    flag("lotOutline", "Lot outlines", "Draw every lot's boundary."),
    n("outlineWeight", "Outline weight", "Weight of the lot outlines.", .2, 2, .05, 0, 20, { lotOutline: [true] }),

    n("avenueWidth", "Avenue width", "Stroke width of avenues. Lots keep half of it, and the setback, clear of the road.", 1, 12, .25, 0, 200),
    n("collectorWidth", "Collector width", "Stroke width of collectors.", .5, 8, .25, 0, 200),
    n("streetWidth", "Street width", "Stroke width of local streets and of the reserved zone's outline.", .3, 5, .1, 0, 200),
    select("roadMaterial", "Road material", "Ink lines, stitches along each street, or beads.", ["ink", "stitch", "beads"], { ink: "Ink", stitch: "Stitches", beads: "Beads" }),
    n("stitchSpacing", "Stitch spacing", "Distance between stitches or beads along a street.", 3, 20, .5, .5, 1000, { roadMaterial: ["stitch", "beads"] }),
    select("roadColor", "Road color", "One ink, or the streets tinted by age: oldest third in the first colour, middle third in the fifth, newest third in the second.", ["ink", "age"],
      { ink: "One ink", age: "By age" }),
    select("junctionMark", "Junction marks", "A dot or ring at every junction of three or more roads, larger where four or more meet.", ["none", "dot", "rings"], { none: "None", dot: "Dots", rings: "Rings" }),
    n("markSize", "Mark size", "Diameter of the junction marks at a three-way junction.", 2, 14, .5, 0, 100, { junctionMark: ["dot", "rings"] }),
  ],
  controlGroups: [
    { label: "Streets", stage: "form", controls: ["field", "blockSize", "steps", "wobble", "anchors", "anchorSpread", "anchorAngle", "boundaryRoad"] },
    { label: "Placement", stage: "frame", controls: ["centerX", "centerY", { label: "Size", controls: ["width", "height"], proportional: true }, "rotation"] },
    { label: "Guide field", stage: "form", controls: ["gridAngle", "spin", "warp", "fieldScale", "hubRadius"] },
    { label: "Junctions", stage: "process", controls: ["junction", "snap", "minAngle", "deadEnds"] },
    { label: "Focus", stage: "process", controls: ["focusX", "focusY", "focusScale", "focusReach"] },
    { label: "Reserved space", stage: "process", controls: ["reserve", "reserveX", "reserveY", { label: "Zone size", controls: ["reserveWidth", "reserveHeight"], proportional: true }, "reserveAngle", "unbuiltShare", "unbuiltRule"] },
    { label: "Hierarchy", stage: "process", controls: ["avenues", "collectors"] },
    { label: "Lots", stage: "process", controls: ["lotWidth", "lotDepth", "lotVariety", "setback"] },
    { label: "Lot types", stage: "process", controls: ["typeBy", "typeA", "typeB", "typeC"] },
    { label: "Filler", stage: "material", controls: ["fillSpacing", "fillWeight", "hatchAngle", "fillInset", "underpaint", "lotOutline", "outlineWeight"] },
    { label: "Roads", stage: "material", controls: [{ label: "Widths", controls: ["avenueWidth", "collectorWidth", "streetWidth"], proportional: true }, "roadMaterial", "stitchSpacing", "roadColor", "junctionMark", "markSize"] },
  ] satisfies ControlGroup[],
  defaults: {
    field: "grid", blockSize: 100, steps: 60, wobble: 8, anchors: 2, anchorSpread: .35, anchorAngle: 25, boundaryRoad: true,
    centerX: 320, centerY: 320, width: 560, height: 520, rotation: 0,
    gridAngle: 8, spin: 35, warp: 22, fieldScale: 240, hubRadius: 34,
    junction: "tee", snap: 4, minAngle: 25, deadEnds: "drop",
    focusX: -40, focusY: -20, focusScale: .6, focusReach: 300,
    reserve: "ellipse", reserveX: 120, reserveY: 100, reserveWidth: 130, reserveHeight: 90, reserveAngle: -20, unbuiltShare: .06, unbuiltRule: "largest",
    avenues: 3, collectors: 8,
    lotWidth: 24, lotDepth: 34, lotVariety: .5, setback: 1.5,
    typeBy: "center", typeA: "solid", typeB: "hatch", typeC: "dots", fillSpacing: 4, fillWeight: 1, hatchAngle: 0, fillInset: 1.5, underpaint: .3, lotOutline: true, outlineWeight: .6,
    avenueWidth: 5, collectorWidth: 3.5, streetWidth: 2, roadMaterial: "ink", stitchSpacing: 8, roadColor: "ink", junctionMark: "none", markSize: 6,
  },
  validate: validateRoadsParcels,
};
