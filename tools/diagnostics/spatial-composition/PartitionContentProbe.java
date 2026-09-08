import java.util.Arrays;
import org.procedurals.layout.RetainedRectangles2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.core.PConstants;

/** Focused private native check; run under the shared render lease. */
public final class PartitionContentProbe {
    public static void main(String[] args) {
        PApplet parent = new PApplet();
        RetainedRectangles2D layout = RetainedRectangles2D.create(2, 2, 14, 10);
        layout.cut(0, "X", 8);
        int[] background = new int[16 * 12];
        Arrays.fill(background, 0xff0000ff);
        int[] calls = {0};
        PartitionContentStudy.Content fill = (g, leaf) -> {
            calls[0]++;
            g.noStroke(); g.fill(255, 0, 0); g.rect(-100, -100, 300, 300);
        };
        int[] result = PartitionContentStudy.render(parent, 16, 12, background,
                layout.leaves(), false, 0, fill);
        if (calls[0] != 2) throw new AssertionError("callback count");
        for (int y = 0; y < 12; y++) for (int x = 0; x < 16; x++) {
            int expected = x >= 2 && x < 14 && y >= 2 && y < 10 ? 0xffff0000 : 0xff0000ff;
            if (result[y * 16 + x] != expected) throw new AssertionError("region pixel");
            if (background[y * 16 + x] != 0xff0000ff) throw new AssertionError("source mutated");
        }
        int[] local = PartitionContentStudy.render(parent, 16, 12, background,
                layout.leaves(), true, 0, (g, leaf) -> {
                    g.noStroke(); g.fill(0, 255, 0); g.rect(0, 0, 2, 2);
                });
        if (local[2 * 16 + 2] != 0xff00ff00 || local[2 * 16 + 8] != 0xff00ff00)
            throw new AssertionError("local placement");
        int[] soft = PartitionContentStudy.render(parent, 16, 12, background,
                layout.leaves(), false, 2, fill);
        // Pixel center is 0.5 units inside: feather 2 gives 1/4 red over opaque blue.
        if (soft[2 * 16 + 2] != 0xff4000bf || soft[0] != 0xff0000ff)
            throw new AssertionError("feather coverage");
        PImage original = new PImage(4, 2, PConstants.ARGB);
        original.loadPixels();
        Arrays.fill(original.pixels, 0xffff0000);
        original.pixels[2] = original.pixels[3] = 0xff00ff00;
        original.pixels[6] = original.pixels[7] = 0xff00ff00;
        original.updatePixels();
        PImage snippet = original.get(2, 0, 2, 2);
        int[] images = PartitionContentStudy.render(parent, 16, 12, background,
                layout.leaves(), true, 0, (g, leaf) -> g.image(snippet, 0, 0));
        if (images[2 * 16 + 2] != 0xff00ff00 || images[2 * 16 + 8] != 0xff00ff00
                || images[2 * 16 + 4] != 0xff0000ff || original.pixels[0] != 0xffff0000)
            throw new AssertionError("image snippet transfer");
        try {
            PartitionContentStudy.render(parent, 16, 12, background, layout.leaves(), false, 0,
                    (g, leaf) -> { g.translate(30, 20); throw new IllegalStateException("artist failure"); });
            throw new AssertionError("callback error swallowed");
        } catch (IllegalStateException expected) {
            if (!"artist failure".equals(expected.getMessage())) throw expected;
        }
        int[] recovery = PartitionContentStudy.render(parent, 16, 12, background,
                layout.leaves(), false, 0, fill);
        if (!Arrays.equals(result, recovery)) throw new AssertionError("failure leaked state");
        System.out.println("PASS: native partition masking, feather coverage, image snippets, local placement, callback count, source ownership, error recovery");
    }
}
