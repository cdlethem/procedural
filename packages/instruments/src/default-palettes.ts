import { defaultPalettes as sourcePalettes } from "@procedurals/javascript"

export type DefaultPalette = Readonly<{
  id: string;
  name: string;
  colors: readonly string[];
  description: string;
  tags: readonly string[];
}>;

/** Shared immutable browser palette data; selections are copied at the UI boundary. */
export const defaultPalettes: readonly DefaultPalette[] = sourcePalettes;

/** Keep the authored image and glyph palettes independent of old renderers. */
export function imageAndControlsPalette(id: string): number[] | null {
  const paletteId = ({ "weighted-image-atlas": "copper-patina", "word-echo": "fern-mauve" } as Record<string, string>)[id];
  if (!paletteId) return null;
  const palette = defaultPalettes.find(item => item.id === paletteId);
  return palette ? palette.colors.map(hex => Number.parseInt(hex.slice(1), 16)) : null;
}
