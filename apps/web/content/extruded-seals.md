# Extruded seals

Make a solid seal from a beveled or stepped 2D footprint. The footprint becomes two caps and a ring of walls; a fixed tilted camera shows how changing the outline or extrusion height changes the form. Start by switching **Footprint**, then move the shoulder and step to reshape the contour.

| Control | Canvas effect |
| --- | --- |
| Footprint | Switches between a beveled contour and a contour with a recessed step. |
| Footprint width / Footprint depth | Stretch the source outline across its two axes before extrusion. |
| Corner inset | Cuts or skews corners of the source outline. |
| Step depth | Moves the upper edge of the beveled outline or the depth of the stepped cut. |
| Shoulder width | Moves the upper bevel or widens the horizontal recess of a stepped outline. |
| Extrusion height | Separates the two polygon caps and lengthens the side walls. |
| Camera yaw / Camera pitch | Turn or tilt the view without changing the source mesh. |
| View zoom | Enlarges or shrinks the projection at a fixed scale; the form is not automatically refitted after an edit. |
| Face colour | **Solid-lit** shades one palette color by face direction; **bands** assigns colors by source height; **facets** cycles colors across triangles. |
| Outline weight | Thickens visible form edges in solid-lit mode or triangle edges in the other modes. Zero hides outlines. |
| Palette | Recolors the faces without changing their geometry. |

The study builds its editable polygon in `packages/javascript/examples/materials-b-studies.js` and passes it to `extrudeSimplePolygon3D`. Replace that polygon with another valid simple ring to explore a different silhouette. The mesh layer leaves the Studio background transparent. Exact number fields can extend beyond slider intervals where valid; incompatible footprint dimensions and excessive mesh work are rejected.
