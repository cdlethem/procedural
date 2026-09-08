package org.procedurals.examples.regionmarks;

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

/** Actual RegionMarks button callback observer; no substitute model or renderer. */
public final class RegionMarksProbeActivity extends RegionMarksActivity {
    private static final String[] IDS={"baseline","grid","palette","layout","count","seed","authored"};
    private static final int[] CELLS={301,301,301,301,601,601,11};
    private final JSONArray frames=new JSONArray();
    private File evidenceDirectory;
    private RenderedSnapshot previous;
    private String previousGeometry;
    private int lastCount;
    private boolean failed,awaitingPause,paused,resumedAfterPause,missingSurfaceCallbackChecked,resumeContinuePending;

    @Override public void onCreate(android.os.Bundle state) {
        super.onCreate(state);
        evidenceDirectory=new File(getFilesDir(),"region-marks-probe");
    }
    @Override protected void onPause() {
        if(awaitingPause)paused=true;
        super.onPause();
        if(awaitingPause)try {
            // Recreate an unchanged Android surface on the actual paused renderer.
            // The user resume hook must make the pinned Android2D restore runnable;
            // clear it again so the later real lifecycle must do the same work.
            Object probe=reflect(this,"probe"),graphics=reflect(probe,"g");
            java.lang.reflect.Field changed=graphics.getClass().getDeclaredField("changed");
            changed.setAccessible(true);changed.setBoolean(graphics,false);
            ((processing.core.PApplet)probe).resume();
            check(changed.getBoolean(graphics),"resume hook did not invalidate restore state");
            changed.setBoolean(graphics,false);missingSurfaceCallbackChecked=true;
        }catch(Throwable error){fail(error);}
    }
    @Override protected void onResume() {
        super.onResume();
        if(awaitingPause&&paused)resumedAfterPause=true;
    }
    private static String geometry(RegionComposition model) {
        StringBuilder out=new StringBuilder();double[] bounds=new double[4];
        for(int i=0;i<model.size();i++) {
            out.append(model.idAt(i)).append(':');model.boundsInto(i,bounds);
            for(double value:bounds)out.append(Long.toHexString(Double.doubleToRawLongBits(value))).append(',');
        }
        return out.toString();
    }
    @Override protected void onFrameReady(RenderedSnapshot snapshot) {
        if(failed)return;
        try {
            checkUi("frame ready");
            check(seedButton.isEnabled()&&budgetButton.isEnabled()&&sourceButton.isEnabled()
                &&separationButton.isEnabled()&&motifButton.isEnabled()&&paletteButton.isEnabled()
                &&saveButton.isEnabled(),"controls unavailable");
            if(snapshot.compositionCount==lastCount) {
                if(awaitingPause&&resumedAfterPause) {
                    check(snapshot==previous,"resume changed snapshot");
                    check(geometry(snapshot.composition).equals(previousGeometry),"resume changed geometry");
                    awaitingPause=false;resumeContinuePending=true;
                    writeState("resumed-awaiting-continue",false);
                    awaitRunnerContinue();
                }
                return;
            }
            int n=snapshot.compositionCount;
            check(n==lastCount+1&&n<=7,"unexpected composition count");
            check(snapshot.options.version==n-1,"state version mismatch");
            check(snapshot.composition.size()==CELLS[n-1]&&snapshot.image.cells==CELLS[n-1],"cell count");
            check(snapshot.image.marks==CELLS[n-1]*(n==1?1L:9L),"native mark count");
            check(snapshot.options.seed==(n>=6?43:42)&&snapshot.options.replacements==(n>=5?200:100)
                &&snapshot.options.fraction==(n>=4?1.0d:0.5d)&&snapshot.options.authored==(n==7)
                &&snapshot.options.gridMarks==(n>=2)&&snapshot.options.alternate==(n>=3),"edit state differs");
            String values=geometry(snapshot.composition);
            boolean retained=previous!=null&&previous.composition==snapshot.composition;
            if(previous!=null) {
                check(retained==(n==2||n==3),"retention mismatch");
                check(values.equals(previousGeometry)==retained,"geometry change mismatch");
                check(!Arrays.equals(previous.image.pngBytes(),snapshot.image.pngBytes()),"edit did not change image");
            }
            byte[] png=snapshot.image.pngBytes();
            BitmapFactory.Options dimensions=new BitmapFactory.Options();dimensions.inJustDecodeBounds=true;
            BitmapFactory.decodeByteArray(png,0,png.length,dimensions);
            check(dimensions.outWidth==640&&dimensions.outHeight==640,"image dimensions");
            writeAtomically(new File(evidenceDirectory,IDS[n-1]+".png"),png);
            JSONObject row=new JSONObject();put(row,"id",IDS[n-1]);put(row,"cells",snapshot.image.cells);
            put(row,"marks",snapshot.image.marks);put(row,"retained",retained);put(row,"png_sha256",sha256(png));
            put(row,"composition_count",n);frames.put(row);
            previous=snapshot;previousGeometry=values;lastCount=n;
            if(n==3) {awaitingPause=true;writeState("awaiting-pause",false);return;}
            if(n==7) {
                seedButton.performClick();budgetButton.performClick();separationButton.performClick();
                check(currentSnapshot()==snapshot,"ignored controls changed snapshot");
                final int completed=completedFrameCount();
                new Handler(Looper.getMainLooper()).postDelayed(()->{
                    try {
                        check(currentSnapshot()==snapshot&&completedFrameCount()==completed,"ignored controls drew");
                        saveButton.performClick();
                    } catch(Throwable error){fail(error);}
                },300);
                return;
            }
            final View next=n==1?motifButton:n==2?paletteButton:n==4?budgetButton:seedButton;
            // After the seed edit switch to authored cells.
            new Handler(Looper.getMainLooper()).post(()->{if(lastCount==6)sourceButton.performClick();else next.performClick();});
        } catch(Throwable error){fail(error);}
    }
    private void awaitRunnerContinue(){new Handler(Looper.getMainLooper()).postDelayed(new Runnable(){public void run(){
        if(failed||!resumeContinuePending)return;
        File signal=new File(evidenceDirectory,"continue");
        if(!signal.isFile()){new Handler(Looper.getMainLooper()).postDelayed(this,50);return;}
        try{
            check(signal.delete(),"cannot consume runner continue signal");resumeContinuePending=false;
            check(separationButton.isEnabled(),"resume edit control disabled");
            check(separationButton.performClick(),"resume edit callback absent");
            writeState("resume-edit-requested",false);
        }catch(Throwable error){fail(error);}
    }},50);}
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
                    check(missingSurfaceCallbackChecked,"missing surface callback regression absent");
                    writeState("passed",true);
                } catch(Throwable error){fail(error);}
            },300);
        } catch(Throwable error){fail(error);}
    }
    @Override protected void onExampleFailure(Throwable error){fail(error);}
    private void writeState(String status,boolean passed) throws IOException {
        JSONObject value=new JSONObject();put(value,"status",status);put(value,"passed",passed);
        put(value,"frames",frames);put(value,"composition_count",lastCount);
        put(value,"paused",paused);put(value,"resumed",resumedAfterPause);
        put(value,"missing_surface_callback_checked",missingSurfaceCallbackChecked);
        try{put(value,"viewport_bounds",viewportBounds());}catch(ReflectiveOperationException error){throw new IOException("viewport unavailable",error);}
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
    private static Object reflect(Object target,String name) throws ReflectiveOperationException {
        for(Class<?> type=target.getClass();type!=null;type=type.getSuperclass())try {
            java.lang.reflect.Field field=type.getDeclaredField(name);field.setAccessible(true);return field.get(target);
        } catch(NoSuchFieldException absent) { }
        throw new NoSuchFieldException(name);
    }
    private JSONArray viewportBounds() throws ReflectiveOperationException {
        View viewport=(View)reflect(this,"viewport");int[] location=new int[2];viewport.getLocationOnScreen(location);
        JSONArray bounds=new JSONArray();bounds.put(location[0]);bounds.put(location[1]);
        bounds.put(location[0]+viewport.getWidth());bounds.put(location[1]+viewport.getHeight());return bounds;
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
