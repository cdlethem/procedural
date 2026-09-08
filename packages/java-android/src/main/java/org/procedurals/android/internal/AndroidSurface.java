package org.procedurals.android.internal;

import android.graphics.Canvas;
import processing.a2d.PGraphicsAndroid2D;

/** Internal access to native readiness only; drawing behavior is inherited unchanged. */
class AndroidSurface extends PGraphicsAndroid2D {
    Object owner;
    boolean released;
    Canvas prepareCanvas() { return checkCanvas(); }
    boolean isPrimary() { return primaryGraphics; }
}
