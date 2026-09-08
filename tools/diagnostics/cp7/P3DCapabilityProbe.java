import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;

import processing.core.PApplet;
import processing.opengl.PGL;
import processing.opengl.PGraphics3D;

/**
 * One-frame private P3D capability probe.  It deliberately checks only that the
 * pinned Processing desktop runtime can create a P3D context and retain a simple
 * depth-tested overlap; it is not mesh, lighting, shader, or hardware support.
 */
public final class P3DCapabilityProbe extends PApplet {
  private static final int WIDTH = 320;
  private static final int HEIGHT = 320;
  private static final int BACKGROUND_X = 20;
  private static final int BACKGROUND_Y = 20;
  private static final int FRONT_X = 160;
  private static final int FRONT_Y = 160;
  private static final int BACK_X = 100;
  private static final int BACK_Y = 160;

  private final File output;
  private boolean completed;

  private P3DCapabilityProbe(File output) {
    this.output = output;
  }

  public static void main(String[] arguments) {
    if (arguments.length != 1) {
      throw new IllegalArgumentException("usage: P3DCapabilityProbe <absolute-output-directory>");
    }
    File target = new File(arguments[0]);
    if (!target.isAbsolute()) {
      throw new IllegalArgumentException("output directory must be absolute");
    }
    if (!target.isDirectory() && !target.mkdirs()) {
      throw new IllegalStateException("cannot create output directory");
    }
    PApplet.runSketch(new String[] { "P3DCapabilityProbe" }, new P3DCapabilityProbe(target));
  }

  public void settings() {
    size(WIDTH, HEIGHT, P3D);
    pixelDensity(1);
  }

  public void setup() {
    noLoop();
  }

  public void draw() {
    if (completed) {
      throw new AssertionError("probe drew more than one completed frame");
    }
    completed = true;
    require(width == WIDTH && height == HEIGHT, "unexpected P3D dimensions");
    require(pixelDensity == 1, "unexpected P3D pixel density");
    require(g instanceof PGraphics3D, "P3D request did not create PGraphics3D: " + g.getClass().getName());

    String vendor = null;
    String renderer = null;
    String version = null;
    PGL context = beginPGL();
    try {
      require(context != null, "PGL context is unavailable");
      vendor = context.getString(PGL.VENDOR);
      renderer = context.getString(PGL.RENDERER);
      version = context.getString(PGL.VERSION);
      require(nonBlank(vendor) && nonBlank(renderer) && nonBlank(version), "PGL context strings are unavailable");
    } finally {
      endPGL();
    }

    // Processing's no-argument orthographic projection retains its normal screen-space
    // camera convention, so these fixed coordinates address the declared pixel regions.
    // The red foreground quad is submitted first at z=30; the later, larger blue quad
    // is at z=-30 and must remain behind it.
    background(17, 23, 31);
    noLights();
    noStroke();
    hint(ENABLE_DEPTH_TEST);
    ortho();

    fill(255, 0, 0);
    beginShape(QUADS);
    vertex(120, 120, 30);
    vertex(200, 120, 30);
    vertex(200, 200, 30);
    vertex(120, 200, 30);
    endShape();

    fill(0, 0, 255);
    beginShape(QUADS);
    vertex(80, 80, -30);
    vertex(240, 80, -30);
    vertex(240, 240, -30);
    vertex(80, 240, -30);
    endShape();

    loadPixels();
    int front = sample(FRONT_X, FRONT_Y);
    int back = sample(BACK_X, BACK_Y);
    int background = sample(BACKGROUND_X, BACKGROUND_Y);
    require(opaque(front) && redInterior(front), "front depth sample is not opaque red");
    require(opaque(back) && blueInterior(back), "back depth sample is not opaque blue");
    require(opaque(background) && backgroundInterior(background), "background sample is not opaque background");

    File image = new File(output, "p3d-depth.png");
    if (image.exists()) {
      throw new IllegalStateException("refusing to overwrite existing probe image");
    }
    save(image.getAbsolutePath());
    writeJson(new File(output, "native.json"), vendor, renderer, version, front, back, background);
    exit();
  }

  private int sample(int x, int y) {
    return pixels[y * pixelWidth + x];
  }

  private static boolean opaque(int color) {
    return ((color >>> 24) & 0xff) == 0xff;
  }

  private static boolean redInterior(int color) {
    return ((color >>> 16) & 0xff) > 220 && ((color >>> 8) & 0xff) < 30 && (color & 0xff) < 30;
  }

  private static boolean blueInterior(int color) {
    return (color & 0xff) > 220 && ((color >>> 16) & 0xff) < 30 && ((color >>> 8) & 0xff) < 30;
  }

  private static boolean backgroundInterior(int color) {
    return ((color >>> 16) & 0xff) == 17 && ((color >>> 8) & 0xff) == 23 && (color & 0xff) == 31;
  }

  private void writeJson(File target, String vendor, String renderer, String version,
      int front, int back, int background) {
    if (target.exists()) {
      throw new IllegalStateException("refusing to overwrite existing native report");
    }
    String json = "{\n"
        + "  \"status\": \"passed\",\n"
        + "  \"draws\": 1,\n"
        + "  \"renderer_class\": \"" + escape(g.getClass().getName()) + "\",\n"
        + "  \"renderer_is_pgraphics3d\": true,\n"
        + "  \"width\": " + width + ",\n"
        + "  \"height\": " + height + ",\n"
        + "  \"pixel_width\": " + pixelWidth + ",\n"
        + "  \"pixel_height\": " + pixelHeight + ",\n"
        + "  \"pixel_density\": " + pixelDensity + ",\n"
        + "  \"runtime\": {\"display\": \"" + escape(valueOf(System.getenv("DISPLAY")))
        + "\", \"java_version\": \"" + escape(valueOf(System.getProperty("java.version")))
        + "\", \"os_name\": \"" + escape(valueOf(System.getProperty("os.name")))
        + "\", \"os_arch\": \"" + escape(valueOf(System.getProperty("os.arch"))) + "\"},\n"
        + "  \"gl\": {\"vendor\": \"" + escape(vendor) + "\", \"renderer\": \""
        + escape(renderer) + "\", \"version\": \"" + escape(version) + "\"},\n"
        + "  \"image\": \"p3d-depth.png\",\n"
        + "  \"samples\": {\n"
        + "    \"front_red\": {\"x\": " + FRONT_X + ", \"y\": " + FRONT_Y + ", \"argb\": " + unsigned(front) + "},\n"
        + "    \"back_blue\": {\"x\": " + BACK_X + ", \"y\": " + BACK_Y + ", \"argb\": " + unsigned(back) + "},\n"
        + "    \"background\": {\"x\": " + BACKGROUND_X + ", \"y\": " + BACKGROUND_Y + ", \"argb\": " + unsigned(background) + "}\n"
        + "  }\n"
        + "}\n";
    try {
      Writer writer = new OutputStreamWriter(new FileOutputStream(target), StandardCharsets.UTF_8);
      try {
        writer.write(json);
      } finally {
        writer.close();
      }
    } catch (Exception error) {
      throw new IllegalStateException("cannot write native report", error);
    }
  }

  private static String unsigned(int value) {
    return Long.toString(((long) value) & 0xffffffffL);
  }

  private static boolean nonBlank(String value) {
    return value != null && value.trim().length() > 0;
  }

  private static String escape(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"")
        .replace("\n", "\\n").replace("\r", "\\r");
  }

  private static String valueOf(String value) {
    return value == null ? "" : value;
  }

  private static void require(boolean condition, String message) {
    if (!condition) {
      throw new IllegalStateException(message);
    }
  }
}
