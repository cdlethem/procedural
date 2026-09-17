# Lit mesh surfaces with controlled seams

`prepareSurfaceAttributes3D` turns your indexed triangles into a mesh whose normals and UV seams are explicit. Use it when a shape needs a smooth side, a hard cap, or an image whose corners stay pinned to chosen triangles. The [surface attribute vessel](../packages/javascript/examples/surface-attribute-vessel/) shows all three, then applies the same operation to a ribbon with different positions and UVs.

Supply source positions and triangle indices in a right-handed local coordinate system. Each triangle's vertex order sets its outward normal. Choose `normalMode: "smooth"` for equal-weight averaging across faces that share a source index and smoothing-group number, or `"flat"` for one normal per face. Give adjacent faces different group numbers for a hard edge. Supply three UV pairs per triangle; `u` runs left to right and `v` top to bottom on an upright image. Repeating a source position with two UV pairs makes a seam without breaking its smooth normal.

```js
import { prepareSurfaceAttributes3D } from "./src/prepare-surface-attributes-3d.js";

const mesh = prepareSurfaceAttributes3D({
  positions: [[0, 0, 0], [2, 0, 0], [0, 2, 0]],
  triangles: [[0, 1, 2]],
  normalMode: "flat",
  smoothingGroups: [0],
  cornerUVs: [[[0, 0], [1, 0], [0, 1]]],
  maxVertices: 3,
  maxWork: 30
});
// mesh.positions, mesh.triangles, mesh.normals, mesh.uvs,
// mesh.sourceVertexIndices are detached arrays.
```

| Choice | Canvas effect |
| --- | --- |
| Move a source position | Reshapes every face that references it. |
| Reverse a triangle's indices | Reverses its outward normal and visible facing. |
| Switch flat/smooth | Changes faceting without changing source geometry. |
| Split a smoothing group | Creates a crisp lighting edge, such as a cap rim. |
| Change one corner UV | Moves the image on that triangle; a new seam vertex may appear. |
| Replace the image | Changes color while retaining mesh and UV coordinates. |

The output omits unused source positions. In smooth mode, vertices can still be duplicated where a UV seam or group boundary requires it. `maxVertices` reserves the worst case of three vertices per triangle, and `maxWork` reserves `V + 27F`; increase these deliberately for larger meshes. Degenerate faces, represented arithmetic collapse, and overflow have separate stable error codes in the [operation contract](../catalog/operations/prepare-surface-attributes-3d.json).

The study copies the output into a private p5 Geometry, uses its supplied vertex normals and normalized UVs, and frees the previous GPU geometry whenever the shape or UV data changes. It uses a fixed oblique camera and two lights, so you can inspect shape and seam edits without camera motion. The p5 WebGL context-loss path requires a page reload.
