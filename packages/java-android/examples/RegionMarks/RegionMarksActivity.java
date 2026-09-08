package org.procedurals.examples.regionmarks;

import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.fragment.app.FragmentActivity;
import java.lang.ref.WeakReference;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.procedurals.android.internal.Android2DFragment;
import org.procedurals.android.internal.AndroidFrameHost;
import org.procedurals.examples.fieldmarks.GalleryWriter;
import processing.core.PApplet;

/** Editable native RegionMarks: seeded/authored cells with retained palette and motif edits.
 * Reuses the established UI/animation-thread publication, lifecycle and cached-save route.
 * Shared RegionComposition owns portable geometry; native drawing stays in the renderer.
 */
public class RegionMarksActivity extends FragmentActivity {
    private static final int[] BASE={0x173f5f,0x20639b,0x3caea3,0xf6d55c,0xed553b};
    private static final int[] ALTERNATE={0x264653,0x2a9d8f,0xe9c46a,0xf4a261,0xe76f51};

    /** Example settings; immutable publication from UI to animation thread. */
    public static final class EditState {
        public final long version,seed;
        public final int replacements;
        public final double fraction;
        public final boolean authored,gridMarks,alternate;
        EditState(long version,long seed,int replacements,double fraction,boolean authored,boolean gridMarks,boolean alternate) {
            this.version=version;this.seed=seed;this.replacements=replacements;this.fraction=fraction;
            this.authored=authored;this.gridMarks=gridMarks;this.alternate=alternate;
        }
        public static EditState initial() { return new EditState(0,42,100,0.5d,false,false,false); }
        public EditState toggle(int control,long nextVersion) {
            if(authored&&(control==0||control==1||control==3))return this;
            long nextSeed=seed;int nextCount=replacements;double nextFraction=fraction;
            boolean nextSource=authored,nextMarks=gridMarks,nextPalette=alternate;
            switch(control) {
            case 0:nextSeed=(seed+1)&0xffffffffL;break;
            case 1:nextCount=replacements==100?200:100;break;
            case 2:nextSource=!authored;break;
            case 3:nextFraction=fraction==0.5d?1.0d:0.5d;break;
            case 4:nextMarks=!gridMarks;break;
            case 5:nextPalette=!alternate;break;
            default:throw new IllegalArgumentException("control");
            }
            return new EditState(nextVersion,nextSeed,nextCount,nextFraction,nextSource,nextMarks,nextPalette);
        }
        public boolean sameGeometryAs(EditState other) {
            return authored==other.authored&&seed==other.seed&&replacements==other.replacements
                &&Double.doubleToLongBits(fraction)==Double.doubleToLongBits(other.fraction);
        }
        public String description() {
            return (authored?"Authored cells":"Seed "+seed+" · "+replacements+" splits · fraction "+fraction)
                +" · "+(gridMarks?"Grid marks":"Single marks")+" · "+(alternate?"Alternate":"Base");
        }
    }

    public static final class RenderedSnapshot {
        public final EditState options;
        public final RegionComposition composition;
        public final RegionMarksRenderer.Result image;
        public final int compositionCount;
        RenderedSnapshot(EditState options,RegionComposition composition,
                         RegionMarksRenderer.Result image,int compositionCount) {
            this.options=options;this.composition=composition;this.image=image;this.compositionCount=compositionCount;
        }
    }

    protected Button seedButton,budgetButton,sourceButton,separationButton;
    protected Button motifButton,paletteButton,saveButton;
    private TextView status; private FrameLayout viewport; private Probe probe;
    private View.OnLayoutChangeListener viewportListener;
    private final AtomicReference<EditState> requested=new AtomicReference<>(EditState.initial());
    private final AtomicInteger completedFrame=new AtomicInteger();
    private final ThreadPoolExecutor writer=new ThreadPoolExecutor(1,1,0,TimeUnit.SECONDS,
        new ArrayBlockingQueue<Runnable>(1),task -> new Thread(task,"RegionMarks PNG writer"));
    private volatile RenderedSnapshot rendered; private volatile boolean displayValid;
    private boolean resumed,busy=true,saving; private long nextVersion;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(8),dp(8),dp(8),dp(8));page.setBackgroundColor(0xfff3f0e8);
        TextView title=new TextView(this);title.setText("Region marks");title.setTextSize(20);
        title.setTextColor(0xff202027);page.addView(title);
        LinearLayout firstRow=new LinearLayout(this);
        seedButton=button("Seed",firstRow,()->edit(0));budgetButton=button("Splits",firstRow,()->edit(1));
        sourceButton=button("Source",firstRow,()->edit(2));separationButton=button("Selection",firstRow,()->edit(3));
        page.addView(firstRow,new LinearLayout.LayoutParams(-1,dp(48)));
        LinearLayout secondRow=new LinearLayout(this);
        motifButton=button("Motif",secondRow,()->edit(4));
        paletteButton=button("Palette",secondRow,()->edit(5));
        saveButton=button("Save PNG",secondRow,this::saveCurrent);
        page.addView(secondRow,new LinearLayout.LayoutParams(-1,dp(48)));
        status=new TextView(this);status.setText("Drawing…");status.setTextSize(12);
        status.setTextColor(0xff33333a);status.setGravity(Gravity.CENTER_VERTICAL);
        page.addView(status,new LinearLayout.LayoutParams(-1,dp(32)));
        viewport=new FrameLayout(this);viewport.setId(View.generateViewId());
        page.addView(viewport,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(page);refreshControls();
        viewportListener=(view,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom)->attachViewport(viewport);
        viewport.addOnLayoutChangeListener(viewportListener);viewport.post(()->attachViewport(viewport));
    }
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private Button button(String label,LinearLayout row,Runnable action) {
        Button button=new Button(this);button.setText(label);button.setContentDescription(label);
        button.setTextSize(12);button.setAllCaps(false);button.setMinWidth(0);button.setMinimumWidth(0);
        button.setPadding(dp(3),0,dp(3),0);button.setOnClickListener(view->action.run());
        row.addView(button,new LinearLayout.LayoutParams(0,-1,1));return button;
    }
    private void attachViewport(FrameLayout target) {
        if(isDestroyed()||isFinishing()||getSupportFragmentManager().isStateSaved()||probe!=null||target.getWidth()==0||target.getHeight()==0)return;
        int edge=Math.min(target.getWidth(),target.getHeight());
        Probe attached=new Probe(edge);
        new Android2DFragment(attached).setView(target,this);probe=attached;
        target.removeOnLayoutChangeListener(viewportListener);
    }
    private void refreshControls() {
        boolean ready=resumed&&!busy&&!saving;if(seedButton==null)return;
        EditState state=requested.get();
        seedButton.setContentDescription("Seed: "+(state.authored?"ignored":state.seed));
        budgetButton.setContentDescription("Splits: "+(state.authored?"ignored":state.replacements));
        sourceButton.setContentDescription("Source: "+(state.authored?"authored":"seeded"));
        separationButton.setContentDescription("Selection: "+state.fraction);
        motifButton.setContentDescription("Motif: "+(state.gridMarks?"grid":"single"));
        paletteButton.setContentDescription("Palette: "+(state.alternate?"alternate":"base"));
        for(Button button:new Button[]{seedButton,budgetButton,sourceButton,separationButton,motifButton,paletteButton})
            button.setEnabled(ready);
        saveButton.setEnabled(ready&&rendered!=null&&displayValid);
    }
    private void edit(int choice) {
        if(!resumed||busy||saving||probe==null)return;
        EditState old=requested.get();
        EditState next=old.toggle(choice,nextVersion+1);
        if(next==old)return; // Ignored while authored: no rebuild, no redraw, same revision.
        nextVersion+=1;busy=true;refreshControls();requested.set(next);status.setText("Drawing…");probe.redraw();
    }
    private void acknowledge(RenderedSnapshot snapshot) {
        if(isDestroyed()||requested.get().version!=snapshot.options.version)return;
        busy=false;status.setText(snapshot.options.description());refreshControls();onFrameReady(snapshot);
    }
    private void saveCurrent() {
        RenderedSnapshot snapshot=rendered;
        if(!resumed||busy||saving||snapshot==null||!displayValid)return;
        saving=true;refreshControls();status.setText("Saving PNG…");
        try{writer.execute(new SaveTask(getApplicationContext(),this,snapshot));}
        catch(RuntimeException failure){saveFinished(snapshot,null,failure);}
    }
    private void saveFinished(RenderedSnapshot snapshot,Uri uri,Throwable failure) {
        if(isDestroyed())return;
        saving=false;
        status.setText(failure==null?"Saved to Pictures/Procedurals":"Could not save PNG. Try again.");
        refreshControls();
        if(failure==null)onImageSaved(snapshot,uri);else onExampleFailure(failure);
    }
    private static final class SaveTask implements Runnable {
        private final Context context;
        private final WeakReference<RegionMarksActivity> activity;
        private final RenderedSnapshot snapshot;
        SaveTask(Context context,RegionMarksActivity activity,RenderedSnapshot snapshot){
            this.context=context;this.activity=new WeakReference<>(activity);this.snapshot=snapshot;
        }
        @Override public void run() {
            Uri uri=null;Throwable failure=null;
            try{uri=GalleryWriter.save(context,snapshot.image.pngBytes(),
                "region-marks-42-"+System.currentTimeMillis()+".png");}
            catch(Exception error){failure=error;}
            final Uri saved=uri;final Throwable error=failure;
            RegionMarksActivity owner=activity.get();
            if(owner!=null&&!owner.isDestroyed())owner.runOnUiThread(()->{
                RegionMarksActivity current=activity.get();
                if(current!=null)current.saveFinished(snapshot,saved,error);
            });
        }
    }

    @Override protected void onResume(){super.onResume();resumed=true;busy=true;refreshControls();
        if(viewport!=null&&probe==null)viewport.post(()->attachViewport(viewport));
        // A noLoop sketch may resume without another draw/post callback. The cached
        // snapshot is still valid; acknowledge it on the UI queue after resume finishes.
        if(viewport!=null)viewport.post(()->{
            RenderedSnapshot snapshot=rendered;
            if(resumed&&displayValid&&snapshot!=null&&requested.get().version==snapshot.options.version)
                acknowledge(snapshot);
        });
    }
    @Override protected void onPause(){resumed=false;refreshControls();super.onPause();}
    @Override protected void onDestroy(){writer.shutdown();super.onDestroy();}
    protected void onFrameReady(RenderedSnapshot snapshot) { }
    protected void onImageSaved(RenderedSnapshot snapshot,Uri uri) { }
    protected void onExampleFailure(Throwable failure) { }
    protected final int completedFrameCount(){return completedFrame.get();}
    protected final RenderedSnapshot currentSnapshot(){return rendered;}

    public final class Probe extends PApplet {
        private boolean surfacePresentationPending;
        private final int edge;
        private AndroidFrameHost host;
        private RegionComposition model;
        private EditState modelState;
        private RenderedSnapshot pending;
        private RuntimeException pendingFailure;
        private long failedVersion=-1;
        private int compositions;
        Probe(int edge){this.edge=edge;}
        // The pinned Android2D cache restore needs its changed flag even when
        // Android resumes an unchanged surface. PApplet calls this before
        // restoreState()/resumeThread(); surfaceChanged() does not resize it.
        @Override public void resume(){if(g!=null)g.surfaceChanged();}
        /** A replacement SurfaceView can arrive after cached restoration stopped looping. */
        @Override public synchronized void surfaceChanged(){
            super.surfaceChanged();
            if(rendered!=null){surfacePresentationPending=true;redraw();}
        }
        @Override public void settings(){size(edge,edge,JAVA2D);}
        @Override public void setup(){host=new AndroidFrameHost(this);registerMethod("post",this);noLoop();}
        /** Style-only edits keep the exact retained composition; every effective
         * geometry edit rebuilds, mirroring the accepted Java PDE. */
        private RegionComposition modelFor(EditState state) {
            if(model==null||!modelState.sameGeometryAs(state)) {
                model=state.authored?RegionComposition.authored()
                    :RegionComposition.seeded(state.seed,state.replacements,state.fraction);
                modelState=state;
            }
            return model;
        }
        @Override public void draw(){
            EditState options=requested.get();
            RenderedSnapshot previous=rendered;
            if(displayValid&&previous!=null&&previous.options.version==options.version)return;
            try {
                RegionComposition retained=modelFor(options);
                RegionMarksRenderer.Result image=RegionMarksRenderer.render(
                    this,host,retained,options.gridMarks,options.alternate?ALTERNATE:BASE);
                RenderedSnapshot snapshot=new RenderedSnapshot(options,retained,image,++compositions);
                rendered=snapshot;displayValid=true;pending=snapshot;failedVersion=-1;
            }catch(RuntimeException failure){
                displayValid=false;failedVersion=options.version;
                if(previous!=null)requested.compareAndSet(options,previous.options);
                pendingFailure=failure;
            }
        }
        public void post(){
            completedFrame.set(frameCount+1);
            RenderedSnapshot snapshot=pending;pending=null;
            if(snapshot!=null)runOnUiThread(()->acknowledge(snapshot));
            RenderedSnapshot latest=rendered;
            EditState desired=requested.get();
            boolean retry=(!displayValid||latest==null||desired.version!=latest.options.version)
                &&desired.version!=failedVersion;
            if(retry)redraw();
            RuntimeException failure=pendingFailure;pendingFailure=null;
            if(failure!=null)reportDrawFailure(desired,retry,failure);
        }
        private void reportDrawFailure(EditState desired,boolean retry,RuntimeException failure){
            runOnUiThread(()->{
                if(isDestroyed()||requested.get().version!=desired.version)return;
                busy=retry;
                status.setText(retry?"Restoring previous image…":"Could not draw. Try another edit.");
                refreshControls();
                if(failure!=null)onExampleFailure(failure);
            });
        }
        @Override protected synchronized boolean handleSpecialDraw(){
            boolean handled=super.handleSpecialDraw();
            if(handled&&!isLooping()){
                RenderedSnapshot snapshot=rendered;
                if(displayValid&&snapshot!=null&&requested.get().version==snapshot.options.version)
                    runOnUiThread(()->acknowledge(snapshot));
                else{
                    EditState desired=requested.get();
                    if(desired.version!=failedVersion)redraw();
                    else reportDrawFailure(desired,false,null);
                }
            }
            if(!handled&&surfacePresentationPending){
                surfacePresentationPending=false;
                RenderedSnapshot snapshot=rendered;
                if(displayValid&&snapshot!=null&&requested.get().version==snapshot.options.version){
                    try{
                        org.procedurals.android.internal.AndroidSnapshotPresentation.present(this,snapshot.image.pngBytes());
                        redraw=false;
                    }finally{insideDraw=false;}
                    return true;
                }
            }
            return handled;
        }
    }
}
