package org.procedurals.examples.fieldmarks;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.provider.MediaStore;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Writes already-encoded example output through Android's pending MediaStore route.
 *
 * <p>See <a href="https://developer.android.com/training/data-storage/shared/media#add-item">
 * Android's shared-media add-item guide</a>. This API-29+ helper owns only its inserted
 * row; callers provide PNG bytes and choose where to report completion.</p>
 */
public final class GalleryWriter {
    private static final String MIME_TYPE = "image/png";
    private static final String RELATIVE_PATH = "Pictures/Procedurals";

    private GalleryWriter() { }

    /**
     * Publishes {@code png} as an app-owned image after its stream has closed.
     *
     * @throws IOException if insertion, writing, closing, or publication fails
     */
    public static Uri save(Context applicationContext, byte[] png, String displayName) throws IOException {
        if (applicationContext == null) throw new IllegalArgumentException("applicationContext is required");
        if (png == null) throw new IllegalArgumentException("png is required");
        if (displayName == null || displayName.length() == 0)
            throw new IllegalArgumentException("displayName is required");

        ContentResolver resolver = applicationContext.getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, displayName);
        values.put(MediaStore.Images.Media.MIME_TYPE, MIME_TYPE);
        values.put(MediaStore.Images.Media.RELATIVE_PATH, RELATIVE_PATH);
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        Uri inserted = null;
        try {
            inserted = resolver.insert(
                MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
            if (inserted == null) throw new IOException("MediaStore did not create an image row");

            OutputStream stream = resolver.openOutputStream(inserted);
            if (stream == null) throw new IOException("MediaStore did not open an output stream");
            try (OutputStream output = stream) {
                output.write(png);
            }

            ContentValues published = new ContentValues();
            published.put(MediaStore.Images.Media.IS_PENDING, 0);
            int updated = resolver.update(inserted, published, null, null);
            if (updated != 1) throw new IOException("MediaStore did not publish exactly one image row");
            return inserted;
        } catch (IOException failure) {
            deleteInserted(resolver, inserted, failure);
            throw failure;
        } catch (RuntimeException failure) {
            deleteInserted(resolver, inserted, failure);
            throw failure;
        } catch (Error failure) {
            deleteInserted(resolver, inserted, failure);
            throw failure;
        }
    }

    /** Deletes only the row this call inserted and preserves the primary failure. */
    private static void deleteInserted(ContentResolver resolver, Uri inserted, Throwable primary) {
        if (inserted == null) return;
        try {
            resolver.delete(inserted, null, null);
        } catch (RuntimeException cleanup) {
            primary.addSuppressed(cleanup);
        } catch (Error cleanup) {
            primary.addSuppressed(cleanup);
        }
    }
}
