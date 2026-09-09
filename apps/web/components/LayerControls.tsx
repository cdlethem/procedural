"use client";

import type { Layer, Technique } from "@/lib/studio-types";

const hex = (value: number) =>
  `#${(value >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
const rgb = (value: string) => {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  return match ? Number.parseInt(match[1], 16) : null;
};
const fixedGeometry = new Set([
  "loop-marks", "projection-marks", "ramp-marks", "profile-marks", "annular-marks",
]);

/** Shared bounded controls for a studio layer and a one-layer technique preview. */
export function LayerControls({
  layer,
  technique,
  onChange,
}: {
  layer: Layer;
  technique: Technique;
  onChange: (change: Partial<Layer>) => void;
}) {
  const params = layer.params;
  const changeParam = (key: string, value: number | string | boolean) =>
    onChange({ params: { ...params, [key]: value } });
  const changeColor = (index: number, value: string) => {
    const color = rgb(value);
    if (color === null) return;
    const palette = [...layer.palette];
    palette[index] = color;
    onChange({ palette } as Partial<Layer>);
  };
  return (
    <div className="layer-controls">
      <p className="control-description">{technique.description}</p>
      {!fixedGeometry.has(layer.technique) && <div className="control">
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
              if (Number.isInteger(value) && value >= 0 && value <= 4294967295)
                onChange({ seed: value });
            }}
          />
          <button
            className="action secondary"
            type="button"
            onClick={() => onChange({ seed: Math.floor(Math.random() * 4294967296) })}
          >
            New seed
          </button>
        </div>
      </div>}
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
            onChange={(event) => onChange({ opacity: Number(event.target.value) })}
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
              if (Number.isFinite(value) && value >= 0 && value <= 1) onChange({ opacity: value });
            }}
          />
        </div>
      </div>
      {technique.parameters.map((parameter) => {
        const value = params[parameter.key];
        if (parameter.type === "boolean")
          return (
            <div className="control toggle-control" key={parameter.key}>
              <label>
                <span>{parameter.label}</span>
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(event) => changeParam(parameter.key, event.target.checked)}
                />
              </label>
              <small>{parameter.description}</small>
            </div>
          );
        if (parameter.type === "select")
          return (
            <div className="control" key={parameter.key}>
              <label htmlFor={`${layer.id}-param-${parameter.key}`}>{parameter.label}</label>
              <select
                id={`${layer.id}-param-${parameter.key}`}
                value={String(value)}
                onChange={(event) => changeParam(parameter.key, event.target.value)}
              >
                {parameter.options?.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
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
                value={Number(value)}
                onChange={(event) => changeParam(parameter.key, Number(event.target.value))}
              />
              <input
                aria-label={`Exact ${parameter.label}`}
                type="number"
                min={parameter.min}
                max={parameter.max}
                step={parameter.step}
                value={Number(value)}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next >= parameter.min! && next <= parameter.max!)
                    changeParam(parameter.key, next);
                }}
              />
            </div>
            <small>{parameter.description}</small>
          </div>
        );
      })}
      <fieldset className="palette-control">
        <legend>Palette</legend>
        <small>Ordered RGB colors used by this layer.</small>
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
              onClick={() => onChange({ palette: layer.palette.filter((_, n) => n !== index) } as Partial<Layer>)}
            >−</button>
          </div>
        ))}
        <button
          className="action secondary"
          type="button"
          disabled={layer.palette.length >= 12}
          onClick={() => onChange({ palette: [...layer.palette, layer.palette.at(-1) ?? 0] } as Partial<Layer>)}
        >Add color</button>
      </fieldset>
    </div>
  );
}
