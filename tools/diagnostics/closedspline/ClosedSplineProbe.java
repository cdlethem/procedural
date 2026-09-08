package closedspline;

import java.util.Locale;

/**
 * Private, independently authored numerical investigation motivated by
 * survey/out/2018/Generativos/blobs/notes.md and
 * survey/out/2018/Generativos/databol/notes.md.
 * Not a public operation, source replay, or fixture oracle.
 */
public strictfp final class ClosedSplineProbe {
    private static final double[][] POINTS = {{0, 0}, {240, 0}, {250, 20}, {20, 160}};
    private static final int SAMPLES = 256;

    private static double[] at(int span, double t) {
        double[] result = new double[2];
        int n = POINTS.length;
        for (int axis = 0; axis < 2; axis++) {
            double a = POINTS[(span + n - 1) % n][axis];
            double b = POINTS[span][axis];
            double c = POINTS[(span + 1) % n][axis];
            double d = POINTS[(span + 2) % n][axis];
            double t2 = t * t;
            double t3 = t2 * t;
            result[axis] = 0.5 * (2 * b + (-a + c) * t
                    + (2 * a - 5 * b + 4 * c - d) * t2
                    + (-a + 3 * b - 3 * c + d) * t3);
        }
        return result;
    }

    private static double distance(double[] a, double[] b) {
        return StrictMath.hypot(a[0] - b[0], a[1] - b[1]);
    }

    private static final class Table {
        final int subdivisions;
        final double[] chords;
        final double[] spans;
        final double length;

        Table(int subdivisions) {
            this.subdivisions = subdivisions;
            chords = new double[POINTS.length * subdivisions + 1];
            spans = new double[POINTS.length + 1];
            double total = 0;
            int index = 0;
            for (int span = 0; span < POINTS.length; span++) {
                double[] previous = at(span, 0);
                for (int step = 1; step <= subdivisions; step++) {
                    double[] point = at(span, step / (double) subdivisions);
                    total += distance(previous, point);
                    chords[++index] = total;
                    previous = point;
                }
                spans[span + 1] = total;
            }
            length = total;
        }

        double[] sample(double fraction, boolean perChord) {
            // This fixed investigation supplies fractions in [0,1), nonzero chords.
            double d = fraction * length;
            double[] cumulative = perChord ? chords : spans;
            int lo = 0;
            int hi = cumulative.length - 1;
            while (lo + 1 < hi) {
                int mid = (lo + hi) >>> 1;
                if (cumulative[mid] <= d) lo = mid;
                else hi = mid;
            }
            double u = (d - cumulative[lo]) / (cumulative[lo + 1] - cumulative[lo]);
            if (!perChord) return at(lo, u);
            return at(lo / subdivisions, (lo % subdivisions + u) / subdivisions);
        }
    }

    private static void printStats(Table table, boolean perChord) {
        double min = Double.POSITIVE_INFINITY;
        double max = 0;
        double sum = 0;
        double sumSquares = 0;
        double[] previous = table.sample(0, perChord);
        for (int i = 1; i <= SAMPLES; i++) {
            double[] point = table.sample((i % SAMPLES) / (double) SAMPLES, perChord);
            double spacing = distance(previous, point);
            min = Math.min(min, spacing);
            max = Math.max(max, spacing);
            sum += spacing;
            sumSquares += spacing * spacing;
            previous = point;
        }
        double mean = sum / SAMPLES;
        double cv = StrictMath.sqrt(Math.max(0, sumSquares / SAMPLES - mean * mean)) / mean;
        System.out.printf(Locale.ROOT,
                "{\"subdivisions\":%d,\"length\":%.15g,\"spacing_min\":%.15g,"
                + "\"spacing_max\":%.15g,\"spacing_cv\":%.15g}",
                table.subdivisions, table.length, min, max, cv);
    }

    public static void main(String[] args) {
        Table[] tables = {new Table(10), new Table(32), new Table(128), new Table(1024)};
        System.out.print("{\"probe\":\"closed-catmull-rom-distance-mapping\","
                + "\"parameterization\":\"uniform Catmull-Rom\",\"samples\":256,");
        for (int strategy = 0; strategy < 2; strategy++) {
            System.out.print(strategy == 0 ? "\"A\":[" : ",\"B\":[");
            for (int i = 0; i < tables.length; i++) {
                if (i > 0) System.out.print(",");
                printStats(tables[i], strategy == 1);
            }
            System.out.print("]");
        }
        double difference = 0;
        for (int i = 0; i < SAMPLES; i++) {
            double fraction = i / (double) SAMPLES;
            difference = Math.max(difference,
                    distance(tables[1].sample(fraction, true), tables[3].sample(fraction, true)));
        }
        boolean controls = true;
        for (int span = 0; span < POINTS.length; span++) {
            controls &= distance(at(span, 0), POINTS[span]) == 0;
            controls &= distance(at(span, 1), POINTS[(span + 1) % POINTS.length]) == 0;
        }
        boolean seam = distance(at(0, 0), at(POINTS.length - 1, 1)) == 0;
        if (!controls || !seam) throw new AssertionError("fixed-loop interpolation failed");
        System.out.printf(Locale.ROOT,
                ",\"max_position_difference_B32_B1024\":%.15g,"
                + "\"all_control_endpoints\":%s,\"periodic_endpoint_seam\":%s}%n",
                difference, controls, seam);
    }
}
