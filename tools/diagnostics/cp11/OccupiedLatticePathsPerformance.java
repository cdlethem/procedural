package org.procedurals.paths;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.lang.management.ManagementFactory;

/** Private representative Java core timing probe; not a latency guarantee. */
public final class OccupiedLatticePathsPerformance {
  private static volatile long consumed;
  private static final com.sun.management.ThreadMXBean ALLOCATION = allocationBean();
  private static com.sun.management.ThreadMXBean allocationBean(){java.lang.management.ThreadMXBean b=ManagementFactory.getThreadMXBean();if(!(b instanceof com.sun.management.ThreadMXBean))return null;com.sun.management.ThreadMXBean a=(com.sun.management.ThreadMXBean)b;if(!a.isThreadAllocatedMemorySupported())return null;if(!a.isThreadAllocatedMemoryEnabled())a.setThreadAllocatedMemoryEnabled(true);return a;}
  private static long allocated(){return ALLOCATION==null?-1L:ALLOCATION.getThreadAllocatedBytes(Thread.currentThread().getId());}
  private static List<Object> list(Object... v) { return new ArrayList<Object>(Arrays.asList(v)); }
  private static Map<String,Object> map(Object... v) { Map<String,Object> m=new LinkedHashMap<String,Object>();for(int i=0;i<v.length;i+=2)m.put((String)v[i],v[i+1]);return m; }
  private static Map<String,Object> config(int columns,int rows,List<Object> starts,int steps,int cells) { return map("dimensions",list(columns,rows),"starts",starts,"maxSteps",steps,"maxCells",cells,"random",map("seed",42)); }
  private static long checksum(OccupiedLatticePaths2D paths) { long h=1469598103934665603L;for(long p=0;p<paths.pathCount();p++){h=(h^paths.pathLengthAt(p))*1099511628211L;for(long c=0;c<paths.pathLengthAt(p);c++){int[] cell=paths.cellAt(p,c);h=(h^cell[0])*1099511628211L;h=(h^cell[1])*1099511628211L;}}return h; }
  private static void workload(String name,Map<String,Object> config) { long expected=checksum(OccupiedLatticePaths2D.generate(config)); for(int i=0;i<3;i++){long actual=checksum(OccupiedLatticePaths2D.generate(config));if(actual!=expected)throw new AssertionError("warmup checksum");consumed=actual;} long[] ns=new long[5], bytes=new long[5];for(int i=0;i<5;i++){long before=allocated(),start=System.nanoTime();OccupiedLatticePaths2D p=OccupiedLatticePaths2D.generate(config);ns[i]=System.nanoTime()-start;bytes[i]=before<0?-1:allocated()-before;long actual=checksum(p);if(actual!=expected)throw new AssertionError("repeat checksum");consumed=actual;}System.out.println("{\"kind\":\"workload\",\"name\":\""+name+"\",\"generation_nanos\":"+Arrays.toString(ns)+",\"generation_allocated_bytes\":"+Arrays.toString(bytes)+",\"checksum\":\""+Long.toUnsignedString(expected,16)+"\"}"); }
  private static List<Object> authoredStarts(int stride) {
    List<Object> starts = new ArrayList<Object>();
    for (int i = 0; i < 12; i++) {
      int index = (13 * i) % 36;
      starts.add(list(stride * (2 + 4 * (index % 6)), stride * (2 + 4 * (index / 6))));
    }
    return starts;
  }
  public static void main(String[] args) {
    workload("authored-24x24", config(24,24,authoredStarts(1),12,156));
    workload("scaled-48x48", config(48,48,authoredStarts(2),24,300));
    workload("maximum-dimensions-sparse",config(2147483647,2147483647,list(list(2147483646,2147483646)),0,1));
    System.out.println("{\"kind\":\"complete\",\"allocation_supported\":"+(ALLOCATION!=null)+",\"status\":\"passed\"}");
  }
}
