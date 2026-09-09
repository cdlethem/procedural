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
 * JAVA2D-only adapter that draws borrowed content into rectangular visibility regions.
 * Region coordinates are destination logical-pixel coordinates. The independently
 * specified {@code survey/out/2017/Generativos/Eyes/eyes002/notes.md} image/draw-callback evidence and the maintainer's partition request
 * motivate this boundary; there is no fallback renderer.
 */
public final class Java2DRegions {
    private Java2DRegions() { }
    /**
     * Selects the coordinate origin used while a region's callback draws.
     * No mode scales or fits content; {@link Space#LOCAL} only translates its origin.
     */
    public enum Space {
        /** Keep the destination canvas origin unchanged. */
        CANVAS,
        /** Translate the origin to the region's {@link Region#left} and {@link Region#top}. */
        LOCAL
    }
    /**
     * Draws once on a borrowed, active, density-one JAVA2D scratch target.
     * The adapter owns the target lifecycle: the callback must not call
     * {@code beginDraw()}, {@code endDraw()}, or {@code dispose()}, and must not retain
     * the target after returning. Callback side effects outside the target are the
     * caller's responsibility and cannot be rolled back if a later region fails.
     */
    public interface Content {
        /**
         * Draws the supplied region's content into the active target.
         *
         * @param target active transparent density-one JAVA2D target, with the adapter's
         *     initialized drawing state
         * @param region immutable region descriptor for this invocation
         */
        void draw(PGraphics target, Region region);
    }
    /** Immutable logical-pixel rectangle with a stable safe integer identity. */
    public static final class Region {
        /** Stable nonnegative identity, representable exactly by a JavaScript safe integer. */
        public final long id;
        /** Rectangle edge coordinates in destination logical pixels. */
        public final double left, top, right, bottom;

        /**
         * Creates a rectangle with positive finite width and height.
         * Coordinates are retained as immutable values; signed zero is canonicalized
         * to positive zero.
         *
         * @param id nonnegative identity no greater than {@code 9007199254740991}
         * @param left left edge in destination logical pixels
         * @param top top edge in destination logical pixels
         * @param right right edge, strictly greater than {@code left}
         * @param bottom bottom edge, strictly greater than {@code top}
         * @throws IllegalArgumentException if the identity or any coordinate is invalid,
         *     nonfinite, or produces a nonfinite extent
         */
        public Region(long id, double left, double top, double right, double bottom) {
            if (id < 0 || id > 9007199254740991L || !finite(left) || !finite(top) || !finite(right) || !finite(bottom)
                    || !(left < right) || !(top < bottom) || !finite(right - left) || !finite(bottom - top)) throw new IllegalArgumentException("Invalid region");
            this.id=id; this.left=zero(left); this.top=zero(top); this.right=zero(right); this.bottom=zero(bottom);
        }
    }
    /**
     * Converts a retained rectangle snapshot to independently owned region values in
     * its existing leaf order. This preserves each leaf's ID and bounds without
     * retaining the input list or leaf objects.
     *
     * @param leaves retained rectangle leaves to convert
     * @return detached mutable list containing immutable region descriptors in leaf order
     * @throws IllegalArgumentException if {@code leaves} or an element is null, or if a
     *     leaf cannot produce a valid {@link Region}
     */
    public static List<Region> regions(List<RetainedRectangles2D.Leaf> leaves) {
        if (leaves == null) throw new IllegalArgumentException("Null leaves");
        List<Region> result=new ArrayList<Region>(leaves.size());
        for (RetainedRectangles2D.Leaf leaf:leaves) { if (leaf==null) throw new IllegalArgumentException("Null leaf"); result.add(new Region(leaf.id,leaf.left,leaf.top,leaf.right,leaf.bottom)); }
        return result;
    }
    /**
     * Draws each region's content and composites it over a copy of the destination.
     * On success, regions are processed exactly once in supplied order. A region uses half-open
     * bounds ({@code left <= x < right}, {@code top <= y < bottom}) at destination pixel
     * centers; overlapping regions therefore follow ordered source-over compositing.
     * With zero feather, coverage is binary. Otherwise coverage ramps linearly inward
     * from each edge over {@code feather} logical pixels, and is source-over coverage,
     * not a two-input crossfade. The callback target has the destination dimensions;
     * {@link Space#LOCAL} only translates its origin to the region's upper-left corner.
     *
     * <p>The destination is read but not modified. The returned ARGB image is detached
     * and is produced only after every callback succeeds. A callback failure exposes no
     * partial image, although effects external to this method cannot be undone.</p>
     *
     * @param parent active Processing sketch used to create the detached result and
     *     temporary JAVA2D targets
     * @param destination completed density-one RGB or ARGB image supplying dimensions
     *     and the initial background
     * @param regions non-null ordered region descriptors with unique IDs; an empty list
     *     returns a detached copy of the destination
     * @param space coordinate origin mode for each callback
     * @param feather nonnegative finite inward feather width in destination logical pixels
     * @param content callback invoked once for each region, in list order
     * @return detached density-one ARGB image containing the composited result
     * @throws IllegalArgumentException if an input is null or invalid, the destination
     *     is not density-one RGB/ARGB with usable pixels, IDs are duplicated, a region
     *     is invalid, or LOCAL translation cannot be represented as a finite float
     * @throws RuntimeException if the callback or native Processing operations fail
     * @throws Error if the callback or native Processing operations fail with an Error
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
