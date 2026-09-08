import java.nio.file.Files;
import java.nio.file.Paths;
import processing.core.PApplet;
import processing.awt.PGraphicsJava2D;

/** Invoke the real generated PDE lifecycle, saving through its actual key handler. */
public class FieldMarksPdeSmoke extends FieldMarks {
    public void draw() {
        super.draw();
        if(width!=640||height!=640||pixelDensity!=1||!(g instanceof PGraphicsJava2D)
                ||marks.x.length!=25600||MAX_LENGTH!=16||DRAW_BARS)
            throw new AssertionError("unexpected sketch configuration");
        key='s';super.keyPressed();
        try {
            Files.write(Paths.get(sketchPath("lifecycle.txt")),
                "settings/setup/draw and S-key handler executed; 25600 marks".getBytes("UTF-8"));
        }catch(Exception e){throw new RuntimeException(e);}
        exit();
    }
    public static void main(String[] args) {
        PApplet.runSketch(new String[]{"--sketch-path="+args[0],"FieldMarksPdeSmoke"},new FieldMarksPdeSmoke());
    }
}
