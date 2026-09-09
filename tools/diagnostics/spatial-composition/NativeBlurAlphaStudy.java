import java.util.Arrays;
import processing.core.PApplet;
import processing.core.PImage;

/** Private diagnostic: decide whether native PImage blur transports alpha safely. */
public final class NativeBlurAlphaStudy {
    private static int[] blur(int hidden) {
        PImage image = new PImage(33, 33, PApplet.ARGB);
        image.loadPixels();
        Arrays.fill(image.pixels, hidden);
        for (int y = 0; y < 33; y++) image.pixels[y*33+16] = 0xffff0000;
        image.updatePixels();
        image.filter(PApplet.BLUR, 1.0f);
        image.loadPixels();
        return image.pixels.clone();
    }
    public static void main(String[] args) {
        int[] blue = blur(0x000000ff), green = blur(0x0000ff00), black = blur(0);
        int visibleDifferences = 0;
        for (int i = 0; i < blue.length; i++) {
            if (((blue[i] >>> 24) > 0 || (green[i] >>> 24) > 0) && blue[i] != green[i]) visibleDifferences++;
        }
        System.out.println("visibleDifferences=" + visibleDifferences);
        System.out.println(Arrays.toString(Arrays.copyOfRange(blue,33*16,33*17)));
        System.out.println("{\"hiddenRgbInvariant\":"+Arrays.equals(blue,green)
            +",\"blue\":\""+Integer.toHexString(blue[33*16+16])+"\",\"green\":\""
            +Integer.toHexString(green[33*16+16])+"\",\"black\":\""+Integer.toHexString(black[33*16+16])+"\"}");
    }
}
