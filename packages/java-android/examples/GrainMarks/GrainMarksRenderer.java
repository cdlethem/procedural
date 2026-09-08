package org.procedurals.examples.grainmarks;

import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.android.internal.Android2DFrame;
import org.procedurals.android.internal.AndroidFrameHost;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;
import org.procedurals.sampling.TrianglePoints2D;

/** Native GrainMarks drawing inside an AndroidFrameHost completed-surface lease.
 * A blank frame supplies ownership/lifecycle only; points and strokes are ordinary
 * Processing calls in the synchronous animation-thread consumer. These calls are
 * not additions to the portable segment2/quad2 command vocabulary.
 */
public final class GrainMarksRenderer {
    private static final int SIZE=640, BACKGROUND=0xf3f0e8;
    private GrainMarksRenderer() { }

    /** Detached PNG plus native region/mark counts, not portable command counts. */
    public static final class Result {
        public final int regions;
        public final long marks;
        public final String renderer;
        private final byte[] png;
        Result(int regions,long marks,String renderer,byte[] png) {
            this.regions=regions;this.marks=marks;this.renderer=renderer;this.png=png.clone();
        }
        public byte[] pngBytes() { return png.clone(); }
    }

    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        for(int i=0;i<pairs.length;i+=2)result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
    /** Draw only on the host animation thread; callback may not wait on the UI. */
    public static Result render(final PApplet parent,final AndroidFrameHost host,
                                final GrainComposition model,boolean strokes,int[] colors) {
        if(parent==null||host==null||model==null||colors==null)
            throw new IllegalArgumentException("parent, host, model, and colors are required");
        if(colors.length==0)throw new IllegalArgumentException("palette must not be empty");
        final long expectedMarks=model.totalPoints();
        final Android2DFrame frame=new Android2DFrame(host);
        final byte[][] png=new byte[1][];
        PGraphicsAndroid2D completed=null;
        boolean consumed=false;
        Throwable primary=null;
        try {
            frame.begin(map("width",SIZE,"height",SIZE,"density",1,"background",BACKGROUND));
            completed=frame.end();
            final PGraphicsAndroid2D output=completed;
            host.consumeCompleted(output,surface -> {
                surface.beginDraw();
                try {
                    surface.strokeWeight(1);
                    final double[] point=new double[2];
                    long marks=0;
                    for(int region=0;region<model.size();region++) {
                        TrianglePoints2D points=model.regionAt(region);
                        int rgb=colors[region%colors.length];
                        surface.stroke((rgb>>>16)&255,(rgb>>>8)&255,rgb&255,150);
                        for(int index=0;index<points.size();index++) {
                            points.pointInto(index,point,0);
                            float x=(float)point[0],y=(float)point[1];
                            if(strokes)surface.line(x-2,y,x+2,y);
                            else surface.point(x,y);
                            marks++;
                        }
                    }
                    if(marks!=expectedMarks)throw new AssertionError("native mark count changed");
                } finally { surface.endDraw(); }

                Object nativeValue=surface.getNative();
                if(!(nativeValue instanceof Bitmap)||((Bitmap)nativeValue).isRecycled())
                    throw new IllegalStateException("completed Android bitmap is unavailable");
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                if(!((Bitmap)nativeValue).compress(Bitmap.CompressFormat.PNG,100,bytes))
                    throw new IllegalStateException("Android PNG compression failed");
                png[0]=bytes.toByteArray();
                parent.image(surface,0,0,parent.width,parent.height);
            });
            consumed=true;
            if(png[0]==null||png[0].length==0)throw new IllegalStateException("Android PNG output is empty");
            return new Result(model.size(),expectedMarks,output.getClass().getName(),png[0]);
        }catch(RuntimeException | Error failure){
            primary=failure;throw failure;
        }finally{
            if(completed!=null&&!consumed)try {host.releaseCompleted(completed);}
            catch(RuntimeException | Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
            if(completed==null&&!"completed".equals(frame.state()))try {frame.abort();}
            catch(RuntimeException | Error cleanup){if(primary!=null)primary.addSuppressed(cleanup);else throw cleanup;}
        }
    }
}
