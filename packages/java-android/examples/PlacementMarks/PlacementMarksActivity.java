package org.procedurals.examples.placementmarks;

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

/** Editable Android PlacementMarks example. Public arrangement is the shared
 * PlacementComposition; the button route mirrors the accepted Java PDE keymap
 * (R N X G I O M C S) with button toggles in place of key presses. */
public class PlacementMarksActivity extends FragmentActivity {
    private static final int[] BASE={0x31a151,0xffa71e,0x05084c,0xde4638,0x3dbdb7};
    private static final int[] ALTERNATE={0x2e0551,0xff00c7,0x01afc2,0xfdbe03,0xf4f9fd};

    /** Immutable control state. Toggle values describe this piece, not library defaults. */
    public static final class EditState {
        public final long version;
        public final long seed;
        public final int attempts;
        public final boolean radial;
        public final double separation;
        public final double minimum;
        public final double maximum;
        public final boolean diamonds;
        public final boolean alternate;
        EditState(long version,long seed,int attempts,boolean radial,double separation,
                  double minimum,double maximum,boolean diamonds,boolean alternate) {
            this.version=version;this.seed=seed;this.attempts=attempts;this.radial=radial;
            this.separation=separation;this.minimum=minimum;this.maximum=maximum;
            this.diamonds=diamonds;this.alternate=alternate;
        }
        public static EditState initial() {
            return new EditState(0,42L,5000,false,1.0d,4.0d,64.0d,false,false);
        }
        /** Mirrors the Java PDE keymap. Returns this same instance when the edit is
         * ignored (seed, budget, minimum, maximum while radial) so the caller performs
         * no rebuild and no redraw. */
        public EditState toggle(int control,long newVersion) {
            switch(control) {
            case 0: return radial?this:new EditState(newVersion,(seed+1)&0xffffffffL,attempts,radial,separation,minimum,maximum,diamonds,alternate);
            case 1: return radial?this:new EditState(newVersion,seed,attempts==5000?10000:5000,radial,separation,minimum,maximum,diamonds,alternate);
            case 2: return new EditState(newVersion,seed,attempts,!radial,separation,minimum,maximum,diamonds,alternate);
            case 3: return new EditState(newVersion,seed,attempts,radial,separation==1.0d?1.2d:1.0d,minimum,maximum,diamonds,alternate);
            case 4: return radial?this:new EditState(newVersion,seed,attempts,radial,separation,minimum==4.0d?8.0d:4.0d,maximum,diamonds,alternate);
            case 5: return radial?this:new EditState(newVersion,seed,attempts,radial,separation,minimum,maximum==64.0d?32.0d:64.0d,diamonds,alternate);
            case 6: return new EditState(newVersion,seed,attempts,radial,separation,minimum,maximum,!diamonds,alternate);
            case 7: return new EditState(newVersion,seed,attempts,radial,separation,minimum,maximum,diamonds,!alternate);
            default: throw new IllegalArgumentException("control");
            }
        }
        /** Geometry identity of the retained composition. Style-only edits leave it unchanged. */
        public boolean sameGeometryAs(EditState other) {
            return radial==other.radial&&seed==other.seed&&attempts==other.attempts
                &&Double.doubleToLongBits(separation)==Double.doubleToLongBits(other.separation)
                &&Double.doubleToLongBits(minimum)==Double.doubleToLongBits(other.minimum)
                &&Double.doubleToLongBits(maximum)==Double.doubleToLongBits(other.maximum);
        }
        public String description() {
            return (radial?"Radial":"Seed "+seed+" · "+attempts)
                +" · scale "+separation
                +(radial?"":" · radii "+minimum+"–"+maximum)
                +" · "+(diamonds?"Diamonds":"Rings")+" · "+(alternate?"Alternate":"Base");
        }
    }

    public static final class RenderedSnapshot {
        public final EditState options;
        public final PlacementComposition composition;
        public final PlacementMarksRenderer.Result image;
        public final int compositionCount;
        RenderedSnapshot(EditState options,PlacementComposition composition,
                         PlacementMarksRenderer.Result image,int compositionCount) {
            this.options=options;this.composition=composition;this.image=image;this.compositionCount=compositionCount;
        }
    }

    protected Button seedButton,budgetButton,sourceButton,separationButton,minButton;
    protected Button maxButton,motifButton,paletteButton,saveButton;
    private TextView status; private FrameLayout viewport; private Probe probe;
    private View.OnLayoutChangeListener viewportListener;
    private final AtomicReference<EditState> requested=new AtomicReference<>(EditState.initial());
    private final AtomicInteger completedFrame=new AtomicInteger();
    private final ThreadPoolExecutor writer=new ThreadPoolExecutor(1,1,0,TimeUnit.SECONDS,
        new ArrayBlockingQueue<Runnable>(1),task -> new Thread(task,"PlacementMarks PNG writer"));
    private volatile RenderedSnapshot rendered; private volatile boolean displayValid;
    private boolean resumed,busy=true,saving; private long nextVersion;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(8),dp(8),dp(8),dp(8));page.setBackgroundColor(0xffece7da);
        TextView title=new TextView(this);title.setText("Placement marks");title.setTextSize(20);
        title.setTextColor(0xff202027);page.addView(title);
        LinearLayout firstRow=new LinearLayout(this);
        seedButton=button("Seed",firstRow,()->edit(0));budgetButton=button("Budget",firstRow,()->edit(1));
        sourceButton=button("Source",firstRow,()->edit(2));separationButton=button("Separation",firstRow,()->edit(3));
        minButton=button("Min",firstRow,()->edit(4));
        page.addView(firstRow,new LinearLayout.LayoutParams(-1,dp(48)));
        LinearLayout secondRow=new LinearLayout(this);
        maxButton=button("Max",secondRow,()->edit(5));motifButton=button("Motif",secondRow,()->edit(6));
        paletteButton=button("Palette",secondRow,()->edit(7));
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
        seedButton.setContentDescription("Seed: "+(state.radial?"ignored":state.seed));
        budgetButton.setContentDescription("Budget: "+(state.radial?"ignored":state.attempts));
        sourceButton.setContentDescription("Source: "+(state.radial?"radial":"seeded"));
        separationButton.setContentDescription("Separation: "+state.separation);
        minButton.setContentDescription("Min: "+(state.radial?"ignored":state.minimum));
        maxButton.setContentDescription("Max: "+(state.radial?"ignored":state.maximum));
        motifButton.setContentDescription("Motif: "+(state.diamonds?"diamonds":"rings"));
        paletteButton.setContentDescription("Palette: "+(state.alternate?"alternate":"base"));
        for(Button button:new Button[]{seedButton,budgetButton,sourceButton,separationButton,minButton,maxButton,motifButton,paletteButton})
            button.setEnabled(ready);
        saveButton.setEnabled(ready&&rendered!=null&&displayValid);
    }
    private void edit(int choice) {
        if(!resumed||busy||saving||probe==null)return;
        EditState old=requested.get();
        EditState next=old.toggle(choice,nextVersion+1);
        if(next==old)return; // Ignored while radial: no rebuild, no redraw, same revision.
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
        private final WeakReference<PlacementMarksActivity> activity;
        private final RenderedSnapshot snapshot;
        SaveTask(Context context,PlacementMarksActivity activity,RenderedSnapshot snapshot){
            this.context=context;this.activity=new WeakReference<>(activity);this.snapshot=snapshot;
        }
        @Override public void run() {
            Uri uri=null;Throwable failure=null;
            try{uri=GalleryWriter.save(context,snapshot.image.pngBytes(),
                "placement-marks-42-"+System.currentTimeMillis()+".png");}
            catch(Exception error){failure=error;}
            final Uri saved=uri;final Throwable error=failure;
            PlacementMarksActivity owner=activity.get();
            if(owner!=null&&!owner.isDestroyed())owner.runOnUiThread(()->{
                PlacementMarksActivity current=activity.get();
                if(current!=null)current.saveFinished(snapshot,saved,error);
            });
        }
    }

    @Override protected void onResume(){super.onResume();resumed=true;busy=true;refreshControls();
        if(viewport!=null&&probe==null)viewport.post(()->attachViewport(viewport));}
    @Override protected void onPause(){resumed=false;refreshControls();super.onPause();}
    @Override protected void onDestroy(){writer.shutdown();super.onDestroy();}
    protected void onFrameReady(RenderedSnapshot snapshot) { }
    protected void onImageSaved(RenderedSnapshot snapshot,Uri uri) { }
    protected void onExampleFailure(Throwable failure) { }
    protected final int completedFrameCount(){return completedFrame.get();}
    protected final RenderedSnapshot currentSnapshot(){return rendered;}

    public final class Probe extends PApplet {
        private final int edge;
        private AndroidFrameHost host;
        private PlacementComposition model;
        private EditState modelState;
        private RenderedSnapshot pending;
        private RuntimeException pendingFailure;
        private long failedVersion=-1;
        private int compositions;
        Probe(int edge){this.edge=edge;}
        @Override public void resume(){if(g!=null)g.surfaceChanged();}
        private boolean surfacePresentationPending;
        @Override public synchronized void surfaceChanged(){super.surfaceChanged();if(rendered!=null){surfacePresentationPending=true;redraw();}}
        @Override public void settings(){size(edge,edge,JAVA2D);}
        @Override public void setup(){host=new AndroidFrameHost(this);registerMethod("post",this);noLoop();}
        /** Style-only edits keep the exact retained composition; every effective
         * geometry edit rebuilds, mirroring the accepted Java PDE. */
        private PlacementComposition modelFor(EditState state) {
            if(model==null||!modelState.sameGeometryAs(state)) {
                model=state.radial?PlacementComposition.radial(state.separation)
                    :PlacementComposition.seeded(state.seed,state.attempts,state.minimum,state.maximum,state.separation);
                modelState=state;
            }
            return model;
        }
        @Override public void draw(){
            EditState options=requested.get();
            RenderedSnapshot previous=rendered;
            if(displayValid&&previous!=null&&previous.options.version==options.version)return;
            try {
                PlacementComposition retained=modelFor(options);
                PlacementMarksRenderer.Result image=PlacementMarksRenderer.render(
                    this,host,retained,options.diamonds,options.alternate?ALTERNATE:BASE);
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
                    try{org.procedurals.android.internal.AndroidSnapshotPresentation.present(this,snapshot.image.pngBytes());redraw=false;}
                    finally{insideDraw=false;}
                    return true;
                }
            }
            return handled;
        }
    }
}
