# CP3 private seeded-stream options

Status: bounded research for the CP3 rectangular circle-proposal investigation. This is
not an API admission, signature, parameter-range decision, implementation, or a claim of
source reproduction. It compares exactly two candidate private streams so that root can
choose between a portable primitive and deliberately limited Java/Android Processing
compatibility. Any later operation contract must version the chosen stream.

The motivating packing sources use Processing `random()` in different surrounding
programs. In particular, `caramelo` consumes random values before its packing loop and
`candy` does not seed its run. Choosing the `java.util.Random` sequence therefore would
not recreate any whole sketch by itself. See the [pinned source audit](cp3-packing-source-audit.md).

## Research workload and root continuation

The comparison uses up to 200,000 attempted proposals as a representative workload
from the audited source, not as an approved public validation ceiling. The stream
would take a finite integral unsigned 32-bit seed, with negative zero normalized to zero.
The artist-facing result does not need raw mutable RNG words.

The initial research assumption was three units per proposal (x, y, size). Root's
subsequent walkthrough instead proposes four: x, y, then two factors for a small-form
size distribution. All four are consumed before collision testing, even when a proposal
is rejected. Thus the cited workload would consume 800,000 units. This is a proposed
portable design, not a claim about source draw streams or an approved contract.

The stream supplies `[0,1)` units with no random retries. Processing's `random(high)`
can retry when a floating-point product equals `high`; a fixed-consumption portable
mapping is deliberately distinct from that compatibility behavior. Domain transforms,
size interpolation, comparison arithmetic and error consumption still need specification.

## Option A — xoshiro128** 1.1, with project-defined scalar initialization

### Canonical primitive and provenance

The authors publish `xoshiro128** 1.1` as a 32-bit all-purpose generator with four
`uint32` state words (128 bits); the all-zero state is forbidden. The source identifies a
1.0 scrambler-word mistake, so a versionless name is insufficient. Its output and state
transition are:

```text
result = rotl(s1 * 5 mod 2^32, 7) * 9 mod 2^32
u      = result / 2^32

t = s1 << 9 mod 2^32
s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3
s2 ^= t;  s3 = rotl(s3, 11)
```

`u` is evaluated as an exact binary64 scaling of an unsigned 32-bit integer. It includes
zero and excludes one. The authoritative source is David Blackman and Sebastiano Vigna's
[xoshiro128** 1.1 C file](https://prng.di.unimi.it/xoshiro128starstar.c); its header
explicitly dedicates copyright and related rights to the public domain and grants use,
copy, modification, and distribution without fee. The authors' [generator page](https://prng.di.unimi.it/)
identifies xoshiro128** as their 32-bit all-purpose generator and recommends a
radically different generator for initialization.

### Scalar-seed expansion proposed for comparison

xoshiro128** specifies state, not this package's scalar seed interface. The following is
therefore **our candidate initialization design**, not a property of the canonical
primitive:

1. zero-extend the validated `uint32` seed to a 64-bit unsigned value `x`;
2. make two successive outputs of Vigna's `SplitMix64`, beginning with that state;
3. form `s = [low32(q0), high32(q0), low32(q1), high32(q1)]`, in that exact word order;
4. reject an all-zero resulting state defensively (the stream must never repair or
   substitute a seed silently).

Each SplitMix64 step advances `x` by `0x9e3779b97f4a7c15` modulo `2^64`, then applies the
published xor/shift/multiply mix constants `0xbf58476d1ce4e5b9` and
`0x94d049bb133111eb`, with every operation modulo `2^64`. This uses the exact
[SplitMix64 source](https://prng.di.unimi.it/splitmix64.c), whose author likewise
places it in the public domain. The choice to take two outputs and pack low word before
high word is deliberately recorded as package work: it must be fixture-tested if adopted.

### Target mechanics and cost

The inner loop needs only 32-bit work after the two startup SplitMix64 calls. Java and
Android can use `int` bit patterns; JavaScript must force unsigned values after every
bitwise step (`>>> 0`) and use `Math.imul` for the wrapped products; Python masks every
word to 32 bits. JavaScript must not use signed `%`, and Java/Android must convert the
output to an unsigned value before the binary64 division. JavaScript may use `BigInt`
for the two SplitMix64 initialization steps, but it must not put `BigInt` in the
up-to-800,000-output proposal loop. Java `long`, Android `long`, and Python integers can
implement the same startup arithmetic directly.

This is the lower cross-host implementation risk for the stated bounded workload: it
uses 16 bytes of core state and never requires a 48-by-48-bit multiply in JavaScript.
It does not claim compatibility with Processing's historical random sequence.

## Option B — `java.util.Random` 48-bit LCG, with Processing-compatible units

### Canonical primitive and seed rule

The Java specification for `Random` fixes the internal 48-bit recurrence:

```text
z = (z * 0x5deece66d + 0x0b) mod 2^48
next(bits) = z >>> (48 - bits)
```

For the shared `uint32` seed input, zero-extend it to Java `long` and use the Java
constructor/set-seed initialization exactly:

```text
z0 = (seed ^ 0x5deece66d) mod 2^48
```

For this option, each proposal unit is Java `nextFloat`'s top-24-bit mapping:

```text
m = next(24)
u = m / 2^24
```

The portable implementation evaluates the division as binary64, exactly representing the
same rational value; each proposal therefore advances the LCG once per unit.
The official [OpenJDK `Random` source](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/Random.java)
specifies the initial scramble, recurrence, `next(bits)`, and `nextFloat` mapping. It is
OpenJDK source under [GPL-2.0 with the Classpath Exception](https://github.com/openjdk/jdk/blob/master/LICENSE);
this option would independently implement the published behavioral recurrence and must not
copy that source.

A local Android Processing 4.1.2 source snapshot confirms why this is named a
*Processing-compatible* option: `PApplet.randomSeed(long)` calls
`internalRandom.setSeed(seed)`, while `random(float high)` uses
`internalRandom.nextFloat() * high` and retries when the product equals `high`
(`.work/toolchains/android/processing-source-412/libs/processing-core/src/main/java/processing/core/PApplet.java`,
SHA-256 `258b309b25ad62fe9ddc7de75597bc91a32243aa46f126fbe5b2961aa5795c7a`,
lines 3668–3770). That Processing source is LGPL-2.1; no Processing implementation is
proposed for copying.

This option matches the Java/Android `Random` seed and raw `nextFloat` units. It does
**not** automatically match a source sketch's `PApplet.random(high)` results, because
that method performs binary32 multiplication and may retry. Claiming the latter would
require a separately frozen binary32 scaling/retry rule, including its variable draw
consumption; it is outside this two-choice comparison.

### Target mechanics and cost

Java and Android can calculate the recurrence in `long` and mask to 48 bits. Python can
use arbitrary integers and a 48-bit mask. JavaScript `Number` cannot evaluate
`z * 0x5deece66d` exactly: the product needs up to 96 bits. A JavaScript port must either
use `BigInt` for every draw or use a carefully specified, independently tested multi-limb
implementation (for example, two 24-bit limbs). Neither may delegate to p5.js or
`Math.random()`. At the proposed 800,000-draw workload, per-draw `BigInt` is a real cross-host cost
and benchmark risk; limb arithmetic removes that cost but increases portability-test
surface. The stream state is 48 bits (six logical bytes, normally stored in an eight-byte
integer).

## Decision record for root

| question | xoshiro128** 1.1 | Java `Random` 48-bit LCG |
| --- | --- | --- |
| goal it directly serves | portable private stream with compact 32-bit operations | exact Java/Android `Random(seed)` plus raw `nextFloat` unit sequence |
| scalar `uint32` initialization | package-defined SplitMix64 expansion; must be versioned | canonical Java seed scramble restricted to a nonnegative 32-bit `long` |
| unit resolution | 32 bits | 24 bits, as Java `nextFloat` |
| proposal consumption under this note | 4 outputs per proposed attempt | 4 LCG transitions per proposed attempt |
| JavaScript inner-loop burden | unsigned bitwise discipline; no `BigInt` after startup | `BigInt` per draw or a separately audited limb recurrence |
| source-sketch reproduction | no | only the raw Java/Android sequence; not full `PApplet.random(high)` behavior or prior source consumption |
| state exposure | unnecessary for the first seed-only convenience | unnecessary for the first seed-only convenience |

If root values a portable four-target primitive and bounded-loop simplicity, Option A is
the evidence-backed candidate to carry into a contract review. If root instead values
narrow Java/Android historical sequence compatibility enough to pay for a JavaScript
48-bit implementation, Option B remains viable. Neither choice should be exposed as a
general public RNG, and neither authorizes an operation or parameter range.

## Follow-up required only after a choice

A contract review must freeze: algorithm/version; seed normalization; exact scalar
initialization; unit conversion; proposal transform order; validation before state advance;
rejection and error consumption; state serialization if any; and fixture vectors for seed
zero, the high unsigned seed, first several units, and accepted/rejected proposal paths.
It should benchmark the actual selected target implementations at the representative 200,000
attempt workload. This note intentionally supplies no broad RNG test suite or third
candidate algorithm.
