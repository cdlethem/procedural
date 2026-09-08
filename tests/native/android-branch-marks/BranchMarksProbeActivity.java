package org.procedurals.examples.branchmarks;

import android.database.Cursor;
import android.graphics.BitmapFactory;
import android.net.Uri;
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
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.procedurals.topology.BranchTree2D;

/** Actual Android BranchMarks observer; it drives only the public activity controls. */
public final class BranchMarksProbeActivity extends BranchMarksActivity {
    private static final String[] IDS={"initial","extended","extended-restored","narrowing","reset-1",
        "wide","reset-2","binary","reset-3","recolour","thin","forest","forest-taper",
        "forest-palette","forest-extended","forest-seed","final-reset","reset-again"};
    private static final long[] SEGMENTS={101,192,101,101,101,101,101,38,101,101,101,288,288,288,560,634,101,101};
    private static final int[] TREES={1,1,1,1,1,1,1,1,1,1,1,7,7,7,7,8,1,1};
    private static final long[] TIPS={53,99,53,53,53,53,53,16,53,53,0,0,145,145,280,313,53,53};
    private static final long[] ACTUAL_TIPS={53,99,53,53,53,53,53,16,53,53,53,145,145,145,280,313,53,53};

    private final JSONArray frames=new JSONArray(),ordering=new JSONArray();
    private final JSONArray resumeRedrawDiagnostics=new JSONArray();
    private File evidenceDirectory;
    private RenderedSnapshot previous,initial,forest;
    private String previousValues,initialValues;
    private byte[] baseline;
    private int lastCount;
    private boolean failed,awaitingPause,paused,resumedAfterPause,resumeEditPending;
    private int resumeAcknowledgments;
    private boolean missingSurfaceCallbackChecked;

    @Override public void onCreate(android.os.Bundle state) {
        super.onCreate(state);
        evidenceDirectory=new File(getFilesDir(),"branch-marks-probe");
    }
    @Override protected void onPause() {
        if(awaitingPause)paused=true;
        super.onPause();
        if(awaitingPause)try {
            // Controlled regression on the actual paused renderer. Recreate the
            // valid state where Android has not delivered surfaceChanged, invoke
            // the real user resume hook, then clear again so the later actual
            // lifecycle must invoke the hook itself to recover.
            Object probe=reflect(this,"probe"),graphics=reflect(probe,"g");
            java.lang.reflect.Field changed=graphics.getClass().getDeclaredField("changed");
            changed.setAccessible(true);changed.setBoolean(graphics,false);
            ((processing.core.PApplet)probe).resume();
            check(changed.getBoolean(graphics),"resume hook did not invalidate restore state");
            changed.setBoolean(graphics,false);missingSurfaceCallbackChecked=true;
        }catch(Throwable error){fail(error);}
    }
    @Override protected void onResume() { super.onResume();if(awaitingPause&&paused)resumedAfterPause=true; }

    @Override protected void onAcknowledged(RenderedSnapshot snapshot,String source) {
        try {
            JSONObject row=new JSONObject();put(row,"event","acknowledged");put(row,"source",source);
            put(row,"composition_count",snapshot.compositionCount);put(row,"version",snapshot.options.version);ordering.put(row);
            if(resumedAfterPause&&snapshot.options.version==2&&snapshot.compositionCount==3) {
                resumeAcknowledgments++;
                check("resume-cache".equals(source),"resume used non-cache acknowledgment");
                check(resumeAcknowledgments==1,"duplicate cached resume acknowledgment");
            }
        } catch(Throwable error) { fail(error); }
    }
    @Override protected void onEditAttempt(int control,boolean accepted,EditState before,EditState after) {
        try {
            JSONObject row=new JSONObject();put(row,"event","edit-attempt");put(row,"control",control);
            put(row,"accepted",accepted);put(row,"before_version",before.version);put(row,"after_version",after.version);ordering.put(row);
            if(resumeEditPending) {
                check(control==2,"resume scheduled wrong control");check(accepted,"resume edit rejected by activity gate");
                check(after.version==before.version+1,"resume edit did not publish next version");resumeEditPending=false;
            }
        } catch(Throwable error) { fail(error); }
    }

    private static void putLong(MessageDigest digest,long value) {
        for(int shift=56;shift>=0;shift-=8)digest.update((byte)(value>>>shift));
    }
    /** Full retained-value identity: coordinates, headings, lengths, topology and child counts. */
    private static String valuesHash(BranchComposition composition) {
        try {
            MessageDigest digest=MessageDigest.getInstance("SHA-256");double[] segment=new double[4];
            putLong(digest,composition.size());
            for(int treeIndex=0;treeIndex<composition.size();treeIndex++) {
                BranchTree2D tree=composition.treeAt(treeIndex);putLong(digest,tree.size());
                for(int index=0;index<tree.size();index++) {
                    tree.segmentInto(index,segment,0);
                    for(double value:segment)putLong(digest,Double.doubleToRawLongBits(value));
                    putLong(digest,Double.doubleToRawLongBits(tree.headingAt(index)));
                    putLong(digest,Double.doubleToRawLongBits(tree.lengthAt(index)));
                    putLong(digest,tree.parentAt(index));putLong(digest,tree.generationAt(index));putLong(digest,tree.childCountAt(index));
                }
            }
            StringBuilder result=new StringBuilder();for(byte value:digest.digest())result.append(String.format("%02x",value&255));return result.toString();
        } catch(NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
    private static long actualTips(BranchComposition composition) {
        long total=0;
        for(int treeIndex=0;treeIndex<composition.size();treeIndex++) {
            BranchTree2D tree=composition.treeAt(treeIndex);
            for(int index=0;index<tree.size();index++)if(tree.childCountAt(index)==0)total++;
        }
        return total;
    }
    private static void checkTopology(BranchComposition composition) {
        double[] segment=new double[4],parent=new double[4];
        for(int treeIndex=0;treeIndex<composition.size();treeIndex++) {
            BranchTree2D tree=composition.treeAt(treeIndex);int[] children=new int[tree.size()];
            for(int index=0;index<tree.size();index++) {
                tree.segmentInto(index,segment,0);for(double value:segment)check(Double.isFinite(value),"nonfinite segment");
                check(Double.isFinite(tree.headingAt(index)),"nonfinite heading");
                check(Double.isFinite(tree.lengthAt(index))&&tree.lengthAt(index)>=0d,"invalid length");
                int ancestor=tree.parentAt(index);
                if(index==0)check(ancestor==-1&&tree.generationAt(index)==0,"root topology");
                else {
                    check(ancestor>=0&&ancestor<index,"parent order");children[ancestor]++;tree.segmentInto(ancestor,parent,0);
                    check(Double.doubleToRawLongBits(segment[0])==Double.doubleToRawLongBits(parent[2])
                        &&Double.doubleToRawLongBits(segment[1])==Double.doubleToRawLongBits(parent[3]),"attachment");
                    check(tree.generationAt(index)==tree.generationAt(ancestor)+1,"generation");
                }
            }
            for(int index=0;index<tree.size();index++)check(children[index]==tree.childCountAt(index),"child count");
        }
    }
    /** Appending a rule preserves prior geometry/attributes over every tree; child counts may change. */
    private static void checkPrefix(BranchComposition shorter,BranchComposition longer) {
        check(shorter.size()==longer.size(),"appended rule changed tree count");boolean grew=false;double[] left=new double[4],right=new double[4];
        for(int treeIndex=0;treeIndex<shorter.size();treeIndex++) {
            BranchTree2D a=shorter.treeAt(treeIndex),b=longer.treeAt(treeIndex);check(a.size()<=b.size(),"appended rule shrank tree");grew|=a.size()<b.size();
            for(int index=0;index<a.size();index++) {
                a.segmentInto(index,left,0);b.segmentInto(index,right,0);
                for(int axis=0;axis<4;axis++)check(Double.doubleToRawLongBits(left[axis])==Double.doubleToRawLongBits(right[axis]),"prefix segment");
                check(Double.doubleToRawLongBits(a.headingAt(index))==Double.doubleToRawLongBits(b.headingAt(index)),"prefix heading");
                check(Double.doubleToRawLongBits(a.lengthAt(index))==Double.doubleToRawLongBits(b.lengthAt(index)),"prefix length");
                check(a.parentAt(index)==b.parentAt(index)&&a.generationAt(index)==b.generationAt(index),"prefix topology");
            }
        }
        check(grew,"appended rule did not extend a tree");
    }
    private static void checkSettings(EditState state,int n) {
        boolean more=n==2||n==15||n==16;
        check(state.version==n-1&&state.seed==(n==16?43:42)&&state.more==more&&state.narrowing==(n==4)
            &&state.wider==(n==6)&&state.binary==(n==8)&&state.forest==(n>=12&&n<=16)
            &&state.taper!=((n==11)||(n==12))&&state.alternate==(n>=10&&n<=13)
            &&state.forceRebuild==(n==5||n==7||n==9||n==17||n==18),"state settings");
    }

    @Override protected void onFrameReady(RenderedSnapshot snapshot) {
        if(failed)return;
        try {
            checkUi("frame ready");
            check(seedButton.isEnabled()&&moreButton.isEnabled()&&narrowingButton.isEnabled()&&widerButton.isEnabled()
                &&binaryButton.isEnabled()&&forestButton.isEnabled()&&motifButton.isEnabled()&&paletteButton.isEnabled()
                &&resetButton.isEnabled()&&saveButton.isEnabled(),"controls unavailable");
            if(snapshot.compositionCount==lastCount) {
                if(awaitingPause&&resumedAfterPause) {
                    check(snapshot==previous&&valuesHash(snapshot.composition).equals(previousValues),"resume changed cached composition");
                    check(resumeAcknowledgments==1,"resume acknowledgment missing or duplicated");awaitingPause=false;writeState("resumed",false);
                    awaitDisplayReview(()->{try {
                        check(narrowingButton.isEnabled(),"resume edit control disabled");resumeEditPending=true;
                        check(narrowingButton.performClick(),"resume edit callback absent");check(!resumeEditPending,"resume edit callback did not reach activity");
                        recordResumeRedrawDiagnostic("immediate");
                        Handler handler=new Handler(Looper.getMainLooper());
                        handler.postDelayed(()->recordResumeRedrawDiagnostic("after-250ms"),250);
                        handler.postDelayed(()->recordResumeRedrawDiagnostic("after-2s"),2000);
                        writeState("resume-edit-requested",false);
                    }catch(Throwable error){fail(error);}});
                }
                return;
            }
            int n=snapshot.compositionCount;check(n==lastCount+1&&n<=IDS.length,"unexpected composition count");checkSettings(snapshot.options,n);
            check(snapshot.composition.size()==TREES[n-1]&&snapshot.image.trees==TREES[n-1],"native tree count");
            check(snapshot.composition.totalSegments()==SEGMENTS[n-1]&&snapshot.image.segments==SEGMENTS[n-1],"native segment count");
            check(actualTips(snapshot.composition)==ACTUAL_TIPS[n-1],"actual terminal count");check(snapshot.image.tips==TIPS[n-1],"native terminal-dot count");
            checkTopology(snapshot.composition);String values=valuesHash(snapshot.composition);boolean retained=previous!=null&&snapshot.composition==previous.composition;
            boolean shouldRetain=n==10||n==11||n==13||n==14;check(retained==shouldRetain,"composition identity");
            if(previous!=null)check(values.equals(previousValues)==(shouldRetain||n==18),"composition values changed unexpectedly");
            if(n==1){initial=snapshot;initialValues=values;baseline=snapshot.image.pngBytes();}
            if(n==2)checkPrefix(initial.composition,snapshot.composition);
            if(n==12)forest=snapshot;
            if(n==15)checkPrefix(forest.composition,snapshot.composition);
            if(n==3||n==5||n==7||n==9||n==17||n==18)check(values.equals(initialValues),"reset geometry differs");
            if(n==18)check(snapshot.composition!=previous.composition,"reset-again retained identity");
            byte[] png=snapshot.image.pngBytes();
            if(n==3||n==5||n==7||n==9||n==17||n==18)check(Arrays.equals(png,baseline),"baseline PNG replay differs");
            if(previous!=null)check(Arrays.equals(png,previous.image.pngBytes())==(n==18),"edit PNG difference");
            BitmapFactory.Options dimensions=new BitmapFactory.Options();dimensions.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(png,0,png.length,dimensions);
            check(dimensions.outWidth==640&&dimensions.outHeight==640,"PNG dimensions");writeAtomically(new File(evidenceDirectory,IDS[n-1]+".png"),png);
            JSONObject row=new JSONObject();put(row,"id",IDS[n-1]);put(row,"trees",snapshot.image.trees);put(row,"segments",snapshot.image.segments);put(row,"tips",snapshot.image.tips);
            put(row,"actual_tips",actualTips(snapshot.composition));put(row,"retained",retained);put(row,"values_sha256",values);put(row,"png_sha256",sha256(png));put(row,"composition_count",n);frames.put(row);
            previous=snapshot;previousValues=values;lastCount=n;
            if(n==3){awaitingPause=true;writeState("awaiting-pause",false);return;}
            if(n==18){final int completed=completedFrameCount();new Handler(Looper.getMainLooper()).postDelayed(()->{try {
                check(currentSnapshot()==snapshot&&completedFrameCount()==completed,"quiet state drew");check(saveButton.performClick(),"save callback absent");
            }catch(Throwable error){fail(error);}},300);return;}
            new Handler(Looper.getMainLooper()).post(()->{try {View next=nextControl(n);check(next.performClick(),"control callback absent");}catch(Throwable error){fail(error);}});
        } catch(Throwable error) { fail(error); }
    }
    private View nextControl(int n) {
        switch(n) {case 1:case 2:case 14:return moreButton;case 4:case 6:case 8:case 16:case 17:return resetButton;case 5:return widerButton;
            case 7:return binaryButton;case 9:case 13:return paletteButton;case 10:case 12:return motifButton;case 11:return forestButton;case 15:return seedButton;default:throw new AssertionError("no next control");}
    }
    @Override protected void onImageSaved(RenderedSnapshot snapshot,Uri uri) {
        try {
            checkUi("saved");check(snapshot==previous&&currentSnapshot()==previous,"cached save snapshot");byte[] saved=readAll(uri);check(Arrays.equals(saved,previous.image.pngBytes()),"saved bytes differ");
            JSONObject savedRow=queryRow(uri);writeAtomically(new File(evidenceDirectory,"saved.png"),saved);final int completed=completedFrameCount();
            new Handler(Looper.getMainLooper()).postDelayed(()->{try {
                check(currentSnapshot()==snapshot&&completedFrameCount()==completed,"save redrew");check(paused&&resumedAfterPause,"real pause/resume missing");check(missingSurfaceCallbackChecked,"missing surface callback regression absent");check(resumeAcknowledgments==1,"resume acknowledgment count changed");writeState("passed",true,savedRow);
            }catch(Throwable error){fail(error);}},300);
        }catch(Throwable error){fail(error);}
    }
    @Override protected void onExampleFailure(Throwable error){fail(error);}

    private void awaitDisplayReview(Runnable next) {
        Handler handler=new Handler(Looper.getMainLooper());long deadline=android.os.SystemClock.uptimeMillis()+15000;
        handler.post(new Runnable(){public void run(){
            if(failed)return;
            if(new File(evidenceDirectory,"display-reviewed").isFile()){next.run();return;}
            if(android.os.SystemClock.uptimeMillis()>deadline){fail(new AssertionError("display review handshake missing"));return;}
            handler.postDelayed(this,50);
        }});
    }
    private void writeState(String status,boolean passed) throws IOException { writeState(status,passed,null); }
    private void writeState(String status,boolean passed,JSONObject saved) throws IOException {
        if(failed&&passed)return;
        JSONObject value=new JSONObject();put(value,"status",status);put(value,"passed",passed);put(value,"frames",frames);put(value,"composition_count",lastCount);put(value,"missing_surface_callback_checked",missingSurfaceCallbackChecked);put(value,"paused",paused);put(value,"resumed",resumedAfterPause);put(value,"resume_acknowledgments",resumeAcknowledgments);put(value,"ordering",ordering);put(value,"completed_frames",completedFrameCount());if(saved!=null)put(value,"saved_media_store",saved);
        try {java.lang.reflect.Field field=BranchMarksActivity.class.getDeclaredField("requested");field.setAccessible(true);EditState requested=(EditState)((AtomicReference<?>)field.get(this)).get();put(value,"requested_version",requested.version);put(value,"requested_seed",requested.seed);}catch(ReflectiveOperationException error){throw new IOException("observer state unavailable",error);}
        try {
            android.view.View viewport=(android.view.View)reflect(this,"viewport");int[] xy=new int[2];viewport.getLocationOnScreen(xy);
            JSONArray bounds=new JSONArray();bounds.put(xy[0]);bounds.put(xy[1]);bounds.put(xy[0]+viewport.getWidth());bounds.put(xy[1]+viewport.getHeight());put(value,"viewport_bounds",bounds);
        }catch(ReflectiveOperationException error){throw new IOException("viewport bounds unavailable",error);}
        writeJsonAtomically(new File(evidenceDirectory,"result.json"),value);
    }
    /** Capture the pinned-runtime state around the accepted resume edit without changing it. */
    private void recordResumeRedrawDiagnostic(String point) {
        try {
            JSONObject row=new JSONObject();put(row,"point",point);put(row,"uptime_ms",SystemClock.uptimeMillis());
            Object probe=reflect(this,"probe");
            put(row,"probe_present",probe!=null);
            if(probe!=null) {
                putDiagnostic(row,"looping",reflect(probe,"looping"));putDiagnostic(row,"redraw",reflect(probe,"redraw"));putDiagnostic(row,"inside_draw",reflect(probe,"insideDraw"));
                Object graphics=reflect(probe,"g");put(row,"graphics_present",graphics!=null);
                if(graphics!=null) {
                    putDiagnostic(row,"restored_surface",reflect(graphics,"restoredSurface"));
                    putDiagnostic(row,"restarted_looping_after_resume",reflect(graphics,"restartedLoopingAfterResume"));
                    putDiagnostic(row,"changed",reflect(graphics,"changed"));putDiagnostic(row,"restore_count",reflect(graphics,"restoreCount"));
                    putDiagnostic(row,"restore_filename",reflect(graphics,"restoreFilename"));
                }
                Object surface=reflect(probe,"surface");put(row,"surface_present",surface!=null);
                if(surface!=null) {
                    putDiagnostic(row,"surface_paused",reflect(surface,"paused"));Object thread=reflect(surface,"thread");
                    put(row,"surface_thread_present",thread!=null);
                    if(thread instanceof Thread) {put(row,"surface_thread_alive",((Thread)thread).isAlive());put(row,"surface_thread_state",((Thread)thread).getState().toString());}
                }
            }
            resumeRedrawDiagnostics.put(row);JSONObject output=new JSONObject();put(output,"diagnostics",resumeRedrawDiagnostics);
            writeJsonAtomically(new File(evidenceDirectory,"resume-redraw-diagnostics.json"),output);
        } catch(Throwable error) {
            try {JSONObject output=new JSONObject();put(output,"diagnostics",resumeRedrawDiagnostics);put(output,"diagnostic_error",error.toString());writeJsonAtomically(new File(evidenceDirectory,"resume-redraw-diagnostics.json"),output);}catch(Throwable ignored){}
        }
    }
    private static Object reflect(Object target,String name) throws ReflectiveOperationException {
        for(Class<?> type=target.getClass();type!=null;type=type.getSuperclass())try {
            java.lang.reflect.Field field=type.getDeclaredField(name);field.setAccessible(true);return field.get(target);
        } catch(NoSuchFieldException absent) { }
        throw new NoSuchFieldException(name);
    }
    private static void putDiagnostic(JSONObject object,String key,Object value) {
        try {object.put(key,value==null?JSONObject.NULL:value);}catch(JSONException error){throw new IllegalStateException("cannot construct diagnostic JSON",error);}
    }
    private void fail(Throwable error) { failed=true;try {JSONObject value=new JSONObject();put(value,"status","failed");put(value,"passed",false);StringWriter trace=new StringWriter();error.printStackTrace(new PrintWriter(trace));put(value,"failure",trace.toString());put(value,"frames",frames);put(value,"ordering",ordering);writeJsonAtomically(new File(evidenceDirectory,"result.json"),value);}catch(Throwable ignored){}}
    private JSONObject queryRow(Uri uri) {
        String[] projection={MediaStore.Images.Media.IS_PENDING,MediaStore.Images.Media.MIME_TYPE,MediaStore.Images.Media.RELATIVE_PATH,MediaStore.Images.Media.WIDTH,MediaStore.Images.Media.HEIGHT};
        try(Cursor cursor=getContentResolver().query(uri,projection,null,null,null)) {
            check(cursor!=null&&cursor.getCount()==1&&cursor.moveToFirst(),"saved MediaStore row unavailable");int pending=cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.IS_PENDING));String mime=cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE));String path=cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.RELATIVE_PATH));
            check(pending==0&&"image/png".equals(mime)&&("Pictures/Procedurals".equals(path)||"Pictures/Procedurals/".equals(path)),"saved MediaStore row differs");JSONObject result=new JSONObject();put(result,"uri",uri.toString());put(result,"is_pending",pending);put(result,"mime_type",mime);put(result,"relative_path",path);put(result,"metadata_width",cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)));put(result,"metadata_height",cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)));return result;
        }
    }
    private byte[] readAll(Uri uri) throws IOException {InputStream stream=getContentResolver().openInputStream(uri);if(stream==null)throw new IOException("saved URI has no readable stream");try(InputStream input=stream;ByteArrayOutputStream output=new ByteArrayOutputStream()){byte[] buffer=new byte[8192];for(int read;(read=input.read(buffer))!=-1;)output.write(buffer,0,read);return output.toByteArray();}}
    private static void checkUi(String event){check(Looper.myLooper()==Looper.getMainLooper(),event+" did not run on UI thread");}
    private static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
    private static String sha256(byte[] bytes){try{MessageDigest digest=MessageDigest.getInstance("SHA-256");StringBuilder value=new StringBuilder();for(byte item:digest.digest(bytes))value.append(String.format("%02x",item&255));return value.toString();}catch(NoSuchAlgorithmException error){throw new IllegalStateException(error);}}
    private static void writeAtomically(File destination,byte[] bytes)throws IOException{File directory=destination.getParentFile();if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("cannot create evidence directory");File temporary=new File(directory,"."+destination.getName()+".tmp");try(FileOutputStream output=new FileOutputStream(temporary)){output.write(bytes);output.getFD().sync();}if(!temporary.renameTo(destination))throw new IOException("cannot publish "+destination.getName());}
    private static void writeJsonAtomically(File destination,JSONObject value)throws IOException{writeAtomically(destination,value.toString().getBytes(StandardCharsets.UTF_8));}
    private static void put(JSONObject object,String key,Object value){try{object.put(key,value);}catch(JSONException error){throw new IllegalStateException("cannot construct probe JSON",error);}}
}
