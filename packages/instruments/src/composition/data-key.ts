/**
 * The explanatory key: a separate drawn element built only from the resolved mapping, never from
 * hard-coded text. `dataKey(recipe, data)` returns typed rows (what is measured by which column,
 * the categories with their tone and role, the sample sizes at three domain positions, and the
 * ghost mark for missing values); `drawDataKey` paints them. Labels use the bundled outline font
 * (`textOutlines`): unshaped printable ASCII only, at most 20 characters, cut and marked with
 * "?" when a name does not fit; this is not full-script typography.
 */
import { textOutlines } from "../adapters/image-signal-instruments.js";
import type { DataScoresRecipe, DataFillKind, DataMarkKind } from "./data-scores.js";
import { applyMeasure } from "./data-table.js";
import type { ResolvedChannel, ResolvedData } from "./data-table.js";
import { color, motif } from "./materials.js";
import { createCompositionRun } from "./core.js";
import type { CompositionSurface } from "./types.js";

export type KeyRow =
  | { readonly kind: "title"; readonly text: string }
  | { readonly kind: "line"; readonly text: string }
  | { readonly kind: "sizes"; readonly text: string; readonly samples: readonly { readonly label: string; readonly size: number }[]; readonly what: "diameter" | "spacing" }
  | { readonly kind: "classes"; readonly text: string;
      readonly items: readonly { readonly name: string; readonly tone: number | null; readonly role: number | null }[]; readonly more: number }
  | { readonly kind: "ghost"; readonly text: string };
export interface KeyModel {
  readonly rows: readonly KeyRow[];
  /** Layout the key describes; decides the role glyphs (mark kinds or fill patterns). */
  readonly layout: DataScoresRecipe["layout"]["kind"];
}

const MAX_KEY_CLASSES = 10;

/** Printable ASCII, at most 20 characters, never empty. */
export function keyLabel(text: string): string {
  const clean = text.replace(/[^\x20-\x7E]/g, "?").trim().slice(0, 20).trim();
  return clean.length > 0 ? clean : "?";
}
export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) return String(Math.round(value));
  return String(Number(value.toPrecision(3)));
}
const unitText = (unit: string) => unit.length > 0 ? ` ${unit}` : "";

/** Rows describing exactly the channels the recipe mapped, in a fixed order. */
export function dataKey(recipe: DataScoresRecipe, data: ResolvedData): KeyModel {
  const { channels } = data.mapping;
  const rows: KeyRow[] = [{ kind: "title", text: keyLabel(data.table.title) }];
  const layout = recipe.layout.kind;
  const describe = (name: string, prefix: string) => {
    const channel = channels[name];
    if (channel) rows.push({ kind: "line", text: keyLabel(`${prefix} ${channel.column}`) });
  };
  if (layout === "timeline") {
    const time = channels.time;
    if (time?.kind === "measure") rows.push({ kind: "line", text: keyLabel(`x ${time.column} ${formatNumber(time.domain[0])}-${formatNumber(time.domain[1])}`) });
    describe("lane", "lanes");
    describe("level", "y");
  }
  if (layout === "lattice") describe("loose", "loose");
  if (layout === "treemap") {
    const area = channels.area;
    if (area?.kind === "quantity") rows.push({ kind: "line", text: keyLabel(`area: ${area.column}${unitText(area.unit)}`) });
  }
  const size = channels.size;
  if (size?.kind === "measure") {
    const [start, end] = size.domain;
    const samples = [0, .5, 1].map((t) => {
      const input = start + t * (end - start);
      const mapped = applyMeasure(size, input);
      return { label: formatNumber(input), size: mapped === "outside" ? size.range[t === 0 ? 0 : 1] : mapped };
    });
    rows.push({ kind: "sizes", text: keyLabel(`${layout === "treemap" ? "fill" : "size"} ${size.column}${unitText(size.unit)}`),
      samples, what: layout === "treemap" ? "spacing" : "diameter" });
  }
  const tone = channels.tone, role = channels.role;
  const classes = (name: string, channel: Extract<ResolvedChannel, { kind: "category" }>, tones: boolean, roles: boolean) => {
    const items = channel.categories.slice(0, MAX_KEY_CLASSES).map((category, index) => ({ name: keyLabel(category),
      tone: tones ? index : null, role: roles ? index : null }));
    rows.push({ kind: "classes", text: keyLabel(`${name} ${channel.column}`), items, more: Math.max(0, channel.categories.length - MAX_KEY_CLASSES) });
  };
  if (tone?.kind === "category" && role?.kind === "category" && tone.column === role.column) classes("color+form", tone, true, true);
  else {
    if (tone?.kind === "category") classes("color", tone, true, false);
    if (role?.kind === "category") classes("form", role, false, true);
  }
  if (data.units.some((unit) => unit.outside.length > 0)) rows.push({ kind: "line", text: keyLabel("blank = out of range") });
  if (recipe.absence === "ghost" && data.units.some((unit) => unit.missing.length > 0))
    rows.push({ kind: "ghost", text: keyLabel(layout === "treemap" ? "empty = no value" : "ring = no value") });
  return Object.freeze({ rows: Object.freeze(rows), layout });
}

// ---------------------------------------------------------------- drawing

const TEXT_HEIGHT = 6.4;
const CAP_HEIGHT_UNITS = 115;
/** Stroke one line of label text; returns its width. Outline glyphs, drawn as closed rings. */
export function drawKeyText(surface: CompositionSurface, text: string, x: number, baseline: number, scale: number, palette: readonly number[], weight: number, alpha: number): number {
  const factor = TEXT_HEIGHT * scale / CAP_HEIGHT_UNITS;
  const rings = textOutlines(text);
  let left = Infinity, right = -Infinity;
  for (const ring of rings) for (const [px] of ring) { left = Math.min(left, px); right = Math.max(right, px); }
  if (rings.length === 0) return 0;
  surface.noFill(); color(surface, palette, 0, alpha, false); surface.strokeWeight(weight);
  for (const ring of rings) {
    surface.beginShape();
    for (const [px, py] of ring) surface.vertex(x + (px - left) * factor, baseline + py * factor);
    surface.endShape(surface.CLOSE);
  }
  return (right - left) * factor;
}

const roleMarks: readonly DataMarkKind[] = ["dot", "rings", "rosette", "arrow"];
/** A small pattern standing for a fill kind, inside a `size × size` square at (x, y). */
function fillGlyph(surface: CompositionSurface, kind: DataFillKind, x: number, y: number, size: number, palette: readonly number[], tone: number): void {
  surface.noFill(); color(surface, palette, tone, 220, false); surface.strokeWeight(.7); surface.strokeCap(surface.ROUND);
  if (kind === "hatch") for (let i = 1; i < 4; i++) surface.line(x, y + size * i / 4 + size * .15, x + size, y + size * i / 4 - size * .15);
  else if (kind === "motifs") {
    color(surface, palette, tone, 220, true); surface.noStroke();
    for (const [dx, dy] of [[.25, .3], [.7, .25], [.45, .7], [.85, .75]]) surface.circle(x + size * dx, y + size * dy, size * .16);
  } else for (const inset of [.15, .35]) {
    surface.beginShape();
    for (let i = 0; i <= 12; i++) { const t = i / 12; surface.vertex(x + size * t, y + size * (inset + .18 + .12 * Math.sin(t * 6.3 + inset * 9))); }
    surface.endShape();
  }
}

/**
 * Paint the key with its top-left corner at (x, y). `scale` multiplies every length. Sample marks
 * that would exceed 22 units are drawn together at a reduced factor (the key is a legend, not a
 * measurement). Every drawing call is isolated by push/pop; nothing outside the key is touched.
 */
export function drawDataKey(surface: CompositionSurface, model: KeyModel, recipe: DataScoresRecipe, x: number, y: number, scale: number): void {
  const palette = recipe.palette;
  const roleKinds = recipe.marks.roleKinds.length > 0 ? recipe.marks.roleKinds : roleMarks;
  const fillKinds = recipe.fill.roleKinds;
  let cursor = y;
  const run = createCompositionRun();
  const textWeight = Math.max(.35, .55 * scale);
  surface.push();
  try {
    for (const row of model.rows) {
      if (row.kind === "title") {
        drawKeyText(surface, row.text, x, cursor + TEXT_HEIGHT * scale, scale * 1.15, palette, textWeight * 1.4, 235);
        cursor += 13 * scale;
      } else if (row.kind === "line") {
        drawKeyText(surface, row.text, x, cursor + TEXT_HEIGHT * scale, scale, palette, textWeight, 225);
        cursor += 10.5 * scale;
      } else if (row.kind === "sizes") {
        drawKeyText(surface, row.text, x, cursor + TEXT_HEIGHT * scale, scale, palette, textWeight, 225);
        cursor += 10 * scale;
        const largest = Math.max(...row.samples.map((sample) => Math.abs(sample.size)), 1e-9);
        const factor = row.what === "diameter" ? Math.min(1, 22 / largest) : 1;
        const height = row.what === "diameter" ? Math.max(12, Math.min(22, largest) + 2) : 15;
        row.samples.forEach((sample, index) => {
          const cx = x + (index * 64 + 12) * scale, cy = cursor + height * scale / 2;
          if (row.what === "diameter") {
            const size = Math.min(500, Math.max(0, sample.size)) * factor * scale;
            if (size > 0) {
              surface.push();
              try {
                surface.translate(cx, cy);
                motif({ kind: recipe.marks.vocabulary === "by-role" ? "dot" : recipe.marks.vocabulary, size, petals: recipe.marks.petals,
                  opening: recipe.marks.opening, weight: Math.max(.35, recipe.marks.weight * scale * factor), rotation: 0, variation: 0, retention: 1 }, palette)(
                  surface, { id: "key", seed: 0, position: [0, 0], angle: 0, scale: 1, tone: 0 }, run);
              } finally { surface.pop(); }
            }
          } else {
            const box = 13 * scale;
            surface.noFill(); color(surface, palette, 0, 200, false); surface.strokeWeight(.6);
            surface.rect(cx - box / 2, cy - box / 2, box, box);
            const gap = Math.max(.8 * scale, sample.size * .35 * scale);
            for (let line = gap; line < box; line += gap) surface.line(cx - box / 2, cy - box / 2 + line, cx + box / 2, cy - box / 2 + line);
          }
          const reach = row.what === "diameter" ? Math.min(22, largest) / 2 + 3 : 10;
          drawKeyText(surface, sample.label, cx + reach * scale, cy + TEXT_HEIGHT * scale * .5, scale * .9, palette, textWeight * .9, 215);
        });
        cursor += (height + 2) * scale;
      } else if (row.kind === "classes") {
        drawKeyText(surface, row.text, x, cursor + TEXT_HEIGHT * scale, scale, palette, textWeight, 225);
        cursor += 10 * scale;
        for (const item of row.items) {
          const cx = x + 6 * scale, cy = cursor + 4.5 * scale, tone = item.tone ?? 0;
          surface.push();
          try {
            if (model.layout === "treemap") {
              if (item.tone !== null && item.role === null) {
                surface.noStroke(); color(surface, palette, tone, 210, true); surface.rect(cx - 5 * scale, cy - 4 * scale, 10 * scale, 8 * scale);
              } else fillGlyph(surface, fillKinds[(item.role ?? 0) % fillKinds.length], cx - 5 * scale, cy - 4 * scale, 9 * scale, palette, tone);
            } else {
              surface.translate(cx, cy);
              const kind = item.role === null ? "dot" : roleKinds[item.role % roleKinds.length];
              motif({ kind, size: 8 * scale, petals: recipe.marks.petals, opening: recipe.marks.opening, weight: Math.max(.35, .8 * scale), rotation: 0, variation: 0, retention: 1 }, palette)(
                surface, { id: "key", seed: 0, position: [0, 0], angle: 0, scale: 1, tone }, run);
            }
          } finally { surface.pop(); }
          drawKeyText(surface, item.name, x + 15 * scale, cy + TEXT_HEIGHT * scale * .5, scale * .9, palette, textWeight * .9, 215);
          cursor += 9.5 * scale;
        }
        if (row.more > 0) {
          drawKeyText(surface, keyLabel(`+${row.more} more`), x + 15 * scale, cursor + 5.5 * scale, scale * .9, palette, textWeight * .9, 150);
          cursor += 9.5 * scale;
        }
        cursor += 2 * scale;
      } else {
        surface.push();
        try {
          surface.noFill(); color(surface, palette, 0, 150, false); surface.strokeWeight(.8 * scale);
          if (model.layout === "treemap") surface.rect(x + 2 * scale, cursor + 1.5 * scale, 8 * scale, 6 * scale);
          else surface.circle(x + 6 * scale, cursor + 4.5 * scale, 6 * scale);
        } finally { surface.pop(); }
        drawKeyText(surface, row.text, x + 15 * scale, cursor + 7.5 * scale, scale * .9, palette, textWeight * .9, 215);
        cursor += 10.5 * scale;
      }
    }
  } finally { surface.pop(); }
}
