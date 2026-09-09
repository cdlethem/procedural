import java.io.File;
import java.nio.file.Files;
import java.util.Arrays;
import org.procedurals.processing.Java2DLayers;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;

/** Private pinned-JAVA2D scaling/crop alpha study; not a public adapter. */
public final class ImagePlacementNativeStudy extends PApplet {
    private static File output;
    public void settings() { size(64, 32, JAVA2D); pixelDensity(1); }
    public void setup() { try { Files.createDirectories(output.toPath()); run(); exit(); System.exit(0); } catch (Throwable e) { e.printStackTrace(); exit(); System.exit(1); } }
    private PImage source(int hidden) { PImage p=createImage(2,1,ARGB);p.loadPixels();p.pixels[0]=0xffff0000;p.pixels[1]=hidden;p.updatePixels();return p; }
    private PImage scaled(PImage p) { return Java2DLayers.render(this,32,16,t->{t.image(p,0,0,32,16);}); }
    private int at(PImage p,int x,int y){p.loadPixels();return p.pixels[y*p.width+x];}
    private void run() throws Exception {
      if(!(g instanceof PGraphicsJava2D)||pixelDensity!=1)throw new AssertionError("env");
      PImage blue=scaled(source(0x000000ff)),green=scaled(source(0x0000ff00)),black=scaled(source(0));
      PImage crop=source(0xff00ff00).get(0,0,1,1); PImage cropped=Java2DLayers.render(this,32,16,t->{t.image(crop,0,0,32,16);});
      blue.save(new File(output,"hidden-blue.png").toString());green.save(new File(output,"hidden-green.png").toString());black.save(new File(output,"hidden-black.png").toString());cropped.save(new File(output,"crop-red.png").toString());
      int[] xs={14,15,16,17}; String json="{\"renderer\":\""+g.getClass().getName()+"\",\"samples\":{\"blue\":"+Arrays.toString(new int[]{at(blue,xs[0],8),at(blue,xs[1],8),at(blue,xs[2],8),at(blue,xs[3],8)})+",\"green\":"+Arrays.toString(new int[]{at(green,xs[0],8),at(green,xs[1],8),at(green,xs[2],8),at(green,xs[3],8)})+",\"black\":"+Arrays.toString(new int[]{at(black,xs[0],8),at(black,xs[1],8),at(black,xs[2],8),at(black,xs[3],8)})+",\"crop\":"+Arrays.toString(new int[]{at(cropped,14,8),at(cropped,15,8),at(cropped,16,8),at(cropped,17,8)})+"}}\n";Files.write(new File(output,"result.json").toPath(),json.getBytes("UTF-8"));System.out.print(json);
    }
    public static void main(String[] a){output=new File(a[0]);PApplet.runSketch(new String[]{ImagePlacementNativeStudy.class.getName()},new ImagePlacementNativeStudy());}
}
