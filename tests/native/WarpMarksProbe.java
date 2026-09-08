import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import javax.imageio.ImageIO;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Native JAVA2D lifecycle probe for the candidate WarpMarks starter. */
public final class WarpMarksProbe extends WarpMarks {
  private static final String[] IDS={"baseline","strength64","zero","restored","sinusoidal","stripes","reset"};
  private static final char[] KEYS={'w','w','w','f','p','0','s'};
  private final ScheduledExecutorService events=Executors.newSingleThreadScheduledExecutor();
  private final File output, expectedJar;
  private volatile int draws, keys; private long saveAt;
  private int[] finalPixels;
  private String sourceHash;
  private final StringBuilder records=new StringBuilder();
  private WarpMarksProbe(File output,File jar){this.output=output;expectedJar=jar;}
  private static void require(boolean ok,String message){if(!ok)throw new AssertionError(message);}
  private static String esc(String s){return s.replace("\\","\\\\").replace("\"","\\\"");}
  private static String hash(int[] p){try{MessageDigest d=MessageDigest.getInstance("SHA-256");for(int v:p){d.update((byte)(v>>>24));d.update((byte)(v>>>16));d.update((byte)(v>>>8));d.update((byte)v);}StringBuilder s=new StringBuilder();for(byte b:d.digest())s.append(String.format("%02x",b&255));return s.toString();}catch(Exception e){throw new IllegalStateException(e);}}
  private static String codeSource(Class<?> c)throws Exception{return new File(c.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();}
  @Override public void setup(){
    super.setup();
    try { require(codeSource(org.procedurals.raster.RasterRemap2D.class).equals(expectedJar.getCanonicalPath()), "candidate JAR not loaded"); }
    catch(Exception error){ throw new IllegalStateException(error); }
  }
  @Override public void draw(){
    require(draws<IDS.length,"unexpected draw"); super.draw(); loadPixels(); displayedFrame.loadPixels();
    require(width==640&&height==640&&pixelDensity==1&&g.getClass().getName().equals("processing.awt.PGraphicsJava2D"),"JAVA2D density/size"); require(displayedFrame.width==640&&displayedFrame.height==640,"display size");
    int changed=0; for(int i=0;i<pixels.length;i++){require((pixels[i]>>>24)==255,"nonopaque framebuffer"); if(pixels[i]!=(displayedFrame.pixels[i]))throw new AssertionError("cached/framebuffer mismatch"); if((pixels[i]&0xffffff)!=0xf8f5ee)changed++;}
    require(changed>0,"blank frame"); String h=hash(pixels); if(draws>0)records.append(','); records.append("{\"id\":\"").append(IDS[draws]).append("\",\"sha256\":\"").append(h).append("\"}");
    if(draws==0){baselineHash=h;baselineSource=sourcePixels;sourceHash=hash(sourcePixels);}
    if(draws>0&&draws<5){require(sourcePixels==baselineSource,"source replaced during field/strength edit");require(hash(sourcePixels).equals(sourceHash),"source mutated during field/strength edit");}
    if(draws==2){require(h.equals(hash(sourcePixels)),"zero is not source identity");}
    if(draws==3||draws==6)require(h.equals(baselineHash),"reset mismatch");
    if(draws==1||draws==4||draws==5)require(!h.equals(baselineHash),"edit did not change display");
    if(draws==5)require(sourcePixels!=baselineSource,"pattern did not recapture source");
    if(draws==6)require(sourcePixels!=baselineSource,"reset did not recapture source");
    require(strength == (draws==1 ? 64 : draws==2 ? 0 : 32), "strength state");
    require(alternateField == (draws==4 || draws==5) && stripes == (draws==5), "field/pattern state");
    save(sketchPath(IDS[draws]+".png"));
    if(draws==6) finalPixels=pixels.clone();
    final char nextKey=KEYS[draws];
    draws++; events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,nextKey,0)),180,TimeUnit.MILLISECONDS);
  }
  private String baselineHash; private int[] baselineSource;
  @Override public void keyPressed(){require(keys<KEYS.length&&key==KEYS[keys],"key order"); super.keyPressed(); keys++; if(key=='s'){saveAt=System.nanoTime();events.schedule(this::finish,300,TimeUnit.MILLISECONDS);}}
  private void finish(){try{long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-saveAt);require(quiet>=300&&draws==7&&keys==7,"completion/quiet");Path saved=output.toPath().resolve("warp-marks.png");require(Files.isRegularFile(saved),"save missing");java.awt.image.BufferedImage png=ImageIO.read(saved.toFile());require(png!=null&&png.getWidth()==640&&png.getHeight()==640,"saved PNG dimensions");for(int y=0;y<640;y++)for(int x=0;x<640;x++)require(png.getRGB(x,y)==finalPixels[y*640+x],"saved PNG differs from display");String json="{\"status\":\"passed\",\"frames\":"+draws+",\"keys\":\""+new String(KEYS)+"\",\"frame_records\":["+records+"],\"saved_png\":\""+esc(saved.toString())+"\",\"core_code_source\":\""+esc(codeSource(org.procedurals.raster.RasterRemap2D.class))+"\",\"expected_jar\":\""+esc(expectedJar.getCanonicalPath())+"\",\"quiet_ms\":"+quiet+",\"renderer\":\""+esc(g.getClass().getName())+"\",\"density\":"+pixelDensity+"}\n";Files.write(output.toPath().resolve("native.json"),json.getBytes(StandardCharsets.UTF_8));events.shutdown();exit();}catch(Throwable t){t.printStackTrace();System.exit(1);}}
  public static void main(String[] args){if(args.length!=2)throw new IllegalArgumentException("output and jar required");File o=new File(args[0]),j=new File(args[1]);if(!o.isDirectory()||!j.isFile())throw new IllegalArgumentException("invalid output/jar");Thread.setDefaultUncaughtExceptionHandler((thread,error)->{error.printStackTrace();System.exit(1);});PApplet.runSketch(new String[]{"--sketch-path="+o.getAbsolutePath(),"WarpMarksProbe"},new WarpMarksProbe(o,j));}
}
