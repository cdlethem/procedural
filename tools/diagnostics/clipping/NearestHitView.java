import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import processing.awt.PGraphicsJava2D;
import processing.core.PApplet;

/**
 * Private JAVA2D view for generated nearest-hit study rows; it performs no ray computation.
 * Each tab-separated row is {@code panel, kind, x1, y1, x2, y2}, where panel is zero or one
 * and kind is obstacle, original, trimmed, or hit. Rows retain file order within each drawing
 * pass: originals, obstacles, trimmed segments, then hit markers.
 */
public final class NearestHitView extends PApplet {
    private static final int WIDTH = 1000;
    private static final int HEIGHT = 500;
    private static final String[] KINDS = {"obstacle", "original", "trimmed", "hit"};

    private final Path input;
    private final Path output;
    private final List<Row> rows = new ArrayList<Row>();
    private final int[] counts = new int[KINDS.length];

    private static final class Row {
        final int panel;
        final int kind;
        final float x1;
        final float y1;
        final float x2;
        final float y2;

        Row(int panel, int kind, double x1, double y1, double x2, double y2) {
            this.panel = panel;
            this.kind = kind;
            this.x1 = (float) x1;
            this.y1 = (float) y1;
            this.x2 = (float) x2;
            this.y2 = (float) y2;
        }
    }

    private NearestHitView(Path input, Path output) {
        this.input = input;
        this.output = output;
    }

    @Override public void settings() {
        size(WIDTH, HEIGHT, JAVA2D);
        pixelDensity(1);
    }

    @Override public void setup() {
        try {
            loadRows();
            if (!(g instanceof PGraphicsJava2D) || pixelDensity != 1) {
                throw new IllegalStateException("JAVA2D density-one renderer required");
            }
            drawRows();
            save(output.toString());
            if (!Files.isRegularFile(output) || Files.size(output) == 0L) {
                throw new IOException("Could not save " + output);
            }
            System.out.println(resultJson());
            exit();
            System.exit(0);
        } catch (Throwable error) {
            error.printStackTrace();
            exit();
            System.exit(1);
        }
    }

    private void loadRows() throws IOException {
        if (!Files.isRegularFile(input)) throw new IllegalArgumentException("Input TSV is not a regular file: " + input);
        Path parent = output.toAbsolutePath().getParent();
        if (parent == null || !Files.isDirectory(parent)) throw new IllegalArgumentException("Output parent does not exist: " + output);
        try (BufferedReader reader = Files.newBufferedReader(input, StandardCharsets.UTF_8)) {
            String line;
            int number = 0;
            while ((line = reader.readLine()) != null) {
                number++;
                String[] fields = line.split("\\t", -1);
                if (fields.length != 6) throw invalidRow(number, "expected six tab-separated fields");
                int panel = panel(fields[0], number);
                int kind = kind(fields[1], number);
                rows.add(new Row(panel, kind, coordinate(fields[2], number), coordinate(fields[3], number),
                        coordinate(fields[4], number), coordinate(fields[5], number)));
                counts[kind]++;
            }
        }
    }

    private static int panel(String value, int line) {
        if ("0".equals(value)) return 0;
        if ("1".equals(value)) return 1;
        throw invalidRow(line, "panel must be 0 or 1");
    }

    private static int kind(String value, int line) {
        for (int index = 0; index < KINDS.length; index++) if (KINDS[index].equals(value)) return index;
        throw invalidRow(line, "unknown kind");
    }

    private static double coordinate(String value, int line) {
        try {
            double coordinate = Double.parseDouble(value);
            if (!Double.isFinite(coordinate) || coordinate > Float.MAX_VALUE || coordinate < -Float.MAX_VALUE) {
                throw invalidRow(line, "coordinate must be finite and float-representable");
            }
            return coordinate;
        } catch (NumberFormatException error) {
            throw invalidRow(line, "coordinate is not a number");
        }
    }

    private static IllegalArgumentException invalidRow(int line, String detail) {
        return new IllegalArgumentException("Invalid TSV row " + line + ": " + detail);
    }

    private void drawRows() {
        background(244, 240, 232);
        stroke(91, 88, 82, 90);
        strokeWeight(1f);
        line(500, 0, 500, HEIGHT);
        for (int kind = 1; kind >= 0; kind--) drawKind(kind);
        drawKind(2);
        drawKind(3);
    }

    private void drawKind(int kind) {
        for (Row row : rows) if (row.kind == kind) drawRow(row);
    }

    private void drawRow(Row row) {
        float offset = row.panel * 500f;
        pushStyle();
        clip(offset, 0, 500, HEIGHT);
        if (row.kind == 0) {
            stroke(48, 53, 54, 220);
            strokeWeight(3.5f);
            line(offset + row.x1, row.y1, offset + row.x2, row.y2);
        } else if (row.kind == 1) {
            stroke(90, 101, 105, 68);
            strokeWeight(1f);
            line(offset + row.x1, row.y1, offset + row.x2, row.y2);
        } else if (row.kind == 2) {
            stroke(203, 79, 68, 238);
            strokeWeight(2f);
            line(offset + row.x1, row.y1, offset + row.x2, row.y2);
        } else {
            noStroke();
            fill(35, 126, 133);
            ellipse(offset + row.x1, row.y1, 7f, 7f);
        }
        noClip();
        popStyle();
    }

    private String resultJson() {
        return "{\"status\":\"passed\",\"renderer\":\"" + g.getClass().getName()
                + "\",\"width\":" + width + ",\"height\":" + height + ",\"density\":" + pixelDensity
                + ",\"counts\":{\"obstacle\":" + counts[0] + ",\"original\":" + counts[1]
                + ",\"trimmed\":" + counts[2] + ",\"hit\":" + counts[3] + "}}";
    }

    public static void main(String[] arguments) {
        if (arguments.length != 2) throw new IllegalArgumentException("input.tsv output.png required");
        Path input = Paths.get(arguments[0]).toAbsolutePath();
        Path output = Paths.get(arguments[1]).toAbsolutePath();
        PApplet.runSketch(new String[] {"--sketch-path=" + output.getParent(), "NearestHitView"},
                new NearestHitView(input, output));
    }
}
