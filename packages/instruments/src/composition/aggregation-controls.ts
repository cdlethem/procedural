import { checkColonyOptions, checkColonySteps, type ColonyDomainSpec, type ColonyOptions } from "./aggregation.js";
import type { BundledRasterId } from "./raster-samples.js";

type Scalar = number | string | boolean;

/** The domain the instrument's stored controls describe (bundled constructions only). */
export function instrumentDomain(q: Record<string, Scalar>): ColonyDomainSpec {
  const box = { x: q.domainX as number, y: q.domainY as number, width: q.domainWidth as number, height: q.domainHeight as number };
  switch (q.domain) {
    case "none": return { kind: "none" };
    case "rectangle": case "ellipse": return { kind: q.domain, ...box };
    case "ring": return { kind: "ring", ...box, hole: q.domainHole as number };
    case "letters": return { kind: "letters", text: q.domainWord as string, ...box };
    case "image": return { kind: "image", id: q.domainImage as BundledRasterId, variant: q.domainVariant as number, threshold: q.domainThreshold as number, ...box };
    default: throw new Error(`Unknown domain: ${String(q.domain)}`);
  }
}

/** The construction options the instrument's stored controls describe. */
export function instrumentOptions(q: Record<string, Scalar>, seed: number): ColonyOptions {
  return {
    seed,
    seeds: { shape: q.seedShape as ColonyOptions["seeds"]["shape"], count: q.seedCount as number, x: q.seedX as number, y: q.seedY as number,
      width: q.seedWidth as number, height: q.seedHeight as number, angle: q.seedAngle as number },
    source: { shape: q.source as ColonyOptions["source"]["shape"], x: q.sourceX as number, y: q.sourceY as number, width: q.sourceWidth as number,
      height: q.sourceHeight as number, angle: q.sourceAngle as number },
    domain: instrumentDomain(q),
    walker: { radius: q.radius as number, stick: q.stick as number, bias: q.bias as number, biasAngle: q.biasAngle as number, pull: q.pull as number, turn: q.turn as number },
    growth: { reach: q.reach as number, lifetime: q.lifetime as number, patience: q.patience as number, escape: q.escape as number },
  };
}

/** Cross-control checks the definition runs on every admission: option ranges and the work bound, without growing anything. */
export function validateColonyControls(q: Record<string, Scalar>): void {
  const options = instrumentOptions(q, 0);
  checkColonyOptions(options);
  checkColonySteps(q.steps as number, options.growth);
}
