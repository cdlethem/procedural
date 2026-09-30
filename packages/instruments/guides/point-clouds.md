# Point Clouds

A vase, a figure, a hillside or a galaxy rebuilt from thousands of small marks. The starting study is an amphora sampled by
area into six thousand points; each point becomes a disc lying on the surface at that spot (seen edge-on it thins to a
sliver, facing you it is a full circle), coloured by height along the palette, smaller and paler toward the far side, with
a sparse network of ink links joining a few of the points to their nearest neighbours. Everything is drawn in one
far-to-near sequence, and points on the far side of the vase are hidden exactly where the vase's own surface covers them.
Nothing is a flat picture of a vase: turn the camera and the same points reappear in the right places, with the right
foreshortening.

The points are the subject; the mark is a replaceable choice. The same population can be grains, rings, rosettes, arrows
or strokes along a direction, or discs on the normal, and thinning, a cutaway or a region kept dense change which points
exist without renaming the ones that remain. The library does not reconstruct scans, train splats or recover geometry from
a photograph: the subjects are bundled surfaces sampled by area and two generated clouds.

What changes when:

- **Camera and appearance edits reuse the points.** Yaw, pitch, roll, projection, size, placement, palette, colour, marks,
  sizes, fade, links weight and outline never rebuild the subject, the structure estimates, the thinning or the links.
- **Structural edits rebuild only what they touch**: Points, subject, Neighbors, thinning, dense region, cut, dispersion,
  Link nodes/neighbors/reach.
- **Adding points never moves existing ones**: the first 3,000 points of a 6,000-point subject are exactly the 3,000-point
  subject. Thinning ranks are fixed per point, so the points kept at one value of *Keep* are among those kept at any
  higher value.
- The seed decides where every point falls (and the terrain's relief, the galaxy's arms). A subject fixed in shape (the
  vase, figure, torus) is re-dealt; the terrain, galaxy and noise volume change form.

## Choose the subject and the points

| Controls | What changes on the canvas |
|---|---|
| **Subject** | Vase, faceted figure, terrain, torus (surfaces sampled by area, exactly on the bundled mesh) or spiral galaxy, noise volume (generated). |
| **Vase profile**, **Terrain form** | The vase silhouette (amphora, goblet, bottle, urn) and the terrain height field (hills, ridges, crater, dunes). |
| **Galaxy**: **Arms**, **Twist**, **Bulge**, **Disk thickness**, **Arm looseness** | Spiral arms and how tightly they wind, the share of points in the round bulge, the disk's vertical spread, and how far points stray from an arm. |
| **Volume**: **Noise frequency**, **Noise contrast**, **Noise octaves** | Cloud size, how much of the ball is left empty between filaments, and small-scale roughness. |
| **Points**, **Sampling**, **Neighbors** | How many points; even (no starved regions) or random (chance clumps) sampling of a surface; how many neighbours each point's local estimates use (curvature, crowding, spacing, principal direction). Few neighbours follow detail and noise, many smooth it. |
| **Center X/Y**, **Size** | Where the subject sits and the radius of the sphere enclosing it as a share of half the canvas. Turning the camera never rescales it. |

## Thin, cut and scatter

| Controls | What changes on the canvas |
|---|---|
| **Keep** | The share of points that remain. Removed points are gone from marks and links alike; the same points remain whatever the camera does. |
| **Thin by**, **Rule strength** | Uniform, by crowding (dense places lose points first: an even spread) or by flatness (smooth places lose points first: edges and folds stay). Strength 0 is uniform. |
| **Dense region**: **Ball**, **Region X/Y/Z**, **Region radius**, **Region softness** | One ball of the subject kept at full density however hard the rest is thinned; its edge can fade. The ball is fixed in the subject, not on the screen. |
| **Cut away**, **Cut position**, **Keep the other side** | Removes everything on one side of a plane through the subject, opening it to show the inside. The surface that hides points is cut the same way, so interior points seen through the opening are correctly visible. |
| **Dispersion**, **Along normals** | Moves each point by a fixed random amount of up to this many local spacings: isotropic fuzz, or a shell thickened along the normal. |

## Marks and depth

| Controls | What changes on the canvas |
|---|---|
| **Mark** | Disc on the normal, grain, stroke, arrow, ring, rosette or none (links and outline only). |
| **Mark size**, **Line weight** | Diameter (or length) and line thickness, in canvas units at the subject's centre depth. Scaling them together keeps a mark's proportions. |
| **Petals**, **Opening** | Rosette petals; the open centre of a rosette or ring. |
| **Direction**, **Turn**, **Jitter** | Which way strokes and arrows point in space: around the form, along the local principal direction, down the fall line or along a world axis; then rotated about the normal and jittered. Strokes and arrows are true world segments, so they foreshorten. |
| **Follow spacing**, **Opacity** | Marks grow where the source points are sparse; overall mark strength. |
| **Size by depth**, **Fade by depth** | Near marks larger and far ones smaller and paler than nominal, in either projection. |
| **Paint far to near** | Draw far marks first so near ones cover them; off gives a translucent cloud with no front. |
| **Hide back-facing**, **Hide behind surface** | Drop points whose normal faces away from you (cheap; also drops the far inside wall of an open vessel), or points another part of the source surface covers (exact; keeps that interior wall). The galaxy and noise volume have no surface. |

## Links and outline

| Controls | What changes on the canvas |
|---|---|
| **Links**, **Link nodes**, **Link neighbors**, **Link reach** | A sparse network over the cloud: a share of the points are nodes, each joined to its nearest other nodes when close enough and facing the same way. Links are painted in the same far-to-near sequence as marks, lifted slightly toward you so a link lying on the surface stays above the grains around it. |
| **Link weight**, **Link color** | Line thickness (scaled by depth like marks), and ink or the mean colour of a link's two ends. |
| **Outline**, **Outline material**, **Crease angle**, **Outline weight**, **Hidden lines** | Visible lines of the source surface over the points: its silhouette, or silhouette plus creases and open edges, cut exactly where a triangle covers them, as ink, stitches or beads; covered stretches dropped or drawn as fine stitches. |

## Colour and view

| Controls | What changes on the canvas |
|---|---|
| **Color by**, **Palette use** | Height, depth (near is the last colour), curvature or crowding (ranked, so the whole palette is used), facing, subject part, seeded random or one colour; blended smoothly or snapped to palette entries. |
| **Projection**, **Yaw**, **Pitch**, **Roll**, **Eye distance** | The camera: perspective or orthographic, its position around and above the subject, a turn of the picture, and how close the eye is in bounding radii. |

The layer is transparent: it paints marks and lines only, never a background, so it sits above or below other layers.
An outline or link network alone (mark **None**) is a useful drawing on its own.

## Using it from code

```ts
import { pointSubject, describePointCloud, keepPoints, pointFrame, pointCamera, viewPoints, markSites, stockPointMark,
  drawPointClouds, pointCloudsComposition } from "@procedurals/instruments";
// Ordinary functions, one per stage; drawPointClouds(surface, recipe, { mark: myMark }) replaces a stock consumer.
```

A typed `PointCloud` (positions, unit normals, named attributes) goes through the same stages with `describePointCloud`;
hosts binding a user's own mesh or scan is future work. Limits: at most 40,000 points, 3 to 16 neighbours, 100,000 links
and 250,000 drawn items; an over-limit setting is an error naming the control, never a silent truncation.
