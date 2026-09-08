# Running the first portable core

The regular grid is the first implemented building block for the field-marks example.
It gives positions that can be reused with different marks. The [field-marks example](getting-started.md) now has an executed JAVA2D drawing tab
and verified edit/transfer checks; current operation host support is recorded in the
[generated reference](reference/operations.md).

From the repository root, validate all three language implementations and build the JAR:

```sh
uv run python tools/run_grid_conformance.py --target all
```

This needs Node, Python and a JDK. The tool accepts `--java-home /path/to/jdk`, checks
`JAVA_HOME` and PATH, and can discover a single local `.work/toolchains/jdk-17*` installation.
The JAR is written to ignored `dist/procedurals-core-0.1.0.jar`. These checks execute native
language cores; they do not launch Processing or certify Android rendering.

Python, without installing the package:

```sh
PYTHONPATH=packages/python uv run python - <<'PY'
from procedurals import regular_grid
positions = regular_grid({
    'origin': [10, 20], 'spacing': [5, 8], 'columns': 3, 'rows': 2,
})
for i in range(positions.size):
    print(positions.point_at(i))
PY
```

JavaScript:

```sh
node --input-type=module <<'JS'
import { regularGrid } from './packages/javascript/src/index.js';
const positions = regularGrid({
  origin: [10, 20], spacing: [5, 8], columns: 3, rows: 2,
});
for (let i = 0; i < positions.size; i++) console.log(positions.pointAt(i));
JS
```

Both visit `(10,20), (15,20), (20,20), (10,28), (15,28), (20,28)`.
Counts mean points, including the origin. The numbers above demonstrate indexing; they
are not survey-backed artistic recommendations. Each position is calculated on demand.
For large traversals, use `point_into` / `pointInto` with reusable binary64 output storage.
See the [contract](../catalog/operations/regular-grid.json) for bounds, ownership and errors.

For the Processing runtime prerequisite on Linux, with `xvfb-run` installed:

```sh
uv run python tools/check_processing_runtime.py
```

This fetches the pinned official Maven `org.processing:core:4.5.6` artifact into ignored
`.work/toolchains/`, verifies its SHA-256, and compiles/runs a JAVA2D pixel-and-PNG smoke
check. Its generated result and PNG stay under `.work/build/processing-runtime/`.
It requires a JDK and accepts `--java-home`. This narrow check does not exercise P2D,
shaders, a package drawing adapter, or Android; those remain separate work.

The reviewed scalar field is now available alongside the grid. It is independently specified
and does not reproduce Processing's `noise()` sequence. Its seed is explicit; spatial scale
and offset remain visible caller arithmetic.

```sh
PYTHONPATH=packages/python uv run python - <<'PY'
from procedurals import gradient_noise_2d_01
field = gradient_noise_2d_01({'seed': 42})
print(field.sample(0.1, 0.2))
assert field.sample([0.1, 0.2]) == field.sample(0.1, 0.2)
PY
```

```sh
node --input-type=module <<'JS'
import { gradientNoise2D01 } from './packages/javascript/src/index.js';
const field = gradientNoise2D01({seed: 42});
console.log(field.sample(0.1, 0.2));
JS
```

Both query forms use the same operation. Use the two-scalar form in large loops to avoid
allocating a coordinate container per sample. Reordered queries and other field instances
do not change its state. These numbers demonstrate the API, not recommended artistic ranges.

Validate its ports and rebuild the combined Java JAR with:

```sh
uv run python tools/run_noise_conformance.py --target all
```

The public Java grid and noise operations were also consumed by a private JAVA2D drawing
probe. Its pixels exactly matched the inspected candidate design; see the
[scoped validation plan](../evidence/reproductions/gradient-noise-java2d/plan.json).
Palette/drawing behavior in that probe is still private. It does not complete the
field-marks example, public target adapters or upstream corpus reproduction.

The cyclic palette operation returns opaque RGB24 values. One phase unit walks the
whole supplied palette; keep opacity in the drawing style. Sampling does not change
the palette or consume randomness, so retained geometry can be recoloured separately.

```sh
PYTHONPATH=packages/python uv run python - <<'PY'
from procedurals import cyclic_palette
palette = cyclic_palette({'colors': [0xFF0000, 0x0000FF]})
assert palette.sample(0.25) == 0x800080
assert palette.sample(1.0) == 0xFF0000
PY
```

```sh
node --input-type=module <<'JS'
import { cyclicPalette } from './packages/javascript/src/index.js';
const palette = cyclicPalette({colors: [0xFF0000, 0x0000FF]});
if (palette.sample(0.25) !== 0x800080) throw new Error('wrong midpoint');
if (palette.sample(1.0) !== 0xFF0000) throw new Error('wrong wrap');
JS
```

Java uses `org.procedurals.color.CyclicPalette.create(params)` and `sample(phase)`.
The examples demonstrate cycle units and channel quantization, not recommended
colours or phase ranges. See the [contract](../catalog/operations/cyclic-palette.json).

```sh
uv run python tools/run_palette_conformance.py --target all
```

This validates native cores and builds the combined JAR. The example-owned JAVA2D
colour conversion and edit/transfer checks now pass; see [getting started](getting-started.md).
Portable drawing commands and the other hosts remain integration work.
