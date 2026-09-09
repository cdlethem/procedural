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
import org.procedurals.processing.Java2DLayers;
import org.procedurals.geometry.DiscProjection2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;

/** Bounded native lifecycle probe for the candidate ProjectionMarks PDE. */
public final class ProjectionMarksProbe extends ProjectionMarks {
  private static final String[] IDS={"baseline","full","zero","strength-restored","reversed","recolored","colors-restored","order-restored"};
  private static final char[] KEYS={'m','m','m','o','c','c','o','s'};
  private final ScheduledExecutorService events=Executors.newSingleThreadScheduledExecutor();
  private final File output,coreJar,adapterJar; private int draws,keys; private long saveAt;
  private double[] retainedInput;
  private double[][] retainedOrders, orderElements, retainedCoordinates, coordinateElements;
  private DiscProjection2D[] retainedResults, resultElements;
  private String inputHash, ordersHash, coordinatesHash, strengthHash;
  private String baselineHash, reversedHash, previousHash;
  private PImage finalDisplayed; private int[] finalPixels; private final StringBuilder records=new StringBuilder();
  private ProjectionMarksProbe(File output,File coreJar,File adapterJar){this.output=output;this.coreJar=coreJar;this.adapterJar=adapterJar;}
  private static void require(boolean v,String m){if(!v)throw new AssertionError(m);} private static String esc(String v){return v.replace("\\","\\\\").replace("\"","\\\"");}
  private static String source(Class<?> c)throws Exception{return new File(c.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();}
  private static String hex(byte[] v){StringBuilder b=new StringBuilder();for(byte x:v)b.append(String.format("%02x",x&255));return b.toString();}
  private static String hash(int[] v){try{MessageDigest d=MessageDigest.getInstance("SHA-256");for(int x:v)for(int s=24;s>=0;s-=8)d.update((byte)(x>>>s));return hex(d.digest());}catch(Exception e){throw new IllegalStateException(e);}}
  private static String hash(double[] v){try{MessageDigest d=MessageDigest.getInstance("SHA-256");for(double x:v){long b=Double.doubleToLongBits(x);for(int s=56;s>=0;s-=8)d.update((byte)(b>>>s));}return hex(d.digest());}catch(Exception e){throw new IllegalStateException(e);}}
  private static String buffersHash(double[][] values) {
    StringBuilder result = new StringBuilder();
    for (double[] value : values) result.append(hash(value));
    return result.toString();
  }
  private void fail(Throwable e){events.shutdownNow();e.printStackTrace();exit();System.exit(1);}
  @Override public void setup() {
    try {
      super.setup();
      require(source(DiscProjection2D.class).equals(coreJar.getCanonicalPath()), "projection origin");
      require(source(Java2DLayers.class).equals(adapterJar.getCanonicalPath()), "layers origin");
      retainedInput = inputPoints;
      retainedOrders = discOrders; orderElements = discOrders.clone();
      retainedCoordinates = coordinates; coordinateElements = coordinates.clone();
      retainedResults = projected; resultElements = projected.clone();
      inputHash = hash(inputPoints); ordersHash = buffersHash(discOrders);
      coordinatesHash = buffersHash(coordinates); strengthHash = hash(STRENGTHS);
      require(inputPoints.length == 3386 && projected.length == 6 && projectionCalls == 6, "setup inventory");
    } catch (Throwable error) { fail(error); }
  }
  private void retained() {
    require(inputPoints == retainedInput && discOrders == retainedOrders
        && coordinates == retainedCoordinates && projected == retainedResults, "retained arrays");
    for (int i = 0; i < discOrders.length; i++) require(discOrders[i] == orderElements[i], "disc buffer identity");
    for (int i = 0; i < projected.length; i++) {
      require(projected[i] == resultElements[i] && coordinates[i] == coordinateElements[i], "individual result identity");
      require(Arrays.equals(projected[i].points(), coordinates[i]), "retained result values");
    }
    require(inputHash.equals(hash(inputPoints)) && ordersHash.equals(buffersHash(discOrders))
        && coordinatesHash.equals(buffersHash(coordinates)) && strengthHash.equals(hash(STRENGTHS)), "retained values");
    require(projectionCalls == 6, "display edit recomputed projection");
  }
  @Override public void draw(){try{if(!dirty){super.draw();return;}int state=draws;require(state<IDS.length,"unexpected draw");super.draw();loadPixels();displayed.loadPixels();require(width==720&&height==480&&pixelDensity==1&&g instanceof PGraphicsJava2D,"JAVA2D density one");require(Arrays.equals(pixels,displayed.pixels),"cached/framebuffer mismatch");for(int p:pixels)require((p>>>24)==255,"nonopaque framebuffer");retained();
    require(mode==(state==1?1:state==2?2:0),"mode state");require(order==(state>=4&&state<=6?1:0),"order state");require(alternate==(state==5),"color state");String current=hash(pixels);
    if (state == 0) baselineHash = current;
    if (state == 3 || state == 7) require(current.equals(baselineHash), "baseline restore");
    if (state == 4) reversedHash = current;
    if (state == 6) require(current.equals(reversedHash), "color restore");
    if (state == 7) { finalDisplayed = displayed; finalPixels = pixels.clone(); }
    if (state > 0 && state != 3 && state != 6 && state != 7) require(!current.equals(previousHash), "edit did not change display");
    previousHash = current;
    if(state>0)records.append(',');records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"").append(current).append("\"}");save(sketchPath(IDS[state]+".png"));draws++;char next=KEYS[state];events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,next,0)),180,TimeUnit.MILLISECONDS);
  }catch(Throwable e){fail(e);}}
  @Override public void keyPressed(){try{require(keys<KEYS.length&&key==KEYS[keys],"key order");super.keyPressed();keys++;if(key=='s'){require(displayed==finalDisplayed&&!dirty,"save rebuilt cache");saveAt=System.nanoTime();events.schedule(this::finish,300,TimeUnit.MILLISECONDS);}}catch(Throwable e){fail(e);}}
  private void finish(){try{long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-saveAt);require(quiet>=300&&draws==IDS.length&&keys==KEYS.length&&!dirty&&projectionCalls==6,"save quiet/sequence");File savedPath=new File(output,"projection-marks.png");BufferedImage saved=ImageIO.read(savedPath);require(saved!=null&&saved.getWidth()==720&&saved.getHeight()==480,"saved dimensions");require(Arrays.equals(finalPixels,saved.getRGB(0,0,720,480,null,0,720)),"saved differs from cache");String origins="{\"projection\":\""+esc(source(DiscProjection2D.class))+"\",\"layers\":\""+esc(source(Java2DLayers.class))+"\"}";String json="{\"status\":\"passed\",\"frames\":"+draws+",\"keys\":\""+new String(KEYS)+"\",\"frame_records\":["+records+"],\"saved_png\":\""+esc(savedPath.toString())+"\",\"core_code_source\":\""+esc(source(DiscProjection2D.class))+"\",\"expected_jar\":\""+esc(coreJar.getCanonicalPath())+"\",\"expected_adapter_jar\":\""+esc(adapterJar.getCanonicalPath())+"\",\"code_sources\":"+origins+",\"projection_calls\":"+projectionCalls+",\"quiet_ms\":"+quiet+",\"renderer\":\""+esc(g.getClass().getName())+"\",\"density\":"+pixelDensity+"}";Files.write(new File(output,"native.json").toPath(),(json+"\n").getBytes(StandardCharsets.UTF_8));events.shutdown();exit();System.exit(0);}catch(Throwable e){fail(e);}}
  public static void main(String[] args){if(args.length!=2&&args.length!=3)throw new IllegalArgumentException("output/core/optional adapter JAR");File out=new File(args[0]),core=new File(args[1]),adapter=args.length==3?new File(args[2]):core;require(out.isDirectory()&&core.isFile()&&adapter.isFile(),"missing output/JAR");Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});PApplet.runSketch(new String[]{"--sketch-path="+out.getAbsolutePath(),"ProjectionMarksProbe"},new ProjectionMarksProbe(out,core,adapter));}
}
