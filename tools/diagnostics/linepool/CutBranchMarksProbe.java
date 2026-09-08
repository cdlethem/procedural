import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.opengl.PGraphics2D;
import processing.core.PApplet;
import processing.core.PImage;
import processing.event.KeyEvent;
import org.procedurals.topology.LinePool2D;
import org.procedurals.examples.cutbranchmarks.CutBranchComposition;

/** Observe the actual preprocessed PDE; geometry goldens remain in core conformance. */
public final class CutBranchMarksProbe extends CutBranchMarks {
  static final String[] IDS = {"baseline","palette","reset-colour","narrow","reset-angle","sparse","reset-work","alternate","reset-stroke","new-seed","final-reset"};
  static final char[] NEXT = "c0a0w0t0r0s".toCharArray();
  final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
  final File expectedCore;
  final StringBuilder records = new StringBuilder();
  int draws, keys;
  boolean observing;
  CutBranchComposition previous;
  Map<String,Object> baselineValues, previousValues;
  int[] baselinePixels, previousPixels;
  PImage savedFrame;
  CutBranchMarksProbe(File core) { expectedCore = core; }
  static void require(boolean yes, String why) { if (!yes) throw new AssertionError(why); }
  static void f(float actual, double expected) {
    require(Float.floatToRawIntBits(actual)==Float.floatToRawIntBits((float)expected),"coordinate/style value");
  }
  static String source(Class<?> type) {
    try { return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); }
    catch(Exception e) { throw new IllegalStateException(e); }
  }
  static boolean reset(int i) { return i>0 && i%2==0; }
  static boolean style(int i) { return i==1; }
  void state(int i) {
    require(SEED==(i==9?43:42) && NARROW==(i==3) && SPARSE==(i==5)
      && ALTERNATE==(i==7) && COLOR==(i==1?1:0),"settings");
    require(composition.pool().attempts()==(i==5?9000:90000),"work preset");
    Map<String,Object> values=composition.pool().toValues();
    if(i==0) baselineValues=values;
    else if(style(i)) require(composition==previous && values.equals(previousValues),"retained pool");
    else {
      require(composition!=previous,"new structural result");
      require(reset(i)?values.equals(baselineValues):!values.equals(previousValues),"structural values/reset");
    }
  }
  int lines;
  final double[] expectedSegment=new double[4];
  @Override public void line(float x0,float y0,float x1,float y1) {
    if(observing) {
      composition.pool().segmentInto(lines++,expectedSegment,0);
      double[] expected=expectedSegment;
      f(x0,expected[0]);f(y0,expected[1]);f(x1,expected[2]);f(y1,expected[3]);
    }
    super.line(x0,y0,x1,y1);
  }
  @Override public void setup() {
    super.setup();
    require(width==960 && height==960 && pixelDensity==1 && g instanceof PGraphics2D,"environment");
    require(source(LinePool2D.class).equals(expectedCore.getAbsolutePath()),"candidate core origin");
  }
  @Override public void draw() {
    int i=draws;require(i<IDS.length,"extra draw");state(i);
    lines=0;
    observing=true;super.draw();observing=false;
    require(lines==composition.pool().size(),"every retained segment drawn once");
    loadPixels();int[] shown=pixels.clone();displayedFrame.loadPixels();
    require(Arrays.equals(shown,displayedFrame.pixels),"completed cache");
    if(i==0) baselinePixels=shown.clone();
    else if(reset(i)) require(Arrays.equals(baselinePixels,shown),"reset pixels");
    else require(!Arrays.equals(previousPixels,shown),"visible edit");
    save(sketchPath(IDS[i]+".png"));
    if(records.length()>0) records.append(',');
    records.append("{\"id\":\"").append(IDS[i]).append("\",\"segments\":").append(lines)
      .append(",\"cuts\":").append(composition.pool().successfulCuts()).append(",\"retained\":").append(composition==previous).append('}');
    previous=composition;previousValues=composition.pool().toValues();previousPixels=shown;draws++;
    events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,NEXT[i],0)),150,TimeUnit.MILLISECONDS);
  }
  @Override public void keyPressed() {
    require(keys<NEXT.length && key==NEXT[keys],"key order");
    CutBranchComposition before=composition;PImage cached=displayedFrame;
    super.keyPressed();keys++;
    if(key=='s') {
      require(composition==before && displayedFrame==cached,"save unchanged");savedFrame=cached;
      long at=System.nanoTime();events.schedule(()->finish(at),300,TimeUnit.MILLISECONDS);
    }
  }
  void finish(long at) {
    try {
      long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-at);
      require(quiet>=300 && draws==11 && keys==11 && displayedFrame==savedFrame && composition==previous,"quiet cached save");
      String report="{\"status\":\"passed\",\"frames\":11,\"key_events\":11,\"keys\":\""+new String(NEXT)
        +"\",\"save_quiet_ms\":"+quiet+",\"renderer_class\":\""+g.getClass().getName()
        +"\",\"core_code_source\":\""+source(LinePool2D.class)
        +"\",\"composition_code_source\":\""+source(CutBranchComposition.class)+"\",\"states\":["+records+"]}";
      Files.write(Paths.get(sketchPath("native.json")),report.getBytes(StandardCharsets.UTF_8));events.shutdown();exit();
    } catch(Throwable e) {e.printStackTrace();System.exit(1);}
  }
  public static void main(String[] args) {
    Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});
    PApplet.runSketch(new String[]{"--sketch-path="+args[0],"CutBranchMarksProbe"},new CutBranchMarksProbe(new File(args[1])));
  }
}
