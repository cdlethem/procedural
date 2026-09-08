package org.procedurals.topology;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/** Native-only ownership, carrier, access, and atomic-output checks for CP9. */
public final class Delaunay2DNative {
    private static int assertions;

    private interface Action { void run(); }

    private static final class UnsupportedNumber extends Number {
        public int intValue() { return 1; }
        public long longValue() { return 1L; }
        public float floatValue() { return 1f; }
        public double doubleValue() { return 1d; }
    }

    private static void check(boolean condition, String label) {
        assertions++;
        if (!condition) throw new AssertionError(label);
    }

    private static List<Object> list(Object... items) {
        return new ArrayList<Object>(Arrays.asList(items));
    }

    private static Map<String, Object> map(Object... items) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int index = 0; index < items.length; index += 2) result.put((String) items[index], items[index + 1]);
        return result;
    }

    private static Map<String, Object> ordinary() {
        return map("points", list(list(0.0, 0.0), list(2.0, 0.0), list(0.0, 2.0), list(1.0, 1.0)), "maxWork", 1000.0);
    }

    private static String code(Throwable error) {
        try {
            Field field = error.getClass().getField("code");
            Object value = field.get(error);
            return value instanceof String ? (String) value : null;
        } catch (ReflectiveOperationException ignored) {
            return null;
        }
    }

    private static void expected(String wanted, Action action) {
        try {
            action.run();
            throw new AssertionError("expected " + wanted);
        } catch (Throwable error) {
            check(wanted.equals(code(error)), "expected " + wanted + " got " + error);
        }
    }

    private static long mix(long value, long item) { return (value ^ item) * 0x100000001b3L; }

    private static long checksum(Delaunay2D result) {
        long value = 0xcbf29ce484222325L;
        for (int index = 0; index < result.inputCount(); index++) value = mix(value, result.inputVertexAt(index));
        for (int index = 0; index < result.vertexCount(); index++) {
            double[] point = result.pointAt(index);
            value = mix(value, Double.doubleToRawLongBits(point[0]));
            value = mix(value, Double.doubleToRawLongBits(point[1]));
            value = mix(value, result.sourceIndexAt(index));
        }
        for (int index = 0; index < result.faceCount(); index++) for (int item : result.triangleAt(index)) value = mix(value, item);
        for (int index = 0; index < result.edgeCount(); index++) {
            for (int item : result.edgeAt(index)) value = mix(value, item);
            for (int item : result.edgeFacesAt(index)) value = mix(value, item);
        }
        return mix(value, result.workUsed());
    }

    private static void carriersAndStaticPrecedence() {
        Object[] accepted = {Byte.valueOf((byte) 4), Short.valueOf((short) 4), Integer.valueOf(4), Long.valueOf(4L), Float.valueOf(4f), Double.valueOf(4d)};
        for (Object number : accepted) {
            Map<String, Object> input = ordinary();
            input.put("maxWork", number);
            // A small accepted budget may be insufficient, which still proves carrier parsing.
            try { Delaunay2D.triangulate(input); }
            catch (Throwable error) { check("WORK_LIMIT_EXCEEDED".equals(code(error)), "accepted work carrier"); }
            input = ordinary(); ((List<Object>) input.get("points")).set(0, list(number, 0.0));
            check(Delaunay2D.triangulate(input).vertexCount() > 0, "accepted coordinate carrier");
        }
        Object[] rejected = {Boolean.TRUE, "4", new BigDecimal("4"), BigInteger.valueOf(4L), new UnsupportedNumber()};
        for (Object number : rejected) {
            Map<String, Object> input = ordinary(); input.put("maxWork", number);
            final Map<String, Object> invalidWork = input;
            expected("INVALID_INPUT", () -> Delaunay2D.triangulate(invalidWork));
            input = ordinary(); ((List<Object>) input.get("points")).set(0, list(number, 0.0));
            final Map<String, Object> coordinate = input;
            expected("INVALID_INPUT", () -> Delaunay2D.triangulate(coordinate));
        }
        double[] nonfinite = {Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY};
        for (double value : nonfinite) {
            for (int point = 0; point < 4; point++) for (int axis = 0; axis < 2; axis++) {
                Map<String, Object> input = ordinary();
                List<Object> pair = (List<Object>) ((List<Object>) input.get("points")).get(point);
                pair.set(axis, value); input.put("maxWork", 0.0);
                final Map<String, Object> late = input;
                expected("INVALID_INPUT", () -> Delaunay2D.triangulate(late));
            }
        }
        Map<String, Object> input = ordinary(); input.put("extra", 1.0);
        final Map<String, Object> extra = input;
        expected("INVALID_INPUT", () -> Delaunay2D.triangulate(extra));
        input = ordinary(); input.put("points", new Object[0]);
        final Map<String, Object> arrayPoints = input;
        expected("INVALID_INPUT", () -> Delaunay2D.triangulate(arrayPoints));
        List<Object> points = new LinkedList<Object>(); points.add(list(0.0, 0.0)); points.add(list(1.0, 0.0)); points.add(list(0.0, 1.0));
        check(Delaunay2D.triangulate(map("points", points, "maxWork", 100.0)).vertexCount() == 3, "linked list points accepted");
    }

    private static void ownershipAndExports() {
        Map<String, Object> input = ordinary();
        List<Object> points = (List<Object>) input.get("points");
        Delaunay2D result = Delaunay2D.triangulate(input);
        long before = checksum(result);
        ((List<Object>) points.get(0)).set(0, 99.0);
        points.clear(); input.put("maxWork", 0.0);
        check(before == checksum(result), "deep input mutation cannot alter retained output");
        double[] point = result.pointAt(0); point[0] = 99.0;
        int[] triangle = result.triangleAt(0); triangle[0] = 99;
        int[] edge = result.edgeAt(0); edge[0] = 99;
        int[] incidence = result.edgeFacesAt(0); incidence[0] = 99;
        check(before == checksum(result), "At carriers must be detached");
        Map<String, Object> values = result.toValues();
        check(values.keySet().equals(new java.util.LinkedHashSet<String>(Arrays.asList("points", "inputToVertex", "sourceIndices", "triangles", "edges", "edgeFaces", "workUsed"))), "toValues exact fields");
        ((List<Object>) ((List<Object>) values.get("points")).get(0)).set(0, 88.0);
        ((List<Object>) ((List<Object>) values.get("triangles")).get(0)).set(0, 88);
        ((List<Object>) ((List<Object>) values.get("edges")).get(0)).set(0, 88);
        ((List<Object>) ((List<Object>) values.get("edgeFaces")).get(0)).set(0, 88);
        ((List<Object>) values.get("inputToVertex")).clear();
        ((List<Object>) values.get("sourceIndices")).clear();
        check(before == checksum(result), "toValues deeply detached");
    }

    private static void accessAndAtomicity() {
        Delaunay2D result = Delaunay2D.triangulate(ordinary());
        expected("INVALID_INDEX", () -> result.pointAt(Double.NaN));
        expected("INVALID_INDEX", () -> result.triangleAt(Boolean.TRUE));
        expected("INVALID_INDEX", () -> result.edgeAt(new BigDecimal("0")));
        expected("INVALID_INDEX", () -> result.edgeFacesAt(0.5));
        expected("INVALID_INDEX", () -> result.inputVertexAt(-1L));
        expected("INVALID_INDEX", () -> result.sourceIndexAt(9007199254740992L));
        expected("INDEX_OUT_OF_RANGE", () -> result.pointAt((long) result.vertexCount()));
        expected("INDEX_OUT_OF_RANGE", () -> result.triangleAt((long) result.faceCount()));
        expected("INDEX_OUT_OF_RANGE", () -> result.edgeAt((long) result.edgeCount()));
        expected("INDEX_OUT_OF_RANGE", () -> result.edgeFacesAt((long) result.edgeCount()));
        expected("INDEX_OUT_OF_RANGE", () -> result.inputVertexAt((long) result.inputCount()));
        expected("INDEX_OUT_OF_RANGE", () -> result.sourceIndexAt((long) result.vertexCount()));
        check(Arrays.equals(result.pointAt(0L), result.pointAt(0.0)), "integral Object point index");
        check(Arrays.equals(result.triangleAt(0L), result.triangleAt(0.0)), "integral Object triangle index");
        check(Arrays.equals(result.edgeAt(0L), result.edgeAt(0.0)), "integral Object edge index");
        check(Arrays.equals(result.edgeFacesAt(0L), result.edgeFacesAt(0.0)), "integral Object edgeFaces index");
        check(result.inputVertexAt(0L) == result.inputVertexAt(0.0), "integral Object input index");
        check(result.sourceIndexAt(0L) == result.sourceIndexAt(0.0), "integral Object source index");
        final long maxSafe = 9007199254740991L;
        final long beyondSafe = 9007199254740992L;
        expected("INDEX_OUT_OF_RANGE", () -> result.pointAt(maxSafe));
        expected("INDEX_OUT_OF_RANGE", () -> result.pointAt(Double.valueOf(maxSafe)));
        expected("INVALID_INDEX", () -> result.pointAt(beyondSafe));
        expected("INVALID_INDEX", () -> result.pointAt(Double.valueOf(beyondSafe)));
        expected("INDEX_OUT_OF_RANGE", () -> result.triangleAt(maxSafe));
        expected("INDEX_OUT_OF_RANGE", () -> result.triangleAt(Double.valueOf(maxSafe)));
        expected("INVALID_INDEX", () -> result.triangleAt(beyondSafe));
        expected("INVALID_INDEX", () -> result.triangleAt(Double.valueOf(beyondSafe)));
        expected("INDEX_OUT_OF_RANGE", () -> result.edgeAt(maxSafe));
        expected("INDEX_OUT_OF_RANGE", () -> result.edgeAt(Double.valueOf(maxSafe)));
        expected("INVALID_INDEX", () -> result.edgeAt(beyondSafe));
        expected("INVALID_INDEX", () -> result.edgeAt(Double.valueOf(beyondSafe)));
        expected("INDEX_OUT_OF_RANGE", () -> result.edgeFacesAt(maxSafe));
        expected("INDEX_OUT_OF_RANGE", () -> result.edgeFacesAt(Double.valueOf(maxSafe)));
        expected("INVALID_INDEX", () -> result.edgeFacesAt(beyondSafe));
        expected("INVALID_INDEX", () -> result.edgeFacesAt(Double.valueOf(beyondSafe)));
        expected("INDEX_OUT_OF_RANGE", () -> result.inputVertexAt(maxSafe));
        expected("INDEX_OUT_OF_RANGE", () -> result.inputVertexAt(Double.valueOf(maxSafe)));
        expected("INDEX_OUT_OF_RANGE", () -> result.sourceIndexAt(maxSafe));
        expected("INDEX_OUT_OF_RANGE", () -> result.sourceIndexAt(Double.valueOf(maxSafe)));
        expected("INVALID_INDEX", () -> result.inputVertexAt(beyondSafe));
        expected("INVALID_INDEX", () -> result.inputVertexAt(Double.valueOf(beyondSafe)));
        expected("INVALID_INDEX", () -> result.sourceIndexAt(beyondSafe));
        expected("INVALID_INDEX", () -> result.sourceIndexAt(Double.valueOf(beyondSafe)));

        double[] doubles = {11, 12, 13, 14, 15}; double[] doubleBefore = doubles.clone();
        expected("INVALID_INDEX", () -> result.pointInto(Double.NaN, doubles, -1)); check(Arrays.equals(doubleBefore, doubles), "invalid point index atomic");
        expected("INDEX_OUT_OF_RANGE", () -> result.pointInto((long) result.vertexCount(), doubles, -1)); check(Arrays.equals(doubleBefore, doubles), "point range atomic");
        expected("INVALID_OUTPUT", () -> result.pointInto(0L, null, 0));
        expected("INVALID_OUTPUT", () -> result.pointInto(0L, doubles, -1)); check(Arrays.equals(doubleBefore, doubles), "point offset atomic");
        expected("INVALID_OUTPUT", () -> result.pointInto(0L, doubles, 4)); check(Arrays.equals(doubleBefore, doubles), "point short atomic");
        result.pointInto(0.0, doubles, 1); check(doubles[0] == 11 && doubles[3] == 14 && doubles[4] == 15, "point sentinels");
        check(Arrays.equals(Arrays.copyOfRange(doubles, 1, 3), result.pointAt(0L)), "pointInto value");

        int[] ints = {21, 22, 23, 24, 25, 26}; int[] intBefore = ints.clone();
        expected("INVALID_INDEX", () -> result.triangleInto(-1L, ints, -1)); check(Arrays.equals(intBefore, ints), "triangle invalid atomic");
        expected("INDEX_OUT_OF_RANGE", () -> result.triangleInto((long) result.faceCount(), ints, -1)); check(Arrays.equals(intBefore, ints), "triangle range atomic");
        expected("INVALID_OUTPUT", () -> result.triangleInto(0L, null, 0)); check(Arrays.equals(intBefore, ints), "triangle null atomic");
        expected("INVALID_OUTPUT", () -> result.triangleInto(0L, ints, 4)); check(Arrays.equals(intBefore, ints), "triangle short atomic");
        result.triangleInto(0.0, ints, 1); check(ints[0] == 21 && ints[4] == 25 && ints[5] == 26 && Arrays.equals(Arrays.copyOfRange(ints, 1, 4), result.triangleAt(0L)), "triangleInto value/sentinels");
        int[] edge = {31, 32, 33, 34}; int[] edgeBefore = edge.clone();
        expected("INVALID_INDEX", () -> result.edgeInto(Double.NaN, edge, -1)); check(Arrays.equals(edgeBefore, edge), "edge invalid atomic");
        expected("INDEX_OUT_OF_RANGE", () -> result.edgeFacesInto((long) result.edgeCount(), edge, -1)); check(Arrays.equals(edgeBefore, edge), "edgeFaces range atomic");
        expected("INVALID_OUTPUT", () -> result.edgeInto(0L, edge, 3)); check(Arrays.equals(edgeBefore, edge), "edge short atomic");
        expected("INVALID_OUTPUT", () -> result.edgeFacesInto(0L, edge, -1)); check(Arrays.equals(edgeBefore, edge), "edgeFaces offset atomic");
        result.edgeInto(0.0, edge, 1); check(edge[0] == 31 && edge[3] == 34 && Arrays.equals(Arrays.copyOfRange(edge, 1, 3), result.edgeAt(0L)), "edgeInto value/sentinels");
        result.edgeFacesInto(0.0, edge, 1); check(edge[0] == 31 && edge[3] == 34 && Arrays.equals(Arrays.copyOfRange(edge, 1, 3), result.edgeFacesAt(0L)), "edgeFacesInto value/sentinels");
    }

    public static void main(String[] args) {
        carriersAndStaticPrecedence();
        ownershipAndExports();
        accessAndAtomicity();
        Delaunay2D first = Delaunay2D.triangulate(ordinary());
        Delaunay2D second = Delaunay2D.triangulate(ordinary());
        check(checksum(first) == checksum(second), "same-runtime exact replay");
        System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions + ",\"checksum\":\"" + Long.toUnsignedString(checksum(first), 16) + "\"}");
    }
}
