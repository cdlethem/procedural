import java.lang.management.ManagementFactory;
import org.procedurals.raster.SeparableBlur2D;

/** Bounded desktop measurements, not portable latency guarantees. */
public final class SeparableBlurPerformance {
    private static volatile long consumed;
    private static double[] kernel(int radius) {
        double[] result = new double[radius*2+1];
        for (int i=0;i<result.length;i++) result[i]=radius+1-Math.abs(i-radius);
        return result;
    }
    private static long checksum(SeparableBlur2D result) {
        long h=0xcbf29ce484222325L;
        for (int i=0;i<result.width()*result.height();i++) h=(h^result.pixelAt(i))*0x100000001b3L;
        return h;
    }
    private static void measure(int width,int height,int radius) {
        int[] source=new int[width*height];
        for(int y=0;y<height;y++) for(int x=0;x<width;x++)
            source[y*width+x]=((x*13+y*17)&255)<<24|((x*7)&255)<<16|((y*11)&255)<<8|((x+y)&255);
        double[] k=kernel(radius);
        long work=(long)source.length*(k.length+k.length);
        long expected=checksum(SeparableBlur2D.blur(width,height,source,k,k,work));
        for(int i=0;i<2;i++) consumed=checksum(SeparableBlur2D.blur(width,height,source,k,k,work));
        com.sun.management.ThreadMXBean bean=(com.sun.management.ThreadMXBean)ManagementFactory.getThreadMXBean();
        boolean allocation=bean.isThreadAllocatedMemorySupported();
        if(allocation) bean.setThreadAllocatedMemoryEnabled(true);
        long thread=Thread.currentThread().getId();
        for(int i=0;i<3;i++) {
            long bytes=allocation?bean.getThreadAllocatedBytes(thread):-1;
            long start=System.nanoTime();
            SeparableBlur2D result=SeparableBlur2D.blur(width,height,source,k,k,work);
            long elapsed=System.nanoTime()-start;
            long allocated=allocation?bean.getThreadAllocatedBytes(thread)-bytes:-1;
            consumed=checksum(result);
            if(consumed!=expected) throw new AssertionError("unstable output");
            System.out.println("{\"width\":"+width+",\"height\":"+height+",\"radius\":"+radius
                +",\"declared_samples\":"+work+",\"iteration\":"+i+",\"elapsed_ns\":"+elapsed
                +",\"thread_allocated_bytes\":"+allocated+",\"checksum_hex\":\""+Long.toHexString(consumed)+"\"}");
        }
    }
    public static void main(String[] args) {
        measure(16,16,1);
        measure(720,480,12);
        measure(1440,960,24);
    }
}
