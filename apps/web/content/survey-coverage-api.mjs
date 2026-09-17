const guide = (title, summary, useWhen, inputs, output, code, tryThis, pitfalls) => ({
  title,
  summary,
  useWhen,
  inputs,
  output,
  code,
  tryThis,
  pitfalls,
});

export const surveyCoverageApiGuides = {
  "raster.seeded-pixel-grain": guide(
    "Add seeded raster grain",
    "Give flat colors a fine brightness texture, or make an existing layer speckled and translucent.",
    "Use it on a captured pixel raster, then draw or composite the returned raster. Keep the seed to repeat the texture.",
    {
      source: "{width,height,pixels}: straight ARGB8 pixels in upper-left row-major order.",
      mode: "RGB_ADD changes brightness; ALPHA_MULTIPLY changes opacity.",
      range: "[low,high]: brightness change in bytes, or an opacity multiplier interval.",
      exponent: "Positive power: values above 1 favor the low end of the interval; values below 1 favor the high end.",
      rngState: "Explicit uint32 LCG state.",
      maxWork: "Pixel-event budget; at least width*height.",
    },
    "{raster:{width,height,pixels},rngState}",
    `// Motivated by survey/out/2014/Generativos/cuadraditos/notes.md: shared-channel pixel brightness.
const result = seededPixelGrain({
  source: { width: 2, height: 1, pixels: [0xff202020, 0xff808080] },
  mode: "RGB_ADD", range: [0, 10], exponent: 1, rngState: 42, maxWork: 2,
});
console.log(result);`,
    "Change mode or range, then inspect the detached raster and returned state.",
    [
      "The operation has no defaults and does not read a renderer or ambient RNG.",
      "ALPHA_MULTIPLY preserves straight RGB bytes and changes only alpha.",
      "This is a pixel transform component; it does not reproduce a source shader hash or an entire sketch.",
    ],
  ),
  "field.displace-points-2d": guide(
    "Displace sampled points",
    "Bend a grid or wobble a contour while keeping its points available for different drawing styles.",
    "Use it when a retained 2D point set should bend through an already sampled field while preserving point order.",
    {
      points: "Ordered finite [x,y] points.",
      samples: "One ordered finite [a,b] sample pair per point.",
      mode: "CARTESIAN interprets pairs as x/y changes; POLAR as angle in radians and signed distance.",
      bias: "Two base values: x/y changes or angle/distance, according to mode.",
      gain: "Two sample multipliers; increase these to amplify coordinate changes or angle/distance variation.",
      maxWork: "Bounded point-work budget.",
    },
    "{points,offsets}",
    `// The source field is sampled by the caller; this function only transforms supplied values.
const result = fieldDisplace2D({
  points: [[0, 0], [1, 0], [1, 1]],
  samples: [[0, 0], [0.5, 0.25], [1, 0]],
  mode: "CARTESIAN", bias: [0, 0], gain: [2, 2], maxWork: 3,
});
console.log(result);`,
    "Switch to POLAR or change one gain while keeping the supplied points in order.",
    [
      "Samples are explicit input; the operation does not evaluate noise or own a field generator.",
      "The returned points and offsets are detached and have one entry per input point.",
      "Renderer drawing, path styling, and spatial sampling remain outside the operation.",
    ],
  ),
  "field.octave-gradient-noise": guide(
    "Evaluate octave gradient noise",
    "Add smaller patches of variation to a broad pattern, then use the values for size, color or movement.",
    "Sample the same retained positions at several scales. Weight normalization keeps the total field scale separate from its detail count.",
    {
      dimension: "2 or 3 coordinate dimensions.",
      points: "Ordered finite coordinate tuples matching dimension.",
      seed: "Explicit uint32 seed reused at every octave.",
      octaves: "Positive band count; more bands can add smaller detail when lacunarity exceeds 1.",
      frequency: "Initial nonnegative spatial frequency; higher values make the broad pattern smaller.",
      lacunarity: "Positive frequency multiplier between bands; values above 1 move toward finer detail.",
      amplitude: "Initial nonnegative weight; sets strength for NONE and cancels under WEIGHT_SUM.",
      persistence: "Nonnegative weight multiplier; larger values give later bands more influence.",
      normalization: "NONE keeps the raw sum; WEIGHT_SUM divides by the total weight.",
      maxWork: "Schedule and sampling budget: at least (points.length+1)*octaves.",
    },
    "{values,amplitudeSum}",
    `// Source noise is replaced by the frozen gradient-noise profile; no host noise is consulted.
const result = octaveGradientNoise({
  dimension: 2, points: [[0, 0], [0.5, 0.25], [1, 1]], seed: 42,
  octaves: 3, frequency: 0.02, lacunarity: 2, amplitude: 1,
  persistence: 0.5, normalization: "WEIGHT_SUM", maxWork: 12,
});
console.log(result);`,
    "Increase octaves or change normalization, then compare values in the original point order.",
    [
      "The same seed is reused for each octave; it is not an ambient or advancing RNG stream.",
      "Coordinate products are checked against the existing profile domain before sampling.",
      "The operation returns scalar values only; displacement, color mapping, and drawing are caller work.",
    ],
  ),
};
