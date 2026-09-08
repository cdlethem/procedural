import java.util.*;
import java.util.function.Consumer;
import processing.core.PApplet;
import processing.awt.PGraphicsJava2D;
import org.procedurals.color.CyclicPalette;
import org.procedurals.processing.internal.Java2DFrame;

/** Editable example composition motivated by 2018/Generativos/pelines and the accepted
 * CP1 command route. No additional public operation or artistic parameter range.
 * The internal drawing adapter is supplied by this starter's matching library version.
 */
public final class MarkCommands {
    static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result=new LinkedHashMap<>();
        for(int i=0;i<pairs.length;i+=2)result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
    static List<Double> point(double x,double y) { return Arrays.asList(x,y); }

    // Change the mark treatment here; the retained spatial attributes remain separate.
    static Map<String,Object> mark(double x,double y,double heading,double length,int rgb,boolean bars) {
        double cos=Math.cos(heading),sin=Math.sin(heading);
        double dx=.5*length*cos,dy=.5*length*sin;
        if(bars) {
            double nx=-sin*1.25,ny=cos*1.25;
            return map("kind","quad2","vertices",Arrays.asList(
                point(x-dx-nx,y-dy-ny),point(x+dx-nx,y+dy-ny),
                point(x+dx+nx,y+dy+ny),point(x-dx+nx,y-dy+ny)),"rgb",rgb,"opacity8",180);
        }
        return map("kind","segment2","from",point(x-dx,y-dy),"to",point(x+dx,y+dy),
            "rgb",rgb,"opacity8",180,"width",1,"cap","round");
    }

    // Batches are synchronous: a sink must consume a batch before this method reuses it.
    static void stream(MarkField marks,double maxLength,int[] colors,boolean bars,Consumer<List<Object>> sink) {
        Integer[] entries=new Integer[colors.length];
        for(int i=0;i<colors.length;i++)entries[i]=colors[i];
        CyclicPalette palette=CyclicPalette.create(Collections.singletonMap("colors",Arrays.asList(entries)));
        List<Object> batch=new ArrayList<>();
        for(int i=0;i<marks.x.length;i++) {
            double length=maxLength*marks.lengthFactor[i];
            if(length==0)continue;
            batch.add(mark(marks.x[i],marks.y[i],marks.heading[i],length,
                palette.sample(marks.colourCycles[i]),bars));
            if(batch.size()==4096) { sink.accept(batch);batch.clear(); }
        }
        sink.accept(batch);
    }

    public static void paint(PApplet parent,MarkField marks,double maxLength,int[] colors,boolean bars) {
        Java2DFrame frame=new Java2DFrame(parent);
        PGraphicsJava2D completed=null;
        Throwable primary=null;
        try {
            frame.begin(map("width",640,"height",640,"density",1,"background",0xece7da));
            stream(marks,maxLength,colors,bars,frame::batch);
            completed=frame.end();
            parent.image(completed,0,0);
        } catch(RuntimeException | Error failure) {
            primary=failure;
            throw failure;
        } finally {
            try {
                if(completed!=null)Java2DFrame.releaseCompleted(completed);
                else if(!frame.state().equals("completed"))frame.abort();
            } catch(RuntimeException | Error cleanup) {
                if(primary==null)throw cleanup;
                if(cleanup!=primary)primary.addSuppressed(cleanup);
            }
        }
    }
}
