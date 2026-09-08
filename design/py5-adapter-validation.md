# py5 native validation registration

Root registration before py5 adapter rendering, 2026-09-07. Use isolated py5 0.10.11a0,
Python 3.13.15, JPype 1.7.1 and local Temurin 17.0.20.1 under Linux/xvfb. Bind actual
installed py5 source and bundled core/py5 JAR hashes, not desktop Processing's version.
Use real sketch settings/setup, explicit JAVA2D and a density-2 parent to challenge
owned density-1 buffers. Serialize renders; store images only under ignored `.work`.

Initial budget: one native suite with independently reserved pixel/failure parts, plus
four CP1 images. One corrective execution of each affected part/four images is allowed
after a documented failure and repair. No passing suite is repeated just for metadata.

Pixel acceptance mirrors the reviewed desktop profile:

- Opaque exact-RGB background at 1×1, 640×640, 1920×1080, 2048×1, 1×2048, 2048×2048;
  validate logical/backing dimensions and density1 despite parent density2.
- Converted coordinate bounds and one-f32-ULP inside/outside x and y, width1/256,1,M,
  boundary convex quads, fully clipped unchanged background and visible central crossing.
  Record subpixel coverage with no visibility promise.
- Alpha128 red/blue overlap in both orders (interior channel tolerance2), exact opaque
  RGB, alpha0 unchanged, both quad windings identical and no translucent diagonal seam.
- Alternating segment/quad styles and round caps, identity-position/full-clip behavior,
  unchanged parent transform/style/clipping/pixels.

Failure/ownership acceptance uses actual Py5Graphics resources with injected failures,
explicitly distinguished from spontaneous JVM/device failure. Test invalid environment
before static capability/allocation, resource/readiness/init/draw/end phase codes, a
misleading native FrameError in each phase, absolute draw index through prior batch and
noop, full-batch atomicity, unchanged count on failure, reentry, cleanup failures and
no output after abort. Verify Java image/context/pixels and Python numpy/direct-buffer
references clear. Test later end/abort while successful output is still live, followed
by idempotent explicit release. Check byte-channel overloads through actual py5 wrappers.

CP1 uses the Python example's public Python grid/noise/palette and canonical commands,
retaining 25,600 field records for base/length/palette/bar. Compare model, colour and
converted geometry against accepted Java fixtures; exact hashes are sufficient when
equal, otherwise investigate within the already-declared 2e-4 coordinate tolerance for
native trig. All images must be opaque 640×640 and nonempty, edits visibly different,
and root inspects all four. Do not infer pixel identity from shared JAVA2D machinery.

Only the complete suite and independent review permit scoped py5 support. Prerelease
runtime pinning, other versions, Android, installation and full corpus reproduction
remain explicit separate requirements.
