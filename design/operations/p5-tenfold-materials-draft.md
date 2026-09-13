# p5 tenfold materials: root-review contract proposals

Draft only, revised 2026-09-13. No admission, catalog entry, implementation, or support claim. Inputs are
plain JSON objects with exactly their named fields; nested arrays have exact stated lengths; numbers are
finite binary64 and not booleans. No defaults or recommended ranges. Outputs are detached, signed zero is
+0, calls are atomic, and all supplied data is validated before work/output allocation. maxWork is a
nonnegative safe integer. Error.code is INVALID_INPUT, WORK_LIMIT for unsafe/excess stated work,
NUMERIC_OVERFLOW for any nonfinite computed intermediate, or INVALID_TOPOLOGY for stated mesh failure.
Grids are row-major y*columns+x. Budgets do not promise host allocation or latency. Every grid,
kernel, and structuring-element dimension is a positive safe integer with product <=4294967295.

## raster.floyd-steinberg-dither

Artist task: convert continuous monochrome fields to directional print texture, removing scan-order error
diffusion; ordered screening has no propagated residue. Input {values,columns,rows,threshold,maxWork}:
values length=columns*rows, values/threshold in [0,1]. Output {bits}, one 0/1 per source. Copy values,
scan rows then columns, emit current>=threshold, error=current-emitted; diffuse in-bounds
right/down-left/down/down-right by 7/16,3/16,5/16,1/16. No clamp. Work=cells plus one per actual neighbor
write, charged before writes. Fixtures: 1x1 [.5] at .5 -> [1]; 2x2 all .4 -> [0,1,0,1].
Studies: etched radial moon; contour-fog ink.

## raster.bayer-dither

Input {values,columns,rows,order,maxWork}; values in [0,1], order integer 1..26, S=2^order and
S*S must be safe. Output {bits}. Compute B(y,x) without allocating S*S:
sum j=0..order-1 of 4^(order-1-j)*Q[(y>>j)&1,(x>>j)&1], Q=[[0,2],[3,1]]. At x,y,
threshold=(B(y mod S,x mod S)+.5)/(S*S), emit value>=threshold. Work=cells*order, precharged.
Fixtures: order1, columns2/rows2, [.125,.375,.625,.875] -> [1,0,0,1]; order1, columns2/rows1,
[.125,.125] -> [1,0]; order2, columns4/rows4, all .5 -> [1,0,1,0,0,1,0,1,1,0,1,0,0,1,1,1],
using rows [0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]. Studies: screen-printed Voronoi; patterned noise band.

## raster.convolve-2d-signed

Input {values,columns,rows,kernel,kernelColumns,kernelRows,boundary,maxWork}; exact grid/kernel
products, odd positive kernel dimensions, boundary zero|clamp. Output {values}. This is convolution,
not correlation: for output x,y, sequentially sum K[ky*kC+kx]*sample(x+cx-kx,y+cy-ky), with
cx=floor(kC/2), cy=floor(kR/2); zero is 0 off-grid and clamp clamps coordinates. No normalization/clamp.
Work=cells*kernelCells before allocation. Fixtures: [2]*[3]=[6]; 3x1 [1,2,4] convolved with [1,2,4]
under zero -> [4,12,16], distinguishing reversed convolution from correlation. Studies: embossed dots;
ink-spread screen.

## color.oklab-ramp

Input {stops,count,maxWork}, >=2 encoded sRGB triples in [0,1], count>=2. Output {colors}, encoded
sRGB triples. Decode each component c by c/12.92 if c<=.04045, otherwise ((c+.055)/1.055)^2.4. At
u=k/(count-1), select span min(floor(u*(N-1)),N-2), t=u*(N-1)-span, convert stops to Oklab, lerp L,a,b,
inverse convert, clamp each reconstructed linear RGB component independently to [0,1], then encode linear
c by 12.92c if c<=.0031308, otherwise 1.055*c^(1/2.4)-.055. Output k=0 and k=count-1 are copied exact
input endpoint triples. Forward LMS rows:
(.4122214708,.5363325363,.0514459929),(.2119034982,.6806995451,.1073969566),
(.0883024619,.2817188376,.6299787005), cube roots, then
(.2104542553,.7936177850,-.0040720468),(1.9779984951,-2.4285922050,.4505937099),
(.0259040371,.7827717662,-.8086757660). Inverse uses
l'=L+.3963377774a+.2158037573b, m'=L-.1055613458a-.0638541728b,
s'=L-.0894841775a-1.2914855480b; cube; then
(4.0767416621,-3.3077115913,.2309699292),(-1.2684380046,2.6097574011,-.3413193965),
(-.0041960863,-.7034186147,1.7076147010). Work=stops+count. Fixtures: exact black/white endpoint
copies; red-to-blue count3 has an approximate specified interior tolerance per channel 1e-9.
Studies: terrain ramp; ribbon palette. Primary: https://bottosson.github.io/posts/oklab/

## color.median-cut-quantize

Input {colors,count,maxWork}; colors is nonempty RGB triples in [0,1], count>=1. Output
{palette,indices}. Begin box 0 containing source indices. A splittable box has >=2 members and nonzero
range in any channel. Choose box with greatest maximum channel range, tie lower current box index; choose
lowest tied channel. Stable-sort members by chosen channel then source index; replace selected box in place
by its lower half and append upper half (both creation order fixed). Stop when no splittable box or
min(count,colorCount) boxes. Palette is sequential source-order mean of each box. Each source chooses
nearest squared-RGB palette, tie lower index. Conservative work=colorCount*colorCount*count+
colorCount*count+colorCount, precharged. Fixtures: black/white,count2 -> black,white/[0,1];
three identical colors,count3 -> one identical palette and [0,0,0]. Studies: extract/dither field;
photo-grid mosaic.

## field.euclidean-distance-transform-2d

Input {mask,columns,rows,maxWork}, boolean mask. Output {distances,nearestIndices}; with no true
feature, distances and nearestIndices are arrays of null. Use the exact separable squared Euclidean transform:
first, for every row compute lower envelope of parabolas (x-q)^2 for feature columns q, retaining lower q
on equal intersections; a row with no feature remains null rather than storing Infinity. Then for every
column compute the lower envelope of y parabolas for non-null row-pass entries, retaining lower source row
on equal intersections; an empty column remains null. Track the feature index through both passes; output
sqrt(squared) and source row*columns+sourceColumn. Intersections use
((f[q]+q*q)-(f[v]+v*v))/(2*(q-v)) with binary64 separate operations; reject nonfinite intermediates.
Work=6*cells precharged; the two envelope passes are O(cells). Fixtures: 3x1 [F,T,F] -> [1,0,1]/[1,1,1];
2x2 no feature -> [null,null,null,null] for both fields. Studies: halos; distance contour ramp.

## raster.binary-morphology-2d

Input {mask,columns,rows,element,elementColumns,elementRows,mode,boundary,maxWork}; boolean arrays,
nonempty odd element, mode dilate|erode, boundary zero|one. Output {mask}. Let offset=(ex-cx,ey-cy).
Dilation samples mask(x-offset.x,y-offset.y), reflecting the structuring element; erosion samples
mask(x+offset.x,y+offset.y). Inspect true element entries in row-major order, OR for dilation and AND for
erosion; off-grid is boundary bit. No iteration field: callers compose calls. Work=cells*trueElementCount.
Fixtures: asymmetric elementColumns=3,elementRows=1, element [T,F,F], center seed dilates one pixel left and erodes using the opposite
offset; full 3x3 eroded under zero loses border. Studies: inflate ink; erode Bayer grain.

## mesh.extrude-simple-polygon-3d

Input {polygon,height,maxWork}; simple ring >=3, finite height>0. Output {positions,indices}. Compose
forthcoming triangulate-simple-polygon-2d only: it returns unchanged source points and positive (CCW) cap
triangles in original IDs; this operation contains no ear algorithm. Bottom positions source [x,y,0], top
[x,y,height]. Face order is all bottom caps [c,b,a], all top caps [a+N,b+N,c+N], then walls by ascending
original edge index. Determine signed area; use source edge [a,b] if CCW or [b,a] if CW, then emit
[a,b,b+N],[a,b+N,a+N]. Thus negative-winding input remains valid while source edge ordering remains fixed.
Triangulator preflight is N^3+N^2; total work is that declared dependency charge +2N+6T+6N, precharged.
Exact fixture: CCW triangle [[0,0],[1,0],[0,1]], h=2, cap [0,1,2], positions
[[0,0,0],[1,0,0],[0,1,0],[0,0,2],[1,0,2],[0,1,2]], faces
[[2,1,0],[3,4,5],[0,1,4],[0,4,3],[1,2,5],[1,5,4],[2,0,3],[2,3,5]]. CW square h1 produces same outward wall normals as CCW. Studies: extruded Voronoi
glass; logo plaque.

## mesh.parallel-transport-ribbon-3d

Input {points,widths,initialNormal,maxWork}; >=2 3D points, widths length equal, finite nonnegative full
widths, finite normal. Output {positions,indices}. Reject zero adjacent segment, exact reversal (unit
tangent dot exactly -1), and initial normal parallel to first tangent. Endpoint tangent is adjacent unit
segment; interior tangent normalizes adjacent unit sum. Orthogonalize initial normal. Transport with minimal
Rodrigues rotation, axis=normalized cross, sin=|cross|, cos=dot; same-direction copies. After every
transport, reorthogonalize normal against current tangent and normalize; failure is NUMERIC_OVERFLOW.
Positions are point +/- (width/2)*normal; faces [L,R,Rnext],[L,Rnext,Lnext]. Closed seam is excluded.
Work=24N+6(N-1). Fixtures: x-axis, width2 -> y +/-1; right angle is finite/orthogonal.
Studies: flight ribbons; folded contour paper.

## mesh.loop-subdivide-triangles-3d

Input {positions,indices,levels,maxWork}; indexed triangles, levels 0..30. Output {positions,indices}.
Allow manifold boundaries. Reject duplicate faces, repeated face vertex, isolated vertex, any edge used
>2 times, inconsistent shared direction, disconnected vertex link/bowtie. Sort undirected edges
lexicographically (minID,maxID) for new-vertex order; sum neighbors in ascending old ID. Interior edge
point=.375(A+B)+.125(C+D); boundary edge midpoint=(A+B)/2. Interior old valence n vertex is
(1-nbeta)V+beta*sum(neighbors), beta=3/16 for n=3 else
(1/n)*(5/8-(3/8+1/4*cos(2pi/n))^2). Boundary old vertex with exactly two boundary neighbors is
.75V+.125(N0+N1). Each source [a,b,c] emits [a,eab,eca],[b,ebc,eab],[c,eca,ebc],[eab,ebc,eca].
Topology validation is required even at level0. Before generation reserve every level's V+3F validation
plus V+E+4F arithmetic/output, using E<=3F and Vnext=V+3F,Fnext=4F only for safe total-growth preflight;
overflow/excess is WORK_LIMIT. Charge actual validation and V+E+4F per pass. Fixtures: tetra with origin and unit axes, level1 V=10,F=16 and
old origin=(3/16,3/16,3/16); exact single triangle boundary level1 has old positions
[.125,.125,0],[.75,.125,0],[.125,.75,0], edge midpoints [.5,0,0],[0,.5,0],[.5,.5,0] at IDs 3,4,5
(lexicographic edges 01,02,12), and faces [0,3,4],[1,5,3],[2,4,5],[3,5,4]. Studies: soften extruded
silhouette; smooth faceted terrain. Primary:
https://www.microsoft.com/en-us/research/publication/smooth-subdivision-surfaces-based-on-triangles/

## Scope limits

No source reproduction, renderer, target support, native study acceptance, gamut-mapping claim, EDT
approximation, ribbon seam closure, Loop creases, or non-manifold repair is proposed here.
