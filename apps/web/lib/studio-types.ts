/** App-specific, data-only composition document. Not the portable recipe grammar. */
export type TechniqueId =
  "field-marks" | "path-marks" | "placement-marks" | "lattice-marks";
export type Parameter = {
  key: string;
  label: string;
  description: string;
  type: "number" | "boolean" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
};
export type Layer = {
  id: string;
  technique: TechniqueId;
  visible: boolean;
  opacity: number;
  seed: number;
  params: Record<string, number | string | boolean>;
};
export type StudioDocument = {
  schemaVersion: 1;
  bindingVersion: "studio-v1";
  catalogSha256: string;
  width: 640;
  height: 640;
  background: string;
  layers: Layer[];
};
export type Technique = {
  id: TechniqueId;
  title: string;
  description: string;
  parameters: Parameter[];
};
