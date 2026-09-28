import { binaryCellPartition2D, delaunay2D, mapTriangleCoordinates2D,
  orderedConvexPolygonFilter2D, seededQuadrantPartition2D, seededTrianglePoints2D, triangulateSimplePolygon2D } from "@procedurals/javascript";
import { JavaRandom } from "@procedurals/javascript/examples/city-marks/city-marks.js";
import type { Layer } from "../types.js";
import { inside } from "../composition/core.js";
import { channels, choice, numeric, toggle, type StudioDefinition } from "./types.js";

type Params = Layer["params"];
type Point = [number, number];
type Polygon = Point[];
/** Read-only placement geometry produced by the polygon instrument. */
export interface PolygonPlacementView {
  readonly attempts: number;
  readonly size: number;
  sourceIndexAt(index: number): number;
  vertexCountAt(index: number): number;
  xAt(polygonIndex: number, vertexIndex: number): number;
  yAt(polygonIndex: number, vertexIndex: number): number;
  toValues(): {attempts: number; polygons: number[][][]; sourceIndices: number[]};
}
/** Geometry access used by facet construction and material application. */
export interface FacetMeshView {
  readonly inputCount: number;
  readonly vertexCount: number;
  readonly faceCount: number;
  readonly edgeCount: number;
  readonly workUsed: number;
  pointAt(index: number): number[];
  triangleAt(index: number): number[];
  edgeAt(index: number): number[];
  edgeFacesAt(index: number): number[];
  pointInto(index: number, out: number[], offset?: number): number[];
  triangleInto(index: number, out: number[], offset?: number): number[];
  edgeInto(index: number, out: number[], offset?: number): number[];
  edgeFacesInto(index: number, out: number[], offset?: number): number[];
  inputVertexAt(index: number): number;
  sourceIndexAt(index: number): number;
  toValues(): {points: number[][]; inputToVertex: number[]; sourceIndices: number[];
    triangles: number[][]; edges: number[][]; edgeFaces: number[][]; workUsed: number};
}
export interface FacetGroup {
  sites: Point[];
  mesh: FacetMeshView;
  selected: boolean[];
  grainCounts: number[];
}
type Canvas = { push(): void; pop(): void; translate(x: number, y: number): void; noFill(): void; noStroke(): void;
  stroke(...v: number[]): void; fill(...v: number[]): void; strokeWeight(v: number): void;
  rect(x: number, y: number, w: number, h: number): void; circle(x: number, y: number, d: number): void;
  line(x: number, y: number, xx: number, yy: number): void; triangle(x: number, y: number, xx: number, yy: number, xxx: number, yyy: number): void;
  beginShape(): void; vertex(x: number, y: number): void; endShape(mode?: string): void; CLOSE: string;
};
const n = (q: Params, key: string) => Number(q[key]);
function valid(q: Params, names: string[], integers: string[] = []) {
  
  for (const key of names) if (!Number.isFinite(n(q, key))) throw new Error(`${key} must be finite`);
  for (const key of integers) if (!Number.isSafeInteger(n(q, key))) throw new Error(`${key} must be an integer`);
}
function range(q: Params, key: string, min: number, max: number) {
  if (n(q, key) < min || n(q, key) > max) throw new Error(`${key} must be in [${min}, ${max}]`);
}
function color(p: Canvas, layer: Layer, index: number, alpha: number, stroke: boolean) {
  const c = layer.palette[index % layer.palette.length];
  (stroke ? p.stroke : p.fill).call(p, ...channels(c), alpha);
}
function polygon(p: Canvas, points: Polygon) {
  p.beginShape(); for (const pt of points) p.vertex(pt[0], pt[1]); p.endShape(p.CLOSE);
}



export const regionFacetInstrumentDefinitions: StudioDefinition[] = [
  { id: "region-marks", title: "Region marks", description: "Seeded quadrant refinement and independently selected leaf marks.", parameters: [numeric("centerX", "Center X", "Local partition center.", -320, 960),
    numeric("centerY", "Center Y", "Local partition center.", -320, 960),
    numeric("width", "Width", "Partition width.", 16, 900, 1, { hardMin: 1 }),
    numeric("height", "Height", "Partition height.", 16, 900, 1, { hardMin: 1 }),
    numeric("replacements", "Refinements", "Successful quadrant replacements.", 0, 46, 1, { integer: true, hardMax: 48 }),
    numeric("maxDepth", "Maximum visible depth", "Combine any deeper quadrant leaves back into their ancestor at this level.", 0, 12, 1, { integer: true }),
    numeric("fraction", "Refinement eligibility", "Fraction of live leaves eligible for the next split.", .05, 1, .01, { hardMin: .00001 }),
    numeric("retention", "Leaf retention", "Independent chance to draw each resulting leaf.", 0, 1, .01),
    choice("mark", "Leaf marks", "None, center dot, line, or a grid of dots.", ["none", "dot", "line", "grid"]),
    numeric("markCount", "Marks per leaf", "Grid side length, or repeated marks along the leaf.", 1, 5, 1, { integer: true }),
    numeric("markScale", "Mark scale", "Mark length or diameter relative to cell size.", .02, .8, .01),
    numeric("inset", "Inset", "Inset for leaf backgrounds and outlines.", 0, 20, .5),
    toggle("fillLeaves", "Fill leaves", "Fill retained leaf backgrounds."),
    toggle("outline", "Outline leaves", "Draw retained leaf borders."),
    numeric("weight", "Outline weight", "Leaf outline and line weight.", .2, 4, .1)], defaults: {centerX: 320,
      centerY: 320,
      width: 480,
      height: 480,
      replacements: 44,
      maxDepth: 8,
      fraction: .6,
      retention: .7,
      mark: "dot",
      markCount: 1,
      markScale: .25,
      inset: 2,
      fillLeaves: false,
      outline: true,
      weight: 1}, validate: validateRegion },
  { id: "panel-marks", title: "Panel marks", description: "Retained binary-cell leaves in an editable rectangular grid.", parameters: [numeric("centerX", "Center X", "Footprint center.", -320, 960),
    numeric("centerY", "Center Y", "Footprint center.", -320, 960),
    numeric("width", "Width", "Footprint width.", 16, 900, 1, { hardMin: 1 }),
    numeric("height", "Height", "Footprint height.", 16, 900, 1, { hardMin: 1 }),
    numeric("columns", "Columns", "Discrete partition columns.", 2, 100, 1, { integer: true }),
    numeric("rows", "Rows", "Discrete partition rows.", 2, 100, 1, { integer: true }),
    numeric("attempts", "Cut attempts", "Attempt-bounded seeded binary cuts.", 0, 300, 1, { integer: true }),
    choice("axis", "Axis policy", "Longest or random cut direction.", ["LONGEST", "RANDOM"]),
    numeric("cutBias", "Subdivision bias", "Negative favors more even cell areas; positive favors contrasting leaf areas, using up to four extra seeded partitions.", -1, 1, .05),
    numeric("retention", "Leaf retention", "Chance to keep each panel, without changing cuts.", 0, 1, .01),
    numeric("inset", "Inset", "Inner panel inset.", 0, 20, .5),
    numeric("gap", "Gap", "Additional space between neighboring panels.", 0, 20, .5),
    toggle("fillPanels", "Fill", "Fill retained panels."),
    toggle("outline", "Outline", "Draw panel outlines."),
    numeric("nestedLines", "Nested lines", "Interior concentric outlines.", 0, 12, 1, { integer: true }),
    numeric("weight", "Stroke weight", "Panel and interior outline width.", .2, 4, .1)], defaults: {centerX: 320,
      centerY: 320,
      width: 440,
      height: 440,
      columns: 36,
      rows: 36,
      attempts: 55,
      axis: "RANDOM",
      cutBias: 0,
      retention: .68,
      inset: 2,
      gap: 1,
      fillPanels: false,
      outline: true,
      nestedLines: 2,
      weight: 1}, validate: validatePanel },
  { id: "polygon-marks", title: "Polygon marks", description: "Convex polygon source and greedy nonoverlapping proposals.", parameters: [numeric("centerX", "Center X", "Source polygon center.", -320, 960),
    numeric("centerY", "Center Y", "Source polygon center.", -320, 960),
    numeric("width", "Source width", "Source polygon diameter.", 20, 900, 1, { hardMin: 1 }),
    numeric("height", "Source height", "Source polygon diameter.", 20, 900, 1, { hardMin: 1 }),
    numeric("sides", "Source sides", "Convex source vertex count.", 3, 12, 1, { integer: true }),
    numeric("orientation", "Source angle", "Source polygon orientation in degrees.", -180, 180),
    numeric("irregularity", "Vertex irregularity", "Seeded radial irregularity; invalid convex outlines are rejected.", 0, .15, .005),
    numeric("proposals", "Proposals", "Seeded marks proposed for greedy placement.", 1, 400, 1, { integer: true }),
    numeric("retention", "Proposal retention", "Fraction of source proposals attempted.", 0, 1, .01),
    numeric("size", "Half length", "Independent proposed capsule or diamond half length.", 2, 100, 1, { hardMin: .1 }),
    numeric("ratio", "Mark aspect", "Mark minor-to-major dimension ratio.", .1, 2, .01, { hardMin: .01 }),
    numeric("sizeDisorder", "Size disorder", "Relative size variation independent of position.", 0, .9, .01),
    numeric("rotation", "Mark angle", "Base mark orientation in degrees.", -180, 180),
    numeric("rotationSpread", "Angle spread", "Maximum seeded deviation in degrees.", 0, 180),
    choice("shape", "Shape", "Proposal polygon shape.", ["capsule", "diamond"]),
    toggle("fillMarks", "Fill", "Fill placed marks."),
    toggle("outline", "Outline", "Stroke placed marks."),
    numeric("weight", "Outline weight", "Stroke width.", .2, 4, .1)], defaults: {centerX: 320,
    centerY: 320,
    width: 450,
    height: 440,
    sides: 3,
    orientation: -90,
    irregularity: 0,
    proposals: 150,
    retention: .8,
    size: 17,
    ratio: .5,
    sizeDisorder: .4,
    rotation: 0,
    rotationSpread: 180,
    shape: "capsule",
    fillMarks: false,
    outline: true,
    weight: 1}, validate: validatePolygon },
  { id: "facet-marks", title: "Facet marks", description: "Local sampled convex source groups and genuine Delaunay facets.", parameters: [numeric("centerX", "Center X", "Source constellation center.", -320, 960),
    numeric("centerY", "Center Y", "Source constellation center.", -320, 960),
    numeric("width", "Source width", "Individual polygon width.", 20, 850, 1, { hardMin: 1 }),
    numeric("height", "Source height", "Individual polygon height.", 20, 850, 1, { hardMin: 1 }),
    numeric("sides", "Source sides", "Triangle or convex polygon.", 3, 12, 1, { integer: true }),
    numeric("orientation", "Source angle", "Rotation in degrees.", -180, 180),
    numeric("groups", "Source groups", "Independent locally sampled meshes.", 1, 8, 1, { integer: true }),
    numeric("groupSpread", "Group spread", "Maximum group-center distance.", 0, 400),
    numeric("sites", "Sites per group", "Delaunay input sites inside each polygon.", 3, 100, 1, { integer: true }),
    choice("distribution", "Sites distribution", "Uniform area or clustered around a local seeded center.", ["uniform", "cluster"]),
    numeric("cluster", "Cluster extent", "Cluster bias toward the seeded center; 1 preserves uniform area.", .1, 1, .01),
    numeric("jitter", "Site jitter", "Mix uniform seeded positions into an ordered local lattice.", 0, 1, .01),
    numeric("selectedFraction", "Facet fraction", "Independent chance to draw each facet.", 0, 1, .01),
    choice("mode", "Material", "Fill, wire or sampled grain.", ["fill", "wire", "grain"]),
    numeric("grain", "Grain density", "Grain points per facet area.", 0, .16, .005),
    numeric("weight", "Wire weight", "Facet line width.", .2, 4, .1),
    numeric("opacity", "Opacity", "Fill alpha.", 0, 255, 1)], defaults: {centerX: 320,
    centerY: 320,
    width: 310,
    height: 300,
    sides: 5,
    orientation: -90,
    groups: 1,
    groupSpread: 180,
    sites: 35,
    distribution: "uniform",
    cluster: .55,
    jitter: 1,
    selectedFraction: .7,
    mode: "wire",
    grain: .035,
    weight: 1,
    opacity: 170}, validate: validateFacet },
  { id: "grain-marks", title: "Grain marks", description: "Editable polygon groups triangulated and sampled with separate mark material.", parameters: [numeric("centerX", "Center X", "Source constellation center.", -320, 960),
    numeric("centerY", "Center Y", "Source constellation center.", -320, 960),
    numeric("width", "Polygon width", "Each source polygon width.", 20, 850, 1, { hardMin: 1 }),
    numeric("height", "Polygon height", "Each source polygon height.", 20, 850, 1, { hardMin: 1 }),
    numeric("sides", "Polygon sides", "Convex polygon source vertex count.", 3, 12, 1, { integer: true }),
    numeric("orientation", "Source angle", "Polygon rotation in degrees.", -180, 180),
    numeric("groups", "Source groups", "Independent local polygon groups.", 1, 8, 1, { integer: true }),
    numeric("groupSpread", "Group spread", "Maximum group-center distance.", 0, 400),
    numeric("density", "Point density", "Samples per source polygon area.", .001, .15, .001),
    choice("distribution", "Distribution", "Uniform interior, vertex-near or exact edge positions.", ["uniform", "vertex", "edge"]),
    numeric("size", "Mark size", "Dot diameter or half stroke length.", .5, 10, .25),
    numeric("sizeVariation", "Size variation", "Relative seeded mark-size variation.", 0, .9, .01),
    numeric("weight", "Stroke weight", "Line mark stroke width.", .2, 4, .1),
    numeric("angle", "Stroke angle", "Base stroke orientation in degrees.", -180, 180),
    numeric("angleSpread", "Angle spread", "Seeded orientation deviation in degrees.", 0, 180),
    toggle("strokes", "Strokes", "Draw short lines instead of dots.")], defaults: {centerX: 320,
      centerY: 320,
      width: 280,
      height: 290,
      sides: 5,
      orientation: -90,
      groups: 2,
      groupSpread: 170,
      density: .018,
      distribution: "uniform",
      size: 2,
      sizeVariation: .5,
      weight: 1,
      angle: 0,
      angleSpread: 180,
      strokes: false}, validate: validateGrain },
];

function validateRegion(q: Params) {
  valid(q, ["centerX", "centerY", "width", "height", "replacements", "maxDepth", "fraction", "retention", "markCount", "markScale", "inset", "weight"], ["replacements", "maxDepth", "markCount"]);
  
  range(q,"width",1,1000); range(q,"height",1,1000); range(q,"replacements",0,48); range(q,"maxDepth",0,12); range(q,"fraction",.00001,1);
  range(q,"retention",0,1); range(q,"markCount",1,8); range(q,"markScale",.001,1); range(q,"inset",0,50); range(q,"weight",.01,20);
  if (!["none","dot","line","grid"].includes(String(q.mark))) throw new Error("Invalid region mark vocabulary");
  // Repeatedly splitting the same leaf must remain representable at this footprint.
  const minSide = Math.min(n(q,"width"), n(q,"height"));
  if (minSide / Math.pow(2, n(q,"replacements")) < 1e-14) throw new Error("Refinement depth exceeds source precision");
}
function validatePanel(q: Params) {
  valid(q, ["centerX","centerY","width","height","columns","rows","attempts","cutBias","retention","inset","gap","nestedLines","weight"], ["columns","rows","attempts","nestedLines"]);
  
  range(q,"width",1,1000); range(q,"height",1,1000); range(q,"columns",1,150); range(q,"rows",1,150);
  range(q,"attempts",0,400); range(q,"cutBias",-1,1); range(q,"retention",0,1); range(q,"inset",0,50); range(q,"gap",0,50);
  range(q,"nestedLines",0,16); range(q,"weight",.01,20);
  if (q.axis !== "LONGEST" && q.axis !== "RANDOM") throw new Error("Invalid partition axis");
}
function validatePolygon(q: Params) {
  valid(q, ["centerX","centerY","width","height","sides","orientation","irregularity","proposals","retention","size","ratio","sizeDisorder","rotation","rotationSpread","weight"], ["sides","proposals"]);
  
  range(q,"width",1,1000); range(q,"height",1,1000); range(q,"sides",3,12); range(q,"irregularity",0,.3);
  range(q,"proposals",0,450); range(q,"retention",0,1); range(q,"size",.1,120);
  range(q,"ratio",.01,3); range(q,"sizeDisorder",0,.95); range(q,"rotationSpread",0,180); range(q,"weight",.01,20);
  if (q.shape !== "capsule" && q.shape !== "diamond") throw new Error("Invalid proposal shape");
}
function validateSource(q: Params) {
  valid(q, ["centerX","centerY","width","height","sides","orientation","groups","groupSpread"], ["sides","groups"]);
  
  range(q,"width",1,900); range(q,"height",1,900); range(q,"sides",3,12);
  range(q,"groups",1,8); range(q,"groupSpread",0,500);
}
function validateFacet(q: Params) {
  validateSource(q); 
  valid(q, ["sites","cluster","jitter","selectedFraction","grain","weight","opacity"], ["sites"]);
  range(q,"sites",3,110); range(q,"cluster",.01,1); range(q,"jitter",0,1);
  range(q,"selectedFraction",0,1); range(q,"grain",0,.2); range(q,"weight",.01,20); range(q,"opacity",0,255);
  if (n(q,"groups") * n(q,"sites") > 500) throw new Error("Too many group sites for bounded triangulation");
  if (!["uniform","cluster"].includes(String(q.distribution)) || !["fill","wire","grain"].includes(String(q.mode))) throw new Error("Invalid facet mode");
}
function validateGrain(q: Params) {
  validateSource(q); 
  valid(q, ["density","size","sizeVariation","weight","angle","angleSpread"]);
  range(q,"density",0,.2); range(q,"size",.1,20); range(q,"sizeVariation",0,.95);
  range(q,"weight",.01,20); range(q,"angleSpread",0,180);
  if (!["uniform","vertex","edge"].includes(String(q.distribution))) throw new Error("Invalid grain distribution");
}

export function regionLeaves(q: Params, seed: number) {
  validateRegion(q);
  const model = seededQuadrantPartition2D({ seed: seed >>> 0, replacements: n(q,"replacements"),
    origin: [n(q,"centerX")-n(q,"width")/2,n(q,"centerY")-n(q,"height")/2],
    extent: [n(q,"width"),n(q,"height")], selectionFraction: n(q,"fraction") });
  const depth=n(q,"maxDepth"), cells=2**depth, ox=n(q,"centerX")-n(q,"width")/2, oy=n(q,"centerY")-n(q,"height")/2;
  const dx=n(q,"width")/cells, dy=n(q,"height")/cells;
  const leaves: { bounds: [number,number,number,number]; id:number }[]=[];
  const ancestors=new Map<string,number>();
  for(let i=0;i<model.size;i++) {
    const b=model.boundsAt(i) as [number,number,number,number];
    if(b[2]-b[0]>=dx && b[3]-b[1]>=dy) {leaves.push({bounds:b,id:model.idAt(i)});continue;}
    const x=Math.floor(((b[0]+b[2])/2-ox)/dx), y=Math.floor(((b[1]+b[3])/2-oy)/dy);
    if(x<0||x>=cells||y<0||y>=cells)throw new Error("Quadrant ancestor escaped source domain");
    const key=`${x},${y}`;
    if(!ancestors.has(key)) {
      ancestors.set(key,leaves.length);
      leaves.push({bounds:[ox+x*dx,oy+y*dy,ox+(x+1)*dx,oy+(y+1)*dy],id:model.idAt(i)});
    }
  }
  const rng = new JavaRandom((seed ^ 0x72586a37) >>> 0);
  return leaves.map(leaf=>({...leaf, selected:rng.nextDouble()<n(q,"retention")}));
}
export function panelLeaves(q: Params, seed: number) {
  validatePanel(q);
  const config={ columns: n(q,"columns"), rows: n(q,"rows"), attempts: n(q,"attempts"), axisPolicy: q.axis };
  let model=binaryCellPartition2D({seed:seed >>> 0,...config});
  const bias=n(q,"cutBias");
  if (bias!==0 && n(q,"attempts")>0) {
    // The core fixes unbiased cut ratios. A bounded seeded choice between whole,
    // valid partitions biases the distribution of resulting areas without rewriting cuts.
    const balance=(candidate: typeof model) => {
      let sum=0; for(let i=0;i<candidate.size;i++) {
        const b=candidate.boundsAt(i), fraction=(b[2]-b[0])*(b[3]-b[1])/(n(q,"columns")*n(q,"rows"));
        sum+=fraction*fraction;
      }
      return sum;
    };
    let best=balance(model);
    for(let i=1;i<=Math.ceil(4*Math.abs(bias));i++) {
      const candidate=binaryCellPartition2D({seed:(seed ^ Math.imul(i,0x59ac37d1)) >>> 0,...config});
      const score=balance(candidate);
      if(bias>0 ? score>best : score<best) {model=candidate;best=score;}
    }
  }
  const rng = new JavaRandom((seed ^ 0x72586a37) >>> 0);
  const ox=n(q,"centerX")-n(q,"width")/2, oy=n(q,"centerY")-n(q,"height")/2;
  return Array.from({ length: model.size }, (_, i) => { const b=model.boundsAt(i);
    return { bounds: [ox+b[0]*n(q,"width")/n(q,"columns"),oy+b[1]*n(q,"height")/n(q,"rows"),
      ox+b[2]*n(q,"width")/n(q,"columns"),oy+b[3]*n(q,"height")/n(q,"rows")] as [number,number,number,number],
      selected: rng.nextDouble() < n(q,"retention") }; });
}
export function sourcePolygons(q: Params, seed: number, irregularity = 0): Polygon[] {
  const rng = new JavaRandom((seed ^ 0x192eeb19) >>> 0), result: Polygon[]=[];
  for (let g=0;g<n(q,"groups");g++) {
    const theta=rng.nextDouble()*Math.PI*2, radius=g===0?0:Math.sqrt(rng.nextDouble())*n(q,"groupSpread");
    const cx=n(q,"centerX")+Math.cos(theta)*radius, cy=n(q,"centerY")+Math.sin(theta)*radius;
    const phase=n(q,"orientation")*Math.PI/180;
    const poly: Polygon=[];
    for (let i=0;i<n(q,"sides");i++) {
      const a=phase+i*2*Math.PI/n(q,"sides"), variation=1+irregularity*(rng.nextDouble()*2-1);
      poly.push([cx+variation*n(q,"width")/2*Math.cos(a),cy+variation*n(q,"height")/2*Math.sin(a)]);
    }
    // The accepted convex-polygon operation rejects repeated/collinear/concave sites.
    orderedConvexPolygonFilter2D({polygons:[poly]});
    result.push(poly);
  }
  return result;
}
function signedArea(poly: Polygon): number {
  let area=0; for (let i=0;i<poly.length;i++) { const a=poly[i],b=poly[(i+1)%poly.length]; area+=a[0]*b[1]-a[1]*b[0]; } return area/2;
}
function within(poly: Polygon, p: Point): boolean {
  const sign=Math.sign(signedArea(poly));
  for (let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length];
    if (sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])) < 0) return false;
  }
  return true;
}
function fan(poly: Polygon) { const triangles: [Point,Point,Point][]=[];
  for(let i=1;i<poly.length-1;i++) triangles.push([poly[0],poly[i],poly[i+1]]); return triangles; }
function area(t: [Point,Point,Point]) {
  return Math.abs((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]))/2;
}
function sample(poly: Polygon, count: number, random: JavaRandom, distribution: string): Point[] {
  const triangles=fan(poly), weights=triangles.map(area), total=weights.reduce((a,b)=>a+b,0);
  const pairs: [number,number][][]=triangles.map(()=>[]), order: [number,number][]=[];
  for (let i=0;i<count;i++) {
    let choice=random.nextDouble()*total, t=0;
    while (t<triangles.length-1 && choice>=weights[t]) choice-=weights[t++];
    let u=random.nextDouble(),v=random.nextDouble();
    if (distribution==="vertex") { const target=Math.floor(random.nextDouble()*3);
      if (target===0) u=u*u*u*u; else { u=1-Math.pow(1-u,4); v=target===1 ? .15*v : 1-.15*v; }
    } else if (distribution==="edge") { const edge=Math.floor(random.nextDouble()*3);
      if (edge===0) u=1; else if (edge===1) v=0; else v=1;
    }
    order.push([t,pairs[t].length]); pairs[t].push([u,v]);
  }
  const mapped=pairs.map((unitCoordinates,t) => mapTriangleCoordinates2D({triangle:triangles[t],unitCoordinates}));
  return order.map(([t,index]) => mapped[t].pointAt(index) as Point);
}
export function polygonPlacements(q: Params, seed: number): PolygonPlacementView {
  validatePolygon(q);
  const domain=sourcePolygons({ ...q,groups:1,groupSpread:0 },seed,n(q,"irregularity"))[0];
  const rng=new JavaRandom((seed ^ 0x76fa012a) >>> 0), marks: Polygon[]=[];
  // Candidate sites and geometry share only the source stream, never appearance settings.
  const sites=sample(domain,n(q,"proposals"),new JavaRandom((seed ^ 0x31072a9b) >>> 0),"uniform");
  for (const [x,y] of sites) {
    const picked=rng.nextDouble()<n(q,"retention"), length=n(q,"size")*(1+n(q,"sizeDisorder")*(rng.nextDouble()*2-1));
    const a=(n(q,"rotation")+(rng.nextDouble()*2-1)*n(q,"rotationSpread"))*Math.PI/180;
    if (!picked) continue;
    const sides=q.shape==="diamond"?4:12, vertices: Polygon=[];
    for(let j=0;j<sides;j++) {
      const theta=j*2*Math.PI/sides+(sides===4?Math.PI/4:0);
      const u=length*Math.cos(theta),v=length*n(q,"ratio")*Math.sin(theta);
      vertices.push([x+u*Math.cos(a)-v*Math.sin(a),y+u*Math.sin(a)+v*Math.cos(a)]);
    }
    if (vertices.every(pt=>within(domain,pt))) marks.push(vertices);
  }
  return orderedConvexPolygonFilter2D({ polygons:marks });
}
export function facetGroups(q: Params, seed: number): FacetGroup[] {
  validateFacet(q);
  const polygons=sourcePolygons(q,seed);
  let sampledGrain = 0;
  return polygons.map((poly,g) => {
    const rng=new JavaRandom((seed ^ Math.imul(g+1,0x51f283a7)) >>> 0);
    const uniform=sample(poly,n(q,"sites"),rng,"uniform");
    const local=sample(poly,1,rng,"uniform")[0], fraction=n(q,"cluster");
    const center: Point=[poly.reduce((sum,p)=>sum+p[0],0)/poly.length,poly.reduce((sum,p)=>sum+p[1],0)/poly.length];
    const phase=rng.nextDouble()*Math.PI*2;
    const sites: Point[]=uniform.map((pt,i) => {
      const chosen=q.distribution==="cluster" ? [local[0]+(pt[0]-local[0])*fraction,local[1]+(pt[1]-local[1])*fraction] as Point : pt;
      if (n(q,"jitter")===1) return chosen;
      // Ordered area-preserving-ish radial sequence mixes toward seeded samples.
      const angle=phase+i*2.399963229728653, radius=Math.sqrt((i+.5)/n(q,"sites"))*.19;
      const regular: Point=[center[0]+Math.cos(angle)*n(q,"width")*radius,
        center[1]+Math.sin(angle)*n(q,"height")*radius];
      // The inscribed ellipse fits even a triangular source, regardless of rotation.
      if (!within(poly,regular)) throw new Error("Facet lattice escaped the convex source");
      const anchor=regular;
      return [anchor[0]*(1-n(q,"jitter"))+chosen[0]*n(q,"jitter"),
        anchor[1]*(1-n(q,"jitter"))+chosen[1]*n(q,"jitter")] as Point;
    });
    const mesh=delaunay2D({points:sites,maxWork:2_000_000});
    const retain=new JavaRandom((seed ^ Math.imul(g+1,0x139fd42b)) >>> 0);
    const selected = Array.from({length:mesh.faceCount},()=>retain.nextDouble()<n(q,"selectedFraction"));
    const a: Point = [0,0], b: Point = [0,0], c: Point = [0,0];
    const grainCounts = q.mode === "grain" ? selected.map((kept, index) => {
      if (!kept) return 0;
      const tri = mesh.triangleAt(index);
      mesh.pointInto(tri[0],a); mesh.pointInto(tri[1],b); mesh.pointInto(tri[2],c);
      const count = Math.floor(area([a,b,c])*n(q,"grain"));
      sampledGrain += count;
      if (sampledGrain > 25000) throw new Error("Facet grain exceeds the 25,000 point budget");
      return count;
    }) : [];
    return {sites,mesh,selected,grainCounts};
  });
}
export function grainSamples(q: Params, seed: number): Point[][] {
  validateGrain(q);
  const sources = sourcePolygons(q,seed).map(poly => {
    const mesh=triangulateSimplePolygon2D({ points:poly,maxWork:poly.length**3+poly.length**2 });
    const triangles=mesh.triangles.map(index=>index.map(k=>mesh.points[k]) as [Point,Point,Point]);
    const weights=triangles.map(area), total=weights.reduce((sum,value)=>sum+value,0);
    return {triangles,weights,total,count:Math.floor(total*n(q,"density"))};
  });
  if (sources.reduce((sum,source)=>sum+source.count,0)>25000)
    throw new Error("Grain exceeds the 25,000 point budget");
  return sources.map(({triangles,weights,total,count},g)=> {
    const rng=new JavaRandom((seed ^ Math.imul(g+1,0x6f316acc)) >>> 0), pairs: [number,number][][]=triangles.map(()=>[]),order:[number,number][]=[];
    for(let i=0;i<count;i++) {
      let weighted=rng.nextDouble()*total,t=0;
      while(t<triangles.length-1 && weighted>=weights[t]) weighted-=weights[t++];
      let u=rng.nextDouble(),v=rng.nextDouble();
      if(q.distribution==="edge") {const edge=Math.floor(rng.nextDouble()*3);if(edge===0)u=1;else if(edge===1)v=0;else v=1;}
      else if(q.distribution==="vertex") { const vertex=Math.floor(rng.nextDouble()*3);if(vertex===0)u=u**4;
        else {u=1-(1-u)**4;v=vertex===1?.15*v:1-.15*v;} }
      order.push([t,pairs[t].length]);pairs[t].push([u,v]);
    }
    const mapped=pairs.map((unitCoordinates,t)=>mapTriangleCoordinates2D({triangle:triangles[t],unitCoordinates}));
    return order.map(([t,index])=>mapped[t].pointAt(index) as Point);
  });
}
function drawRegion(p: Canvas,layer: Layer) {
  const q=layer.params, leaves=regionLeaves(q,layer.seed), m=n(q,"markCount");
  p.strokeWeight(n(q,"weight"));
  for(const [i,leaf] of leaves.entries()) {
    if(!leaf.selected) continue;
    const [left,top,right,bottom]=leaf.bounds, inset=n(q,"inset"),w=right-left-2*inset,h=bottom-top-2*inset;
    if(w<=0||h<=0) continue;
    if(q.fillLeaves)color(p,layer,leaf.id,125,false);else p.noFill();
    if(q.outline)color(p,layer,leaf.id,210,true);else p.noStroke();
    if(q.fillLeaves||q.outline)p.rect(left+inset,top+inset,w,h);
    const span=Math.min(w,h), diameter=Math.min(span*n(q,"markScale")/(q.mark==="grid"||m>1?m:1),span);
    if(q.mark==="none")continue;
    if(q.mark==="line") { p.noFill();color(p,layer,i+1,225,true);
      for(let j=0;j<m;j++) {const y=top+inset+h*(j+.5)/m;p.line(left+inset+w/2-diameter/2,y,left+inset+w/2+diameter/2,y);} }
    else { p.noStroke();color(p,layer,i+1,225,false);
      const cols=q.mark==="grid"?m:1,rows=q.mark==="grid"||q.mark==="dot"?m:1;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)p.circle(left+inset+w*(x+.5)/cols,top+inset+h*(y+.5)/rows,diameter);
    }
  }
}
function drawPanel(p: Canvas,layer: Layer) {
  const q=layer.params;p.strokeWeight(n(q,"weight"));
  const regions=panelLeaves(q,layer.seed).flatMap((leaf,i)=>leaf.selected
    ? [{id:`region:${i}`,seed:layer.seed,bounds:leaf.bounds,index:i}] : []);
  inside(p,regions,(canvas,region)=>{
    const i=region.index,[left,top,right,bottom]=region.bounds;
    const z=n(q,"inset")+n(q,"gap")/2,w=right-left-2*z,h=bottom-top-2*z;
    if(w<=0||h<=0)return;
    if(q.fillPanels)color(canvas,layer,i,140,false);else canvas.noFill();
    if(q.outline)color(canvas,layer,i,220,true);else canvas.noStroke();
    if(q.fillPanels||q.outline)canvas.rect(z,z,w,h);
    canvas.noFill();color(canvas,layer,i+1,180,true);
    for(let j=1;j<=n(q,"nestedLines");j++) {
      const inset=Math.min(w,h)*j/(2*(n(q,"nestedLines")+1));
      canvas.rect(z+inset,z+inset,w-2*inset,h-2*inset);
    }
  });
}
function drawPolygon(p: Canvas,layer: Layer) {
  const q=layer.params, model=polygonPlacements(q,layer.seed);p.strokeWeight(n(q,"weight"));
  for(let i=0;i<model.size;i++) {
    if(q.fillMarks)color(p,layer,i,150,false);else p.noFill();
    if(q.outline)color(p,layer,i,220,true);else p.noStroke();
    const vertices: Polygon=[];for(let j=0;j<model.vertexCountAt(i);j++)vertices.push([model.xAt(i,j),model.yAt(i,j)]);
    if(q.fillMarks||q.outline)polygon(p,vertices);
  }
}
function drawFacet(p: Canvas,layer: Layer) {
  const q=layer.params;p.strokeWeight(n(q,"weight"));
  facetGroups(q,layer.seed).forEach(({mesh,selected,grainCounts},g)=>{
    const a=[0,0],b=[0,0],c=[0,0];
    for(let i=0;i<mesh.faceCount;i++) {
      if(!selected[i])continue;
      const tri=mesh.triangleAt(i);mesh.pointInto(tri[0],a);mesh.pointInto(tri[1],b);mesh.pointInto(tri[2],c);
      if(q.mode==="grain") {
        const count=grainCounts[i];
        const pts=seededTrianglePoints2D({seed:(layer.seed ^ Math.imul(g+1,0x746ae71f) ^ Math.imul(i+1,0x3d7125af)) >>> 0,
          count,triangle:[a,b,c]});
        p.noStroke();color(p,layer,i+g,210,false);
        for(let j=0;j<count;j++){const pt=pts.pointAt(j);p.circle(pt[0],pt[1],1.5);}
      }else {
        if(q.mode==="fill"){p.noStroke();color(p,layer,i+g,n(q,"opacity"),false);}
        else{p.noFill();color(p,layer,i+g,225,true);}
        p.triangle(a[0],a[1],b[0],b[1],c[0],c[1]);
      }
    }
  });
}
function drawGrain(p: Canvas,layer: Layer) {
  const q=layer.params, visual=new JavaRandom((layer.seed ^ 0x73245fba) >>> 0);p.strokeWeight(n(q,"weight"));
  grainSamples(q,layer.seed).forEach((pts,g)=>pts.forEach((pt,i)=>{
    const size=n(q,"size")*(1+n(q,"sizeVariation")*(visual.nextDouble()*2-1));
    const a=(n(q,"angle")+(visual.nextDouble()*2-1)*n(q,"angleSpread"))*Math.PI/180;
    if(q.strokes){p.noFill();color(p,layer,i+g,200,true);
      p.line(pt[0]-size*Math.cos(a),pt[1]-size*Math.sin(a),pt[0]+size*Math.cos(a),pt[1]+size*Math.sin(a));}
    else{p.noStroke();color(p,layer,i+g,210,false);p.circle(pt[0],pt[1],size);}
  }));
}
export function drawRegionFacetInstrument(p: Canvas,layer: Layer): void {
  p.push();try {
    switch(layer.technique) {
      case "region-marks":drawRegion(p,layer);break;
      case "panel-marks":drawPanel(p,layer);break;
      case "polygon-marks":drawPolygon(p,layer);break;
      case "facet-marks":drawFacet(p,layer);break;
      case "grain-marks":drawGrain(p,layer);break;
      default:throw new Error(`Unknown region/facet instrument: ${layer.technique}`);
    }
  }finally{p.pop();}
}
