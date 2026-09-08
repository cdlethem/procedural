package org.procedurals.examples.grainmarks;

import android.database.Cursor;
import android.graphics.BitmapFactory;
import android.graphics.Bitmap;
import java.nio.ByteBuffer;
import org.procedurals.sampling.TrianglePoints2D;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.view.View;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Actual GrainMarks button callback observer; no substitute model or renderer. */
public final class GrainMarksProbeActivity extends GrainMarksActivity {
    private static final String[] IDS={"baseline","strokes","palette","bias1","bias2","density","seed","cells","reset","reset-again"};
    private static final int[] POINTS={15680,15680,15680,15680,15680,31360,31360,81920,15680,15680};
    private byte[] baseline;
    private JSONObject baselineEnvelope;
    private final JSONArray frames=new JSONArray();
    private final JSONArray ordering=new JSONArray();
    private File evidenceDirectory;
    private RenderedSnapshot previous;
    private String previousGeometry;
    private int lastCount;
    private boolean failed,awaitingPause,paused,resumedAfterPause,resumeEditPending;
    private int resumeAcknowledgments;

    @Override public void onCreate(android.os.Bundle state) {
        super.onCreate(state);
        evidenceDirectory=new File(getFilesDir(),"grain-marks-probe");
    }
    @Override protected void onPause() {
        if(awaitingPause)paused=true;
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if(awaitingPause&&paused)resumedAfterPause=true;
    }
    @Override protected void onAcknowledged(RenderedSnapshot snapshot,String source) {
        try {
            JSONObject row=new JSONObject();put(row,"event","acknowledged");put(row,"source",source);
            put(row,"composition_count",snapshot.compositionCount);put(row,"version",snapshot.options.version);
            ordering.put(row);
            // Keep counting through the suite: a delayed second callback can arrive
            // after onFrameReady has cleared awaitingPause.
            if(resumedAfterPause&&snapshot.options.version==2&&snapshot.compositionCount==3) {
                resumeAcknowledgments++;
                check("resume-cache".equals(source),"resume used non-cache acknowledgment");
                check(resumeAcknowledgments==1,"duplicate cached resume acknowledgment");
            }
        } catch(Throwable error){fail(error);}
    }
    @Override protected void onEditAttempt(int control,boolean accepted,EditState before,EditState after) {
        try {
            JSONObject row=new JSONObject();put(row,"event","edit-attempt");put(row,"control",control);
            put(row,"accepted",accepted);put(row,"before_version",before.version);put(row,"after_version",after.version);
            ordering.put(row);
            if(resumeEditPending) {
                check(control==2,"resume scheduled wrong control");check(accepted,"resume edit rejected by activity gate");
                check(after.version==before.version+1,"resume edit did not publish next version");resumeEditPending=false;
            }
        } catch(Throwable error){fail(error);}
    }
    private static String geometry(GrainComposition model) {
        try {
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            ByteBuffer bytes=ByteBuffer.allocate(16);double[] point=new double[2];
            for(int r=0;r<model.size();r++) {
                TrianglePoints2D points=model.regionAt(r);
                bytes.clear();bytes.putLong(points.size());digest.update(bytes.array(),0,8);
                for(int i=0;i<points.size();i++) {
                    points.pointInto(i,point,0);bytes.clear();bytes.putDouble(point[0]);bytes.putDouble(point[1]);digest.update(bytes.array());
                }
            }
            return Arrays.toString(digest.digest());
        }catch(NoSuchAlgorithmException error){throw new IllegalStateException(error);}
    }
    private static JSONObject envelope(GrainComposition model,byte[] png) throws JSONException {
        double[] expected={Double.POSITIVE_INFINITY,Double.POSITIVE_INFINITY,Double.NEGATIVE_INFINITY,Double.NEGATIVE_INFINITY};
        double[] point=new double[2];
        for(int r=0;r<model.size();r++) {
            TrianglePoints2D points=model.regionAt(r);
            for(int i=0;i<points.size();i++) {points.pointInto(i,point,0);
                expected[0]=Math.min(expected[0],point[0]);expected[1]=Math.min(expected[1],point[1]);
                expected[2]=Math.max(expected[2],point[0]);expected[3]=Math.max(expected[3],point[1]);}
        }
        Bitmap bitmap=BitmapFactory.decodeByteArray(png,0,png.length);
        check(bitmap!=null,"baseline decode failed");int[] pixels=new int[640*640],actual={640,640,-1,-1};
        try {bitmap.getPixels(pixels,0,640,0,0,640,640);}finally{bitmap.recycle();}
        for(int y=0;y<640;y++)for(int x=0;x<640;x++)if((pixels[y*640+x]&0xffffff)!=0xf3f0e8){
            actual[0]=Math.min(actual[0],x);actual[1]=Math.min(actual[1],y);actual[2]=Math.max(actual[2],x);actual[3]=Math.max(actual[3],y);}
        for(int i=0;i<4;i++)check(Math.abs(actual[i]-expected[i])<=2,"dot raster extent differs");
        JSONObject result=new JSONObject();JSONArray a=new JSONArray(),e=new JSONArray();
        for(int i=0;i<4;i++){a.put(actual[i]);e.put(expected[i]);}
        put(result,"actual",a);put(result,"expected",e);put(result,"tolerance_pixels",2);return result;
    }
    @Override protected void onFrameReady(RenderedSnapshot snapshot) {
        if(failed)return;
        try {
            checkUi("frame ready");
            check(seedButton.isEnabled()&&densityButton.isEnabled()&&distributionButton.isEnabled()
                &&cellsButton.isEnabled()&&motifButton.isEnabled()&&paletteButton.isEnabled()
                &&resetButton.isEnabled()&&saveButton.isEnabled(),"controls unavailable");
            if(snapshot.compositionCount==lastCount) {
                if(awaitingPause&&resumedAfterPause) {
                    check(snapshot==previous,"resume changed snapshot");
                    check(geometry(snapshot.composition).equals(previousGeometry),"resume changed geometry");
                    check(resumeAcknowledgments==1,"resume acknowledgment missing or duplicated");
                    awaitingPause=false;
                    writeState("resumed",false);
                    new Handler(Looper.getMainLooper()).post(()->{
                        try {
                            check(distributionButton.isEnabled(),"resume edit control disabled");
                            resumeEditPending=true;
                            check(distributionButton.performClick(),"resume edit callback absent");
                            check(!resumeEditPending,"resume edit callback did not reach activity");
                            writeState("resume-edit-requested",false);
                        } catch(Throwable error){fail(error);}
                    });
                }
                return;
            }
            int n=snapshot.compositionCount;
            check(n==lastCount+1&&n<=10,"unexpected composition count");
            check(snapshot.options.version==n-1,"state version mismatch");
            int regions=n==8?26:1;
            check(snapshot.composition.size()==regions&&snapshot.image.regions==regions,"region count");
            check(snapshot.composition.totalPoints()==POINTS[n-1]&&snapshot.image.marks==POINTS[n-1],"native mark count");
            check(snapshot.options.seed==((n==7||n==8)?43:42)
                &&snapshot.options.density==((n>=6&&n<=8)?0.2d:0.1d)
                &&snapshot.options.distribution==((n>=5&&n<=8)?2:n==4?1:0)
                &&snapshot.options.cells==(n==8)&&snapshot.options.strokes==(n>=2&&n<=8)
                &&snapshot.options.alternate==(n>=3&&n<=8),"edit state differs");
            String values=geometry(snapshot.composition);
            boolean retained=previous!=null&&previous.composition==snapshot.composition;
            if(previous!=null) {
                check(retained==(n==2||n==3),"retention mismatch");
                check(values.equals(previousGeometry)==(retained||n==10),"geometry change mismatch");
                check(Arrays.equals(previous.image.pngBytes(),snapshot.image.pngBytes())==(n==10),"edit image mismatch");
            }
            byte[] png=snapshot.image.pngBytes();
            if(n==1){baseline=png.clone();baselineEnvelope=envelope(snapshot.composition,png);}
            if(n>=9)check(Arrays.equals(png,baseline),"reset differs from baseline");
            BitmapFactory.Options dimensions=new BitmapFactory.Options();dimensions.inJustDecodeBounds=true;
            BitmapFactory.decodeByteArray(png,0,png.length,dimensions);
            check(dimensions.outWidth==640&&dimensions.outHeight==640,"image dimensions");
            writeAtomically(new File(evidenceDirectory,IDS[n-1]+".png"),png);
            JSONObject row=new JSONObject();put(row,"id",IDS[n-1]);put(row,"regions",snapshot.image.regions);
            put(row,"marks",snapshot.image.marks);put(row,"retained",retained);put(row,"png_sha256",sha256(png));
            put(row,"composition_count",n);frames.put(row);
            previous=snapshot;previousGeometry=values;lastCount=n;
            if(n==3) {awaitingPause=true;writeState("awaiting-pause",false);return;}
            if(n==10) {
                final int completed=completedFrameCount();
                new Handler(Looper.getMainLooper()).postDelayed(()->{
                    try {check(currentSnapshot()==snapshot&&completedFrameCount()==completed,"quiet state drew");saveButton.performClick();}
                    catch(Throwable error){fail(error);}
                },300);
                return;
            }
            final View next=n==1?motifButton:n==2?paletteButton:n==4?distributionButton:
                n==5?densityButton:n==6?seedButton:n==7?cellsButton:resetButton;
            new Handler(Looper.getMainLooper()).post(()->next.performClick());
        } catch(Throwable error){fail(error);}
    }
    @Override protected void onImageSaved(RenderedSnapshot snapshot,Uri uri) {
        try {
            checkUi("saved");check(snapshot==previous&&currentSnapshot()==previous,"cached save snapshot");
            byte[] saved=readAll(uri);check(Arrays.equals(saved,previous.image.pngBytes()),"saved bytes differ");
            queryRow(uri);writeAtomically(new File(evidenceDirectory,"saved.png"),saved);
            final int completed=completedFrameCount();
            new Handler(Looper.getMainLooper()).postDelayed(()->{
                try {
                    check(currentSnapshot()==snapshot&&completedFrameCount()==completed,"save redrew");
                    check(paused&&resumedAfterPause,"real pause/resume missing");
                    check(resumeAcknowledgments==1,"resume acknowledgment count changed after edit");
                    writeState("passed",true);
                } catch(Throwable error){fail(error);}
            },300);
        } catch(Throwable error){fail(error);}
    }
    @Override protected void onExampleFailure(Throwable error){fail(error);}
    private void writeState(String status,boolean passed) throws IOException {
        JSONObject value=new JSONObject();put(value,"status",status);put(value,"passed",passed);
        put(value,"frames",frames);put(value,"composition_count",lastCount);put(value,"baseline_envelope",baselineEnvelope);
        put(value,"paused",paused);put(value,"resumed",resumedAfterPause);
        put(value,"resume_acknowledgments",resumeAcknowledgments);put(value,"ordering",ordering);
        put(value,"completed_frames",completedFrameCount());
        try {
            java.lang.reflect.Field field=GrainMarksActivity.class.getDeclaredField("requested");field.setAccessible(true);
            EditState requested=(EditState)((java.util.concurrent.atomic.AtomicReference<?>)field.get(this)).get();
            put(value,"requested_version",requested.version);put(value,"requested_distribution",requested.distribution);
        }catch(ReflectiveOperationException error){throw new IOException("observer state unavailable",error);}
        writeJsonAtomically(new File(evidenceDirectory,"result.json"),value);
    }
    private void fail(Throwable error) {
        failed=true;
        try {
            JSONObject value=new JSONObject();put(value,"status","failed");put(value,"passed",false);
            StringWriter trace=new StringWriter();error.printStackTrace(new PrintWriter(trace));
            put(value,"failure",trace.toString());put(value,"frames",frames);
            writeJsonAtomically(new File(evidenceDirectory,"result.json"),value);
        } catch(Throwable ignored){ }
    }

    private JSONObject queryRow(Uri uri) {
        String[] projection={MediaStore.Images.Media.IS_PENDING,MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.RELATIVE_PATH,MediaStore.Images.Media.WIDTH,MediaStore.Images.Media.HEIGHT};
        try(Cursor cursor=getContentResolver().query(uri,projection,null,null,null)) {
            check(cursor!=null&&cursor.getCount()==1&&cursor.moveToFirst(),"saved MediaStore row unavailable");
            int pending=cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.IS_PENDING));
            String mime=cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE));
            String path=cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.RELATIVE_PATH));
            check(pending==0&&"image/png".equals(mime)
                &&("Pictures/Procedurals".equals(path)||"Pictures/Procedurals/".equals(path)),
                "saved MediaStore row differs from registered route");
            JSONObject value=new JSONObject();put(value,"uri",uri.toString());put(value,"is_pending",pending);
            put(value,"mime_type",mime);put(value,"relative_path",path);
            put(value,"metadata_width",cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)));
            put(value,"metadata_height",cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)));
            return value;
        }
    }

    private byte[] readAll(Uri uri) throws IOException {
        InputStream stream=getContentResolver().openInputStream(uri);
        if(stream==null)throw new IOException("saved URI has no readable stream");
        try(InputStream input=stream;ByteArrayOutputStream output=new ByteArrayOutputStream()){
            byte[] buffer=new byte[8192];
            for(int read;(read=input.read(buffer))!=-1;)output.write(buffer,0,read);
            return output.toByteArray();
        }
    }
    private static void checkUi(String event) {
        check(Looper.myLooper()==Looper.getMainLooper(),event+" did not run on UI thread");
    }
    private static void check(boolean condition,String message) { if(!condition)throw new AssertionError(message); }
    private static String sha256(byte[] bytes) {
        try{
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            StringBuilder value=new StringBuilder();
            for(byte item:digest.digest(bytes))value.append(String.format("%02x",item&255));
            return value.toString();
        }catch(NoSuchAlgorithmException error){throw new IllegalStateException("SHA-256 unavailable",error);}
    }
    private static void writeAtomically(File destination,byte[] bytes) throws IOException {
        File directory=destination.getParentFile();
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("cannot create evidence directory");
        File temporary=new File(directory,"."+destination.getName()+".tmp");
        try(FileOutputStream output=new FileOutputStream(temporary)){output.write(bytes);output.getFD().sync();}
        if(!temporary.renameTo(destination))throw new IOException("cannot publish "+destination.getName());
    }
    private static void writeJsonAtomically(File destination,JSONObject value) throws IOException {
        writeAtomically(destination,value.toString().getBytes(StandardCharsets.UTF_8));
    }
    private static void put(JSONObject object,String key,Object value) {
        try{object.put(key,value);}catch(JSONException error){throw new IllegalStateException("cannot construct probe JSON",error);}
    }
}
