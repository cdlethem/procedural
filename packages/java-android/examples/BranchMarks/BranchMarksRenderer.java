package org.procedurals.examples.branchmarks;

import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.android.internal.Android2DFrame;
import org.procedurals.android.internal.AndroidFrameHost;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;
import org.procedurals.topology.BranchTree2D;

/** Native BranchMarks drawing inside an AndroidFrameHost completed-surface lease.
 * A blank frame supplies ownership/lifecycle only; lines and terminal dots are ordinary
 * Processing calls in the synchronous animation-thread consumer. These calls are
 * not additions to the portable segment2/quad2 command vocabulary.
 */
public final class BranchMarksRenderer {
    private static final int SIZE=640, BACKGROUND=0xf3f0e8;
    private BranchMarksRenderer() { }

    /** Detached PNG plus native tree/segment/tip counts, not portable command counts. */
    public static final class Result {
        public final int trees;
        public final long segments, tips;
        public final String renderer;
        private final byte[] png;
        Result(int trees,long segments,long tips,String renderer,byte[] png) {
            this.trees=trees;this.segments=segments;this.tips=tips;this.renderer=renderer;this.png=png.clone();
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
                                final BranchComposition model,boolean taper,int[] colors) {
        if(parent==null||host==null||model==null||colors==null)
            throw new IllegalArgumentException("parent, host, model, and colors are required");
        if(colors.length==0)throw new IllegalArgumentException("palette must not be empty");
        final long expectedSegments=model.totalSegments();
        final long[] counts=new long[2];
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
                    final double[] segment=new double[4];
                    long segments=0,tips=0;
                    for(int root=0;root<model.size();root++) {
                        BranchTree2D tree=model.treeAt(root);
                        for(int index=0;index<tree.size();index++) {
                            tree.segmentInto(index,segment,0);
                            int rgb=colors[Math.min(colors.length-1,tree.generationAt(index)/2)];
                            surface.stroke((rgb>>>16)&255,(rgb>>>8)&255,rgb&255);
                            surface.strokeWeight(taper?(float)Math.max(.65d,tree.lengthAt(index)*.035d):1f);
                            surface.line((float)segment[0],(float)segment[1],(float)segment[2],(float)segment[3]);
                            segments++;
                        }
                        if(taper) {
                            surface.noStroke();
                            int rgb=colors[colors.length-1];
                            surface.fill((rgb>>>16)&255,(rgb>>>8)&255,rgb&255);
                            for(int index=0;index<tree.size();index++) {
                                if(tree.childCountAt(index)!=0)continue;
                                tree.segmentInto(index,segment,0);
                                surface.ellipse((float)segment[2],(float)segment[3],4,4);
                                tips++;
                            }
                        }
                    }
                    if(segments!=expectedSegments)throw new AssertionError("native segment count changed");
                    counts[0]=segments;counts[1]=tips;
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
            return new Result(model.size(),counts[0],counts[1],output.getClass().getName(),png[0]);
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
