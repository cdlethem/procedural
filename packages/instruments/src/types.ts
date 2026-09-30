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

/**
 * A comparison on a `number` control: one operator, or one lower bound (`gt`/`gte`) with one
 * upper bound (`lt`/`lte`). Literals are finite numbers inside the control's hard range.
 */
export type NumberComparison = { lt?: number; lte?: number; gt?: number; gte?: number; eq?: number; ne?: number };

/**
 * One alternative: a conjunction over drivers. A `select` or `boolean` driver lists its allowed
 * values; a `number` driver states a comparison.
 */
export type VisibilityCondition = Record<string, readonly (string | number | boolean)[] | NumberComparison>;

/** A condition, or a non-empty array of alternatives any one of which suffices. */
export type VisibleWhen = VisibilityCondition | readonly VisibilityCondition[];

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
  /** The stage of the control's top-level group, derived like `group`; never authored. */
  stage?: ControlStage;
  /**
   * Show when the condition holds: one alternative, or an array of alternatives of which any one
   * suffices (see `visibility.ts`). Hidden values remain valid and retained.
   */
  visibleWhen?: VisibleWhen;
};

/**
 * What an artist is trying to do with a group of controls, in the order those decisions are
 * usually made: `form` decides what is built, `process` how it develops, `material` how it is
 * drawn, `color` which colors it takes, `frame` where it sits and how it is viewed. Hosts present
 * the stages as an ordered path through the inspector; nothing is gated on the order.
 */
export type ControlStage = "form" | "process" | "material" | "color" | "frame";


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
  /** Required on every top-level group, never on a nested one: nested groups belong to their parent's stage. */
  stage?: ControlStage;
};

export type InstrumentDefinition = {
  id: string;
  title: string;
  description: string;
  /** Published definitions list these in `controlGroups` order, each with its derived `group` and `stage`. */
  parameters: Parameter[];
  /** Every control belongs to exactly one group; every top-level group states its stage. */
  controlGroups: readonly ControlGroup[];
  /**
   * One to four control keys, in order, that best show what the instrument does at first touch:
   * a host's landing or "start here" knobs. Numbers or selects only; every key must exist.
   */
  featured?: readonly string[];
  defaults: Record<string, number | string | boolean>;
  renderer?: "2d" | "webgl";
  validate?: (params: InstrumentInput["params"]) => void;
};


/** Local adapter alias; only the envelope-free instrument value is exported publicly. */
export type Layer = InstrumentInput;
