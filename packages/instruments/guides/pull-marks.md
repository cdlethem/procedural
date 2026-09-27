# Pull paths around editable centers

Start with horizontal rows, vertical columns, or radial spokes; then deform those source paths toward one or two radial influences. The undeformed path arrangement and the pull centers are separate controls, so the same radial field can act on several different source families. Only the paths paint: there is no automatic panel or boundary.

| Control | Canvas effect |
| --- | --- |
| Source paths / Paths | Choose rows, columns or spokes and their path count before deformation. |
| Source jitter | Seeded displacement perpendicular to the source path; zero keeps starts ordered. |
| Influences | Use the first pull alone or both influences in one field. |
| First/second center X/Y | Place each influence independently in 640-unit canvas coordinates. |
| First/second radius and falloff | Set each pull's reach and shape of its decay. The second group matters only with two influences. |
| Stroke weight / Palette | Change the ink without moving the deformed paths. |

Try rows with the first pull near an edge to bend a compact fan; add the second pull on the opposite side for a pinched S-like field. Switch to spokes while leaving the influence centers in place to compare the response of a different source. Set Jitter to zero before editing falloff so deformation is easier to read. Positive source jitter uses the explicit seed; palette-only edits do not rebuild the source. The instrument uses the released radial-pull operation; the paths and painting are instrument construction, not another core operation.
