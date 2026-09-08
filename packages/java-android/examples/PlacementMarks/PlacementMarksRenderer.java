package org.procedurals.examples.placementmarks;

import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.android.internal.Android2DFrame;
import org.procedurals.android.internal.AndroidFrameHost;
import org.procedurals.sampling.CirclePlacements2D;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;

/** Android renderer for the shared PlacementComposition motif outlines.
 *
 * <p>The Android2D command vocabulary submits stroked outlines as sequences of
 * round-capped {@code segment2} commands, the established Android polyline
 * convention used by the accepted PathMarks trace. Motif junctions are therefore
 * rendered by overlapping round caps rather than one closed path; this is a
 * documented platform difference from the host JVM PDE, not a different
 * technique. The fixed 640 square output is a composition choice.</p>
 */
public final class PlacementMarksRenderer {
    private static final int SIZE=640, BACKGROUND=0xece7da, BATCH_SIZE=4096;
    private PlacementMarksRenderer() { }

    /** Immutable successful render statistics and a detached PNG snapshot. */
    public static final class Result {
        public final int accepted;
        public final long proposals;
        public final long submittedCommands;
        public final String renderer;
        private final byte[] png;
        Result(int accepted,long proposals,long submittedCommands,String renderer,byte[] png) {
            this.accepted=accepted;this.proposals=proposals;this.submittedCommands=submittedCommands;
            this.renderer=renderer;this.png=png.clone();
        }
        public byte[] pngBytes() { return png.clone(); }
    }

    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        for(int i=0;i<pairs.length;i+=2)result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
    private static List<Double> point(double x,double y) { return Arrays.asList(x,y); }

    /** Consume the retained placement's bounded motif vertices on the Android
     * animation thread. Rings submit 64 segments; diamonds submit 4. */
    public static Result render(final PApplet parent,final AndroidFrameHost host,
                                final PlacementComposition model,boolean diamonds,int[] colors) {
        if(parent==null||host==null||model==null||colors==null)
            throw new IllegalArgumentException("parent, host, model, and colors are required");
        final CirclePlacements2D placements=model.placements();
        final int vertices=diamonds?4:64;
        final long expected=(long)placements.size()*vertices;
        final Android2DFrame frame=new Android2DFrame(host);
        final byte[][] png=new byte[1][];
        PGraphicsAndroid2D completed=null;
        boolean consumed=false;
        Throwable primary=null;
        try {
            frame.begin(map("width",SIZE,"height",SIZE,"density",1,"background",BACKGROUND));
            final List<Object> batch=new ArrayList<Object>(BATCH_SIZE);
            final double[] vertex=new double[2];
            for(int index=0;index<placements.size();index++) {
                int rgb=colors[(int)placements.sourceIndexAt(index)%colors.length];
                for(int j=0;j<vertices;j++) {
                    model.vertexInto(index,j,diamonds,vertex);
                    double ax=vertex[0],ay=vertex[1];
                    model.vertexInto(index,(j+1)%vertices,diamonds,vertex);
                    batch.add(map("kind","segment2","from",point(ax,ay),"to",point(vertex[0],vertex[1]),
                        "rgb",rgb,"opacity8",255,"width",1,"cap","round"));
                    if(batch.size()==BATCH_SIZE){frame.batch(batch);batch.clear();}
                }
            }
            frame.batch(batch);
            if(frame.count()!=expected)throw new AssertionError("submitted command count changed");
            completed=frame.end();
            final PGraphicsAndroid2D output=completed;
            host.consumeCompleted(output,surface -> {
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
            return new Result(placements.size(),placements.attempts(),frame.count(),
                output.getClass().getName(),png[0]);
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
