package org.procedurals.android.internal;

import processing.android.PFragment;
import processing.core.PApplet;

/**
 * Internal fragment carrier for the pinned Processing Android JAVA2D integration.
 *
 * <p>The android-412 PFragment gates dispatch on isLooping(), which prevents a
 * noLoop sketch's redraw request from reaching PApplet.handleDraw(). This carrier
 * leaves that decision to handleDraw's existing noLoop/redraw guard. It does not
 * start another thread or draw from an Android input callback.</p>
 *
 * <p>The brief sketch monitor acquisition observes requests made through its
 * synchronized redraw/loop/noLoop methods. PSurfaceNone invokes handleDraw only
 * after this method returns, so this monitor is never held through drawing.</p>
 *
 * <p>Runtime evidence and scope: design/android-redraw-integration-finding.md.
 * This independently specified integration is limited to the pinned Android2D
 * fragment route; it does not establish other renderer or lifecycle support.</p>
 */
public final class Android2DFragment extends PFragment {
    public Android2DFragment() { super(); }

    public Android2DFragment(PApplet sketch) { super(sketch); }

    @Override public boolean canDraw() {
        PApplet sketch = getSketch();
        if (sketch == null) return false;
        synchronized (sketch) {
            return true;
        }
    }
}
