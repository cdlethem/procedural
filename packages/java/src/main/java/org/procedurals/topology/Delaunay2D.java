package org.procedurals.topology;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Retained exact planar topology for {@code topology.delaunay-2d} 0.1.0.
 *
 * <p>This independently specified operation is motivated by
 * {@code survey/out/2018/Generativos/datata/notes.md} and
 * {@code survey/out/2019/generativos/lightcity/notes.md}. It does not copy either
 * source triangulator or reproduce source sampling, mutable geometry, rendering,
 * palette, camera, clipping, or source floating-point tie behavior. Those observations
 * do not establish artistic defaults, ranges, or a renderer contract.</p>
 */
public final strictfp class Delaunay2D {
    private static final int MAX_POINTS = 357913943;
    private static final long MAX_SAFE_INTEGER = 9007199254740991L;
    private static final String[] KEYS = {"points", "maxWork"};

    /** Static validation or access failure with a stable catalog error {@link #code}. */
    public static final class DelaunayException extends IllegalArgumentException {
        private static final long serialVersionUID = 1L;
        public final String code;
        public DelaunayException(String code) { super(code); this.code = code; }
    }

    /** A charged step would exceed the caller's deterministic work budget. */
    public static final class WorkLimitException extends IllegalArgumentException {
        private static final long serialVersionUID = 1L;
        public final String code;
        public final long workUsed;
        public final String stage;
        public WorkLimitException(long workUsed, String stage) {
            super("WORK_LIMIT_EXCEEDED");
            this.code = "WORK_LIMIT_EXCEEDED";
            this.workUsed = workUsed;
            this.stage = stage;
        }
    }

    private final double[] positions;
    private final int[] inputToVertex;
    private final int[] sourceIndices;
    private final int[] triangles;
    private final int[] edges;
    private final int[] edgeFaces;
    private final long workUsed;

    private Delaunay2D(double[] positions, int[] inputToVertex, int[] sourceIndices,
                       int[] triangles, int[] edges, int[] edgeFaces, long workUsed) {
        this.positions = positions;
        this.inputToVertex = inputToVertex;
        this.sourceIndices = sourceIndices;
        this.triangles = triangles;
        this.edges = edges;
        this.edgeFaces = edgeFaces;
        this.workUsed = workUsed;
    }

    /**
     * Builds canonical exact topology from a passive {@code {points,maxWork}} record.
     * This is the reusable topology burden evidenced by
     * {@code survey/out/2018/Generativos/datata/notes.md} and
     * {@code survey/out/2019/generativos/lightcity/notes.md}; it deliberately has no
     * source-derived artistic defaults or ranges. All static input is validated before
     * a budget charge or retained allocation.
     */
    public static Delaunay2D triangulate(Object config) {
        Map<?, ?> record = record(config);
        Object suppliedPoints = record.get("points");
        if (!(suppliedPoints instanceof List)) invalid();
        List<?> raw = (List<?>) suppliedPoints;
        int count = raw.size();
        if (count < 0 || count > MAX_POINTS) invalid();
        long maxWork = workLimit(record.get("maxWork"));

        // Deliberately linear validation before canonicalize's atomic charge. Do not
        // retain an input-sized copy in this pass: List iteration handles LinkedList.
        for (Object item : raw) validatePair(item);

        Budget budget = new Budget(maxWork);
        budget.charge("canonicalize", count);
        Point[] originals = new Point[count];
        int cursor = 0;
        for (Object item : raw) {
            List<?> pair = pair(item);
            originals[cursor] = new Point(number(pair.get(0)), number(pair.get(1)), cursor);
            cursor++;
        }
        Canonical canonical = canonicalize(originals);
        if (canonical.points.length < 3) return empty(canonical, budget.used);

        ArrayList<Integer> hull = strictHull(canonical.points, budget);
        if (hull.size() < 3) return empty(canonical, budget.used);

        ActiveFaces active = new ActiveFaces();
        int root = hull.get(0).intValue();
        ArrayList<Face> fan = new ArrayList<Face>();
        for (int i = 1; i + 1 < hull.size(); i++)
            fan.add(canonicalFace(canonical.points, root, hull.get(i).intValue(), hull.get(i + 1).intValue()));
        active.appendSorted(fan);

        boolean[] corner = new boolean[canonical.points.length];
        for (Integer value : hull) corner[value.intValue()] = true;
        for (int site = 0; site < canonical.points.length; site++)
            if (!corner[site]) insert(canonical.points, active, site, budget);
        legalize(canonical.points, active, budget);
        return finish(canonical, active, budget.used);
    }

    /** Returns the retained original-site count. */
    public int inputCount() { return inputToVertex.length; }
    /** Returns the retained canonical unique-site count. */
    public int vertexCount() { return positions.length / 2; }
    /** Returns the retained final positive-face count. */
    public int faceCount() { return triangles.length / 3; }
    /** Returns the retained unique-edge count. */
    public int edgeCount() { return edges.length / 2; }
    /** Returns the exact charged deterministic work total. */
    public long workUsed() { return workUsed; }

    /** Returns a fresh detached canonical {@code [x,y]} carrier. */
    public double[] pointAt(long index) {
        int value = vertexIndex(index);
        return new double[] {positions[2 * value], positions[2 * value + 1]};
    }
    /** Numeric-carrier overload for {@link #pointAt(long)}. */
    public double[] pointAt(Object index) { return pointAt(accessIndex(index)); }
    /** Returns a fresh detached canonical positive face triple. */
    public int[] triangleAt(long index) { return copy3(triangles, faceIndex(index)); }
    /** Numeric-carrier overload for {@link #triangleAt(long)}. */
    public int[] triangleAt(Object index) { return triangleAt(accessIndex(index)); }
    /** Returns a fresh detached canonical {@code [lowVertex,highVertex]} edge. */
    public int[] edgeAt(long index) { return copy2(edges, edgeIndex(index)); }
    /** Numeric-carrier overload for {@link #edgeAt(long)}. */
    public int[] edgeAt(Object index) { return edgeAt(accessIndex(index)); }
    /** Returns a fresh detached pair of final incident-face indices. */
    public int[] edgeFacesAt(long index) { return copy2(edgeFaces, edgeIndex(index)); }
    /** Numeric-carrier overload for {@link #edgeFacesAt(long)}. */
    public int[] edgeFacesAt(Object index) { return edgeFacesAt(accessIndex(index)); }

    /** Writes one point atomically after index and complete destination validation. */
    public void pointInto(long index, double[] destination, int offset) {
        int value = vertexIndex(index); checkDestination(destination, offset, 2);
        destination[offset] = positions[2 * value]; destination[offset + 1] = positions[2 * value + 1];
    }
    /** Numeric-carrier overload for {@link #pointInto(long,double[],int)}. */
    public void pointInto(Object index, double[] destination, int offset) { pointInto(accessIndex(index), destination, offset); }
    /** Writes one face triple atomically after complete validation. */
    public void triangleInto(long index, int[] destination, int offset) {
        int value = faceIndex(index); checkDestination(destination, offset, 3);
        int at = 3 * value; destination[offset] = triangles[at]; destination[offset + 1] = triangles[at + 1]; destination[offset + 2] = triangles[at + 2];
    }
    /** Numeric-carrier overload for {@link #triangleInto(long,int[],int)}. */
    public void triangleInto(Object index, int[] destination, int offset) { triangleInto(accessIndex(index), destination, offset); }
    /** Writes one edge pair atomically after complete validation. */
    public void edgeInto(long index, int[] destination, int offset) {
        int value = edgeIndex(index); checkDestination(destination, offset, 2);
        int at = 2 * value; destination[offset] = edges[at]; destination[offset + 1] = edges[at + 1];
    }
    /** Numeric-carrier overload for {@link #edgeInto(long,int[],int)}. */
    public void edgeInto(Object index, int[] destination, int offset) { edgeInto(accessIndex(index), destination, offset); }
    /** Writes one edge-incidence pair atomically after complete validation. */
    public void edgeFacesInto(long index, int[] destination, int offset) {
        int value = edgeIndex(index); checkDestination(destination, offset, 2);
        int at = 2 * value; destination[offset] = edgeFaces[at]; destination[offset + 1] = edgeFaces[at + 1];
    }
    /** Numeric-carrier overload for {@link #edgeFacesInto(long,int[],int)}. */
    public void edgeFacesInto(Object index, int[] destination, int offset) { edgeFacesInto(accessIndex(index), destination, offset); }
    /** Returns the canonical vertex mapped from one original input ordinal. */
    public int inputVertexAt(long index) { return inputToVertex[inputIndex(index)]; }
    /** Numeric-carrier overload for {@link #inputVertexAt(long)}. */
    public int inputVertexAt(Object index) { return inputVertexAt(accessIndex(index)); }
    /** Returns the first original input ordinal represented by a canonical vertex. */
    public int sourceIndexAt(long index) { return sourceIndices[vertexIndex(index)]; }
    /** Numeric-carrier overload for {@link #sourceIndexAt(long)}. */
    public int sourceIndexAt(Object index) { return sourceIndexAt(accessIndex(index)); }

    /** Deeply materializes exactly the portable output schema. */
    public Map<String, Object> toValues() {
        ArrayList<Object> points = new ArrayList<Object>(vertexCount());
        ArrayList<Object> inputMap = new ArrayList<Object>(inputCount());
        ArrayList<Object> sources = new ArrayList<Object>(vertexCount());
        ArrayList<Object> outputTriangles = new ArrayList<Object>(faceCount());
        ArrayList<Object> outputEdges = new ArrayList<Object>(edgeCount());
        ArrayList<Object> outputEdgeFaces = new ArrayList<Object>(edgeCount());
        for (int i = 0; i < vertexCount(); i++) {
            ArrayList<Object> p = new ArrayList<Object>(2);
            p.add(Double.valueOf(positions[2 * i])); p.add(Double.valueOf(positions[2 * i + 1])); points.add(p);
            sources.add(Integer.valueOf(sourceIndices[i]));
        }
        for (int i = 0; i < inputCount(); i++) inputMap.add(Integer.valueOf(inputToVertex[i]));
        for (int i = 0; i < faceCount(); i++) outputTriangles.add(list3(triangles, i));
        for (int i = 0; i < edgeCount(); i++) { outputEdges.add(list2(edges, i)); outputEdgeFaces.add(list2(edgeFaces, i)); }
        LinkedHashMap<String, Object> output = new LinkedHashMap<String, Object>();
        output.put("points", points); output.put("inputToVertex", inputMap); output.put("sourceIndices", sources);
        output.put("triangles", outputTriangles); output.put("edges", outputEdges); output.put("edgeFaces", outputEdgeFaces);
        output.put("workUsed", Long.valueOf(workUsed));
        return output;
    }

    private static Delaunay2D empty(Canonical canonical, long work) {
        double[] positions = new double[2 * canonical.points.length];
        for (int i = 0; i < canonical.points.length; i++) { positions[2 * i] = canonical.points[i].x; positions[2 * i + 1] = canonical.points[i].y; }
        return new Delaunay2D(positions, canonical.inputToVertex, canonical.sourceIndices,
                new int[0], new int[0], new int[0], work);
    }

    private static Delaunay2D finish(Canonical canonical, ActiveFaces active, long work) {
        ArrayList<Face> faces = active.sortedFaces();
        double[] outputPoints = new double[2 * canonical.points.length];
        for (int i = 0; i < canonical.points.length; i++) { outputPoints[2 * i] = canonical.points[i].x; outputPoints[2 * i + 1] = canonical.points[i].y; }
        int[] outputFaces = new int[3 * faces.size()];
        TreeMap<Long, int[]> incidence = new TreeMap<Long, int[]>();
        for (int i = 0; i < faces.size(); i++) {
            Face face = faces.get(i); int at = 3 * i;
            outputFaces[at] = face.a; outputFaces[at + 1] = face.b; outputFaces[at + 2] = face.c;
            addOutputEdge(incidence, edgeKey(face.a, face.b), i);
            addOutputEdge(incidence, edgeKey(face.b, face.c), i);
            addOutputEdge(incidence, edgeKey(face.c, face.a), i);
        }
        int[] outputEdges = new int[2 * incidence.size()];
        int[] outputEdgeFaces = new int[2 * incidence.size()];
        int cursor = 0;
        for (Map.Entry<Long, int[]> entry : incidence.entrySet()) {
            long key = entry.getKey().longValue(); int[] faceIndexes = entry.getValue();
            outputEdges[2 * cursor] = edgeA(key); outputEdges[2 * cursor + 1] = edgeB(key);
            outputEdgeFaces[2 * cursor] = faceIndexes[0]; outputEdgeFaces[2 * cursor + 1] = faceIndexes[1]; cursor++;
        }
        return new Delaunay2D(outputPoints, canonical.inputToVertex, canonical.sourceIndices,
                outputFaces, outputEdges, outputEdgeFaces, work);
    }

    private static void addOutputEdge(TreeMap<Long, int[]> map, long key, int face) {
        int[] values = map.get(Long.valueOf(key));
        if (values == null) { map.put(Long.valueOf(key), new int[] {face, -1}); return; }
        if (values[1] != -1) throw new AssertionError("nonmanifold final edge");
        values[1] = face;
    }

    private static void insert(Point[] points, ActiveFaces active, int site, Budget budget) {
        long found = -1L; int sign0 = 0, sign1 = 0, sign2 = 0;
        for (Node node = active.head; node != null; node = node.next) {
            budget.charge("locate", 1);
            Face face = node.face;
            int candidate0 = orient(points[face.a], points[face.b], points[site]);
            int candidate1 = orient(points[face.b], points[face.c], points[site]);
            int candidate2 = orient(points[face.c], points[face.a], points[site]);
            if (candidate0 >= 0 && candidate1 >= 0 && candidate2 >= 0) {
                found = node.id; sign0 = candidate0; sign1 = candidate1; sign2 = candidate2; break;
            }
        }
        if (found < 0) throw new AssertionError("no containing active face");
        Face foundFace = active.node(found).face;
        int zeros = 0, zeroIndex = -1;
        if (sign0 == 0) { zeros++; zeroIndex = 0; }
        if (sign1 == 0) { zeros++; zeroIndex = 1; }
        if (sign2 == 0) { zeros++; zeroIndex = 2; }
        ArrayList<Face> replacement = new ArrayList<Face>();
        ArrayList<Long> removed = new ArrayList<Long>();
        if (zeros == 0) {
            replacement.add(canonicalFace(points, foundFace.a, foundFace.b, site));
            replacement.add(canonicalFace(points, foundFace.b, foundFace.c, site));
            replacement.add(canonicalFace(points, foundFace.c, foundFace.a, site));
            removed.add(Long.valueOf(found));
        } else {
            if (zeros != 1) throw new AssertionError("distinct site touches more than one face edge");
            int edgeStart = foundFace.edgeStart(zeroIndex), edgeEnd = foundFace.edgeEnd(zeroIndex);
            TreeSet<Long> owners = active.incidence.get(Long.valueOf(edgeKey(edgeStart, edgeEnd)));
            if (owners == null || owners.size() < 1 || owners.size() > 2) throw new AssertionError("invalid edge incidence");
            for (Long owner : owners) {
                Face old = active.node(owner.longValue()).face; int other = old.third(edgeStart, edgeEnd);
                replacement.add(canonicalFace(points, edgeStart, site, other));
                replacement.add(canonicalFace(points, site, edgeEnd, other));
                removed.add(owner);
            }
        }
        active.replace(removed, replacement);
    }

    private static void legalize(Point[] points, ActiveFaces active, Budget budget) {
        TreeSet<Long> queue = new TreeSet<Long>();
        for (Map.Entry<Long, TreeSet<Long>> entry : active.incidence.entrySet())
            if (entry.getValue().size() == 2) queue.add(entry.getKey());
        while (!queue.isEmpty()) {
            budget.charge("legalize", 1);
            long item = queue.pollFirst().longValue();
            TreeSet<Long> owners = active.incidence.get(Long.valueOf(item));
            if (owners == null || owners.size() != 2) continue;
            Long firstId = owners.first(), secondId = owners.last();
            Face first = active.node(firstId.longValue()).face, second = active.node(secondId.longValue()).face;
            int u = edgeA(item), v = edgeB(item), firstOpposite = first.third(u, v), secondOpposite = second.third(u, v);
            int left = orient(points[u], points[v], points[firstOpposite]) > 0 ? firstOpposite : secondOpposite;
            int right = left == firstOpposite ? secondOpposite : firstOpposite;
            if (orient(points[u], points[v], points[left]) <= 0 || orient(points[u], points[v], points[right]) >= 0)
                throw new AssertionError("inconsistent edge sides");
            if (orient(points[left], points[right], points[u]) * orient(points[left], points[right], points[v]) >= 0) continue;
            int determinant = incircle(points[u], points[v], points[left], points[right]);
            long replacement = edgeKey(left, right);
            if (determinant < 0 || (determinant == 0 && replacement >= item)) continue;
            ArrayList<Face> faces = new ArrayList<Face>(2);
            faces.add(canonicalFace(points, left, right, u)); faces.add(canonicalFace(points, right, left, v));
            ArrayList<Long> appended = active.replace(Arrays.asList(firstId, secondId), faces);
            for (Long node : appended) {
                Face face = active.node(node.longValue()).face;
                for (int edge = 0; edge < 3; edge++) {
                    long key = edgeKey(face.edgeStart(edge), face.edgeEnd(edge));
                    TreeSet<Long> current = active.incidence.get(Long.valueOf(key));
                    if (current != null && current.size() == 2) queue.add(Long.valueOf(key));
                }
            }
        }
    }

    private static ArrayList<Integer> strictHull(Point[] points, Budget budget) {
        ArrayList<Integer> lower = hullChain(points, false, budget, "hull_lower");
        ArrayList<Integer> upper = hullChain(points, true, budget, "hull_upper");
        lower.remove(lower.size() - 1); upper.remove(upper.size() - 1); lower.addAll(upper); return lower;
    }
    private static ArrayList<Integer> hullChain(Point[] points, boolean reverse, Budget budget, String stage) {
        ArrayList<Integer> chain = new ArrayList<Integer>();
        for (int i = reverse ? points.length - 1 : 0; reverse ? i >= 0 : i < points.length; i += reverse ? -1 : 1) {
            while (chain.size() >= 2) {
                budget.charge(stage, 1);
                if (orient(points[chain.get(chain.size() - 2).intValue()], points[chain.get(chain.size() - 1).intValue()], points[i]) <= 0) chain.remove(chain.size() - 1); else break;
            }
            chain.add(Integer.valueOf(i));
        }
        return chain;
    }

    private static Canonical canonicalize(Point[] originals) {
        Point[] sorted = originals.clone(); Arrays.sort(sorted, POINT_ORDER);
        Point[] unique = new Point[sorted.length]; int[] source = new int[sorted.length]; int[] input = new int[originals.length]; int uniqueCount = 0;
        Point previous = null;
        for (Point point : sorted) {
            if (previous == null || Double.doubleToLongBits(previous.x) != Double.doubleToLongBits(point.x)
                    || Double.doubleToLongBits(previous.y) != Double.doubleToLongBits(point.y)) {
                unique[uniqueCount] = point; source[uniqueCount] = point.source; uniqueCount++; previous = point;
            }
            input[point.source] = uniqueCount - 1;
        }
        return new Canonical(Arrays.copyOf(unique, uniqueCount), input, Arrays.copyOf(source, uniqueCount));
    }

    private static Face canonicalFace(Point[] points, int a, int b, int c) {
        int direction = orient(points[a], points[b], points[c]);
        if (direction == 0) throw new AssertionError("zero-area face");
        if (direction < 0) { int swap = b; b = c; c = swap; }
        if (a <= b && a <= c) return new Face(a, b, c);
        if (b <= a && b <= c) return new Face(b, c, a);
        return new Face(c, a, b);
    }

    private static int orient(Point a, Point b, Point c) {
        int filtered = orientationFilter(a.x, a.y, b.x, b.y, c.x, c.y);
        if (filtered != 0) return filtered;
        D left = b.xd.subtract(a.xd).multiply(c.yd.subtract(a.yd));
        D right = b.yd.subtract(a.yd).multiply(c.xd.subtract(a.xd));
        return left.subtract(right).sign();
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

    private static int incircle(Point a, Point b, Point c, Point d) {
        D ax = a.xd.subtract(d.xd), ay = a.yd.subtract(d.yd);
        D bx = b.xd.subtract(d.xd), by = b.yd.subtract(d.yd);
        D cx = c.xd.subtract(d.xd), cy = c.yd.subtract(d.yd);
        D aa = ax.multiply(ax).add(ay.multiply(ay));
        D bb = bx.multiply(bx).add(by.multiply(by));
        D cc = cx.multiply(cx).add(cy.multiply(cy));
        return aa.multiply(bx.multiply(cy).subtract(by.multiply(cx)))
                .subtract(bb.multiply(ax.multiply(cy).subtract(ay.multiply(cx))))
                .add(cc.multiply(ax.multiply(by).subtract(ay.multiply(bx)))).sign();
    }

    private static Map<?, ?> record(Object value) {
        if (!(value instanceof Map)) invalid(); Map<?, ?> map = (Map<?, ?>) value;
        if (map.size() != KEYS.length) invalid(); for (String key : KEYS) if (!map.containsKey(key)) invalid(); return map;
    }
    private static List<?> pair(Object value) { if (!(value instanceof List) || ((List<?>) value).size() != 2) invalid(); return (List<?>) value; }
    private static void validatePair(Object value) { List<?> p = pair(value); number(p.get(0)); number(p.get(1)); }
    private static double number(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long || value instanceof Float || value instanceof Double)) invalid();
        double result = ((Number) value).doubleValue(); if (!Double.isFinite(result)) invalid(); return result == 0.0 ? 0.0 : result;
    }
    private static long workLimit(Object value) {
        double n = number(value); if (n < 0 || n > MAX_SAFE_INTEGER || n != Math.floor(n)) invalid(); return (long) n;
    }
    private static long accessIndex(Object value) {
        if (!(value instanceof Byte || value instanceof Short || value instanceof Integer || value instanceof Long || value instanceof Float || value instanceof Double)) throw new DelaunayException("INVALID_INDEX");
        double n = ((Number) value).doubleValue();
        if (!Double.isFinite(n) || n < 0 || n > MAX_SAFE_INTEGER || n != Math.floor(n)) throw new DelaunayException("INVALID_INDEX");
        return (long) n;
    }
    private int inputIndex(long index) { return checked(index, inputCount()); }
    private int vertexIndex(long index) { return checked(index, vertexCount()); }
    private int faceIndex(long index) { return checked(index, faceCount()); }
    private int edgeIndex(long index) { return checked(index, edgeCount()); }
    private static int checked(long index, int count) { if (index < 0 || index > MAX_SAFE_INTEGER) throw new DelaunayException("INVALID_INDEX"); if (index >= count) throw new DelaunayException("INDEX_OUT_OF_RANGE"); return (int) index; }
    private static void checkDestination(double[] output, int offset, int width) { if (output == null || offset < 0 || offset > output.length - width) throw new DelaunayException("INVALID_OUTPUT"); }
    private static void checkDestination(int[] output, int offset, int width) { if (output == null || offset < 0 || offset > output.length - width) throw new DelaunayException("INVALID_OUTPUT"); }
    private static void invalid() { throw new DelaunayException("INVALID_INPUT"); }

    private static int[] copy2(int[] values, int index) { int at = 2 * index; return new int[] {values[at], values[at + 1]}; }
    private static int[] copy3(int[] values, int index) { int at = 3 * index; return new int[] {values[at], values[at + 1], values[at + 2]}; }
    private static List<Object> list2(int[] values, int index) { int at = 2 * index; ArrayList<Object> r = new ArrayList<Object>(2); r.add(Integer.valueOf(values[at])); r.add(Integer.valueOf(values[at + 1])); return r; }
    private static List<Object> list3(int[] values, int index) { int at = 3 * index; ArrayList<Object> r = new ArrayList<Object>(3); r.add(Integer.valueOf(values[at])); r.add(Integer.valueOf(values[at + 1])); r.add(Integer.valueOf(values[at + 2])); return r; }
    private static long edgeKey(int a, int b) { int low = a < b ? a : b, high = a < b ? b : a; return ((long) low << 32) | (high & 0xffffffffL); }
    private static int edgeA(long edge) { return (int) (edge >>> 32); }
    private static int edgeB(long edge) { return (int) edge; }

    private static final class Budget { final long maximum; long used; Budget(long maximum) { this.maximum = maximum; } void charge(String stage, long cost) { if (cost > maximum - used) throw new WorkLimitException(used, stage); used += cost; } }
    private static final class Canonical { final Point[] points; final int[] inputToVertex, sourceIndices; Canonical(Point[] p, int[] m, int[] s) { points = p; inputToVertex = m; sourceIndices = s; } }
    private static final class Point {
        final double x, y; final D xd, yd; final int source;
        Point(double x, double y, int source) { this.x = x; this.y = y; this.xd = D.of(x); this.yd = D.of(y); this.source = source; }
    }
    private static final Comparator<Point> POINT_ORDER = new Comparator<Point>() {
        public int compare(Point a, Point b) {
            int x = Double.compare(a.x, b.x);
            if (x != 0) return x;
            int y = Double.compare(a.y, b.y);
            if (y != 0) return y;
            return a.source == b.source ? 0 : a.source < b.source ? -1 : 1;
        }
    };
    /** Exact finite binary64 dyadic {@code n * 2^e}; it is discarded before return. */
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

        D add(D other) {
            if (n.signum() == 0) return other;
            if (other.n.signum() == 0) return this;
            int base = e < other.e ? e : other.e;
            return new D(n.shiftLeft(e - base).add(other.n.shiftLeft(other.e - base)), base);
        }

        D subtract(D other) {
            if (other.n.signum() == 0) return this;
            int base = e < other.e ? e : other.e;
            return new D(n.shiftLeft(e - base).subtract(other.n.shiftLeft(other.e - base)), base);
        }

        D multiply(D other) { return new D(n.multiply(other.n), e + other.e); }
        int sign() { return n.signum(); }
    }
    private static final class Face implements Comparable<Face> {
        final int a,b,c; Face(int a,int b,int c){this.a=a;this.b=b;this.c=c;}
        int edgeStart(int index) { return index == 0 ? a : index == 1 ? b : c; }
        int edgeEnd(int index) { return index == 0 ? b : index == 1 ? c : a; }
        int third(int x, int y) { if (a != x && a != y) return a; if (b != x && b != y) return b; if (c != x && c != y) return c; throw new AssertionError("missing opposite"); }
        public int compareTo(Face o) { if (a != o.a) return a < o.a ? -1 : 1; if (b != o.b) return b < o.b ? -1 : 1; return c == o.c ? 0 : c < o.c ? -1 : 1; }
    }
    /** A live face only; removal unlinks it and drops its map entry immediately. */
    private static final class Node {
        final Face face;
        final long id;
        Node previous;
        Node next;
        Node(Face face, long id, Node previous) { this.face = face; this.id = id; this.previous = previous; }
    }

    /**
     * Creation-ordered active face sequence plus local undirected-edge incidence.
     * Node identities are long because cumulative replacements can exceed a signed-int
     * count even though every live topology index is within the public int limit.
     */
    private static final class ActiveFaces {
        final HashMap<Long, Node> nodes = new HashMap<Long, Node>();
        final TreeMap<Long, TreeSet<Long>> incidence = new TreeMap<Long, TreeSet<Long>>();
        Node head;
        Node tail;
        long nextId;

        ActiveFaces() { }

        Node node(long id) {
            Node result = nodes.get(Long.valueOf(id));
            if (result == null) throw new AssertionError("dead face reference");
            return result;
        }

        ArrayList<Long> appendSorted(List<Face> faces) {
            ArrayList<Face> ordered = new ArrayList<Face>(faces);
            Collections.sort(ordered);
            ArrayList<Long> ids = new ArrayList<Long>(ordered.size());
            for (Face face : ordered) {
                Node node = new Node(face, nextId++, tail);
                nodes.put(Long.valueOf(node.id), node);
                if (tail == null) head = node; else tail.next = node;
                tail = node;
                addEdges(node.id, face);
                ids.add(Long.valueOf(node.id));
            }
            return ids;
        }

        void addEdges(long id, Face face) {
            for (int i = 0; i < 3; i++) {
                Long key = Long.valueOf(edgeKey(face.edgeStart(i), face.edgeEnd(i)));
                TreeSet<Long> owners = incidence.get(key);
                if (owners == null) { owners = new TreeSet<Long>(); incidence.put(key, owners); }
                owners.add(Long.valueOf(id));
                if (owners.size() > 2) throw new AssertionError("nonmanifold edge");
            }
        }

        void remove(long id) {
            Node node = nodes.remove(Long.valueOf(id));
            if (node == null) throw new AssertionError("dead face");
            for (int i = 0; i < 3; i++) {
                Long key = Long.valueOf(edgeKey(node.face.edgeStart(i), node.face.edgeEnd(i)));
                TreeSet<Long> owners = incidence.get(key);
                owners.remove(Long.valueOf(id));
                if (owners.isEmpty()) incidence.remove(key);
            }
            if (node.previous == null) head = node.next; else node.previous.next = node.next;
            if (node.next == null) tail = node.previous; else node.next.previous = node.previous;
            node.previous = null;
            node.next = null;
        }

        ArrayList<Long> replace(List<Long> old, List<Face> fresh) {
            ArrayList<Long> ordered = new ArrayList<Long>(old);
            Collections.sort(ordered);
            for (Long id : ordered) remove(id.longValue());
            return appendSorted(fresh);
        }

        ArrayList<Face> sortedFaces() {
            ArrayList<Face> out = new ArrayList<Face>(nodes.size());
            for (Node node = head; node != null; node = node.next) out.add(node.face);
            Collections.sort(out);
            return out;
        }
    }
}
