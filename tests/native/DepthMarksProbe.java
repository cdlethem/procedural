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
import org.procedurals.fields.GradientNoise3D01;
import org.procedurals.mesh.RadialProfile3D;
import org.procedurals.layout.RegularGrid;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Five-state native probe for the actual DepthMarks PDE and retained field, geometry and sampled values. */
public final class DepthMarksProbe extends DepthMarks {
  private static final String[] IDS = {"baseline", "depth_changed", "recolored", "mesh", "reset"};
  private static final char[] KEYS = {'z', 'c', 'm', '0', 's'};

  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output;
  private final File expectedJar;
  private volatile int draws;
  private volatile int keys;
  private GradientNoise3D01 retainedField;
  private RadialProfile3D retainedMesh;
  private RegularGrid retainedGrid;
  private double[] changedPlanar, changedMesh;
  private String baselineSamples, changedSamples, baselineGeometry;
  private String baselinePixels;
  private String movedPixels;
  private String recoloredPixels;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private DepthMarksProbe(File output, File expectedJar) {
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

  private String sampleHash() throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (double value : planarSamples) putLong(digest, Double.doubleToRawLongBits(value));
    for (double value : meshSamples) putLong(digest, Double.doubleToRawLongBits(value));
    return hex(digest.digest());
  }

  private String geometryHash() throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    double[] point = new double[3]; int[] triangle = new int[3];
    for (int i = 0; i < mesh.vertexCount(); i++) {
      mesh.vertexInto(i,point,0);
      for (double value : point) putLong(digest, Double.doubleToRawLongBits(value));
    }
    for (int i = 0; i < mesh.faceCount(); i++) {
      mesh.triangleInto(i,triangle,0); for (int value : triangle) putLong(digest,value);
    }
    digest.update(grid.toMap().toString().getBytes(StandardCharsets.UTF_8));
    return hex(digest.digest());
  }

  private void verifySamples() {
    require(planarSamples.length == grid.size() && meshSamples.length == mesh.faceCount(), "sample counts");
    double[] p = new double[2];
    for (int i=0;i<planarSamples.length;i++) {
      grid.pointInto(i,p,0);
      require(planarSamples[i] == field.sample(p[0]/96.0,p[1]/96.0,depth), "planar scalar");
    }
    int[] triangle=new int[3]; double[] vertex=new double[3]; int depthDifferences=0;
    for(int face=0;face<mesh.faceCount();face++) {
      double[] center=new double[3]; mesh.triangleInto(face,triangle,0);
      for(int corner=0;corner<3;corner++) {
        mesh.vertexInto(triangle[corner],vertex,0);
        for(int axis=0;axis<3;axis++) center[axis]+=vertex[axis];
      }
      for(int axis=0;axis<3;axis++) {
        center[axis]/=3.0;
        require(center[axis]==faceCenters[face*3+axis], "face centroid");
      }
      double expected=field.sample(center[0]/96.0+3.0,center[1]/96.0+3.0,center[2]/96.0+depth);
      require(meshSamples[face]==expected,"volumetric scalar");
      if(expected!=field.sample(center[0]/96.0+3.0,center[1]/96.0+3.0,depth)) depthDifferences++;
    }
    require(depthDifferences>0,"mesh ignored spatial z");
  }

  private static String pixelHash(int[] pixels) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    for (int value : pixels) putLong(digest, value & 0xffffffffL);
    return hex(digest.digest());
  }

  @Override public void setup() {
    super.setup();
    try {
      require(codeSource(GradientNoise3D01.class).equals(expectedJar.getCanonicalPath())
          && codeSource(RadialProfile3D.class).equals(expectedJar.getCanonicalPath())
          && codeSource(RegularGrid.class).equals(expectedJar.getCanonicalPath()),
          "wrong core JAR");
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  @Override public void draw() {
    try {
      int state = draws;
      require(state < IDS.length, "unexpected draw");
      require(width == 640 && height == 640 && pixelDensity == 1
          && g.getClass().getName().equals("processing.opengl.PGraphics3D"),
          "native environment");
      require(depth == (state>=1 && state<=3 ? 1.25 : 0.25), "depth state");
      require(alternate == (state==2 || state==3), "palette state");
      require(meshMode == (state==3), "mesh state");
      require(field.serialize().get("seed").equals(42L), "explicit field seed");
      verifySamples();
      String geometry=geometryHash(), samples=sampleHash();
      if(state==0) {
        retainedField=field;retainedMesh=mesh;retainedGrid=grid;
        baselineGeometry=geometry;baselineSamples=samples;
      } else {
        require(field==retainedField && mesh==retainedMesh && grid==retainedGrid, "retained infrastructure identity");
        require(geometry.equals(baselineGeometry), "geometry changed");
        if(state==1) {
          require(!samples.equals(baselineSamples),"depth did not change samples");
          changedPlanar=planarSamples;changedMesh=meshSamples;changedSamples=samples;
        } else if(state==2 || state==3) {
          require(planarSamples==changedPlanar && meshSamples==changedMesh,"style replaced samples");
          require(samples.equals(changedSamples),"style changed samples");
        } else {
          require(planarSamples!=changedPlanar && meshSamples!=changedMesh,"reset did not resample");
          require(samples.equals(baselineSamples),"reset samples mismatch");
        }
      }

      super.draw();
      loadPixels();
      displayedFrame.loadPixels();
      require(Arrays.equals(pixels, displayedFrame.pixels), "cached/framebuffer mismatch");
      int changed = 0;
      for (int pixel : pixels) {
        require((pixel >>> 24) == 255, "nonopaque framebuffer");
        if ((pixel & 0xffffff) != 0xf7f2e6) changed++;
      }
      require(changed > 0, "blank frame");
      String currentPixels = pixelHash(pixels);
      if (state == 0) baselinePixels = currentPixels;
      if (state == 1) {
        movedPixels = currentPixels;
        require(!movedPixels.equals(baselinePixels), "move made no visible change");
      }
      if (state == 2) {
        recoloredPixels = currentPixels;
        require(!recoloredPixels.equals(movedPixels), "recolor made no visible change");
      }
      if (state == 3) require(!currentPixels.equals(recoloredPixels), "mesh made no visible change");
      if (state == 4) {
        require(currentPixels.equals(baselinePixels), "reset pixels mismatch");
        finalPixels = pixels.clone();
      }
      if (state > 0) records.append(',');
      records.append("{\"id\":\"").append(IDS[state])
          .append("\",\"pixel_sha256\":\"").append(currentPixels)
          .append("\",\"sample_sha256\":\"").append(sampleHash()).append("\"}");
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
      require(quiet >= 300 && draws == 5 && keys == 5, "save quiet/sequence");
      File savedPath = new File(output, "depth-marks.png");
      BufferedImage saved = ImageIO.read(savedPath);
      require(saved != null && saved.getWidth() == 640 && saved.getHeight() == 640,
          "saved dimensions");
      require(Arrays.equals(finalPixels, saved.getRGB(0, 0, 640, 640, null, 0, 640)),
          "saved pixels differ");
      String json = "{\"status\":\"passed\",\"frames\":5,\"keys\":\"zcm0s\","
          + "\"frame_records\":[" + records + "],\"quiet_ms\":" + quiet
          + ",\"core_code_source\":\"" + escape(codeSource(GradientNoise3D01.class))
          + "\",\"expected_jar\":\"" + escape(expectedJar.getCanonicalPath())
          + "\",\"renderer\":\"" + g.getClass().getName()
          + "\",\"density\":" + pixelDensity + ",\"width\":" + width + ",\"height\":" + height + "}";
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
    PApplet.runSketch(new String[]{"--sketch-path=" + output.getAbsolutePath(), "DepthMarksProbe"},
        new DepthMarksProbe(output, jar));
  }
}
