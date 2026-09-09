# Read and reuse Java values

These rules describe the current Java implementation. They complement the
[direct API example](java-api.md) and [PlacementMarks](placement-marks.md); they do not
introduce new defaults or artistic parameter ranges.

## Construct and reuse a palette

`CyclicPalette.create(input)` requires a Java `Map` with exactly one key, `colors`.
Its value is a nonempty `List` of integer RGB24 values from `0` to `16777215`
(`0x000000` through `0xFFFFFF`). Entries may be boxed `Byte`, `Short`, `Integer`,
`Long`, `Float` or `Double`, but must be finite and integral. Strings, booleans,
other `Number` subclasses, signed ARGB colors and additional keys are rejected with
`CyclicPalette.PaletteException`, whose public `code` is `INVALID_INPUT`.
The factory copies the colors; subsequent input edits cannot change the palette.

`sample(double)` and `sample(Object)` return an RGB24 integer. Phase is in cycles:
one unit traverses the whole palette, negative phases wrap, and adjacent entries
interpolate through the last-to-first transition. The Object overload accepts the
same six numeric carriers. Nonfinite phases and unsupported Object values fail with
`INVALID_QUERY`. A single-color palette still validates the phase before returning
its color. Sampling does not advance state.

`serialize()` returns a fresh map containing a fresh `colors` list. Mutating either
container leaves the palette unchanged. This is a configuration value accepted by
`create`, so edit the exported list and create another palette when changing colors.
See the [palette contract](../catalog/operations/cyclic-palette.json) for exact channel
rounding and encoded-sRGB semantics.

## Read accepted circle placements

Both `CirclePlacements2D.filter(config)` and `seeded(config)` return retained results:

| Method | Meaning and ownership |
| --- | --- |
| `size()` | Number of accepted circles. |
| `attempts()` | Number of supplied candidates or generated proposals examined, including rejected ones. |
| `pointAt(i)` | A new two-element `double[]` in `[x, y]` order. Editing it cannot change the result. |
| `pointInto(i, destination, offset)` | Writes x and y into the caller's array at `offset` and `offset + 1`; reuse that array between drawing calls. |
| `radiusAt(i)` | Radius of accepted circle i, in the same coordinate units as its center. |
| `sourceIndexAt(i)` | Zero-based original candidate/proposal ordinal, before rejection. Use it to look up caller-owned per-proposal colors or other attributes. |
| `toValues()` | Detached map with `centres`, `radii`, `sourceIndices` and `attempts`; nested lists are also detached. This is an output record, not a factory configuration. |

Indices address the accepted sequence, in retained proposal order. Each indexed method
has `long` and `Object` overloads. An Object index must use one of the six boxed numeric
carriers listed above and represent a finite integer in `[0, 9007199254740991]`.
The long overload enforces the same bounds. Invalid carriers, fractions, negatives or
values above that limit throw `PlacementException` with `code = INVALID_INDEX`.
A valid integer at least `size()` instead fails with `INDEX_OUT_OF_RANGE`.

`pointInto` validates the index before the destination. A null destination, negative
offset or insufficient room for two values fails with `INVALID_OUTPUT` only after a
valid in-range index. These failures leave the destination untouched. None of these
accessors recomputes the placement or consumes random values.

The [ordered filter](../catalog/operations/ordered-circle-filter.json) and
[seeded placement](../catalog/operations/seeded-circle-placement.json) contracts specify
construction, exclusion and arithmetic-failure behavior. In particular, accepted count
is not the proposal budget, and a placement result does not promise maximal packing.
