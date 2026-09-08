package org.procedurals.examples.glyphmarks;

import java.awt.Font;
import java.awt.FontFormatException;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import processing.core.PFont;

/**
 * Java-desktop-only font asset loader for the editable GlyphMarks example.
 *
 * <p>This helper parses an explicit TrueType file instead of using a font-family
 * name, because family lookup may substitute the system default. It is an
 * adapter/example concern: {@link Font} and {@link PFont} do not belong in a
 * portable operation. The caller chooses the asset, glyph set, and size; this
 * class intentionally has no bundled-font path, hash, or fallback.</p>
 */
public final class GlyphFont {
  private GlyphFont() { }

  /** A stable input/capability failure which preserves the originating cause. */
  public static final class GlyphFontException extends IllegalArgumentException {
    public final String code;

    GlyphFontException(String code, String message) {
      super(message);
      this.code = code;
    }

    GlyphFontException(String code, String message, Throwable cause) {
      super(message, cause);
      this.code = code;
    }
  }

  /**
   * Load a TrueType asset, require every requested BMP glyph, and make a
   * Processing {@link PFont} at {@code size}. It never falls back to a system
   * family when the file is missing, malformed, or incomplete.
   *
   * @param path explicit readable TTF file path
   * @param glyphs nonempty BMP character set required by this example
   * @param size positive finite point size
   * @return a PFont whose backing AWT font has passed the requested coverage check
   */
  public static PFont load(String path, String glyphs, float size) {
    validatePath(path);
    validateGlyphs(glyphs);
    validateSize(size);

    File file = new File(path);
    if (!file.isFile() || !file.canRead()) {
      FileNotFoundException cause = new FileNotFoundException(file.getPath());
      throw new GlyphFontException("FONT_UNAVAILABLE",
          "GlyphMarks font file is missing or unreadable: " + file.getPath(), cause);
    }

    final Font parsed;
    try {
      parsed = Font.createFont(Font.TRUETYPE_FONT, file).deriveFont(size);
    } catch (FontFormatException error) {
      throw new GlyphFontException("FONT_INVALID",
          "GlyphMarks font is not a readable TrueType font: " + file.getPath(), error);
    } catch (IOException error) {
      throw new GlyphFontException("FONT_UNAVAILABLE",
          "GlyphMarks font could not be read: " + file.getPath(), error);
    } catch (SecurityException error) {
      throw new GlyphFontException("FONT_UNAVAILABLE",
          "GlyphMarks font cannot be read under the current security policy: " + file.getPath(), error);
    }

    final PFont result;
    try {
      result = new PFont(parsed, true, glyphs.toCharArray());
    } catch (RuntimeException error) {
      throw new GlyphFontException("FONT_CONSTRUCTION_FAILED",
          "Processing could not construct a PFont from: " + file.getPath(), error);
    }

    Font nativeFont = result.getFont();
    if (nativeFont == null) {
      throw new GlyphFontException("FONT_CONSTRUCTION_FAILED",
          "Processing returned a PFont without a native font for: " + file.getPath());
    }
    int unsupported = nativeFont.canDisplayUpTo(glyphs);
    if (unsupported >= 0) {
      char glyph = glyphs.charAt(unsupported);
      throw new GlyphFontException("FONT_GLYPH_UNAVAILABLE",
          "GlyphMarks font cannot display U+" + hex(glyph) + " at glyph index " + unsupported);
    }
    for (int i = 0; i < glyphs.length(); i++) {
      if (result.getGlyph(glyphs.charAt(i)) == null) {
        throw new GlyphFontException("FONT_GLYPH_UNAVAILABLE",
            "Processing PFont has no glyph for U+" + hex(glyphs.charAt(i)) + " at glyph index " + i);
      }
    }
    return result;
  }

  private static void validatePath(String path) {
    if (path == null || path.length() == 0) {
      throw new GlyphFontException("INVALID_FONT_PATH", "GlyphMarks font path must be nonempty");
    }
  }

  private static void validateGlyphs(String glyphs) {
    if (glyphs == null || glyphs.length() == 0) {
      throw new GlyphFontException("INVALID_GLYPHS", "GlyphMarks glyph set must be nonempty");
    }
    for (int i = 0; i < glyphs.length(); i++) {
      if (Character.isSurrogate(glyphs.charAt(i))) {
        throw new GlyphFontException("INVALID_GLYPHS",
            "GlyphMarks glyph set must contain BMP characters, not surrogate code units");
      }
    }
  }

  private static void validateSize(float size) {
    if (Float.isNaN(size) || Float.isInfinite(size) || size <= 0f) {
      throw new GlyphFontException("INVALID_SIZE", "GlyphMarks font size must be positive and finite");
    }
  }

  private static String hex(char value) {
    String text = Integer.toHexString(value).toUpperCase(java.util.Locale.ROOT);
    return "0000".substring(text.length()) + text;
  }
}
