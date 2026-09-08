package org.procedurals.examples.fieldmarks;

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
import processing.core.PApplet;

/** Editable native example. Values are deliberate CP1 choices, not recommended ranges. */
public class FieldMarksActivity extends FragmentActivity {
    private static final Integer[] ORIGINAL = {0x31a151, 0xffa71e, 0x05084c, 0xde4638, 0x3dbdb7};
    private static final Integer[] NEON = {0x2e0551, 0xff00c7, 0x01afc2, 0xfdbe03, 0xf4f9fd};

    public static final class EditState {
        public final long version;
        public final boolean longer, neon, bars;
        EditState(long version, boolean longer, boolean neon, boolean bars) {
            this.version=version; this.longer=longer; this.neon=neon; this.bars=bars;
        }
        public double maxLength() { return longer ? 32 : 16; }
        public String description() {
            return "Length " + (longer ? "32" : "16") + " · " + (neon ? "Neon" : "Original") +
                " · " + (bars ? "Bars" : "Lines");
        }
    }

    public static final class RenderedSnapshot {
        public final EditState options;
        public final FieldMarksRenderer.Result image;
        public final int compositionCount;
        RenderedSnapshot(EditState options, FieldMarksRenderer.Result image, int count) {
            this.options=options; this.image=image; this.compositionCount=count;
        }
    }

    protected Button lengthButton, paletteButton, marksButton, saveButton;
    private TextView status;
    private final AtomicReference<EditState> requested =
        new AtomicReference<>(new EditState(0, false, false, false));
    private volatile RenderedSnapshot rendered;
    private volatile boolean displayValid;
    private final AtomicInteger completedFrame = new AtomicInteger();
    private final ThreadPoolExecutor writer = new ThreadPoolExecutor(1, 1, 0, TimeUnit.SECONDS,
        new ArrayBlockingQueue<Runnable>(1), task -> new Thread(task, "FieldMarks PNG writer"));
    private Probe probe;
    private FrameLayout viewport;
    private View.OnLayoutChangeListener viewportListener;
    private boolean resumed, busy = true, saving;
    private long nextVersion;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setPadding(dp(8), dp(8), dp(8), dp(8));
        page.setBackgroundColor(0xffece7da);
        TextView title = new TextView(this);
        title.setText("Field marks"); title.setTextSize(20); title.setTextColor(0xff202027);
        page.addView(title);
        LinearLayout controls = new LinearLayout(this);
        lengthButton=button("Length", controls, () -> edit(0));
        paletteButton=button("Palette", controls, () -> edit(1));
        marksButton=button("Marks", controls, () -> edit(2));
        saveButton=button("Save PNG", controls, this::saveCurrent);
        page.addView(controls, new LinearLayout.LayoutParams(-1, dp(48)));
        status = new TextView(this);
        status.setText("Drawing…"); status.setTextSize(12); status.setTextColor(0xff33333a);
        status.setGravity(Gravity.CENTER_VERTICAL);
        page.addView(status, new LinearLayout.LayoutParams(-1, dp(32)));
        viewport = new FrameLayout(this);
        viewport.setId(View.generateViewId());
        page.addView(viewport, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(page);
        refreshControls();
        viewportListener=(view, left, top, right, bottom,
            oldLeft, oldTop, oldRight, oldBottom) -> attachViewport(viewport);
        viewport.addOnLayoutChangeListener(viewportListener);
        viewport.post(() -> attachViewport(viewport));
    }

    private void attachViewport(FrameLayout viewport) {
        if (isDestroyed() || isFinishing() || getSupportFragmentManager().isStateSaved() ||
            probe != null || viewport.getWidth() == 0 || viewport.getHeight() == 0) return;
        int edge=Math.min(viewport.getWidth(), viewport.getHeight());
        Probe attached = new Probe(edge);
        new Android2DFragment(attached).setView(viewport, this);
        probe = attached;
        viewport.removeOnLayoutChangeListener(viewportListener);
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private Button button(String label, LinearLayout row, Runnable action) {
        Button button = new Button(this);
        button.setText(label); button.setContentDescription(label); button.setTextSize(12);
        button.setAllCaps(false); button.setMinWidth(0); button.setMinimumWidth(0);
        button.setPadding(dp(4), 0, dp(4), 0);
        button.setOnClickListener(view -> action.run());
        row.addView(button, new LinearLayout.LayoutParams(0, -1, 1));
        return button;
    }

    private void refreshControls() {
        boolean ready = resumed && !busy && !saving;
        if (lengthButton != null) {
            EditState options=requested.get();
            lengthButton.setContentDescription("Length: " + options.maxLength());
            paletteButton.setContentDescription("Palette: " + (options.neon ? "neon" : "original"));
            marksButton.setContentDescription("Marks: " + (options.bars ? "bars" : "lines"));
            lengthButton.setEnabled(ready); paletteButton.setEnabled(ready);
            marksButton.setEnabled(ready); saveButton.setEnabled(ready && rendered != null && displayValid);
        }
    }

    private void edit(int choice) {
        if (!resumed || busy || saving || probe == null) return;
        busy=true; refreshControls();
        EditState old=requested.get();
        EditState next=new EditState(++nextVersion, choice==0 ? !old.longer : old.longer,
            choice==1 ? !old.neon : old.neon, choice==2 ? !old.bars : old.bars);
        requested.set(next);
        status.setText("Drawing…");
        probe.redraw(); // Scheduling only; no native graphics on this UI thread.
    }

    private void acknowledge(RenderedSnapshot snapshot) {
        if (isDestroyed() || requested.get().version != snapshot.options.version) return;
        busy=false;
        status.setText(snapshot.options.description());
        refreshControls();
        onFrameReady(snapshot);
    }

    private void saveCurrent() {
        RenderedSnapshot snapshot=rendered;
        if (!resumed || busy || saving || snapshot == null || !displayValid) return;
        saving=true; refreshControls(); status.setText("Saving PNG…");
        try { writer.execute(new SaveTask(getApplicationContext(), this, snapshot)); }
        catch (RuntimeException failure) { saveFinished(snapshot, null, failure); }
    }

    private void saveFinished(RenderedSnapshot snapshot, Uri uri, Throwable failure) {
        if (isDestroyed()) return;
        saving=false;
        status.setText(failure == null ? "Saved to Pictures/Procedurals" : "Could not save PNG. Try again.");
        refreshControls();
        if (failure == null) onImageSaved(snapshot, uri); else onExampleFailure(failure);
    }

    private static final class SaveTask implements Runnable {
        private final Context context;
        private final WeakReference<FieldMarksActivity> activity;
        private final RenderedSnapshot snapshot;
        SaveTask(Context context, FieldMarksActivity activity, RenderedSnapshot snapshot) {
            this.context=context; this.activity=new WeakReference<>(activity); this.snapshot=snapshot;
        }
        @Override public void run() {
            Uri uri=null; Throwable failure=null;
            try {
                uri=GalleryWriter.save(context, snapshot.image.pngBytes(),
                    "field-marks-42-" + System.currentTimeMillis() + ".png");
            } catch (Exception error) { failure=error; }
            final Uri saved=uri; final Throwable error=failure;
            FieldMarksActivity owner=activity.get();
            if (owner != null && !owner.isDestroyed()) owner.runOnUiThread(() -> {
                FieldMarksActivity current=activity.get();
                if (current != null) current.saveFinished(snapshot, saved, error);
            });
        }
    }

    @Override protected void onResume() {
        super.onResume(); resumed=true; busy=true; refreshControls();
        if (viewport != null && probe == null) viewport.post(() -> attachViewport(viewport));
    }
    @Override protected void onPause() {
        resumed=false; refreshControls(); super.onPause();
    }
    @Override protected void onDestroy() { writer.shutdown(); super.onDestroy(); }

    /** Observation hooks for a derived example or test; they do not supply behavior. */
    protected void onFrameReady(RenderedSnapshot snapshot) { }
    protected void onImageSaved(RenderedSnapshot snapshot, Uri uri) { }
    protected void onExampleFailure(Throwable failure) { }
    protected final int completedFrameCount() { return completedFrame.get(); }
    protected final RenderedSnapshot currentSnapshot() { return rendered; }

    public final class Probe extends PApplet {
        private final int edge;
        private MarkField field;
        private AndroidFrameHost host;
        private RenderedSnapshot pendingAcknowledgment;
        private long failedVersion=-1;
        private RuntimeException pendingFailure;
        private int compositions;
        Probe(int edge) { this.edge=edge; }
        @Override public void settings() { size(edge, edge, JAVA2D); }
        @Override public void setup() {
            host=new AndroidFrameHost(this);
            field=MarkField.create(42,160,160,4);
            registerMethod("post", this);
            noLoop();
        }
        @Override public void draw() {
            EditState options=requested.get();
            RenderedSnapshot previous=rendered;
            if (displayValid && previous != null && previous.options.version == options.version) return;
            try {
                FieldMarksRenderer.Result image=FieldMarksRenderer.render(this, host, field,
                    options.maxLength(), options.neon ? NEON : ORIGINAL, options.bars);
                RenderedSnapshot snapshot=new RenderedSnapshot(options, image, ++compositions);
                rendered=snapshot;
                displayValid=true;
                pendingAcknowledgment=snapshot;
                failedVersion=-1;
            } catch (RuntimeException failure) {
                displayValid=false;
                failedVersion=options.version;
                if (previous != null) requested.compareAndSet(options, previous.options);
                pendingFailure=failure;
            }
        }
        /** Runs after Processing cleared its redraw flag and completed native drawing. */
        public void post() {
            completedFrame.set(frameCount+1);
            RenderedSnapshot snapshot=pendingAcknowledgment;
            pendingAcknowledgment=null;
            if (snapshot != null) runOnUiThread(() -> acknowledge(snapshot));
            RenderedSnapshot latest=rendered;
            EditState desired=requested.get();
            boolean retry=(!displayValid || latest == null || desired.version != latest.options.version) &&
                desired.version != failedVersion;
            if (retry) redraw();
            RuntimeException failure=pendingFailure;
            pendingFailure=null;
            if (failure != null) reportDrawFailure(desired, retry, failure);
        }

        private void reportDrawFailure(EditState desired, boolean retry, RuntimeException failure) {
            runOnUiThread(() -> {
                if (isDestroyed() || requested.get().version != desired.version) return;
                busy=retry;
                status.setText(retry ? "Restoring previous image…" : "Could not draw. Try another edit.");
                refreshControls();
                if (failure != null) onExampleFailure(failure);
            });
        }

        @Override protected boolean handleSpecialDraw() {
            boolean handled=super.handleSpecialDraw();
            if (handled && !isLooping()) {
                RenderedSnapshot snapshot=rendered;
                if (displayValid && snapshot != null && requested.get().version == snapshot.options.version)
                    runOnUiThread(() -> acknowledge(snapshot));
                else {
                    EditState desired=requested.get();
                    if (desired.version != failedVersion) redraw();
                    else reportDrawFailure(desired, false, null);
                }
            }
            return handled;
        }
    }
}
