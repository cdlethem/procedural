package org.procedurals.processing;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.procedurals.layout.RetainedRectangles2D;
import org.procedurals.raster.MaskedComposite2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PGraphics;
import processing.core.PImage;

/**
 * JAVA2D-only rectangular content adapter. It follows the independently specified
 * eyes002 image/draw-callback provenance and the maintainer's partition request.
 * No fallback renderer is provided.
 */
public final class Java2DRegions {
    private Java2DRegions() { }
    /** Chooses unmodified canvas coordinates or a translated local region origin. */
    public enum Space { CANVAS, LOCAL }
    /** Draws once on a borrowed density-one JAVA2D scratch target. */
    public interface Content { void draw(PGraphics target, Region region); }
    /** Immutable logical-pixel rectangle with a stable safe integer identity. */
    public static final class Region {
        public final long id; public final double left, top, right, bottom;
        public Region(long id, double left, double top, double right, double bottom) {
            if (id < 0 || id > 9007199254740991L || !finite(left) || !finite(top) || !finite(right) || !finite(bottom)
                    || !(left < right) || !(top < bottom) || !finite(right - left) || !finite(bottom - top)) throw new IllegalArgumentException("Invalid region");
            this.id=id; this.left=zero(left); this.top=zero(top); this.right=zero(right); this.bottom=zero(bottom);
        }
    }
    /** Converts a retained snapshot to independently owned values in leaf order. */
    public static List<Region> regions(List<RetainedRectangles2D.Leaf> leaves) {
        if (leaves == null) throw new IllegalArgumentException("Null leaves");
        List<Region> result=new ArrayList<Region>(leaves.size());
        for (RetainedRectangles2D.Leaf leaf:leaves) { if (leaf==null) throw new IllegalArgumentException("Null leaf"); result.add(new Region(leaf.id,leaf.left,leaf.top,leaf.right,leaf.bottom)); }
        return result;
    }
    /**
     * Composites content through rectangles. Feather is required caller data in logical pixels,
     * has no recommended artistic range, and is source-over coverage rather than a crossfade.
     */
    public static PImage render(PApplet parent, PImage destination, List<Region> regions, Space space, double feather, Content content) {
        if (parent==null || destination==null || regions==null || space==null || content==null || !finite(feather) || feather<0
                || (destination.format!=PApplet.RGB && destination.format!=PApplet.ARGB)
                || destination.width<1 || destination.height<1 || destination.pixelDensity!=1 || destination.pixelWidth!=destination.width || destination.pixelHeight!=destination.height || (long)destination.width*destination.height>Integer.MAX_VALUE) throw new IllegalArgumentException("Invalid region render input");
        Region[] order=regions.toArray(new Region[regions.size()]); Set<Long> ids=new HashSet<Long>();
        for (Region r:order) { if(r==null || !ids.add(Long.valueOf(r.id)) || (space==Space.LOCAL && (!finiteFloat(r.left)||!finiteFloat(r.top)))) throw new IllegalArgumentException("Invalid region"); }
        destination.loadPixels(); int count=destination.width*destination.height; if(destination.pixels==null || destination.pixels.length!=count) throw new IllegalArgumentException("Invalid destination pixels");
        int[] result=destination.pixels.clone();
        if (destination.format==PApplet.RGB) {
            for (int i=0;i<count;i++) result[i] |= 0xff000000;
        }
        double[] coverage=new double[count];
        for(Region region:order) result=one(parent,destination.width,destination.height,result,coverage,region,space,feather,content);
        PImage image=parent.createImage(destination.width,destination.height,PApplet.ARGB); image.loadPixels(); System.arraycopy(result,0,image.pixels,0,count); image.updatePixels(); return image;
    }
    private static int[] one(PApplet parent,int width,int height,int[] background,double[] coverage,Region r,Space space,double feather,Content content) {
        PGraphicsJava2D target=new PGraphicsJava2D(); Throwable primary=null;
        try { target.setParent(parent); target.setPrimary(false); target.pixelDensity=1; target.setSize(width,height); target.beginDraw(); target.colorMode(PApplet.RGB,255); target.noTint(); target.blendMode(PApplet.BLEND); target.resetMatrix(); target.noClip(); target.clear(); if(space==Space.LOCAL) target.translate((float)r.left,(float)r.top); content.draw(target,r); target.endDraw(); target.loadPixels();
            for(int y=0,i=0;y<height;y++) for(int x=0;x<width;x++,i++){double px=x+.5,py=y+.5;if(px<r.left||px>=r.right||py<r.top||py>=r.bottom)coverage[i]=0;else if(feather==0)coverage[i]=1;else{double d=Math.min(Math.min(px-r.left,r.right-px),Math.min(py-r.top,r.bottom-py));coverage[i]=Math.min(1,d/feather);}}
            return MaskedComposite2D.compose(width,height,target.pixels,background,coverage).pixels();
        } catch(RuntimeException|Error e){primary=e;throw e;} finally { Throwable cleanup=null; try{if(target.g2!=null)target.g2.dispose();}catch(RuntimeException|Error e){cleanup=e;} try{if(target.image!=null)target.image.flush();}catch(RuntimeException|Error e){if(cleanup==null)cleanup=e;else cleanup.addSuppressed(e);} target.g2=null;target.image=null;target.pixels=null;try{target.dispose();}catch(RuntimeException|Error e){if(cleanup==null)cleanup=e;else cleanup.addSuppressed(e);}if(cleanup!=null){if(primary!=null)primary.addSuppressed(cleanup);else if(cleanup instanceof RuntimeException)throw(RuntimeException)cleanup;else throw(Error)cleanup;} }
    }
    private static boolean finite(double v){return !Double.isNaN(v)&&!Double.isInfinite(v);} private static boolean finiteFloat(double v){return finite(v)&&v<=Float.MAX_VALUE&&v>=-Float.MAX_VALUE;} private static double zero(double v){return v==0?0:v;}
}
