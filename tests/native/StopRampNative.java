package org.procedurals.color;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Focused carrier, ownership, ordering, and numeric checks for StopRamp. */
public final class StopRampNative {
    private static int assertions;

    private interface Action {
        void run();
    }

    private static void check(boolean value, String message) {
        assertions++;
        if (!value) {
            throw new AssertionError(message);
        }
    }

    private static List<Object> list(Object... values) {
        return new ArrayList<Object>(Arrays.asList(values));
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<String, Object>();
        for (int index = 0; index < values.length; index += 2) {
            result.put((String) values[index], values[index + 1]);
        }
        return result;
    }

    private static Map<String, Object> stop(Object position, Object color) {
        return map("position", position, "color", color);
    }

    private static Map<String, Object> input(Object... stops) {
        return map("stops", list(stops));
    }

    private static void invalid(Action action) {
        error(action, "INVALID_INPUT");
    }

    private static void queryError(Action action) {
        error(action, "INVALID_QUERY");
    }

    private static void error(Action action, String expectedCode) {
        try {
            action.run();
            throw new AssertionError("missing " + expectedCode);
        } catch (StopRamp.StopRampException exception) {
            check(expectedCode.equals(exception.code), "error code");
        }
    }

    private static StopRamp validRamp() {
        return StopRamp.create(new double[] {0.0, 0.5, 1.0}, new int[] {0, 0xFF0000, 0xFFFFFF});
    }

    private static void objectOwnership() {
        Map<String, Object> first = stop(0.0, 0);
        Map<String, Object> second = stop(1.0, 0xFFFFFF);
        List<Object> stops = list(first, second);
        Map<String, Object> config = map("stops", stops);
        StopRamp ramp = StopRamp.create(config);
        Map<String, Object> saved = ramp.serialize();

        first.put("position", 0.25);
        second.put("color", 0);
        stops.clear();
        config.clear();
        check(ramp.sample(0.5) == 0x808080, "object input detached");
        check(ramp.serialize().equals(saved), "object mutation cannot alter serialization");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> exported = (List<Map<String, Object>>) saved.get("stops");
        exported.get(0).put("color", 0x123456);
        check(!ramp.serialize().equals(saved), "serialize deeply detached");
    }

    private static void typedOwnershipAndOrdering() {
        double[] positions = {0.0, 0.5, 1.0};
        int[] colors = {0, 0xFF0000, 0xFFFFFF};
        StopRamp ramp = StopRamp.create(positions, colors);
        positions[1] = 0.75;
        colors[1] = 0;
        check(ramp.sample(0.5) == 0xFF0000, "typed input detached");
        Map<String, Object> serialized = ramp.serialize();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> exported = (List<Map<String, Object>>) serialized.get("stops");
        exported.get(1).put("color", 0);
        check(ramp.sample(0.5) == 0xFF0000, "typed serialize deeply detached");

        invalid(new Action() {
            public void run() {
                StopRamp.create(new double[] {0.0, 0.0}, new int[] {0, 1});
            }
        });
        invalid(new Action() {
            public void run() {
                StopRamp.create(new double[] {0.75, 0.25}, new int[] {0, 1});
            }
        });
        invalid(new Action() {
            public void run() {
                StopRamp.create(new double[] {0.0, Double.POSITIVE_INFINITY}, new int[] {0, 1});
            }
        });
    }

    private static void numericAndCarrierChecks() {
        StopRamp ramp = validRamp();
        final StopRamp constant = StopRamp.create(new double[] {0.5}, new int[] {0x123456});
        queryError(new Action() { public void run() { constant.sample(Double.NaN); } });
        queryError(new Action() { public void run() { constant.sample(Boolean.TRUE); } });
        invalid(new Action() { public void run() {
            StopRamp.create(new double[] {0, 1}, new int[] {0});
        } });
        StopRamp allowedCarriers = StopRamp.create(input(
                stop(Byte.valueOf((byte) 0), Short.valueOf((short) 0)),
                stop(Float.valueOf(0.5f), Integer.valueOf(0xFF0000)),
                stop(Double.valueOf(1.0), Long.valueOf(0xFFFFFFL))));
        check(allowedCarriers.sample(Byte.valueOf((byte) 0)) == 0, "byte query accepted");
        check(allowedCarriers.sample(Short.valueOf((short) 0)) == 0, "short query accepted");
        check(allowedCarriers.sample(Integer.valueOf(0)) == 0, "integer query accepted");
        check(allowedCarriers.sample(Long.valueOf(1L)) == 0xFFFFFF, "long query accepted");
        check(allowedCarriers.sample(Float.valueOf(0.5f)) == 0xFF0000, "float query accepted");
        check(allowedCarriers.sample(Double.valueOf(0.25)) == 0x800000, "double query accepted");
        check(ramp.sample(-0.0) == 0, "negative zero query accepted");
        Map<String, Object> serialized = StopRamp.create(
                new double[] {-0.0, 1.0}, new int[] {0, 0xFFFFFF}).serialize();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> stops = (List<Map<String, Object>>) serialized.get("stops");
        double storedZero = ((Number) stops.get(0).get("position")).doubleValue();
        check(Double.doubleToRawLongBits(storedZero) == Double.doubleToRawLongBits(0.0),
                "serialized zero is positive zero");

        queryError(new Action() { public void run() { ramp.sample(Double.NaN); } });
        queryError(new Action() { public void run() { ramp.sample(Double.NEGATIVE_INFINITY); } });
        queryError(new Action() { public void run() { ramp.sample(new BigDecimal("0.5")); } });
        queryError(new Action() { public void run() { ramp.sample(new BigInteger("1")); } });
        queryError(new Action() { public void run() { ramp.sample(unacceptedNumber()); } });

        invalid(new Action() { public void run() { StopRamp.create(input(stop(Double.NaN, 0))); } });
        invalid(new Action() { public void run() { StopRamp.create(input(stop(new BigInteger("0"), 0))); } });
        invalid(new Action() { public void run() { StopRamp.create(input(stop(0, new BigDecimal("0")))); } });
        invalid(new Action() {
            public void run() {
                StopRamp.create(input(stop(0, unacceptedNumber())));
            }
        });
    }

    private static Number unacceptedNumber() {
        return new Number() {
            public int intValue() { throw new AssertionError("number was coerced"); }
            public long longValue() { throw new AssertionError("number was coerced"); }
            public float floatValue() { throw new AssertionError("number was coerced"); }
            public double doubleValue() { throw new AssertionError("number was coerced"); }
        };
    }

    public static void main(String[] args) {
        objectOwnership();
        typedOwnershipAndOrdering();
        numericAndCarrierChecks();
        System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions + "}");
    }
}
