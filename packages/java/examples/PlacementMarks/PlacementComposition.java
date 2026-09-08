package org.procedurals.examples.placementmarks;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.sampling.CirclePlacements2D;

/** Editable arrangements motivated by caramelo, candy and studio.
 * The canvas, radius settings and authored radial pattern describe this piece,
 * not library defaults or recommended ranges. See docs/placement-marks.md.
 */
public strictfp final class PlacementComposition {
    private final CirclePlacements2D placements;

    private PlacementComposition(CirclePlacements2D placements) {
        this.placements = placements;
    }

    /** Propose centres in an inset rectangle; reserve radii independently of styling. */
    public static PlacementComposition seeded(long seed, int attempts, double minimum,
                                               double maximum, double separation) {
        return new PlacementComposition(CirclePlacements2D.seeded(map(
            "seed", seed, "attempts", attempts,
            "origin", point(64, 64), "extent", point(512, 512),
            "radiusRange", point(minimum, maximum), "separationScale", separation)));
    }

    /** Replace the proposal source with authored bands, keeping the same exclusion rule.
     * This is a transfer example, not studio's random radial distribution.
     */
    public static PlacementComposition radial(double separation) {
        List<Object> centres = new ArrayList<Object>();
        List<Double> radii = new ArrayList<Double>();
        double[] sizes = {8, 14, 20};
        for (int band = 0; band < 5; band++) {
            double distance = 48 * (band + 1);
            for (int j = 0; j < 32; j++) {
                double angle = 2.0 * Math.PI * j / 32 + band * Math.PI / 32;
                centres.add(point(320 + distance * Math.cos(angle),
                                  320 + distance * Math.sin(angle)));
                radii.add(sizes[(band * 32 + j) % sizes.length]);
            }
        }
        return new PlacementComposition(CirclePlacements2D.filter(map(
            "centres", centres, "radii", radii, "separationScale", separation)));
    }

    public CirclePlacements2D placements() { return placements; }

    /** Rings and inscribed diamonds reuse the exact same retained placement object. */
    public void vertexInto(int circle, int vertex, boolean diamond, double[] out) {
        int vertices = diamond ? 4 : 64;
        if (vertex < 0 || vertex >= vertices) throw new IllegalArgumentException("vertex");
        placements.pointInto(circle, out, 0);
        double radius = placements.radiusAt(circle);
        double angle = 2.0 * Math.PI * vertex / vertices;
        out[0] = out[0] + radius * Math.cos(angle);
        out[1] = out[1] + radius * Math.sin(angle);
    }

    private static List<Double> point(double x, double y) { return Arrays.asList(x, y); }
    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result = new LinkedHashMap<String,Object>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String)pairs[i], pairs[i + 1]);
        return result;
    }
}
