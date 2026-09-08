import { RadialProfile3D } from "../../src/radial-profile.js";

/**
 * Editable ProfileMarks forms, independently composed as in the Java example.
 * The profile formulae and 8/32 editing choices are example settings, not presets,
 * defaults, or an observed recommended range for the radial-profile operation.
 */
export function createProfileComposition(slices, capStart, capEnd) {
  if (!Number.isSafeInteger(slices) || slices < 3 || slices > 715_827_881 ||
      typeof capStart !== "boolean" || typeof capEnd !== "boolean") throw new Error("example profile settings are invalid");
  const meshes = new Array(3);
  for (let shape = 0; shape < meshes.length; shape += 1) {
    const profile = new Array(17);
    for (let point = 0; point <= 16; point += 1) {
      const fraction = point / 16, z = -160 + point * 20;
      let radius = 60;
      if (shape === 1) radius -= 36 * Math.cos((fraction - .5) * Math.PI);
      if (shape === 2) radius *= 1 - fraction;
      profile[point] = [z, radius];
    }
    meshes[shape] = RadialProfile3D.generate({ profile, slices, capStart, capEnd, maxFaces: 10_000 });
  }
  const owned = meshes.slice();
  return Object.freeze({ slices, size: owned.length, meshAt(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= owned.length) throw new Error("example shape index is invalid");
    return owned[index];
  } });
}
