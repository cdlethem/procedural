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
import org.procedurals.processing.Java2DImagePlacement;
import org.procedurals.processing.Java2DLayers;
import org.procedurals.raster.MaskedComposite2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;

/** Bounded native lifecycle probe for the candidate PlacementImageMarks PDE. */
public final class PlacementImageMarksProbe extends PlacementImageMarks {
  private static final String[] IDS = {"baseline", "cover", "stretch", "contain-restored", "cropped", "aligned-end", "masked", "unmasked-restored"};
  private static final char[] KEYS = {'f', 'f', 'f', 'c', 'a', 'm', 'm', 's'};
  private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar, expectedAdapterJar;
  private int draws, keys;
  private long saveAt;
  private ImageIdentity sourceIdentity, groundIdentity;
  private double[] retainedMask, retainedFullCoverage;
  private String maskHash, fullCoverageHash, baselineHash, alignedHash, priorPixelsHash;
  private PImage priorPlaced, alignedPlaced, finalDisplayed;
  private String priorPlacedHash, alignedPlacedHash;
  private int[] finalPixels;
  private final StringBuilder records = new StringBuilder();

  private PlacementImageMarksProbe(File output, File expectedJar, File expectedAdapterJar) {
    this.output = output; this.expectedJar = expectedJar; this.expectedAdapterJar = expectedAdapterJar;
  }
  private static final class ImageIdentity {
    final PImage image; final String pixelsHash;
    ImageIdentity(PImage image) { this.image = image; image.loadPixels(); pixelsHash = hash(image.pixels); }
    void requireUnchanged(String name) { image.loadPixels(); require(pixelsHash.equals(hash(image.pixels)), name + " pixels changed"); }
  }
  private static void require(boolean condition, String message) { if (!condition) throw new AssertionError(message); }
  private static String escape(String value) { return value.replace("\\", "\\\\").replace("\"", "\\\""); }
  private static String codeSource(Class<?> type) throws Exception { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
  private static String hex(byte[] values) { StringBuilder result = new StringBuilder(); for (byte value : values) result.append(String.format("%02x", value & 255)); return result.toString(); }
  private static String hash(int[] pixels) { try { MessageDigest d=MessageDigest.getInstance("SHA-256"); for(int pixel:pixels)for(int shift=24;shift>=0;shift-=8)d.update((byte)(pixel>>>shift));return hex(d.digest()); } catch(Exception error){throw new IllegalStateException(error);} }
  private static String hash(double[] values) { try { MessageDigest d=MessageDigest.getInstance("SHA-256"); for(double value:values){long bits=Double.doubleToLongBits(value);for(int shift=56;shift>=0;shift-=8)d.update((byte)(bits>>>shift));}return hex(d.digest()); } catch(Exception error){throw new IllegalStateException(error);} }
  private void fail(Throwable error) { events.shutdownNow(); error.printStackTrace(); exit(); System.exit(1); }

  @Override public void setup() {
    try {
      super.setup();
      require(codeSource(MaskedComposite2D.class).equals(expectedJar.getCanonicalPath()), "compositor not from expected core JAR");
      require(codeSource(Java2DImagePlacement.class).equals(expectedAdapterJar.getCanonicalPath()), "placement not from expected adapter JAR");
      require(codeSource(Java2DLayers.class).equals(expectedAdapterJar.getCanonicalPath()), "layers not from expected adapter JAR");
      sourceIdentity = new ImageIdentity(source); groundIdentity = new ImageIdentity(ground);
      retainedMask = mask; retainedFullCoverage = fullCoverage; maskHash = hash(mask); fullCoverageHash = hash(fullCoverage);
    } catch (Throwable error) { fail(error); }
  }
  private void requireRetainedInputs() {
    require(source == sourceIdentity.image && ground == groundIdentity.image, "retained source/ground identity");
    require(mask == retainedMask && fullCoverage == retainedFullCoverage && maskHash.equals(hash(mask)) && fullCoverageHash.equals(hash(fullCoverage)), "retained coverage values");
    sourceIdentity.requireUnchanged("source"); groundIdentity.requireUnchanged("ground");
  }
  private void requireOutsideFrame() {
    for (int y=0,index=0;y<height;y++) for(int x=0;x<width;x++,index++)
      if (x<80 || x>=640 || y<60 || y>=420) require(displayed.pixels[index] == ground.pixels[index], "outside frame changed");
  }

  @Override public void draw() {
    try {
      if (!dirty) { super.draw(); return; }
      int state=draws; require(state<IDS.length,"unexpected draw"); super.draw(); loadPixels(); displayed.loadPixels(); ground.loadPixels();
      require(width==720 && height==480 && pixelDensity==1 && g instanceof PGraphicsJava2D,"JAVA2D density one");
      require(Arrays.equals(pixels,displayed.pixels),"cached/framebuffer mismatch"); for(int pixel:pixels)require((pixel>>>24)==255,"nonopaque framebuffer");
      requireRetainedInputs(); requireOutsideFrame();
      require(fitIndex==(state==1?1:state==2?2:0),"fit state");
      require(cropped==(state>=4),"crop state"); require(alignment==(state>=5?2:1),"alignment state"); require(masked==(state==6),"mask state");
      String pixelsHash=hash(pixels);
      if (state==0) { require(displayed.pixels[70*width+100]==ground.pixels[70*width+100],"contain margin does not expose ground"); baselineHash=pixelsHash; }
      else if (state==3) require(pixelsHash.equals(baselineHash),"contain did not restore baseline");
      if (state>0 && state!=3 && state!=7) require(!pixelsHash.equals(priorPixelsHash),"visible placement edit unchanged");
      if (state>0 && state<=5) require(placed!=priorPlaced,"placement edit did not recompute placed image");
      if (state==5) { alignedHash=pixelsHash; alignedPlaced=placed; alignedPlacedHash=hash(placed.pixels); }
      if (state==6 || state==7) require(placed==alignedPlaced && alignedPlacedHash.equals(hash(placed.pixels)),"mask switch rebuilt placed image");
      if (state==7) { require(pixelsHash.equals(alignedHash),"unmasked result did not restore alignment"); finalDisplayed=displayed; finalPixels=pixels.clone(); }
      priorPlaced=placed; priorPlacedHash=hash(placed.pixels);
      if(state>0)records.append(','); records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"").append(pixelsHash).append("\",\"placed_sha256\":\"").append(priorPlacedHash).append("\"}"); priorPixelsHash=pixelsHash;
      save(sketchPath(IDS[state]+".png")); draws++; char next=KEYS[state]; events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,next,0)),180,TimeUnit.MILLISECONDS);
    } catch(Throwable error){fail(error);}
  }
  @Override public void keyPressed() {
    try { require(keys<KEYS.length&&key==KEYS[keys],"key order"); super.keyPressed(); keys++; if(key=='s'){require(displayed==finalDisplayed&&!dirty,"save rebuilt cached display");saveAt=System.nanoTime();events.schedule(this::finish,300,TimeUnit.MILLISECONDS);} } catch(Throwable error){fail(error);}
  }
  private void finish() {
    try {
      long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-saveAt); require(quiet>=300&&draws==IDS.length&&keys==KEYS.length&&!dirty,"save quiet/incomplete sequence");
      File savedPath=new File(output,"placement-image-marks.png");BufferedImage saved=ImageIO.read(savedPath);require(saved!=null&&saved.getWidth()==720&&saved.getHeight()==480,"saved PNG dimensions");require(Arrays.equals(finalPixels,saved.getRGB(0,0,720,480,null,0,720)),"saved PNG differs from cached frame");
      String sources="{\"placement\":\""+escape(codeSource(Java2DImagePlacement.class))+"\",\"layers\":\""+escape(codeSource(Java2DLayers.class))+"\",\"compositor\":\""+escape(codeSource(MaskedComposite2D.class))+"\"}";
      String json="{\"status\":\"passed\",\"frames\":"+draws+",\"keys\":\""+new String(KEYS)+"\",\"frame_records\":["+records+"],\"saved_png\":\""+escape(savedPath.toString())+"\",\"core_code_source\":\""+escape(codeSource(MaskedComposite2D.class))+"\",\"expected_jar\":\""+escape(expectedJar.getCanonicalPath())+"\",\"expected_adapter_jar\":\""+escape(expectedAdapterJar.getCanonicalPath())+"\",\"code_sources\":"+sources+",\"quiet_ms\":"+quiet+",\"renderer\":\""+escape(g.getClass().getName())+"\",\"density\":"+pixelDensity+"}";
      Files.write(new File(output,"native.json").toPath(),(json+"\n").getBytes(StandardCharsets.UTF_8));events.shutdown();exit();System.exit(0);
    } catch(Throwable error){fail(error);}
  }
  public static void main(String[] args) {
    if(args.length!=2&&args.length!=3)throw new IllegalArgumentException("output directory, core JAR, and optional adapter JAR required");File output=new File(args[0]),coreJar=new File(args[1]),adapterJar=args.length==3?new File(args[2]):coreJar;require(output.isDirectory()&&coreJar.isFile()&&adapterJar.isFile(),"missing output/JAR");Thread.setDefaultUncaughtExceptionHandler((thread,error)->{error.printStackTrace();System.exit(1);});PApplet.runSketch(new String[]{"--sketch-path="+output.getAbsolutePath(),"PlacementImageMarksProbe"},new PlacementImageMarksProbe(output,coreJar,adapterJar));
  }
}
