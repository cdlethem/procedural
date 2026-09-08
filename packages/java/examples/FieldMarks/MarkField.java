import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.layout.RegularGrid;
import org.procedurals.fields.GradientNoise2D01;
import org.procedurals.color.CyclicPalette;
import processing.core.PGraphics;
import processing.core.PConstants;

/** Example-owned composition, not another library operation.
 * Motivated by survey/out/2018/Generativos/pelines/notes.md.
 * The shared field, fixed opacity and independent spacing/length are deliberate
 * example choices. These constants are not recommended parameter ranges.
 */
public strictfp final class MarkField {
    // Retain the attributes so colour and mark edits never need to sample again.
    public final double[] x, y, heading, lengthFactor, colourCycles;

    private MarkField(int count) {
        x=new double[count]; y=new double[count]; heading=new double[count];
        lengthFactor=new double[count]; colourCycles=new double[count];
    }

    public static MarkField create(long seed, int columns, int rows, double pitch) {
        Map<String,Object> layout=new LinkedHashMap<String,Object>();
        layout.put("origin",Arrays.asList(pitch/2,pitch/2));
        layout.put("spacing",Arrays.asList(pitch,pitch));
        layout.put("columns",columns); layout.put("rows",rows);
        RegularGrid positions=RegularGrid.create(layout);
        if (positions.size()>Integer.MAX_VALUE) throw new IllegalArgumentException("example too large to retain");
        MarkField marks=new MarkField((int)positions.size());
        GradientNoise2D01 field=GradientNoise2D01.create(Collections.singletonMap("seed",seed));
        double[] position=new double[2];
        for (int i=0;i<marks.x.length;i++) {
            positions.pointInto(i,position,0);
            double x=position[0],y=position[1];
            marks.x[i]=x; marks.y[i]=y;
            // Spatial scale and offsets are visible composition choices.
            marks.heading[i]=4*Math.PI*field.sample(17+x*.009,17+y*.009);
            marks.lengthFactor[i]=field.sample(113+x*.013,113+y*.013);
            marks.colourCycles[i]=3*field.sample(271+x*.007,271+y*.007);
        }
        return marks;
    }

    /** Draw retained attributes with supplied colour and mark treatment. */
    public static void paint(PGraphics canvas, MarkField marks, double maxLength,
                             int[] colors, boolean bars) {
        Integer[] entries=new Integer[colors.length];
        for (int i=0;i<colors.length;i++) entries[i]=colors[i];
        CyclicPalette palette=CyclicPalette.create(Collections.singletonMap("colors",Arrays.asList(entries)));
        canvas.pushStyle(); canvas.pushMatrix();
        try {
            canvas.resetMatrix(); canvas.colorMode(PConstants.RGB,255);
            canvas.background(0xffece7da); canvas.strokeWeight(1); canvas.strokeCap(PConstants.ROUND);
            for (int i=0;i<marks.x.length;i++) {
                int rgb=palette.sample(marks.colourCycles[i]);
                drawMark(canvas,marks.x[i],marks.y[i],marks.heading[i],
                         maxLength*marks.lengthFactor[i],0xff000000|rgb,bars);
            }
        } finally {
            canvas.popMatrix(); canvas.popStyle();
        }
    }

    // Invent a different mark here. The field and the retained samples stay reusable.
    public static void drawMark(PGraphics canvas,double x,double y,double heading,
                                double length,int color,boolean bars) {
        double cos=Math.cos(heading),sin=Math.sin(heading);
        double dx=.5*length*cos,dy=.5*length*sin;
        if (bars) {
            double nx=-sin*1.25,ny=cos*1.25;
            canvas.noStroke(); canvas.fill(color,180);
            canvas.quad((float)(x-dx-nx),(float)(y-dy-ny),
                        (float)(x+dx-nx),(float)(y+dy-ny),
                        (float)(x+dx+nx),(float)(y+dy+ny),
                        (float)(x-dx+nx),(float)(y-dy+ny));
        } else {
            canvas.stroke(color,180);
            canvas.line((float)(x-dx),(float)(y-dy),(float)(x+dx),(float)(y+dy));
        }
    }

}
