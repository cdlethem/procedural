package org.procedurals.examples.profilemarks;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.procedurals.mesh.RadialProfile3D;

/** Editable profiles for ProfileMarks; these settings are example choices, not library presets. */
public final class ProfileComposition {
    private final RadialProfile3D[] meshes;
    private final int slices;

    private ProfileComposition(RadialProfile3D[] meshes, int slices) {
        this.meshes = meshes;
        this.slices = slices;
    }

    public static ProfileComposition create(int slices, boolean capStart, boolean capEnd) {
        RadialProfile3D[] meshes = new RadialProfile3D[3];
        for (int shape = 0; shape < meshes.length; shape++) {
            List<Object> profile = new ArrayList<Object>();
            for (int point = 0; point <= 16; point++) {
                double fraction = point / 16.0;
                double z = -160.0 + point * 20.0;
                double radius = 60.0;
                if (shape == 1) radius -= 36.0 * Math.cos((fraction - 0.5) * Math.PI);
                if (shape == 2) radius *= 1.0 - fraction;
                // Replace these radius expressions or supply your own increasing [z,radius] pairs.
                profile.add(Arrays.<Object>asList(z, radius));
            }
            Map<String, Object> config = new LinkedHashMap<String, Object>();
            config.put("profile", profile);
            config.put("slices", slices);
            config.put("capStart", capStart);
            config.put("capEnd", capEnd);
            config.put("maxFaces", 10000);
            meshes[shape] = RadialProfile3D.generate(config);
        }
        return new ProfileComposition(meshes, slices);
    }

    public RadialProfile3D meshAt(int shape) { return meshes[shape]; }
    public int slices() { return slices; }
}
