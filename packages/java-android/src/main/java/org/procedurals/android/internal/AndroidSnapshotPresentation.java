package org.procedurals.android.internal;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import processing.core.PApplet;
import processing.core.PImage;

/** Internal presentation of an acknowledged PNG after a native surface replacement.
 * Call only on the Processing animation thread, outside an active begin/end frame.
 * This restores pixels; it does not execute a composition or advance its random stream.
 */
public final class AndroidSnapshotPresentation {
    private AndroidSnapshotPresentation() { }

    public static void present(PApplet sketch, byte[] png) {
        Bitmap bitmap=BitmapFactory.decodeByteArray(png,0,png.length);
        if (bitmap == null) throw new IllegalStateException("cached image could not be decoded");
        try {
            sketch.g.beginDraw();
            try {
                sketch.pushStyle();
                try {
                    sketch.pushMatrix();
                    try {
                        sketch.resetMatrix(); sketch.imageMode(PApplet.CORNER); sketch.noTint();
                        sketch.image(new PImage(bitmap),0,0,sketch.width,sketch.height);
                    } finally { sketch.popMatrix(); }
                } finally { sketch.popStyle(); }
            } finally { sketch.g.endDraw(); }
        } finally { bitmap.recycle(); }
    }
}
