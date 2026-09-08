package org.procedurals.examples.profilemarks;

import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import androidx.fragment.app.FragmentActivity;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.procedurals.color.CyclicPalette;
import org.procedurals.examples.fieldmarks.GalleryWriter;
import org.procedurals.mesh.RadialProfile3D;
import processing.android.PFragment;
import processing.core.PApplet;
import processing.core.PImage;

/** Workflow-local Android P3D ProfileMarks example. */
public class ProfileMarksActivity extends FragmentActivity {
    private static final int LOGICAL_EDGE = 640;
    private static final int[] PRIMARY = {0xEBB858, 0xEEA8C1, 0xD0CBC3, 0x87B6C4, 0xEA4140, 0x5A5787};
    private static final int[] ALTERNATE = {0x243B53, 0x3E8C93, 0xE9C46A, 0xE76F51};

    private final AtomicReference<State> requested = new AtomicReference<>(State.initial());
    private final AtomicLong savedRevision = new AtomicLong(-1);
    private final AtomicBoolean saving = new AtomicBoolean();
    private final ThreadPoolExecutor writer = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<Runnable>(1), new ThreadPoolExecutor.AbortPolicy());
    private Sketch sketch;
    private FrameLayout viewport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        LinearLayout firstRow = new LinearLayout(this);
        LinearLayout secondRow = new LinearLayout(this);
        String[] labels = {"Profile", "Slices", "Start cap", "End cap", "Palette", "Trio", "Reset", "Save"};
        for (int i = 0; i < labels.length; i++) {
            final int command = i;
            Button button = new Button(this);
            button.setText(labels[i]);
            button.setContentDescription(labels[i]);
            button.setTextSize(12);
            button.setAllCaps(false);
            button.setMinWidth(0);
            button.setMinimumWidth(0);
            button.setOnClickListener(view -> {
                if (command == 7) saveDisplayed();
                else {
                    requested.updateAndGet(previous -> previous.next(command));
                    Sketch current = sketch;
                    if (current != null) current.redraw();
                }
            });
            (i < 4 ? firstRow : secondRow).addView(button, new LinearLayout.LayoutParams(0, -2, 1));
        }
        page.addView(firstRow);
        page.addView(secondRow);
        viewport = new FrameLayout(this);
        viewport.setId(View.generateViewId());
        page.addView(viewport, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(page);
        viewport.addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> attachViewport());
        viewport.post(this::attachViewport);
    }

    /** Attaches one square P3D fragment after controls leave a real viewport to measure. */
    private void attachViewport() {
        if (isDestroyed() || isFinishing() || getSupportFragmentManager().isStateSaved() || sketch != null || viewport == null || viewport.getWidth() == 0 || viewport.getHeight() == 0) return;
        int edge = Math.min(viewport.getWidth(), viewport.getHeight());
        if (edge == 0) return;
        sketch = new Sketch(edge);
        new ProfileFragment(sketch).setView(viewport, this);
    }

    /** Pinned Android4.12 otherwise excludes noLoop redraws from GLES dispatch.
     * The existing PApplet.handleDraw guard owns whether an actual frame is needed. */
    public static final class ProfileFragment extends PFragment {
        public ProfileFragment() { super(); }
        public ProfileFragment(PApplet sketch) { super(sketch); }
        @Override public boolean canDraw() {
            PApplet current = getSketch();
            if (current == null) return false;
            synchronized (current) { return true; }
        }
    }

    private void saveDisplayed() {
        Sketch current = sketch;
        PublishedSnapshot snapshot = current == null ? null : current.publishedSnapshot();
        if (snapshot == null || !saving.compareAndSet(false, true)) return;
        byte[] png = snapshot.copyPng();
        try {
            writer.execute(() -> {
                Uri uri = null;
                Throwable failure = null;
                try {
                    uri = GalleryWriter.save(getApplicationContext(), png, "profile-marks.png");
                    savedRevision.set(snapshot.revision);
                } catch (Throwable error) {
                    failure = error;
                }
                final Uri acknowledgedUri = uri;
                final Throwable acknowledgedFailure = failure;
                runOnUiThread(() -> {
                    saving.set(false);
                    onSaved(snapshot, acknowledgedUri, acknowledgedFailure);
                });
            });
        } catch (RuntimeException error) {
            saving.set(false);
            onSaved(snapshot, null, error);
        }
    }

    public long shownRevision() { PublishedSnapshot snapshot = currentSnapshot(); return snapshot == null ? -1 : snapshot.revision; }
    public long shownCompositionIdentity() { PublishedSnapshot snapshot = currentSnapshot(); return snapshot == null ? -1 : snapshot.compositionIdentity; }
    public int shownRetainedFaceCount() { PublishedSnapshot snapshot = currentSnapshot(); return snapshot == null ? -1 : snapshot.retainedFaceCount; }
    public int shownDrawnFaceCount() { PublishedSnapshot snapshot = currentSnapshot(); return snapshot == null ? -1 : snapshot.drawnFaceCount; }
    public long savedRevision() { return savedRevision.get(); }
    public PublishedSnapshot currentSnapshot() { return sketch == null ? null : sketch.publishedSnapshot(); }

    /** Draw completion is delivered on the Android UI thread after Processing endDraw. */
    protected void onCompletedDraw(PublishedSnapshot snapshot) { }
    /** Save completion is delivered on the Android UI thread with the MediaStore URI or error. */
    protected void onSaved(PublishedSnapshot snapshot, Uri uri, Throwable failure) { }

    @Override protected void onDestroy() {
        writer.shutdownNow();
        super.onDestroy();
    }

    private static CyclicPalette palette(int[] colors) {
        List<Integer> values = new ArrayList<>(colors.length);
        for (int color : colors) values.add(color);
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("colors", values);
        return CyclicPalette.create(input);
    }

    static final class State {
        final int profile, slices;
        final boolean start, end, alternate, trio, forceRebuild;
        final long revision;

        State(int profile, int slices, boolean start, boolean end, boolean alternate, boolean trio, long revision, boolean forceRebuild) {
            this.profile = profile; this.slices = slices; this.start = start; this.end = end;
            this.alternate = alternate; this.trio = trio; this.revision = revision; this.forceRebuild = forceRebuild;
        }
        static State initial() { return new State(0, 32, true, true, false, false, 0, false); }
        State next(int command) {
            long next = revision + 1;
            if (command == 6) return new State(0, 32, true, true, false, false, next, true);
            if (command == 0) return new State((profile + 1) % 3, slices, start, end, alternate, trio, next, false);
            if (command == 1) return new State(profile, slices == 32 ? 8 : 32, start, end, alternate, trio, next, false);
            if (command == 2) return new State(profile, slices, !start, end, alternate, trio, next, false);
            if (command == 3) return new State(profile, slices, start, !end, alternate, trio, next, false);
            if (command == 4) return new State(profile, slices, start, end, !alternate, trio, next, false);
            return new State(profile, slices, start, end, alternate, !trio, next, false);
        }
    }

    /** Immutable, atomically published post-frame observation. PNG bytes never escape mutable. */
    public static final class PublishedSnapshot {
        public final long revision, compositionIdentity, frameSerial;
        public final ProfileComposition composition;
        final State options;
        public final int retainedFaceCount, drawnFaceCount, normalCalls, vertexCalls, viewportWidth, viewportHeight;
        private final byte[] png;
        PublishedSnapshot(State options, ProfileComposition composition, long frameSerial, long compositionIdentity, int retainedFaceCount, SubmissionCounts drawn, int width, int height, byte[] png) {
            this.options = options; this.composition = composition; this.frameSerial = frameSerial;
            long revision = options.revision;
            this.revision = revision; this.compositionIdentity = compositionIdentity;
            this.retainedFaceCount = retainedFaceCount; this.drawnFaceCount = drawn.faces;
            this.normalCalls = drawn.normals; this.vertexCalls = drawn.vertices;
            this.viewportWidth = width; this.viewportHeight = height; this.png = png.clone();
        }
        public byte[] copyPng() { return png.clone(); }
    }

    private static final class SubmissionCounts {
        int faces, normals, vertices;
    }

    public final class Sketch extends PApplet {
        private final int edge;
        private final AtomicReference<PublishedSnapshot> published = new AtomicReference<>();
        private ProfileComposition composition;
        private State applied;
        private CyclicPalette primaryPalette, alternatePalette;
        private long compositionCount, frameSerial;
        private PublishedSnapshot pending;

        Sketch(int edge) { this.edge = edge; }
        PublishedSnapshot publishedSnapshot() { return published.get(); }
        @Override public void settings() { size(edge, edge, P3D); }
        @Override public void setup() {
            primaryPalette = palette(PRIMARY);
            alternatePalette = palette(ALTERNATE);
            registerMethod("post", this);
            noLoop();
        }
        @Override public void resume() { super.resume(); redraw(); }

        @Override public void draw() {
            State state = requested.get();
            boolean resetPending = state.forceRebuild && (applied == null || state.revision != applied.revision);
            if (composition == null || resetPending || state.slices != applied.slices || state.start != applied.start || state.end != applied.end) {
                composition = ProfileComposition.create(state.slices, state.start, state.end);
                compositionCount++;
            }
            applied = state;
            background(243, 240, 232);
            ortho();
            lights();
            noStroke();
            float scaleToViewport = width / (float) LOGICAL_EDGE;
            pushMatrix();
            scale(scaleToViewport);
            SubmissionCounts drawn = new SubmissionCounts();
            if (state.trio) {
                mesh(composition.meshAt(0), 140, .45f, state, drawn);
                mesh(composition.meshAt(1), 320, .45f, state, drawn);
                mesh(composition.meshAt(2), 500, .45f, state, drawn);
            } else mesh(composition.meshAt(state.profile), 320, 1, state, drawn);
            popMatrix();
            pending = new PublishedSnapshot(state, composition, ++frameSerial, compositionCount, retainedFaces(), drawn, width, height, capturePng());
        }

        /** Processing invokes this after draw/endDraw; hooks then cross to Android's UI thread. */
        public void post() {
            PublishedSnapshot completed = pending;
            pending = null;
            if (completed == null) return;
            published.set(completed);
            runOnUiThread(() -> { if (!isDestroyed()) onCompletedDraw(completed); });
            if (requested.get().revision != completed.revision) redraw();
        }

        private int retainedFaces() {
            return composition.meshAt(0).faceCount() + composition.meshAt(1).faceCount() + composition.meshAt(2).faceCount();
        }

        private byte[] capturePng() {
            PImage image = get();
            image.loadPixels();
            Bitmap bitmap = Bitmap.createBitmap(image.pixels, image.width, image.height, Bitmap.Config.ARGB_8888);
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try {
                if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes)) throw new IllegalStateException("PNG capture failed");
                return bytes.toByteArray();
            } finally { bitmap.recycle(); }
        }

        private void mesh(RadialProfile3D mesh, float x, float scale, State state, SubmissionCounts counts) {
            double[] normal = new double[3]; double[] vertex = new double[3]; int[] triangle = new int[3];
            CyclicPalette colors = state.alternate ? alternatePalette : primaryPalette;
            pushMatrix(); translate(x, 320); rotateX(1); rotateY(.35f); scale(scale); beginShape(TRIANGLES);
            for (int face = 0; face < mesh.faceCount(); face++) {
                int band = mesh.bandAt(face);
                double phase = band < 0 ? (mesh.faceKindAt(face).equals("start-cap") ? .15 : .65)
                    : band / 8d + mesh.cellAt(face) / (composition.slices() * 8d);
                int rgb = colors.sample(phase);
                fill((rgb >>> 16) & 255, (rgb >>> 8) & 255, rgb & 255);
                mesh.normalInto(face, normal, 0); normal((float) normal[0], (float) normal[1], (float) normal[2]); counts.normals++;
                mesh.triangleInto(face, triangle, 0);
                for (int index : triangle) { mesh.vertexInto(index, vertex, 0); vertex((float) vertex[0], (float) vertex[1], (float) vertex[2]); counts.vertices++; }
                counts.faces++;
            }
            endShape(); popMatrix();
        }
    }
}
