import type { Layer, Parameter, Technique } from "../studio-types";
/** Bounded app composition settings, distinct from catalog operation defaults. */
export type StudioDefinition = Technique & {
  defaults: Record<string, number | string | boolean>;
  renderer?: "2d" | "webgl";
  validate?: (params: Layer["params"]) => void;
};
export const numeric = (
  key: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step = 1,
): Parameter => ({ key, label, description, type: "number", min, max, step });
export const choice = (
  key: string,
  label: string,
  description: string,
  options: string[],
): Parameter => ({
  key,
  label,
  description,
  type: "select",
  options: options.map((value) => ({ value, label: value })),
});
export const toggle = (
  key: string,
  label: string,
  description: string,
): Parameter => ({ key, label, description, type: "boolean" });
export const channels = (value: number): [number, number, number] => [
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
