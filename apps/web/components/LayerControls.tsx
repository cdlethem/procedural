"use client";

import { useEffect, useState } from "react";
import { PalettePicker } from "./PaletteLibrary";
import { paletteHex, paletteNumbers } from "@/lib/palettes";
import type { Layer, Parameter, Technique } from "@/lib/studio-types";

const hex = (value: number) =>
  `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
const rgb = (value: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? Number.parseInt(match[1], 16) : null;
};
const fixedGeometry = new Set([
  "loop-marks",
  "projection-marks",
  "ramp-marks",
  "profile-marks",
  "annular-marks",
  "geometric-panel",
  "orbital-brush",
  "contact-network",
  "agent-trails",
]);
type ControlsSection = "all" | "technique" | "style";

function ExactNumberInput({ parameter, value, onCommit }: {
  parameter: Parameter;
  value: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  useEffect(() => { setDraft(String(value)); setError(""); }, [value]);
  const hardMin = parameter.hardMin ?? parameter.min!;
  const hardMax = parameter.hardMax ?? parameter.max!;
  const integral = parameter.integer ?? parameter.step === 1;
  const commit = () => {
    const next = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(next) || next < hardMin || next > hardMax ||
        (integral && !Number.isInteger(next))) {
      setError(integral
        ? `Enter a whole number from ${hardMin} to ${hardMax}.`
        : `Enter a number from ${hardMin} to ${hardMax}.`);
      return;
    }
    setError("");
    setDraft(String(next));
    onCommit(next);
  };
  return <span>
    <input
      aria-label={`Exact ${parameter.label}`}
      aria-invalid={error !== ""}
      type="number"
      min={hardMin}
      max={hardMax}
      step={integral ? 1 : "any"}
      value={draft}
      onChange={(event) => { setDraft(event.target.value); setError(""); }}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
    />
    {error && <small role="alert">{error}</small>}
  </span>;
}

export const canReseed = (layer: Layer) =>
  !fixedGeometry.has(layer.technique) &&
  !(layer.technique === "placement-marks" && layer.params.radial === true);

/** Shared bounded controls for a studio layer and a one-layer technique preview. */
export function LayerControls({
  layer,
  technique,
  onChange,
  section = "all",
}: {
  layer: Layer;
  technique: Technique;
  onChange: (change: Partial<Layer>) => void;
  section?: ControlsSection;
}) {
  const params = layer.params;
  const changeParam = (key: string, value: number | string | boolean) =>
    onChange({ params: { ...params, [key]: value, ...(params.legacy === true ? { legacy: false } : {}) } });
  const changeColor = (index: number, value: string) => {
    const color = rgb(value);
    if (color === null) return;
    const palette = [...layer.palette];
    palette[index] = color;
    onChange({ palette } as Partial<Layer>);
  };
  return (
    <div className="layer-controls">
      {section !== "style" && (
        <p className="control-description">{technique.description}</p>
      )}
      {section !== "style" && params.legacy === true && (
        <p className="control-description">This saved composition keeps its earlier layout. Changing a control switches it to the editable field.</p>
      )}
      {section !== "style" && canReseed(layer) && (
        <div className="control">
          <label htmlFor={`seed-${layer.id}`}>Seed</label>
          <div className="number-control">
            <input
              id={`seed-${layer.id}`}
              type="number"
              min={0}
              max={4294967295}
              step={1}
              value={layer.seed}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (
                  Number.isInteger(value) &&
                  value >= 0 &&
                  value <= 4294967295
                )
                  onChange({ seed: value });
              }}
            />
          </div>
        </div>
      )}
      {section !== "technique" && (
        <div className="control">
          <label htmlFor={`opacity-${layer.id}`}>
            Opacity <output>{Math.round(layer.opacity * 100)}%</output>
          </label>
          <div className="range-number">
            <input
              id={`opacity-${layer.id}`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={layer.opacity}
              onChange={(event) =>
                onChange({ opacity: Number(event.target.value) })
              }
            />
            <input
              aria-label="Exact opacity"
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={layer.opacity}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value >= 0 && value <= 1)
                  onChange({ opacity: value });
              }}
            />
          </div>
        </div>
      )}
      {section !== "style" &&
        technique.parameters.filter((parameter) => !parameter.hidden).map((parameter) => {
          const value = params[parameter.key];
          if (parameter.type === "boolean")
            return (
              <div className="control toggle-control" key={parameter.key}>
                <label>
                  <span>{parameter.label}</span>
                  <input
                    type="checkbox"
                    checked={value === true}
                    onChange={(event) =>
                      changeParam(parameter.key, event.target.checked)
                    }
                  />
                </label>
                <small>{parameter.description}</small>
              </div>
            );
          if (parameter.type === "select")
            return (
              <div className="control" key={parameter.key}>
                <label htmlFor={`${layer.id}-param-${parameter.key}`}>
                  {parameter.label}
                </label>
                <select
                  id={`${layer.id}-param-${parameter.key}`}
                  value={String(value)}
                  onChange={(event) =>
                    changeParam(parameter.key, event.target.value)
                  }
                >
                  {parameter.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <small>{parameter.description}</small>
              </div>
            );
          return (
            <div className="control" key={parameter.key}>
              <label htmlFor={`${layer.id}-param-${parameter.key}`}>
                {parameter.label} <output>{String(value)}</output>
              </label>
              <div className="range-number">
                <input
                  id={`${layer.id}-param-${parameter.key}`}
                  type="range"
                  min={parameter.min}
                  max={parameter.max}
                  step={parameter.step}
                  value={Math.min(parameter.max!, Math.max(parameter.min!, Number(value)))}
                  onChange={(event) =>
                    changeParam(parameter.key, Number(event.target.value))
                  }
                />
                <ExactNumberInput
                  parameter={parameter}
                  value={Number(value)}
                  onCommit={(next) => changeParam(parameter.key, next)}
                />
              </div>
              {(Number(value) < parameter.min! || Number(value) > parameter.max!) &&
                <small>The exact value is outside the slider range.</small>}
              <small>{parameter.description}</small>
            </div>
          );
        })}
      {section !== "style" && layer.technique === "cut-marks" && (
        <p className="control-description">
          Changing Cut rounds, Cut spread, or Staggered regenerates the base
          layout and clears manual cuts. Palette, opacity, and inset keep them.
        </p>
      )}
      {section !== "technique" && (
        <fieldset className="palette-control">
          <legend>Palette</legend>
          <small>Ordered RGB colors used by this layer.</small>
          <PalettePicker currentColors={layer.palette.map(paletteHex)} onUse={(palette) => onChange({ palette: paletteNumbers(palette) })} />
          {layer.palette.map((color, index) => (
            <div className="palette-color" key={`${layer.id}-color-${index}`}>
              <input
                aria-label={`Palette color ${index + 1}`}
                type="color"
                value={hex(color)}
                onChange={(event) => changeColor(index, event.target.value)}
              />
              <input
                aria-label={`Palette color ${index + 1} hex`}
                type="text"
                defaultValue={hex(color)}
                key={`${color}-${index}`}
                pattern="#[0-9A-Fa-f]{6}"
                onBlur={(event) => {
                  const next = rgb(event.target.value);
                  if (next === null) event.currentTarget.value = hex(color);
                  else changeColor(index, event.target.value);
                }}
              />
              <button
                className="icon-button"
                type="button"
                disabled={layer.palette.length <= 2}
                aria-label={`Remove palette color ${index + 1}`}
                onClick={() =>
                  onChange({
                    palette: layer.palette.filter((_, n) => n !== index),
                  } as Partial<Layer>)
                }
              >
                −
              </button>
            </div>
          ))}
          <button
            className="action secondary"
            type="button"
            disabled={layer.palette.length >= 12}
            onClick={() =>
              onChange({
                palette: [...layer.palette, layer.palette.at(-1) ?? 0],
              } as Partial<Layer>)
            }
          >
            Add color
          </button>
        </fieldset>
      )}
    </div>
  );
}
