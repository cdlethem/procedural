import java.lang.management.ManagementFactory;
import org.procedurals.geometry.DiscProjection2D;

/** Bounded typed-buffer desktop observations; not renderer or latency guarantees. */
public final class DiscProjectionPerformance {
    private static volatile double sink;
    private static double checksum(DiscProjection2D result) {
        double[] point = new double[2]; double sum = 0;
        for (int i=0;i<result.size();i++) { result.pointInto(i,point,0); sum+=point[0]+point[1]; }
        return sum;
    }
    private static void measure(int count,int discCount) {
        double[] points=new double[count*2], discs=new double[discCount*3];
        for(int i=0;i<count;i++){points[2*i]=(i*17)%720;points[2*i+1]=(i*23)%480;}
        for(int i=0;i<discCount;i++){discs[3*i]=(i*61)%720;discs[3*i+1]=(i*47)%480;discs[3*i+2]=75;}
        long work=(long)count*discCount;
        double expected=checksum(DiscProjection2D.project(points,discs,.45,work));
        for(int i=0;i<2;i++) sink=checksum(DiscProjection2D.project(points,discs,.45,work));
        com.sun.management.ThreadMXBean bean=(com.sun.management.ThreadMXBean)ManagementFactory.getThreadMXBean();
        bean.setThreadAllocatedMemoryEnabled(true);
        for(int i=0;i<3;i++) {
            long thread=Thread.currentThread().getId(), before=bean.getThreadAllocatedBytes(thread), start=System.nanoTime();
            DiscProjection2D result=DiscProjection2D.project(points,discs,.45,work);
            long elapsed=System.nanoTime()-start,allocated=bean.getThreadAllocatedBytes(thread)-before;
            sink=checksum(result);if(Double.doubleToLongBits(sink)!=Double.doubleToLongBits(expected))throw new AssertionError("unstable checksum");
            System.out.println("{\"points\":"+count+",\"discs\":"+discCount+",\"tests\":"+work+",\"elapsed_ns\":"+elapsed+",\"allocated_bytes\":"+allocated+",\"checksum\":"+sink+"}");
        }
    }
    public static void main(String[] args){measure(8,2);measure(1693,4);measure(100000,64);}
}
