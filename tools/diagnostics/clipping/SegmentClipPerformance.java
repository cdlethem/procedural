import java.lang.management.ManagementFactory;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.geometry.SegmentClip2D;

/** Bounded desktop generation observations; excludes rendering and export allocation. */
public final class SegmentClipPerformance {
  private static volatile long sink;

  private static long checksum(SegmentClip2D result) {
    double[] segment=new double[4], interval=new double[2];
    long hash=1;
    for(int i=0;i<result.size();i++) {
      result.segmentInto(i,segment,0);result.intervalInto(i,interval,0);
      for(double v:segment) hash=31*hash+Double.doubleToRawLongBits(v);
      for(double v:interval) hash=31*hash+Double.doubleToRawLongBits(v);
      hash=31*hash+result.sourceIndexAt(i);
    }
    return hash;
  }
  private static void measure(int count, com.sun.management.ThreadMXBean bean) {
    java.util.List<java.util.List<Double>> polygon=new java.util.ArrayList<>();
    for(double[] p:new double[][]{{0,0},{600,0},{600,600},{400,600},{400,200},{200,200},{200,600},{0,600}})
      polygon.add(java.util.Arrays.asList(p[0],p[1]));
    java.util.List<java.util.List<Double>> strokes=new java.util.ArrayList<>();
    for(int i=0;i<count;i++) {
      double y=count==0?0:600.0*i/count;
      strokes.add(java.util.Arrays.asList(-100d,y,700d,y));
    }
    Map<String,Object> config=new LinkedHashMap<>();
    config.put("polygon",polygon);config.put("segments",strokes);
    config.put("maxWork",64L+count*648L);config.put("maxOutputSegments",count*2);
    long expected = checksum(SegmentClip2D.clip(config));
    for (int warmup = 0; warmup < 2; warmup++) sink = checksum(SegmentClip2D.clip(config));
    for (int repetition = 0; repetition < 3; repetition++) {
      long thread = Thread.currentThread().getId();
      long before = bean.getThreadAllocatedBytes(thread);
      long start = System.nanoTime();
      SegmentClip2D mesh = SegmentClip2D.clip(config);
      long elapsed = System.nanoTime() - start;
      long allocated = bean.getThreadAllocatedBytes(thread) - before;
      sink = checksum(mesh);
      if (sink != expected) throw new AssertionError("generation checksum changed");
      System.out.println("{\"source_segments\":" + count + ",\"output_segments\":" + mesh.size()
        + ",\"elapsed_ns\":" + elapsed + ",\"allocated_bytes\":" + allocated
        + ",\"checksum\":\"" + Long.toHexString(sink) + "\"}");
    }
  }

  public static void main(String[] args) {
    com.sun.management.ThreadMXBean bean =
      (com.sun.management.ThreadMXBean) ManagementFactory.getThreadMXBean();
    if (!bean.isThreadAllocatedMemorySupported()) throw new IllegalStateException("allocation counter unavailable");
    bean.setThreadAllocatedMemoryEnabled(true);
    for (int count : new int[]{0, 100, 1000}) measure(count, bean);
  }
}
