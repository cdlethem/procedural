package org.procedurals.examples.pathmarks;

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

/** Editable Android CP2 example. Public movement is shared PathMarkComposition. */
public class PathMarksActivity extends FragmentActivity {
    private static final int[] BASE={0x31a151,0xffa71e,0x05084c,0xde4638,0x3dbdb7};
    private static final int[] ALTERNATE={0x2e0551,0xff00c7,0x01afc2,0xfdbe03,0xf4f9fd};

    public static final class EditState {
        public final long version; public final boolean trace,longer,alternate,more,farther;
        EditState(long version,boolean trace,boolean longer,boolean alternate,boolean more,boolean farther) {
            this.version=version;this.trace=trace;this.longer=longer;this.alternate=alternate;this.more=more;this.farther=farther;
        }
        public int steps() { return more?2001:2000; }
        public double distance() { return farther?.8:.4; }
        public double markLength() { return longer?24:12; }
        public boolean movementChanged(EditState other) { return steps()!=other.steps() || distance()!=other.distance(); }
        public String description() { return (trace?"Trace":"Marks")+" · Length "+(longer?24:12)+" · "+
            (alternate?"Alternate":"Base")+" · "+steps()+" steps · "+distance(); }
    }
    public static final class RenderedSnapshot {
        public final EditState options; public final PathMarkComposition movement; public final PathMarksRenderer.Result image; public final int compositionCount;
        RenderedSnapshot(EditState options,PathMarkComposition movement,PathMarksRenderer.Result image,int compositionCount) {
            this.options=options;this.movement=movement;this.image=image;this.compositionCount=compositionCount;
        }
    }

    protected Button modeButton,lengthButton,paletteButton,countButton,distanceButton,saveButton;
    private TextView status; private FrameLayout viewport; private Probe probe; private View.OnLayoutChangeListener viewportListener;
    private final AtomicReference<EditState> requested=new AtomicReference<>(new EditState(0,false,false,false,false,false));
    private final AtomicInteger completedFrame=new AtomicInteger();
    private final ThreadPoolExecutor writer=new ThreadPoolExecutor(1,1,0,TimeUnit.SECONDS,
        new ArrayBlockingQueue<Runnable>(1),task -> new Thread(task,"PathMarks PNG writer"));
    private volatile RenderedSnapshot rendered; private volatile boolean displayValid;
    private boolean resumed,busy=true,saving; private long nextVersion;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout page=new LinearLayout(this);page.setOrientation(LinearLayout.VERTICAL);page.setPadding(dp(8),dp(8),dp(8),dp(8));page.setBackgroundColor(0xffece7da);
        TextView title=new TextView(this);title.setText("Path marks");title.setTextSize(20);title.setTextColor(0xff202027);page.addView(title);
        LinearLayout controls=new LinearLayout(this);
        modeButton=button("Mode",controls,()->edit(0));lengthButton=button("Length",controls,()->edit(1));paletteButton=button("Palette",controls,()->edit(2));
        countButton=button("Count",controls,()->edit(3));distanceButton=button("Distance",controls,()->edit(4));saveButton=button("Save PNG",controls,this::saveCurrent);
        page.addView(controls,new LinearLayout.LayoutParams(-1,dp(48)));
        status=new TextView(this);status.setText("Drawing…");status.setTextSize(12);status.setTextColor(0xff33333a);status.setGravity(Gravity.CENTER_VERTICAL);page.addView(status,new LinearLayout.LayoutParams(-1,dp(32)));
        viewport=new FrameLayout(this);viewport.setId(View.generateViewId());page.addView(viewport,new LinearLayout.LayoutParams(-1,0,1));setContentView(page);refreshControls();
        viewportListener=(view,left,top,right,bottom,oldLeft,oldTop,oldRight,oldBottom)->attachViewport(viewport);
        viewport.addOnLayoutChangeListener(viewportListener);viewport.post(()->attachViewport(viewport));
    }
    private int dp(int value) { return Math.round(value*getResources().getDisplayMetrics().density); }
    private Button button(String label,LinearLayout row,Runnable action) { Button button=new Button(this);button.setText(label);button.setContentDescription(label);button.setTextSize(12);button.setAllCaps(false);button.setMinWidth(0);button.setMinimumWidth(0);button.setPadding(dp(3),0,dp(3),0);button.setOnClickListener(view->action.run());row.addView(button,new LinearLayout.LayoutParams(0,-1,1));return button; }
    private void attachViewport(FrameLayout target) { if(isDestroyed()||isFinishing()||getSupportFragmentManager().isStateSaved()||probe!=null||target.getWidth()==0||target.getHeight()==0)return;int edge=Math.min(target.getWidth(),target.getHeight());Probe attached=new Probe(edge);new Android2DFragment(attached).setView(target,this);probe=attached;target.removeOnLayoutChangeListener(viewportListener); }
    private void refreshControls() { boolean ready=resumed&&!busy&&!saving; if(modeButton==null)return;EditState state=requested.get();modeButton.setContentDescription("Mode: "+(state.trace?"trace":"marks"));lengthButton.setContentDescription("Length: "+state.markLength());paletteButton.setContentDescription("Palette: "+(state.alternate?"alternate":"base"));countButton.setContentDescription("Count: "+state.steps());distanceButton.setContentDescription("Distance: "+state.distance());for(Button button:new Button[]{modeButton,lengthButton,paletteButton,countButton,distanceButton})button.setEnabled(ready);saveButton.setEnabled(ready&&rendered!=null&&displayValid); }
    private void edit(int choice) { if(!resumed||busy||saving||probe==null)return;busy=true;refreshControls();EditState old=requested.get();EditState next=new EditState(++nextVersion,choice==0?!old.trace:old.trace,choice==1?!old.longer:old.longer,choice==2?!old.alternate:old.alternate,choice==3?!old.more:old.more,choice==4?!old.farther:old.farther);requested.set(next);status.setText("Drawing…");probe.redraw(); }
    private void acknowledge(RenderedSnapshot snapshot) { if(isDestroyed()||requested.get().version!=snapshot.options.version)return;busy=false;status.setText(snapshot.options.description());refreshControls();onFrameReady(snapshot); }
    private void saveCurrent() { RenderedSnapshot snapshot=rendered;if(!resumed||busy||saving||snapshot==null||!displayValid)return;saving=true;refreshControls();status.setText("Saving PNG…");try{writer.execute(new SaveTask(getApplicationContext(),this,snapshot));}catch(RuntimeException failure){saveFinished(snapshot,null,failure);} }
    private void saveFinished(RenderedSnapshot snapshot,Uri uri,Throwable failure) { if(isDestroyed())return;saving=false;status.setText(failure==null?"Saved to Pictures/Procedurals":"Could not save PNG. Try again.");refreshControls();if(failure==null)onImageSaved(snapshot,uri);else onExampleFailure(failure); }
    private static final class SaveTask implements Runnable { private final Context context;private final WeakReference<PathMarksActivity> activity;private final RenderedSnapshot snapshot;SaveTask(Context context,PathMarksActivity activity,RenderedSnapshot snapshot){this.context=context;this.activity=new WeakReference<>(activity);this.snapshot=snapshot;}public void run(){Uri uri=null;Throwable failure=null;try{uri=GalleryWriter.save(context,snapshot.image.pngBytes(),"path-marks-42-"+System.currentTimeMillis()+".png");}catch(Exception error){failure=error;}final Uri saved=uri;final Throwable error=failure;PathMarksActivity owner=activity.get();if(owner!=null&&!owner.isDestroyed())owner.runOnUiThread(()->{PathMarksActivity current=activity.get();if(current!=null)current.saveFinished(snapshot,saved,error);});} }
    @Override protected void onResume(){super.onResume();resumed=true;busy=true;refreshControls();if(viewport!=null&&probe==null)viewport.post(()->attachViewport(viewport));}
    @Override protected void onPause(){resumed=false;refreshControls();super.onPause();}
    @Override protected void onDestroy(){writer.shutdown();super.onDestroy();}
    protected void onFrameReady(RenderedSnapshot snapshot) { }
    protected void onImageSaved(RenderedSnapshot snapshot,Uri uri) { }
    protected void onExampleFailure(Throwable failure) { }
    protected final int completedFrameCount(){return completedFrame.get();}
    protected final RenderedSnapshot currentSnapshot(){return rendered;}

    public final class Probe extends PApplet {
        private final int edge;private AndroidFrameHost host;private PathMarkComposition model;private int modelSteps=-1;private double modelDistance=Double.NaN;private RenderedSnapshot pending;private RuntimeException pendingFailure;private long failedVersion=-1;private int compositions;
        Probe(int edge){this.edge=edge;}@Override public void settings(){size(edge,edge,JAVA2D);}
        @Override public void setup(){host=new AndroidFrameHost(this);registerMethod("post",this);noLoop();}
        private PathMarkComposition modelFor(EditState state){if(model==null||modelSteps!=state.steps()||Double.doubleToLongBits(modelDistance)!=Double.doubleToLongBits(state.distance())){model=PathMarkComposition.create(42,state.steps(),state.distance());modelSteps=state.steps();modelDistance=state.distance();}return model;}
        @Override public void draw(){EditState options=requested.get();RenderedSnapshot previous=rendered;if(displayValid&&previous!=null&&previous.options.version==options.version)return;try{PathMarkComposition retained=modelFor(options);PathMarksRenderer.Result image=PathMarksRenderer.render(this,host,retained,options.trace,options.markLength(),options.alternate?ALTERNATE:BASE);RenderedSnapshot snapshot=new RenderedSnapshot(options,retained,image,++compositions);rendered=snapshot;displayValid=true;pending=snapshot;failedVersion=-1;}catch(RuntimeException failure){displayValid=false;failedVersion=options.version;if(previous!=null)requested.compareAndSet(options,previous.options);pendingFailure=failure;}}
        public void post(){completedFrame.set(frameCount+1);RenderedSnapshot snapshot=pending;pending=null;if(snapshot!=null)runOnUiThread(()->acknowledge(snapshot));RenderedSnapshot latest=rendered;EditState desired=requested.get();boolean retry=(!displayValid||latest==null||desired.version!=latest.options.version)&&desired.version!=failedVersion;if(retry)redraw();RuntimeException failure=pendingFailure;pendingFailure=null;if(failure!=null)reportDrawFailure(desired,retry,failure);}
        private void reportDrawFailure(EditState desired,boolean retry,RuntimeException failure){runOnUiThread(()->{if(isDestroyed()||requested.get().version!=desired.version)return;busy=retry;status.setText(retry?"Restoring previous image…":"Could not draw. Try another edit.");refreshControls();if(failure!=null)onExampleFailure(failure);});}
        @Override protected boolean handleSpecialDraw(){boolean handled=super.handleSpecialDraw();if(handled&&!isLooping()){RenderedSnapshot snapshot=rendered;if(displayValid&&snapshot!=null&&requested.get().version==snapshot.options.version)runOnUiThread(()->acknowledge(snapshot));else{EditState desired=requested.get();if(desired.version!=failedVersion)redraw();else reportDrawFailure(desired,false,null);}}return handled;}
    }
}
