package org.procedurals.motion;

import java.lang.management.ManagementFactory;
import java.util.*;

/** Native CP10 observations; workload choices are not public artistic ranges. */
public final class TargetSpringsPerformance {
  private static volatile double sink;
  private static Map<String,Object> record(Object... entries) {
    Map<String,Object> m = new LinkedHashMap<String,Object>();
    for (int i=0;i<entries.length;i+=2) m.put((String)entries[i],entries[i+1]);
    return m;
  }
  private static Object state(int n) {
    List<Object> bodies=new ArrayList<Object>(n);
    for(int i=0;i<n;i++) bodies.add(record("position",Arrays.asList((double)(i%256),(double)(i/256)),
      "velocity",Arrays.asList(0d,0d),"strength",0.025d,"retention",0.7d));
    return record("bodies",bodies);
  }
  public static void main(String[] args) {
    java.lang.management.ThreadMXBean base=ManagementFactory.getThreadMXBean();
    if(!(base instanceof com.sun.management.ThreadMXBean))
      throw new IllegalStateException("runtime cannot measure per-thread allocation");
    com.sun.management.ThreadMXBean bean=(com.sun.management.ThreadMXBean)base;
    if(!bean.isThreadAllocatedMemorySupported()) throw new IllegalStateException("allocation unsupported");
    bean.setThreadAllocatedMemoryEnabled(true);
    long thread=Thread.currentThread().getId();
    int[] counts={0,1,49,512,4096,65536};
    System.out.print("{\"status\":\"measured\",\"workloads\":[");
    for(int w=0;w<counts.length;w++) {
      int n=counts[w]; Object input=state(n);
      long allocated=bean.getThreadAllocatedBytes(thread), started=System.nanoTime();
      TargetSprings2D spring=TargetSprings2D.create(input);
      long setupNanos=System.nanoTime()-started;
      long setupBytes=bean.getThreadAllocatedBytes(thread)-allocated;
      double[] targets=new double[n*2], pair=new double[2];
      for(int i=0;i<n;i++) {targets[i*2]=i%256+10;targets[i*2+1]=i/256-5;}
      int warm=n<4096?10000:500, repetitions=n<4096?10000:500;
      // A periodic explicit disturbance prevents a benchmark consisting only of rest.
      for(int k=0;k<warm;k++) {
        if(n>0)targets[0]=((k/32)%2==0)?10:-10;
        spring.step(targets);
      }
      allocated=bean.getThreadAllocatedBytes(thread);started=System.nanoTime();
      for(int k=0;k<repetitions;k++) {
        if(n>0)targets[0]=((k/32)%2==0)?10:-10;
        spring.step(targets);
      }
      long elapsed=System.nanoTime()-started;
      long bytes=bean.getThreadAllocatedBytes(thread)-allocated;
      long traversalStarted=System.nanoTime();
      double checksum=0;
      for(int i=0;i<n;i++) {
        spring.positionInto((long)i,pair,0);checksum+=pair[0]+pair[1];
        spring.velocityInto((long)i,pair,0);checksum+=pair[0]+pair[1];
      }
      long traversalNanos=System.nanoTime()-traversalStarted;sink=checksum;
      if(!Double.isFinite(checksum)) throw new AssertionError("nonfinite checksum");
      if(w!=0)System.out.print(",");
      System.out.print("{\"bodies\":"+n+",\"warmup_steps\":"+warm+",\"measured_steps\":"+repetitions+
        ",\"setup_ns\":"+setupNanos+",\"setup_allocated_bytes\":"+setupBytes+
        ",\"step_total_ns\":"+elapsed+",\"step_allocated_bytes\":"+bytes+
        ",\"observation_traversal_ns\":"+traversalNanos+",\"checksum_hex\":\""+Double.toHexString(checksum)+"\"}");
    }
    System.out.println("]}");
  }
}
