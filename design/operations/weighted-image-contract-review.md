# Weighted-image contract review

Root reviewed the Sol proposals and independent numerical vectors before implementation.
Both operation names are retained. All fields/weights validate before budget; count zero
still pays P scan events. Centroid ties use exact dyadic distance and lowest site index;
integer accumulation and one nearest-even rational rounding avoid order-dependent ties.
No empty-cell relocation or minimum separation is implied.

Root simplifies the proposed sampler: exactly four LCG draws per output, two-word
multiply-high pixel ticket followed by x/y jitter. There is no rejection/retry. Consecutive
LCG32 pairs occupy a correlated finite subset of 64-bit words; neither this mapping nor
the earlier rejection proposal makes the process statistically unbiased. The result is
a specified deterministic density sampler, not a quality/randomness guarantee. Prefix
binary-search bounds and midpoint are explicit because comparisons consume work.

The supplied corpus task and Secord research precedent are distinct. Root checked the
primary paper and corpus record, and froze the separate JSON schemas and analytical
fixtures. Native composition, useful density changes and installed replay remain pending.
