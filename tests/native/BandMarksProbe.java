import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.procedurals.paths.NoiseBandPath2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Five-state native probe for the actual BandMarks PDE and retained path edits. */
public final class BandMarksProbe extends BandMarks {
  private static final String[] IDS={"baseline","wider","recolored","marks","reset"};
  private static final char[] KEYS={'t','c','m','0','s'};
  private final ScheduledExecutorService events=Executors.newSingleThreadScheduledExecutor();
  private final File output,expectedJar;
  private volatile int draws,keys;
  private NoiseBandPath2D[] baselinePaths;
  private NoiseBandPath2D[] widerPaths, widerIdentities;
  private String baselineGeometry,widerGeometry,baselinePixels,widerPixels,recoloredPixels;
  private int[] finalPixels;
  private final StringBuilder records=new StringBuilder();
  private BandMarksProbe(File o,File j){output=o;expectedJar=j;}
  private static void require(boolean ok,String message){if(!ok)throw new AssertionError(message);}
  private static String esc(String s){return s.replace("\\","\\\\").replace("\"","\\\"");}
  private static String source(Class<?> c)throws Exception{return new File(c.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();}
  private static String hash(NoiseBandPath2D[] ps)throws Exception{
    MessageDigest d=MessageDigest.getInstance("SHA-256"); double[] q=new double[2];
    for(NoiseBandPath2D p:ps){
      for(int i=0;i<p.size();i++){p.pointInto(i,q,0);put(d,Double.doubleToRawLongBits(q[0]));put(d,Double.doubleToRawLongBits(q[1]));}
      for(int i=0;i<p.accepted();i++)put(d,Double.doubleToRawLongBits(p.headingAt(i)));
      put(d,p.attempts());put(d,p.accepted());put(d,p.rejected());
    }
    return hex(d.digest());
  }
  private static void put(MessageDigest d,long v){for(int i=7;i>=0;i--)d.update((byte)(v >>> (8*i)));}
  private static String hex(byte[] b){StringBuilder s=new StringBuilder();for(byte v:b)s.append(String.format("%02x",v&255));return s.toString();}
  private static String pixels(int[] p)throws Exception{MessageDigest d=MessageDigest.getInstance("SHA-256");for(int v:p)put(d,v&0xffffffffL);return hex(d.digest());}
  @Override public void setup(){super.setup();try{require(source(NoiseBandPath2D.class).equals(expectedJar.getCanonicalPath()),"wrong core JAR");}catch(Exception e){throw new IllegalStateException(e);}}
  @Override public void draw(){
    try{
      int state=draws; require(state<5,"unexpected draw");
      require(width==640&&height==640&&pixelDensity==1&&g.getClass().getName().equals("processing.awt.PGraphicsJava2D"),"native environment");
      require(wider==(state>=1&&state<=3)&&alternate==(state==2||state==3)&&marks==(state==3),"edit state");
      NoiseBandPath2D[] current=paths; require(current!=null&&current.length==64,"64 retained paths");
      for(NoiseBandPath2D p:current){require(p.attempts()==2048&&p.size()==p.accepted()+1&&p.accepted()+p.rejected()==p.attempts(),"path counters");require(p.size()<=2049,"vertex cap");}
      if(state==0){baselinePaths=current;baselineGeometry=hash(current);}
      if(state==1){require(current!=baselinePaths,"wider rebuilt paths");for(int i=0;i<current.length;i++)require(current[i]!=baselinePaths[i],"wider retained a baseline path");widerPaths=current;widerIdentities=current.clone();widerGeometry=hash(current);require(!widerGeometry.equals(baselineGeometry),"wider did not change geometry");}
      if(state==2||state==3){require(current==widerPaths,"style edit replaced path array");for(int i=0;i<current.length;i++)require(current[i]==widerIdentities[i],"style edit replaced path");require(hash(current).equals(widerGeometry),"style edit changed geometry");}
      if(state==4){require(current!=baselinePaths,"reset did not rebuild paths");for(int i=0;i<current.length;i++)require(current[i]!=baselinePaths[i],"reset retained a baseline path");require(hash(current).equals(baselineGeometry),"reset geometry mismatch");}
      super.draw(); loadPixels(); displayedFrame.loadPixels();
      require(Arrays.equals(pixels,displayedFrame.pixels),"cached/framebuffer pixels differ");
      int changed=0;for(int v:pixels){require((v>>>24)==255,"nonopaque framebuffer");if((v&0xffffff)!=0xf5f0e6)changed++;}require(changed>0,"blank frame");
      String ph=pixels(pixels),gh=hash(current);if(state==0)baselinePixels=ph;if(state==1){widerPixels=ph;require(!ph.equals(baselinePixels),"wider made no visible change");}if(state==2){recoloredPixels=ph;require(!ph.equals(widerPixels),"recolor made no visible change");}if(state==3)require(!ph.equals(recoloredPixels),"marks made no visible change");if(state==4)require(ph.equals(baselinePixels),"reset pixels mismatch");
      long accepted=0,rejected=0;for(NoiseBandPath2D p:current){accepted+=p.accepted();rejected+=p.rejected();}
      if(state>0)records.append(',');records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"").append(ph).append("\",\"path_sha256\":\"").append(gh).append("\",\"accepted\":").append(accepted).append(",\"rejected\":").append(rejected).append('}');
      if(state==4)finalPixels=pixels.clone(); save(sketchPath(IDS[state]+".png")); draws++;
      final char next=KEYS[state];events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,next,0)),180,TimeUnit.MILLISECONDS);
    }catch(Exception e){throw new IllegalStateException(e);}
  }
  @Override public void keyPressed(){require(keys<5&&key==KEYS[keys],"key order");super.keyPressed();keys++;if(key=='s'){long savedAt=System.nanoTime();events.schedule(()->finish(savedAt),300,TimeUnit.MILLISECONDS);}}
  private void finish(long savedAt){try{long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-savedAt);require(quiet>=300&&draws==5&&keys==5,"save quiet/sequence");File saved=new File(output,"band-marks.png");java.awt.image.BufferedImage image=ImageIO.read(saved);require(image!=null&&image.getWidth()==640&&image.getHeight()==640,"saved dimensions");require(Arrays.equals(finalPixels,image.getRGB(0,0,640,640,null,0,640)),"saved pixels differ");String json="{\"status\":\"passed\",\"frames\":5,\"keys\":\"tcm0s\",\"frame_records\":["+records+"],\"quiet_ms\":"+quiet+",\"core_code_source\":\""+esc(source(NoiseBandPath2D.class))+"\",\"expected_jar\":\""+esc(expectedJar.getCanonicalPath())+"\",\"renderer\":\""+g.getClass().getName()+"\",\"density\":"+pixelDensity+"}";Files.write(new File(output,"native.json").toPath(),json.getBytes(StandardCharsets.UTF_8));events.shutdown();exit();}catch(Throwable t){t.printStackTrace();System.exit(1);}}
  public static void main(String[] a){if(a.length!=2)throw new IllegalArgumentException("output directory and core JAR required");File o=new File(a[0]),j=new File(a[1]);require(o.isDirectory()&&j.isFile(),"missing output/JAR");Thread.setDefaultUncaughtExceptionHandler((thread,error)->{error.printStackTrace();System.exit(1);});PApplet.runSketch(new String[]{"--sketch-path="+o.getAbsolutePath(),"BandMarksProbe"},new BandMarksProbe(o,j));}
}
