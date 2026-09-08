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
import org.procedurals.processing.ProcessingImageFilters;
import org.procedurals.raster.MaskedComposite2D;
import org.procedurals.raster.RasterCrossfade2D;
import org.procedurals.raster.SeparableBlur2D;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;

/** Bounded native lifecycle probe for the candidate BlurMarks PDE. */
public final class BlurMarksProbe extends BlurMarks {
  private static final String[] IDS={"sharp","soft","horizontal","vertical","blended","vertical-restored","sharp-restored"};
  private static final char[] KEYS={'m','m','m','b','b','m','s'};
  private final ScheduledExecutorService events=Executors.newSingleThreadScheduledExecutor();
  private final File output,coreJar,adapterJar; private int draws,keys; private long saveAt;
  private PImage[] retainedLayers,retainedLayerElements; private PImage retainedGround; private double[] retainedSoft,retainedDirectional,retainedDelta,retainedTransition,retainedCoverage;
  private String layersHash,groundHash,softHash,directionalHash,deltaHash,transitionHash,coverageHash,sharpHash,verticalHash,previousHash;
  private PImage finalDisplayed; private int[] finalPixels; private final StringBuilder records=new StringBuilder();
  private BlurMarksProbe(File output,File coreJar,File adapterJar){this.output=output;this.coreJar=coreJar;this.adapterJar=adapterJar;}
  private static void require(boolean v,String m){if(!v)throw new AssertionError(m);} private static String esc(String v){return v.replace("\\","\\\\").replace("\"","\\\"");}
  private static String source(Class<?> c)throws Exception{return new File(c.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();}
  private static String hex(byte[] v){StringBuilder b=new StringBuilder();for(byte x:v)b.append(String.format("%02x",x&255));return b.toString();}
  private static String hash(int[] v){try{MessageDigest d=MessageDigest.getInstance("SHA-256");for(int x:v)for(int s=24;s>=0;s-=8)d.update((byte)(x>>>s));return hex(d.digest());}catch(Exception e){throw new IllegalStateException(e);}}
  private static String hash(double[] v){try{MessageDigest d=MessageDigest.getInstance("SHA-256");for(double x:v){long b=Double.doubleToLongBits(x);for(int s=56;s>=0;s-=8)d.update((byte)(b>>>s));}return hex(d.digest());}catch(Exception e){throw new IllegalStateException(e);}}
  private static String layerHash(PImage[] images){StringBuilder b=new StringBuilder();for(PImage image:images){image.loadPixels();b.append(hash(image.pixels));}return b.toString();}
  private void fail(Throwable e){events.shutdownNow();e.printStackTrace();exit();System.exit(1);}
  @Override public void setup(){try{super.setup();
    require(source(SeparableBlur2D.class).equals(coreJar.getCanonicalPath()),"filter core origin");require(source(MaskedComposite2D.class).equals(coreJar.getCanonicalPath()),"compositor origin");require(source(RasterCrossfade2D.class).equals(coreJar.getCanonicalPath()),"crossfade origin");require(source(ProcessingImageFilters.class).equals(adapterJar.getCanonicalPath()),"filter adapter origin");require(source(Java2DLayers.class).equals(adapterJar.getCanonicalPath()),"layers adapter origin");
    retainedLayers=layers;retainedLayerElements=layers.clone();retainedGround=ground;retainedSoft=softKernel;retainedDirectional=directionalKernel;retainedDelta=deltaKernel;retainedTransition=transition;retainedCoverage=coverage;
    layersHash=layerHash(layers);ground.loadPixels();groundHash=hash(ground.pixels);softHash=hash(softKernel);directionalHash=hash(directionalKernel);deltaHash=hash(deltaKernel);transitionHash=hash(transition);coverageHash=hash(coverage);require(filterCalls==3,"setup filters");
  }catch(Throwable e){fail(e);}}
  private void retained(){require(layers==retainedLayers&&ground==retainedGround&&softKernel==retainedSoft&&directionalKernel==retainedDirectional&&deltaKernel==retainedDelta&&transition==retainedTransition&&coverage==retainedCoverage,"retained identity");for(int i=0;i<layers.length;i++)require(layers[i]==retainedLayerElements[i],"retained layer "+i+" identity");require(layersHash.equals(layerHash(layers))&&softHash.equals(hash(softKernel))&&directionalHash.equals(hash(directionalKernel))&&deltaHash.equals(hash(deltaKernel))&&transitionHash.equals(hash(transition))&&coverageHash.equals(hash(coverage)),"retained values");ground.loadPixels();require(groundHash.equals(hash(ground.pixels)),"ground changed");require(filterCalls==3,"mode/filter edit reran filter");}
  @Override public void draw(){try{if(!dirty){super.draw();return;}int state=draws;require(state<IDS.length,"unexpected draw");super.draw();loadPixels();displayed.loadPixels();require(width==720&&height==480&&pixelDensity==1&&g instanceof PGraphicsJava2D,"JAVA2D density one");require(Arrays.equals(pixels,displayed.pixels),"cached/framebuffer mismatch");for(int p:pixels)require((p>>>24)==255,"nonopaque framebuffer");retained();
    require(mode==(state==0||state==6?0:state==1?1:state==2?2:3),"mode state");require(blended==(state==4),"blend state");String current=hash(pixels);
    if(state==0)sharpHash=current;else if(state==3)verticalHash=current;else if(state==5)require(current.equals(verticalHash),"vertical did not restore");else if(state==6){require(current.equals(sharpHash),"sharp did not restore");finalDisplayed=displayed;finalPixels=pixels.clone();}
    if(state>0&&state!=5&&state!=6)require(!current.equals(previousHash),"edit did not change display");previousHash=current;
    if(state>0)records.append(',');records.append("{\"id\":\"").append(IDS[state]).append("\",\"pixel_sha256\":\"").append(current).append("\"}");save(sketchPath(IDS[state]+".png"));draws++;char next=KEYS[state];events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,next,0)),180,TimeUnit.MILLISECONDS);
  }catch(Throwable e){fail(e);}}
  @Override public void keyPressed(){try{require(keys<KEYS.length&&key==KEYS[keys],"key order");super.keyPressed();keys++;if(key=='s'){require(displayed==finalDisplayed&&!dirty,"save rebuilt cache");saveAt=System.nanoTime();events.schedule(this::finish,300,TimeUnit.MILLISECONDS);}}catch(Throwable e){fail(e);}}
  private void finish(){try{long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-saveAt);require(quiet>=300&&draws==IDS.length&&keys==KEYS.length&&!dirty&&filterCalls==3,"save quiet/sequence");File savedPath=new File(output,"blur-marks.png");BufferedImage saved=ImageIO.read(savedPath);require(saved!=null&&saved.getWidth()==720&&saved.getHeight()==480,"saved dimensions");require(Arrays.equals(finalPixels,saved.getRGB(0,0,720,480,null,0,720)),"saved differs from cache");String origins="{\"filter\":\""+esc(source(SeparableBlur2D.class))+"\",\"compositor\":\""+esc(source(MaskedComposite2D.class))+"\",\"crossfade\":\""+esc(source(RasterCrossfade2D.class))+"\",\"filters\":\""+esc(source(ProcessingImageFilters.class))+"\",\"layers\":\""+esc(source(Java2DLayers.class))+"\"}";String json="{\"status\":\"passed\",\"frames\":"+draws+",\"keys\":\""+new String(KEYS)+"\",\"frame_records\":["+records+"],\"saved_png\":\""+esc(savedPath.toString())+"\",\"core_code_source\":\""+esc(source(SeparableBlur2D.class))+"\",\"expected_jar\":\""+esc(coreJar.getCanonicalPath())+"\",\"expected_adapter_jar\":\""+esc(adapterJar.getCanonicalPath())+"\",\"code_sources\":"+origins+",\"filter_calls\":"+filterCalls+",\"quiet_ms\":"+quiet+",\"renderer\":\""+esc(g.getClass().getName())+"\",\"density\":"+pixelDensity+"}";Files.write(new File(output,"native.json").toPath(),(json+"\n").getBytes(StandardCharsets.UTF_8));events.shutdown();exit();System.exit(0);}catch(Throwable e){fail(e);}}
  public static void main(String[] args){if(args.length!=2&&args.length!=3)throw new IllegalArgumentException("output/core/optional adapter JAR");File out=new File(args[0]),core=new File(args[1]),adapter=args.length==3?new File(args[2]):core;require(out.isDirectory()&&core.isFile()&&adapter.isFile(),"missing output/JAR");Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});PApplet.runSketch(new String[]{"--sketch-path="+out.getAbsolutePath(),"BlurMarksProbe"},new BlurMarksProbe(out,core,adapter));}
}
