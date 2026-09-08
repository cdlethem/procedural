package org.procedurals.examples.cutbranchmarks;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.procedurals.topology.LinePool2D;

/** Editable seed-stroke policy; all mutable cutting is performed by LinePool2D. */
public final class CutBranchComposition {
    private final LinePool2D pool;
    private CutBranchComposition(LinePool2D pool) { this.pool = pool; }

    public static CutBranchComposition create(long seed, boolean narrow,
                                               boolean sparse, boolean alternate) {
        Map<String,Object> input = new LinkedHashMap<String,Object>();
        input.put("seed", seed);
        input.put("segment", alternate ? Arrays.asList(180d,760d,760d,240d)
                                       : Arrays.asList(480d,850d,480d,200d));
        input.put("attempts", sparse ? 9000 : 90000);
        input.put("firstCutAngleScale", narrow ? .7d : 1.4d);
        input.put("minCutLength", 4d);
        input.put("maxSegments", 180001);
        return new CutBranchComposition(LinePool2D.generate(input));
    }
    public LinePool2D pool() { return pool; }
}
