package org.procedurals.examples.glyphmarks;

import java.awt.FontFormatException;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.security.MessageDigest;
import processing.core.PFont;

/** Headless native checks for the explicit-asset GlyphMarks example loader. */
public final class GlyphFontNative {
  private static int assertions;

  private interface Action { void run(); }

  private static void check(boolean condition, String message) {
    assertions++;
    if (!condition) throw new AssertionError(message);
  }

  private static void expected(String code, Action action) {
    try {
      action.run();
      throw new AssertionError("expected " + code);
    } catch (GlyphFont.GlyphFontException error) {
      check(code.equals(error.code), "expected " + code + " got " + error.code);
    }
  }

  private static void expectedCause(String code, Class<?> cause, Action action) {
    try {
      action.run();
      throw new AssertionError("expected " + code);
    } catch (GlyphFont.GlyphFontException error) {
      check(code.equals(error.code), "expected " + code + " got " + error.code);
      check(cause.isInstance(error.getCause()), "causal " + cause.getName());
    }
  }

  private static String sha256(File file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    byte[] buffer = new byte[8192];
    java.io.InputStream input = Files.newInputStream(file.toPath());
    try {
      for (int count; (count = input.read(buffer)) >= 0;) digest.update(buffer, 0, count);
    } finally {
      input.close();
    }
    StringBuilder text = new StringBuilder();
    for (byte value : digest.digest()) text.append(String.format("%02x", value & 0xff));
    return text.toString();
  }

  private static void success(File font) throws Exception {
    String glyphs = "0123456789ABCDEFGHIJ";
    PFont loaded = GlyphFont.load(font.getPath(), glyphs, 48f);
    check(loaded != null && loaded.getFont() != null, "native PFont retained");
    check(loaded.getFont().canDisplayUpTo(glyphs) == -1, "native font covers glyphs");
    check(loaded.getSize() == 48, "requested PFont size");
    for (int i = 0; i < glyphs.length(); i++) check(loaded.getGlyph(glyphs.charAt(i)) != null, "PFont glyph");
  }

  private static void failures(File font) throws Exception {
    final String missing = font.getPath() + ".missing";
    expectedCause("FONT_UNAVAILABLE", java.io.FileNotFoundException.class,
        () -> GlyphFont.load(missing, "A", 48f));

    File corrupt = File.createTempFile("glyph-font-native-", ".ttf");
    try {
      FileOutputStream out = new FileOutputStream(corrupt);
      try { out.write(new byte[] { 1, 2, 3, 4 }); } finally { out.close(); }
      expectedCause("FONT_INVALID", FontFormatException.class,
          () -> GlyphFont.load(corrupt.getPath(), "A", 48f));
    } finally {
      if (!corrupt.delete()) corrupt.deleteOnExit();
    }

    check(!GlyphFont.load(font.getPath(), "A", 48f).getFont().canDisplay('\u0378'),
        "chosen missing BMP glyph is absent");
    expected("FONT_GLYPH_UNAVAILABLE", () -> GlyphFont.load(font.getPath(), "\u0378", 48f));
    expected("INVALID_FONT_PATH", () -> GlyphFont.load(null, "A", 48f));
    expected("INVALID_GLYPHS", () -> GlyphFont.load(font.getPath(), "", 48f));
    expected("INVALID_GLYPHS", () -> GlyphFont.load(font.getPath(), "\uD800", 48f));
    expected("INVALID_SIZE", () -> GlyphFont.load(font.getPath(), "A", 0f));
    expected("INVALID_SIZE", () -> GlyphFont.load(font.getPath(), "A", Float.NaN));
    expected("INVALID_SIZE", () -> GlyphFont.load(font.getPath(), "A", Float.POSITIVE_INFINITY));
  }

  public static void main(String[] args) throws Exception {
    File font = new File(args.length == 0 ? "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf" : args[0]);
    check(font.isFile(), "font file exists");
    String hash = sha256(font);
    check("b4c632e3cdf9acc7f28758fb5a323c8524d7fc6660d46904d9b6cbe2809c419c".equals(hash),
        "expected local audit font hash");
    success(font);
    failures(font);
    System.out.println("{\"status\":\"passed\",\"assertions\":" + assertions
        + ",\"font_sha256\":\"" + hash + "\",\"glyphs\":\"0123456789ABCDEFGHIJ\"}");
  }
}
