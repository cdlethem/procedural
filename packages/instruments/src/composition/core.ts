import type { CompositionRun, CompositionSurface, Path, Region, Site } from "./types.js";

/** Independent stream per element and purpose; neither traversal order nor omitted siblings affect it. */
export function componentSeed(parentSeed: number, id: string, purpose: string): number {
  if (!Number.isSafeInteger(parentSeed) || parentSeed < 0 || parentSeed > 0xffffffff)
    throw new Error("Parent seed must be a uint32 integer");
  let hash = (0x811c9dc5 ^ parentSeed) >>> 0;
  for (const value of [id, purpose]) {
    hash = Math.imul(hash ^ value.length, 0x01000193) >>> 0;
    for (let index = 0; index < value.length; index++)
      hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function createCompositionRun(options: { maxWork?: number; maxDepth?: number; cancelled?: () => boolean } = {}): CompositionRun {
  const { maxWork = 100_000, maxDepth = 8, cancelled } = options;
  if (!Number.isSafeInteger(maxWork) || maxWork < 0 || !Number.isSafeInteger(maxDepth) || maxDepth < 1)
    throw new Error("Composition budget and depth must be nonnegative safe integers (depth at least 1)");
  let workUsed = 0, depth = 0;
  return {
    get workUsed() { return workUsed; },
    get depth() { return depth; },
    check() { if (cancelled?.()) throw new Error("Composition cancelled"); },
    enter(work) {
      this.check();
      if (!Number.isSafeInteger(work) || work < 0 || work > maxWork - workUsed)
        throw new Error("Composition work budget exceeded");
      if (depth >= maxDepth) throw new Error("Composition nesting depth exceeded");
      workUsed += work;
      depth++;
    },
    leave() { if (depth < 1) throw new Error("Composition depth underflow"); depth--; },
  };
}

type FrameSurface = Pick<CompositionSurface, "push" | "pop" | "translate" | "rotate" | "scale">;
type PlacementSurface = Pick<FrameSurface, "push" | "pop" | "translate" | "rotate"> & Partial<Pick<FrameSurface, "scale">>;
type WorldSurface = Pick<CompositionSurface, "push" | "pop">;
type RegionSurface = WorldSurface & Pick<CompositionSurface, "translate">;

/** Isolate each mark's styling and frame; local coordinates start at the site.
 *  A negative scale mirrors the mark across the site's frame axis after rotation. */
export function atEach<S extends PlacementSurface, T extends Site>(surface: S, sites: readonly T[], mark: (surface: S, site: T, run: CompositionRun) => void, run: CompositionRun = createCompositionRun()): void {
  for (const site of sites) {
    run.enter(1);
    try {
      surface.push();
      try {
        surface.translate(site.position[0], site.position[1]);
        surface.rotate(site.angle);
        const scale = site.scale;
        if (scale !== 1) {
          if (!surface.scale) throw new Error("Site scaling requires a scale-capable surface");
          if (scale < 0) surface.scale(-scale, scale);
          else surface.scale(scale);
        }
        mark(surface, site, run);
      } finally { surface.pop(); }
    } finally { run.leave(); }
  }
}

/** Paths are already world-space geometry; each material receives a complete path. */
export function strokeWith<S extends WorldSurface, T extends Path>(surface: S, paths: readonly T[], material: (surface: S, path: T, run: CompositionRun) => void, run: CompositionRun = createCompositionRun()): void {
  for (const path of paths) {
    run.enter(1);
    try {
      surface.push();
      try { material(surface, path, run); }
      finally { surface.pop(); }
    } finally { run.leave(); }
  }
}

/** Rectangular regions use local [0,width] × [0,height] coordinates without scaling. */
export function inside<S extends RegionSurface, T extends Region>(surface: S, regions: readonly T[], filler: (surface: S, region: T, run: CompositionRun) => void, run: CompositionRun = createCompositionRun()): void {
  for (const region of regions) {
    run.enter(1);
    try {
      surface.push();
      try {
        surface.translate(region.bounds[0], region.bounds[1]);
        filler(surface, region, run);
      } finally { surface.pop(); }
    } finally { run.leave(); }
  }
}
