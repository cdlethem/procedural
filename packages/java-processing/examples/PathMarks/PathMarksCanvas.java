import org.procedurals.examples.pathmarks.PathMarkComposition;
import java.util.LinkedHashMap;
import java.util.Map;
import processing.core.PApplet;
import processing.awt.PGraphicsJava2D;
import org.procedurals.processing.internal.Java2DFrame;

/** Native frame ownership supplied by this versioned starter, separate from movement. */
public final class PathMarksCanvas {
    public static long paint(PApplet parent,PathMarkComposition movement,boolean trace,double length,int[] colors) {
        Java2DFrame frame=new Java2DFrame(parent);
        PGraphicsJava2D completed=null;
        Throwable primary=null;
        try {
            Map<String,Object> config=new LinkedHashMap<String,Object>();
            config.put("width",640); config.put("height",640);
            config.put("density",1); config.put("background",0xece7da);
            frame.begin(config);
            movement.streamForCanvas(trace,length,colors,frame::batch);
            completed=frame.end();
            parent.image(completed,0,0);
            return frame.count();
        } catch(RuntimeException | Error failure) {
            primary=failure; throw failure;
        } finally {
            try {
                if(completed!=null) Java2DFrame.releaseCompleted(completed);
                else if(!frame.state().equals("completed")) frame.abort();
            } catch(RuntimeException | Error cleanup) {
                if(primary==null) throw cleanup;
                if(cleanup!=primary) primary.addSuppressed(cleanup);
            }
        }
    }
}
