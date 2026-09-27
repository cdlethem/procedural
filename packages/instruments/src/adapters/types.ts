import type { InstrumentDefinition, Parameter } from "../types.js";
/** Local name used throughout the authored adapter definitions. */
export type StudioDefinition = InstrumentDefinition;
export const numeric = (
  key: string,
  label: string,
  description: string,
  min: number,
  max: number,
  step = 1,
  options: Pick<Parameter, "hardMin" | "hardMax" | "integer"> = {},
): Parameter => ({ key, label, description, type: "number", min, max, step, ...options });
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
export const text = (
  key: string,
  label: string,
  description: string,
  maxLength: number,
  multiline = false,
): Parameter => ({ key, label, description, type: "text", maxLength, multiline });
export const channels = (value: number): [number, number, number] => [
  (value >>> 16) & 255,
  (value >>> 8) & 255,
  value & 255,
];
