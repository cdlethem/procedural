import java.util.Arrays;
import org.procedurals.processing.Java2DImagePlacement;
import org.procedurals.processing.Java2DImagePlacement.Crop;
import org.procedurals.processing.Java2DImagePlacement.Frame;
import org.procedurals.processing.Java2DImagePlacement.Fit;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;

/** Focused actual JAVA2D checks; exact interiors are separate from sampled edges. */
public final class Java2DImagePlacementNative extends PApplet {
    private static final int RED = 0xffff0000, BLUE = 0xff0000ff;
    private static void require(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public void settings() { size(720, 480, JAVA2D); pixelDensity(1); }
    public void setup() {
        try { cases(); System.out.println("{\"status\":\"passed\"}"); exit(); System.exit(0); }
        catch (Throwable error) { error.printStackTrace(); exit(); System.exit(1); }
    }
    private PImage bands(int w, int h, boolean vertical) {
        PImage image = createImage(w, h, ARGB);
        image.loadPixels();
        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++)
            image.pixels[y*w+x] = (vertical ? y < h/2 : x < w/2) ? RED : BLUE;
        image.updatePixels();
        return image;
    }
    private PImage place(PImage source, Frame frame, Fit fit, double ax, double ay) {
        return Java2DImagePlacement.render(this, source, new Crop(0, 0, source.width, source.height), 8, 8, frame, fit, ax, ay);
    }
    private int at(PImage image, int x, int y) { image.loadPixels(); return image.pixels[y*image.width+x]; }
    private void outside(PImage image, int l, int t, int r, int b) {
        image.loadPixels();
        for (int y = 0; y < image.height; y++) for (int x = 0; x < image.width; x++)
            if (x < l || x >= r || y < t || y >= b) require(at(image,x,y)==0,"outside frame");
    }
    private void invalid(Runnable call) {
        try { call.run(); throw new AssertionError("invalid input accepted"); }
        catch (IllegalArgumentException expected) { }
    }
    private void cases() {
        require(g instanceof PGraphicsJava2D && pixelDensity == 1, "native environment");
        PImage wide = bands(4, 2, false), tall = bands(2, 4, true);
        int[] original = wide.pixels.clone();
        Frame square = new Frame(0,0,8,8);
        PImage top = place(wide,square,Fit.CONTAIN,0,0), bottom = place(wide,square,Fit.CONTAIN,0,1);
        require(at(top,0,0)==RED && at(top,0,7)==0 && at(bottom,0,0)==0 && at(bottom,0,7)==RED,"contain Y alignment");
        PImage left = place(tall,square,Fit.CONTAIN,0,0), right = place(tall,square,Fit.CONTAIN,1,0);
        require(at(left,0,0)==RED && at(left,7,0)==0 && at(right,0,0)==0 && at(right,7,0)==RED,"contain X alignment");
        PImage coverLeft = place(wide,square,Fit.COVER,0,0), coverRight = place(wide,square,Fit.COVER,1,0);
        require(at(coverLeft,4,6)==RED && at(coverRight,4,6)==BLUE,"cover X selects content and fills height");
        PImage coverTop = place(tall,square,Fit.COVER,0,0), coverBottom = place(tall,square,Fit.COVER,0,1);
        require(at(coverTop,6,4)==RED && at(coverBottom,6,4)==BLUE,"cover Y selects content and fills width");
        PImage stretch = place(wide,square,Fit.STRETCH,1,1);
        require(at(stretch,0,7)==RED && at(stretch,7,7)==BLUE,"stretch fills with both source ends");
        PImage clipped = place(wide,new Frame(2,2,4,4),Fit.COVER,0.5,0.5);
        outside(clipped,2,2,6,6);
        require((at(clipped,3,3)>>>24)==255,"cover clipped interior");
        PImage partial = place(wide,new Frame(-2,2,4,4),Fit.STRETCH,0,0);
        outside(partial,0,2,2,6); require(at(partial,0,3)!=0,"partly offcanvas retained intersection");
        PImage absent = place(wide,new Frame(-8,-8,2,2),Fit.STRETCH,0,0);
        absent.loadPixels(); for(int p:absent.pixels) require(p==0,"wholly offcanvas");
        PImage crop = Java2DImagePlacement.render(this,wide,new Crop(2,1,1,1),8,8,square,Fit.STRETCH,0,0);
        crop.loadPixels(); for(int p:crop.pixels) require(p==BLUE,"nonzero crop origin and isolation");
        crop.pixels[0]=0; crop.updatePixels();
        require(Arrays.equals(wide.pixels,original),"source immutable and output detached");
        PImage rgb = bands(2,1,false); rgb.format=RGB; rgb.pixels[0]=0x00ff0000; rgb.pixels[1]=0x000000ff; rgb.updatePixels();
        PImage opaque=place(rgb,square,Fit.STRETCH,0,0);
        opaque.loadPixels(); for(int p:opaque.pixels) require((p>>>24)==255,"RGB opacity");
        require(rgb.pixels[0]==0x00ff0000,"RGB source bits unchanged");
        PImage a=bands(2,1,false), b=bands(2,1,false);
        a.pixels[1]=0x000000ff; b.pixels[1]=0x0000ff00; a.updatePixels(); b.updatePixels();
        PImage pa=place(a,square,Fit.STRETCH,0,0), pb=place(b,square,Fit.STRETCH,0,0);
        pa.loadPixels(); pb.loadPixels(); require(Arrays.equals(pa.pixels,pb.pixels),"hidden RGB invariant");
        boolean fractional=false;
        for(int p:pa.pixels) {
            int alpha=p>>>24;
            if(alpha>0) require((p&0xffffff)==0xff0000,"visible edge stays red");
            if(alpha>0 && alpha<255) fractional=true;
        }
        require(fractional,"actual fractional scaling samples");
        invalid(()->new Crop(0,0,0,1)); invalid(()->new Frame(0,0,1,0));
        invalid(()->Java2DImagePlacement.render(this,null,new Crop(0,0,1,1),8,8,square,Fit.STRETCH,0,0));
        invalid(()->place(wide,square,null,0,0));
        invalid(()->place(wide,square,Fit.STRETCH,Double.NaN,0));
        invalid(()->place(wide,square,Fit.STRETCH,0,1.1));
        invalid(()->Java2DImagePlacement.render(this,wide,new Crop(Integer.MAX_VALUE,0,2,1),8,8,square,Fit.CONTAIN,0,0));
        invalid(()->Java2DImagePlacement.render(this,wide,new Crop(3,0,2,1),8,8,square,Fit.CONTAIN,0,0));
        invalid(()->Java2DImagePlacement.render(this,wide,new Crop(0,0,1,1),Integer.MAX_VALUE,2,square,Fit.CONTAIN,0,0));
        PImage density=bands(2,2,false); density.pixelDensity=2;
        invalid(()->place(density,square,Fit.CONTAIN,0,0));
        measure(wide);
    }
    private void measure(PImage source) {
        long start=System.nanoTime();
        PImage image=Java2DImagePlacement.render(this,source,new Crop(0,0,4,2),720,480,new Frame(0,0,720,480),Fit.CONTAIN,0.5,0.5);
        long elapsed=System.nanoTime()-start; image.loadPixels(); long checksum=0;
        for(int p:image.pixels) checksum=checksum*31+Integer.toUnsignedLong(p);
        System.out.println("{\"measurement\":{\"width\":720,\"height\":480,\"elapsed_ns\":"+elapsed+",\"checksum\":\""+Long.toUnsignedString(checksum)+"\"}}");
    }
    public static void main(String[] args) { PApplet.runSketch(new String[]{Java2DImagePlacementNative.class.getName()},new Java2DImagePlacementNative()); }
}
