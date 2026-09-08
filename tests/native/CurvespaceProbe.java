import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.procedurals.geometry.RadialPull2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Four-state actual P2D composition, edit, reset and cached-save probe. */
public final class CurvespaceProbe extends Curvespace {
  private static final String[] IDS = {"baseline", "recolored", "regenerated", "reset"};
  private static final char[] KEYS = {'c', 'r', '0', 's'};

  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output;
  private final File expectedJar;
  private volatile int draws;
  private volatile int keys;
  private examples.recreations.curvespace.CurvespaceComposition baselineComposition;
  private String baselineGeometry;
  private String baselinePixels;
  private String previousPixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private CurvespaceProbe(File output, File expectedJar) {
    this.output = output;
    this.expectedJar = expectedJar;
  }

  private static void require(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }

  private static String escape(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private static String codeSource(Class<?> type) throws Exception {
    return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI())
        .getCanonicalPath();
  }

  private static void putLong(MessageDigest digest, long value) {
    for (int shift = 56; shift >= 0; shift -= 8) digest.update((byte) (value >>> shift));
  }

  private static String hex(byte[] bytes) {
    StringBuilder result = new StringBuilder();
    for (byte value : bytes) result.append(String.format("%02x", value & 255));
    return result.toString();
  }

  private String geometryHash() throws Exception {
    MessageDigest digest=MessageDigest.getInstance("SHA-256");
    for(double[] p:composition.dotInputs())for(double v:p)putLong(digest,Double.doubleToRawLongBits(v));
    for(double[][][] family:new double[][][][]{composition.verticalOutputs(),composition.horizontalOutputs()})
      for(double[][] line:family)for(double[] p:line)for(double v:p)putLong(digest,Double.doubleToRawLongBits(v));
    return hex(digest.digest());
  }

  private static String pixelHash(int[] pixels) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (int value : pixels) putLong(digest, value & 0xffffffffL);
    return hex(digest.digest());
  }

  @Override public void setup() {
    super.setup();
    try {
      require(codeSource(RadialPull2D.class).equals(expectedJar.getCanonicalPath()),
          "wrong core JAR");
      require(codeSource(org.procedurals.layout.RegularGrid.class).equals(expectedJar.getCanonicalPath()),"wrong grid JAR");
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 960 && height == 960 && pixelDensity == 1
          && g.getClass().getName().equals("processing.opengl.PGraphics2D"),
          "native environment");
      require(SEED==(state==2?43:42),"seed state");
      require(alternate==(state==1||state==2),"palette state");
      require(composition.seed()==SEED,"composition seed");
      String geometry=geometryHash();
      if(state==0){baselineComposition=composition;baselineGeometry=geometry;}
      else if(state==1){require(composition==baselineComposition && geometry.equals(baselineGeometry),"recolor changed geometry");}
      else if(state==2){require(composition!=baselineComposition && !geometry.equals(baselineGeometry),"regeneration unchanged");}
      else{require(composition!=baselineComposition && geometry.equals(baselineGeometry),"reset geometry");}
      int count=(int)Math.sqrt(composition.dotInputs().length);
      require(count>=30&&count<80&&count*count==composition.dotInputs().length,"dot grid count");
      require(composition.verticalOutputs().length==count-1&&composition.horizontalOutputs().length==count-1,"both line families");
      require(composition.field().influenceCount()>=4&&composition.field().influenceCount()<10,"influences");

      super.draw();
      java.lang.reflect.Field blend=processing.core.PGraphics.class.getDeclaredField("blendMode");
      blend.setAccessible(true);
      require(blend.getInt(g)==ADD,"additive drawing mode");
      loadPixels();
      displayedFrame.loadPixels();
      require(Arrays.equals(pixels, displayedFrame.pixels), "cached/framebuffer mismatch");
      int changed = 0;
      for (int pixel : pixels) {
        require((pixel >>> 24) == 255, "nonopaque framebuffer");
        if ((pixel & 0xffffff) != 0x1c1528) changed++;
      }
      require(changed > 0, "blank frame");
      String currentPixels = pixelHash(pixels);
      if (state == 0) baselinePixels = currentPixels;
      else if (state < 3) require(!currentPixels.equals(previousPixels), "edit made no visible change");
      else {
        require(currentPixels.equals(baselinePixels), "reset pixels mismatch");
        finalPixels = pixels.clone();
      }
      previousPixels = currentPixels;
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state])
          .append("\",\"pixel_sha256\":\"").append(currentPixels)
          .append("\",\"geometry_sha256\":\"").append(geometry).append("\"}");
      save(sketchPath(IDS[state] + ".png"));
      draws++;
      char next = KEYS[state];
      events.schedule(() -> postEvent(new KeyEvent(null, System.currentTimeMillis(),
          KeyEvent.PRESS, 0, next, 0)), 180, TimeUnit.MILLISECONDS);
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  @Override public void keyPressed() {
    require(keys < KEYS.length && key == KEYS[keys], "key order");
    super.keyPressed();
    keys++;
    if (key == 's') {
      long savedAt = System.nanoTime();
      events.schedule(() -> finish(savedAt), 300, TimeUnit.MILLISECONDS);
    }
  }

  private void finish(long savedAt) {
    try {
      long quiet = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - savedAt);
      require(quiet >= 300 && draws == 4 && keys == 4, "save quiet/sequence");
      File savedPath = new File(output, "curvespace.png");
      BufferedImage saved = ImageIO.read(savedPath);
      require(saved != null && saved.getWidth() == 960 && saved.getHeight() == 960,
          "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 960, 960, null, 0, 960)),
          "saved pixels differ");
      String json = "{\"status\":\"passed\",\"frames\":4,\"keys\":\"cr0s\","
          + "\"frame_records\":[" + records + "],\"quiet_ms\":" + quiet
          + ",\"core_code_source\":\"" + escape(codeSource(RadialPull2D.class))
          + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath())
          + "\",\"renderer\":\"" + g.getClass().getName()
          + "\",\"density\":" + pixelDensity + ",\"width\":"+width+",\"height\":"+height+"}";
      Files.write(new File(output, "native.json").toPath(),
          json.getBytes(StandardCharsets.UTF_8));
      events.shutdown();
      exit();
    } catch (Throwable error) {
      error.printStackTrace();
      System.exit(1);
    }
  }

  public static void main(String[] args) {
    if (args.length != 2) {
      throw new IllegalArgumentException("output directory and core JAR required");
    }
    File output = new File(args[0]);
    File jar = new File(args[1]);
    require(output.isDirectory() && jar.isFile(), "missing output/JAR");
    Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
      error.printStackTrace();
      System.exit(1);
    });
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "CurvespaceProbe"},
        new CurvespaceProbe(output, jar));
  }
}
