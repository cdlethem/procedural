package org.procedurals.examples.pathmarks;

import java.util.*;
import java.util.function.Consumer;
import org.procedurals.layout.RegularGrid;
import org.procedurals.paths.GradientPath2D;
import org.procedurals.color.CyclicPalette;

/** Editable composition motivated by ciserp, mantel, natalata and limo002.
 * See design/capabilities/cp2-public-example.md for provenance and deliberate differences.
 * The constants describe this piece, not library defaults or recommended ranges.
 */
public strictfp final class PathMarkComposition {
    private final GradientPath2D[] paths;
    private PathMarkComposition(GradientPath2D[] paths) { this.paths=paths; }

    /** Trace starts sequentially; retain movement so later style edits do no integration. */
    public static PathMarkComposition create(long seed,int steps,double distance) {
        RegularGrid starts=RegularGrid.create(map("origin",point(60,80),
            "spacing",point(104,160),"columns",6,"rows",4));
        GradientPath2D[] paths=new GradientPath2D[(int)starts.size()];
        double[] start=new double[2];
        for(int i=0;i<paths.length;i++) {
            starts.pointInto(i,start,0);
            paths[i]=GradientPath2D.trace(map(
                "field",Collections.singletonMap("seed",seed),
                "start",point(start[0],start[1]),"steps",steps,"stepDistance",distance,
                "fieldScale",0.002,"fieldOffset",point(0,0),"angleBase",-20,"angleScale",40));
        }
        return new PathMarkComposition(paths);
    }

    public int pathCount() { return paths.length; }
    public GradientPath2D pathAt(int index) { return paths[index]; }

    /** Invent another mark here; heading is the movement that arrived at this endpoint. */
    public static Map<String,Object> mark(double x,double y,double heading,double length,int rgb) {
        double perpendicular=heading+Math.PI/2.0;
        double half=length*0.5,dx=half*Math.cos(perpendicular),dy=half*Math.sin(perpendicular);
        return segment(x-dx,y-dy,x+dx,y+dy,rgb);
    }

    /** The synchronous sink consumes each batch before this method reuses it. */
    public void stream(boolean trace,double markLength,int[] colors,Consumer<List<Object>> sink) {
        Integer[] entries=new Integer[colors.length];
        for(int i=0;i<colors.length;i++) entries[i]=colors[i];
        CyclicPalette palette=CyclicPalette.create(Collections.singletonMap("colors",Arrays.asList(entries)));
        List<Object> batch=new ArrayList<Object>(4096);
        double[] from=new double[2],to=new double[2];
        for(int p=0;p<paths.length;p++) {
            GradientPath2D path=paths[p];
            int rgb=palette.sample((p%colors.length)/(double)colors.length);
            for(int i=0;i<path.steps();i+=trace?1:4) {
                path.pointInto(i+1,to,0);
                if(trace) {
                    path.pointInto(i,from,0);
                    batch.add(segment(from[0],from[1],to[0],to[1],rgb));
                } else {
                    batch.add(mark(to[0],to[1],path.headingAt(i),markLength,rgb));
                }
                if(batch.size()==4096) { sink.accept(batch); batch.clear(); }
            }
        }
        if(!batch.isEmpty()) sink.accept(batch);
    }

    /** Fixed-canvas drawing route; keep raw movement and command generation unchanged.
     * Cull only segments whose entire bounding box misses the canvas padded by one pixel.
     * The registered strokes have radius 0.5, so these segments cannot affect its pixels.
     * This is not general clipping: registered segment lengths are at most 24 pixels.
     */
    public void streamForCanvas(boolean trace,double length,int[] colors,Consumer<List<Object>> sink) {
        stream(trace,length,colors,batch -> {
            List<Object> visible=new ArrayList<Object>(batch.size());
            for(Object value:batch) {
                Map<?,?> command=(Map<?,?>)value;
                List<?> from=(List<?>)command.get("from"),to=(List<?>)command.get("to");
                double x1=((Number)from.get(0)).doubleValue(),y1=((Number)from.get(1)).doubleValue();
                double x2=((Number)to.get(0)).doubleValue(),y2=((Number)to.get(1)).doubleValue();
                if(Math.max(x1,x2)<-1 || Math.min(x1,x2)>641 || Math.max(y1,y2)<-1 || Math.min(y1,y2)>641) continue;
                visible.add(value);
            }
            if(!visible.isEmpty()) sink.accept(visible);
        });
    }

    private static Map<String,Object> segment(double x1,double y1,double x2,double y2,int rgb) {
        return map("kind","segment2","from",point(x1,y1),"to",point(x2,y2),
            "rgb",rgb,"opacity8",150,"width",1,"cap","round");
    }
    private static List<Double> point(double x,double y) { return Arrays.asList(x,y); }
    private static Map<String,Object> map(Object... pairs) {
        Map<String,Object> result=new LinkedHashMap<String,Object>();
        for(int i=0;i<pairs.length;i+=2) result.put((String)pairs[i],pairs[i+1]);
        return result;
    }
}
