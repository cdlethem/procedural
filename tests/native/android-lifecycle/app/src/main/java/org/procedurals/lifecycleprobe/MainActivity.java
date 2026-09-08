package org.procedurals.lifecycleprobe;

import android.os.Bundle;
import android.view.View;
import android.widget.FrameLayout;
import androidx.fragment.app.FragmentActivity;
import java.util.UUID;
import org.procedurals.android.internal.AndroidActivityLifecycle;
import org.procedurals.android.internal.Android2DFragment;
import processing.core.PApplet;

/** Test-only activity carrier for the registered Android lifecycle probe. */
public final class MainActivity extends FragmentActivity {
    private final String nonce = UUID.randomUUID().toString();
    private Probe probe;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FinishReceiver.attach(this);
        FrameLayout container = new FrameLayout(this);
        container.setId(View.generateViewId());
        setContentView(container);
        probe = new Probe();
        new Android2DFragment(probe).setView(container, this);
    }

    @Override protected void onDestroy() {
        FinishReceiver.detach(this);
        super.onDestroy();
    }

    /** Processing carrier: all lifecycle assertions live in the package-peer helper. */
    public final class Probe extends PApplet {
        private volatile AndroidActivityLifecycle lifecycle;

        @Override public void settings() { fullScreen(JAVA2D); }

        @Override public void setup() {
            AndroidActivityLifecycle initialized =
                new AndroidActivityLifecycle(this, MainActivity.this.getFilesDir(), nonce);
            initialized.setup();
            lifecycle = initialized;
        }

        @Override public void draw() {
            if (lifecycle != null) lifecycle.draw();
        }

        @Override public void touchStarted() {
            if (lifecycle != null) lifecycle.input();
        }

        @Override public void handleDraw() {
            int before = frameCount;
            AndroidActivityLifecycle observer = lifecycle;
            if (observer != null) observer.observeDispatchBefore(before);
            super.handleDraw();
            // setup publishes the helper inside the first superclass dispatch.
            observer = lifecycle;
            if (observer != null) observer.observeDispatchAfter(before);
        }

        @Override protected boolean handleSpecialDraw() {
            boolean handled = super.handleSpecialDraw();
            if (handled && lifecycle != null) {
                lifecycle.specialDrawHandled();
                if (!isLooping()) lifecycle.restorationIdle();
            }
            return handled;
        }
    }
}
