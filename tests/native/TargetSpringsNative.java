package org.procedurals.motion;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/** Native Java ownership, carrier, continuing-step and safe-access checks for CP10. */
public final class TargetSpringsNative {
  private static int assertions;

  private interface Action { void run(); }

  private static final class UnsupportedNumber extends Number {
    public int intValue() { return 1; }
    public long longValue() { return 1L; }
    public float floatValue() { return 1f; }
    public double doubleValue() { return 1d; }
  }

  private static void check(boolean value, String message) {
    assertions++;
    if (!value) throw new AssertionError(message);
  }

  private static List<Object> list(Object... values) {
    return new ArrayList<Object>(Arrays.asList(values));
  }

  private static Map<String,Object> map(Object... values) {
    Map<String,Object> result = new LinkedHashMap<String,Object>();
    for (int i = 0; i < values.length; i += 2) result.put((String) values[i], values[i + 1]);
    return result;
  }

  private static Map<String,Object> body(Object px, Object py, Object vx, Object vy,
                                          Object strength, Object retention) {
    return map("position", list(px, py), "velocity", list(vx, vy),
               "strength", strength, "retention", retention);
  }

  private static Map<String,Object> state(Object... bodies) {
    return map("bodies", list(bodies));
  }

  private static List<Object> targets(double... values) {
    List<Object> result = new ArrayList<Object>();
    for (int i = 0; i < values.length; i += 2) result.add(list(values[i], values[i + 1]));
    return result;
  }

  private static String code(Throwable error) {
    try {
      Field field = error.getClass().getField("code");
      Object value = field.get(error);
      return value == null ? null : value.toString();
    } catch (ReflectiveOperationException missing) {
      return null;
    }
  }

  private static Object field(Throwable error, String name) {
    try { return error.getClass().getField(name).get(error); }
    catch (ReflectiveOperationException missing) { throw new AssertionError(error.toString(), missing); }
  }

  private static void expected(String wanted, Action action) {
    Throwable caught = null;
    try { action.run(); }
    catch (Throwable error) { caught = error; }
    check(caught != null, "expected " + wanted);
    check(wanted.equals(code(caught)), "expected " + wanted + " got " + caught);
  }

  private static void expected(String wanted, String detailName, Object detail, Action action) {
    Throwable caught = null;
    try { action.run(); }
    catch (Throwable error) { caught = error; }
    check(caught != null, "expected " + wanted);
    check(wanted.equals(code(caught)), "expected " + wanted + " got " + caught);
    check(detail.equals(field(caught, detailName)), wanted + " " + detailName);
  }

  private static void exact(Object expected, Object actual, String path) {
    if (expected instanceof Number) {
      check(actual instanceof Number, path + " number");
      check(Double.doubleToRawLongBits(((Number) expected).doubleValue()) ==
            Double.doubleToRawLongBits(((Number) actual).doubleValue()), path);
      return;
    }
    if (expected instanceof Map) {
      check(actual instanceof Map, path + " map");
      Map<?,?> e = (Map<?,?>) expected, a = (Map<?,?>) actual;
      check(e.keySet().equals(a.keySet()), path + " keys");
      for (Object key : e.keySet()) exact(e.get(key), a.get(key), path + "/" + key);
      return;
    }
    if (expected instanceof List) {
      check(actual instanceof List, path + " list");
      List<?> e = (List<?>) expected, a = (List<?>) actual;
      check(e.size() == a.size(), path + " size");
      for (int i = 0; i < e.size(); i++) exact(e.get(i), a.get(i), path + "/" + i);
      return;
    }
    check(expected == null ? actual == null : expected.equals(actual), path);
  }

  private static void same(TargetSprings2D left, TargetSprings2D right, String label) {
    exact(left.toValues(), right.toValues(), label);
  }

  private static TargetSprings2D ordinary() {
    return TargetSprings2D.create(state(
      body(3.0, -2.0, 1.0, -0.5, 0.125, 0.75),
      body(-4.0, 5.0, 0.25, -1.0, 0.05, 0.9)));
  }

  @SuppressWarnings("unchecked")
  private static void ownershipAndReads() {
    Map<String,Object> supplied = state(body(3.0, -2.0, 1.0, -0.5, 0.125, 0.75));
    TargetSprings2D batch = TargetSprings2D.create(supplied);
    Map<String,Object> before = batch.toValues();
    List<Object> suppliedBodies = (List<Object>) supplied.get("bodies");
    Map<String,Object> suppliedBody = (Map<String,Object>) suppliedBodies.get(0);
    ((List<Object>) suppliedBody.get("position")).set(0, 99.0);
    ((List<Object>) suppliedBody.get("velocity")).set(1, 88.0);
    suppliedBody.put("strength", 0.0);
    suppliedBodies.clear();
    exact(before, batch.toValues(), "input mutation detached");

    double[] p0 = batch.positionAt(0L), p1 = batch.positionAt(0L);
    double[] v0 = batch.velocityAt(0L), v1 = batch.velocityAt(0L);
    check(p0 != p1 && v0 != v1, "accessors return fresh pairs");
    p0[0] = 700.0; v0[0] = 701.0;
    exact(before, batch.toValues(), "accessors detached");
    Map<String,Object> exported = batch.toValues();
    List<Object> exportedBodies = (List<Object>) exported.get("bodies");
    Map<String,Object> exportedBody = (Map<String,Object>) exportedBodies.get(0);
    ((List<Object>) exportedBody.get("position")).set(0, 702.0);
    ((List<Object>) exportedBody.get("velocity")).set(0, 703.0);
    exportedBody.put("strength", 0.0);
    ((List<Object>) exportedBodies).clear();
    exact(before, batch.toValues(), "export deeply detached");
    // Every read above is observational: another complete snapshot remains bitwise equal.
    exact(before, batch.toValues(), "read never steps");

    Map<String,Object> snapshot = batch.toValues();
    double[] firstTarget = {10.0, -4.0};
    batch.step(firstTarget);
    TargetSprings2D replay = TargetSprings2D.create(snapshot);
    replay.step(firstTarget);
    same(batch, replay, "post-read/recovery replay");
    check(Double.doubleToRawLongBits(batch.strengthAt(0L)) == Double.doubleToRawLongBits(0.125), "strengthAt");
    check(Double.doubleToRawLongBits(batch.retentionAt(0L)) == Double.doubleToRawLongBits(0.75), "retentionAt");
  }

  private static void carriers() {
    Object[] accepted = {
      Byte.valueOf((byte) 1), Short.valueOf((short) 1), Integer.valueOf(1),
      Long.valueOf(1L), Float.valueOf(1f), Double.valueOf(1d)
    };
    for (Object carrier : accepted) {
      final Object c = carrier;
      TargetSprings2D positionCarrier = TargetSprings2D.create(state(body(c, -2.0, 1.0, -0.5, 0.125, 0.75)));
      positionCarrier.step(targets(10.0, -4.0));
      TargetSprings2D velocityCarrier = TargetSprings2D.create(state(body(3.0, -2.0, c, -0.5, 0.125, 0.75)));
      velocityCarrier.step(targets(10.0, -4.0));
      // Supported carriers must be accepted in every scalar coefficient slot.
      TargetSprings2D.create(state(body(3.0, -2.0, 1.0, -0.5, c, 0.75)));
      TargetSprings2D.create(state(body(3.0, -2.0, 1.0, -0.5, 0.125, c)));
      TargetSprings2D targetCarrier = TargetSprings2D.create(state(body(3.0, -2.0, 1.0, -0.5, 0.125, 0.75)));
      targetCarrier.step(list(list(c, -4.0)));
    }
    Object[] rejected = {new BigDecimal("1"), BigInteger.ONE, new UnsupportedNumber(),
                         Boolean.TRUE, "1", null, new double[]{1.0, 2.0}};
    for (Object carrier : rejected) {
      final Object c = carrier;
      expected("INVALID_INPUT", () -> TargetSprings2D.create(state(body(c, -2.0, 1.0, -0.5, 0.125, 0.75))));
      expected("INVALID_INPUT", () -> TargetSprings2D.create(state(body(3.0, -2.0, 1.0, -0.5, c, 0.75))));
      Map<String,Object> targetState = state(body(3.0, -2.0, 1.0, -0.5, 0.125, 0.75));
      TargetSprings2D batch = TargetSprings2D.create(targetState);
      List<Object> badTargets = list(list(c, -4.0));
      expected("INVALID_INPUT", () -> batch.step(badTargets));
    }
    TargetSprings2D packed = TargetSprings2D.create(state(body(3.0, -2.0, 1.0, -0.5, 0.125, 0.75)));
    expected("INVALID_INPUT", () -> packed.step((Object) new float[]{10.0f, -4.0f}));
    expected("INVALID_INPUT", () -> packed.step((Object) new double[]{10.0}));
    expected("INVALID_INPUT", () -> packed.step((Object) null));
    expected("INVALID_INPUT", () -> TargetSprings2D.create(state(body(3.0, -2.0, 1.0, -0.5, 0.125, -0.1))));

    LinkedList<Object> linkedBodies = new LinkedList<Object>();
    linkedBodies.add(body(3.0, -2.0, 1.0, -0.5, 0.125, 0.75));
    Map<String,Object> linkedState = map("bodies", linkedBodies);
    TargetSprings2D linkedBatch = TargetSprings2D.create(linkedState);
    LinkedList<Object> linkedTargets = new LinkedList<Object>();
    linkedTargets.add(list(10.0, -4.0));
    linkedBatch.step(linkedTargets);
    TargetSprings2D arrayBatch = TargetSprings2D.create(state(body(3.0, -2.0, 1.0, -0.5, 0.125, 0.75)));
    arrayBatch.step(targets(10.0, -4.0));
    same(linkedBatch, arrayBatch, "passive LinkedList state and targets");
  }

  private static void continuingPaths() {
    Map<String,Object> initial = state(
      body(3.0, -2.0, 1.0, -0.5, 0.125, 0.75),
      body(-4.0, 5.0, 0.25, -1.0, 0.05, 0.9));
    TargetSprings2D listBatch = TargetSprings2D.create(initial);
    TargetSprings2D packedBatch = TargetSprings2D.create(initial);
    TargetSprings2D objectPackedBatch = TargetSprings2D.create(initial);
    for (int tick = 0; tick < 12; tick++) {
      double[] packed = {10.0 + tick * 0.5, -4.0 - tick, -7.0 + tick, 8.0 - tick * 0.25};
      List<Object> canonical = list(list(packed[0], packed[1]), list(packed[2], packed[3]));
      listBatch.step(canonical);
      packedBatch.step(packed);
      objectPackedBatch.step((Object) packed);
      same(listBatch, packedBatch, "continuing list/packed tick " + tick);
      same(listBatch, objectPackedBatch, "continuing list/Object-packed tick " + tick);
    }
    // Importing the detached mid-sequence value and continuing with the same
    // target reproduces the retained path exactly.
    Map<String,Object> mid = listBatch.toValues();
    TargetSprings2D restored = TargetSprings2D.create(mid);
    double[] target = {4.0, 12.0, -1.0, 2.0};
    listBatch.step(target); restored.step(target);
    same(listBatch, restored, "mid-sequence restore");
  }

  private static void arithmeticAtomicityAndRecovery() {
    final TargetSprings2D batch = TargetSprings2D.create(state(
      body(2.0, -3.0, 1.0, 0.5, 0.25, 0.5),
      body(0.0, 0.0, Double.MAX_VALUE, 0.0, 1.0, 0.5)));
    Map<String,Object> before = batch.toValues();
    List<Object> overflowing = list(list(10.0, -4.0), list(Double.MAX_VALUE, 0.0));
    expected("SPRING_ARITHMETIC_INVALID", "bodyIndex", Integer.valueOf(1), () -> batch.step(overflowing));
    Throwable detailError = null;
    try { batch.step(overflowing); } catch (Throwable error) { detailError = error; }
    check(detailError != null && "x".equals(field(detailError, "axis")) && "advanced".equals(field(detailError, "stage")), "late arithmetic details");
    exact(before, batch.toValues(), "late arithmetic failure atomic");
    batch.step(list(list(1.0, 1.0), list(1.0, 1.0)));
    TargetSprings2D expectedBatch = TargetSprings2D.create(before);
    expectedBatch.step(list(list(1.0, 1.0), list(1.0, 1.0)));
    same(batch, expectedBatch, "recovery after arithmetic failure");

    TargetSprings2D packedFailure = TargetSprings2D.create(state(
      body(2.0, -3.0, 1.0, 0.5, 0.25, 0.5),
      body(0.0, 0.0, Double.MAX_VALUE, 0.0, 1.0, 0.5)));
    Map<String,Object> packedBefore = packedFailure.toValues();
    expected("SPRING_ARITHMETIC_INVALID", () -> packedFailure.step(new double[]{10.0, -4.0, Double.MAX_VALUE, 0.0}));
    exact(packedBefore, packedFailure.toValues(), "packed late arithmetic failure atomic");
    packedFailure.step(new double[]{1.0, 1.0, 1.0, 1.0});
    check(Double.isFinite(packedFailure.positionAt(0L)[0]), "packed recovery after arithmetic failure");

    final TargetSprings2D lateY = TargetSprings2D.create(state(
      body(2.0, -3.0, 1.0, 0.5, 0.25, 0.5),
      body(0.0, 0.0, 0.0, Double.MAX_VALUE, 1.0, 0.5)));
    Map<String,Object> lateYBefore = lateY.toValues();
    expected("SPRING_ARITHMETIC_INVALID", "axis", "y",
      () -> lateY.step(new double[]{10.0, -4.0, 1.0, Double.MAX_VALUE}));
    exact(lateYBefore, lateY.toValues(), "failure after earlier body and x leaves all state unchanged");

    final TargetSprings2D precedence = TargetSprings2D.create(state(
      body(Double.MAX_VALUE, 0.0, 0.0, 0.0, 1.0, 0.5),
      body(0.0, 0.0, 0.0, 0.0, 1.0, 0.5)));
    List<Object> lateInvalid = list(list(-Double.MAX_VALUE, 0.0), list("bad", 0.0));
    expected("INVALID_INPUT", () -> precedence.step(lateInvalid));
    Map<String,Object> precedenceBefore = precedence.toValues();
    TargetSprings2D packedPrecedence = TargetSprings2D.create(state(
      body(Double.MAX_VALUE, 0.0, 0.0, 0.0, 1.0, 0.5),
      body(0.0, 0.0, 0.0, 0.0, 1.0, 0.5)));
    Map<String,Object> packedPrecedenceBefore = packedPrecedence.toValues();
    expected("INVALID_INPUT", () -> packedPrecedence.step(new double[]{-Double.MAX_VALUE, 0.0, Double.NaN, 0.0}));
    exact(packedPrecedenceBefore, packedPrecedence.toValues(), "packed static error beats overflow");
    precedence.step(list(list(0.0, 0.0), list(1.0, 1.0)));
    exact(precedenceBefore, map("bodies", list(
      map("position", list(Double.MAX_VALUE, 0.0), "velocity", list(0.0, 0.0), "strength", 1.0, "retention", 0.5),
      map("position", list(0.0, 0.0), "velocity", list(0.0, 0.0), "strength", 1.0, "retention", 0.5))), "precedence state unchanged");
    packedPrecedence.step(new double[]{0.0, 0.0, 1.0, 1.0});
    check(Double.isFinite(precedence.positionAt(0L)[0]), "recovery after late static error");
    check(Double.isFinite(packedPrecedence.positionAt(0L)[0]), "packed recovery after late static error");
  }

  private static void indexAndInto() {
    final TargetSprings2D batch = ordinary();
    Object[] invalid = {Boolean.TRUE, "0", null, Double.NaN, Double.POSITIVE_INFINITY,
                        Double.NEGATIVE_INFINITY, Double.valueOf(0.5), Integer.valueOf(-1),
                        BigInteger.ZERO, new UnsupportedNumber()};
    for (Object index : invalid) {
      final Object i = index;
      expected("INVALID_INDEX", () -> batch.positionAt(i));
      expected("INVALID_INDEX", () -> batch.velocityAt(i));
      expected("INVALID_INDEX", () -> batch.strengthAt(i));
      expected("INVALID_INDEX", () -> batch.retentionAt(i));
      double[] output = {11.0, 12.0, 13.0, 14.0};
      final double[] target = output;
      expected("INVALID_INDEX", () -> batch.positionInto(i, target, 0));
      check(Arrays.equals(output, new double[]{11.0, 12.0, 13.0, 14.0}), "invalid index leaves output");
    }
    Object[] accepted = {Byte.valueOf((byte) 0), Short.valueOf((short) 0), Integer.valueOf(0),
                         Long.valueOf(0L), Float.valueOf(0f), Double.valueOf(-0.0)};
    for (Object index : accepted) {
      final Object i = index;
      check(batch.positionAt(i).length == 2, "accepted numeric Object index");
      double[] output = {21.0, 22.0, 23.0, 24.0};
      batch.velocityInto(i, output, 1);
      check(output[0] == 21.0 && output[3] == 24.0, "Object velocityInto sentinels");
    }
    long[] unsafe = {9007199254740992L, Long.MAX_VALUE, Long.MIN_VALUE};
    for (long index : unsafe) {
      expected("INVALID_INDEX", () -> batch.positionAt(index));
      double[] output = {31.0, 32.0, 33.0, 34.0};
      expected("INVALID_INDEX", () -> batch.velocityInto(index, output, 0));
      check(Arrays.equals(output, new double[]{31.0, 32.0, 33.0, 34.0}), "unsafe index unchanged");
    }
    expected("INDEX_OUT_OF_RANGE", () -> batch.positionAt((long) batch.size()));
    expected("INDEX_OUT_OF_RANGE", () -> batch.velocityAt(9007199254740991L));
    expected("INDEX_OUT_OF_RANGE", () -> batch.positionInto((long) batch.size(), null, -99));

    double[] values = {11.0, 12.0, 13.0, 14.0};
    double[] before = values.clone();
    expected("INVALID_OUTPUT", () -> batch.positionInto(0L, null, 0));
    check(Arrays.equals(values, before), "null output unchanged");
    expected("INVALID_OUTPUT", () -> batch.velocityInto(0L, values, -1));
    check(Arrays.equals(values, before), "negative offset unchanged");
    expected("INVALID_OUTPUT", () -> batch.positionInto(0L, values, 3));
    check(Arrays.equals(values, before), "short output unchanged");
    expected("INVALID_OUTPUT", () -> batch.velocityInto(0L, values, Integer.MAX_VALUE));
    check(Arrays.equals(values, before), "overflowing offset unchanged");
    batch.positionInto(0L, values, 1);
    check(values[0] == 11.0 && values[3] == 14.0, "positionInto sentinels");
    check(Double.doubleToRawLongBits(values[1]) == Double.doubleToRawLongBits(batch.positionAt(0L)[0]) &&
          Double.doubleToRawLongBits(values[2]) == Double.doubleToRawLongBits(batch.positionAt(0L)[1]), "positionInto values");
    long safeZero = 0L;
    check(batch.positionAt(safeZero)[0] == batch.positionAt(0.0)[0], "integral floating index");
  }

  public static void main(String[] args) {
    try {
      ownershipAndReads();
      carriers();
      continuingPaths();
      arithmeticAtomicityAndRecovery();
      indexAndInto();
      System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions
        + ",\"packed_paths\":\"continuing list, typed packed and Object-packed checks\"}");
    } catch (Throwable error) {
      String message = String.valueOf(error).replace("\\", "\\\\").replace("\"", "'");
      System.out.println("{\"status\":\"failed\",\"assertions\":" + assertions
        + ",\"error\":\"" + message + "\"}");
      System.exit(1);
    }
  }
}
