import { defaultPalettes as sourcePalettes } from "../../../packages/javascript/src/default-palettes.js";

export type DefaultPalette = Readonly<{
  id: string;
  name: string;
  colors: readonly string[];
  description: string;
  tags: readonly string[];
}>;

/** Shared immutable browser palette data; selections are copied at the UI boundary. */
export const defaultPalettes: readonly DefaultPalette[] = sourcePalettes;
