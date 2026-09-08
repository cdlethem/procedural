# CP7 retained mesh count bounds

This private representation note derives counts only. It sets no heap allocation,
artist-facing, runtime, or recommended subdivision/profile range.

Let `P >= 2` be profile points, `S >= 3` angular slices, `Z` endpoint poles (0–2), and
`C` enabled caps on positive endpoints, where `C <= 2-Z`. The two-pole `P=2` input is not
a surface. There are `P-Z` circular rings and `Z` individual pole vertices; a positive
cap adds one center. Thus

```
V = (P - Z) * S + Z + C
F = S * (2 * (P - 1) - Z + C)
```

Each of the `Z` pole-adjacent bands has `S` triangles; the other bands have `2S`, and each
cap fan has `S`. Algebra gives

```
F + 1 - V = S * (P - 2 + C) + 1 - Z - C
```

For `Z=0`, this is `S*(P-2) + C*(S-1) + 1`; for `Z=1`, it is
`S*(P-2) + C*(S-1)`; and for `Z=2`, `C=0,P>=3`, so it is `S*(P-2)-1`.
All are nonnegative in the domain, so `V <= F + 1`. For `maxFaces = 715827881`, `3F <= 2147483643` and
`3V <= 2147483646`, both within signed Java `int` array lengths. The no-allocation script
checks small combinations and the boundary `P=2,Z=1,C=0,S=715827881`, which has exactly
`V=715827882,F=715827881`; its cap and too-large-face neighbours are separately recorded.

With an input list length at most `2147483647` and `S <= 715827881`, evaluating the shown
products in signed 64-bit arithmetic remains below `Long.MAX_VALUE`. This only proves
count-expression safety before allocation; it does not promise that such arrays fit a
process heap.
