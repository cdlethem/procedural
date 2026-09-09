import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/** Typed, immutable controls supplied by the layer runner. */
public final class LayerControls {
    private final Map<String, String> values = new LinkedHashMap<>();
    private final Map<String, String> types = new LinkedHashMap<>();

    public LayerControls(String file) throws IOException {
        try (BufferedReader reader = Files.newBufferedReader(Path.of(file), StandardCharsets.UTF_8)) {
            String line;
            int lineNumber = 0;
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.isEmpty()) continue;
                String[] fields = line.split("\\t", -1);
                if (fields.length != 3 || fields[0].isEmpty()) {
                    throw new IllegalArgumentException("invalid control record at line " + lineNumber);
                }
                if (!fields[1].equals("number") && !fields[1].equals("flag") && !fields[1].equals("option")) {
                    throw new IllegalArgumentException("invalid control type for " + fields[0]);
                }
                if (values.put(fields[0], fields[2]) != null) {
                    throw new IllegalArgumentException("duplicate control: " + fields[0]);
                }
                types.put(fields[0], fields[1]);
                if (fields[1].equals("number")) Float.parseFloat(fields[2]);
                if (fields[1].equals("flag") && !fields[2].equals("true") && !fields[2].equals("false")) {
                    throw new IllegalArgumentException("invalid flag value for " + fields[0]);
                }
            }
        }
    }

    private String value(String key, String expected) {
        String type = types.get(key);
        if (type == null) throw new IllegalArgumentException("unknown control key: " + key);
        if (!type.equals(expected)) {
            throw new IllegalArgumentException("control " + key + " is " + type + ", not " + expected);
        }
        return values.get(key);
    }

    public float number(String key) {
        return Float.parseFloat(value(key, "number"));
    }

    public boolean flag(String key) {
        return Boolean.parseBoolean(value(key, "flag"));
    }

    public String option(String key) {
        return value(key, "option");
    }
}
