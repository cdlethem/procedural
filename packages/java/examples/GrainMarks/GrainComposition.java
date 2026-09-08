package org.procedurals.examples.grainmarks;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.layout.QuadrantPartition2D;
import org.procedurals.sampling.TrianglePoints2D;

/**
 * Editable grain composition motivated by survey/out/2018/Generativos/puntis/notes.md
 * and puntis3/notes.md; the source audit corrects their distribution descriptions.
 * Triangle construction, density and biased coordinate expressions belong to this
 * example, not to the sampling API. No continuous recommended density range is claimed.
 */
public strictfp final class GrainComposition {
    private final List<TrianglePoints2D> regions;
    private final int total;

    private GrainComposition(List<TrianglePoints2D> regions, int total) {
        this.regions = regions;
        this.total = total;
    }

    /** Build one supplied triangle or transfer grain to thirteen CP4 cells.
     * Distribution 0 uses the public seeded uniform batch. Example choices 1 and 2
     * materialize biased pairs and call the same public explicit mapping operation.
     */
    public static GrainComposition create(long seed, double density, int distribution, boolean cells) {
        if (seed < 0 || seed > 0xffffffffL || !Double.isFinite(density) || density < 0
                || distribution < 0 || distribution > 2)
            throw new IllegalArgumentException("invalid example configuration");
        List<List<List<Double>>> triangles = new ArrayList<List<List<Double>>>();
        if (!cells) {
            triangles.add(triangle(40, 600, 320, 40, 600, 600));
        } else {
            QuadrantPartition2D layout = QuadrantPartition2D.generate(record(
                "seed", seed, "replacements", 4, "selectionFraction", 0.5d,
                "origin", pair(0, 0), "extent", pair(640, 640)));
            double[] bounds = new double[4];
            for (int i = 0; i < layout.size(); i++) {
                layout.boundsInto(i, bounds, 0);
                double l = bounds[0], t = bounds[1], r = bounds[2], b = bounds[3];
                triangles.add(triangle(l, t, r, t, r, b));
                triangles.add(triangle(l, t, r, b, l, b));
            }
        }

        // Preflight the entire example budget before producing retained geometry.
        // This fixed canvas calculation is not a general robust triangle-area API.
        int[] counts = new int[triangles.size()];
        int total = 0;
        for (int i = 0; i < triangles.size(); i++) {
            List<List<Double>> tri = triangles.get(i);
            double ax = tri.get(0).get(0), ay = tri.get(0).get(1);
            double bx = tri.get(1).get(0), by = tri.get(1).get(1);
            double cx = tri.get(2).get(0), cy = tri.get(2).get(1);
            double area = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) * 0.5d;
            double count = Math.ceil(area * density);
            if (!Double.isFinite(count) || count > 160000 - total)
                throw new IllegalArgumentException("example exceeds 160000-point work budget");
            counts[i] = (int) count;
            total += counts[i];
        }
        List<TrianglePoints2D> points = new ArrayList<TrianglePoints2D>();
        for (int i = 0; i < triangles.size(); i++) {
            long regionSeed = (seed + i) & 0xffffffffL;
            if (distribution == 0) {
                points.add(TrianglePoints2D.seeded(record("seed", regionSeed,
                    "count", counts[i], "triangle", triangles.get(i))));
            } else {
                // Java-only caller randomness, deliberately separate from public xoshiro.
                // These expressions illustrate source-motivated concentration, not source replay.
                Random random = new Random(regionSeed);
                List<List<Double>> units = new ArrayList<List<Double>>(counts[i]);
                for (int p = 0; p < counts[i]; p++) {
                    double u, v;
                    if (distribution == 1) {
                        u = random.nextDouble() * random.nextDouble();
                        v = random.nextDouble();
                    } else {
                        int side = random.nextDouble() < 0.5d ? 0 : 1;
                        double lower = side * 0.8d;
                        v = (lower + (1.0d - lower) * random.nextDouble())
                            * (0.4d + 0.6d * random.nextDouble());
                        u = random.nextDouble();
                    }
                    units.add(pair(u, v));
                }
                points.add(TrianglePoints2D.map(record("triangle", triangles.get(i),
                    "unitCoordinates", units)));
            }
        }
        return new GrainComposition(points, total);
    }

    public int size() { return regions.size(); }
    public int totalPoints() { return total; }
    public TrianglePoints2D regionAt(int index) { return regions.get(index); }

    private static List<Double> pair(double x, double y) { return Arrays.asList(x, y); }
    private static List<List<Double>> triangle(double ax, double ay, double bx, double by, double cx, double cy) {
        return Arrays.asList(pair(ax, ay), pair(bx, by), pair(cx, cy));
    }
    private static Map<String, Object> record(Object... fields) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int i = 0; i < fields.length; i += 2) result.put((String) fields[i], fields[i + 1]);
        return result;
    }
}
