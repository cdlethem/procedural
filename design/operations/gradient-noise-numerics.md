# Gradient-noise numeric review sheet

Historical numeric review sheet. The [catalog](../../catalog/operations/gradient-noise-2d-01.json) is the only behavioral
schema. It is not a second implementation or independently maintained consumer schema.

- Constructor input exactly `{seed}`: required mathematical integer 0..4294967295;
  integral binary64 values accepted, booleans/nonfinite values rejected. Immutable field,
  serialization only `{seed}`; zero canonicalized positive. Errors: `INVALID_INPUT`.
- Query interchange value exactly `[x,y]`, finite binary64. For each coordinate require
  `q >= -9007199254740991` and `q < 9007199254740991`; equivalently both floor(q) and
  floor(q)+1 must be safe integers. Invalid query: `INVALID_QUERY`, x before y. Native
  hot path takes two scalars; one coordinate tuple is the same method's interchange overload.
  Invalid tuple shape is INVALID_QUERY; unsupported native call arity is a host-language
  call error outside the interchange data model. Passive JSON-like data and ordinary native numeric types.
  No mutable host callbacks or accessor/proxy semantics.
- Floors I,J are exact integer values. Reduce lattice corners modulo 2^32 only for hashing;
  **do not cast a binary64 coordinate directly to a signed 32-bit integer**. Java may convert
  floor to long, then take its low32 bits. Compute u=x-floor(x), v=y-floor(y) as binary64;
  subtraction may round a fractional coordinate to 1 near a lattice boundary. Do not apply
  an epsilon or reject that rounding result.
- Integer mix is exactly the five successive assignments in the reviewed proposal.
  Every multiplication wraps modulo 2^32. Shifts are logical. Coordinate hash is
  `mix(mix(seed XOR u32(I) XOR 0x9e3779b9) XOR u32(J) XOR 0x85ebca6b)`.
- Gradient order: (1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1).
  The selected index is low three bits. Dot computes px=gx*dx; py=gy*dy; result=px+py,
  with distinct binary64 rounding for each step.
- Fade F(t): a=t*t; b=a*t; c=6*t; d=c-15; e=t*d; f=e+10; return b*f.
  L(a,b,t): d=b-a; p=t*d; return a+p. Do not expand polynomials, use FMA, reassociate,
  normalize gradients or substitute host noise.
- Evaluate n00,n10,n01,n11 using offsets (u,v),(u-1,v),(u,v-1),(u-1,v-1).
  fx=F(u); fy=F(v); bottom=L(n00,n10,fx); top=L(n01,n11,fx);
  raw=L(bottom,top,fy); scaled=0.5*raw; result=0.5+scaled;
  clamp result to [0,1], canonicalize any zero to +0. Exact binary64 scalar comparisons.
- Field evaluation is order independent and consumes no state. O(1) memory/query work;
  no RNG transition vectors apply. Include intermediate integer hash vectors instead.
- Period 2^32 in each coordinate when the shifted binary64 coordinate preserves its
  fractional part exactly and stays in domain. A shift can lose subcell precision; this
  is not a disagreement with the algorithm. Lattice coordinates return exactly 0.5.
- Reproduction remains technique-level; first private visual experiment is evidence of
  usefulness, not conformance of future public implementations. Prototype int casts only
  covered its small sampled window and cannot satisfy this full domain.
