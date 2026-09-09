# Three-coordinate gradient field — normative0.1.0

Root approves `field.gradient-noise-3d-01` for Java implementation after the CP18 private
study. Catalog owns schemas; this document owns the detailed arithmetic. No native renderer,
distribution or other-target acceptance follows from contract approval.

## Boundary and ownership

An immutable seed-only single-octave scalar field. Constructor input exactly {seed}, uint32
integer0..4294967295. Serialize a detached {seed} record; normalize seed negative zero to0.
No defaults or encouraged ranges. Pure query exactly[x,y,z] returns binary64 in[0,1]. No
RNG consumption, cache/history, time, renderer or host globals. Query order cannot matter.
Coordinates are lattice units; callers scale/translate positions or provide a time-derived
third coordinate. Source evidence and composite remainder accounting are in the dependency
admission, not false keep/merge claims about noiseLineField or noiseGate.

Every coordinate must be finite and satisfy -9007199254740991<=q<9007199254740991. This ensures
floor(q) and floor(q)+1 are exact safe integers; it is not a useful artistic range. Validate
shape then x,y,z in order before sampling. Tiny negative values may round local fraction
to1; retain that result. No correction, epsilon, clamp of coordinates or truncation to int32.

## Exact arithmetic

All floating operations separately round IEEE754 binary64 nearest ties-to-even, no FMA,
reassociation or extended precision. Integer operations below retain exactly32 bits.

I=floor(x),J=floor(y),K=floor(z); u=x-I,v=y-J,w=z-K using separately rounded subtraction.
Corner integers remain exact through +1; reduce modulo2^32 only for hashing.

mix32(v): v ^= v>>>16; v=(v*0x7feb352d) mod2^32; v ^= v>>>15;
v=(v*0x846ca68b) mod2^32; return v^(v>>>16), with logical shifts.
At integer corner(i,j,k), a=mix32(seed XOR u32(i) XOR0x9e3779b9);
b=mix32(a XOR u32(j) XOR0x85ebca6b); h=mix32(b XOR u32(k) XOR0xc2b2ae35).
Choose gradient by unsigned h modulo12, in this exact order:
(1,1,0),(-1,1,0),(1,-1,0),(-1,-1,0),(1,0,1),(-1,0,1),(1,0,-1),(-1,0,-1),
(0,1,1),(0,-1,1),(0,1,-1),(0,-1,-1). No normalization or rejection mapping.

For offsets di,dj,dk in{0,1}, compute dx=u-di,dy=v-dj,dz=w-dk; products
px=gx*dx,py=gy*dy,pz=gz*dz; dot=(px+py)+pz, respecting that grouping.
fade(t): t2=t*t; t3=t2*t; a=6*t-15; b=t*a+10; return t3*b.
lerp(a,b,t): delta=b-a; product=t*delta; return a+product.
Compute fx=fade(u),fy=fade(v),fz=fade(w). Interpolate the eight corner dots in increasing
axis order: x first for each(y,z), then y for each z, finally z. Return clamp(0.5+0.5*raw,0,1),
multiplication before addition. Exposed zero is positive0. All query outputs compare exactly.
Do not claim that either clamp endpoint is attained until a fixture demonstrates it.

The hash depends on low32 corner bits, with a mathematical lattice period2^32 per axis.
Adding this period in floating point may lose fractional input precision; periodicity only
implies equal samples when the translated fractions remain represented identically.
This field intentionally differs from Processing Perlin and GradientNoise2D01 at z=0.
Existing2D semantics are unchanged. The lowbias32 mixer provenance/Unlicense notice already
lives in THIRD_PARTY_NOTICES.md; implementation reuses its package-private helper.

## Native surface and errors

Java `org.procedurals.fields.GradientNoise3D01`: create(Object exactMap) and create(long seed),
serialize(), sample(Object exactList), sample(Object x,Object y,Object z),
sample(double x,double y,double z). Scalar hot path allocates nothing; no caller input is
mutated or retained. Interchange numeric carriers are only Byte,Short,Integer,Long,Float,
Double. Reject bool, string, arbitrary Number, null and nonfinite values before conversion.

NoiseException extends IllegalArgumentException with public stable code. INVALID_INPUT
for malformed constructor/key/seed; INVALID_QUERY for malformed query shape/carrier or
out-of-domain coordinate. No partial result. Unsupported Java argument arity is a host
compile/call error, not an interchange error code. Allocation failure is a host resource
failure. Serialization materializes a new map; query retains nothing.

## Verification and performance

Shared rational-rounding oracle fixtures cover canonical/high-bit seeds, negative cells,
non-dyadic inputs, all axes, subnormals, safe-corner bounds, modulo2^32 coordinates,
constructor and query errors. Compare every scalar exactly through both interchange and
hot paths; test ownership, repeated/reordered queries and no change to2D behavior.
O(1) field storage/setup and O(1) eight-corner work per query. Record warmed tiny, source-like
250k-query and1m-query runs with checksum. These are measurements, not time guarantees.

Deliver an explicit-depth planar edit and native3D mesh transfer using existing infrastructure.
No full animation controller, generic sphere generator, source recreation, isotropy or
non-Java support claim is made by this operation. Ports remain deferred.
