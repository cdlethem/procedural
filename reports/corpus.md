# Corpus analysis

Snapshot generated from `survey` at `2026-09-07T03:53:26.197450+00:00`. The survey is incomplete; all counts describe this snapshot, not the final 901-sketch corpus.

## Corpus shape

| measure | count |
|---|---|
| notes discovered / ingested | 826 / 826 |
| analyzed notes | 800 |
| blank/unrenderable stubs | 26 |
| animated sketches | 78 |
| non-deterministic sketches | 58 |
| parameter records (scored) | 3560 (3339) |
| candidate records (distinct exact names) | 1934 (1306) |
| variant result records (with objective diff) | 4578 (4482) |
| Xvfb shader baselines flagged suspect | 0 |
| ingestion diagnostics | 0 errors, 54 warnings |

## Technique frequency

| technique | sketches |
|---|---|
| grid | 430 |
| noise-field | 345 |
| dots-stippling | 208 |
| polar | 172 |
| lines-hatching | 147 |
| subdivision | 144 |
| distortion | 134 |
| particles | 110 |
| 3d-mesh | 95 |
| curves | 89 |
| packing | 85 |
| symmetry | 71 |
| blend-modes | 64 |
| voronoi-delaunay | 54 |
| shader | 50 |
| 3d-pointcloud | 41 |
| flow-field | 38 |
| image-source | 33 |
| pixel-ops | 28 |
| recursion | 27 |
| typography | 15 |
| agents | 14 |
| spiral | 13 |
| l-system | 1 |
| physics | 1 |

## Strongest technique co-occurrences

| technique A | technique B | shared sketches |
|---|---|---|
| grid | noise-field | 169 |
| dots-stippling | grid | 112 |
| grid | subdivision | 101 |
| dots-stippling | noise-field | 97 |
| distortion | noise-field | 84 |
| noise-field | particles | 76 |
| grid | lines-hatching | 70 |
| grid | polar | 69 |
| lines-hatching | noise-field | 69 |
| distortion | grid | 64 |
| noise-field | polar | 60 |
| 3d-mesh | grid | 54 |
| dots-stippling | lines-hatching | 47 |
| dots-stippling | polar | 44 |
| noise-field | packing | 43 |
| curves | grid | 37 |
| grid | symmetry | 37 |
| 3d-mesh | subdivision | 36 |
| curves | noise-field | 35 |
| noise-field | subdivision | 34 |
| flow-field | noise-field | 33 |
| grid | particles | 33 |
| grid | packing | 32 |
| 3d-mesh | noise-field | 31 |
| blend-modes | noise-field | 31 |
| dots-stippling | packing | 31 |
| dots-stippling | particles | 31 |
| polar | symmetry | 31 |
| curves | dots-stippling | 29 |
| lines-hatching | polar | 28 |

## Technique associations

| technique | sketches | top primitives | renderers | top compositions |
|---|---|---|---|---|
| grid | 430 | shape (291), rect (242), ellipse (202) | P2D (241), P3D (136), JAVA2D (53) | full-bleed (304), scattered (58), tiled (26) |
| noise-field | 345 | shape (209), ellipse (149), line (136) | P2D (191), P3D (130), JAVA2D (24) | full-bleed (246), scattered (50), centered (18) |
| dots-stippling | 208 | ellipse (159), shape (109), line (86) | P2D (134), P3D (39), JAVA2D (35) | full-bleed (138), scattered (39), radial (12) |
| polar | 172 | shape (125), ellipse (101), line (64) | P2D (89), P3D (56), JAVA2D (27) | full-bleed (65), scattered (43), radial (38) |
| lines-hatching | 147 | line (109), ellipse (76), shape (71) | P2D (66), P3D (42), JAVA2D (39) | full-bleed (99), scattered (28), radial (7) |
| subdivision | 144 | rect (98), shape (98), ellipse (46) | P2D (68), P3D (62), JAVA2D (14) | full-bleed (118), scattered (8), centered (5) |
| distortion | 134 | shape (87), line (42), ellipse (31) | P2D (71), P3D (58), JAVA2D (5) | full-bleed (91), scattered (18), radial (11) |
| particles | 110 | ellipse (63), line (50), shape (46) | P2D (60), P3D (34), JAVA2D (16) | full-bleed (66), scattered (27), radial (9) |
| 3d-mesh | 95 | shape (81), rect (25), line (18) | P3D (91), P2D (4) | full-bleed (56), scattered (16), centered (13) |
| curves | 89 | shape (64), ellipse (56), rect (29) | P2D (43), P3D (26), JAVA2D (20) | full-bleed (46), scattered (20), radial (10) |
| packing | 85 | shape (54), ellipse (50), line (34) | P2D (54), P3D (24), JAVA2D (7) | full-bleed (54), scattered (29), radial (2) |
| symmetry | 71 | shape (44), ellipse (42), rect (30) | P2D (41), JAVA2D (15), P3D (15) | full-bleed (33), radial (13), scattered (8) |
| blend-modes | 64 | shape (37), ellipse (28), line (21) | P2D (36), P3D (24), JAVA2D (4) | full-bleed (41), scattered (17), radial (5) |
| voronoi-delaunay | 54 | shape (49), ellipse (36), line (27) | P2D (35), P3D (17), JAVA2D (2) | full-bleed (35), scattered (13), centered (2) |
| shader | 50 | shape (37), ellipse (19), line (17) | P2D (32), P3D (18) | full-bleed (30), scattered (12), centered (6) |
| 3d-pointcloud | 41 | point (16), shape (15), line (13) | P3D (39), P2D (2) | full-bleed (16), scattered (10), radial (8) |
| flow-field | 38 | line (25), ellipse (19), shape (18) | P2D (30), P3D (7), JAVA2D (1) | full-bleed (31), scattered (3), radial (2) |
| image-source | 33 | image (28), shape (6), pgraphics (5) | P2D (27), P3D (4), JAVA2D (2) | full-bleed (26), scattered (3), centered (2) |
| pixel-ops | 28 | pixels (19), ellipse (16), rect (15) | JAVA2D (16), P3D (8), P2D (4) | full-bleed (21), scattered (3), tiled (2) |
| recursion | 27 | shape (16), ellipse (12), rect (12) | P2D (16), P3D (7), JAVA2D (4) | full-bleed (15), scattered (5), centered (4) |
| typography | 15 | text (14), ellipse (8), rect (8) | JAVA2D (9), P2D (5), P3D (1) | full-bleed (9), scattered (3), centered (1) |
| agents | 14 | ellipse (11), line (9), rect (8) | P2D (10), JAVA2D (4) | scattered (6), full-bleed (5), tiled (2) |
| spiral | 13 | shape (6), ellipse (4), line (4) | P3D (7), P2D (4), JAVA2D (2) | full-bleed (7), radial (4), scattered (2) |
| l-system | 1 | ellipse (1), line (1) | P2D (1) | radial (1) |
| physics | 1 | shape (1) | P2D (1) | full-bleed (1) |

## Reusable-candidate proposal distribution

Names are exact survey proposals, not Phase 2 semantic clusters. Near-duplicates remain deliberately unmerged.

| candidate name | proposals | sketches |
|---|---|---|
| arc2 | 47 | 47 |
| paletteLerp | 42 | 42 |
| lerpPalette | 38 | 38 |
| rcol | 36 | 36 |
| getColor | 31 | 31 |
| subdivideRects | 23 | 23 |
| noiseDisplace | 14 | 14 |
| dotGrid | 13 | 13 |
| arcRing | 12 | 12 |
| quadSubdivide | 11 | 11 |
| quadtreeSplit | 11 | 11 |
| colorRamp | 9 | 9 |
| desform | 9 | 9 |
| noiseRibbon | 9 | 9 |
| noiseWalk | 9 | 9 |
| concentricRings | 7 | 7 |
| gradientQuad | 7 | 7 |
| poissonScatter | 7 | 7 |
| grainShader | 6 | 6 |
| noiseBands | 6 | 6 |
| noiseDotGrid | 6 | 6 |
| noiseLine | 6 | 6 |
| noisePaletteColor | 6 | 6 |
| packCircles | 6 | 6 |
| quadtreeSubdivide | 6 | 6 |
| rosette | 6 | 6 |
| gridDots | 5 | 5 |
| paletteCycle | 5 | 5 |
| paletteNoiseColor | 5 | 5 |
| palettePick | 5 | 5 |
| paletteRamp | 5 | 5 |
| pixelGrain | 5 | 5 |
| radialSpokes | 5 | 5 |
| snapToGrid | 5 | 5 |
| boxGrid | 4 | 4 |
| circlePack | 4 | 4 |
| delaunayOverlay | 4 | 4 |
| fbm | 4 | 4 |
| flowFieldStrokes | 4 | 4 |
| lerpPaletteColor | 4 | 4 |

## Parameter sensitivity

The complete parameter-level artifact is `reports/parameter-sensitivity.csv`. It contains every parameter record, its provenance, default/tried values, score, effect, signal band, and reliability warning.

| change score | records | share of scored |
|---|---|---|
| large | 1439 | 43.1% |
| moderate | 992 | 29.7% |
| subtle | 524 | 15.7% |
| none | 384 | 11.5% |
| unscored/invalid | 221 | — |

### Repeated parameter names

Names are conservatively canonicalized for case, punctuation, and parenthetical descriptions only. Same-name parameters may still have different semantics; Phase 2 must inspect provenance before merging.

| parameter | scored | large | moderate | subtle | none | high-impact rate | example sketches |
|---|---|---|---|---|---|---|---|
| cc | 194 | 119 | 57 | 10 | 8 | 91% | 2014/Generativos/Curvas/prueba1, 2014/Generativos/lovetrigonometri, 2014/Generativos/palabrasyfuentes |
| sub | 106 | 80 | 17 | 3 | 6 | 92% | 2017/Generativos/cybergrids, 2017/Generativos/dotTriangles, 2017/Generativos/esquinas |
| palette | 106 | 62 | 34 | 8 | 2 | 91% | 2014/Generativos/Curvas/prueba1, 2017/Generativos/celular, 2017/Generativos/chinasseForms |
| det | 98 | 42 | 37 | 7 | 12 | 81% | 2015/Generativos/cityPink3d, 2015/Generativos/cubitos, 2015/Generativos/planets3d |
| colors | 79 | 55 | 17 | 5 | 2 | 91% | 2017/Generativos/cilindros, 2017/Generativos/esquinas, 2017/Generativos/gradients |
| count | 64 | 43 | 15 | 5 | 1 | 91% | 2014/Generativos/esferitas, 2014/Generativos/gradienteees, 2014/Generativos/mensajeAutopistas |
| amp | 53 | 27 | 17 | 7 | 2 | 83% | 2014/Generativos/Tildo, 2015/Generativos/naves/naves01, 2016/Generativos/arcss |
| background | 37 | 28 | 3 | 1 | 5 | 84% | 2014/Generativos/cosasfeas, 2014/Generativos/mapaRecorrible, 2015/Generativos/FFt/fft_prueba1 |
| strokeweight | 37 | 6 | 14 | 11 | 6 | 54% | 2014/Generativos/mensajeAutopistas, 2015/Generativos/circuloss, 2017/Generativos/lineTextures |
| alpha | 36 | 10 | 11 | 6 | 9 | 58% | 2014/Generativos/Curvas/prueba1, 2014/Generativos/Minim/arcos/arcos_pde, 2014/Generativos/cuadraditos |
| div | 34 | 18 | 12 | 2 | 2 | 88% | 2015/Generativos/FFt/prueba4, 2016/Generativos/circlesAndGrids, 2017/Generativos/spiral2 |
| ss | 30 | 14 | 12 | 4 | 0 | 87% | 2015/Generativos/arcosCampestres, 2017/Generativos/Eyes/eyes001, 2017/Generativos/chinasseForms |
| strokealpha | 29 | 10 | 10 | 6 | 3 | 69% | 2014/Generativos/Forms/forms1, 2014/Generativos/lovetrigonometri, 2015/Generativos/bolasPeludas |
| grid | 19 | 8 | 9 | 2 | 0 | 89% | 2018/Generativos/lebo, 2018/Generativos/persons, 2018/Generativos/persons02 |
| alp | 19 | 8 | 8 | 1 | 2 | 84% | 2018/Generativos/aakk, 2018/Generativos/citydatacity, 2018/Generativos/citydatacity2 |
| detcol | 19 | 4 | 11 | 3 | 1 | 79% | 2019/generativos/arau, 2019/generativos/arau002, 2019/generativos/arau003 |
| sep | 19 | 9 | 4 | 1 | 5 | 68% | 2014/Generativos/texturasPuntitos, 2015/Generativos/FFt/fft_prueba1, 2015/Generativos/cityPink3d |
| bb | 18 | 6 | 9 | 3 | 0 | 83% | 2017/Generativos/radigrafff, 2018/Generativos/aakk, 2018/Generativos/araniaaas |
| pointcount | 18 | 7 | 7 | 4 | 0 | 78% | 2018/Generativos/Forms/forms001, 2018/Generativos/magik4, 2018/Generativos/mantas |
| c | 16 | 9 | 4 | 2 | 1 | 81% | 2014/Generativos/palabrasyfuentes, 2015/Generativos/mandalitas, 2015/Generativos/texturasPencil |
| maxsize | 15 | 12 | 3 | 0 | 0 | 100% | 2017/Generativos/burbujas, 2017/Generativos/studio, 2018/Generativos/candela |
| dc | 15 | 9 | 5 | 0 | 1 | 93% | 2017/Generativos/Eyes/eyes001, 2017/Generativos/acid, 2017/Generativos/datamov |
| vel | 15 | 9 | 3 | 2 | 1 | 80% | 2014/Generativos/curdiculasdecuadrados, 2017/Generativos/neonLights, 2018/Generativos/colasUnicorneo |
| iterations | 15 | 9 | 2 | 4 | 0 | 73% | 2017/Generativos/minimal, 2017/Generativos/pajaritos, 2017/Generativos/quadDiag |
| noisedetail | 15 | 5 | 3 | 5 | 2 | 53% | 2017/Generativos/burbujas_ani, 2018/Generativos/OP/op_016, 2018/Generativos/OP/op_prob1 |
| fov | 14 | 11 | 3 | 0 | 0 | 100% | 2017/Generativos/sphhhh, 2018/Generativos/arc, 2018/Generativos/chime |
| sizescale | 14 | 8 | 4 | 1 | 1 | 86% | 2016/Generativos/gridAndPoints, 2017/Generativos/walking_gradient, 2018/Generativos/Forms/forms001 |
| cw | 13 | 11 | 1 | 1 | 0 | 92% | 2014/Generativos/cuadraditos, 2017/Generativos/gradients, 2017/Generativos/tevebe |
| circlecount | 13 | 3 | 7 | 3 | 0 | 77% | 2014/Generativos/circulos, 2014/Generativos/floresTriangulos, 2014/Generativos/minimalCirculines |
| s | 13 | 6 | 4 | 1 | 2 | 77% | 2015/Generativos/Kaiovodo/kaiovodo01, 2015/Generativos/mandalitas, 2017/Generativos/palta |
| ch | 12 | 8 | 3 | 0 | 1 | 92% | 2014/Generativos/cuadraditos, 2017/Generativos/gradients, 2017/Generativos/tevebe |
| des | 12 | 7 | 2 | 3 | 0 | 75% | 2014/Generativos/esferitas, 2017/Generativos/aci2, 2017/Generativos/fields |
| pwr | 12 | 5 | 3 | 3 | 1 | 67% | 2017/Generativos/tevebe, 2018/Generativos/Forms/forms004, 2018/Generativos/inthewordl |
| dd | 11 | 4 | 7 | 0 | 0 | 100% | 2016/Generativos/colorRamp, 2017/Generativos/datamov, 2017/Generativos/gusanos |
| size | 11 | 9 | 1 | 1 | 0 | 91% | 2017/Generativos/fieeee, 2017/Generativos/sphhhh, 2018/Generativos/Forms/forms002b |
| lar | 11 | 5 | 4 | 2 | 0 | 82% | 2015/Generativos/FFt/prueba4, 2018/Generativos/abstracactact, 2018/Generativos/estanco |
| attempts | 11 | 0 | 6 | 4 | 1 | 55% | 2017/Generativos/celular, 2018/Generativos/floripanos, 2018/Generativos/ostracity02 |
| dotsize | 11 | 1 | 0 | 5 | 5 | 9% | 2018/Generativos/OP/op_prob1, 2018/Generativos/cocirco, 2018/Generativos/conecttions |
| scale | 10 | 2 | 7 | 0 | 1 | 90% | 2014/Generativos/circulos2, 2017/Generativos/cilindros, 2018/Generativos/galpon |
| sizemax | 10 | 6 | 3 | 1 | 0 | 90% | 2015/Generativos/taptap, 2016/Generativos/formitas, 2018/Generativos/iidd |
| det1 | 10 | 3 | 5 | 1 | 1 | 80% | 2017/Generativos/erosion, 2017/Generativos/gusanos, 2017/Generativos/pelos |
| fillalpha | 10 | 1 | 4 | 2 | 3 | 50% | 2015/Generativos/linesCirculares, 2015/Generativos/naves/naves01, 2017/Generativos/circlesAlpha |
| steps | 10 | 4 | 1 | 4 | 1 | 50% | 2014/Generativos/cables, 2018/Generativos/gradientWalkers, 2018/Generativos/linesssll |
| blobcount | 9 | 5 | 4 | 0 | 0 | 100% | 2017/Generativos/burbujas_ani, 2018/Generativos/blobs, 2018/Generativos/cuda |
| layers | 9 | 6 | 3 | 0 | 0 | 100% | 2016/Generativos/arcss, 2016/Generativos/gridAndPoints, 2017/Generativos/boxes |
| detsize | 9 | 6 | 1 | 2 | 0 | 78% | 2018/Generativos/micro, 2019/generativos/colidion, 2019/generativos/dondon |
| res | 9 | 7 | 0 | 1 | 1 | 78% | 2017/Generativos/fieeee, 2017/Generativos/sphhhh, 2017/Generativos/triangularGradient |
| detang | 9 | 3 | 3 | 2 | 1 | 67% | 2018/Generativos/ailan, 2018/Generativos/puda02, 2018/Generativos/repasador |
| linealpha | 9 | 1 | 1 | 2 | 5 | 22% | 2014/Generativos/esferitas, 2018/Generativos/bordis, 2018/Generativos/chea02 |
| shadowalpha | 9 | 0 | 1 | 6 | 2 | 11% | 2018/Generativos/caramel, 2018/Generativos/circles, 2018/Generativos/mosaic03 |

### Large and moderate observed changes

Non-deterministic moderate changes and shader baselines rendered under Xvfb are omitted from this concise table; they remain in the CSV with warnings.

| score | sketch | parameter | default → tried | observed effect |
|---|---|---|---|---|
| large | 2014/Generativos/Curvas/prueba1 | cant | int(random(80, 180)) → [180] | every fan gets 180 curves -> wider denser ribbons that read as solid filled shapes |
| large | 2014/Generativos/Curvas/prueba1 | cc | int(random(10, 40)) → [40] | more fans (up to 40) -> busier composition, more overlapping ribbons, background mostly covered |
| large | 2014/Generativos/Curvas/prueba1 | palette | #D4FAF3 #33A691 #2D3A52 #B31750 #FF3F21 → ["#765664 #EC7D88 #F4EC84 #62B681 #ECB973"] | entire image recolored including the background: dark plum ground with salmon, peach, green and pale-yellow ribbons |
| large | 2014/Generativos/Esferas | barWidth | 5 → [10] | wider, more spaced comb; same overflow structure, cluster reads coarser and denser white area |
| large | 2014/Generativos/Esferas | growth | exp(i) → ["exp(i/2)","i*10"] | slower growth widens the graduated short-bar region; linear growth turns the bars into a smooth triangular ramp filling ~half the canvas |
| large | 2014/Generativos/Forms/forms1 | sizeRange | [60,200] → [[100,300]] | forms up to 300px span; almost no white background left, composition becomes a full-bleed mass of hatching |
| large | 2014/Generativos/Minim/arcos/arcos_pde | bgColor | #2D2434 → ["#E8E4EF"] | background colour; flipping to light lavender dominates the whole image |
| large | 2014/Generativos/circulos | circleDist | random(30,120) → ["random(0,40)"] | centres pulled to tile centre: rings cluster mid-tile, less edge clipping |
| large | 2014/Generativos/circulos2 | cubeCount | 40 → [12] | much sparser scene: mostly teal background, only a few large white slabs with sparse circles |
| large | 2014/Generativos/circulosdentrocirculos | c4WedgeCount | random(4,73) → ["random(4,20)"] | fewer wedges per ring = many more, smaller alternating black/white wedges; outer band becomes a high-contrast zigzag and the white areas grow dominant |
| large | 2014/Generativos/circulosdentrocirculos | maxDiameterScale | 1.0 → [0.55] | smaller starting diameter = whole mandala shrinks to an inscribed circle with black corner margins |
| large | 2014/Generativos/circulosdentrocirculos | motifTypes | random(5)+1 (types 1-5) → ["random(2)+1 (types 1-2)"] | restricting to types 1-2 removes wedges, polygons and dot rosettes, leaving only outline/tick rings and dotted rings |
| large | 2014/Generativos/circulosdentrocirculos | step | random(10)+1 times 10 (10-100 px) → [20] | larger shrink step = fewer, bolder rings with more black ground between them |
| large | 2014/Generativos/circulosdentrocirculos2 | max_diameter | dist(0,0,width,height) ~ 848 → [300] | mandala shrinks to the centre (max radius ~150), wide pale-mint margin, no longer full-bleed |
| large | 2014/Generativos/circulosdentrocirculos2 | motif_count | 100 → [30] | sparser; dense full-bleed mandala collapses to a compact centred medallion, only thin ring/tick webs reach the corners |
| large | 2014/Generativos/circulosdentrocirculos2 | motif_index | random(5)+1 → [2] | only circulo2 drawn: full-bleed bands of thick rings studded with dots, no ticks/polygons/zigzag |
| large | 2014/Generativos/circulosdentrocirculos2 | ring_weight | (random(10)+1)*10 → ["(random(10)+1)*30"] | much bolder: heavy navy tick fan, wide bands, large cream dots |
| large | 2014/Generativos/cosasfeas | background | 180 → [0] | same figures on near-black ground; grain no longer visible |
| large | 2014/Generativos/cosasfeas | figure_count | 20 → [5] | far sparser: 5 rosettes with big empty grey areas |
| large | 2014/Generativos/cosasfeas | passes | 1-49 (cc) → [4] | thick parallel ribbons collapse to single thin lines; dots become visible |
| large | 2014/Generativos/cosasfeas | radius_range | width*0.15-0.8 → ["width*0.05-0.3"] | small gear-like figures, much more empty background |
| large | 2014/Generativos/cosasfeas | vertex_count | 3-19 (cant) → [8] | spiky stars become regular round heptagon/octagon/nonagon rosettes |
| large | 2014/Generativos/crucesitas | crossScale | random(3,10) → ["random(3,30)"] | much larger, heavier X stitches; marks dominate the canvas |
| large | 2014/Generativos/cuadraditos | t | 5 → [9] | 9px squares: much chunkier, coarser dot clusters, clearly larger marks |
| large | 2014/Generativos/curdiculasdecuadrados | depth | 5 → [7] | deeper quadtree -> many more small cells; canvas fills into a dense diagonal-hatched black field with sparse white blocks |
| large | 2014/Generativos/esferitas | sizeBias | random(20,100)*random(1)*random(1) → ["random(20,100)"] | removing the size bias makes spheres much larger on average; cluster becomes a near full-bleed mass of big overlapping circles |
| large | 2014/Generativos/gradienteees | count | 80 → [200] | more shapes; busier, more densely overlapping field, more small shapes visible |
| large | 2014/Generativos/gradienteees | shapeSize | random(20,300) → ["random(20,100)"] | smaller max size; fine mosaic of small-to-mid shapes, no large dominant discs |
| large | 2014/Generativos/gradienteees | squareProb | 0.5 → [0.85] | hatched squares/wedges dominate; far fewer smooth gradient discs |
| large | 2014/Generativos/lovetrigonometri | amplitud | random(0.2, 0.4) → ["random(0.4, 0.55)"] | larger ring radius: loop spreads to fill the canvas, bead trails radiate farther |
| large | 2014/Generativos/mapaRecorrible | ns1 | 0.003 → [0.01] | higher noise scale breaks the single landmass into many scattered brown islands over small blue rings |
| large | 2014/Generativos/mapaRecorrible | tam | 10 → [20] | cell size doubles: rings become visibly bigger with larger pale holes, same landmass layout |
| large | 2014/Generativos/mensajeAutopistas | count | 2000 → [500,5000] | 500: sparser, individual tracks and dark background clearly visible; 5000: denser, more chaotic, heavier overlap |
| large | 2014/Generativos/mensajeAutopistas | diagStep | random(50,100) → ["random(10,30)"] | shorter diagonal steps, more angular/jagged segments, PCB-like look |
| large | 2014/Generativos/minimalCirculines | weightFactor | 0.2 → [0.5] | strokes 2.5x thicker; big rings become heavy near-solid bands, small circle stays thin |
| large | 2014/Generativos/organico | bgAlpha | 10 → [60] | 6x stroke alpha: grain becomes a coarse mid-grey texture, vignette near-black at edges |
| large | 2014/Generativos/organico | bgDotCount | 1000000 → [3000000] | 3x background dots: grain noticeably denser and darker, edge vignette much heavier |
| large | 2014/Generativos/palabrasAleatorias | bgValue | random(180) → [60] | background darkens from bright olive to dark olive/brown |
| large | 2014/Generativos/palabrasAleatorias | h | random(256) → [200] | background shifts from bright olive to a dark muted teal-green (all colours share the run hue) |
| large | 2014/Generativos/pelosss | speed | random(0.4,2) → ["random(0.2,0.8)"] | slower walkers: finer, tighter, more granular curls, more background between them |
| large | 2014/Generativos/pelosss | startSize | 40 → [80] | larger start diameter: bigger, bolder curls, fewer and more readable rings |
| large | 2014/Generativos/pelosss | strandCount | 5000 → [1250] | fewer strands: sparse field of discrete curls, light grey background shows through |
| large | 2014/Generativos/quadFlotantes | maxOutlineWeight | 3 → [6] | thicker outlines; darker, more connected mesh of outlined squares |
| large | 2014/Generativos/quadFlotantes | outlineAlpha | 8 → [60] | near-invisible outlines become strong; image much darker with a visible dark grid mesh |
| large | 2014/Generativos/quadFlotantes | quadCount | 40000 → [10000] | 4x fewer squares per pass; much of the dark background shows through, sparse glitter look |
| large | 2014/Generativos/texturasPuntitos | gradient direction | map(i,0,height,0,1) → ["map(i,0,height,1,0)"] | reverses the whole gradient: blue on top, magenta on bottom; dot band unaffected (top-left) |
| large | 2015/Generativos/FFt/fft_prueba1 | background | 220 → [120,40] | darker base => much stronger shader vignette; 120 = brighter white centre with a darker gray ring, 40 = near-black field |
| large | 2015/Generativos/FFt/prueba3 | background | 40 → [180] | light grey background: white cubes nearly blend in, low contrast |
| large | 2015/Generativos/FFt/prueba3 | camDist | random(-800,-100) → ["random(-300,-100)"] | camera closer: much larger cubes, stronger perspective (huge foreground cubes) |
| large | 2015/Generativos/Kaiovodo/kaiovodo00 | hatchCount | 2000000 → [400000] | much lighter grain: the dense stipple field in the top-right thins to a sparse speckle and the wavy flow strokes underneath become clearly visible |
| large | 2015/Generativos/Kaiovodo/kaiovodo01 | flow line count | 2000000 → [400000] | mottled background thins out; brighter, grainier field, white stars and rings stand out more |
| large | 2015/Generativos/Kaiovodo/kaiovodo01 | star (cross) count | 60000 → [20000] | fewer white stars; the dark mottled texture dominates a much larger area |
| large | 2015/Generativos/amoaluciana | discCount | 220 → [80] | sparser clusters of eyes; rust stripes visible between them |
| large | 2015/Generativos/amoaluciana | maxDiscD | 420 → [150] | all medallions small and uniform; no giant discs |
| large | 2015/Generativos/amoaluciana | ringSegments | 3-9 → ["2-5"] | fewer, bolder ring arcs with wider gaps |
| large | 2015/Generativos/arcosCampestres | background | 240 → [30] | dark-gray ground instead of light-gray; wedges unchanged in style |
| large | 2015/Generativos/cubitos | mz | 0.5 → [2.0] | mouse-distance z push; 2.0 pushes the whole wall out of camera view, leaving a flat dark background |
| large | 2015/Generativos/lutFirst | blobProb | 0.003/partis.size() → ["0.01/partis.size()"] | many more nested-polygon targets and smiley faces; central cluster swells into a big mass |
| large | 2015/Generativos/lutFirst | initialCount | 80 → [20] | sparser trails, fewer and smaller motifs, one central cluster instead of a dense field |
| large | 2015/Generativos/mandalitas | cc | random(1,20) → [5] | fewer concentric rings per motif (max 5 vs 20); form1 consumes one random per ring, so the downstream stream shifts and colours reshuffle, making the collage read more orange |

### None and subtle observed changes

These records are evidence against exposing a parameter by default, subject to the effect text and reliability flags. A `none` score can also reveal a harness timing problem or an occluded layer rather than an inert parameter.

| score | sketch | parameter | default → tried | observed effect |
|---|---|---|---|---|
| subtle | 2014/Generativos/Arboles | cantRamas | random(2,9) → ["random(4,9)"] | no clear visual change; the drawn depth was already >=4 under seed 42 so the lower-bound clamp was a no-op |
| subtle | 2014/Generativos/Arboles | fanSpread | 80 → [40] | halving the *80 fan multiplier barely narrows the top splay; silhouette essentially unchanged under seed 42 |
| subtle | 2014/Generativos/Arboles | h | height/3 → ["height/2"] | tree and its blue bounding box ~1.5x taller; same branching structure |
| subtle | 2014/Generativos/Forms/forms1 | beadSize | 4 → [10] | small pixel diff, but the intersection dots on every polygon edge become clearly visible open circles, heavily beading the outlines |
| subtle | 2014/Generativos/Minim/arcos/arcos_pde | bandScale | 8 → [20] | wedge radius = band*8; x2.5 makes wedges longer but overall coverage similar at this audio moment |
| subtle | 2014/Generativos/Tildo | freq | 20 → [8] | fewer, wider wave cycles (score still only subtle) |
| subtle | 2014/Generativos/Tildo | strokeWeight base | 1.5 → [6] | thicker, bolder strokes everywhere; no other change |
| subtle | 2014/Generativos/cables | amount | int(random(2,8)) → [1] | 1 cable instead of 3-4: single thin multicolour strand from left edge to mid-canvas, rest of canvas empty |
| subtle | 2014/Generativos/cables | angleDrift | random(-0.2,0.2) → [0.6] | higher drift makes cables loop and tangle into a dense spiky mass around the centre instead of smooth long tendrils |
| subtle | 2014/Generativos/cables | arcSize | 60 → [120] | doubles the strand width: noticeably thicker ribbon with longer, more prominent barbs along the curves |
| subtle | 2014/Generativos/cables | steps | 500 → [1000] | cables run twice as long: meander further from the centre, reach the canvas edges and loop back on themselves |
| subtle | 2014/Generativos/circulos2 | ringStrokeWeight | 3-8 → ["3-16"] | no visible change; circle strokes look the same weight as baseline |
| subtle | 2014/Generativos/crucesitas | chainLen | int(random(1,15)) → ["int(random(1,30))"] | some rows run longer, overall soft look barely changes |
| subtle | 2014/Generativos/crucesitas | hatchCount | 20 → [80] | a few more diagonal dash clusters; overall texture similar |
| subtle | 2014/Generativos/cuadraditos | alpha | 180 → [60] | lower fill alpha: dots fade toward the dark background, lower contrast |
| subtle | 2014/Generativos/cuadraditos | cw | 8 → [12] | wider blocks (12 cells) fill the 80px pitch, gaps between blocks shrink slightly |
| subtle | 2014/Generativos/cuadraditos | skipP | 30 → [70] | 70% skip: noticeably sparser dots, thinner ragged blocks; grid structure preserved |
| subtle | 2014/Generativos/curdiculasdecuadrados | fillBias | 5 → [8] | raises share of white-fill cells; a few cells flip between white and black fill, layout unchanged |
| subtle | 2014/Generativos/curdiculasdecuadrados | phaseStep | 0.01 → [0.05] | faster phase creep; at frame 1 the hatch is shifted slightly further, layout and density unchanged |
| subtle | 2014/Generativos/edificios | w (building width range) | random(100, 300) → ["random(400, 500)"] | larger building, wider footprint in top-right corner |
| subtle | 2014/Generativos/esferitas | crossScale | t*0.10 → ["t*0.30"] | x-ticks ~3x larger and bolder, trails longer and more prominent |
| subtle | 2014/Generativos/esferitas | des | random(2,8) → [2] | diagonal wash becomes a visible fine 2-px texture across the background |
| subtle | 2014/Generativos/esferitas | lineAlpha | 16 → [80] | diagonal lines become clearly visible white hatching over the whole canvas |
| subtle | 2014/Generativos/floresTriangulos | circleCount | 300 → [150] | flower becomes sparser with more gaps between circles; overall ring shape unchanged |
| subtle | 2014/Generativos/floresTriangulos | da | TWO_PI/3 → ["TWO_PI/4"] | central triangle rosette switches from 3-fold to 4-fold symmetry; only the faint inner outlines shift |
| subtle | 2014/Generativos/floresTriangulos | triangleCount | 200 → [400] | more concentric triangle rings, rosette extends slightly further out; still faint |
| subtle | 2014/Generativos/gradienteees | palette[1] | #028F76 → ["#1C5DAA"] | teal discs read as blue where teal is a gradient endpoint; rest of palette unchanged |
| subtle | 2014/Generativos/lovetrigonometri | strokeAlpha | 30 → [90] | more opaque solid lines; same paths, less see-through overlap |
| subtle | 2014/Generativos/mensajeAutopistas | markerW | 80 → [40] | smaller marker rects at track heads; overall image nearly unchanged |
| subtle | 2014/Generativos/minimalCirculines | cantMax | 20 → [40] | more segments = finer dashes; bottom ring nearly continuous, small circle unchanged |
| subtle | 2014/Generativos/minimalCirculines | circleCount | 3 → [8] | adds 5 more circles of the same random style; original three unchanged, new ones thin so little extra ink |
| subtle | 2014/Generativos/minimalCirculines | sepMax | 0.6 → [0.9] | arcs fill more of their slot; gaps shrink, rings look near-closed |
| subtle | 2014/Generativos/organico | cellCount | 5 → [12] | same five cells plus seven more, several tiny; background untouched, canvas looks a busier scatter |
| subtle | 2014/Generativos/organico | cellDotSize | 10 → [16] | same cells, bigger dots: clusters look denser and chunkier, rims read as filled circles |
| subtle | 2014/Generativos/organico | cellMaxDiam | 200 → [400] | cells same positions but up to 2x wider; one cluster now clips the right edge, still recognisably the same blobs |
| subtle | 2014/Generativos/organico | cellMaxDots | 1000 → [300] | cells same positions; the largest cluster visibly thinner/sparser, others barely changed |
| subtle | 2014/Generativos/papota | bandWidth | random(20, 200) → ["random(60, 350)"] | background bands wider and more subtle; RNG stream shift spawns 2 scattered stacks |
| subtle | 2014/Generativos/papota | cc | int(random(-3,8)) (0 for seed 42) → [0] | scattered ring stacks removed; baseline had none, so only slight re-shaping of the central stack (RNG stream shift) |
| subtle | 2014/Generativos/papota | centerCono_dim | random(width*0.2, width*0.6) → ["random(width*0.05, width*0.15)"] | central stack shrinks to ~1/4 diameter, crosses and bands unchanged |
| subtle | 2014/Generativos/papota | cruces_cant | int(random(90)) → [0] | crosses gone; RNG stream shift spawns 4 scattered ring stacks |
| subtle | 2014/Generativos/papota | degrade_alp | random(0.1, 0.6) → ["random(0.7, 1)"] | near-opaque gradient wash hides bands and crosses, leaving flat background + central stack |
| subtle | 2014/Generativos/prueba1 | spoke_count | 40 → [80] | spokes visibly finer and dot rows slightly denser; overall close to baseline |
| subtle | 2014/Generativos/prueba1 | web_alpha | 40 → [200] | web rings/spokes clearly more prominent; dot layer unchanged |
| subtle | 2014/Generativos/quadFeos | splitProb | 0.3 → [0.9] | no visible structural change; only dot count/positions differ (non-deterministic) |
| subtle | 2014/Generativos/quadFlotantes | maxx | 8 → [6] | coarser minimum cell (4px vs 1px); grain looks blockier, same overall density |
| subtle | 2014/Generativos/quadFlotantes | paletteColor | #7BB0A8 → ["#B07B7B"] | teal swapped for dusty rose; warmer muted cast, structure unchanged |
| subtle | 2014/Generativos/texturasPuntitos | grid angle | random(TWO_PI) → [0] | angle 0 makes sin(ang)=0, grid collapses to a single flat row of dots along the top edge instead of a rotated band |
| subtle | 2014/Generativos/texturasPuntitos | tam (dot size) | 10 → [30] | dots grow into overlapping white rings; dot band turns into a dense ring mesh, still confined to top-left |
| subtle | 2015/Generativos/Kaiovodo/kaiovodo00 | crossCount | 60000 → [200000] | subtle: slightly denser scatter of small stars/circles along the diagonal band, hard to distinguish from the circles layer |
| subtle | 2015/Generativos/amoaluciana | crossCount | 100 → [300] | slightly more small crosses in the gaps |
| subtle | 2015/Generativos/amoaluciana | stripeAlpha | 80 → [200] | background stripes slightly more visible in the gaps |
| subtle | 2015/Generativos/arcosCampestres | mc | 8 → [3] | max wedge count: 3 gives ~3/4-filled circles (1-3 wedges, 90-deg gap); small in pixel metric because circles cover ~6% of canvas |
| subtle | 2015/Generativos/arcosCampestres | ss | height*random(0.1,0.2) → ["height*random(0.4,0.5)"] | wider gap -> fewer circles per row (3x1 in this run, confounded with the run's random small tt) |
| subtle | 2015/Generativos/bolaPantone | alphaStep | 50 → [20] | ring alpha capped at 100 instead of 250; ball paler, washed out |
| subtle | 2015/Generativos/bolaPantone | ringWeight | 1.5 → [4] | thicker rings; ball slightly more solid, similar overall impression |
| subtle | 2015/Generativos/bolaPantone | trailSteps | 6 → [12] | longer diagonal trails; directional combed streak texture |
| subtle | 2015/Generativos/bolaParticulas | startSize | 20-60 → ["20-120"] | fatter, chunkier worms, similar extent |
| subtle | 2015/Generativos/bolasPeludas | hairLenScale | 120 → [40] | shorter hairs -> slightly lighter, tighter fringe |
| subtle | 2015/Generativos/bolasPeludas | nCandidates | 300 → [150] | fewer balls kept, sparser layout |
| subtle | 2015/Generativos/caritas | headHue | random(50) → ["random(180, 240)"] | peach head becomes pale light blue; only ~6% of pixels change because the head is mostly off-canvas |

## Objective variant-diff records

| label | variants | mean RGB difference | mean changed fraction |
|---|---|---|---|
| large | 1934 | 0.263 | 0.7266 |
| moderate | 1304 | 0.0968 | 0.3535 |
| subtle | 712 | 0.0286 | 0.0814 |
| none | 532 | 0.0034 | 0.0081 |
| unscored | 96 | — | — |

## Applied normalizations

Every normalization is retained in the database with sketch provenance. Raw frontmatter is also preserved.

| field | original | normalized | rule | uses |
|---|---|---|---|---|
| composition | "grid" | "tiled" | map layout synonym to controlled vocabulary | 2 |
| composition | "scattered" | "full-bleed" | preserve explicit valid composition over leaked technique | 2 |
| palette.selection | "random-hsb" | null | drop value outside controlled vocabulary | 1 |
| parameters | "name: max_amp" | null | drop non-mapping parameter record | 1 |
| parameters | "name: max_h" | null | drop non-mapping parameter record | 1 |
| parameters | "name: max_sub" | null | drop non-mapping parameter record | 1 |
| parameters | "name: max_z" | null | drop non-mapping parameter record | 1 |
| parameters | "name: tower_count" | null | drop non-mapping parameter record | 1 |
| parameters.change | "" | null | drop value outside controlled vocabulary | 46 |
| parameters.change | "?" | null | drop value outside controlled vocabulary | 6 |
| parameters.change | "TBD" | null | drop value outside controlled vocabulary | 16 |
| parameters.change | "error" | null | drop value outside controlled vocabulary | 1 |
| parameters.change | "moderate (40), subtle (220)" | null | drop value outside controlled vocabulary | 1 |
| parameters.change | "moderate/large" | null | drop value outside controlled vocabulary | 3 |
| parameters.change | "pending" | null | drop value outside controlled vocabulary | 29 |
| parameters.change | "subtle/moderate" | null | drop value outside controlled vocabulary | 1 |
| primitives | "arc" | "shape" | map Processing convenience primitive to shape | 16 |
| primitives | "box" | "shape" | map Processing convenience primitive to shape | 3 |
| primitives | "curve" | null | drop value outside controlled vocabulary | 1 |
| primitives | "quad" | null | drop value outside controlled vocabulary | 1 |
| primitives | "sphere" | null | drop value outside controlled vocabulary | 1 |
| primitives | "triangle" | null | drop value outside controlled vocabulary | 3 |
| reusable_candidates | "{name: lerpPalette, signature: \"lerpPalette(colors[], v, gamma) -> color\", note: \"continuous palette: lerp between adjacent swidth.png" | null | drop non-mapping candidate record | 1 |
| techniques | "noise-driven" | null | drop value outside controlled vocabulary | 1 |
| techniques | "radial" | null | drop value outside controlled vocabulary | 1 |
| techniques | "scattered" | null | remove composition value from technique list | 4 |
| techniques | "voronoi-delaunai" | null | drop value outside controlled vocabulary | 3 |

## Ingestion diagnostics

| severity | code | count | source notes |
|---|---|---|---|
| warning | empty_parameter | 1 | out/2016/Generativos/circlesquads/notes.md |
| warning | frontmatter | 53 | out/2014/Generativos/floresTriangulos/notes.md, out/2015/Generativos/gridsCircles/notes.md, out/2016/Generativos/circlesAndGrids/notes.md, out/2018/Generativos/abstracactact/notes.md, out/2018/Generativos/cells/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/escaleritas/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/fabri/notes.md, out/2018/Generativos/formsbirds/notes.md, out/2018/Generativos/formsbirds/notes.md, out/2018/Generativos/mayo/notes.md, out/2018/Generativos/perla/notes.md, out/2018/Generativos/plasma/notes.md, out/2019/generativos/chanels/notes.md, out/2020/generative/01_04/gradds/notes.md, out/2020/generative/01_04/noide/notes.md, out/2020/generative/01_04/pptt01/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/manchis/notes.md, out/2020/generative/05_08/triste/notes.md |
