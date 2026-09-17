"""Exact, root-reviewed entrypoint compatibility; never rewrites historical evidence."""
import hashlib
import json

REVIEW = 'evidence/conformance/placement-export-compatibility-review.json'
SUCCESSOR = 'evidence/conformance/quadrant-export-compatibility-review.json'
TRIANGLE = 'evidence/conformance/triangle-export-compatibility-review.json'
BRANCH = 'evidence/conformance/branch-export-compatibility-review.json'
PROFILE = 'evidence/conformance/profile-export-compatibility-review.json'
CORRECTION = 'evidence/conformance/javascript-retained-output-export-successor.json'
HELPER = 'tools/reviewed_export_extension.py'
PATHS = frozenset(('packages/javascript/src/index.js', 'packages/python/procedurals/__init__.py'))
CORRECTED_SOURCES = frozenset(('packages/javascript/src/branch-tree.js', 'packages/javascript/src/triangle-points.js'))
SOURCE_COMPARISON = 'evidence/conformance/javascript-retained-output-source-comparison.json'
ROOT_CORRECTION = 'evidence/conformance/javascript-retained-output-root-review.json'
BASELINE_COMMIT = '4905c054bf6540bdade201f3e64e78423b24d53e'

_HELPER = """function writableArraySlot(array, index) {
  const key = String(index), own = Object.getOwnPropertyDescriptor(array, key);
  if (own !== undefined) return \"value\" in own && own.writable === true;
  if (!Object.isExtensible(array)) return false;
  for (let prototype = Object.getPrototypeOf(array); prototype !== null; prototype = Object.getPrototypeOf(prototype)) {
    const inherited = Object.getOwnPropertyDescriptor(prototype, key);
    if (inherited !== undefined) return \"value\" in inherited && inherited.writable === true;
  }
  return true;
}
"""
_OLD_BRANCH = """if (Array.isArray(out)) for (let n = 0; n < 4; n += 1) { const descriptor = Object.getOwnPropertyDescriptor(out, String(offset + n)); if (descriptor !== undefined && (!(\"value\" in descriptor) || descriptor.writable !== true) || descriptor === undefined && !Object.isExtensible(out)) fail(\"INVALID_OUTPUT\"); }"""
_NEW_BRANCH = """if (Array.isArray(out)) for (let n = 0; n < 4; n += 1) { if (!writableArraySlot(out, offset + n)) fail(\"INVALID_OUTPUT\"); }"""
_OLD_TRIANGLE = """if (Array.isArray(out)) for (let n = 0; n < 2; n += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(out, String(offset + n));
      if (descriptor !== undefined && (!(\"value\" in descriptor) || descriptor.writable !== true)) fail(\"INVALID_OUTPUT\");
      if (descriptor === undefined && !Object.isExtensible(out)) fail(\"INVALID_OUTPUT\");
    }"""
_NEW_TRIANGLE = """if (Array.isArray(out)) for (let n = 0; n < 2; n += 1) {
      if (!writableArraySlot(out, offset + n)) fail(\"INVALID_OUTPUT\");
    }"""


def _common_remainder(name, text, corrected):
    helper = _HELPER if corrected else ''
    if helper and text.count('\n' + helper) != 1:
        return ''
    value = text.replace('\n' + helper, '') if helper else text
    old, new = (_OLD_BRANCH, _NEW_BRANCH) if name.endswith('branch-tree.js') else (_OLD_TRIANGLE, _NEW_TRIANGLE)
    if text.count(new if corrected else old) != 1:
        return ''
    value = value.replace(new if corrected else old, 'PREFLIGHT')
    return value


def _digest(value):
    return hashlib.sha256(value).hexdigest()


def _read(root, name):
    path = (root / name).resolve()
    path.relative_to(root.resolve())
    return path.read_bytes()


def _accepted(review):
    return (review.get('status'), review.get('owner'), review.get('reviewer')) == ('accepted', 'root', 'root')


def _bindings(root, review, snapshots):
    for key in ('implementation_sha256', 'evidence_sha256'):
        values = review[key]
        if not isinstance(values, dict) or not values:
            return False
        for name, digest in values.items():
            data = snapshots[name] if name in snapshots else _read(root, name)
            if _digest(data) != digest:
                return False
    return True


def _validate_retained_output_correction(root, snapshots):
    """Validate the narrow source-isolation successor and expose its old bytes."""
    path = root / CORRECTION
    if not path.exists():
        return False
    correction = json.loads(_read(root, CORRECTION))
    root_review = json.loads(_read(root, ROOT_CORRECTION))
    comparison = json.loads(_read(root, SOURCE_COMPARISON))
    if not _accepted(correction) or not _accepted(root_review):
        return False
    if comparison.get('status') != 'passed' or comparison.get('baseline_commit') != BASELINE_COMMIT:
        return False
    if correction.get('previous_review_sha256') != _digest(_read(root, ROOT_CORRECTION)):
        return False
    if not _bindings(root, root_review, snapshots):
        return False
    if not isinstance(correction.get('implementation_sha256'), dict) or not isinstance(correction.get('evidence_sha256'), dict):
        return False
    if not (CORRECTED_SOURCES | {HELPER}).issubset(correction['implementation_sha256']):
        return False
    if not {ROOT_CORRECTION, SOURCE_COMPARISON}.issubset(correction['evidence_sha256']):
        return False
    if not _bindings(root, correction, snapshots):
        return False
    sources = comparison.get('sources')
    if not isinstance(sources, dict) or set(sources) != CORRECTED_SOURCES:
        return False
    prior = correction.get('previous_bytes')
    extensions = correction.get('extensions')
    if not isinstance(prior, dict) or not isinstance(extensions, dict):
        return False
    required = CORRECTED_SOURCES | {HELPER}
    if set(prior) != required or set(extensions) != required:
        return False
    for name in CORRECTED_SOURCES:
        entry = extensions.get(name)
        if not isinstance(entry, dict) or set(entry) != {'before', 'after'}:
            return False
        current = _read(root, name)
        if entry['after'].encode('utf-8') != current:
            return False
        if entry['before'] != prior[name] or _digest(entry['before'].encode('utf-8')) != sources[name].get('before_sha256'):
            return False
        if _digest(current) != sources[name].get('after_sha256') or not sources[name].get('unchanged_outside_helper_and_array_preflight'):
            return False
        current_remainder = _common_remainder(name, current.decode('utf-8'), True)
        prior_remainder = _common_remainder(name, entry['before'], False)
        if not current_remainder or not prior_remainder or current_remainder != prior_remainder:
            return False
    helper = extensions[HELPER]
    if not isinstance(helper, dict) or set(helper) != {'before', 'after'} or helper['before'] != prior[HELPER]:
        return False
    if helper['after'].encode('utf-8') != snapshots.get(HELPER, _read(root, HELPER)):
        return False
    # The helper's prior bytes are fixed by the pushed baseline; the correction
    # successor may only carry this exact historical snapshot forward.
    if _digest(helper['before'].encode('utf-8')) != 'bf839cf4448c5233ce4e185dfaf2136136c77e58a1349fc0c1263ebe95d5aa07':
        return False
    snapshots.update({name: text.encode('utf-8') for name, text in prior.items()})
    return True


JS_PORTS = 'evidence/conformance/javascript-core-export-compatibility-review.json'
JS_INDEX = 'packages/javascript/src/index.js'
JS_PORT_ADDITIONS = 'export { stopRamp, StopRampError } from "./stop-ramp.js";\nexport { bilinearRasterRemap2D, RasterRemapError } from "./raster-remap.js";\nexport { targetSprings2D, SpringError } from "./target-springs.js";\nexport { occupiedLatticePaths2D, LatticeError } from "./occupied-lattice-paths.js";\nexport { delaunay2D, DelaunayError } from "./delaunay.js";\nexport { closedSpline2D, SplineError } from "./closed-spline.js";\nexport { noiseBandPath2D, NoiseBandPathError } from "./noise-band-path.js";\nexport { seededLinePool2D, LinePoolError } from "./line-pool.js";\n'
JS_PORT_MODULES = ('packages/javascript/src/stop-ramp.js', 'packages/javascript/src/raster-remap.js', 'packages/javascript/src/target-springs.js', 'packages/javascript/src/occupied-lattice-paths.js', 'packages/javascript/src/delaunay.js', 'packages/javascript/src/closed-spline.js', 'packages/javascript/src/noise-band-path.js', 'packages/javascript/src/line-pool.js')
JS_PORT_REVIEWS = ('evidence/ports/stop-ramp-p5/root-review.json', 'evidence/ports/raster-remap-p5/root-review.json', 'evidence/ports/target-springs-p5/root-review.json', 'evidence/ports/occupied-lattice-p5/root-review.json', 'evidence/ports/delaunay-p5/root-review.json', 'evidence/ports/closed-spline-p5/root-review.json', 'evidence/ports/noise-band-path-p5/root-review.json', 'evidence/ports/line-pool-p5/root-review.json')



P5_BATCH = 'evidence/conformance/p5-batch-export-compatibility-review.json'
P5_BATCH_ADDITIONS = 'export { binaryCellPartition2D, PartitionError as BinaryPartitionError } from "./binary-cell-partition.js";\nexport { retainedRectangleCuts2D, RectangleCutError, RetainedRectangleCuts2D } from "./retained-rectangle-cuts.js";\nexport { rasterCrossfade2D, RasterCrossfadeError } from "./raster-crossfade.js";\nexport { maskedSourceOver2D, MaskedCompositeError } from "./masked-source-over.js";\nexport { gradientNoise3D01, GradientNoise3D01Error } from "./gradient-noise-3d-01.js";\nexport { orderedConvexPolygonFilter2D, PlacementError as ConvexPlacementError } from "./convex-polygon-placements.js";\nexport { clipSegmentsSimplePolygon2D, SegmentClipError } from "./segment-clip.js";\nexport { radialPull2D, PullError } from "./radial-pull.js";\nexport { sequentialDiscProjection2D, DiscProjectionError } from "./disc-projection.js";\nexport { annularSolid3D, MeshError as AnnularMeshError, FaceLimitError as AnnularFaceLimitError, MeshArithmeticError as AnnularMeshArithmeticError } from "./annular-mesh.js";\nexport { separableBlur2D, SeparableBlurError } from "./separable-blur.js";\nexport { nearestSegmentContact2D, ContactError } from "./nearest-segment-contact.js";\n'
P5_BATCH_MODULES = ('packages/javascript/src/binary-cell-partition.js', 'packages/javascript/src/retained-rectangle-cuts.js', 'packages/javascript/src/raster-crossfade.js', 'packages/javascript/src/masked-source-over.js', 'packages/javascript/src/gradient-noise-3d-01.js', 'packages/javascript/src/convex-polygon-placements.js', 'packages/javascript/src/segment-clip.js', 'packages/javascript/src/radial-pull.js', 'packages/javascript/src/disc-projection.js', 'packages/javascript/src/annular-mesh.js', 'packages/javascript/src/separable-blur.js', 'packages/javascript/src/nearest-segment-contact.js')


def _validate_p5_batch(root, snapshots):
    review = json.loads(_read(root, P5_BATCH))
    test = 'tests/test_reviewed_export_extension.py'
    required = {HELPER, JS_INDEX, test, *P5_BATCH_MODULES}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or JS_PORTS not in review['evidence_sha256']
            or review['previous_review_sha256'] != _digest(_read(root, JS_PORTS))):
        return False
    prior = review['previous_bytes']
    if set(prior) != {HELPER, JS_INDEX, test} or set(review['extensions']) != {JS_INDEX}:
        return False
    if _digest(prior[HELPER].encode()) != 'ba6f0089cbe43fe12cfec1567238ba7c99926a5dc0e27684ddc7e56abcd10500':
        return False
    older = json.loads(_read(root, JS_PORTS))
    if _digest(prior[test].encode()) != older['implementation_sha256'][test]:
        return False
    entry = review['extensions'][JS_INDEX]
    if (set(entry) != {'before', 'after'} or entry['before'] != prior[JS_INDEX]
            or prior[JS_INDEX] != older['extensions'][JS_INDEX]['after']
            or entry['after'] != prior[JS_INDEX] + P5_BATCH_ADDITIONS
            or entry['after'].encode() != snapshots.get(JS_INDEX, _read(root, JS_INDEX))):
        return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


def _validate_js_ports(root, snapshots):
    review = json.loads(_read(root, JS_PORTS))
    required = {HELPER, JS_INDEX, *JS_PORT_MODULES}
    evidence = {PROFILE, *JS_PORT_REVIEWS}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or not evidence.issubset(review['evidence_sha256'])
            or review['previous_review_sha256'] != _digest(_read(root, PROFILE))):
        return False
    prior = review['previous_bytes']
    if set(prior) != {HELPER, JS_INDEX} or set(review['extensions']) != {JS_INDEX}:
        return False
    if _digest(prior[HELPER].encode()) != '846b93477950f373062f0116b6e25939161225b821277c79df70492bafcbf179':
        return False
    profile = json.loads(_read(root, PROFILE))
    if prior[JS_INDEX] != profile['extensions'][JS_INDEX]['after']:
        return False
    entry = review['extensions'][JS_INDEX]
    if (set(entry) != {'before', 'after'} or entry['before'] != prior[JS_INDEX]
            or entry['after'] != prior[JS_INDEX] + JS_PORT_ADDITIONS
            or entry['after'].encode() != snapshots.get(JS_INDEX, _read(root, JS_INDEX))):
        return False
    for name in JS_PORT_REVIEWS:
        accepted = json.loads(_read(root, name))
        if not _accepted(accepted) or not _bindings(root, accepted, {}):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


P5_GALLERY = 'evidence/conformance/p5-gallery-export-compatibility-review.json'
P5_GALLERY_STEMS = ('voronoi-cells-2d', 'resample-polyline-2d', 'marching-squares-2d')
P5_GALLERY_ADDITIONS = ''.join(
    f'export {{ {name} }} from "./{stem}.js";\n'
    for name, stem in zip(('voronoiCells2D', 'resamplePolyline2D', 'marchingSquares2D'), P5_GALLERY_STEMS))


def _validate_p5_gallery(root, snapshots):
    review = json.loads(_read(root, P5_GALLERY))
    older = json.loads(_read(root, P5_BATCH))
    test = 'tests/test_reviewed_export_extension.py'
    required = {HELPER, JS_INDEX, test, *(f'packages/javascript/src/{stem}.js' for stem in P5_GALLERY_STEMS)}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or P5_BATCH not in review['evidence_sha256']
            or review['previous_review_sha256'] != _digest(_read(root, P5_BATCH))):
        return False
    prior = review['previous_bytes']
    if set(prior) != {HELPER, JS_INDEX, test} or set(review['extensions']) != {JS_INDEX}:
        return False
    if any(_digest(prior[name].encode()) != older['implementation_sha256'][name] for name in prior):
        return False
    entry = review['extensions'][JS_INDEX]
    if (set(entry) != {'before', 'after'} or entry['before'] != prior[JS_INDEX]
            or entry['after'] != prior[JS_INDEX] + P5_GALLERY_ADDITIONS
            or entry['after'].encode() != snapshots.get(JS_INDEX, _read(root, JS_INDEX))):
        return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


P5_TENFOLD = 'evidence/conformance/p5-tenfold-export-compatibility-review.json'
P5_TENFOLD_BINDINGS = (('adjacency-tile-collapse-2d', 'adjacencyTileCollapse2D'), ('assemble-segment-chains-2d', 'assembleSegmentChains2D'), ('bayer-dither', 'bayerDither'), ('binary-morphology-2d', 'binaryMorphology2D'), ('chaikin-polyline-2d', 'chaikinPolyline2D'), ('convex-hull-2d', 'convexHull2D'), ('convolve-2d-signed', 'convolve2DSigned'), ('cost-grid-paths-2d', 'costGridPaths2D'), ('damped-wave-step-2d', 'dampedWaveStep2D'), ('elementary-cellular-rows', 'elementaryCellularRows'), ('euclidean-distance-transform-2d', 'euclideanDistanceTransform2D'), ('extrude-simple-polygon-3d', 'extrudeSimplePolygon3D'), ('floyd-steinberg-dither', 'floydSteinbergDither'), ('gray-scott-step-2d', 'grayScottStep2D'), ('life-like-step-2d', 'lifeLikeStep2D'), ('lloyd-relaxation-2d', 'lloydRelaxation2D'), ('loop-subdivide-triangles-3d', 'loopSubdivideTriangles3D'), ('median-cut-quantize', 'medianCutQuantize'), ('offset-polyline-2d', 'offsetPolyline2D'), ('oklab-ramp', 'oklabRamp'), ('parallel-token-rewrite', 'parallelTokenRewrite'), ('parallel-transport-ribbon-3d', 'parallelTransportRibbon3D'), ('poisson-disc-2d', 'poissonDisc2D'), ('rk4-vector-grid-trace-2d', 'rk4VectorGridTrace2D'), ('scalar-grid-curl-2d', 'scalarGridCurl2D'), ('seeded-depth-first-spanning-tree', 'seededDepthFirstSpanningTree'), ('simplify-polyline-2d', 'simplifyPolyline2D'), ('skyline-pack-2d', 'skylinePack2D'), ('token-turtle-2d', 'tokenTurtle2D'), ('triangulate-simple-polygon-2d', 'triangulateSimplePolygon2D'))
P5_TENFOLD_ADDITIONS = ''.join(f'export {{ {name} }} from "./{stem}.js";\n' for stem, name in P5_TENFOLD_BINDINGS)


def _validate_p5_tenfold(root, snapshots):
    review = json.loads(_read(root, P5_TENFOLD))
    older = json.loads(_read(root, P5_GALLERY))
    test = 'tests/test_reviewed_export_extension.py'
    prior_names = {HELPER, JS_INDEX, test}
    required = prior_names | {f'packages/javascript/src/{stem}.js' for stem, _ in P5_TENFOLD_BINDINGS}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or P5_GALLERY not in review['evidence_sha256']
            or review['previous_review_sha256'] != _digest(_read(root, P5_GALLERY))):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != {JS_INDEX}:
        return False
    if any(_digest(prior[name].encode()) != older['implementation_sha256'][name] for name in prior):
        return False
    entry = review['extensions'][JS_INDEX]
    if (set(entry) != {'before', 'after'} or entry['before'] != prior[JS_INDEX]
            or entry['after'] != prior[JS_INDEX] + P5_TENFOLD_ADDITIONS
            or entry['after'].encode() != snapshots.get(JS_INDEX, _read(root, JS_INDEX))):
        return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


BATCH1_SURFACE = 'evidence/conformance/survey-batch1-surface-compatibility-review.json'
BATCH1_GENERATOR = 'apps/web/scripts/generate-api.mjs'
BATCH1_GUIDES = 'apps/web/content/survey-coverage-api.mjs'
BATCH1_PRIOR_WEB = 'evidence/web/p5-tenfold/root-review.json'
BATCH1_BINDINGS = (('seeded-pixel-grain', 'seededPixelGrain', 'SeededPixelGrainError'),
                   ('field-displace-2d', 'fieldDisplace2D', 'FieldDisplace2DError'),
                   ('octave-gradient-noise', 'octaveGradientNoise', 'OctaveGradientNoiseError'))
BATCH1_ROOT_REVIEWS = tuple(
    f'evidence/coverage/batch1/{stem}/root-review.json' for stem, _, _ in BATCH1_BINDINGS)
BATCH1_ADDITIONS = ''.join(f'export {{ {name}, {error} }} from "./{stem}.js";\n' for stem, name, error in BATCH1_BINDINGS)


def batch1_generator_successor(before):
    """Only three named bindings and an isolated authored-guide fallback are admitted."""
    changes = (
        ('import { apiGuides } from "../content/api-guides.mjs";\n',
         'import { apiGuides } from "../content/api-guides.mjs";\nimport { surveyCoverageApiGuides } from "../content/survey-coverage-api.mjs";\n'),
        ('const bindings = {\n', 'const bindings = {\n' + ''.join(
            f'  "{stem}": ["{stem}", "{name}"],\n' for stem, name, _ in BATCH1_BINDINGS)),
        ('const guide = apiGuides[catalog.id];',
         'const guide = surveyCoverageApiGuides[catalog.id] ?? apiGuides[catalog.id];'),
    )
    result = before
    for old, new in changes:
        if result.count(old) != 1:
            return None
        result = result.replace(old, new)
    return result


def _validate_batch1_surface(root, snapshots):
    review = json.loads(_read(root, BATCH1_SURFACE))
    older = json.loads(_read(root, P5_TENFOLD))
    web = json.loads(_read(root, BATCH1_PRIOR_WEB))
    test = 'tests/test_reviewed_export_extension.py'
    prior_names = {HELPER, test, JS_INDEX, BATCH1_GENERATOR}
    required = prior_names | {BATCH1_GUIDES} | {f'packages/javascript/src/{stem}.js' for stem, _, _ in BATCH1_BINDINGS}
    evidence = {P5_TENFOLD, BATCH1_PRIOR_WEB, *BATCH1_ROOT_REVIEWS}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or not evidence.issubset(review['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, P5_TENFOLD))):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != {JS_INDEX, BATCH1_GENERATOR}:
        return False
    for name in prior:
        source = web if name == BATCH1_GENERATOR else older
        if _digest(prior[name].encode()) != source['implementation_sha256'][name]:
            return False
    expected = {JS_INDEX: prior[JS_INDEX] + BATCH1_ADDITIONS,
                BATCH1_GENERATOR: batch1_generator_successor(prior[BATCH1_GENERATOR])}
    for name in expected:
        entry = review['extensions'][name]
        if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                or entry['after'] != expected[name] or entry['after'].encode() != snapshots.get(name, _read(root, name))):
            return False
    for name in BATCH1_ROOT_REVIEWS:
        accepted = json.loads(_read(root, name))
        if not _accepted(accepted) or not _bindings(root, accepted, {}):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


EXPANSION_SURFACE = 'evidence/conformance/external-expansion-surface-review.json'
EXPANSION_GUIDES = 'apps/web/content/external-expansion-api.mjs'
EXPANSION_ROOT = 'evidence/expansion/first-batch/root-review.json'
EXPANSION_BINDINGS = (('radius-pairs-2d', 'radiusPairs2D', 'RadiusPairs2DError'),
                      ('pair-force-step-2d', 'pairForceStep2D', 'PairForceStep2DError'))
EXPANSION_ADDITIONS = '\nexport { defaultPalettes } from "./default-palettes.js";\n' + ''.join(
    f'export {{ {name}, {error} }} from "./{stem}.js";\n' for stem, name, error in EXPANSION_BINDINGS)


def expansion_generator_successor(before):
    """Exactly two expansion guides/bindings; existing guide meanings stay unchanged."""
    changes = (
        ('import { surveyCoverageApiGuides } from "../content/survey-coverage-api.mjs";\n',
         'import { surveyCoverageApiGuides } from "../content/survey-coverage-api.mjs";\nimport { externalExpansionApiGuides } from "../content/external-expansion-api.mjs";\n'),
        ('const bindings = {\n', 'const bindings = {\n' + ''.join(
            f'  "{stem}": ["{stem}", "{name}"],\n' for stem, name, _ in EXPANSION_BINDINGS)),
        ('const guide = surveyCoverageApiGuides[catalog.id] ?? apiGuides[catalog.id];',
         'const guide = externalExpansionApiGuides[catalog.id] ?? surveyCoverageApiGuides[catalog.id] ?? apiGuides[catalog.id];'),
    )
    result = before
    for old, new in changes:
        if result.count(old) != 1:
            return None
        result = result.replace(old, new)
    return result


def _validate_expansion_surface(root, snapshots):
    review = json.loads(_read(root, EXPANSION_SURFACE))
    older = json.loads(_read(root, BATCH1_SURFACE))
    accepted = json.loads(_read(root, EXPANSION_ROOT))
    prior_names = {HELPER, 'tests/test_reviewed_export_extension.py', JS_INDEX, BATCH1_GENERATOR}
    required = prior_names | {EXPANSION_GUIDES, 'packages/javascript/src/default-palettes.js'} | {
        f'packages/javascript/src/{stem}.js' for stem, _, _ in EXPANSION_BINDINGS}
    if (not _accepted(review) or not _bindings(root, review, snapshots)
            or not _accepted(accepted) or not _bindings(root, accepted, snapshots)
            or not required.issubset(accepted['implementation_sha256'])
            or not required.issubset(review['implementation_sha256'])
            or not {BATCH1_SURFACE, EXPANSION_ROOT}.issubset(review['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, BATCH1_SURFACE))):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != {JS_INDEX, BATCH1_GENERATOR}:
        return False
    for name in prior:
        if _digest(prior[name].encode()) != older['implementation_sha256'][name]:
            return False
    expected = {JS_INDEX: prior[JS_INDEX] + EXPANSION_ADDITIONS,
                BATCH1_GENERATOR: expansion_generator_successor(prior[BATCH1_GENERATOR])}
    for name in expected:
        entry = review['extensions'][name]
        if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                or entry['after'] != expected[name]
                or entry['after'].encode() != snapshots.get(name, _read(root, name))):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


WEB_GALLERY = 'evidence/conformance/external-expansion-gallery-compatibility-review.json'
WEB_GALLERY_ROOT = 'evidence/web/external-expansion-gallery-review.json'
WEB_GALLERY_PREVIOUS = 'evidence/web/p5-tenfold/root-review.json'
WEB_GALLERY_FILES = frozenset((
    'apps/web/lib/studio.ts', 'apps/web/lib/render-studio.ts', 'apps/web/lib/harness-render.ts',
    'apps/web/scripts/generate-gallery.mjs', 'apps/web/scripts/sketch-source.mjs', 'apps/web/tests/studio.test.ts',
))
WEB_GALLERY_DEPENDENCIES = frozenset((
    'apps/web/lib/adapters/external-expansion.ts',
    'apps/web/content/external-expansion-studies.mjs',
    'apps/web/content/agent-trails.md',
    'apps/web/content/contact-network.md',
    'apps/web/content/geometric-panel.md',
    'apps/web/content/orbital-brush.md',
    'apps/web/content/ornament-poster.md',
))


def web_gallery_successor(name, before):
    """Apply only the reviewed five-study registration and source extraction edits."""
    if name == 'apps/web/lib/studio.ts':
        changes = (
            ('import { expansionDefinitions } from "./adapters/expansion";\n',
             'import { expansionDefinitions } from "./adapters/expansion";\n'
             'import {\n  externalExpansionDefinitions,\n  externalExpansionPalette,\n'
             '} from "./adapters/external-expansion";\n'),
            ('  ...expansionDefinitions,\n',
             '  ...expansionDefinitions,\n  ...externalExpansionDefinitions,\n'),
            ('function paletteFor(id: string): number[] {\n',
             'function paletteFor(id: string): number[] {\n'
             '  const external = externalExpansionPalette(id);\n'
             '  if (external) return external;\n'),
        )
    elif name == 'apps/web/lib/render-studio.ts':
        changes = (
            ('import { drawExpansion, expansionDefinitions } from "./adapters/expansion";\n',
             'import { drawExpansion, expansionDefinitions } from "./adapters/expansion";\n'
             'import {\n  drawExternalExpansion,\n  externalExpansionDefinitions,\n'
             '} from "./adapters/external-expansion";\n'),
            ('const expansionIds = new Set(expansionDefinitions.map((definition) => definition.id));\n',
             'const expansionIds = new Set(expansionDefinitions.map((definition) => definition.id));\n'
             'const externalExpansionIds = new Set(\n'
             '  externalExpansionDefinitions.map((definition) => definition.id),\n);\n'),
            ('  if (expansionIds.has(layer.technique)) return drawExpansion(p, layer);\n',
             '  if (expansionIds.has(layer.technique)) return drawExpansion(p, layer);\n'
             '  if (externalExpansionIds.has(layer.technique)) return drawExternalExpansion(p, layer);\n'),
        )
    elif name == 'apps/web/lib/harness-render.ts':
        changes = (('import { drawExpansion, expansionDefinitions } from "./adapters/expansion";\n', 'import { drawExpansion, expansionDefinitions } from "./adapters/expansion";\nimport {\n  drawExternalExpansion,\n  externalExpansionDefinitions,\n} from "./adapters/external-expansion";\n'), ('const expansionIds = new Set(expansionDefinitions.map((item) => item.id));\n', 'const expansionIds = new Set(expansionDefinitions.map((item) => item.id));\nconst externalExpansionIds = new Set(externalExpansionDefinitions.map((item) => item.id));\n'), ('  if (expansionIds.has(workflow.technique)) return drawExpansion(p, workflow);\n', '  if (expansionIds.has(workflow.technique)) return drawExpansion(p, workflow);\n  if (externalExpansionIds.has(workflow.technique)) return drawExternalExpansion(p, workflow);\n'))
    elif name == 'apps/web/tests/studio.test.ts':
        changes = (('all 90 studio definitions', 'all 95 studio definitions'),
                   ('assert.equal(techniques.length, 90);', 'assert.equal(techniques.length, 95);'))
    elif name == 'apps/web/scripts/generate-gallery.mjs':
        changes = (
            ('import { tenfoldStudies } from "../content/tenfold-studies.mjs";\n',
             'import { tenfoldStudies } from "../content/tenfold-studies.mjs";\n'
             'import { externalExpansionStudies } from "../content/external-expansion-studies.mjs";\n'),
            ('definitions.push(...tenfoldStudies.map(study => [study.slug, study.category, study.operations]));\n',
             'definitions.push(...tenfoldStudies.map(study => [study.slug, study.category, study.operations]));\n'
             'definitions.push(...externalExpansionStudies.map(study => [study.slug, study.category, study.operations]));\n'),
            ('  "masked-partition-marks", "placement-image-marks", "pointer-marks", "relief-marks",\n]);\n',
             '  "masked-partition-marks", "placement-image-marks", "pointer-marks", "relief-marks",\n]);\n'
             '// Present package examples that are either private layout helpers or pending separate\n'
             '// review. Listing them here prevents a directory from becoming a gallery workflow merely\n'
             '// because it exists; accepted registrations above remain the source of gallery membership.\n'
             'const pendingExampleSlugs = new Set([\n'
             '  "motif-compositions",\n  "dye-currents",\n  "field-displacement",\n'
             '  "flocking-marks",\n  "lingering-links",\n  "octave-noise",\n'
             '  "pixel-grain",\n  "sensing-trails",\n  "guarded-bands",\n'
             '  "hatched-islands",\n  "bridge-web",\n  "neighborhood-growth",\n]);\n'),
            ('if (\n  dirs.length !== slugs.size + nativeOnlySlugs.size ||\n'
             '  dirs.some((d) => !slugs.has(d) && !nativeOnlySlugs.has(d)) ||\n'
             '  [...slugs, ...nativeOnlySlugs].some((slug) => !dirs.includes(slug))\n)',
             'const declaredExampleSlugs = new Set([\n'
             '  ...slugs,\n  ...nativeOnlySlugs,\n  ...pendingExampleSlugs,\n]);\n'
             'if (\n  dirs.some((directory) => !declaredExampleSlugs.has(directory)) ||\n'
             '  [...slugs, ...nativeOnlySlugs].some(\n'
             '    (slug) => !dirs.includes(slug),\n  )\n)'),
        )
    elif name == 'apps/web/scripts/sketch-source.mjs':
        changes = (
            ('  for (const group of ["basic", "geometry", "effects", "expansion", "paths", "systems", "materials"]) {',
             '  for (const [group, dispatchName] of [\n'
             '    ["basic", "basic"],\n    ["geometry", "geometry"],\n'
             '    ["effects", "effects"],\n    ["expansion", "expansion"],\n'
             '    ["external-expansion", "externalExpansion"],\n'
             '    ["paths", "paths"],\n    ["systems", "systems"],\n'
             '    ["materials", "materials"],\n  ]) {'),
            ('`draw${group[0].toUpperCase()}${group.slice(1)}`',
             '`draw${dispatchName[0].toUpperCase()}${dispatchName.slice(1)}`'),
        )
    else:
        return None
    result = before
    for old, new in changes:
        if result.count(old) != 1:
            return None
        result = result.replace(old, new)
    return result


def _validate_web_gallery(root, snapshots):
    review = json.loads(_read(root, WEB_GALLERY))
    older = json.loads(_read(root, EXPANSION_SURFACE))
    previous_web = json.loads(_read(root, WEB_GALLERY_PREVIOUS))
    web = json.loads(_read(root, WEB_GALLERY_ROOT))
    test = 'tests/test_reviewed_export_extension.py'
    prior_names = WEB_GALLERY_FILES | {HELPER, test}
    required = prior_names | WEB_GALLERY_DEPENDENCIES
    if (not _accepted(review) or not _accepted(web)
            or not _bindings(root, review, snapshots)
            or not _bindings(root, web, snapshots)
            or not required.issubset(review['implementation_sha256'])
            or not (WEB_GALLERY_FILES | WEB_GALLERY_DEPENDENCIES).issubset(web['implementation_sha256'])
            or not {EXPANSION_SURFACE, WEB_GALLERY_ROOT, WEB_GALLERY_PREVIOUS}.issubset(review['evidence_sha256'])
            or review.get('previous_review_sha256') != _digest(_read(root, EXPANSION_SURFACE))):
        return False
    prior = review['previous_bytes']
    if set(prior) != prior_names or set(review['extensions']) != WEB_GALLERY_FILES:
        return False
    for name in prior:
        source = previous_web if name in WEB_GALLERY_FILES else older
        if _digest(prior[name].encode()) != source['implementation_sha256'][name]:
            return False
    for name in WEB_GALLERY_FILES:
        entry = review['extensions'][name]
        if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                or entry['after'] != web_gallery_successor(name, prior[name])
                or entry['after'].encode() != snapshots.get(name, _read(root, name))):
            return False
    snapshots.update({name: value.encode() for name, value in prior.items()})
    return True


def historical_export_bytes(root, relative, expected):
    """Return only exact reviewed historical entrypoint bytes.

    A successor may retain the previous entrypoint and verifier bytes for validating
    the immutable placement review. The fixed retained-output correction additionally
    supplies two old source snapshots only to archival binding checks. Returned bytes
    are always entrypoints; runtime operation validation never uses these snapshots.
    """
    batch1_archival_paths = {JS_INDEX, BATCH1_GENERATOR, HELPER, 'tests/test_reviewed_export_extension.py'}
    archival_paths = batch1_archival_paths | WEB_GALLERY_FILES
    if relative not in PATHS and relative not in archival_paths:
        return None
    try:
        snapshots = {}
        successor_match = None
        if (root / WEB_GALLERY).exists():
            if not _validate_web_gallery(root, snapshots):
                return None
            if relative in snapshots and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / EXPANSION_SURFACE).exists():
            if not _validate_expansion_surface(root, snapshots):
                return None
            if relative in batch1_archival_paths and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / BATCH1_SURFACE).exists():
            if not _validate_batch1_surface(root, snapshots):
                return None
            if relative in batch1_archival_paths and _digest(snapshots[relative]) == expected:
                successor_match = snapshots[relative]
        if (root / P5_TENFOLD).exists():
            if not _validate_p5_tenfold(root, snapshots):
                return None
            if relative == JS_INDEX and _digest(snapshots[JS_INDEX]) == expected:
                successor_match = snapshots[JS_INDEX]
        if (root / P5_GALLERY).exists():
            if not _validate_p5_gallery(root, snapshots):
                return None
            if relative == JS_INDEX and _digest(snapshots[JS_INDEX]) == expected:
                successor_match = snapshots[JS_INDEX]
        if (root / P5_BATCH).exists():
            if not _validate_p5_batch(root, snapshots):
                return None
            if relative == JS_INDEX and _digest(snapshots[JS_INDEX]) == expected:
                successor_match = snapshots[JS_INDEX]
        if (root / JS_PORTS).exists():
            if not _validate_js_ports(root, snapshots):
                return None
            if relative == JS_INDEX and _digest(snapshots[JS_INDEX]) == expected:
                successor_match = snapshots[JS_INDEX]
        if (root / PROFILE).exists():
            profile = json.loads(_read(root, PROFILE))
            required = {HELPER, *PATHS, 'packages/javascript/src/radial-profile.js',
                        'packages/python/procedurals/radial_profile.py'}
            evidence = {CORRECTION, 'evidence/conformance/radial-profile-javascript-root-review.json',
                        'evidence/conformance/radial-profile-python-root-review.json',
                        'evidence/conformance/profile-p5js-native-root-review.json',
                        'evidence/conformance/profile-py5-native-root-review.json'}
            if (not _accepted(profile) or not _bindings(root, profile, snapshots)
                    or not required.issubset(profile['implementation_sha256'])
                    or not evidence.issubset(profile['evidence_sha256'])
                    or profile['previous_review_sha256'] != _digest(_read(root, CORRECTION))):
                return None
            prior = profile['previous_bytes']
            if set(prior) != {HELPER, *PATHS} or set(profile['extensions']) != PATHS:
                return None
            if _digest(prior[HELPER].encode()) != '6e80c1e797186611cfecbffab6f8e5f0e29e69d46ae76f336d76f1f28b2bfb16':
                return None
            additions = {
                'packages/javascript/src/index.js': 'export { RadialProfile3D, RadialProfileError } from "./radial-profile.js";\n',
                'packages/python/procedurals/__init__.py': '\nfrom .radial_profile import RadialProfile3D, RadialProfileError\n__all__ += ["RadialProfile3D", "RadialProfileError"]\n',
            }
            for name in PATHS:
                entry = profile['extensions'][name]
                if (set(entry) != {'before', 'after'} or entry['before'] != prior[name]
                        or entry['after'] != entry['before'] + additions[name]
                        or entry['after'].encode() != snapshots.get(name, _read(root, name))):
                    return None
                if name == relative and _digest(entry['before'].encode()) == expected:
                    successor_match = entry['before'].encode()
            snapshots.update({name: value.encode() for name, value in prior.items()})
        if (root / CORRECTION).exists() and not _validate_retained_output_correction(root, snapshots):
            return None
        # Only these frozen export transitions are authorized. Walking newest to
        # oldest keeps earlier reviews immutable without allowing arbitrary overlays.
        stages = (
            (BRANCH, TRIANGLE, PATHS,
             {HELPER, *PATHS, 'packages/javascript/src/branch-tree.js',
              'packages/python/procedurals/branch_tree.py'}),
            (TRIANGLE, SUCCESSOR, PATHS,
             {HELPER, *PATHS, 'packages/javascript/src/triangle-points.js',
              'packages/python/procedurals/triangle_points.py',
              'packages/python/procedurals/quadrant_partition.py'}),
            (SUCCESSOR, REVIEW, {'packages/javascript/src/index.js'},
             {HELPER, 'packages/javascript/src/index.js',
              'packages/javascript/src/quadrant-partition.js'}),
        )
        for record, previous, changed, required in stages:
            if not (root / record).exists():
                continue
            successor = json.loads(_read(root, record))
            if not _accepted(successor) or not _bindings(root, successor, snapshots):
                return None
            if not required.issubset(successor['implementation_sha256']):
                return None
            if successor['previous_review_sha256'] != _digest(_read(root, previous)):
                return None
            prior = successor['previous_bytes']
            if set(prior) != {HELPER, *changed} or set(successor['extensions']) != changed:
                return None
            for name, entry in successor['extensions'].items():
                current = snapshots[name] if name in snapshots else _read(root, name)
                if entry['after'].encode('utf-8') != current:
                    return None
                before = entry['before'].encode('utf-8')
                if before != prior[name].encode('utf-8'):
                    return None
                if name == relative and _digest(before) == expected:
                    successor_match = before
            snapshots.update({name: text.encode('utf-8') for name, text in prior.items()})

        review = json.loads(_read(root, REVIEW))
        if not _accepted(review) or not _bindings(root, review, snapshots):
            return None
        entries = review['extensions']
        if set(entries) != PATHS:
            return None
        # Validate both retained entrypoint snapshots, even when only one is requested.
        for name, entry in entries.items():
            current = snapshots[name] if name in snapshots else _read(root, name)
            if entry['after'].encode('utf-8') != current:
                return None
        if successor_match is not None:
            return successor_match
        before = entries[relative]['before'].encode('utf-8')
        return before if _digest(before) == expected else None
    except (OSError, ValueError, KeyError, TypeError, AttributeError):
        return None
