/** App-specific, data-only composition document. Not the portable recipe grammar. */
/** Known technique IDs are admitted by the app registry at runtime. */
export type TechniqueId = string;
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
import type { LayerTransform } from "./layer-transform";

export type CutEdit =
  | { kind: "cut"; id: number; axis: "X" | "Y"; coordinate: number }
  | { kind: "remove"; id: number };
export type Layer = {
  id: string;
  technique: TechniqueId;
  visible: boolean;
  opacity: number;
  seed: number;
  palette: number[];
  cutEdits: CutEdit[];
  transform: LayerTransform;
  params: Record<string, number | string | boolean>;
};
export type StudioDocument = {
  schemaVersion: 1;
  bindingVersion: "studio-v3";
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
