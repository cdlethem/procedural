import java.nio.file.Files;
import java.nio.file.Path;
import processing.core.PApplet;

/** Fixed-style parameter comparison; no whole-corpus reproduction claim. */
public final class LinePoolFrames extends PApplet {
    static Path output;
    final String[] names={"baseline","attempts-9000","attempts-180000","angle-07","angle-21"};
    final int[] attempts={90000,9000,180000,90000,90000};
    final float[] angles={1.4f,1.4f,1.4f,.7f,2.1f};
    int index;
    StringBuilder records=new StringBuilder();
    public void settings() { size(960,960,P2D);pixelDensity(1); }
    public void draw() {
        try {
            if(index>=names.length) throw new AssertionError("extra frame");
            LinePoolPrototype.Result pool=LinePoolPrototype.build(42,attempts[index],angles[index]);
            background(10,10,21);blendMode(NORMAL);stroke(235,235,235,100);strokeWeight(1);
            for(int i=0;i<pool.size;i++) line(pool.x1[i],pool.y1[i],pool.x2[i],pool.y2[i]);
            get().save(output.resolve(names[index]+".png").toString());
            if(index>0)records.append(',');
            records.append("{\"id\":\"").append(names[index]).append("\",\"segments\":").append(pool.size)
                .append(",\"cuts\":").append(pool.successfulCuts).append(",\"skips\":").append(pool.skips)
                .append(",\"build_nanos\":").append(pool.elapsedNanos).append('}');
            index++;
            if(index==names.length) {
                Files.writeString(output.resolve("native.json"),"{\"status\":\"passed\",\"frames\":5,\"cases\":["+records+"]}\n");
                noLoop();exit();
            }
        } catch(Throwable e) {e.printStackTrace();System.exit(1);}
    }
    public static void main(String[] args) {
        output=Path.of(args[0]);
        Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});
        PApplet.runSketch(new String[]{"LinePoolFrames"},new LinePoolFrames());
    }
}
