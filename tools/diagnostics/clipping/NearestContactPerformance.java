import java.lang.management.ManagementFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.geometry.NearestSegmentContact2D;

/** Bounded candidate-core observation; not renderer or cross-target performance evidence. */
public final class NearestContactPerformance {
    public static void main(String[] args) {
        com.sun.management.ThreadMXBean bean=(com.sun.management.ThreadMXBean)ManagementFactory.getThreadMXBean();
        if(!bean.isThreadAllocatedMemorySupported())throw new IllegalStateException("allocation measurement unavailable");
        bean.setThreadAllocatedMemoryEnabled(true);
        for(int n:new int[]{4,64,256}) {
            List<List<Double>> queries=new ArrayList<List<Double>>(),obstacles=new ArrayList<List<Double>>();
            for(int i=0;i<n;i++) {
                queries.add(Arrays.asList(0d,(double)i,1000d,(double)i));
                obstacles.add(Arrays.asList(10d+i,-1d,10d+i,(double)n));
            }
            Map<String,Object> input=new LinkedHashMap<String,Object>();
            input.put("queries",queries);input.put("obstacles",obstacles);input.put("maxWork",(long)n*n);
            for(int warm=0;warm<2;warm++)verify(NearestSegmentContact2D.find(input),n);
            for(int repetition=0;repetition<3;repetition++) {
                long thread=Thread.currentThread().getId(),before=bean.getThreadAllocatedBytes(thread),start=System.nanoTime();
                NearestSegmentContact2D result=NearestSegmentContact2D.find(input);
                long elapsed=System.nanoTime()-start,allocated=bean.getThreadAllocatedBytes(thread)-before;
                long checksum=verify(result,n);
                System.out.println("{\"queries\":"+n+",\"obstacles\":"+n+",\"pair_tests\":"+((long)n*n)+",\"warmups\":2,\"repetition\":"+repetition+",\"elapsed_ns\":"+elapsed+",\"allocated_bytes\":"+allocated+",\"checksum\":\""+Long.toUnsignedString(checksum)+"\"}");
            }
        }
    }
    private static long verify(NearestSegmentContact2D result,int n) {
        if(result.size()!=n)throw new AssertionError("count");long checksum=0;
        for(int i=0;i<n;i++) {
            NearestSegmentContact2D.Contact hit=result.hitAt(i);
            if(hit==null||hit.obstacleIndex!=0||hit.x!=10||hit.y!=i||Double.doubleToRawLongBits(hit.t)!=Double.doubleToRawLongBits(.01))throw new AssertionError("nearest hit");
            checksum=checksum*31+Double.doubleToRawLongBits(hit.x)+Double.doubleToRawLongBits(hit.y);
        }
        return checksum;
    }
}
