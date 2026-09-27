# Hatched islands

Seed and source controls construct a star-shaped island with zero or more strictly interior, disjoint perforations. The toolkit's region hatcher clips independent line families to that geometry: empty holes and the surrounding canvas remain transparent. Region color is optional and off by default.

| Control | Canvas effect |
| --- | --- |
| Source X and Y / Radius / Aspect / Orientation | Locate, size, squash and rotate the *island itself*, independently of its hatch fields. |
| Vertices / Lobes / Irregularity | Shape the source boundary: many vertices and little irregularity approach a round island; high irregularity and narrow aspect make shards. Seed changes the contour and hole placements. |
| Holes / Hole radius / Hole spread | Request exactly this many interior perforations; impossible packing reports an error rather than quietly omitting holes. Zero holes is valid. |
| Primary spacing / Hatch direction / Hatch phase | Set primary hatch density, angle and scanline displacement without changing source geometry. |
| Second field / Cross spacing / Cross angle / Cross phase | Enable a separately spaced, oriented and shifted lattice on the same source. |
| Line weight / Boundary outline / Region fill | Independently control hatch thickness, perimeter marks and a bounded even-odd fill. Weight zero removes the hatches; turn outline and fill off too for a transparent layer. |

Joint geometry work is bounded before hatching. Each field also has a conservative 6,000-fragment limit based on its extent, spacing and boundary count; oversized combinations report an error instead of truncating the hatches.

Try a **thin perforated shard** at Radius 240, Aspect .2, Irregularity .55, Holes 2, Hole radius 12, Spread 35 and Primary spacing 14. For a **rounded broad lattice**, set Aspect 1, Irregularity .05, Vertices 36, Holes 0, Second field on and Cross angle 90. A **small local fragment** uses Radius 65 and an off-center Source X/Y, with just one hatch field; it does not need an enclosing poster or panel. Hole placement is bounded and the finished region is checked by the core's exact topology rules before hatching.
