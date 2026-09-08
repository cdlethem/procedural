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
import org.procedurals.layout.RegularGrid;
import org.procedurals.processing.Java2DLayers;
import org.procedurals.processing.ProcessingImageField;
import org.procedurals.raster.RasterRemap2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;

/** Bounded native lifecycle probe for the candidate ImageFieldMarks PDE. */
public final class ImageFieldMarksProbe extends ImageFieldMarks {
  private static final String[] IDS={"baseline","visibility","size-restored","alternate-image","sampled-colors","colors-restored","baseline-restored"};
  private static final char[] KEYS={'m','m','i','c','c','i','s'};
  private final ScheduledExecutorService events=Executors.newSingleThreadScheduledExecutor();
  private final File output,coreJar,adapterJar; private int draws,keys; private long saveAt;
  private RegularGrid retainedGrid; private double[] retainedPositions; private PImage[] retainedSources; private ProcessingImageField.Samples[] retainedSamples;
  private String positionsHash,sourcesHash,samplesHash,baselineHash,alternateHash,previousHash; private PImage finalDisplayed; private int[] finalPixels; private final StringBuilder records=new StringBuilder();
  private ImageFieldMarksProbe(File output,File coreJar,File adapterJar){this.output=output;this.coreJar=coreJar;this.adapterJar=adapterJar;}
  private static void require(boolean v,String m){if(!v)throw new AssertionError(m);} private static String esc(String v){return v.replace("\\","\\\\").replace("\"","\\\"");}
  private static String source(Class<?> c)throws Exception{return new File(c.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();}
  private static String hash(int[] v){try{MessageDigest d=MessageDigest.getInstance("SHA-256");for(int x:v)for(int s=24;s>=0;s-=8)d.update((byte)(x>>>s));return hex(d.digest());}catch(Exception e){throw new IllegalStateException(e);}}
  private static String hash(double[] v){try{MessageDigest d=MessageDigest.getInstance("SHA-256");for(double x:v){long b=Double.doubleToLongBits(x);for(int s=56;s>=0;s-=8)d.update((byte)(b>>>s));}return hex(d.digest());}catch(Exception e){throw new IllegalStateException(e);}}
  private static String hex(byte[] v){StringBuilder b=new StringBuilder();for(byte x:v)b.append(String.format("%02x",x&255));return b.toString();}
  private static String hashes(PImage[] images){StringBuilder b=new StringBuilder();for(PImage image:images){image.loadPixels();b.append(hash(image.pixels));}return b.toString();}
  private static String hashes(ProcessingImageField.Samples[] values){StringBuilder b=new StringBuilder();for(ProcessingImageField.Samples s:values){b.append(s.size()).append(':');for(int i=0;i<s.size();i++)b.append(Integer.toHexString(s.argb(i))).append('/').append(Double.doubleToLongBits(s.alpha01(i))).append('/').append(Double.doubleToLongBits(s.maxRgb01(i))).append(';');}return b.toString();}
  private void fail(Throwable e){events.shutdownNow();e.printStackTrace();exit();System.exit(1);}
  @Override public void setup(){try{super.setup();require(source(RegularGrid.class).equals(coreJar.getCanonicalPath()),"grid origin");require(source(RasterRemap2D.class).equals(coreJar.getCanonicalPath()),"remap origin");require(source(ProcessingImageField.class).equals(adapterJar.getCanonicalPath()),"field origin");require(source(Java2DLayers.class).equals(adapterJar.getCanonicalPath()),"layers origin");retainedGrid=grid;retainedPositions=positions;retainedSources=sources;retainedSamples=samples;positionsHash=hash(positions);sourcesHash=hashes(sources);samplesHash=hashes(samples);require(grid.size()==1350&&positions.length==2700&&samples[0].size()==1350&&samples[1].size()==1350,"1350 grid/sample positions");}catch(Throwable e){fail(e);}}
  private void retained(){require(grid==retainedGrid&&positions==retainedPositions&&sources==retainedSources&&samples==retainedSamples,"retained identities");require(positionsHash.equals(hash(positions))&&sourcesHash.equals(hashes(sources))&&samplesHash.equals(hashes(samples)),"retained values");}
  @Override public void draw(){try{if(!dirty){super.draw();return;}int state=draws;require(state<IDS.length,"unexpected draw");super.draw();loadPixels();displayed.loadPixels();require(width==720&&height==480&&pixelDensity==1&&g instanceof PGraphicsJava2D,"JAVA2D density one");require(Arrays.equals(pixels,displayed.pixels),"cached/framebuffer mismatch");for(int p:pixels)require((p>>>24)==255,"nonopaque framebuffer");retained();require(sourceIndex==(state==3||state==4||state==5?1:0),"source state");require(visibility==(state==1),"visibility state");require(sourceColors==(state==4),"color state");String current=hash(pixels);if(state==0)baselineHash=current;else if(state==2)require(current.equals(baselineHash),"size did not restore baseline");else if(state==3)alternateHash=current;else if(state==5)require(current.equals(alternateHash),"colors did not restore alternate image");else if(state==6){require(current.equals(baselineHash),"baseline did not restore");finalDisplayed=displayed;finalPixels=pixels.clone();}if(state>0&&state!=2&&state!=5&&state!=6)require(!current.equals(previousHash),"edit did not change display");previousHash=current;if(state>0)records.append(',');records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"").append(current).append("\"}");save(sketchPath(IDS[state]+".png"));draws++;char next=KEYS[state];events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,next,0)),180,TimeUnit.MILLISECONDS);}catch(Throwable e){fail(e);}}
  @Override public void keyPressed(){try{require(keys<KEYS.length&&key==KEYS[keys],"key order");super.keyPressed();keys++;if(key=='s'){require(displayed==finalDisplayed&&!dirty,"save rebuilt cached display");saveAt=System.nanoTime();events.schedule(this::finish,300,TimeUnit.MILLISECONDS);}}catch(Throwable e){fail(e);}}
  private void finish(){try{long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-saveAt);require(quiet>=300&&draws==IDS.length&&keys==KEYS.length&&!dirty,"save quiet/sequence");File savedPath=new File(output,"image-field-marks.png");BufferedImage saved=ImageIO.read(savedPath);require(saved!=null&&saved.getWidth()==720&&saved.getHeight()==480,"saved dimensions");require(Arrays.equals(finalPixels,saved.getRGB(0,0,720,480,null,0,720)),"saved differs from cache");String origins="{\"grid\":\""+esc(source(RegularGrid.class))+"\",\"remap\":\""+esc(source(RasterRemap2D.class))+"\",\"field\":\""+esc(source(ProcessingImageField.class))+"\",\"layers\":\""+esc(source(Java2DLayers.class))+"\"}";String json="{\"status\":\"passed\",\"frames\":"+draws+",\"keys\":\""+new String(KEYS)+"\",\"frame_records\":["+records+"],\"saved_png\":\""+esc(savedPath.toString())+"\",\"core_code_source\":\""+esc(source(RegularGrid.class))+"\",\"expected_jar\":\""+esc(coreJar.getCanonicalPath())+"\",\"expected_adapter_jar\":\""+esc(adapterJar.getCanonicalPath())+"\",\"code_sources\":"+origins+",\"quiet_ms\":"+quiet+",\"renderer\":\""+esc(g.getClass().getName())+"\",\"density\":"+pixelDensity+"}";Files.write(new File(output,"native.json").toPath(),(json+"\n").getBytes(StandardCharsets.UTF_8));events.shutdown();exit();System.exit(0);}catch(Throwable e){fail(e);}}
  public static void main(String[] args){if(args.length!=2&&args.length!=3)throw new IllegalArgumentException("output/core/optional adapter JAR");File out=new File(args[0]),core=new File(args[1]),adapter=args.length==3?new File(args[2]):core;require(out.isDirectory()&&core.isFile()&&adapter.isFile(),"missing output/JAR");Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});PApplet.runSketch(new String[]{"--sketch-path="+out.getAbsolutePath(),"ImageFieldMarksProbe"},new ImageFieldMarksProbe(out,core,adapter));}
}
