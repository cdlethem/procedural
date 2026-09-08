package org.procedurals.mesh;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;

/** Native Java ownership, access, carrier, replay, and bounded-work checks for CP7. */
public final class RadialProfileNative {
  private static int assertions;
  private static volatile long sink;

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
  private static List<Object> list(Object... values) { return new ArrayList<Object>(Arrays.asList(values)); }
  private static Map<String,Object> map(Object... values) {
    Map<String,Object> out = new LinkedHashMap<String,Object>();
    for (int i = 0; i < values.length; i += 2) out.put((String) values[i], values[i + 1]);
    return out;
  }
  private static List<Object> profile(Object... values) {
    List<Object> out = new ArrayList<Object>();
    for (int i = 0; i < values.length; i += 2) out.add(list(values[i], values[i + 1]));
    return out;
  }
  private static Map<String,Object> config(List<Object> profile, Object slices,
                                           Object capStart, Object capEnd, Object maxFaces) {
    return map("profile", profile, "slices", slices, "capStart", capStart,
               "capEnd", capEnd, "maxFaces", maxFaces);
  }
  private static Map<String,Object> ordinary() {
    return config(profile(0.0, 2.0, 1.0, .75, 3.0, 2.0), 4.0, Boolean.TRUE, Boolean.TRUE, 1000.0);
  }

  private static String code(Throwable error) {
    if (error instanceof RadialProfile3D.MeshException)
      return ((RadialProfile3D.MeshException) error).code;
    if (error instanceof RadialProfile3D.FaceLimitException)
      return ((RadialProfile3D.FaceLimitException) error).code;
    if (error instanceof RadialProfile3D.MeshArithmeticException)
      return ((RadialProfile3D.MeshArithmeticException) error).code;
    return null;
  }
  private static void expected(String wanted, Action action) {
    try { action.run(); throw new AssertionError("expected " + wanted); }
    catch (Throwable error) { check(wanted.equals(code(error)), "expected " + wanted + " got " + error); }
  }

  private static long mix(long hash, long value) { return (hash ^ value) * 0x100000001b3L; }
  private static long checksum(RadialProfile3D mesh) {
    long hash = 0xcbf29ce484222325L;
    for (int i = 0; i < mesh.vertexCount(); i++) {
      double[] p = mesh.vertexAt(i);
      for (int j = 0; j < 3; j++) hash = mix(hash, Double.doubleToRawLongBits(p[j]));
    }
    for (int i = 0; i < mesh.faceCount(); i++) {
      int[] tri = mesh.triangleAt(i); double[] normal = mesh.normalAt(i);
      for (int j = 0; j < 3; j++) { hash = mix(hash, tri[j]); hash = mix(hash, Double.doubleToRawLongBits(normal[j])); }
      hash = mix(hash, mesh.faceKindAt(i).hashCode()); hash = mix(hash, mesh.bandAt(i)); hash = mix(hash, mesh.cellAt(i));
    }
    return hash;
  }

  private static void exactReplay(RadialProfile3D left, RadialProfile3D right) {
    check(left.vertexCount() == right.vertexCount() && left.faceCount() == right.faceCount(), "replay counts");
    for (int i = 0; i < left.vertexCount(); i++) {
      double[] a = left.vertexAt(i), b = right.vertexAt(i);
      for (int j = 0; j < 3; j++) check(Double.doubleToRawLongBits(a[j]) == Double.doubleToRawLongBits(b[j]), "replay position bits");
    }
    for (int i = 0; i < left.faceCount(); i++) {
      check(Arrays.equals(left.triangleAt(i), right.triangleAt(i)), "replay triangle");
      double[] a = left.normalAt(i), b = right.normalAt(i);
      for (int j = 0; j < 3; j++) check(Double.doubleToRawLongBits(a[j]) == Double.doubleToRawLongBits(b[j]), "replay normal bits");
      check(left.faceKindAt(i).equals(right.faceKindAt(i)) && left.bandAt(i) == right.bandAt(i) && left.cellAt(i) == right.cellAt(i), "replay metadata");
    }
  }

  private static void carriers() {
    Object[] valid = { Byte.valueOf((byte) 4), Short.valueOf((short) 4), Integer.valueOf(4),
      Long.valueOf(4L), Float.valueOf(4f), Double.valueOf(4d) };
    for (Object carrier : valid) {
      Map<String,Object> input = ordinary(); input.put("slices", carrier); input.put("maxFaces", 1000.0);
      check(RadialProfile3D.generate(input).faceCount() > 0, "accepted numeric carrier");
    }
    Object[] rejected = { new BigDecimal("4"), BigInteger.valueOf(4), new UnsupportedNumber(), Boolean.TRUE, "4" };
    for (Object carrier : rejected) {
      Map<String,Object> input = ordinary(); input.put("slices", carrier);
      final Map<String,Object> invalidSlices = input; expected("INVALID_INPUT", () -> RadialProfile3D.generate(invalidSlices));
      input = ordinary(); ((List<Object>) input.get("profile")).set(0, list(carrier, 2.0));
      final Map<String,Object> fixed = input; expected("INVALID_INPUT", () -> RadialProfile3D.generate(fixed));
    }
    Map<String,Object> input = ordinary(); input.put("extra", 1);
    final Map<String,Object> extra = input; expected("INVALID_INPUT", () -> RadialProfile3D.generate(extra));
    input = ordinary(); input.put("capEnd", 1.0);
    final Map<String,Object> numericCap = input; expected("INVALID_INPUT", () -> RadialProfile3D.generate(numericCap));
    input = ordinary(); ((List<Object>) input.get("profile")).set(1, list(1.0, Double.NaN));
    final Map<String,Object> nonfinite = input; expected("INVALID_INPUT", () -> RadialProfile3D.generate(nonfinite));
    List<Object> linked = new LinkedList<Object>(); linked.add(list(0.0, 1.0)); linked.add(list(1.0, 1.0));
    check(RadialProfile3D.generate(config(linked, 3.0, Boolean.FALSE, Boolean.FALSE, 100.0)).faceCount() == 6,
          "passive LinkedList profile accepted");
  }

  private static void ownershipAndFreshReads() {
    Map<String,Object> input = ordinary();
    RadialProfile3D mesh = RadialProfile3D.generate(input); long retained = checksum(mesh);
    List<Object> supplied = (List<Object>) input.get("profile"); ((List<Object>) supplied.get(0)).set(0, 99.0); supplied.clear();
    input.put("slices", 3.0); input.put("capStart", Boolean.FALSE);
    check(checksum(mesh) == retained, "input mutation detached");

    double[] first = mesh.vertexAt(0L), second = mesh.vertexAt(0L); check(first != second, "vertexAt fresh triple");
    check(mesh.triangleAt(0L) != mesh.triangleAt(0L), "triangleAt fresh triple");
    check(mesh.normalAt(0L) != mesh.normalAt(0L), "normalAt fresh triple");
    first[0] = 99.0; check(checksum(mesh) == retained, "vertexAt detached");
    int[] triangle = mesh.triangleAt(0L); triangle[0] = 99; check(checksum(mesh) == retained, "triangleAt detached");
    double[] normal = mesh.normalAt(0L); normal[0] = 99.0; check(checksum(mesh) == retained, "normalAt detached");

    Map<String,Object> values = mesh.toValues();
    check(values.keySet().equals(new java.util.HashSet<String>(Arrays.asList("positions", "triangles", "normals", "faceKinds", "bands", "cells"))), "export exact keys");
    List<?> exportedPositions = (List<?>) values.get("positions");
    check(exportedPositions.size() == mesh.vertexCount(), "export position count");
    for (int i = 0; i < mesh.vertexCount(); i++) {
      List<?> row = (List<?>) exportedPositions.get(i); double[] actual = mesh.vertexAt(i);
      check(row.size() == 3, "export position triple");
      for (int j = 0; j < 3; j++) check(Double.doubleToRawLongBits(((Number) row.get(j)).doubleValue()) == Double.doubleToRawLongBits(actual[j]), "export position bits");
    }
    for (String field : Arrays.asList("triangles", "normals", "faceKinds", "bands", "cells")) check(((List<?>) values.get(field)).size() == mesh.faceCount(), "export face alignment");
    for (int i = 0; i < mesh.faceCount(); i++) {
      List<?> triangleRow = (List<?>) ((List<?>) values.get("triangles")).get(i);
      List<?> normalRow = (List<?>) ((List<?>) values.get("normals")).get(i);
      int[] tri = mesh.triangleAt(i); double[] norm = mesh.normalAt(i);
      check(triangleRow.size() == 3 && normalRow.size() == 3, "export face triples");
      for (int j = 0; j < 3; j++) {
        check(triangleRow.get(j).equals(Integer.valueOf(tri[j])), "export integer triangle");
        check(Double.doubleToRawLongBits(((Number) normalRow.get(j)).doubleValue()) == Double.doubleToRawLongBits(norm[j]), "export normal bits");
      }
      check(((List<?>) values.get("faceKinds")).get(i).equals(mesh.faceKindAt(i)), "export kind");
      check(((List<?>) values.get("bands")).get(i).equals(mesh.bandAt(i)) && ((List<?>) values.get("cells")).get(i).equals(mesh.cellAt(i)), "export metadata");
    }
    ((List<Object>) ((List<Object>) values.get("positions")).get(0)).set(0, 88.0);
    ((List<Object>) ((List<Object>) values.get("triangles")).get(0)).set(0, 88);
    ((List<Object>) ((List<Object>) values.get("normals")).get(0)).set(0, 88.0);
    ((List<Object>) values.get("faceKinds")).clear(); ((List<Object>) values.get("bands")).clear(); ((List<Object>) values.get("cells")).clear();
    check(checksum(mesh) == retained, "toValues detached");
    check(((List<?>) mesh.toValues().get("positions")).size() == mesh.vertexCount(), "toValues fresh outer list");
  }

  private static void accessAndAtomicity() {
    RadialProfile3D mesh = RadialProfile3D.generate(ordinary());
    expected("INVALID_INDEX", () -> mesh.vertexAt(Double.NaN));
    expected("INVALID_INDEX", () -> mesh.normalAt(Boolean.TRUE));
    expected("INVALID_INDEX", () -> mesh.triangleAt(new BigDecimal("0")));
    expected("INVALID_INDEX", () -> mesh.faceKindAt(.5));
    check(Arrays.equals(mesh.vertexAt(0L), mesh.vertexAt(0.0)), "integral floating index accepted");
    expected("INDEX_OUT_OF_RANGE", () -> mesh.vertexAt((long) mesh.vertexCount()));
    expected("INDEX_OUT_OF_RANGE", () -> mesh.normalAt(9007199254740991L));

    double[] doubles = { 11, 12, 13, 14, 15, 16 }; double[] before = doubles.clone();
    expected("INVALID_INDEX", () -> mesh.vertexInto(Double.NaN, doubles, -1)); check(Arrays.equals(before, doubles), "invalid vertex index atomic");
    expected("INDEX_OUT_OF_RANGE", () -> mesh.normalInto((long) mesh.faceCount(), doubles, -1)); check(Arrays.equals(before, doubles), "out-of-range normal atomic");
    expected("INVALID_OUTPUT", () -> mesh.vertexInto(0L, null, 0)); check(Arrays.equals(before, doubles), "null vertex output atomic");
    expected("INVALID_OUTPUT", () -> mesh.normalInto(0L, doubles, -1)); check(Arrays.equals(before, doubles), "negative normal offset atomic");
    expected("INVALID_OUTPUT", () -> mesh.vertexInto(0L, doubles, 4)); check(Arrays.equals(before, doubles), "short vertex output atomic");
    mesh.vertexInto(0L, doubles, 2); check(doubles[0] == 11 && doubles[1] == 12 && doubles[5] == 16, "vertex sentinels retained");
    check(Arrays.equals(Arrays.copyOfRange(doubles, 2, 5), mesh.vertexAt(0L)), "vertexInto correct triple");
    double[] normalSlots = { 31, 32, 33, 34, 35 }; mesh.normalInto(0L, normalSlots, 1);
    check(normalSlots[0] == 31 && normalSlots[4] == 35, "normal sentinels retained");
    check(Arrays.equals(Arrays.copyOfRange(normalSlots, 1, 4), mesh.normalAt(0L)), "normalInto correct triple");

    int[] ints = { 21, 22, 23, 24, 25, 26 }; int[] intsBefore = ints.clone();
    expected("INVALID_INDEX", () -> mesh.triangleInto(-1L, ints, -1)); check(Arrays.equals(intsBefore, ints), "invalid triangle index atomic");
    expected("INDEX_OUT_OF_RANGE", () -> mesh.triangleInto((long) mesh.faceCount(), ints, -1)); check(Arrays.equals(intsBefore, ints), "out-of-range triangle atomic");
    expected("INVALID_OUTPUT", () -> mesh.triangleInto(0L, null, 0)); check(Arrays.equals(intsBefore, ints), "null triangle output atomic");
    expected("INVALID_OUTPUT", () -> mesh.triangleInto(0L, ints, 4)); check(Arrays.equals(intsBefore, ints), "short triangle output atomic");
    mesh.triangleInto(0L, ints, 1); check(ints[0] == 21 && ints[4] == 25 && ints[5] == 26, "triangle sentinels retained");
    check(Arrays.equals(Arrays.copyOfRange(ints, 1, 4), mesh.triangleAt(0L)), "triangleInto correct triple");
  }

  private static List<Object> profile17() {
    List<Object> out = new ArrayList<Object>();
    for (int i = 0; i < 17; i++) out.add(list((double) i, 1.0 + (i % 3) * .25));
    return out;
  }
  private static String workload(String id, List<Object> shape, int slices, int maximum, int warmups, int repetitions) {
    Map<String,Object> input = config(shape, (double) slices, Boolean.FALSE, Boolean.FALSE, (double) maximum);
    for (int i = 0; i < warmups; i++) sink ^= checksum(RadialProfile3D.generate(input));
    long elapsed = 0L, aggregate = 0L, first = 0L; int vertices = 0, faces = 0;
    for (int i = 0; i < repetitions; i++) {
      long started = System.nanoTime(); RadialProfile3D mesh = RadialProfile3D.generate(input); elapsed += System.nanoTime() - started;
      long current = checksum(mesh); if (i == 0) { first = current; vertices = mesh.vertexCount(); faces = mesh.faceCount(); }
      else { check(first == current && vertices == mesh.vertexCount() && faces == mesh.faceCount(), "repeat workload replay"); }
      aggregate = mix(aggregate, current);
    }
    sink ^= aggregate;
    long numericPayload = 24L * vertices + 44L * faces;
    return "{\"id\":\"" + id + "\",\"vertices\":" + vertices + ",\"faces\":" + faces
      + ",\"warmups\":" + warmups + ",\"repetitions\":" + repetitions + ",\"elapsed_nanos\":" + elapsed
      + ",\"checksum\":\"" + Long.toUnsignedString(first, 16) + "\",\"aggregate_checksum\":\""
      + Long.toUnsignedString(aggregate, 16) + "\",\"numeric_primitive_payload_bytes\":" + numericPayload + "}";
  }

  public static void main(String[] args) {
    try {
      carriers(); ownershipAndFreshReads(); accessAndAtomicity();
      RadialProfile3D one = RadialProfile3D.generate(ordinary()), two = RadialProfile3D.generate(ordinary());
      check(checksum(one) == checksum(two), "same-runtime raw-bit replay");
      exactReplay(one, two);
      String workloads = "[" + workload("tiny-2x3", profile(0.0, 1.0, 1.0, 1.0), 3, 100, 2, 3) + ","
        + workload("demonstrated-17x32", profile17(), 32, 2000, 1, 2) + ","
        + workload("bounded-17x3000", profile17(), 3000, 100000, 1, 2) + "]";
      Runtime runtime = Runtime.getRuntime();
      System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions
        + ",\"same_runtime_checksum\":\"" + Long.toUnsignedString(checksum(one), 16)
        + "\",\"heap_observation\":{\"max_bytes\":" + runtime.maxMemory() + ",\"total_bytes\":" + runtime.totalMemory()
        + ",\"free_bytes\":" + runtime.freeMemory() + ",\"note\":\"snapshot only; not an allocation measurement\"}"
        + ",\"resource_failure\":\"not executed; controlled allocation failure is not claimed\",\"workloads\":" + workloads + "}");
    } catch (Throwable error) {
      String message = String.valueOf(error).replace("\\", "\\\\").replace("\"", "'");
      System.out.println("{\"status\":\"failed\",\"assertions\":" + assertions + ",\"error\":\"" + message + "\"}");
      System.exit(1);
    }
  }
}
