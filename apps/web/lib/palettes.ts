/** Named palettes are detached RGB snapshots, using the existing layer color bounds. */
export type PaletteDraft = { name: string; colors: string[] };
export type SavedPalette = PaletteDraft & { schemaVersion: 1; id: string; revision: number; createdAt: string; updatedAt: string };
export const paletteHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
export function validatePalette(input: unknown): PaletteDraft {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Provide a palette name and colors.");
  const value = input as Record<string, unknown>;
  if (typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 80) throw new Error("Name the palette using 1–80 characters.");
  if (!Array.isArray(value.colors) || value.colors.length < 2 || value.colors.length > 12) throw new Error("Choose between 2 and 12 colors.");
  const colors = value.colors.map((color: unknown) => {
    if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Use six-digit hex colors, such as #146b5e.");
    return color.toLowerCase();
  });
  return { name: value.name.trim(), colors };
}
export const paletteNumbers = (palette: PaletteDraft) => validatePalette(palette).colors.map((color) => Number.parseInt(color.slice(1), 16));
export function withPalettePrompt(prompt: string, palette?: PaletteDraft | null) {
  if (!palette) return prompt;
  const checked = validatePalette(palette);
  return `Use this ordered color palette for the artwork: ${checked.colors.join(", ")}. Preserve the requested structure; use these exact RGB colors as the base colors.\n\n${prompt}`;
}
export async function paletteRequest<T>(method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/harness/palettes", { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "The palette library is unavailable.");
  return value as T;
}
