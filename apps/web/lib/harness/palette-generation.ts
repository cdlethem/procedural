import { validatePalette } from "../palettes";
import { chat, firstJsonObject, modelProfile } from "./model";

export function validatePalettePrompt(input: unknown) {
  if (!input || typeof input !== "object") throw new Error("Describe the palette you want.");
  const value = input as Record<string, unknown>;
  if (typeof value.prompt !== "string" || value.prompt.trim().length < 3 || value.prompt.length > 2000) throw new Error("Describe the colors using 3–2000 characters.");
  if (!Number.isInteger(value.count) || Number(value.count) < 2 || Number(value.count) > 12) throw new Error("Choose between 2 and 12 colors.");
  return { prompt: value.prompt.trim(), count: Number(value.count) };
}
export async function generatePalette(input: unknown, signal: AbortSignal) {
  const { prompt, count } = validatePalettePrompt(input);
  const profile = await modelProfile(signal);
  const reply = await chat({ ...profile, maxTokens: 512 }, [
    { role: "system", content: 'You create artist color palettes. Return only one JSON object with "name" (a short descriptive name, at most 80 characters) and "colors" (ordered six-digit RGB hex strings starting with #). No code, explanation, or other fields. Interpret the requested mood and colors thoughtfully.' },
    { role: "user", content: `Create exactly ${count} colors. Artist request: ${prompt}` },
  ], signal);
  const draft = validatePalette(firstJsonObject(reply.text));
  if (draft.colors.length !== count) throw new Error(`The model returned ${draft.colors.length} colors instead of ${count}. Try generating again.`);
  return draft;
}
