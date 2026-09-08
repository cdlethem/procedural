import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.opengl.PGraphics2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;
import org.procedurals.topology.Delaunay2D;
import org.procedurals.layout.QuadrantPartition2D;
import org.procedurals.examples.landscapemarks.LandscapeComposition;
import org.procedurals.color.CyclicPalette;

/** Observe the actual preprocessed PDE; geometry goldens remain in core conformance. */
public final class LandscapeMarksProbe extends LandscapeMarks {
  static final String[] IDS = {"baseline","palette","reset-colour","uniform","reset-height","new-seed","final-reset"};
  static final char[] NEXT = "c0p0r0s".toCharArray();
  final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  final File expectedCore;
  final StringBuilder records = new StringBuilder();
  int draws, keys, vertices, boxes, spikeIndex;
  boolean drawingSpikes;
  float lastX,lastY,lastZ;
  boolean observing;
  LandscapeComposition previous;
  Map<String,Object> baselineValues, previousValues;
  int[] baselinePixels, previousPixels;
  PImage savedFrame;
  LandscapeMarksProbe(File core) { expectedCore = core; }
  static void require(boolean yes, String why) { if (!yes) throw new AssertionError(why); }
  static void f(float actual, double expected) {
    require(Float.floatToRawIntBits(actual)==Float.floatToRawIntBits((float)expected),"coordinate/style value");
  }
  static String source(Class<?> type) {
    try { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
    catch(Exception e) { throw new IllegalStateException(e); }
  }
  static boolean reset(int i) { return i==2 || i==4 || i==6; }
  static boolean style(int i) { return i==1 || i==3; }
  void state(int i) {
    require(SEED==(i==5?43:42) && UNIFORM==(i==3) && COLOR==(i==1?1:0),"settings");
    require(composition.placements().attempts()==50 && composition.mesh().inputCount()==composition.placements().size(),"source structural cell count");
    Map<String,Object> values=composition.mesh().toValues();
    if(i==0) baselineValues=values;
    else if(style(i)) require(composition==previous && values.equals(previousValues),"retained topology and spike selection");
    else {
      require(composition!=previous,"new structural result");
      require(reset(i)?values.equals(baselineValues):!values.equals(previousValues),"structural values/reset");
    }
  }
  int horizons, stripeLayers, disks, rings, specks;
  @Override public void drawHorizon() { horizons++;super.drawHorizon(); }
  @Override public void drawStripes(boolean sky) { stripeLayers++;super.drawStripes(sky); }
  @Override public void drawDisk(int i) { disks++;super.drawDisk(i); }
  @Override public void drawSpeck(int i) { specks++;super.drawSpeck(i); }
  @Override public void ring(float x,float y,float w1,float h1,float w2,float h2,int rgb,float a1,float a2,boolean shadow) {
    rings++;super.ring(x,y,w1,h1,w2,h2,rgb,a1,a2,shadow);
  }
  @Override public void setup() {
    super.setup();
    require(width==960 && height==960 && pixelDensity==1 && g instanceof PGraphics2D,"environment");
    for(Class<?> c:new Class<?>[]{Delaunay2D.class,CyclicPalette.class,org.procedurals.fields.GradientNoise2D01.class,org.procedurals.sampling.CirclePlacements2D.class})
      require(source(c).equals(expectedCore.getAbsolutePath()),"candidate core origin");
  }
  @Override public void draw() {
    int i=draws;require(i<IDS.length,"extra draw");state(i);vertices=boxes=0;
    horizons=stripeLayers=disks=rings=specks=0;
    observing=true;super.draw();observing=false;
    require(horizons==1 && stripeLayers==2 && disks==composition.placements().size() && rings==5*disks && specks==composition.mesh().faceCount(),"complete landscape layers");
    loadPixels();int[] shown=pixels.clone();displayedFrame.loadPixels();
    require(Arrays.equals(shown,displayedFrame.pixels),"completed cache");
    if(i==0) baselinePixels=shown.clone();
    else if(reset(i)) require(Arrays.equals(baselinePixels,shown),"reset pixels");
    else require(!Arrays.equals(previousPixels,shown),"visible edit");
    save(sketchPath(IDS[i]+".png"));
    if(records.length()>0) records.append(',');
    records.append("{\"id\":\"").append(IDS[i]).append("\",\"specks\":").append(specks)
      .append(",\"disks\":").append(disks).append(",\"retained\":").append(composition==previous).append('}');
    previous=composition;previousValues=composition.mesh().toValues();previousPixels=shown;draws++;
    events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,NEXT[i],0)),150,TimeUnit.MILLISECONDS);
  }
  @Override public void keyPressed() {
    require(keys<NEXT.length && key==NEXT[keys],"key order");
    LandscapeComposition before=composition;PImage cached=displayedFrame;
    super.keyPressed();keys++;
    if(key=='s') {
      require(composition==before && displayedFrame==cached,"save unchanged");savedFrame=cached;
      long at=System.nanoTime();events.schedule(()->finish(at),300,TimeUnit.MILLISECONDS);
    }
  }
  void finish(long at) {
    try {
      long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-at);
      require(quiet>=300 && draws==7 && keys==7 && displayedFrame==savedFrame && composition==previous,"quiet cached save");
      String report="{\"status\":\"passed\",\"frames\":7,\"key_events\":7,\"keys\":\""+new String(NEXT)
        +"\",\"save_quiet_ms\":"+quiet+",\"renderer_class\":\""+g.getClass().getName()
        +"\",\"core_code_source\":\""+source(Delaunay2D.class)
        +"\",\"composition_code_source\":\""+source(LandscapeComposition.class)+"\",\"states\":["+records+"]}";
      Files.write(Paths.get(sketchPath("native.json")),report.getBytes(StandardCharsets.UTF_8));events.shutdown();exit();
    } catch(Throwable e) {e.printStackTrace();System.exit(1);}
  }
  public static void main(String[] args) {
    Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});
    PApplet.runSketch(new String[]{"--sketch-path="+args[0],"LandscapeMarksProbe"},new LandscapeMarksProbe(new File(args[1])));
  }
}
