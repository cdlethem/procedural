import java.lang.management.ManagementFactory;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.mesh.AnnularMesh3D;

/** Bounded desktop generation observations; excludes rendering and export allocation. */
public final class AnnularMeshPerformance {
  private static volatile long sink;

  private static long checksum(AnnularMesh3D mesh) {
    double[] triple = new double[3];
    int[] indices = new int[3];
    long hash = 1;
    for (long vertex = 0; vertex < mesh.vertexCount(); vertex++) {
      mesh.vertexInto(vertex, triple, 0);
      for (double value : triple) hash = 31 * hash + Double.doubleToRawLongBits(value);
    }
    for (long face = 0; face < mesh.faceCount(); face++) {
      mesh.normalInto(face, triple, 0);
      for (double value : triple) hash = 31 * hash + Double.doubleToRawLongBits(value);
      mesh.triangleInto(face, indices, 0);
      for (int value : indices) hash = 31 * hash + value;
      hash = 31 * hash + mesh.cellAt(face);
      hash = 31 * hash + mesh.faceKindAt(face).hashCode();
    }
    return hash;
  }

  private static void measure(int slices, com.sun.management.ThreadMXBean bean) {
    Map<String, Object> config = new LinkedHashMap<String, Object>();
    config.put("outerRadius", 150.0);
    config.put("innerRadius", 110.0);
    config.put("bottomZ", -15.0);
    config.put("topZ", 15.0);
    config.put("slices", slices);
    config.put("maxFaces", 8 * slices);
    long expected = checksum(AnnularMesh3D.generate(config));
    for (int warmup = 0; warmup < 2; warmup++) sink = checksum(AnnularMesh3D.generate(config));
    for (int repetition = 0; repetition < 3; repetition++) {
      long thread = Thread.currentThread().getId();
      long before = bean.getThreadAllocatedBytes(thread);
      long start = System.nanoTime();
      AnnularMesh3D mesh = AnnularMesh3D.generate(config);
      long elapsed = System.nanoTime() - start;
      long allocated = bean.getThreadAllocatedBytes(thread) - before;
      sink = checksum(mesh);
      if (sink != expected) throw new AssertionError("generation checksum changed");
      System.out.println("{\"slices\":" + slices + ",\"faces\":" + mesh.faceCount()
        + ",\"elapsed_ns\":" + elapsed + ",\"allocated_bytes\":" + allocated
        + ",\"checksum\":\"" + Long.toHexString(sink) + "\"}");
    }
  }

  public static void main(String[] args) {
    com.sun.management.ThreadMXBean bean =
      (com.sun.management.ThreadMXBean) ManagementFactory.getThreadMXBean();
    if (!bean.isThreadAllocatedMemorySupported()) throw new IllegalStateException("allocation counter unavailable");
    bean.setThreadAllocatedMemoryEnabled(true);
    for (int slices : new int[]{3, 48, 10000}) measure(slices, bean);
  }
}
