package org.procedurals.geometry;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Focused pure Java checks for radial pull arithmetic, carriers, and ownership. */
public final class RadialPullNative {
    private static int assertions;
    private interface Action { void run(); }

    private static void check(boolean ok, String message) {
        assertions++;
        if (!ok) throw new AssertionError(message);
    }

    private static List<Object> list(Object... values) {
        return new ArrayList<Object>(Arrays.asList(values));
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
        return result;
    }

    private static void error(String code, Action action) {
        try {
            action.run();
            throw new AssertionError("missing " + code);
        } catch (RadialPull2D.PullException exception) {
            check(code.equals(exception.code), "wrong error " + exception.code);
        }
    }

    private static void exact(double expected, double actual, String message) {
        check(Double.doubleToRawLongBits(expected) == Double.doubleToRawLongBits(actual), message);
    }

    private static void analytic() {
        RadialPull2D one = RadialPull2D.create(new double[][] {{200, 240, 120, 2}});
        RadialPull2D.Point cardinal = one.transform(260, 240);
        exact(170, cardinal.x(), "cardinal x");
        exact(240, cardinal.y(), "cardinal y");
        RadialPull2D.Point center = one.transform(200, 240);
        exact(200, center.x(), "center x");
        exact(240, center.y(), "center y");
        RadialPull2D.Point rim = one.transform(80, 240);
        exact(80, rim.x(), "rim x");
        RadialPull2D empty = RadialPull2D.create(new double[0][4]);
        exact(3, empty.transform(3, 4).x(), "empty identity");
        RadialPull2D overlap = RadialPull2D.create(new double[][] {{0, 0, 10, 2}, {10, 0, 10, 2}});
        RadialPull2D.Point summed = overlap.transform(5, 0);
        exact(5, summed.x(), "overlap sum");
        RadialPull2D duplicates = RadialPull2D.create(new double[][] {{0, 0, 10, 2}, {0, 0, 10, 2}});
        exact(-10, duplicates.transform(5, 0).x(), "duplicate contributions");
    }

    private static void ownershipAndCarriers() {
        double[][] source = {{0, 0, 10, 2}};
        RadialPull2D typed = RadialPull2D.create(source);
        source[0][0] = 100;
        exact(-2.5, typed.transform(5, 0).x(), "typed input detached");
        Map<String, Object> descriptor = map("influences", list(list(0, 0, 10, 2)));
        RadialPull2D object = RadialPull2D.create(descriptor);
        ((List<Object>) ((List<?>) descriptor.get("influences")).get(0)).set(0, 100);
        exact(-2.5, object.transform(5, 0).x(), "object input detached");
        Map<String, Object> serialized = object.serialize();
        ((List<Object>) ((List<?>) serialized.get("influences")).get(0)).set(0, 100.0);
        exact(-2.5, object.transform(5, 0).x(), "serialized output detached");
        double[] target = {7, 8};
        object.transform(5, 0, target);
        exact(-2.5, target[0], "target x");
        exact(0, target[1], "target y");
        exact(-2.5, object.transform(5, 0).x(), "repeat order");

        Object[] carriers = {(byte) 0, (short) 0, 0, 0L, 0.0f, 0.0};
        for (Object value : carriers) {
            RadialPull2D field = RadialPull2D.create(map("influences",
                    list(list(value, 0, 10, 2))));
            exact(-2.5, field.transform(5, 0).x(), "numeric carrier");
            exact(0, ((Number) field.transform(list(value, value)).get(0)).doubleValue(), "query carrier");
        }
        Number custom = new Number() {
            public int intValue() { return 0; }
            public long longValue() { return 0; }
            public float floatValue() { return 0; }
            public double doubleValue() { return 0; }
        };
        Object[] rejected = {null, true, "0", BigInteger.ZERO, BigDecimal.ZERO, custom, Double.NaN, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY};
        for (final Object value : rejected) {
            error("INVALID_INPUT", new Action() {
                public void run() { RadialPull2D.create(map("influences", list(list(value, 0, 10, 2)))); }
            });
            error("INVALID_QUERY", new Action() { public void run() { object.transform(list(value, 0)); } });
            error("INVALID_QUERY", new Action() { public void run() { object.transform(list(0, value)); } });
        }
        error("INVALID_QUERY", new Action() { public void run() { object.transform(list(0, true)); } });
        error("INVALID_QUERY", new Action() { public void run() { object.transform(list(Double.POSITIVE_INFINITY, 0)); } });
        error("INVALID_QUERY", new Action() { public void run() { object.transform(list(0, Double.NEGATIVE_INFINITY)); } });
        error("INVALID_QUERY", new Action() { public void run() { object.transform(0, 0, new double[1]); } });
    }

    private static void overflowAndAtomicity() {
        final double[] target = {11, 12};
        RadialPull2D large = RadialPull2D.create(new double[][] {{Double.MAX_VALUE, 0, 1, 2}});
        large.transform(-Double.MAX_VALUE, 0, target);
        exact(-Double.MAX_VALUE, target[0], "infinite separation skips");
        RadialPull2D outputOverflow = RadialPull2D.create(new double[][] {{1, 0, Double.MAX_VALUE, 1}, {1, 0, Double.MAX_VALUE, 1}});
        error("NUMERIC_OVERFLOW", new Action() { public void run() { outputOverflow.transform(0, 0, target); } });
        check(target[0] == -Double.MAX_VALUE && target[1] == 0, "overflow target unchanged");
        RadialPull2D finalYOverflow = RadialPull2D.create(new double[][] {
            {0, 1.5e308, 1e308, 2}, {0, 1.5e308, 1e308, 2}
        });
        error("NUMERIC_OVERFLOW", new Action() { public void run() {
            finalYOverflow.transform(0, 1e308, target);
        } });
        check(target[0] == -Double.MAX_VALUE && target[1] == 0, "final overflow target unchanged");
        error("INVALID_INPUT", new Action() { public void run() { RadialPull2D.create(new double[][] {{0, 0, 0, 1}}); } });
        error("INVALID_INPUT", new Action() { public void run() { RadialPull2D.create(new double[][] {{0, 0, 1, 0}}); } });
    }

    private static String workload(int influences, int queries) {
        double[][] rows = new double[influences][4];
        for (int i = 0; i < influences; i++) {
            rows[i][0] = i * 0.25;
            rows[i][1] = i * 0.125;
            rows[i][2] = 20;
            rows[i][3] = 2;
        }
        RadialPull2D field = RadialPull2D.create(rows);
        double[] target = new double[2];
        long checksum = 0;
        long start = System.nanoTime();
        for (int i = 0; i < queries; i++) {
            field.transform((i % 128) * 0.125, (i % 97) * 0.125, target);
            checksum = checksum * 31 + Double.doubleToRawLongBits(target[0]);
            checksum = checksum * 31 + Double.doubleToRawLongBits(target[1]);
        }
        return "{\"influences\":" + influences + ",\"queries\":" + queries
                + ",\"elapsed_ns\":" + (System.nanoTime() - start)
                + ",\"checksum_unsigned64\":\"" + Long.toUnsignedString(checksum) + "\"}";
    }

    public static void main(String[] args) {
        analytic();
        ownershipAndCarriers();
        overflowAndAtomicity();
        for (int warmup = 0; warmup < 3; warmup++) workload(8, 20000);
        System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions
                + ",\"workloads\":[" + workload(1, 1) + "," + workload(8, 250000)
                + "," + workload(64, 250000) + "]}");
    }
}
