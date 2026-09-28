import type { InstrumentDefinition, InstrumentInput } from "./types.js";

/** One admission path for both instrument inputs and named composition bindings. */
export function validateParameterValues(item: InstrumentDefinition, value: unknown): InstrumentInput["params"] {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("params must be an object");
  const source = value as Record<string, unknown>;
  const keys = Object.keys(item.defaults);
  for (const key of Reflect.ownKeys(source))
    if (typeof key !== "string" || !keys.includes(key))
      throw new Error(`params has an unknown key: ${String(key)}`);
  for (const key of keys)
    if (!Object.hasOwn(source, key)) throw new Error(`params is missing ${key}`);
  const copied: InstrumentInput["params"] = {};
  for (const parameter of item.parameters) {
    const entry = source[parameter.key], path = `params.${parameter.key}`;
    if (parameter.type === "boolean") {
      if (typeof entry !== "boolean") throw new Error(`${path} must be true or false`);
    } else if (parameter.type === "select") {
      if (typeof entry !== "string" || !parameter.options?.some(option => option.value === entry))
        throw new Error(`${path} is not an available option`);
    } else if (parameter.type === "text") {
      if (typeof entry !== "string" || entry.length > parameter.maxLength!)
        throw new Error(`${path} must be text of at most ${parameter.maxLength} characters`);
    } else {
      if (typeof entry !== "number" || !Number.isFinite(entry))
        throw new Error(`${path} must be a finite number`);
      const low = parameter.hardMin ?? parameter.min!, high = parameter.hardMax ?? parameter.max!;
      if (entry < low || entry > high)
        throw new Error(`${path} must be between ${low} and ${high}`);
      if ((parameter.integer ?? parameter.step === 1) && !Number.isInteger(entry))
        throw new Error(`${path} must be an integer`);
    }
    copied[parameter.key] = entry as number | string | boolean;
  }
  item.validate?.(copied);
  return copied;
}
