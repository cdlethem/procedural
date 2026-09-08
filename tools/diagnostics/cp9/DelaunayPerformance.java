import java.lang.management.ManagementFactory;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.procedurals.topology.Delaunay2D;

/** Private native workload probe; no Processing or portable RNG compatibility claim. */
public final class DelaunayPerformance {
    private static volatile long consumed;
    private static volatile Object exported;
    private static final long MAX_WORK = 50000000L;
    private static final com.sun.management.ThreadMXBean ALLOCATION = allocationBean();

    private static com.sun.management.ThreadMXBean allocationBean() {
        java.lang.management.ThreadMXBean bean = ManagementFactory.getThreadMXBean();
        if (!(bean instanceof com.sun.management.ThreadMXBean)) return null;
        com.sun.management.ThreadMXBean supported = (com.sun.management.ThreadMXBean) bean;
        if (!supported.isThreadAllocatedMemorySupported()) return null;
        if (!supported.isThreadAllocatedMemoryEnabled()) supported.setThreadAllocatedMemoryEnabled(true);
        return supported;
    }

    private static long allocated() {
        return ALLOCATION == null ? -1L : ALLOCATION.getThreadAllocatedBytes(Thread.currentThread().getId());
    }

    private static long allocationDelta(long before) {
        return before < 0 ? -1 : allocated() - before;
    }

    private static String quote(String text) {
        return "\"" + text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }

    private static Map<String,Object> config(List<List<Double>> points, long budget) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("points", points);
        result.put("maxWork", budget);
        return result;
    }

    private static List<List<Double>> scatter(int count) {
        Random random = new Random(42L);
        List<List<Double>> result = new ArrayList<>();
        for (int i = 0; i < count; i++) result.add(Arrays.asList(random.nextDouble() * 640, random.nextDouble() * 640));
        return result;
    }

    private static List<List<Double>> grid(int side) {
        List<List<Double>> result = new ArrayList<>();
        for (int y = 0; y < side; y++) for (int x = 0; x < side; x++) result.add(Arrays.asList(x * 2.0, y * 2.0));
        return result;
    }

    private static long mix(long state, long value) {
        return (state ^ value) * 0x100000001b3L;
    }

    private static long checksum(Delaunay2D mesh, boolean into, double[] point, int[] triple, int[] pair) {
        long hash = 0xcbf29ce484222325L;
        hash = mix(hash, mesh.inputCount()); hash = mix(hash, mesh.vertexCount());
        hash = mix(hash, mesh.faceCount()); hash = mix(hash, mesh.edgeCount()); hash = mix(hash, mesh.workUsed());
        for (long i = 0; i < mesh.inputCount(); i++) hash = mix(hash, mesh.inputVertexAt(i));
        for (long i = 0; i < mesh.vertexCount(); i++) {
            double[] value;
            if (into) { mesh.pointInto(i, point, 0); value = point; } else value = mesh.pointAt(i);
            hash = mix(hash, Double.doubleToRawLongBits(value[0]));
            hash = mix(hash, Double.doubleToRawLongBits(value[1]));
            hash = mix(hash, mesh.sourceIndexAt(i));
        }
        for (long i = 0; i < mesh.faceCount(); i++) {
            int[] value;
            if (into) { mesh.triangleInto(i, triple, 0); value = triple; } else value = mesh.triangleAt(i);
            for (int j = 0; j < 3; j++) hash = mix(hash, value[j]);
        }
        for (long i = 0; i < mesh.edgeCount(); i++) {
            int[] value;
            if (into) { mesh.edgeInto(i, pair, 0); value = pair; } else value = mesh.edgeAt(i);
            hash = mix(hash, value[0]); hash = mix(hash, value[1]);
            if (into) { mesh.edgeFacesInto(i, pair, 0); value = pair; } else value = mesh.edgeFacesAt(i);
            hash = mix(hash, value[0]); hash = mix(hash, value[1]);
        }
        return hash;
    }

    private static double median(long[] nanos) {
        long[] ordered = nanos.clone(); Arrays.sort(ordered);
        int middle = ordered.length / 2;
        return ordered.length % 2 == 1 ? ordered[middle] / 1e6 : (ordered[middle - 1] / 2.0 + ordered[middle] / 2.0) / 1e6;
    }

    private static void workload(String name, List<List<Double>> points, int warmups, int repetitions) throws Exception {
        Map<String,Object> input = config(points, MAX_WORK);
        double[] point = new double[2]; int[] triple = new int[3]; int[] pair = new int[2];
        Delaunay2D reference = Delaunay2D.triangulate(input);
        int expectedVertices = name.equals("duplicate-records-512") ? 16 : points.size();
        if (reference.inputCount() != points.size() || reference.vertexCount() != expectedVertices)
            throw new AssertionError("registered site counts");
        if (name.equals("collinear-512")) {
            if (reference.faceCount() != 0 || reference.edgeCount() != 0) throw new AssertionError("collinear topology");
        } else {
            boolean[] used = new boolean[reference.vertexCount()];
            for (long face = 0; face < reference.faceCount(); face++) {
                reference.triangleInto(face, triple, 0);
                for (int vertex : triple) used[vertex] = true;
            }
            for (boolean present : used) if (!present) throw new AssertionError("unused registered site");
            int boundary = 0;
            for (long edge = 0; edge < reference.edgeCount(); edge++) {
                reference.edgeFacesInto(edge, pair, 0);
                if (pair[1] == -1) boundary++;
            }
            if (reference.faceCount() != 2 * expectedVertices - boundary - 2
                    || reference.edgeCount() != 3 * expectedVertices - boundary - 3)
                throw new AssertionError("registered topology counts");
        }
        long expected = checksum(reference, false, point, triple, pair);
        if (checksum(reference, true, point, triple, pair) != expected) throw new AssertionError("At/Into mismatch");
        if (name.equals("lattice-9") && reference.workUsed() != 49) throw new AssertionError("hand work count");
        for (int i = 0; i < warmups; i++) {
            Delaunay2D mesh = Delaunay2D.triangulate(input);
            if (checksum(mesh, true, point, triple, pair) != expected) throw new AssertionError("warmup replay");
            consumed = expected;
        }
        // Warm retained traversal independently so its measurement excludes startup.
        for (int i = 0; i < 20; i++) consumed = checksum(reference, true, point, triple, pair);
        long[] generation = new long[repetitions], generationBytes = new long[repetitions];
        long[] traversal = new long[repetitions], traversalBytes = new long[repetitions];
        long[] export = new long[repetitions], exportBytes = new long[repetitions];
        for (int i = 0; i < repetitions; i++) {
            long bytes = allocated(), start = System.nanoTime();
            Delaunay2D mesh = Delaunay2D.triangulate(input);
            generation[i] = System.nanoTime() - start; generationBytes[i] = allocationDelta(bytes);
            if (checksum(mesh, true, point, triple, pair) != expected) throw new AssertionError("generation replay");
            bytes = allocated(); start = System.nanoTime();
            long observed = checksum(mesh, true, point, triple, pair);
            traversal[i] = System.nanoTime() - start; traversalBytes[i] = allocationDelta(bytes);
            if (observed != expected) throw new AssertionError("traversal replay");
            consumed = observed;
            bytes = allocated(); start = System.nanoTime();
            Map<String,Object> values = mesh.toValues();
            export[i] = System.nanoTime() - start; exportBytes[i] = allocationDelta(bytes);
            if (values.size() != 7) throw new AssertionError("export fields");
            exported = values;
            exported = null;
        }
        String stage;
        try {
            Delaunay2D.triangulate(config(points, reference.workUsed() - 1));
            throw new AssertionError("one-short succeeded");
        } catch (RuntimeException failure) {
            Object code = failure.getClass().getField("code").get(failure);
            long used = failure.getClass().getField("workUsed").getLong(failure);
            stage = (String) failure.getClass().getField("stage").get(failure);
            if (!"WORK_LIMIT_EXCEEDED".equals(code) || used != reference.workUsed() - 1) throw new AssertionError("one-short details", failure);
        }
        long primitiveBytes = 4L * reference.inputCount() + 20L * reference.vertexCount()
            + 12L * reference.faceCount() + 16L * reference.edgeCount();
        System.out.println("{\"kind\":\"workload\",\"name\":" + quote(name)
            + ",\"inputCount\":" + reference.inputCount() + ",\"vertexCount\":" + reference.vertexCount()
            + ",\"faceCount\":" + reference.faceCount() + ",\"edgeCount\":" + reference.edgeCount()
            + ",\"workUsed\":" + reference.workUsed() + ",\"checksum\":" + quote(Long.toUnsignedString(expected, 16))
            + ",\"warmups\":" + warmups + ",\"repetitions\":" + repetitions
            + ",\"generation_ns\":" + Arrays.toString(generation) + ",\"generation_allocated_bytes\":" + Arrays.toString(generationBytes)
            + ",\"generation_median_ms\":" + median(generation)
            + ",\"traversal_ns\":" + Arrays.toString(traversal) + ",\"traversal_allocated_bytes\":" + Arrays.toString(traversalBytes)
            + ",\"export_ns\":" + Arrays.toString(export) + ",\"export_allocated_bytes\":" + Arrays.toString(exportBytes)
            + ",\"primitive_payload_bytes_excluding_headers\":" + primitiveBytes + ",\"one_short_stage\":" + quote(stage) + "}");
        System.out.flush();
    }

    public static void main(String[] args) throws Exception {
        System.out.println("{\"kind\":\"environment\",\"java\":" + quote(System.getProperty("java.runtime.version"))
            + ",\"vm\":" + quote(System.getProperty("java.vm.name")) + ",\"os\":" + quote(System.getProperty("os.name"))
            + ",\"arch\":" + quote(System.getProperty("os.arch")) + ",\"max_heap_bytes\":" + Runtime.getRuntime().maxMemory()
            + ",\"thread_allocation_supported\":" + (ALLOCATION != null) + ",\"maxWork\":" + MAX_WORK + "}");
        workload("lattice-9", grid(3), 3, 5);
        workload("scatter-128", scatter(128), 3, 5);
        workload("scatter-512", scatter(512), 3, 5);
        workload("lattice-400", grid(20), 3, 5);
        List<List<Double>> repeated = new ArrayList<>(), base = scatter(16);
        for (int i = 0; i < 512; i++) repeated.add(base.get(i % base.size()));
        workload("duplicate-records-512", repeated, 3, 5);
        List<List<Double>> collinear = new ArrayList<>();
        for (int i = 0; i < 512; i++) collinear.add(Arrays.asList((double)i, 3.0 * i));
        workload("collinear-512", collinear, 3, 5);
        List<List<Double>> mixed = scatter(29);
        mixed.add(Arrays.asList(-Double.MAX_VALUE, 0.0)); mixed.add(Arrays.asList(Double.MAX_VALUE, 0.0));
        mixed.add(Arrays.asList(0.0, Double.MIN_VALUE));
        workload("mixed-scale-32", mixed, 2, 3);
        workload("stress-scatter-2048", scatter(2048), 2, 3);
        System.out.println("{\"kind\":\"complete\",\"workloads\":8,\"status\":\"passed\"}");
    }
}
