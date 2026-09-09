import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.imageio.ImageIO;
import processing.core.PApplet;
import processing.core.PGraphics;

/** Versioned offscreen host for a preprocessed GeneratedLayer. */
public final class LayerHost extends GeneratedLayer {
    private static final int WIDTH = 640;
    private static final int HEIGHT = 640;

    private static void usage() {
        throw new IllegalArgumentException("LayerHost requires output, controls, random seed, noise seed, and tick");
    }

    private static String json(String status, int width, int height, int minAlpha) {
        return "{\"status\":\"" + status + "\",\"width\":" + width
            + ",\"height\":" + height + ",\"minAlpha\":" + minAlpha + "}";
    }

    public static void main(String[] args) {
        try {
            run(args);
        } catch (Exception error) {
            throw new RuntimeException(error);
        }
    }

    private static void run(String[] args) throws Exception {
        if (args.length != 5) usage();
        Path output = Path.of(args[0]);
        LayerControls controls = new LayerControls(args[1]);
        int randomSeed = Integer.parseInt(args[2]);
        int noiseSeed = Integer.parseInt(args[3]);
        int tick = Integer.parseInt(args[4]);
        if (tick < 1) throw new IllegalArgumentException("tick must be positive");

        LayerHost host = new LayerHost();
        host.randomSeed(randomSeed);
        host.noiseSeed(noiseSeed);
        host.g = new PGraphics();
        PGraphics graphics = host.createGraphics(WIDTH, HEIGHT, PApplet.JAVA2D);
        graphics.beginDraw();
        graphics.clear();
        graphics.endDraw();

        try {
            java.lang.reflect.Method setup = host.getClass().getMethod("setupLayer", PGraphics.class, LayerControls.class);
            graphics.beginDraw();
            setup.invoke(host, graphics, controls);
            graphics.endDraw();
        } catch (NoSuchMethodException ignored) {
            // setupLayer is optional.
        } catch (java.lang.reflect.InvocationTargetException error) {
            throw unwrap(error);
        }

        java.lang.reflect.Method render;
        try {
            render = host.getClass().getMethod("renderFrame", PGraphics.class, LayerControls.class, int.class);
        } catch (NoSuchMethodException error) {
            throw new IllegalArgumentException("required renderFrame(PGraphics, LayerControls, int) hook is missing", error);
        }
        for (int current = 1; current <= tick; current++) {
            graphics.beginDraw();
            try {
                render.invoke(host, graphics, controls, current);
            } catch (java.lang.reflect.InvocationTargetException error) {
                throw unwrap(error);
            } finally {
                graphics.endDraw();
            }
        }
        graphics.loadPixels();
        int minimum = 255;
        for (int pixel : graphics.pixels) minimum = Math.min(minimum, (pixel >>> 24) & 0xff);
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_ARGB);
        image.setRGB(0, 0, WIDTH, HEIGHT, graphics.pixels, 0, WIDTH);
        Files.createDirectories(output.toAbsolutePath().getParent());
        if (!ImageIO.write(image, "png", output.toFile())) throw new IOException("PNG writer unavailable");
        System.out.println(json("succeeded", WIDTH, HEIGHT, minimum));
    }

    private static Exception unwrap(java.lang.reflect.InvocationTargetException error) {
        Throwable cause = error.getCause();
        if (cause instanceof Exception exception) return exception;
        if (cause instanceof Error fatal) throw fatal;
        return new RuntimeException(cause);
    }
}
