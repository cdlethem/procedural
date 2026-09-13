import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { validatePalette, type SavedPalette } from "../palettes";
import { WORK_ROOT } from "./core";

export class PaletteConflict extends Error {}
export class PaletteNotFound extends Error {}
/** Synchronous compare/write is atomic within the single local Next service. */
export function paletteStore(root: string) {
  const path = (id: unknown) => {
    if (typeof id !== "string" || !/^palette-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id)) throw new PaletteNotFound("Palette not found.");
    return join(root, `${id}.json`);
  };
  const read = (id: unknown): SavedPalette => {
    const file = path(id);
    if (!existsSync(file)) throw new PaletteNotFound("This palette was deleted. Refresh the library.");
    const value = JSON.parse(readFileSync(file, "utf8")) as SavedPalette;
    if (value.schemaVersion !== 1 || value.id !== id || !Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error("Invalid stored palette.");
    return { ...value, ...validatePalette(value) };
  };
  const write = (value: SavedPalette) => {
    mkdirSync(root, { recursive: true });
    const file = path(value.id), temporary = `${file}.${randomUUID()}.tmp`;
    try { writeFileSync(temporary, JSON.stringify(value) + "\n"); renameSync(temporary, file); }
    finally { if (existsSync(temporary)) unlinkSync(temporary); }
    return structuredClone(value);
  };
  const current = (input: Record<string, unknown>) => {
    const value = read(input.id);
    if (input.revision !== value.revision) throw new PaletteConflict("This palette changed in another window. Refresh the library before editing it again. Your draft is still here.");
    return value;
  };
  return {
    read,
    list: () => existsSync(root) ? readdirSync(root).filter((name) => /^palette-.*\.json$/.test(name)).map((name) => read(name.slice(0, -5))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)) : [],
    create: (input: unknown) => { const draft = validatePalette(input), now = new Date().toISOString(); return write({ ...draft, schemaVersion: 1, id: `palette-${randomUUID()}`, revision: 1, createdAt: now, updatedAt: now }); },
    update: (input: Record<string, unknown>) => { const draft = validatePalette(input), old = current(input); return write({ ...old, ...draft, revision: old.revision + 1, updatedAt: new Date().toISOString() }); },
    remove: (input: Record<string, unknown>) => { const old = current(input); unlinkSync(path(old.id)); },
  };
}
export const palettes = paletteStore(join(WORK_ROOT, "palettes"));
