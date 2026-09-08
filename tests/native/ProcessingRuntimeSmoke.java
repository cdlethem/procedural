import processing.core.PApplet;
import processing.awt.PGraphicsJava2D;

/** Runtime prerequisite only: actual Processing JAVA2D, not an adapter conformance test. */
public class ProcessingRuntimeSmoke {
    public static void main(String[] args) {
        if (args.length != 1) throw new IllegalArgumentException("Pass an output PNG path");
        PGraphicsJava2D graphics = new PGraphicsJava2D();
        graphics.setParent(new PApplet());
        graphics.setSize(32, 32);
        graphics.beginDraw();
        graphics.background(0);
        graphics.noStroke();
        graphics.fill(255);
        graphics.rect(8, 8, 16, 16);
        graphics.endDraw();
        graphics.loadPixels();
        if (graphics.pixels[16 * 32 + 16] != 0xffffffff || graphics.pixels[0] != 0xff000000)
            throw new AssertionError("Unexpected JAVA2D pixels");
        if (!graphics.save(args[0])) throw new AssertionError("PNG save failed");
        System.out.println("Processing JAVA2D 32x32 pixel and PNG smoke passed");
        graphics.dispose();
    }
}
