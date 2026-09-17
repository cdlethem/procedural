# Twisting streamers

Bend a strip through repeated vertical and depth turns to make a folding streamer. The two bend rhythms are independent: changing one can open a loop, tighten a turn, or make the strip cross its own projection without changing its width treatment.

| Control | Canvas effect |
| --- | --- |
| Path samples | Controls how many points describe the centerline and how angular its turns appear. |
| Vertical bend / Vertical cycles | Change the height and rhythm of rises and falls. Reversing a cycle value reverses that axis's progression. |
| Depth bend / Depth cycles | Change the independent toward-camera bend and its rhythm. |
| Start width / End width | Taper the strip from one end to the other. |
| Middle width pulse | Makes the middle broader or narrower than the straight end-to-end width interpolation. |
| Camera yaw / Camera pitch | Rotate the view to separate bends that overlap in projection. |
| View zoom | Enlarges the projection without automatically fitting a longer or wider shape. |
| Face colour | Show lit single-color faces, height-based palette bands, or colored individual triangles. |
| Outline weight | Controls form folds in solid-lit mode and triangle edges in other modes; zero removes the outlines. |
| Palette | Changes color treatment without moving the streamer. |

The editable path and width profile are generated in `packages/javascript/examples/materials-b-studies.js`; `parallelTransportRibbon3D` turns them into strip triangles. Replace those source points and widths with another valid open path to make a different streamer. The drawing has no opaque background, and work is bounded as sample count grows.
