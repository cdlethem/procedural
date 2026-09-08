package org.procedurals.examples.regionmarks;

import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.android.internal.Android2DFrame;
import org.procedurals.android.internal.AndroidFrameHost;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;

/** Native RegionMarks drawing inside an AndroidFrameHost completed-surface lease.
 * A blank frame supplies ownership/lifecycle only; cells and circles are ordinary
 * Processing calls in the synchronous animation-thread consumer. These calls are
 * not additions to the portable segment2/quad2 command vocabulary.
 */
public final class RegionMarksRenderer {
    private static final int SIZE=640, BACKGROUND=0xf3f0e8;
    private RegionMarksRenderer() { }

    /** Detached PNG plus native cell/mark counts, not portable command counts. */
    public static final class Result {
        public final int cells;
        public final long marks;
        public final String renderer;
        private final byte[] png;
        Result(int cells,long marks,String renderer,byte[] png) {
            this.cells=cells;this.marks=marks;this.renderer=renderer;this.png=png.clone();
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
                                final RegionComposition model,boolean gridMarks,int[] colors) {
        if(parent==null||host==null||model==null||colors==null)
            throw new IllegalArgumentException("parent, host, model, and colors are required");
        if(colors.length==0)throw new IllegalArgumentException("palette must not be empty");
        final long expectedMarks=(long)model.size()*(gridMarks?9:1);
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
                    surface.noStroke();
                    final double[] bounds=new double[4],point=new double[2];
                    long marks=0;
                    for(int index=0;index<model.size();index++) {
                        model.boundsInto(index,bounds);
                        double w=bounds[2]-bounds[0],h=bounds[3]-bounds[1];
                        double inset=Math.min(1.0d,Math.min(w,h)*0.05d);
                        int rgb=colors[model.idAt(index)%colors.length];
                        surface.fill((rgb>>>16)&255,(rgb>>>8)&255,rgb&255,190);
                        surface.rect((float)(bounds[0]+inset),(float)(bounds[1]+inset),
                                     (float)(w-2*inset),(float)(h-2*inset));
                        surface.fill(255,245);
                        if(gridMarks) {
                            float diameter=(float)(Math.min(w,h)/12);
                            for(int mark=0;mark<9;mark++) {
                                model.markInto(mark,bounds,point);
                                surface.ellipse((float)point[0],(float)point[1],diameter,diameter);
                                marks++;
                            }
                        } else {
                            float diameter=(float)(Math.min(w,h)*0.28d);
                            surface.ellipse((float)(bounds[0]+w*0.5d),(float)(bounds[1]+h*0.5d),diameter,diameter);
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
