---
sketch: 2020/generative/01_04/pptt01
year: 2020
renderer: P2D
size: [960, 960]
libraries: [toxi, triangulate]
deterministic: true
ms_first_frame: 1489
animated: false
techniques: [grid, distortion]
primitives: [shape]
palette:
  colors: ["#F3B2DB", "#518DB2", "#02B59E", "#DCE404", "#82023B"]
  selection: lerp-between
composition: full-bleed
parameters: []
reusable_candidates:
  - {name: wavyStripes, signature: "wavyStripes(cols, oscX, oscY, amp, palette) -> void", note: "vertical quad strips whose x is displaced by cos(y) and y by sin(x) with full-period counts oscX/oscY"}
  - {name: lerpPalette, signature: "lerpPalette(colors[], v, gamma) -> color", note: "continuous palette: lerp between adjacent swidth.png