---
sketch: 2018/Generativos/castles
year: 2018
renderer: P2D
size: [960, 960]
libraries: []
deterministic: true
ms_first_frame: 1547
animated: false
techniques: [dots-stippling, grid, noise-field, packing]
primitives: [ellipse, rect]
palette:
  colors: ["#1A1312", "#3C333B", "#A84257", "#D81D37", "#D81D6E"]
  selection: random-from-list
composition: scattered
parameters:
reusable_candidates:
  - {name: rejectSample, signature: "rejectSample(count, minDistFn, bounds) -> PVector[]", note: "poisson-like rejection sampling used for both castles and dots"}
  - {name: noiseStipple, signature: "noiseStipple(attempts, baseSize, detail, offset, amp, excludeZones) -> drawn ellipses", note: "dot field whose per-dot size is modulated by 2-D noise, thinned around exclusion circles"}
  - {name: ditheredDiscGrid, signature: "ditheredDiscGrid(x, y, radius, sub, skipProb, edgeAt) -> rects", note: "square sub-grid inside a disc radius: full cells inside, tiny cells near the rim, random skips"}
---

## What it draws
On a warm off-white ground, a scattered field of small pink-red dots whose
density varies smoothly in broad soft patches (noise-driven size modulation
plus overlap rejection). Overlaid are ~10 black squares of very different
sizes (a few tens of pixels up to ~600 px), each built from a 30×30 sub-grid
of cells: solid black toward the centre, dissolving into sparse pinpricks
toward the rim, with ~10% of cells randomly missing. The dot field is
thinned out in a soft halo around every square, so the squares read as
"castles" rising out of the stippled field.

## How the code works
`setup()` calls `generate()` once (L7); `draw()` is empty, so the piece is
static and regenerates only on key press. All randomness is seeded from the
`seed` field (L23–24).

1. **Castle placement (L28–46):** up to 1000 attempts; each position is
   random on a 10 px grid (L30–33), size `s = width*random(0.8)` (L34, so 0–768 px).
   Overlap rejection: skip if within `(s+p.z)*0.5` of an already placed castle (L39) —
   a poisson-like packing.
2. **Dot field (L58–94):** 10000 attempts. Base dot size
   `width*random(0.008, 0.01)` (L63, ~8–10 px) scaled by
   `pow(noise(des+x*det, des+y*det), amp)` (L66) with `det = random(0.008,0.01)*0.4`
   (L51) and `amp = random(0.6,1)` (L53) — this is the smooth density pattern.
   Dots also reject against each other (L71) and are shrunk/zeroed inside
   exclusion rings around each castle: scale 0 at `rad1*0.5*c.z` mapping to 1 at
   `rad2*0.5*c.z` (L81–84, `rad1=0.8`, `rad2=1.1`, L55–56), producing the halo.
   Drawn as `ellipse` of the final size `ss = s*0.5` (L91).
3. **Colour:** dots all share ONE colour drawn once before the loop,
   `fill(rcol())` (L61) picking a random entry of the 5-colour palette (L138–141);
   in the baseline it landed on the vivid pink-red. Castles are always `fill(0)`
   (L115).
4. **Castle rendering (L98–129):** each castle is a `sub = 30` (L113) × `sub`
   grid of cells sized `s*0.5/(sub-2)` (L114); 10% of cells are skipped
   (L118); cells beyond 0.8 of the half-radius become tiny `ss*0.1` pinpricks
   (L122–123), inner cells `ss*0.8` (L126) — the centre-to-rim dissolve.

No transforms or blend modes; P2D, `smooth(8)`.

## Experiments
| variant | substitution | change score | observation | image |
|---|---|---|---|---|

## Modularisation notes
- **Generic, library-worthy:** the rejection-sampling loop (L36–42 / L68–74)
  is a reusable "poisson-like scatter" given a min-distance function; the
  noise-modulated stipple field (L62–94) is generic once the exclusion-zone
  list is a parameter; the dithered disc grid (L116–128) is a self-contained
  "mottled square" primitive (centre solid → rim pinpricks, random skip prob).
- **Art decisions:** the castle concept (black squares + halo of excluded
  dots), the single-random-colour dot field, the 5-colour palette, the
  `dis > 0.8` rim threshold, the 10% skip probability, the 10 px position grid.
- **Clean parameter object:** `{seed, castleAttempts, castleMaxSize, dotAttempts,
  dotBaseSize, noiseDetail, noiseAmp, excludeRadInner, excludeRadOuter,
  dotColorIndex, gridSub, cellSkipProb, rimThreshold}`.
