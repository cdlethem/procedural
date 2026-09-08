package org.procedurals.examples.grainmarks;

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

/** Native editable GrainMarks UI. The shared GrainComposition retains geometry;
 * the Android renderer owns presentation inside the completed-frame callback. */
public class GrainMarksActivity extends FragmentActivity {
    private static final int[] BASE={0x173f5f,0x9b342f,0x176b60,0x634779,0x805515};
    private static final int[] ALTERNATE={0xba402f,0x344e75,0x6b4672,0x426d35,0x8c5221};

    /** Immutable UI-to-animation publication. forceRebuild applies only to reset. */
    public static final class EditState {
        public final long version,seed;
        public final double density;
        public final int distribution;
        public final boolean cells,strokes,alternate,forceRebuild;
        EditState(long version,long seed,double density,int distribution,boolean cells,
                  boolean strokes,boolean alternate,boolean forceRebuild) {
            this.version=version;this.seed=seed;this.density=density;this.distribution=distribution;
            this.cells=cells;this.strokes=strokes;this.alternate=alternate;this.forceRebuild=forceRebuild;
        }
        public static EditState initial(){return new EditState(0,42,.1d,0,false,false,false,false);}
        public EditState toggle(int control,long version) {
            long s=seed;double d=density;int b=distribution;boolean x=cells,m=strokes,c=alternate;
            boolean force=false;
            switch(control) {
            case 0:s=(seed+1)&0xffffffffL;break;
            case 1:d=density==.1d?.2d:.1d;break;
            case 2:b=(distribution+1)%3;break;
            case 3:x=!cells;break;
            case 4:m=!strokes;break;
            case 5:c=!alternate;break;
            case 6:return new EditState(version,42,.1d,0,false,false,false,true);
            default:throw new IllegalArgumentException("control");
            }
            return new EditState(version,s,d,b,x,m,c,force);
        }
        public boolean sameGeometryAs(EditState other) {
            return seed==other.seed&&Double.doubleToLongBits(density)==Double.doubleToLongBits(other.density)
                &&distribution==other.distribution&&cells==other.cells;
        }
        public String description() {
            String mode=distribution==0?"uniform":distribution==1?"vertex":"edge";
            return "Seed "+seed+" · density "+density+" · "+mode+(cells?" · cells":" · triangle")
                +(strokes?" · strokes":" · dots")+(alternate?" · alternate":" · base");
        }
    }

    public static final class RenderedSnapshot {
        public final EditState options; public final GrainComposition composition;
        public final GrainMarksRenderer.Result image; public final int compositionCount;
        RenderedSnapshot(EditState options,GrainComposition composition,GrainMarksRenderer.Result image,int count){
            this.options=options;this.composition=composition;this.image=image;this.compositionCount=count;
        }
    }

    protected Button seedButton,densityButton,distributionButton,cellsButton,motifButton,paletteButton,resetButton,saveButton;
    private TextView status;private FrameLayout viewport;private Probe probe;private View.OnLayoutChangeListener viewportListener;
    private final AtomicReference<EditState> requested=new AtomicReference<>(EditState.initial());
    private final AtomicInteger completedFrame=new AtomicInteger();
    private final ThreadPoolExecutor writer=new ThreadPoolExecutor(1,1,0,TimeUnit.SECONDS,
        new ArrayBlockingQueue<Runnable>(1),task->new Thread(task,"GrainMarks PNG writer"));
    private volatile RenderedSnapshot rendered;private volatile boolean displayValid;
    private boolean resumed,busy=true,saving;private long nextVersion;

    @Override public void onCreate(Bundle state){super.onCreate(state);
        LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(8),dp(8),dp(8),dp(8));page.setBackgroundColor(0xfff3f0e8);
        TextView title=new TextView(this);title.setText("Grain marks");title.setTextSize(20);title.setTextColor(0xff202027);page.addView(title);
        LinearLayout first=new LinearLayout(this);
        seedButton=button("Seed",first,()->edit(0));densityButton=button("Density",first,()->edit(1));distributionButton=button("Distribution",first,()->edit(2));cellsButton=button("Cells",first,()->edit(3));
        page.addView(first,new LinearLayout.LayoutParams(-1,dp(48)));
        LinearLayout second=new LinearLayout(this);
        motifButton=button("Motif",second,()->edit(4));paletteButton=button("Palette",second,()->edit(5));resetButton=button("Reset",second,()->edit(6));saveButton=button("Save PNG",second,this::saveCurrent);
        page.addView(second,new LinearLayout.LayoutParams(-1,dp(48)));
        status=new TextView(this);status.setText("Drawing…");status.setTextSize(12);status.setTextColor(0xff33333a);status.setGravity(Gravity.CENTER_VERTICAL);page.addView(status,new LinearLayout.LayoutParams(-1,dp(32)));
        viewport=new FrameLayout(this);viewport.setId(View.generateViewId());page.addView(viewport,new LinearLayout.LayoutParams(-1,0,1));setContentView(page);refreshControls();
        viewportListener=(view,l,t,r,b,ol,ot,or,ob)->attachViewport(viewport);viewport.addOnLayoutChangeListener(viewportListener);viewport.post(()->attachViewport(viewport));
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private Button button(String label,LinearLayout row,Runnable action){Button value=new Button(this);value.setText(label);value.setContentDescription(label);value.setTextSize(12);value.setAllCaps(false);value.setMinWidth(0);value.setMinimumWidth(0);value.setPadding(dp(3),0,dp(3),0);value.setOnClickListener(view->action.run());row.addView(value,new LinearLayout.LayoutParams(0,-1,1));return value;}
    private void attachViewport(FrameLayout target){if(isDestroyed()||isFinishing()||getSupportFragmentManager().isStateSaved()||probe!=null||target.getWidth()==0||target.getHeight()==0)return;int edge=Math.min(target.getWidth(),target.getHeight());Probe attached=new Probe(edge);new Android2DFragment(attached).setView(target,this);probe=attached;target.removeOnLayoutChangeListener(viewportListener);}
    private void refreshControls(){boolean ready=resumed&&!busy&&!saving;if(seedButton==null)return;EditState state=requested.get();seedButton.setContentDescription("Seed: "+state.seed);densityButton.setContentDescription("Density: "+state.density);distributionButton.setContentDescription("Distribution: "+state.distribution);cellsButton.setContentDescription("Cells: "+state.cells);motifButton.setContentDescription("Motif: "+(state.strokes?"strokes":"dots"));paletteButton.setContentDescription("Palette: "+(state.alternate?"alternate":"base"));resetButton.setContentDescription("Reset initial settings");for(Button button:new Button[]{seedButton,densityButton,distributionButton,cellsButton,motifButton,paletteButton,resetButton})button.setEnabled(ready);saveButton.setEnabled(ready&&rendered!=null&&displayValid);}
    private void edit(int control){
        EditState before=requested.get();
        if(!resumed||busy||saving||probe==null){onEditAttempt(control,false,before,before);return;}
        EditState next=before.toggle(control,nextVersion+1);nextVersion++;busy=true;requested.set(next);
        status.setText("Drawing…");refreshControls();onEditAttempt(control,true,before,next);probe.redraw();
    }
    private void acknowledge(RenderedSnapshot snapshot,String source){
        if(isDestroyed()||requested.get().version!=snapshot.options.version)return;
        busy=false;status.setText(snapshot.options.description());refreshControls();onAcknowledged(snapshot,source);onFrameReady(snapshot);
    }
    private void saveCurrent(){RenderedSnapshot snapshot=rendered;if(!resumed||busy||saving||snapshot==null||!displayValid)return;saving=true;refreshControls();status.setText("Saving PNG…");try{writer.execute(new SaveTask(getApplicationContext(),this,snapshot));}catch(RuntimeException failure){saveFinished(snapshot,null,failure);}}
    private void saveFinished(RenderedSnapshot snapshot,Uri uri,Throwable failure){if(isDestroyed())return;saving=false;status.setText(failure==null?"Saved to Pictures/Procedurals":"Could not save PNG. Try again.");refreshControls();if(failure==null)onImageSaved(snapshot,uri);else onExampleFailure(failure);}
    private static final class SaveTask implements Runnable {private final Context context;private final WeakReference<GrainMarksActivity> activity;private final RenderedSnapshot snapshot;SaveTask(Context context,GrainMarksActivity activity,RenderedSnapshot snapshot){this.context=context;this.activity=new WeakReference<>(activity);this.snapshot=snapshot;}public void run(){Uri uri=null;Throwable failure=null;try{uri=GalleryWriter.save(context,snapshot.image.pngBytes(),"grain-marks-"+snapshot.options.seed+"-"+System.currentTimeMillis()+".png");}catch(Exception error){failure=error;}final Uri saved=uri;final Throwable error=failure;GrainMarksActivity owner=activity.get();if(owner!=null&&!owner.isDestroyed())owner.runOnUiThread(()->{GrainMarksActivity current=activity.get();if(current!=null)current.saveFinished(snapshot,saved,error);});}}
    @Override protected void onResume(){super.onResume();resumed=true;busy=true;refreshControls();if(viewport!=null&&probe==null)viewport.post(()->attachViewport(viewport));if(viewport!=null)viewport.post(()->{RenderedSnapshot snapshot=rendered;if(resumed&&displayValid&&snapshot!=null&&requested.get().version==snapshot.options.version)acknowledge(snapshot,"resume-cache");});}
    @Override protected void onPause(){resumed=false;refreshControls();super.onPause();}
    @Override protected void onDestroy(){writer.shutdown();super.onDestroy();}
    protected void onFrameReady(RenderedSnapshot snapshot) { }
    /** Observer hook: exactly one UI acknowledgment is used for each cached resume. */
    protected void onAcknowledged(RenderedSnapshot snapshot,String source) { }
    /** Observer hook: records whether the normal UI edit gate accepted an input. */
    protected void onEditAttempt(int control,boolean accepted,EditState before,EditState after) { }
    protected void onImageSaved(RenderedSnapshot snapshot,Uri uri) { }
    protected void onExampleFailure(Throwable failure) { }
    protected final int completedFrameCount(){return completedFrame.get();}
    protected final RenderedSnapshot currentSnapshot(){return rendered;}

    public final class Probe extends PApplet {
        private boolean surfacePresentationPending;
        private final int edge;private AndroidFrameHost host;private GrainComposition model;private EditState modelState;private RenderedSnapshot pending;private RuntimeException pendingFailure;private long failedVersion=-1;private int compositions;
        Probe(int edge){this.edge=edge;}
        // The pinned Android2D cache restore needs its changed flag even when
        // Android resumes an unchanged surface. PApplet calls this before
        // restoreState()/resumeThread(); surfaceChanged() does not resize it.
        @Override public void resume(){if(g!=null)g.surfaceChanged();}
        /** A replacement SurfaceView can arrive after cached restoration stopped looping. */
        @Override public synchronized void surfaceChanged(){super.surfaceChanged();if(rendered!=null){surfacePresentationPending=true;redraw();}}
        @Override public void settings(){size(edge,edge,JAVA2D);}
        @Override public void setup(){host=new AndroidFrameHost(this);registerMethod("post",this);noLoop();}
        private GrainComposition modelFor(EditState state){if(model==null||state.forceRebuild||!modelState.sameGeometryAs(state)){model=GrainComposition.create(state.seed,state.density,state.distribution,state.cells);modelState=state;}return model;}
        @Override public void draw(){EditState options=requested.get();RenderedSnapshot previous=rendered;if(displayValid&&previous!=null&&previous.options.version==options.version)return;try{GrainComposition retained=modelFor(options);GrainMarksRenderer.Result image=GrainMarksRenderer.render(this,host,retained,options.strokes,options.alternate?ALTERNATE:BASE);RenderedSnapshot snapshot=new RenderedSnapshot(options,retained,image,++compositions);rendered=snapshot;displayValid=true;pending=snapshot;failedVersion=-1;}catch(RuntimeException failure){displayValid=false;failedVersion=options.version;if(previous!=null)requested.compareAndSet(options,previous.options);pendingFailure=failure;}}
        public void post(){completedFrame.set(frameCount+1);RenderedSnapshot snapshot=pending;pending=null;if(snapshot!=null)runOnUiThread(()->acknowledge(snapshot,"draw-post"));RenderedSnapshot latest=rendered;EditState desired=requested.get();boolean retry=(!displayValid||latest==null||desired.version!=latest.options.version)&&desired.version!=failedVersion;if(retry)redraw();RuntimeException failure=pendingFailure;pendingFailure=null;if(failure!=null)reportDrawFailure(desired,retry,failure);}
        private void reportDrawFailure(EditState desired,boolean retry,RuntimeException failure){runOnUiThread(()->{if(isDestroyed()||requested.get().version!=desired.version)return;busy=retry;status.setText(retry?"Restoring previous image…":"Could not draw. Try another edit.");refreshControls();if(failure!=null)onExampleFailure(failure);});}
        @Override protected synchronized boolean handleSpecialDraw(){boolean handled=super.handleSpecialDraw();if(handled&&!isLooping()){EditState desired=requested.get();RenderedSnapshot latest=rendered;boolean stale=!displayValid||latest==null||desired.version!=latest.options.version;if(stale){if(desired.version!=failedVersion)redraw();else reportDrawFailure(desired,false,null);}}if(!handled&&surfacePresentationPending){surfacePresentationPending=false;RenderedSnapshot snapshot=rendered;if(displayValid&&snapshot!=null&&requested.get().version==snapshot.options.version){try{org.procedurals.android.internal.AndroidSnapshotPresentation.present(this,snapshot.image.pngBytes());redraw=false;}finally{insideDraw=false;}return true;}}return handled;}
        @Override public void keyPressed(){char pressed=Character.toLowerCase(this.key);if(pressed=='s'){runOnUiThread(()->saveCurrent());return;}int control=pressed=='r'?0:pressed=='n'?1:pressed=='b'?2:pressed=='x'?3:pressed=='m'?4:pressed=='c'?5:pressed=='0'?6:-1;if(control>=0){final int chosen=control;runOnUiThread(()->edit(chosen));}}
    }
}
