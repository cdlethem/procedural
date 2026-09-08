package org.procedurals.examples.pathmarks;

import android.graphics.Bitmap;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.android.internal.Android2DFrame;
import org.procedurals.android.internal.AndroidFrameHost;
import processing.a2d.PGraphicsAndroid2D;
import processing.core.PApplet;

/** Android adapter for the shared PathMarkComposition command generator. */
public final class PathMarksRenderer {
    private static final int SIZE=640, BACKGROUND=0xece7da;
    private PathMarksRenderer() { }

    public static final class Result {
        public final long rawCommands;
        public final long submittedCommands;
        public final String renderer;
        private final byte[] png;
        Result(long rawCommands, long submittedCommands, String renderer, byte[] png) {
            this.rawCommands=rawCommands; this.submittedCommands=submittedCommands; this.renderer=renderer; this.png=png.clone();
        }
        public byte[] pngBytes() { return png.clone(); }
    }

    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
    private static void suppress(Throwable primary, Throwable cleanup) {
        if(primary!=cleanup) primary.addSuppressed(cleanup);
    }

    /** Consume the composition's bounded command batches on the Android animation thread. */
    public static Result render(final PApplet parent, final AndroidFrameHost host,
                                final PathMarkComposition model, boolean trace,
                                double markLength, int[] colors) {
        if(parent==null || host==null || model==null || colors==null)
            throw new IllegalArgumentException("parent, host, model, and colors are required");
        final Android2DFrame frame=new Android2DFrame(host);
        long rawCommands=0;
        for(int index=0;index<model.pathCount();index++) {
            long steps=model.pathAt(index).steps();
            rawCommands+=trace?steps:(steps+3L)/4L;
        }
        final long[] submittedCommands={0}; final byte[][] png={null};
        PGraphicsAndroid2D completed=null; boolean consumed=false; Throwable primary=null;
        try {
            frame.begin(map("width",SIZE,"height",SIZE,"density",1,"background",BACKGROUND));
            model.streamForCanvas(trace,markLength,colors,batch -> {
                submittedCommands[0]+=batch.size();
                frame.batch(batch);
            });
            if(frame.count()!=submittedCommands[0]) throw new AssertionError("submitted command count changed");
            completed=frame.end();
            final PGraphicsAndroid2D output=completed;
            host.consumeCompleted(output,surface -> {
                Object nativeValue=surface.getNative();
                if(!(nativeValue instanceof Bitmap) || ((Bitmap)nativeValue).isRecycled())
                    throw new IllegalStateException("completed Android bitmap is unavailable");
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                if(!((Bitmap)nativeValue).compress(Bitmap.CompressFormat.PNG,100,bytes))
                    throw new IllegalStateException("Android PNG compression failed");
                png[0]=bytes.toByteArray();
                parent.image(surface,0,0,parent.width,parent.height);
            });
            consumed=true;
            if(png[0]==null || png[0].length==0) throw new IllegalStateException("Android PNG output is empty");
            return new Result(rawCommands,submittedCommands[0],output.getClass().getName(),png[0]);
        } catch(RuntimeException | Error failure) {
            primary=failure; throw failure;
        } finally {
            if(completed!=null && !consumed) try { host.releaseCompleted(completed); }
            catch(RuntimeException | Error cleanup) { if(primary!=null) suppress(primary,cleanup); else throw cleanup; }
            if(completed==null && !"completed".equals(frame.state())) try { frame.abort(); }
            catch(RuntimeException | Error cleanup) { if(primary!=null) suppress(primary,cleanup); else throw cleanup; }
        }
    }
}
