import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Private CP20 feasibility study: independently specified ordered strict-convex
 * polygon filtering. Determinant signs use BigDecimal constructed from the exact
 * binary64 values; this prototype makes no performance or useful-range claim.
 */
public final class ConvexStudy {
    private ConvexStudy() { }

    /** Returns original proposal indices that do not collide with an earlier survivor. */
    public static int[] filter(double[][][] proposals) {
        if (proposals == null) throw new IllegalArgumentException("proposals");
        List<Integer> survivors = new ArrayList<Integer>();
        for (int i = 0; i < proposals.length; i++) {
            double[][] polygon = proposals[i];
            validate(polygon, i);
            boolean collision = false;
            for (int accepted : survivors) {
                if (intersects(polygon, proposals[accepted])) {
                    collision = true;
                    break;
                }
            }
            if (!collision) survivors.add(i);
        }
        int[] result = new int[survivors.size()];
        for (int i = 0; i < result.length; i++) result[i] = survivors.get(i);
        return result;
    }

    private static void validate(double[][] polygon, int index) {
        if (polygon == null || polygon.length < 3) invalid(index);
        for (double[] vertex : polygon) {
            if (vertex == null || vertex.length != 2
                    || !Double.isFinite(vertex[0]) || !Double.isFinite(vertex[1])) invalid(index);
        }
        for (int i = 0; i < polygon.length; i++) {
            for (int j = i + 1; j < polygon.length; j++) {
                if (samePoint(polygon[i], polygon[j])) invalid(index);
            }
        }
        int orientation = 0;
        for (int i = 0; i < polygon.length; i++) {
            int sign = sign(turn(polygon[i], polygon[(i + 1) % polygon.length],
                    polygon[(i + 2) % polygon.length]));
            if (sign == 0) invalid(index);
            if (orientation == 0) orientation = sign;
            else if (orientation != sign) invalid(index);
        }
        // Every nonincident vertex must lie strictly on the interior side of every edge.
        for (int edge = 0; edge < polygon.length; edge++) {
            double[] a = polygon[edge];
            double[] b = polygon[(edge + 1) % polygon.length];
            for (int vertex = 0; vertex < polygon.length; vertex++) {
                if (vertex == edge || vertex == (edge + 1) % polygon.length) continue;
                int side = sign(turn(a, b, polygon[vertex]));
                if (side != orientation) invalid(index);
            }
        }
    }

    private static void invalid(int index) {
        throw new IllegalArgumentException("invalid polygon at index " + index);
    }

    private static boolean intersects(double[][] a, double[][] b) {
        if (!aabbOverlap(a, b)) return false;
        for (int i = 0; i < a.length; i++) {
            double[] a0 = a[i], a1 = a[(i + 1) % a.length];
            for (int j = 0; j < b.length; j++) {
                if (segmentsIntersect(a0, a1, b[j], b[(j + 1) % b.length])) return true;
            }
        }
        return contains(a, b[0]) || contains(b, a[0]);
    }

    private static boolean contains(double[][] polygon, double[] point) {
        int orientation = sign(turn(polygon[0], polygon[1], polygon[2]));
        for (int i = 0; i < polygon.length; i++) {
            if (sign(turn(polygon[i], polygon[(i + 1) % polygon.length], point)) != orientation) {
                return false;
            }
        }
        return true;
    }

    private static boolean segmentsIntersect(double[] a, double[] b, double[] c, double[] d) {
        int abC = sign(turn(a, b, c));
        int abD = sign(turn(a, b, d));
        int cdA = sign(turn(c, d, a));
        int cdB = sign(turn(c, d, b));
        return (abC == 0 && inBox(a, b, c)) || (abD == 0 && inBox(a, b, d))
                || (cdA == 0 && inBox(c, d, a)) || (cdB == 0 && inBox(c, d, b))
                || (abC * abD < 0 && cdA * cdB < 0);
    }

    private static boolean inBox(double[] a, double[] b, double[] p) {
        return p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
                && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
    }

    private static boolean aabbOverlap(double[][] a, double[][] b) {
        double aminX = a[0][0], amaxX = a[0][0], aminY = a[0][1], amaxY = a[0][1];
        double bminX = b[0][0], bmaxX = b[0][0], bminY = b[0][1], bmaxY = b[0][1];
        for (double[] p : a) { aminX = Math.min(aminX, p[0]); amaxX = Math.max(amaxX, p[0]); aminY = Math.min(aminY, p[1]); amaxY = Math.max(amaxY, p[1]); }
        for (double[] p : b) { bminX = Math.min(bminX, p[0]); bmaxX = Math.max(bmaxX, p[0]); bminY = Math.min(bminY, p[1]); bmaxY = Math.max(bmaxY, p[1]); }
        return amaxX >= bminX && bmaxX >= aminX && amaxY >= bminY && bmaxY >= aminY;
    }

    private static boolean samePoint(double[] a, double[] b) {
        return a[0] == b[0] && a[1] == b[1];
    }

    private static BigDecimal turn(double[] a, double[] b, double[] c) {
        BigDecimal abX = exact(b[0]).subtract(exact(a[0]));
        BigDecimal abY = exact(b[1]).subtract(exact(a[1]));
        BigDecimal acX = exact(c[0]).subtract(exact(a[0]));
        BigDecimal acY = exact(c[1]).subtract(exact(a[1]));
        return abX.multiply(acY).subtract(abY.multiply(acX));
    }

    private static BigDecimal exact(double value) { return new BigDecimal(value); }
    private static int sign(BigDecimal value) { return value.signum(); }

    private static void check(boolean ok, String message) {
        if (!ok) throw new AssertionError(message);
    }

    private static void testCases() {
        double[][] small = {{0, 0}, {2, 0}, {2, 2}, {0, 2}};
        double[][] big = {{-1, -1}, {3, -1}, {3, 3}, {-1, 3}};
        check(Arrays.equals(filter(new double[][][] {small, big}), new int[] {0}), "small before big");
        check(Arrays.equals(filter(new double[][][] {big, small}), new int[] {0}), "big before small");
        double[][] reverse = {{0, 0}, {0, 2}, {2, 2}, {2, 0}};
        check(Arrays.equals(filter(new double[][][] {reverse}), new int[] {0}), "reverse winding");
        double[][] touch = {{2, 0}, {4, 0}, {4, 2}, {2, 2}};
        check(filter(new double[][][] {small, touch}).length == 1, "shared edge touch");
        double[][] vertexTouch = {{2, 2}, {4, 2}, {4, 4}};
        check(filter(new double[][][] {small, vertexTouch}).length == 1, "shared vertex touch");
        double[][] separate = {{5, 5}, {7, 5}, {7, 7}, {5, 7}};
        check(Arrays.equals(filter(new double[][][] {small, separate}), new int[] {0, 1}), "separate");
        double[][] thinA = {{0, 0}, {10, 0}, {10, 0.1}, {0, 0.1}};
        double[][] thinB = {{4, -1}, {6, -1}, {6, 1}, {4, 1}};
        check(filter(new double[][][] {thinA, thinB}).length == 1, "crossing thin rectangles");
        expectInvalid(new double[][][] {{{0, 0}, {2, 2}, {0, 2}, {2, 0}}}, "bowtie");
        expectInvalid(new double[][][] {{{0, 0}, {2, 0}, {4, 0}, {0, 2}}}, "collinear");
        expectInvalid(new double[][][] {{{0, 0}, {1, 0}, {0, 1}, {0, 0}}}, "repeated");
        check(filter(new double[][][] {{{-0.0, 0}, {1, 0}, {0, 1}}}).length == 1, "signed zero");
        check(filter(new double[][][] {{{1e150, 1e150}, {1e150 + 1e135, 1e150}, {1e150, 1e150 + 1e135}}}).length == 1, "large coordinates");
        double tiny=Double.MIN_VALUE, huge=Double.MAX_VALUE;
        check(filter(new double[][][] {{{0,0},{tiny,0},{0,tiny}}}).length==1, "subnormal exact determinant");
        check(filter(new double[][][] {{{-huge,0},{huge,0},{0,huge}}}).length==1, "overflowing double differences");
        expectInvalid(new double[][][] {small, {{0,0},{Double.NaN,0},{0,1}}}, "nonfinite later polygon");
        expectInvalid(new double[][][] {{{0, 3}, {1.76, -2.43}, {-2.85, 0.93}, {2.85, 0.93}, {-1.76, -2.43}}}, "pentagram");
    }

    private static void expectInvalid(double[][][] proposals, String message) {
        try {
            filter(proposals);
            throw new AssertionError(message + " accepted");
        } catch (IllegalArgumentException expected) {
            check(expected.getMessage().contains("index"), message + " index");
        }
    }

    private static String workload(int proposals, int vertices, boolean overlap) {
        double[][][] input = new double[proposals][vertices][2];
        for (int i = 0; i < proposals; i++) {
            double cx = overlap ? 0.0 : (i % 50) * 30.0;
            double cy = overlap ? 0.0 : (i / 50) * 30.0;
            for (int j = 0; j < vertices; j++) {
                double angle = 2.0 * Math.PI * j / vertices;
                input[i][j][0] = cx + 8.0 * Math.cos(angle);
                input[i][j][1] = cy + 8.0 * Math.sin(angle);
            }
        }
        long start = System.nanoTime();
        int[] result = filter(input);
        check(result.length==(overlap ? 1 : proposals), "workload survivor count");
        return "{\"proposals\":" + proposals + ",\"vertices\":" + vertices
                + ",\"overlap\":" + overlap
                + ",\"survivors\":" + result.length + ",\"elapsed_ns\":"
                + (System.nanoTime() - start) + "}";
    }

    public static void main(String[] args) {
        testCases();
        System.out.println("{\"status\":\"passed\",\"workloads\":["
                + workload(500, 4, false) + "," + workload(500, 12, false)
                + "," + workload(500, 12, true) + "]}");
    }
}
