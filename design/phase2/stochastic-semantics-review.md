# Stochastic semantics review

Recommendation: **PCG32 XSH-RR v1**, fixed stream `initseq=54` (increment `109`). PCG's
primary paper defines its LCG-state plus output permutation design; the official minimal
implementation documents PCG32 as a full-range 32-bit generator ([paper](https://www.pcg-random.org/pdf/hmc-cs-2014-0905.pdf), [minimal library](https://www.pcg-random.org/using-pcg.html)).

PCG32 is preferred over a small 32-bit xor generator because its published XSH-RR form and
known full-width output are suitable for a library stream. Its 64-bit state is exact in
Java `long` wrap arithmetic, JavaScript `BigInt`, and Python masking. State is a lowercase
16-hex-digit string, never a JSON number.

## Proposed portable semantics (pre-contract)

Require an unsigned 32-bit integer seed; reject negative, fractional, boolean or out-of-domain inputs rather than truncating them. Initialise `state=0`,
`inc=(54<<1)|1=109`; advance once, add seed modulo `2^64`, advance once. A draw saves
`oldstate`, sets `state=(oldstate*6364136223846793005+109) mod 2^64`, then emits
`rotr32(((((oldstate>>18)^oldstate)>>27) mod 2^32), oldstate>>59)`. All 64-bit states, including zero, are valid explicit states; the fixed odd increment advances them.

`unit` is exactly `u32 / 4294967296`, hence `[0,1)`. A proposed palette bound `1 <= n <= 2^32` uses
unbiased rejection: draw `u32` until `u32 >= (2^32 mod n)`, then return `u32 % n`; every
rejected draw consumes state. A triangle sample consumes exactly two `unit` draws; it uses
the sqrt-barycentric construction evidenced by
`2018/Generativos/puntis2#1` and `2018/Generativos/puntis4#1` and returns the corresponding convex combination.
It does not share hidden host state. Empty palette is an error and consumes no draw.

The vectors in `.work/reviews/rng-vectors.json` provide ten transitions each for seeds 0,
1, 42, and 2147483648. Processing compatibility is separate: Processing's `random()`
algorithm and its sketch-specific draw order are not specified by this portable stream;
reproduction requiring it must name a versioned compatibility source.

This recommendation remains pre-contract while the architecture audit is integrated. It
does not approve an RNG implementation, palette interface or native target claim.
