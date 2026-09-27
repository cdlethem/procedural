# Scatter envelopes

Independent seeded point populations determine actual convex hulls. Change site geometry without shrinking a completed page-sized composition; each group's hull is computed from that group's own sites. Source dots, transparent fill and outline are separate treatments, all without a forced background or frame.

| Control | Visible effect |
| --- | --- |
| Sites, Groups | Total sites shared among distinct populations, at least three per group. |
| Population support | Uniform elliptical area, annulus with adjustable Ring opening, or an elongated line swath. |
| Population radius, Crosswise aspect | Longitudinal reach and transverse ratio of each local population. |
| Center X/Y, Direction | Actual placement and orientation of the populations. |
| Group spread | Seeded group-center displacement; one group remains exactly centered. |
| Source dots, Source dot size | Independently show source sites; the old Inset control remains available as dot diameter. |
| Fill hulls, Outline hulls, Outline weight | Independently fill and outline convex silhouettes. |

**Small three-site silhouette:** Sites 3, Groups 1, Population radius 55, Crosswise aspect .65, Center X/Y 245/330, Population support area, Source dots off, Fill hulls on.

**Long envelope:** Sites 45, Groups 1, Population support line, Population radius 260, Crosswise aspect .12, Direction -25, Outline hulls on, Source dots on, Source dot size 4.

**Several local groups:** Sites 36, Groups 4, Group spread 190, Population radius 55, Crosswise aspect .8, Population support ring, Ring opening .7, Center X/Y 360/360. Try dots off and translucent fill on to compare silhouettes.

The perimeter uses `geometry.convex-hull-2d` on each seeded source population. Site × group work is checked before generation; palette and mark toggles leave the sites unchanged.
