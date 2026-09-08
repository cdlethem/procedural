package org.procedurals.sampling;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Immutable greedy placements of supplied strictly convex polygon proposals.
 * Motivated by survey/out/2017/Generativos/celular/notes.md and
 * survey/out/2017/Generativos/celular2/notes.md. Independently specified symmetric
 * containment/contact semantics intentionally differ from source collision defects.
 * Contract: sampling.ordered-convex-polygon-filter-2d 0.1.0. Caller polygon units,
 * no defaults or measured recommended coordinate/vertex-count ranges; the CP20
 * aspect-ratio studies are example shape construction, not library parameters.
 */
public final strictfp class ConvexPolygonPlacements2D {
    private static final long MAX_PROPOSALS = 357913941L;
    private static final long MAX_VERTICES = 1073741823L;
    private final Polygon[] polygons;
    private final int[] sourceIndices;
    private final int attempts;

    /** Stable failure with a proposal index, or -1 for top-level/access errors.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public static final class PlacementException extends IllegalArgumentException {
        public final String code;
        public final int candidateIndex;
        private PlacementException(String code, int index) { super(code); this.code = code; candidateIndex = index; }
    }

    private ConvexPolygonPlacements2D(Polygon[] polygons, int[] sourceIndices, int attempts) {
        this.polygons = polygons; this.sourceIndices = sourceIndices; this.attempts = attempts;
    }

    /** Filters an exact object descriptor containing only a List under {@code polygons}.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public static ConvexPolygonPlacements2D filter(Object input) {
        if (!(input instanceof Map)) invalidInput(-1);
        Map<?, ?> map = (Map<?, ?>) input;
        if (map.size() != 1 || !map.containsKey("polygons") || !(map.get("polygons") instanceof List)) invalidInput(-1);
        List<?> rows = (List<?>) map.get("polygons");
        if (rows.size() > MAX_PROPOSALS) invalidInput(-1);
        Polygon[] validated = new Polygon[rows.size()];
        long total = 0;
        for (int i = 0; i < rows.size(); i++) {
            Object row = rows.get(i);
            if (!(row instanceof List)) invalidInput(i);
            List<?> vertices = (List<?>) row;
            if (vertices.size() < 3) invalidInput(i);
            total += vertices.size();
            if (total > MAX_VERTICES) invalidInput(i);
            double[][] copy = new double[vertices.size()][2];
            for (int j = 0; j < vertices.size(); j++) {
                Object vertex = vertices.get(j);
                if (!(vertex instanceof List) || ((List<?>) vertex).size() != 2) invalidInput(i);
                List<?> pair = (List<?>) vertex;
                copy[j][0] = number(pair.get(0), i);
                copy[j][1] = number(pair.get(1), i);
            }
            validated[i] = validate(copy, i);
        }
        return build(validated, rows.size());
    }

    /** Filters typed polygon cycles, copying all coordinates before geometric filtering.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public static ConvexPolygonPlacements2D filter(double[][][] input) {
        if (input == null || input.length > MAX_PROPOSALS) invalidInput(-1);
        Polygon[] validated = new Polygon[input.length];
        long total = 0;
        for (int i = 0; i < input.length; i++) {
            double[][] row = input[i];
            if (row == null || row.length < 3) invalidInput(i);
            total += row.length;
            if (total > MAX_VERTICES) invalidInput(i);
            double[][] copy = new double[row.length][2];
            for (int j = 0; j < row.length; j++) {
                if (row[j] == null || row[j].length != 2) invalidInput(i);
                copy[j][0] = finite(row[j][0], i); copy[j][1] = finite(row[j][1], i);
            }
            validated[i] = validate(copy, i);
        }
        return build(validated, input.length);
    }

    private static ConvexPolygonPlacements2D build(Polygon[] candidates, int attempts) {
        ArrayList<Polygon> kept = new ArrayList<Polygon>();
        ArrayList<Integer> indices = new ArrayList<Integer>();
        for (int i = 0; i < candidates.length; i++) {
            boolean collision = false;
            for (int j = 0; j < kept.size(); j++)
                if (intersects(candidates[i], kept.get(j))) { collision = true; break; }
            if (!collision) { kept.add(candidates[i]); indices.add(i); }
        }
        Polygon[] result = kept.toArray(new Polygon[kept.size()]);
        int[] source = new int[indices.size()];
        for (int i = 0; i < source.length; i++) source[i] = indices.get(i);
        return new ConvexPolygonPlacements2D(result, source, attempts);
    }

    /** Returns the number of proposals examined.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public int attempts() { return attempts; }
    /** Returns the number of retained polygons.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public int size() { return polygons.length; }
    /** Returns an original proposal index.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public int sourceIndexAt(long index) { return sourceIndices[index(index)]; }
    /** Returns a retained polygon's vertex count.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public int vertexCountAt(long index) { return polygons[index(index)].x.length; }
    /** Returns a detached normalized x coordinate.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public double xAt(long polygonIndex, long vertexIndex) { Polygon p = polygons[index(polygonIndex)]; return p.x[vertex(p, vertexIndex)]; }
    /** Returns a detached normalized y coordinate.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public double yAt(long polygonIndex, long vertexIndex) { Polygon p = polygons[index(polygonIndex)]; return p.y[vertex(p, vertexIndex)]; }

    /** Materializes a fresh mutable descriptor containing only retained proposals.
     * Motivation: survey/out/2017/Generativos/celular/notes.md; no recommended coordinate range.
     */
    public Map<String, Object> toValues() {
        List<Object> rows = new ArrayList<Object>(polygons.length);
        for (Polygon p : polygons) {
            List<Object> vertices = new ArrayList<Object>(p.x.length);
            for (int i = 0; i < p.x.length; i++) {
                List<Object> pair = new ArrayList<Object>(2);
                pair.add(p.x[i]); pair.add(p.y[i]); vertices.add(pair);
            }
            rows.add(vertices);
        }
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        result.put("attempts", attempts); result.put("polygons", rows);
        List<Object> indices = new ArrayList<Object>(sourceIndices.length);
        for (int source : sourceIndices) indices.add(source);
        result.put("sourceIndices", indices);
        return result;
    }

    private int index(long value) {
        if (value < 0 || value > Integer.MAX_VALUE) throw new PlacementException("INDEX_OUT_OF_RANGE", -1);
        int result = (int) value;
        if (result >= polygons.length) throw new PlacementException("INDEX_OUT_OF_RANGE", -1);
        return result;
    }
    private int vertex(Polygon p, long value) {
        if (value < 0 || value >= p.x.length) throw new PlacementException("INDEX_OUT_OF_RANGE", -1);
        return (int) value;
    }

    private static Polygon validate(double[][] points, int source) {
        int n = points.length;
        for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++)
            if (points[i][0] == points[j][0] && points[i][1] == points[j][1]) invalidPolygon(source);
        int orientation = 0;
        for (int i = 0; i < n; i++) {
            int sign = orient(points[i], points[(i + 1) % n], points[(i + 2) % n]);
            if (sign == 0) invalidPolygon(source);
            if (orientation == 0) orientation = sign; else if (orientation != sign) invalidPolygon(source);
        }
        for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) {
            if (j == i || j == (i + 1) % n) continue;
            if (orient(points[i], points[(i + 1) % n], points[j]) != orientation) invalidPolygon(source);
        }
        double[] x = new double[n], y = new double[n];
        for (int i = 0; i < n; i++) { x[i] = zero(points[i][0]); y[i] = zero(points[i][1]); }
        return new Polygon(x, y);
    }

    private static boolean intersects(Polygon a, Polygon b) {
        if (a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY) return false;
        for (int i = 0; i < a.x.length; i++) for (int j = 0; j < b.x.length; j++)
            if (segments(a.x[i], a.y[i], a.x[(i + 1) % a.x.length], a.y[(i + 1) % a.x.length], b.x[j], b.y[j], b.x[(j + 1) % b.x.length], b.y[(j + 1) % b.x.length])) return true;
        return contains(a, b.x[0], b.y[0]) || contains(b, a.x[0], a.y[0]);
    }
    private static boolean contains(Polygon p, double x, double y) {
        int direction = orient(p.x[0], p.y[0], p.x[1], p.y[1], p.x[2], p.y[2]);
        for (int i = 0; i < p.x.length; i++) if (orient(p.x[i], p.y[i], p.x[(i + 1) % p.x.length], p.y[(i + 1) % p.x.length], x, y) != direction) return false;
        return true;
    }
    private static boolean segments(double ax, double ay, double bx, double by, double cx, double cy, double dx, double dy) {
        int abC = orient(ax, ay, bx, by, cx, cy), abD = orient(ax, ay, bx, by, dx, dy);
        int cdA = orient(cx, cy, dx, dy, ax, ay), cdB = orient(cx, cy, dx, dy, bx, by);
        if (abC == 0 && box(ax, ay, bx, by, cx, cy) || abD == 0 && box(ax, ay, bx, by, dx, dy)
                || cdA == 0 && box(cx, cy, dx, dy, ax, ay) || cdB == 0 && box(cx, cy, dx, dy, bx, by)) return true;
        return abC * abD < 0 && cdA * cdB < 0;
    }
    private static boolean box(double ax, double ay, double bx, double by, double x, double y) { return x >= Math.min(ax, bx) && x <= Math.max(ax, bx) && y >= Math.min(ay, by) && y <= Math.max(ay, by); }

    private static int orient(double[] a, double[] b, double[] c) { return orient(a[0], a[1], b[0], b[1], c[0], c[1]); }
    // Reuses the project-owned Delaunay interval filter/dyadic mechanism privately.
    // The accepted triangulator is unchanged; uncertain signs are never guessed.
    private static int orient(double ax, double ay, double bx, double by, double cx, double cy) {
        int filtered = orientationFilter(ax, ay, bx, by, cx, cy);
        if (filtered != 0) return filtered;
        D x1 = D.of(bx).subtract(D.of(ax)), y1 = D.of(by).subtract(D.of(ay));
        D x2 = D.of(cx).subtract(D.of(ax)), y2 = D.of(cy).subtract(D.of(ay));
        return x1.multiply(y2).subtract(y1.multiply(x2)).sign();
    }

    private static double productLower(double al, double ah, double bl, double bh) {
        return Math.nextDown(Math.min(Math.min(al * bl, al * bh), Math.min(ah * bl, ah * bh)));
    }

    private static double productUpper(double al, double ah, double bl, double bh) {
        return Math.nextUp(Math.max(Math.max(al * bl, al * bh), Math.max(ah * bl, ah * bh)));
    }

    /** Returns zero for an uncertified sign, which must use the exact dyadic fallback. */
    private static int orientationFilter(double ax, double ay, double bx, double by, double cx, double cy) {
        double x1 = bx - ax, y1 = by - ay, x2 = cx - ax, y2 = cy - ay;
        if (!Double.isFinite(x1) || !Double.isFinite(y1) || !Double.isFinite(x2) || !Double.isFinite(y2)) return 0;
        double xl1 = Math.nextDown(x1), xh1 = Math.nextUp(x1);
        double yl1 = Math.nextDown(y1), yh1 = Math.nextUp(y1);
        double xl2 = Math.nextDown(x2), xh2 = Math.nextUp(x2);
        double yl2 = Math.nextDown(y2), yh2 = Math.nextUp(y2);
        if (!Double.isFinite(xl1) || !Double.isFinite(xh1) || !Double.isFinite(yl1) || !Double.isFinite(yh1)
                || !Double.isFinite(xl2) || !Double.isFinite(xh2) || !Double.isFinite(yl2) || !Double.isFinite(yh2)) return 0;
        double leftLow = productLower(xl1, xh1, yl2, yh2), leftHigh = productUpper(xl1, xh1, yl2, yh2);
        double rightLow = productLower(yl1, yh1, xl2, xh2), rightHigh = productUpper(yl1, yh1, xl2, xh2);
        if (!Double.isFinite(leftLow) || !Double.isFinite(leftHigh) || !Double.isFinite(rightLow) || !Double.isFinite(rightHigh)) return 0;
        double lower = Math.nextDown(leftLow - rightHigh), upper = Math.nextUp(leftHigh - rightLow);
        if (!Double.isFinite(lower) || !Double.isFinite(upper)) return 0;
        return lower > 0 ? 1 : upper < 0 ? -1 : 0;
    }

    private static final class D {
        final BigInteger n;
        final int e;

        D(BigInteger n, int e) { this.n = n; this.e = e; }

        static D of(double value) {
            long raw = Double.doubleToLongBits(value);
            boolean negative = raw < 0;
            int exponent = (int) ((raw >>> 52) & 0x7ffL);
            long mantissa = raw & 0xfffffffffffffL;
            if (exponent == 0 && mantissa == 0) return new D(BigInteger.ZERO, 0);
            if (exponent == 0) return new D(BigInteger.valueOf(negative ? -mantissa : mantissa), -1074);
            long significand = (1L << 52) | mantissa;
            return new D(BigInteger.valueOf(negative ? -significand : significand), exponent - 1075);
        }

        D subtract(D other) {
            if (other.n.signum() == 0) return this;
            int base = e < other.e ? e : other.e;
            return new D(n.shiftLeft(e - base).subtract(other.n.shiftLeft(other.e - base)), base);
        }

        D multiply(D other) { return new D(n.multiply(other.n), e + other.e); }
        int sign() { return n.signum(); }
    }
    private static double number(Object raw, int index) { if (!(raw instanceof Byte || raw instanceof Short || raw instanceof Integer || raw instanceof Long || raw instanceof Float || raw instanceof Double)) invalidInput(index); return finite(((Number) raw).doubleValue(), index); }
    private static double finite(double value, int index) { if (!Double.isFinite(value)) invalidInput(index); return zero(value); }
    private static double zero(double value) { return value == 0.0 ? 0.0 : value; }
    private static void invalidInput(int index) { throw new PlacementException("INVALID_INPUT", index); }
    private static void invalidPolygon(int index) { throw new PlacementException("INVALID_POLYGON", index); }

    private static final class Polygon {
        final double[] x, y; final double minX, maxX, minY, maxY;
        Polygon(double[] x, double[] y) { this.x = x; this.y = y; double lx=x[0], ux=x[0], ly=y[0], uy=y[0]; for(int i=1;i<x.length;i++){lx=Math.min(lx,x[i]);ux=Math.max(ux,x[i]);ly=Math.min(ly,y[i]);uy=Math.max(uy,y[i]);} minX=lx;maxX=ux;minY=ly;maxY=uy; }
    }
}
