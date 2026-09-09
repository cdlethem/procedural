import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.procedurals.layout.RetainedRectangles2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PGraphics;
import processing.core.PImage;

/**
 * Private native visual study for partition content composition. This is not a library API.
 * It contrasts one canvas-coordinate picture seen through retained panels with panel-local
 * crop-plus-mark content. The third result uses the same source-over mask with feathered
 * panel coverage; its edge shows the prepared background through the content, not a crossfade.
 */
public final class PartitionContentVisualStudy extends PApplet {
    private static final int WIDTH = 720;
    private static final int HEIGHT = 480;
    private static Path output;

    private RetainedRectangles2D layout;
    private List<RetainedRectangles2D.Leaf> leaves;
    private PImage original;
    private Map<Long, PImage> localCrops;
    private int stage;

    public static void main(String[] args) {
        if (args.length != 1) throw new IllegalArgumentException("output directory required");
        output = new File(args[0]).toPath().toAbsolutePath();
        PApplet.runSketch(new String[] { PartitionContentVisualStudy.class.getName() }, new PartitionContentVisualStudy());
    }

    @Override public void settings() { size(WIDTH, HEIGHT, JAVA2D); pixelDensity(1); }

    @Override public void setup() {
        if (!(g instanceof PGraphicsJava2D) || pixelDensity != 1) throw new AssertionError("JAVA2D density one required");
        try { Files.createDirectories(output); } catch (Exception error) { throw new RuntimeException(error); }
        layout = RetainedRectangles2D.create(64, 88, 656, 430);
        layout.cut(0, "X", 360);
        layout.cut(1, "Y", 259);
        layout.cut(2, "Y", 259);
        leaves = layout.leaves();
        original = generatedSource();
        localCrops = new LinkedHashMap<Long, PImage>();
        for (RetainedRectangles2D.Leaf leaf : leaves) {
            localCrops.put(Long.valueOf(leaf.id), original.get((int) leaf.left, (int) leaf.top,
                    (int) (leaf.right - leaf.left), (int) (leaf.bottom - leaf.top)));
        }
        if (!original.save(output.resolve("source-generated.png").toString())) throw new AssertionError("source save");
        stage = 0;
    }

    @Override public void draw() {
        if (stage == 0) {
            display("GLOBAL CONTENT / CANVAS ORIGIN", false, 0.0, globalContent());
            save(output.resolve("global-panels.png").toString());
        } else if (stage == 1) {
            display("LOCAL CROPS + LOCAL MARKS", true, 0.0, localContent());
            save(output.resolve("local-panels.png").toString());
        } else if (stage == 2) {
            display("LOCAL CROPS + FEATHERED COVERAGE", true, 26.0, localContent());
            save(output.resolve("feathered-panels.png").toString());
        } else {
            try { writeManifest(); } catch (Exception error) { throw new RuntimeException(error); }
            exit();
            return;
        }
        stage++;
    }

    private void display(String title, boolean local, double feather, PartitionContentStudy.Content content) {
        background(241, 236, 223);
        stroke(89, 78, 66, 35);
        strokeWeight(1);
        for (int x = 0; x < WIDTH; x += 24) line(x, 54, x, HEIGHT);
        for (int y = 64; y < HEIGHT; y += 24) line(0, y, WIDTH, y);
        noStroke(); fill(54, 48, 42); textSize(13); text(title, 64, 34);
        fill(114, 100, 87); textSize(10); text("retained panel boundaries", 505, 34);
        loadPixels();
        int[] base = pixels.clone();
        int[] result = PartitionContentStudy.render(this, WIDTH, HEIGHT, base, leaves, local,
                feather, content);
        PImage image = createImage(WIDTH, HEIGHT, ARGB);
        image.loadPixels();
        System.arraycopy(result, 0, image.pixels, 0, result.length);
        image.updatePixels();
        image(image, 0, 0);
        noFill(); stroke(54, 48, 42, 210); strokeWeight(2);
        for (RetainedRectangles2D.Leaf leaf : leaves) rect((float) leaf.left, (float) leaf.top,
                (float) (leaf.right - leaf.left), (float) (leaf.bottom - leaf.top));
    }

    private PImage generatedSource() {
        PGraphics surface = createGraphics(WIDTH, HEIGHT, JAVA2D);
        if (!(surface instanceof PGraphicsJava2D)) throw new AssertionError("generated source must be JAVA2D");
        surface.beginDraw();
        surface.background(25, 35, 55);
        surface.noStroke();
        for (int y = 0; y < HEIGHT; y += 12) {
            for (int x = 0; x < WIDTH; x += 12) {
                int red = 30 + (x * 90 / WIDTH);
                int green = 55 + (y * 80 / HEIGHT);
                surface.fill(red, green, 105, 100);
                surface.rect(x, y, 12, 12);
            }
        }
        surface.pushMatrix(); surface.translate(187, 242);
        for (int r = 150; r >= 24; r -= 18) {
            surface.fill(242, 180 - r / 5, 82 + r / 8, 210);
            surface.ellipse(0, 0, r * 2, r * 2);
        }
        surface.fill(244, 238, 193); surface.ellipse(0, 0, 42, 42);
        surface.popMatrix();
        surface.stroke(242, 227, 171, 210); surface.strokeWeight(8); surface.noFill();
        surface.beginShape();
        surface.vertex(330, 350); surface.bezierVertex(380, 60, 505, 448, 674, 114); surface.endShape();
        surface.noStroke(); surface.fill(55, 197, 188, 230); surface.triangle(502, 314, 643, 394, 573, 130);
        surface.fill(244, 107, 91, 235); surface.rect(485, 165, 128, 68, 10);
        surface.fill(249, 231, 181); surface.textSize(28); surface.text("ORIGIN", 505, 209);
        surface.endDraw();
        return surface.get();
    }

    private PartitionContentStudy.Content globalContent() {
        return new PartitionContentStudy.Content() {
            @Override public void draw(PGraphicsJava2D target, RetainedRectangles2D.Leaf leaf) {
                target.image(original, 0, 0);
                target.noFill(); target.stroke(250, 246, 218, 190); target.strokeWeight(3);
                for (int radius = 32; radius < 390; radius += 38) target.ellipse(360, 250, radius * 2, radius * 2);
            }
        };
    }

    private PartitionContentStudy.Content localContent() {
        return new PartitionContentStudy.Content() {
            @Override public void draw(PGraphicsJava2D target, RetainedRectangles2D.Leaf leaf) {
                int w = (int) (leaf.right - leaf.left);
                int h = (int) (leaf.bottom - leaf.top);
                PImage crop = localCrops.get(Long.valueOf(leaf.id));
                target.image(crop, 0, 0);
                target.noFill(); target.stroke(255, 247, 215, 220); target.strokeWeight(4);
                target.rect(12, 12, w - 24, h - 24);
                target.stroke(19, 29, 48, 220); target.strokeWeight(2);
                for (int x = 20; x < w - 8; x += 22) target.line(x, h - 18, w - x / 2, 18);
                target.noStroke(); target.fill(255, 244, 194, 230); target.textSize(12);
                target.text("local " + leaf.id, 18, h - 20);
            }
        };
    }

    private void writeManifest() throws Exception {
        String[] files = { "source-generated.png", "global-panels.png", "local-panels.png", "feathered-panels.png" };
        StringBuilder json = new StringBuilder("{\n  \"status\": \"saved\",\n  \"renderer\": \"")
                .append(g.getClass().getName()).append("\",\n  \"width\": 720,\n  \"height\": 480,\n  \"density\": 1,\n  \"files\": {\n");
        for (int i = 0; i < files.length; i++) {
            if (i > 0) json.append(",\n");
            json.append("    \"").append(files[i]).append("\": \"").append(sha256(output.resolve(files[i]))).append("\"");
        }
        json.append("\n  },\n  \"local_sources\": {\n")
                .append("    \"PartitionContentVisualStudy.java\": \"").append(sha256(new File("tools/diagnostics/spatial-composition/PartitionContentVisualStudy.java").toPath())).append("\",\n")
                .append("    \"PartitionContentStudy.java\": \"").append(sha256(new File("tools/diagnostics/spatial-composition/PartitionContentStudy.java").toPath())).append("\",\n")
                .append("    \"MaskedComposite2D.java\": \"").append(sha256(new File("packages/java/src/main/java/org/procedurals/raster/MaskedComposite2D.java").toPath())).append("\"\n  },\n")
                .append("  \"note\": \"Feathered coverage is source-over over the prepared background; it is not a two-input crossfade.\"\n}\n");
        Files.write(output.resolve("manifest.json"), json.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256(Path file) throws Exception {
        byte[] bytes = Files.readAllBytes(file);
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder value = new StringBuilder();
        for (byte b : digest) value.append(String.format("%02x", b & 255));
        return value.toString();
    }
}
