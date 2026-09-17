# Seeded pixel grain contract review

Root review, 2026-09-17, before implementation. Accepted contract version 0.1.0.
The capability decision and exact source passages distinguish pixel brightness from
alpha distribution; the existing raster and arithmetic helpers remove no equivalent effect.
The prerequisite cluster check passed; it is not semantic acceptance.

Independent Terra review challenged alpha-fragment scope, native byte conversion and
missing noninteger-power fixtures. Root resolves these as follows:

- quadShadow motivates the alpha distribution only. Its coordinate hash and per-fragment
  overlap scheduling are excluded; no whole-sketch credit follows. The alpha native study
  is an independent composition.
- Core input/output are straight ARGB8, while the example packs/unpacks straight RGBA
  explicitly at density one. Host read failures surface as host errors. Native images
  cannot attest hidden RGB; exact core fixtures do.
- Added Java StrictMath.pow-oracled exponent .4 samples and a cancellation boundary
  that rounds to byte1 with the specified profile and byte0 with current V8 Math.pow.
  Positive underflow to subnormal/zero is valid and has explicit fixtures.

Root checked the LCG advance-before-sample order, exactly one draw per pixel including
identity/transparent cases, static validation before budget before arithmetic, byte
clipping/half-up rounding, detached ownership and no partial result. No arbitrary artistic
range/default is admitted. Binary64 separate operations and the existing licensed fdlibm
helper define power; no ambient renderer or RNG enters the core.

The fixtures precede code. This review accepts the contract, not implementation, native
behavior, transfer coverage or a demonstrated recreation; those require bound later evidence.
