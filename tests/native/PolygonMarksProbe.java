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
import org.procedurals.sampling.ConvexPolygonPlacements2D;
import processing.core.PApplet;
import processing.event.KeyEvent;

/** Native six-state probe for PolygonMarks retained geometry, placement and save behavior. */
public final class PolygonMarksProbe extends PolygonMarks {
    private static final String[] IDS = {"baseline", "thin", "recolored", "diamonds", "regenerated", "reset"};
    private static final char[] KEYS = {'a', 'c', 'm', 'r', '0', 's'};
    private final ScheduledExecutorService events = Executors.newSingleThreadScheduledExecutor();
    private final File output, expectedJar;
    private volatile int draws, keys;
    private String coreCodeSource;
    private double[][] baselinePoses, previousPoses;
    private double[][][] baselineProposals, previousProposals;
    private ConvexPolygonPlacements2D baselinePlacements, previousPlacements;
    private String baselineGeometry, previousGeometry, baselinePixels, previousPixels;
    private int[] finalPixels;
    private final StringBuilder records = new StringBuilder();

    private PolygonMarksProbe(File output, File jar) { this.output = output; expectedJar = jar; }
    private static void require(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
    private static String hash(double[][][] polygons) throws Exception { MessageDigest d=MessageDigest.getInstance("SHA-256"); for(double[][] p:polygons)for(double[] v:p)for(double n:v)for(int s=56;s>=0;s-=8)d.update((byte)(Double.doubleToRawLongBits(n)>>>s)); return hex(d.digest()); }
    private static String hash(double[][] poses) throws Exception { MessageDigest d=MessageDigest.getInstance("SHA-256"); for(double[] p:poses)for(double n:p)for(int s=56;s>=0;s-=8)d.update((byte)(Double.doubleToRawLongBits(n)>>>s)); return hex(d.digest()); }
    private static String hash(ConvexPolygonPlacements2D p) throws Exception { MessageDigest d=MessageDigest.getInstance("SHA-256"); for(int s=56;s>=0;s-=8)d.update((byte)(((long)p.size())>>>s)); for(int i=0;i<p.size();i++){for(int s=56;s>=0;s-=8)d.update((byte)(((long)p.sourceIndexAt(i))>>>s));int n=p.vertexCountAt(i);for(int s=56;s>=0;s-=8)d.update((byte)(((long)n)>>>s));for(int j=0;j<n;j++)for(double v:new double[]{p.xAt(i,j),p.yAt(i,j)})for(int s=56;s>=0;s-=8)d.update((byte)(Double.doubleToRawLongBits(v)>>>s));} return hex(d.digest()); }
    private static String pixels(int[] values) throws Exception { MessageDigest d=MessageDigest.getInstance("SHA-256"); for(int n:values)for(int s=56;s>=0;s-=8)d.update((byte)(((long)n&0xffffffffL)>>>s)); return hex(d.digest()); }
    private static String hex(byte[] bytes){StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format("%02x",b&255));return s.toString();}
    private static String escape(String value){return value.replace("\\","\\\\").replace("\"","\\\"");}

    private void checkCorrespondence() {
        require(placements.attempts() == 600, "attempt count");
        require(placements.size() > 0, "empty placement result");
        for (int i = 0; i < placements.size(); i++) {
            int source = placements.sourceIndexAt(i);
            require(source >= 0 && source < proposals.length, "source index");
            require(i == 0 || source > placements.sourceIndexAt(i-1), "source order");
            require(placements.vertexCountAt(i) == proposals[source].length, "vertex count");
            for (int j = 0; j < proposals[source].length; j++) {
                require(Double.doubleToRawLongBits(placements.xAt(i,j)) == Double.doubleToRawLongBits(proposals[source][j][0]), "x correspondence");
                require(Double.doubleToRawLongBits(placements.yAt(i,j)) == Double.doubleToRawLongBits(proposals[source][j][1]), "y correspondence");
            }
        }
    }

    @Override public void setup() {
        super.setup();
        try { coreCodeSource = new File(ConvexPolygonPlacements2D.class.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath(); require(coreCodeSource.equals(expectedJar.getCanonicalPath()), "wrong core JAR"); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }

    @Override public void draw() {
        try {
            require(draws < IDS.length, "unexpected draw");
            require(width == 512 && height == 512 && pixelDensity == 1 && g.getClass().getName().equals("processing.awt.PGraphicsJava2D"), "native environment");
            require(poses.length == 600 && proposals.length == 600, "retained descriptors");
            require((draws == 0 || draws == 5) ? ratio == .8 : ratio == .2, "ratio state");
            require((draws >= 3 && draws < 5) ? shape == 1 : shape == 0, "shape state");
            require(alternate == (draws >= 2 && draws < 5), "palette state");
            require(seed == (draws == 4 ? 43 : 42), "seed state");
            checkCorrespondence();
            String poseHash=hash(poses), geometry=hash(placements);
            if(draws==0){baselinePoses=poses;baselineProposals=proposals;baselinePlacements=placements;baselineGeometry=geometry;}
            else if(draws==1||draws==3){require(poses==previousPoses,"edit changed poses");require(proposals!=previousProposals&&placements!=previousPlacements,"edit retained placement");require(!geometry.equals(previousGeometry),"edit unchanged geometry");}
            else if(draws==2){require(poses==previousPoses&&proposals==previousProposals&&placements==previousPlacements,"recolor replaced geometry");require(geometry.equals(previousGeometry),"recolor mutated geometry");}
            else if(draws==4){require(poses!=baselinePoses&&proposals!=baselineProposals&&placements!=previousPlacements,"regenerate retained descriptors");require(!poseHash.equals(hash(baselinePoses)),"regenerate unchanged poses");}
            else {require(geometry.equals(baselineGeometry)&&poseHash.equals(hash(baselinePoses)),"reset geometry");}
            previousPoses=poses;previousProposals=proposals;previousPlacements=placements;previousGeometry=geometry;
            super.draw(); loadPixels(); displayedFrame.loadPixels(); require(Arrays.equals(pixels,displayedFrame.pixels),"cached framebuffer mismatch");
            boolean nonblank=false; for(int pixel:pixels){require((pixel>>>24)==255,"nonopaque framebuffer");if((pixel&0xffffff)!=0xf6e2dc)nonblank=true;} require(nonblank,"blank frame");
            String current=pixels(pixels); if(draws==0)baselinePixels=current; else if(draws==5){require(current.equals(baselinePixels),"reset pixels");finalPixels=pixels.clone();} else require(!current.equals(previousPixels),"state visually unchanged"); previousPixels=current;
            if(draws>0)records.append(','); records.append("{\"id\":\"").append(IDS[draws]).append("\",\"pixel_sha256\":\"").append(current).append("\",\"geometry_sha256\":\"").append(geometry).append("\",\"retained_count\":").append(placements.size()).append("}");
            save(new File(output,IDS[draws]+".png").getAbsolutePath()); draws++;
            char next=KEYS[draws-1]; events.schedule(() -> postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,next,0)),180,TimeUnit.MILLISECONDS);
        } catch(Throwable e){e.printStackTrace();System.exit(1);}
    }

    @Override public void keyPressed(){require(keys<KEYS.length&&key==KEYS[keys],"key order");super.keyPressed();keys++;if(key=='s')events.schedule(this::finish,300,TimeUnit.MILLISECONDS);}
    private void finish(){try{require(draws==6&&keys==6&&finalPixels!=null,"incomplete event sequence");File savedPath=new File(output,"polygon-marks.png");BufferedImage saved=ImageIO.read(savedPath);require(saved!=null&&saved.getWidth()==512&&saved.getHeight()==512,"saved dimensions");require(Arrays.equals(finalPixels,saved.getRGB(0,0,512,512,null,0,512)),"saved pixels");String json="{\"status\":\"passed\",\"frames\":6,\"keys\":\"acmr0s\",\"frame_records\":["+records+"],\"core_code_source\":\""+escape(coreCodeSource)+"\",\"expected_jar\":\""+escape(expectedJar.getCanonicalPath())+"\",\"renderer\":\""+g.getClass().getName()+"\",\"density\":"+pixelDensity+"}";Files.write(new File(output,"native.json").toPath(),json.getBytes(StandardCharsets.UTF_8));events.shutdown();exit();}catch(Throwable e){e.printStackTrace();System.exit(1);}}
    public static void main(String[] args){if(args.length!=2)throw new IllegalArgumentException("output directory and core JAR required");File out=new File(args[0]),jar=new File(args[1]);require(out.isDirectory()&&jar.isFile(),"missing output/JAR");Thread.setDefaultUncaughtExceptionHandler((t,e)->{e.printStackTrace();System.exit(1);});PApplet.runSketch(new String[]{"--sketch-path="+out.getAbsolutePath(),"PolygonMarksProbe"},new PolygonMarksProbe(out,jar));}
}
