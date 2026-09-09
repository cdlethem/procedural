package org.procedurals.raster;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/** Focused carrier, ownership, index, and typed/object checks for SeparableBlur2D. */
public final class SeparableBlurNative {
    private static int assertions;
    private interface Action { void run(); }
    private static void check(boolean value, String message) { assertions++; if (!value) throw new AssertionError(message); }
    private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
    private static Map<String, Object> map(Object... values) { Map<String, Object> out = new LinkedHashMap<String, Object>(); for (int i = 0; i < values.length; i += 2) out.put((String) values[i], values[i + 1]); return out; }
    private static Map<String, Object> source(Object width, Object height, Object pixels) { return map("width", width, "height", height, "pixels", pixels); }
    private static Map<String, Object> input(Object source, Object x, Object y, Object budget) { return map("source", source, "kernelX", x, "kernelY", y, "maxSamples", budget); }
    private static void expect(Action action, String code) { try { action.run(); throw new AssertionError("missing " + code); } catch (SeparableBlur2D.SeparableBlurException error) { check(code.equals(error.code), "expected " + code); } }

    private static void ownershipAndParity() {
        int[] pixels = {0x02ff0000, 0, 0, 0}; double[] x = {1, 2, 1}, y = {1, 2, 1};
        SeparableBlur2D typed = SeparableBlur2D.blur(2, 2, pixels, x, y, 24);
        SeparableBlur2D object = SeparableBlur2D.blur(input(source(2, 2, list(0x02ff0000L, 0L, 0L, 0L)), list(1d, 2d, 1d), list(1d, 2d, 1d), 24L));
        check(Arrays.equals(typed.pixels(), object.pixels()), "typed/object parity");
        check(typed.pixelAt(0L) == 0x01ff0000, "fractional intermediate precision");
        int[] before = typed.pixels(); pixels[0] = 0; x[0] = 0; y[0] = 0;
        check(Arrays.equals(before, typed.pixels()), "typed inputs detached");
        Map<String, Object> exported = typed.toValues();
        @SuppressWarnings("unchecked") List<Object> values = (List<Object>) exported.get("pixels"); values.set(0, 0L);
        check(typed.pixelAt(0L) == 0x01ff0000, "export detached");
        int[] copy = typed.pixels(); copy[0] = 0; check(typed.pixelAt(0L) == 0x01ff0000, "pixel copy detached");
    }

    private static void linkedListParity() {
        int[] pixels = {0x00ff0000, 0xff0000ff};
        SeparableBlur2D typed = SeparableBlur2D.blur(2, 1, pixels, new double[]{1, 1, 1}, new double[]{1}, 8);
        List<Object> linkedPixels = new LinkedList<Object>(list(0x00ff0000L, 0xff0000ffL));
        List<Object> linkedX = new LinkedList<Object>(list(1d, 1d, 1d));
        List<Object> linkedY = new LinkedList<Object>(list(1d));
        SeparableBlur2D object = SeparableBlur2D.blur(input(source(2, 1, linkedPixels), linkedX, linkedY, 8L));
        check(Arrays.equals(typed.pixels(), object.pixels()), "LinkedList object parity");
    }

    private static void identityAndIndexes() {
        SeparableBlur2D identity = SeparableBlur2D.blur(1, 1, new int[]{0x00123456}, new double[]{1}, new double[]{1}, 2);
        check(identity.pixelAt(0L) == 0x00123456, "identity hidden RGB");
        check(identity.pixelAt(-0.0d) == 0x00123456, "negative-zero index");
        expect(new Action() { public void run() { identity.pixelAt(Boolean.TRUE); } }, "INVALID_INDEX");
        expect(new Action() { public void run() { identity.pixelAt(-1L); } }, "INVALID_INDEX");
        expect(new Action() { public void run() { identity.pixelAt(9007199254740991L); } }, "INDEX_OUT_OF_RANGE");
        expect(new Action() { public void run() { identity.pixelAt(9007199254740992d); } }, "INVALID_INDEX");
    }

    private static void invalidCarriersAndOrder() {
        final Map<String, Object> valid = input(source(1, 1, list(0L)), list(1d), list(1d), 2L);
        expect(new Action() { public void run() { SeparableBlur2D.blur(input(valid.get("source"), list(Double.NaN), list(1d), 2L)); } }, "INVALID_INPUT");
        expect(new Action() { public void run() { SeparableBlur2D.blur(input(valid.get("source"), list(Double.POSITIVE_INFINITY), list(1d), 2L)); } }, "INVALID_INPUT");
        expect(new Action() { public void run() { SeparableBlur2D.blur(input(valid.get("source"), list(new BigInteger("1")), list(1d), 2L)); } }, "INVALID_INPUT");
        expect(new Action() { public void run() { SeparableBlur2D.blur(input(valid.get("source"), list(new BigDecimal("1")), list(1d), 2L)); } }, "INVALID_INPUT");
        expect(new Action() { public void run() { SeparableBlur2D.blur(input(valid.get("source"), list(new Number() { public int intValue(){return 1;} public long longValue(){return 1;} public float floatValue(){return 1;} public double doubleValue(){return 1;} }), list(1d), 2L)); } }, "INVALID_INPUT");
        expect(new Action() { public void run() { SeparableBlur2D.blur(input(valid.get("source"), list(-1d, 1d, 1d), list(1d), 1L)); } }, "INVALID_INPUT");
        expect(new Action() { public void run() { SeparableBlur2D.blur(1, 1, new int[]{0}, new double[]{1, 2, 1}, new double[]{1}, 3); } }, "WORK_LIMIT");
        expect(new Action() { public void run() { SeparableBlur2D.blur(1, 1, new int[]{0}, new double[]{Double.NaN}, new double[]{1}, 1); } }, "INVALID_INPUT");
        expect(new Action() { public void run() { SeparableBlur2D.blur(1, 1, new int[]{0}, new double[]{1}, new double[]{1}, Long.MAX_VALUE); } }, "INVALID_INPUT");
    }

    public static void main(String[] args) {
        ownershipAndParity(); linkedListParity(); identityAndIndexes(); invalidCarriersAndOrder();
        System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions + "}");
    }
}
