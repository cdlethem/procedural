package org.procedurals.examples.branchmarks;

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

/** Native editable BranchMarks UI. The shared BranchComposition retains geometry;
 * the Android renderer owns presentation inside the completed-frame callback. */
public class BranchMarksActivity extends FragmentActivity {
    private static final int[] BASE={0x183e4a,0x225b60,0x347969,0xaf5441};
    private static final int[] ALTERNATE={0x443d65,0x765075,0xa96962,0xbb793e};

    /** Immutable UI-to-animation publication. forceRebuild applies only to reset. */
    public static final class EditState {
        public final long version,seed;
        public final boolean more,narrowing,wider,binary,forest,taper,alternate,forceRebuild;
        EditState(long version,long seed,boolean more,boolean narrowing,boolean wider,boolean binary,boolean forest,boolean taper,boolean alternate,boolean forceRebuild) {
            this.version=version;this.seed=seed;this.more=more;this.narrowing=narrowing;this.wider=wider;this.binary=binary;this.forest=forest;this.taper=taper;this.alternate=alternate;this.forceRebuild=forceRebuild;
        }
        public static EditState initial(){return new EditState(0,42,false,false,false,false,false,true,false,false);}
        public EditState toggle(int control,long version) {
            long s=seed;boolean n=more,g=narrowing,w=wider,b=binary,x=forest,m=taper,c=alternate;boolean force=false;
            switch(control) {case 0:s=(seed+1)&0xffffffffL;break;case 1:n=!more;break;case 2:g=!narrowing;break;case 3:w=!wider;break;case 4:b=!binary;break;case 5:x=!forest;break;case 6:m=!taper;break;case 7:c=!alternate;break;case 8:return new EditState(version,42,false,false,false,false,false,true,false,true);default:throw new IllegalArgumentException("control");}
            return new EditState(version,s,n,g,w,b,x,m,c,force);
        }
        public boolean sameGeometryAs(EditState other) {return seed==other.seed&&more==other.more&&narrowing==other.narrowing&&wider==other.wider&&binary==other.binary&&forest==other.forest;}
        public String description() {return "Seed "+seed+(more?" · more":"")+(narrowing?" · narrow":"")+(wider?" · wide":"")+(binary?" · binary":"")+(forest?" · forest":"")+(taper?" · taper":" · thin")+(alternate?" · alternate":" · base");}
    }

    public static final class RenderedSnapshot {
        public final EditState options; public final BranchComposition composition;
        public final BranchMarksRenderer.Result image; public final int compositionCount;
        RenderedSnapshot(EditState options,BranchComposition composition,BranchMarksRenderer.Result image,int count){
            this.options=options;this.composition=composition;this.image=image;this.compositionCount=count;
        }
    }

    protected Button seedButton,moreButton,narrowingButton,widerButton,binaryButton,forestButton,motifButton,paletteButton,resetButton,saveButton;
    private TextView status;private FrameLayout viewport;private Probe probe;private View.OnLayoutChangeListener viewportListener;
    private final AtomicReference<EditState> requested=new AtomicReference<>(EditState.initial());
    private final AtomicInteger completedFrame=new AtomicInteger();
    private final ThreadPoolExecutor writer=new ThreadPoolExecutor(1,1,0,TimeUnit.SECONDS,
        new ArrayBlockingQueue<Runnable>(1),task->new Thread(task,"BranchMarks PNG writer"));
    private volatile RenderedSnapshot rendered;private volatile boolean displayValid;
    private boolean resumed,busy=true,saving;private long nextVersion;

    @Override public void onCreate(Bundle state){super.onCreate(state);
        LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(8),dp(8),dp(8),dp(8));page.setBackgroundColor(0xfff3f0e8);
        TextView title=new TextView(this);title.setText("Branch marks");title.setTextSize(20);title.setTextColor(0xff202027);page.addView(title);
        LinearLayout first=new LinearLayout(this);
        seedButton=button("Seed",first,()->edit(0));moreButton=button("More",first,()->edit(1));narrowingButton=button("Narrow",first,()->edit(2));widerButton=button("Wide",first,()->edit(3));
        page.addView(first,new LinearLayout.LayoutParams(-1,dp(48)));
        LinearLayout second=new LinearLayout(this);
        binaryButton=button("Binary",second,()->edit(4));forestButton=button("Forest",second,()->edit(5));motifButton=button("Taper",second,()->edit(6));paletteButton=button("Palette",second,()->edit(7));
        page.addView(second,new LinearLayout.LayoutParams(-1,dp(48)));
        LinearLayout third=new LinearLayout(this);resetButton=button("Reset",third,()->edit(8));saveButton=button("Save PNG",third,this::saveCurrent);page.addView(third,new LinearLayout.LayoutParams(-1,dp(48)));
        status=new TextView(this);status.setText("Drawing…");status.setTextSize(12);status.setTextColor(0xff33333a);status.setGravity(Gravity.CENTER_VERTICAL);page.addView(status,new LinearLayout.LayoutParams(-1,dp(32)));
        viewport=new FrameLayout(this);viewport.setId(View.generateViewId());page.addView(viewport,new LinearLayout.LayoutParams(-1,0,1));setContentView(page);refreshControls();
        viewportListener=(view,l,t,r,b,ol,ot,or,ob)->attachViewport(viewport);viewport.addOnLayoutChangeListener(viewportListener);viewport.post(()->attachViewport(viewport));
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private Button button(String label,LinearLayout row,Runnable action){Button value=new Button(this);value.setText(label);value.setContentDescription(label);value.setTextSize(12);value.setAllCaps(false);value.setMinWidth(0);value.setMinimumWidth(0);value.setPadding(dp(3),0,dp(3),0);value.setOnClickListener(view->action.run());row.addView(value,new LinearLayout.LayoutParams(0,-1,1));return value;}
    private void attachViewport(FrameLayout target){if(isDestroyed()||isFinishing()||getSupportFragmentManager().isStateSaved()||probe!=null||target.getWidth()==0||target.getHeight()==0)return;int edge=Math.min(target.getWidth(),target.getHeight());Probe attached=new Probe(edge);new Android2DFragment(attached).setView(target,this);probe=attached;target.removeOnLayoutChangeListener(viewportListener);}
    private void refreshControls(){boolean ready=resumed&&!busy&&!saving;if(seedButton==null)return;EditState state=requested.get();seedButton.setContentDescription("Seed: "+state.seed);moreButton.setContentDescription("More: "+state.more);narrowingButton.setContentDescription("Narrow: "+state.narrowing);widerButton.setContentDescription("Wide: "+state.wider);binaryButton.setContentDescription("Binary: "+state.binary);forestButton.setContentDescription("Forest: "+state.forest);motifButton.setContentDescription("Taper: "+state.taper);paletteButton.setContentDescription("Palette: "+(state.alternate?"alternate":"base"));resetButton.setContentDescription("Reset initial settings");for(Button button:new Button[]{seedButton,moreButton,narrowingButton,widerButton,binaryButton,forestButton,motifButton,paletteButton,resetButton})button.setEnabled(ready);saveButton.setEnabled(ready&&rendered!=null&&displayValid);}
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
    private static final class SaveTask implements Runnable {private final Context context;private final WeakReference<BranchMarksActivity> activity;private final RenderedSnapshot snapshot;SaveTask(Context context,BranchMarksActivity activity,RenderedSnapshot snapshot){this.context=context;this.activity=new WeakReference<>(activity);this.snapshot=snapshot;}public void run(){Uri uri=null;Throwable failure=null;try{uri=GalleryWriter.save(context,snapshot.image.pngBytes(),"branch-marks-"+snapshot.options.seed+"-"+System.currentTimeMillis()+".png");}catch(Exception error){failure=error;}final Uri saved=uri;final Throwable error=failure;BranchMarksActivity owner=activity.get();if(owner!=null&&!owner.isDestroyed())owner.runOnUiThread(()->{BranchMarksActivity current=activity.get();if(current!=null)current.saveFinished(snapshot,saved,error);});}}
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
        private final int edge;private AndroidFrameHost host;private BranchComposition model;private EditState modelState;private RenderedSnapshot pending;private RuntimeException pendingFailure;private long failedVersion=-1;private int compositions;
        Probe(int edge){this.edge=edge;}
        // The pinned Android2D cache restore needs its changed flag even when
        // Android resumes an unchanged surface. PApplet calls this before
        // restoreState()/resumeThread(); surfaceChanged() does not resize it.
        @Override public void resume(){if(g!=null)g.surfaceChanged();}
        @Override public void settings(){size(edge,edge,JAVA2D);}
        @Override public void setup(){host=new AndroidFrameHost(this);registerMethod("post",this);noLoop();}
        private BranchComposition modelFor(EditState state){if(model==null||state.forceRebuild||!modelState.sameGeometryAs(state)){model=BranchComposition.create(state.seed,state.more,state.narrowing,state.binary,state.wider,state.forest);modelState=state;}return model;}
        @Override public void draw(){EditState options=requested.get();RenderedSnapshot previous=rendered;if(displayValid&&previous!=null&&previous.options.version==options.version)return;try{BranchComposition retained=modelFor(options);BranchMarksRenderer.Result image=BranchMarksRenderer.render(this,host,retained,options.taper,options.alternate?ALTERNATE:BASE);RenderedSnapshot snapshot=new RenderedSnapshot(options,retained,image,++compositions);rendered=snapshot;displayValid=true;pending=snapshot;failedVersion=-1;}catch(RuntimeException failure){displayValid=false;failedVersion=options.version;if(previous!=null)requested.compareAndSet(options,previous.options);pendingFailure=failure;}}
        public void post(){completedFrame.set(frameCount+1);RenderedSnapshot snapshot=pending;pending=null;if(snapshot!=null)runOnUiThread(()->acknowledge(snapshot,"draw-post"));RenderedSnapshot latest=rendered;EditState desired=requested.get();boolean retry=(!displayValid||latest==null||desired.version!=latest.options.version)&&desired.version!=failedVersion;if(retry)redraw();RuntimeException failure=pendingFailure;pendingFailure=null;if(failure!=null)reportDrawFailure(desired,retry,failure);}
        private void reportDrawFailure(EditState desired,boolean retry,RuntimeException failure){runOnUiThread(()->{if(isDestroyed()||requested.get().version!=desired.version)return;busy=retry;status.setText(retry?"Restoring previous image…":"Could not draw. Try another edit.");refreshControls();if(failure!=null)onExampleFailure(failure);});}
        @Override protected boolean handleSpecialDraw(){boolean handled=super.handleSpecialDraw();if(handled&&!isLooping()){EditState desired=requested.get();RenderedSnapshot latest=rendered;boolean stale=!displayValid||latest==null||desired.version!=latest.options.version;if(stale){if(desired.version!=failedVersion)redraw();else reportDrawFailure(desired,false,null);}}return handled;}
        @Override public void keyPressed(){char pressed=Character.toLowerCase(this.key);if(pressed=='s'){runOnUiThread(()->saveCurrent());return;}int control=pressed=='r'?0:pressed=='n'?1:pressed=='g'?2:pressed=='w'?3:pressed=='b'?4:pressed=='x'?5:pressed=='m'?6:pressed=='c'?7:pressed=='0'?8:-1;if(control>=0){final int chosen=control;runOnUiThread(()->edit(chosen));}}
    }
}
