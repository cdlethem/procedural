/** Read encoded sRGB; opacity is deliberately absent from the SDK color contract. */
export function parseRgbColor(value: string): [number, number, number] {
  if (typeof value !== "string" || !/^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(value))
    throw Error("Color must be a #RGB or #RRGGBB hex string");
  const hex = value.length === 4
    ? Array.from(value.slice(1), digit => digit + digit).join("")
    : value.slice(1);
  return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number];
}

/** Select all packed palette RGB stops, or a separately editable sequence of hex stops. */
export function rampStops(palette: number[], source: string, custom: string): number[][] {
  if (source === "palette") {
    if (!Array.isArray(palette) || palette.length < 2 || !palette.every(value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff))
      throw Error("Palette must contain at least two packed RGB colors");
    return palette.map(value => [((value >>> 16) & 255) / 255, ((value >>> 8) & 255) / 255, (value & 255) / 255]);
  }
  if (source !== "custom") throw Error("colorSource must be palette or custom");
  if (typeof custom !== "string") throw Error("colorStops must be a JSON array of hex colors");
  let stops: unknown;
  try { stops = JSON.parse(custom); }
  catch { throw Error("colorStops must be a JSON array of hex colors"); }
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > 32)
    throw Error("colorStops requires 2 to 32 hex colors");
  return stops.map((value: unknown) => parseRgbColor(value as string));
}
