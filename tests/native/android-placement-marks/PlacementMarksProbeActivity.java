package org.procedurals.examples.placementmarks;

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
import org.procedurals.sampling.CirclePlacements2D;

/**
 * Test-only observer for the actual editable PlacementMarks Activity. It does not
 * alter controls, drawing, retained composition, save behavior, or MediaStore I/O.
 * The registered sequence mirrors the frozen PlacementMarks acceptance order:
 * baseline, motif pair, palette pair, separation pair, size pairs, count pair,
 * seed, radial, and the radial separation pair.
 */
public final class PlacementMarksProbeActivity extends PlacementMarksActivity {
    private static final String[] IDS={"baseline","diamonds","rings-restored","palette","palette-restored",
        "spacing","spacing-restored","size-min","size-min-restored","size-max","size-max-restored",
        "count-extended","count-restored","seed","radial","radial-spacing","radial-spacing-restored"};
    private static final long[] SEEDS={42,42,42,42,42,42,42,42,42,42,42,42,42,43,43,43,43};
    private static final int[] ATTEMPTS={5000,5000,5000,5000,5000,5000,5000,5000,5000,5000,5000,
        10000,5000,5000,5000,5000,5000};
    private static final boolean[] RADIAL={false,false,false,false,false,false,false,false,false,false,
        false,false,false,false,true,true,true};
    private static final double[] SEPARATIONS={1,1,1,1,1,1.2,1,1,1,1,1,1,1,1,1,1.2,1};
    private static final double[] MINIMUMS={4,4,4,4,4,4,4,8,4,4,4,4,4,4,4,4,4};
    private static final double[] MAXIMUMS={64,64,64,64,64,64,64,64,64,32,64,64,64,64,64,64,64};
    private static final boolean[] DIAMONDS={false,true,false,false,false,false,false,false,false,false,
        false,false,false,false,false,false,false};
    private static final boolean[] ALTERNATE={false,false,false,true,false,false,false,false,false,false,
        false,false,false,false,false,false,false};
    private static final int[] ACCEPTED={424,424,424,424,424,353,424,239,424,613,424,517,424,432,111,95,111};
    private static final int BASELINE_ACCEPTED=424;

    private File evidenceDirectory;
    private String nonce;
    private int sequence, lastComposition, lastReadyFrame=-1;
    private RenderedSnapshot lastSnapshot;
    private PlacementComposition baselineComposition, lastCompositionObject;
    private byte[] lastPng;
    private long saveQuietMillis=-1;
    private boolean failed;
    private final JSONArray frames=new JSONArray();
    private JSONObject savedFacts;

    @Override public void onCreate(android.os.Bundle state) {
        super.onCreate(state);
        nonce=UUID.randomUUID().toString();
        evidenceDirectory=new File(getFilesDir(),"placement-marks-probe");
        if(!evidenceDirectory.isDirectory()&&!evidenceDirectory.mkdirs()) fail(new IOException("cannot create probe evidence directory"));
    }

    @Override protected void onFrameReady(RenderedSnapshot snapshot) {
        try {
            checkUi("onFrameReady");
            check(snapshot!=null&&snapshot.composition!=null&&snapshot.image!=null,"missing PlacementMarks snapshot");
            check(seedButton.isEnabled()&&budgetButton.isEnabled()&&sourceButton.isEnabled()
                &&separationButton.isEnabled()&&minButton.isEnabled()&&maxButton.isEnabled()
                &&motifButton.isEnabled()&&paletteButton.isEnabled()&&saveButton.isEnabled(),
                "all nine controls must be enabled at acknowledgement");
            int count=snapshot.compositionCount;
            if(count==lastComposition) return; // Lifecycle acknowledgement may repeat an existing image.
            check(count==lastComposition+1&&count>=1&&count<=IDS.length,
                "unexpected composition acknowledgement "+count);
            EditState options=snapshot.options;
            check(options.version==count-1&&options.seed==SEEDS[count-1]&&options.attempts==ATTEMPTS[count-1]
                &&options.radial==RADIAL[count-1]
                &&options.separation==SEPARATIONS[count-1]&&options.minimum==MINIMUMS[count-1]
                &&options.maximum==MAXIMUMS[count-1]&&options.diamonds==DIAMONDS[count-1]
                &&options.alternate==ALTERNATE[count-1],"registered option state differs at "+count);
            check(completedFrameCount()==count+1,"completed frame must include startup plus composition "+count);
            CirclePlacements2D placements=snapshot.composition.placements();
            check(placements.size()==ACCEPTED[count-1],"accepted count differs at "+count);
            check(placements.attempts()==(RADIAL[count-1]?160L:ATTEMPTS[count-1]),"proposal count differs at "+count);
            check(snapshot.image.submittedCommands==ACCEPTED[count-1]*(DIAMONDS[count-1]?4L:64L),
                "submitted command count differs at "+count);

            boolean retained=false;
            if(lastCompositionObject!=null) {
                retained=snapshot.composition==lastCompositionObject;
                if(count<=5) check(retained,"style edit replaced retained composition at "+count);
                else check(!retained,"geometry edit retained stale composition at "+count);
            }
            if(count==12) checkAcceptedPrefix(baselineComposition,snapshot.composition);

            byte[] png=snapshot.image.pngBytes();
            check(png.length>0,"empty cached PNG");
            writeAtomically(new File(evidenceDirectory,"frame-"+count+".png"),png);
            JSONObject observation=frameObservation(snapshot,png,count,count==1?null:retained);
            writeJsonAtomically(new File(evidenceDirectory,"frame-"+count+".json"),observation);
            frames.put(observation);lastComposition=count;lastReadyFrame=completedFrameCount();
            lastSnapshot=snapshot;lastCompositionObject=snapshot.composition;
            if(count==1)baselineComposition=snapshot.composition;
            lastPng=png.clone();
        }catch(Throwable failure){fail(failure);}
    }

    @Override protected void onImageSaved(RenderedSnapshot snapshot,Uri uri) {
        try {
            checkUi("onImageSaved");
            check(snapshot!=null&&uri!=null,"save hook has no snapshot/URI");
            check(snapshot.compositionCount==IDS.length&&snapshot==lastSnapshot
                &&currentSnapshot()==snapshot,"save did not use the current final snapshot");
            check(completedFrameCount()==lastReadyFrame,"save advanced composition/frame count");
            byte[] saved=readAll(uri);
            check(lastPng!=null&&Arrays.equals(lastPng,saved),"saved URI bytes differ from cached PNG");
            BitmapFactory.Options dimensions=new BitmapFactory.Options();dimensions.inJustDecodeBounds=true;
            BitmapFactory.decodeByteArray(saved,0,saved.length,dimensions);
            check(dimensions.outWidth==640&&dimensions.outHeight==640,"saved PNG is not 640x640");
            writeAtomically(new File(evidenceDirectory,"saved.png"),saved);
            JSONObject row=queryRow(uri);put(row,"png_width",dimensions.outWidth);
            put(row,"png_height",dimensions.outHeight);put(row,"byte_sha256",sha256(saved));savedFacts=row;
            final RenderedSnapshot expectedSnapshot=snapshot;
            final PlacementComposition expectedComposition=snapshot.composition;
            final byte[] expectedBytes=saved.clone();
            final int expectedCompleted=completedFrameCount();
            final long started=SystemClock.elapsedRealtime();
            new Handler(Looper.getMainLooper()).postDelayed(
                ()->quietAfterSave(expectedSnapshot,expectedComposition,expectedBytes,expectedCompleted,started),300L);
        }catch(Throwable failure){fail(failure);}
    }

    @Override protected void onExampleFailure(Throwable failure) { fail(failure); }

    private void quietAfterSave(RenderedSnapshot expectedSnapshot,PlacementComposition expectedComposition,
                                byte[] expectedBytes,int expectedCompleted,long started) {
        try {
            checkUi("save quiet observation");
            saveQuietMillis=SystemClock.elapsedRealtime()-started;
            check(saveQuietMillis>=300,"save quiet observation ended before 300ms");
            check(currentSnapshot()==expectedSnapshot&&lastSnapshot==expectedSnapshot
                &&expectedSnapshot.composition==expectedComposition&&lastCompositionObject==expectedComposition,
                "save quiet observation changed snapshot/composition");
            check(lastPng!=null&&Arrays.equals(lastPng,expectedBytes),"save quiet observation changed cached PNG bytes");
            check(lastComposition==IDS.length&&completedFrameCount()==expectedCompleted
                &&expectedCompleted==IDS.length+1,"save quiet observation advanced composition/frame count");
            writeResult(true);
        }catch(Throwable failure){fail(failure);}
    }

    /** The extended budget must keep the exact accepted prefix of the baseline
     * composition: centres, radii, and source indices bit-identical in binary64. */
    private static void checkAcceptedPrefix(PlacementComposition before,PlacementComposition after) {
        check(before!=null&&after!=null,"prefix compositions unavailable");
        CirclePlacements2D left=before.placements(),right=after.placements();
        double[] a=new double[2],b=new double[2];
        for(int index=0;index<BASELINE_ACCEPTED;index++) {
            left.pointInto(index,a,0);right.pointInto(index,b,0);
            bits(a[0],b[0]);bits(a[1],b[1]);
            bits(left.radiusAt(index),right.radiusAt(index));
            check(left.sourceIndexAt(index)==right.sourceIndexAt(index),"prefix source index differs at "+index);
        }
    }
    private static void bits(double left,double right) {
        check(Double.doubleToLongBits(left)==Double.doubleToLongBits(right),"binary64 prefix differs");
    }

    private JSONObject frameObservation(RenderedSnapshot snapshot,byte[] png,int count,Boolean retained) {
        JSONObject value=envelope("frame-ready");
        EditState options=snapshot.options;
        put(value,"composition_count",count);put(value,"id",IDS[count-1]);
        put(value,"completed_frame_count",completedFrameCount());put(value,"state_version",options.version);
        put(value,"seed",options.seed);put(value,"attempts",options.attempts);put(value,"radial",options.radial);
        put(value,"separation",options.separation);put(value,"minimum",options.minimum);
        put(value,"maximum",options.maximum);put(value,"diamonds",options.diamonds);
        put(value,"alternate",options.alternate);
        put(value,"accepted",snapshot.composition.placements().size());
        put(value,"proposals",snapshot.composition.placements().attempts());
        put(value,"retained_identity",retained);
        put(value,"prefix_checked",count==12);
        put(value,"submitted_commands",snapshot.image.submittedCommands);
        put(value,"renderer",snapshot.image.renderer);
        put(value,"png_sha256",sha256(png));put(value,"button_center_bounds",buttonBounds());
        return value;
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

    private JSONArray buttonBounds() {
        JSONArray rows=new JSONArray();
        rows.put(buttonBounds("seed",seedButton));rows.put(buttonBounds("budget",budgetButton));
        rows.put(buttonBounds("source",sourceButton));rows.put(buttonBounds("separation",separationButton));
        rows.put(buttonBounds("min",minButton));rows.put(buttonBounds("max",maxButton));
        rows.put(buttonBounds("motif",motifButton));rows.put(buttonBounds("palette",paletteButton));
        rows.put(buttonBounds("save",saveButton));
        return rows;
    }
    private static JSONObject buttonBounds(String id,View view) {
        check(view!=null,"missing "+id+" button");
        int[] location=new int[2];view.getLocationOnScreen(location);
        check(view.getWidth()>0&&view.getHeight()>0,"invalid "+id+" button bounds");
        JSONObject value=new JSONObject();put(value,"id",id);put(value,"left",location[0]);
        put(value,"top",location[1]);put(value,"width",view.getWidth());put(value,"height",view.getHeight());
        put(value,"center_x",location[0]+view.getWidth()/2);put(value,"center_y",location[1]+view.getHeight()/2);
        return value;
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
    private void fail(Throwable failure) {
        if(failed)return;failed=true;
        try{
            JSONObject value=envelope("failure");put(value,"passed",false);
            put(value,"failure",failure.getClass().getName()+": "+failure.getMessage());
            StringWriter trace=new StringWriter();failure.printStackTrace(new PrintWriter(trace));
            put(value,"trace",trace.toString());put(value,"frames",frames);
            if(savedFacts!=null)put(value,"saved",savedFacts);
            writeJsonAtomically(new File(evidenceDirectory,"result.json"),value);
        }catch(Throwable ignored){ }
    }
    private void writeResult(boolean passed) throws IOException {
        JSONObject value=envelope("result");put(value,"passed",passed&&!failed);
        put(value,"api",Build.VERSION.SDK_INT);
        put(value,"renderer",lastSnapshot==null?null:lastSnapshot.image.renderer);
        put(value,"frames",frames);put(value,"composition_count",lastComposition);
        put(value,"completed_frame_count",completedFrameCount());put(value,"save_quiet_ms",saveQuietMillis);
        if(savedFacts!=null)put(value,"saved",savedFacts);
        writeJsonAtomically(new File(evidenceDirectory,"result.json"),value);
    }
    private JSONObject envelope(String event) {
        JSONObject value=new JSONObject();put(value,"event",event);put(value,"nonce",nonce);
        put(value,"sequence",++sequence);put(value,"thread_id",Thread.currentThread().getId());
        put(value,"thread_name",Thread.currentThread().getName());
        return value;
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
