/** Reusable instrument data, independent of Studio's layer and document envelope. */
export type InstrumentInput = {
  technique: string;
  seed: number;
  palette: number[];
  params: Record<string, number | string | boolean>;
  cutEdits: CutEdit[];
};

/** Retained rectangle edits belong to the cut-marks instrument alone. */
export type CutEdit =
  | { kind: "cut"; id: number; axis: "X" | "Y"; coordinate: number }
  | { kind: "remove"; id: number };

export type Parameter = {
  key: string;
  label: string;
  description: string;
  type: "number" | "boolean" | "select" | "text";
  min?: number;
  max?: number;
  step?: number;
  /** Hard limits apply to exact entry; min/max describe the convenient slider interval. */
  hardMin?: number;
  hardMax?: number;
  integer?: boolean;
  options?: { value: string; label: string }[];
  maxLength?: number;
  multiline?: boolean;
  /** Slash-separated path of the control's inspector group, derived from `InstrumentDefinition.controlGroups`; never authored. */
  group?: string;
  /** Show when every named parameter matches one of its allowed values. Hidden values remain valid and retained. */
  visibleWhen?: Record<string, readonly (string | number | boolean)[]>;
};

/**
 * A library-owned inspector group: a labelled cluster of related controls, in display order.
 * Members are control keys or nested groups. See `control-groups.ts` for the contract.
 */
export type ControlGroup = {
  /** Heading, unique among its siblings; may not contain "/". */
  label: string;
  controls: readonly (string | ControlGroup)[];
  /**
   * Every member is a number measuring one quantity in one unit, where zero means none of it
   * (widths, radii, line weights, opacities), so scaling them all by one factor is a meaningful
   * single edit. A host may offer to lock their ratios and drive them together.
   */
  proportional?: true;
};

export type InstrumentDefinition = {
  id: string;
  title: string;
  description: string;
  /** Published definitions list these in `controlGroups` order, each with its derived `group`. */
  parameters: Parameter[];
  /** Every control belongs to exactly one group. */
  controlGroups: readonly ControlGroup[];
  defaults: Record<string, number | string | boolean>;
  renderer?: "2d" | "webgl";
  validate?: (params: InstrumentInput["params"]) => void;
};


/** Local adapter alias; only the envelope-free instrument value is exported publicly. */
export type Layer = InstrumentInput;
