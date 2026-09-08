import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.*;
import processing.core.PApplet;
import processing.awt.PGraphicsJava2D;
import processing.event.KeyEvent;
import org.procedurals.examples.pathmarks.PathMarkComposition;

/** Exercise the actual generated PDE with posted native key events. */
public final class PathMarksPdeProbe extends PathMarks {
    private static final String[] IDS={"marks","trace","marks-replay","long-marks","palette","count","distance"};
    private static long[] expectedSubmitted;
    private static final char[] NEXT={'m','m','l','c','n','d','s'};
    private final ScheduledExecutorService events=Executors.newSingleThreadScheduledExecutor();
    private volatile int draws,keys;
    private PathMarkComposition previous;
    private int[] basePixels,shownPixels;
    private void require(boolean value,String message) { if(!value) throw new AssertionError(message); }
    @Override public void draw() {
        int state=draws;
        require(state<7,"unexpected extra composition");
        require(width==640 && height==640 && pixelDensity==1 && g instanceof PGraphicsJava2D,"environment");
        require(TRACE==(state==1) && MARK_LENGTH==(state>=3?24:12) && ALTERNATE==(state>=4)
            && STEPS==(state>=5?2001:2000) && DISTANCE==(state>=6?.8:.4),"edit state "+state);
        if(state>0) require((movement==previous)==(state<5),"retained movement identity "+state);
        if(state==5) for(int p=0;p<24;p++) for(int i=0;i<=2000;i++) {
            require(Arrays.equals(previous.pathAt(p).pointAt(i),movement.pathAt(p).pointAt(i)),"count prefix");
            if(i<2000) require(previous.pathAt(p).headingAt(i)==movement.pathAt(p).headingAt(i),"heading prefix");
        }
        if(state==6) {
            boolean changed=false;
            for(int p=0;p<24;p++) {
                require(previous.pathAt(p).headingAt(0)==movement.pathAt(p).headingAt(0),"initial heading");
                changed |= previous.pathAt(p).headingAt(1)!=movement.pathAt(p).headingAt(1);
            }
            require(changed,"distance feedback");
        }
        super.draw(); draws++;
        require(DRAWN_SEGMENTS==expectedSubmitted[state],"submitted visible count "+state);
        try { Files.write(Paths.get(sketchPath("progress.json")),("{\"completed_compositions\":"+draws+",\"last_state\":\""+IDS[state]+"\",\"submitted_commands\":"+DRAWN_SEGMENTS+"}").getBytes(StandardCharsets.UTF_8)); }
        catch(Exception failure) { throw new RuntimeException(failure); }
        loadPixels();shownPixels=pixels.clone();
        if(state==0) basePixels=shownPixels.clone();
        if(state==2) require(Arrays.equals(basePixels,shownPixels),"marks replay pixels");
        if(state==0 || state==1 || state==3) save(sketchPath(IDS[state]+".png"));
        if(state==6) save(sketchPath("displayed-final.png"));
        previous=movement;
        events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,NEXT[state],0)),150,TimeUnit.MILLISECONDS);
    }
    @Override public void keyPressed() {
        require(keys<7 && key==NEXT[keys],"key event order");
        super.keyPressed(); keys++;
        if(key=='s') {
          final long savedAt=System.nanoTime();
          events.schedule(()-> {
            try {
                long quietMs=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-savedAt);
                require(quietMs>=300,"short save observation");
                require(draws==7 && keys==7,"save caused recomposition or missing event");
                Files.write(Paths.get(sketchPath("native.json")),("{\"status\":\"passed\",\"compositions\":7,\"key_events\":7,\"retained_style_edits\":true,\"count_prefix\":true,\"distance_feedback\":true,\"marks_replay_pixels\":true,\"save_quiet_ms\":"+quietMs+"}").getBytes(StandardCharsets.UTF_8));
                events.shutdown(); exit();
            } catch(Throwable failure) { failure.printStackTrace(); System.exit(1); }
        },300,TimeUnit.MILLISECONDS);
        }
    }
    public static void main(String[] args) {
        if(args.length!=8) throw new IllegalArgumentException("output and seven expected submitted counts required");
        expectedSubmitted=new long[7];for(int i=0;i<7;i++) expectedSubmitted[i]=Long.parseLong(args[i+1]);
        Thread.setDefaultUncaughtExceptionHandler((thread,failure)->{failure.printStackTrace();System.exit(1);});
        PApplet.runSketch(new String[]{"--sketch-path="+args[0],"PathMarksPdeProbe"},new PathMarksPdeProbe());
    }
}
