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
  /** Library-owned inspector section; slash-separated names describe nested slots. */
  group?: string;
  /** Show when every named parameter matches one of its allowed values. Hidden values remain valid and retained. */
  visibleWhen?: Record<string, readonly (string | number | boolean)[]>;
};

export type InstrumentDefinition = {
  id: string;
  title: string;
  description: string;
  parameters: Parameter[];
  defaults: Record<string, number | string | boolean>;
  renderer?: "2d" | "webgl";
  validate?: (params: InstrumentInput["params"]) => void;
};


/** Local adapter alias; only the envelope-free instrument value is exported publicly. */
export type Layer = InstrumentInput;
