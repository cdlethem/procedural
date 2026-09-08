import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import processing.core.PApplet;
import processing.event.KeyEvent;
import processing.opengl.PGL;
import processing.opengl.PGraphics3D;
import org.procedurals.examples.profilemarks.ProfileComposition;
import org.procedurals.mesh.RadialProfile3D;

/**
 * Prepared, unexecuted lifecycle probe for the installed ProfileMarks PDE.
 * The preprocessor supplies ProfileMarks in the default package before this class compiles.
 */
public final class ProfileMarksProbe extends ProfileMarks {
  private static final String[] IDS={"baseline","waist","pointed","reset","coarse","reset-after-coarse","end-open","both-open","reset-after-open","recolour","trio","selected-while-trio","final-reset"};
  private static final char[] KEYS={'p','p','0','d','0','t','b','0','c','x','p','0','s'};
  private final ScheduledExecutorService events=Executors.newSingleThreadScheduledExecutor();
  private final File expectedJar;
  private ProfileComposition previous, baseline;
  private int draws, keys, normalCalls, vertexCalls;
  private final StringBuilder frameRecords = new StringBuilder();
  private String[] geometryHashes;
  private String contextJson;

  private ProfileMarksProbe(File expectedJar) { this.expectedJar=expectedJar; }
  private static void require(boolean value,String message){if(!value)throw new AssertionError(message);}
  private static String source(Class<?> type){try{return new File(type.getProtectionDomain().getCodeSource().getLocation().toURI()).getCanonicalPath();}catch(Exception error){throw new IllegalStateException(error);}}
  private static String hash(RadialProfile3D mesh){try{MessageDigest digest=MessageDigest.getInstance("SHA-256");for(int i=0;i<mesh.vertexCount();i++)for(double v:mesh.vertexAt(i))digest.update(java.nio.ByteBuffer.allocate(8).putLong(Double.doubleToRawLongBits(v)).array());for(int i=0;i<mesh.faceCount();i++){for(int v:mesh.triangleAt(i))digest.update(java.nio.ByteBuffer.allocate(4).putInt(v).array());for(double v:mesh.normalAt(i))digest.update(java.nio.ByteBuffer.allocate(8).putLong(Double.doubleToRawLongBits(v)).array());digest.update(mesh.faceKindAt(i).getBytes(StandardCharsets.UTF_8));digest.update(java.nio.ByteBuffer.allocate(8).putInt(mesh.bandAt(i)).putInt(mesh.cellAt(i)).array());}StringBuilder out=new StringBuilder();for(byte b:digest.digest())out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return out.toString();}catch(Exception error){throw new IllegalStateException(error);}}
  private static int selectedFaces(ProfileComposition composition,int profile,boolean trio){if(trio)return composition.meshAt(0).faceCount()+composition.meshAt(1).faceCount()+composition.meshAt(2).faceCount();return composition.meshAt(profile).faceCount();}
  private void state(int index){
    require(width==640&&height==640&&pixelDensity==1&&g instanceof PGraphics3D,"P3D environment"); require(composition!=null,"composition");
    int selected=selectedFaces(composition,PROFILE,TRIO); int expected=TRIO?3200:(PROFILE==2?1024:(SLICES==8?272:(START_CAP? (END_CAP?1088:1056):1024)));
    require(selected==expected,"selected face count "+index); require(composition.slices()==SLICES,"composition slices");
    boolean retained=index==1||index==2||index==9||index==10||index==11; if(index>0)require((composition==previous)==retained,"composition identity "+index);
    if(index==0)baseline=composition; if(index==3||index==5||index==8||index==12)require(composition!=baseline,"reset rebuild "+index);
    if(index==0||index==3||index==5||index==8||index==12)require(PROFILE==0&&SLICES==32&&START_CAP&&END_CAP&&!ALTERNATE&&!TRIO,"baseline state "+index);
    if(index==1)require(PROFILE==1,"waist selection"); if(index==2)require(PROFILE==2,"pointed selection");
    if(index==4)require(SLICES==8,"coarse"); if(index==6)require(!END_CAP&&START_CAP,"end open"); if(index==7)require(!END_CAP&&!START_CAP,"both open"); if(index==9)require(ALTERNATE&&!TRIO,"recolour"); if(index==10)require(TRIO&&PROFILE==0,"trio"); if(index==11)require(TRIO&&PROFILE==1,"selected while trio");
  }
  @Override public void normal(float x,float y,float z){normalCalls++;super.normal(x,y,z);}
  @Override public void vertex(float x,float y,float z){vertexCalls++;super.vertex(x,y,z);}
  @Override public void draw(){
    int state=draws; require(state<IDS.length,"extra draw"); state(state); int beforeNormals=normalCalls,beforeVertices=vertexCalls; super.draw();
    int expected=selectedFaces(composition,PROFILE,TRIO); require(normalCalls-beforeNormals==expected&&vertexCalls-beforeVertices==3*expected,"actual draw callbacks");
    loadPixels();int changed=0;for(int pixel:pixels)if((pixel&0xffffff)!=0xf3f0e8)changed++;require(changed>0,"blank frame"); save(sketchPath(IDS[state]+".png"));
    String selectedHash=hash(composition.meshAt(PROFILE)); if(state==0)geometryHashes=new String[]{hash(composition.meshAt(0)),hash(composition.meshAt(1)),hash(composition.meshAt(2))}; if(state==9||state==10||state==11)require(selectedHash.equals(geometryHashes[PROFILE]),"style retained geometry");
    if(state>0)frameRecords.append(',');
    frameRecords.append("{\"id\":\"").append(IDS[state]).append("\",\"profile\":").append(PROFILE).append(",\"slices\":").append(SLICES).append(",\"capStart\":").append(START_CAP).append(",\"capEnd\":").append(END_CAP).append(",\"alternate\":").append(ALTERNATE).append(",\"trio\":").append(TRIO).append(",\"faces_drawn\":").append(expected).append(",\"selected_geometry_sha256\":\"").append(selectedHash).append("\"}");
    previous=composition;draws++;events.schedule(()->postEvent(new KeyEvent(null,System.currentTimeMillis(),KeyEvent.PRESS,0,KEYS[state],0)),180,TimeUnit.MILLISECONDS);
  }
  @Override public void keyPressed(){
    require(keys<KEYS.length&&key==KEYS[keys],"key order"); super.keyPressed(); keys++;
    if(key=='s'){final long saved=System.nanoTime();events.schedule(()->finish(saved),300,TimeUnit.MILLISECONDS);}
  }
  private void finish(long saved){try{
    long quiet=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-saved);require(quiet>=300&&draws==IDS.length&&keys==KEYS.length,"save quiet");
    String json="{\"status\":\"passed\",\"frames\":"+draws+",\"keys\":\""+new String(KEYS)+"\",\"normal_calls\":"+normalCalls+",\"vertex_calls\":"+vertexCalls+",\"triangle_calls\":"+(vertexCalls/3)+",\"frame_records\":["+frameRecords+"],\"core_code_source\":\""+escape(source(RadialProfile3D.class))+"\",\"helper_code_source\":\""+escape(source(ProfileComposition.class))+"\",\"expected_jar\":\""+escape(expectedJar.getCanonicalPath())+"\",\"context\":"+contextJson+",\"quiet_ms\":"+quiet+"}";
    Files.write(Paths.get(sketchPath("native.json")),json.getBytes(StandardCharsets.UTF_8));events.shutdown();exit();
  }catch(Throwable error){error.printStackTrace();System.exit(1);}}
  private static String escape(String value){return value.replace("\\","\\\\").replace("\"","\\\"");}
  public void setup(){super.setup();try{require(source(RadialProfile3D.class).equals(expectedJar.getCanonicalPath()),"installed core jar");PGL gl=beginPGL();try{require(gl!=null,"PGL");contextJson="{\"renderer_class\":\""+escape(g.getClass().getName())+"\",\"vendor\":\""+escape(gl.getString(PGL.VENDOR))+"\",\"renderer\":\""+escape(gl.getString(PGL.RENDERER))+"\",\"version\":\""+escape(gl.getString(PGL.VERSION))+"\"}";}finally{endPGL();}}catch(Exception error){throw new IllegalStateException(error);}}
  public static void main(String[] args){if(args.length!=2)throw new IllegalArgumentException("output directory and expected installed core jar required");File output=new File(args[0]),jar=new File(args[1]);if(!output.isAbsolute()||!output.isDirectory()||!jar.isFile())throw new IllegalArgumentException("absolute existing output directory and core jar required");Thread.setDefaultUncaughtExceptionHandler((thread,error)->{error.printStackTrace();System.exit(1);});PApplet.runSketch(new String[]{"--sketch-path="+output.getAbsolutePath(),"ProfileMarksProbe"},new ProfileMarksProbe(jar));}
}
