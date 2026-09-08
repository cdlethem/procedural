package org.procedurals.examples.pathmarks;

import android.database.Cursor;
import android.graphics.BitmapFactory;
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
import org.procedurals.paths.GradientPath2D;

/**
 * Test-only observer for the actual editable PathMarks Activity. It does not
 * alter controls, drawing, retained movement, save behavior, or MediaStore I/O.
 */
public final class PathMarksProbeActivity extends PathMarksActivity {
    private static final String[] IDS={"marks","trace","marks-replay","long-marks","palette","count","distance"};
    private static final boolean[][] EXPECTED = {
        {false,false,false,false,false}, {true,false,false,false,false}, {false,false,false,false,false},
        {false,true,false,false,false}, {false,true,true,false,false}, {false,true,true,true,false},
        {false,true,true,true,true}
    };
    private static final long[] RAW = {12000,48000,12000,12000,12000,12024,12024};
    private static final long[] SUBMITTED = {7002,27784,7002,7057,7057,7066,5500};

    private File evidenceDirectory;
    private String nonce;
    private int sequence, lastComposition, lastReadyFrame=-1;
    private RenderedSnapshot lastSnapshot;
    private PathMarkComposition lastMovement, countMovement;
    private byte[] lastPng;
    private long saveQuietMillis=-1;
    private boolean failed;
    private final JSONArray frames=new JSONArray();
    private JSONObject savedFacts;

    @Override public void onCreate(android.os.Bundle state) {
        super.onCreate(state);
        nonce=UUID.randomUUID().toString();
        evidenceDirectory=new File(getFilesDir(),"path-marks-probe");
        if(!evidenceDirectory.isDirectory()&&!evidenceDirectory.mkdirs()) fail(new IOException("cannot create probe evidence directory"));
    }

    @Override protected void onFrameReady(RenderedSnapshot snapshot) {
        try {
            checkUi("onFrameReady");
            check(snapshot!=null&&snapshot.movement!=null&&snapshot.image!=null,"missing PathMarks snapshot");
            check(modeButton.isEnabled()&&lengthButton.isEnabled()&&paletteButton.isEnabled()&&countButton.isEnabled()&&distanceButton.isEnabled()&&saveButton.isEnabled(),"all six controls must be enabled at acknowledgement");
            int count=snapshot.compositionCount;
            if(count==lastComposition) return; // Lifecycle acknowledgement may repeat an existing image.
            check(count==lastComposition+1&&count>=1&&count<=7,"unexpected composition acknowledgement "+count);
            boolean[] expected=EXPECTED[count-1];
            EditState options=snapshot.options;
            check(options.version==count-1&&options.trace==expected[0]&&options.longer==expected[1]&&options.alternate==expected[2]&&options.more==expected[3]&&options.farther==expected[4],"registered option state differs at "+count);
            check(completedFrameCount()==count+1,"completed frame must include startup plus composition "+count);
            check(snapshot.movement.pathCount()==24,"PathMarks must retain 24 paths");
            check(snapshot.image.rawCommands==RAW[count-1]&&snapshot.image.submittedCommands==SUBMITTED[count-1],"raw/submitted command count differs at "+count);

            boolean sameMovement=false,samePaths=false;
            if(lastMovement!=null) {
                sameMovement=snapshot.movement==lastMovement;
                samePaths=samePathObjects(snapshot.movement,lastMovement);
                if(count<=5) check(sameMovement&&samePaths,"style edit replaced retained movement at "+count);
                else check(!sameMovement&&!samePaths,"movement edit retained stale movement at "+count);
            }
            if(count==6) { checkPrefix(lastMovement,snapshot.movement); countMovement=snapshot.movement; }
            if(count==7) checkDistanceFeedback(countMovement,snapshot.movement);

            byte[] png=snapshot.image.pngBytes();
            check(png.length>0,"empty cached PNG");
            writeAtomically(new File(evidenceDirectory,"frame-"+count+".png"),png);
            JSONObject observation=frameObservation(snapshot,png,count,sameMovement,samePaths);
            writeJsonAtomically(new File(evidenceDirectory,"frame-"+count+".json"),observation);
            frames.put(observation);lastComposition=count;lastReadyFrame=completedFrameCount();lastSnapshot=snapshot;lastMovement=snapshot.movement;lastPng=png.clone();
        } catch(Throwable failure) { fail(failure); }
    }

    @Override protected void onImageSaved(RenderedSnapshot snapshot,Uri uri) {
        try {
            checkUi("onImageSaved");
            check(snapshot!=null&&uri!=null,"save hook has no snapshot/URI");
            check(snapshot.compositionCount==7&&snapshot==lastSnapshot&&currentSnapshot()==snapshot,"save did not use current state seven snapshot");
            check(completedFrameCount()==lastReadyFrame,"save advanced composition/frame count");
            byte[] saved=readAll(uri);check(lastPng!=null&&Arrays.equals(lastPng,saved),"saved URI bytes differ from cached PNG");
            BitmapFactory.Options dimensions=new BitmapFactory.Options();dimensions.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(saved,0,saved.length,dimensions);
            check(dimensions.outWidth==640&&dimensions.outHeight==640,"saved PNG is not 640x640");
            writeAtomically(new File(evidenceDirectory,"saved.png"),saved);
            JSONObject row=queryRow(uri);put(row,"png_width",dimensions.outWidth);put(row,"png_height",dimensions.outHeight);put(row,"byte_sha256",sha256(saved));savedFacts=row;
            final RenderedSnapshot expectedSnapshot=snapshot;
            final PathMarkComposition expectedMovement=snapshot.movement;
            final byte[] expectedBytes=saved.clone();
            final int expectedCompleted=completedFrameCount();
            final long started=SystemClock.elapsedRealtime();
            new Handler(Looper.getMainLooper()).postDelayed(()->quietAfterSave(expectedSnapshot,expectedMovement,expectedBytes,expectedCompleted,started),300L);
        } catch(Throwable failure) { fail(failure); }
    }

    @Override protected void onExampleFailure(Throwable failure) { fail(failure); }

    private void quietAfterSave(RenderedSnapshot expectedSnapshot,PathMarkComposition expectedMovement,byte[] expectedBytes,int expectedCompleted,long started) {
        try {
            checkUi("save quiet observation");
            saveQuietMillis=SystemClock.elapsedRealtime()-started;
            check(saveQuietMillis>=300,"save quiet observation ended before 300ms");
            check(currentSnapshot()==expectedSnapshot&&lastSnapshot==expectedSnapshot&&expectedSnapshot.movement==expectedMovement&&lastMovement==expectedMovement,"save quiet observation changed snapshot/movement");
            check(lastPng!=null&&Arrays.equals(lastPng,expectedBytes),"save quiet observation changed cached PNG bytes");
            check(lastComposition==7&&completedFrameCount()==expectedCompleted&&expectedCompleted==8,"save quiet observation advanced composition/frame count");
            writeResult(true);
        } catch(Throwable failure) { fail(failure); }
    }

    private JSONObject frameObservation(RenderedSnapshot snapshot,byte[] png,int count,boolean sameMovement,boolean samePaths) {
        JSONObject value=envelope("frame-ready");EditState options=snapshot.options;
        put(value,"composition_count",count);put(value,"id",IDS[count-1]);put(value,"completed_frame_count",completedFrameCount());put(value,"state_version",options.version);
        put(value,"trace",options.trace);put(value,"longer",options.longer);put(value,"alternate",options.alternate);put(value,"more",options.more);put(value,"farther",options.farther);
        put(value,"steps",options.steps());put(value,"distance",options.distance());put(value,"mark_length",options.markLength());
        put(value,"path_count",snapshot.movement.pathCount());put(value,"same_movement_as_previous",sameMovement);put(value,"same_path_objects_as_previous",samePaths);put(value,"count_prefix_checked",count==6);put(value,"distance_feedback_checked",count==7);
        put(value,"raw_commands",snapshot.image.rawCommands);put(value,"submitted_commands",snapshot.image.submittedCommands);put(value,"png_sha256",sha256(png));put(value,"button_center_bounds",buttonBounds());
        return value;
    }

    private static boolean samePathObjects(PathMarkComposition left,PathMarkComposition right) {
        if(left.pathCount()!=right.pathCount()) return false;
        for(int index=0;index<left.pathCount();index++) if(left.pathAt(index)!=right.pathAt(index)) return false;
        return true;
    }
    private static void checkPrefix(PathMarkComposition before,PathMarkComposition after) {
        check(before!=null&&after!=null,"count prefix models unavailable");
        for(int path=0;path<24;path++) {
            GradientPath2D left=before.pathAt(path),right=after.pathAt(path);
            for(int point=0;point<=2000;point++) { double[] a=left.pointAt(point),b=right.pointAt(point);bits(a[0],b[0]);bits(a[1],b[1]); }
            for(int heading=0;heading<2000;heading++) bits(left.headingAt(heading),right.headingAt(heading));
        }
    }
    private static void checkDistanceFeedback(PathMarkComposition count,PathMarkComposition distance) {
        check(count!=null&&distance!=null,"distance feedback models unavailable");boolean changed=false;
        for(int path=0;path<24;path++) { GradientPath2D a=count.pathAt(path),b=distance.pathAt(path);bits(a.headingAt(0),b.headingAt(0));changed|=Double.doubleToRawLongBits(a.headingAt(1))!=Double.doubleToRawLongBits(b.headingAt(1)); }
        check(changed,"distance did not affect later feedback heading");
    }
    private static void bits(double left,double right) { check(Double.doubleToRawLongBits(left)==Double.doubleToRawLongBits(right),"binary64 prefix differs"); }

    private JSONObject queryRow(Uri uri) {
        String[] projection={MediaStore.Images.Media.IS_PENDING,MediaStore.Images.Media.MIME_TYPE,MediaStore.Images.Media.RELATIVE_PATH,MediaStore.Images.Media.WIDTH,MediaStore.Images.Media.HEIGHT};
        try(Cursor cursor=getContentResolver().query(uri,projection,null,null,null)) {
            check(cursor!=null&&cursor.getCount()==1&&cursor.moveToFirst(),"saved MediaStore row unavailable");
            int pending=cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.IS_PENDING));String mime=cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE));String path=cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.RELATIVE_PATH));
            check(pending==0&&"image/png".equals(mime)&&("Pictures/Procedurals".equals(path)||"Pictures/Procedurals/".equals(path)),"saved MediaStore row differs from registered route");
            JSONObject value=new JSONObject();put(value,"uri",uri.toString());put(value,"is_pending",pending);put(value,"mime_type",mime);put(value,"relative_path",path);put(value,"metadata_width",cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)));put(value,"metadata_height",cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)));return value;
        }
    }

    private JSONArray buttonBounds() { JSONArray rows=new JSONArray();rows.put(buttonBounds("mode",modeButton));rows.put(buttonBounds("length",lengthButton));rows.put(buttonBounds("palette",paletteButton));rows.put(buttonBounds("count",countButton));rows.put(buttonBounds("distance",distanceButton));rows.put(buttonBounds("save",saveButton));return rows; }
    private static JSONObject buttonBounds(String id,View view) { check(view!=null,"missing "+id+" button");int[] location=new int[2];view.getLocationOnScreen(location);check(view.getWidth()>0&&view.getHeight()>0,"invalid "+id+" button bounds");JSONObject value=new JSONObject();put(value,"id",id);put(value,"left",location[0]);put(value,"top",location[1]);put(value,"width",view.getWidth());put(value,"height",view.getHeight());put(value,"center_x",location[0]+view.getWidth()/2);put(value,"center_y",location[1]+view.getHeight()/2);return value; }
    private byte[] readAll(Uri uri) throws IOException { InputStream stream=getContentResolver().openInputStream(uri);if(stream==null)throw new IOException("saved URI has no readable stream");try(InputStream input=stream;ByteArrayOutputStream output=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];for(int read;(read=input.read(buffer))!=-1;)output.write(buffer,0,read);return output.toByteArray();} }
    private void fail(Throwable failure) { if(failed)return;failed=true;try{JSONObject value=envelope("failure");put(value,"passed",false);put(value,"failure",failure.getClass().getName()+": "+failure.getMessage());StringWriter trace=new StringWriter();failure.printStackTrace(new PrintWriter(trace));put(value,"trace",trace.toString());put(value,"frames",frames);if(savedFacts!=null)put(value,"saved",savedFacts);writeJsonAtomically(new File(evidenceDirectory,"result.json"),value);}catch(Throwable ignored){ } }
    private void writeResult(boolean passed) throws IOException { JSONObject value=envelope("result");put(value,"passed",passed&&!failed);put(value,"api",Build.VERSION.SDK_INT);put(value,"renderer",lastSnapshot==null?null:lastSnapshot.image.renderer);put(value,"frames",frames);put(value,"composition_count",lastComposition);put(value,"completed_frame_count",completedFrameCount());put(value,"save_quiet_ms",saveQuietMillis);put(value,"saved",savedFacts);writeJsonAtomically(new File(evidenceDirectory,"result.json"),value); }
    private JSONObject envelope(String event) { JSONObject value=new JSONObject();put(value,"event",event);put(value,"nonce",nonce);put(value,"sequence",++sequence);put(value,"thread_id",Thread.currentThread().getId());put(value,"thread_name",Thread.currentThread().getName());return value; }
    private static void checkUi(String event) { check(Looper.myLooper()==Looper.getMainLooper(),event+" did not run on UI thread"); }
    private static void check(boolean condition,String message) { if(!condition)throw new AssertionError(message); }
    private static String sha256(byte[] bytes) { try{MessageDigest digest=MessageDigest.getInstance("SHA-256");StringBuilder value=new StringBuilder();for(byte item:digest.digest(bytes))value.append(String.format("%02x",item&255));return value.toString();}catch(NoSuchAlgorithmException error){throw new IllegalStateException("SHA-256 unavailable",error);} }
    private static void writeAtomically(File destination,byte[] bytes) throws IOException { File directory=destination.getParentFile();if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("cannot create evidence directory");File temporary=new File(directory,"."+destination.getName()+".tmp");try(FileOutputStream output=new FileOutputStream(temporary)){output.write(bytes);output.getFD().sync();}if(!temporary.renameTo(destination))throw new IOException("cannot publish "+destination.getName()); }
    private static void writeJsonAtomically(File destination,JSONObject value) throws IOException { writeAtomically(destination,value.toString().getBytes(StandardCharsets.UTF_8)); }
    private static void put(JSONObject object,String key,Object value) { try{object.put(key,value);}catch(JSONException error){throw new IllegalStateException("cannot construct probe JSON",error);} }
}
