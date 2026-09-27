# Place separated forms

The seeded source proposes circles within a movable rectangle: Source X and Y set its center, Source width and height its dimensions, and Proposals how many candidates the existing circle-placement operation considers in order. Minimum and Maximum radius govern candidate sizes; Separation compares center distances with combined exclusion radii. Earlier accepted circles exclude later ones, so increasing proposal count is not a promise of more shapes. Seed changes the proposal sequence; changing mark material or palette leaves accepted sites alone.

Radial source instead submits real ring proposals to the ordered circle-exclusion operation. Ring radius, Ring separation, Rings, Points per ring and Ring phase set their source geometry. Minimum and Maximum radius still determine their seeded exclusion radii; ring proposals may reject one another. The radial source is centered on the same Source X and Y, but the rectangle extents govern only the seeded rectangular source.

## Experiment

| Source | Material |
| --- | --- |
| A slim group: source (150, 520), width 210, height 65, 180 proposals, radius 4–14 | Strokes at 40°, scale .75. |
| A loose sprinkle: source (340, 340), width 470, height 320, 450 proposals, radius 5–22 | Thin diamond outlines, scale .8. |
| An interrupted halo: radial, 3 rings, first radius 45, ring separation 44, 19 points per ring, phase 30° | Inner rings or filled circles at scale .6. |

Outline, Diamond, Ring, filled Circle and Stroke are alternative **painted marks** at accepted sites. Material scale never enlarges the occupied exclusion circles. At Separation below one the drawing shrinks with the permitted spacing, and stroke widths that cannot fit the smallest reserved circle are rejected rather than silently applied. Scale zero makes no marks. No frames, panels or paper are painted here. This operation excludes circles; it cannot guarantee equal density or packed coverage.
